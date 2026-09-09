/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  worker-test.mjs — ทดสอบ cloudflare-worker.js ก่อน deploy
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  วิธีรัน (ต้องใช้ Node 18 ขึ้นไป ไม่ต้องติดตั้งอะไรเพิ่ม):
 *      node scripts/worker-test.mjs
 *
 *  ทำไมต้องมี: Worker ถูก deploy ด้วยมือผ่าน Dashboard ถ้าโค้ดพังจะรู้ตอนของจริงพังแล้ว
 *  ไฟล์นี้จำลอง KV และ LINE API ไว้ในหน่วยความจำ จึงรันได้โดยไม่ยิงเข้า LINE จริง
 *  และไม่แตะข้อมูลใน Cloudflare
 *
 *  ครอบคลุม: /status, /auth/login, /data (กันข้อมูลหาย + สำเนา), /notify (ผลจริง,
 *  retry, ลบผู้รับที่ตาย), ข้อความยาวเกินลิมิต, /webhook (ลายเซ็น), @mention, scheduled()
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import worker from '../cloudflare-worker.js';

const makeKV = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key, type) { const v = store.get(key); return v === undefined ? null : (type === 'json' ? JSON.parse(v) : v); },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  };
};

const CHANNEL_SECRET = 'test-secret';
const baseEnv = () => ({
  ADMIN_PASSWORD: 'pw', API_SECRET_KEY: 'key', CHANNEL_ACCESS_TOKEN: 'tok', CHANNEL_SECRET,
  REPAIR_GROUP_ID: 'Crepair', RECIPIENT_ID: 'Ufallback',
  ROOM_BOOKINGS_KV: makeKV(), EQUIPMENT_BORROWINGS_KV: makeKV(), REPAIR_REQUESTS_KV: makeKV(),
});
const ctx = { waitUntil: p => p };
const req = (path, opts = {}) => new Request(`https://w.dev${path}`, opts);
const authed = (path, opts = {}) => req(path, { ...opts, headers: { 'X-API-Key': 'key', 'Content-Type': 'application/json', ...(opts.headers || {}) } });

let lineCalls = [];
let lineResponder = () => new Response('{}', { status: 200 });
globalThis.fetch = async (url, init) => { lineCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return lineResponder(String(url)); };

const sign = async (body) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
};

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

// ── 1) /status ──────────────────────────────────────────────────────────────
console.log('\n[1] /status');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cgroup1', '1');
  const res = await worker.fetch(req('/status'), env, ctx);
  const body = await res.json();
  check('มี channelSecretSet', body.channelSecretSet === true);
  check('นับผู้รับได้', body.recipientCount === 1, JSON.stringify(body));
}

// ── 2) /auth/login ──────────────────────────────────────────────────────────
console.log('\n[2] /auth/login');
{
  const env = baseEnv();
  const ok = await worker.fetch(req('/auth/login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }), env, ctx);
  const bad = await worker.fetch(req('/auth/login', { method: 'POST', body: JSON.stringify({ password: 'x' }) }), env, ctx);
  check('รหัสถูก → 200', ok.status === 200);
  check('รหัสผิด → 401', bad.status === 401);
  const noPw = { ...baseEnv(), ADMIN_PASSWORD: undefined };
  const empty = await worker.fetch(req('/auth/login', { method: 'POST', body: JSON.stringify({ password: '' }) }), noPw, ctx);
  check('ไม่ตั้ง ADMIN_PASSWORD → ไม่ให้เข้า', empty.status === 401);
}

// ── 3) /data guard + backup ────────────────────────────────────────────────
console.log('\n[3] /data — ตรวจข้อมูล + สำเนากันข้อมูลหาย');
{
  const env = baseEnv();
  const rows = [{ id: '1', date: '2026-09-09' }, { id: '2', date: '2026-09-10' }];
  const save = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify(rows) }), env, ctx);
  check('บันทึก array ได้', save.status === 200 && (await save.json()).count === 2);

  const badBody = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify({ oops: true }) }), env, ctx);
  check('body ที่ไม่ใช่ array → 400', badBody.status === 400);
  const stillThere = await (await worker.fetch(authed('/data?type=rooms'), env, ctx)).json();
  check('ข้อมูลเดิมไม่ถูกทับ', stillThere.length === 2);

  await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify([rows[0]]) }), env, ctx);
  const prev = await (await worker.fetch(authed('/data?type=rooms&version=prev'), env, ctx)).json();
  check('อ่านสำเนาก่อนหน้าได้ (กู้คืนได้)', prev.length === 2, JSON.stringify(prev));

  const noKey = await worker.fetch(req('/data?type=rooms'), env, ctx);
  check('ไม่มี API key → 401', noKey.status === 401);
}

// ── 3b) /data — กันข้อมูลหายเมื่อสองคนบันทึกพร้อมกัน ────────────────────────
console.log('\n[3b] /data — บันทึกชนกัน (X-Data-Version)');
{
  const env = baseEnv();
  const first = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify([{ id: 'a' }]) }), env, ctx);
  const v1 = first.headers.get('X-Data-Version');
  check('POST คืนเลขรุ่นใหม่', !!v1);

  const get = await worker.fetch(authed('/data?type=rooms'), env, ctx);
  check('GET คืนเลขรุ่นเดียวกัน', get.headers.get('X-Data-Version') === v1);
  // ถ้าไม่ประกาศ expose ไว้ เบราว์เซอร์จะอ่าน header นี้ไม่ได้ ระบบกันชนจะเงียบไปเฉย ๆ
  check('ประกาศ Access-Control-Expose-Headers ให้เบราว์เซอร์อ่านเลขรุ่นได้',
    (get.headers.get('Access-Control-Expose-Headers') || '').includes('X-Data-Version'));
  check('อนุญาต header X-Data-Version ขาเข้า',
    (get.headers.get('Access-Control-Allow-Headers') || '').includes('X-Data-Version'));

  // คน A บันทึกด้วยเลขรุ่นที่ถูกต้อง → ผ่าน
  const okSave = await worker.fetch(authed('/data?type=rooms', {
    method: 'POST', headers: { 'X-Data-Version': v1 }, body: JSON.stringify([{ id: 'a' }, { id: 'b' }]),
  }), env, ctx);
  check('เลขรุ่นตรง → บันทึกได้', okSave.status === 200);
  const v2 = okSave.headers.get('X-Data-Version');
  check('เลขรุ่นเปลี่ยนหลังบันทึก', v2 !== v1);

  // คน B ถือเลขรุ่นเก่า (v1) → ต้องถูกปฏิเสธ พร้อมส่งข้อมูลล่าสุดกลับไปให้รวม
  const conflict = await worker.fetch(authed('/data?type=rooms', {
    method: 'POST', headers: { 'X-Data-Version': v1 }, body: JSON.stringify([{ id: 'a' }, { id: 'c' }]),
  }), env, ctx);
  check('เลขรุ่นเก่า → 409 ไม่เขียนทับ', conflict.status === 409);
  const conflictBody = await conflict.json();
  check('409 ส่งข้อมูลล่าสุดกลับไปด้วย', conflictBody.data.length === 2 && conflictBody.version === v2, JSON.stringify(conflictBody.data));
  const afterConflict = await (await worker.fetch(authed('/data?type=rooms'), env, ctx)).json();
  check('ของคน A ยังอยู่ครบ ไม่ถูกทับ', afterConflict.map(r => r.id).join(',') === 'a,b');

  // ไม่แนบเลขรุ่นมาเลย (frontend รุ่นเก่า) → ยังบันทึกได้เหมือนเดิม
  const legacy = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify([{ id: 'z' }]) }), env, ctx);
  check('ไม่แนบเลขรุ่น → ยังบันทึกได้ (frontend เก่าไม่พัง)', legacy.status === 200);
}

// ── 3c) /auth/login — จำกัดการเดารหัส ──────────────────────────────────────
console.log('\n[3c] /auth/login — จำกัดจำนวนครั้ง');
{
  const env = baseEnv();
  const attempt = (password) => worker.fetch(new Request('https://w.dev/auth/login', {
    method: 'POST', body: JSON.stringify({ password }), headers: { 'CF-Connecting-IP': '1.2.3.4' },
  }), env, ctx);

  let statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await attempt('ผิด')).status);
  check('10 ครั้งแรกตอบ 401', statuses.slice(0, 10).every(s => s === 401), statuses.join(','));
  check('ครั้งที่ 11 ขึ้นไปตอบ 429 (ล็อกไว้ 15 นาที)', statuses.slice(10).every(s => s === 429), statuses.join(','));
  check('ถูกล็อกแล้วรหัสถูกก็ยังเข้าไม่ได้', (await attempt('pw')).status === 429);

  const env2 = baseEnv();
  const attempt2 = (password) => worker.fetch(new Request('https://w.dev/auth/login', {
    method: 'POST', body: JSON.stringify({ password }), headers: { 'CF-Connecting-IP': '5.6.7.8' },
  }), env2, ctx);
  await attempt2('ผิด');
  check('เข้าถูกแล้วตัวนับถูกล้าง', (await attempt2('pw')).status === 200 && (await env2.ROOM_BOOKINGS_KV.get('login_attempt:5.6.7.8')) === null);
}

// ── 4) /notify ──────────────────────────────────────────────────────────────
console.log('\n[4] /notify — รายงานผลจริงจาก LINE');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg1', '1');
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg2', '1');

  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  const okRes = await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ทดสอบ' }) }), env, ctx);
  const okBody = await okRes.json();
  check('ส่งครบ 2 กลุ่ม', okBody.success === true && okBody.sent === 2 && okBody.total === 2, JSON.stringify(okBody));
  check('เรียก LINE push 2 ครั้ง', lineCalls.filter(c => c.url.endsWith('/message/push')).length === 2);

  // ปลายทางส่งไม่ได้ถาวร (403) → ต้องรายงานว่าไม่สำเร็จ และลบผู้รับที่ตายแล้วทิ้ง
  lineCalls = []; lineResponder = () => new Response('{"message":"forbidden"}', { status: 403 });
  const failRes = await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ทดสอบ' }) }), env, ctx);
  const failBody = await failRes.json();
  check('ทุกปลายทางพัง → success:false', failBody.success === false && failBody.sent === 0, JSON.stringify(failBody));
  check('403 → ลบผู้รับที่ส่งไม่ได้ออกอัตโนมัติ', failBody.removed.length === 2, JSON.stringify(failBody.removed));
  check('ไม่ retry กับ 403 (ยิงแค่ 2 ครั้ง)', lineCalls.length === 2, `calls=${lineCalls.length}`);

  // 429 = โควตาเต็ม/ถี่เกิน → ต้องลองใหม่ และไม่ลบผู้รับทิ้ง
  const env2 = baseEnv();
  await env2.ROOM_BOOKINGS_KV.put('recipient:Cg3', '1');
  lineCalls = []; lineResponder = () => new Response('{"message":"rate limit"}', { status: 429 });
  const rlBody = await (await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ทดสอบ' }) }), env2, ctx)).json();
  check('429 → ลองใหม่ 3 ครั้ง', lineCalls.length === 3, `calls=${lineCalls.length}`);
  check('429 → ไม่ลบผู้รับ', rlBody.removed.length === 0 && (await env2.ROOM_BOOKINGS_KV.get('recipient:Cg3')) === '1');
  check('429 → บอกเหตุผลว่าโควตา/ถี่เกินไป', String(rlBody.error).includes('โควตา'), rlBody.error);

  // ข้อความว่าง
  const emptyRes = await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: '   ' }) }), env, ctx);
  check('ข้อความว่าง → 400', emptyRes.status === 400);

  // target=repair ส่งเข้ากลุ่มเดียว และไม่ลบ recipient แม้ 403
  const env3 = baseEnv();
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  const rep = await (await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ซ่อม', target: 'repair' }) }), env3, ctx)).json();
  check('target=repair ส่งเข้ากลุ่มซ่อมกลุ่มเดียว', rep.sent === 1 && lineCalls[0].body.to === 'Crepair', JSON.stringify(lineCalls[0]?.body?.to));

  const env4 = { ...baseEnv(), REPAIR_GROUP_ID: undefined };
  const noGroup = await (await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ซ่อม', target: 'repair' }) }), env4, ctx)).json();
  check('ไม่ตั้ง REPAIR_GROUP_ID → บอกว่าไม่สำเร็จพร้อมเหตุผล', noGroup.success === false && String(noGroup.error).includes('REPAIR_GROUP_ID'));
}

// ── 5) ข้อความยาวเกินลิมิต LINE ────────────────────────────────────────────
console.log('\n[5] ข้อความยาว > 5,000 ตัวอักษร');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg1', '1');
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  const longMsg = Array.from({ length: 400 }, (_, i) => `บรรทัดที่ ${i} รายการจองห้องประชุมของหน่วยงาน`).join('\n');
  await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: longMsg }) }), env, ctx);
  const msgs = lineCalls[0].body.messages;
  check('ถูกตัดเป็นหลายข้อความ', msgs.length > 1, `len=${msgs.length}`);
  check('ทุกข้อความไม่เกิน 5000 ตัวอักษร', msgs.every(m => m.text.length <= 5000));
}

// ── 6) /webhook — ลายเซ็น ───────────────────────────────────────────────────
console.log('\n[6] /webhook — ตรวจลายเซ็น');
{
  const env = baseEnv();
  const body = JSON.stringify({ events: [{ type: 'join', source: { groupId: 'Cforged' } }] });

  const forged = await worker.fetch(req('/webhook', { method: 'POST', body, headers: { 'x-line-signature': 'ZmFrZS1zaWduYXR1cmUtMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=' } }), env, ctx);
  check('ลายเซ็นผิด → 401', forged.status === 401);
  check('ลายเซ็นผิด → ไม่ถูกเพิ่มเป็นผู้รับ', (await env.ROOM_BOOKINGS_KV.get('recipient:Cforged')) === null);

  const noSig = await worker.fetch(req('/webhook', { method: 'POST', body }), env, ctx);
  check('ไม่มีลายเซ็น → 401', noSig.status === 401);

  const real = await worker.fetch(req('/webhook', { method: 'POST', body, headers: { 'x-line-signature': await sign(body) } }), env, ctx);
  check('ลายเซ็นถูก → 200', real.status === 200);
  check('ลายเซ็นถูก → เพิ่มกลุ่มเป็นผู้รับ', (await env.ROOM_BOOKINGS_KV.get('recipient:Cforged')) === '1');

  // leave → ลบออก
  const leaveBody = JSON.stringify({ events: [{ type: 'leave', source: { groupId: 'Cforged' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: leaveBody, headers: { 'x-line-signature': await sign(leaveBody) } }), env, ctx);
  check('leave → ลบผู้รับออก', (await env.ROOM_BOOKINGS_KV.get('recipient:Cforged')) === null);

  // ยังไม่ตั้ง CHANNEL_SECRET → ยังทำงานได้ (แต่มี warning) เพื่อไม่ให้ระบบเดิมพังทันที
  const envNoSecret = { ...baseEnv(), CHANNEL_SECRET: undefined };
  const legacy = await worker.fetch(req('/webhook', { method: 'POST', body }), envNoSecret, ctx);
  check('ไม่ตั้ง CHANNEL_SECRET → ยังรับ event ได้ (ของเดิมไม่พัง)', legacy.status === 200);
}

// ── 7) @mention routing ─────────────────────────────────────────────────────
console.log('\n[7] @mention — เลือกคำสั่งถูกประเภท');
{
  const env = baseEnv();
  await env.EQUIPMENT_BORROWINGS_KV.put('equipment_data', JSON.stringify([{ borrowerName: 'ก', equipmentList: 'กล้อง', status: 'อยู่ระหว่างการยืม', returnDate: '2026-09-20' }]));
  await env.REPAIR_REQUESTS_KV.put('repairs_data', JSON.stringify([{ requesterName: 'ข', department: 'สื่อ', roomName: '101', problemType: 'จอเสีย', description: 'ภาพไม่ขึ้น', status: 'รอดำเนินการ', priority: 'ด่วน', createdAt: '2026-09-01' }]));
  await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify([{ roomName: 'ห้อง 1', date: new Date(Date.now() + 7 * 3600e3).toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', purpose: 'ประชุม', bookerName: 'ค', status: 'จองแล้ว' }]));

  const mention = async (text) => {
    lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', message: { type: 'text', text, mention: { mentionees: [{ isSelf: true }] } } }] });
    await worker.fetch(req('/webhook', { method: 'POST', body, headers: { 'x-line-signature': await sign(body) } }), env, ctx);
    return lineCalls.find(c => c.url.endsWith('/message/reply'))?.body.messages[0].text ?? '';
  };

  check('"@bot ยืม" → รายงานอุปกรณ์', (await mention('@bot ยืม')).includes('ยืมอุปกรณ์'));
  check('"@bot ซ่อม" → รายงานแจ้งซ่อม', (await mention('@bot ซ่อม')).includes('แจ้งซ่อม'));
  check('"@bot ขอยืมห้องประชุม" → รายงานการจองห้อง (ไม่ใช่อุปกรณ์)', (await mention('@bot ขอยืมห้องประชุมวันนี้')).includes('รายการจอง'));
  check('"@bot รายงานสัปดาห์นี้" → รายงานรายสัปดาห์', (await mention('@bot รายงานสัปดาห์นี้')).includes('สัปดาห์นี้'));
  check('"@bot จองทั้งหมด" → รายการที่จะถึง', (await mention('@bot จองทั้งหมด')).includes('การจองที่จะถึง'));
  check('"@bot สวัสดี" → ตอบวิธีใช้ ไม่เงียบใส่', (await mention('@bot สวัสดีครับ')).includes('พิมพ์ @ชื่อบอท'));
}

// ── 8) scheduled() ──────────────────────────────────────────────────────────
console.log('\n[8] scheduled() — สรุปประจำวัน');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg1', '1');
  const thaiToday = new Date(Date.now() + 7 * 3600e3).toISOString().split('T')[0];
  const utcToday = new Date().toISOString().split('T')[0];
  await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify([
    { roomName: 'ห้อง 1', date: thaiToday, startTime: '09:00', endTime: '12:00', purpose: 'ประชุมครู', bookerName: 'ครูเอ', status: 'จองแล้ว' },
  ]));
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  await worker.scheduled({}, env, ctx);
  const sent = lineCalls.find(c => c.url.endsWith('/message/push'));
  check('ส่งสรุปของ "วันนี้ตามเวลาไทย"', !!sent && sent.body.messages[0].text.includes('ประชุมครู'), `thai=${thaiToday} utc=${utcToday}`);

  lineCalls = [];
  await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify([]));
  await worker.scheduled({}, env, ctx);
  check('ไม่มีการจอง → ไม่ส่งอะไรเลย (ไม่รบกวนกลุ่ม)', lineCalls.length === 0);
}

// ── 9) migrate ผู้รับแบบเก่า ────────────────────────────────────────────────
console.log('\n[9] ผู้รับแบบเก่า (recipient_ids)');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient_ids', JSON.stringify(['Cold1', 'Cold2']));
  const first = await (await worker.fetch(req('/status'), env, ctx)).json();
  check('migrate ของเก่ามาเป็น key แยก', first.recipientCount === 2, JSON.stringify(first));

  await env.ROOM_BOOKINGS_KV.delete('recipient:Cold1');
  await env.ROOM_BOOKINGS_KV.delete('recipient:Cold2');
  const second = await (await worker.fetch(req('/status'), env, ctx)).json();
  check('ลบผู้รับหมดแล้วของเก่าไม่ฟื้นคืนชีพ', second.recipientCount === 0, JSON.stringify(second));
}

console.log(`\n──────────────\nผ่าน ${pass} / ล้มเหลว ${fail}`);
process.exit(fail === 0 ? 0 : 1);
