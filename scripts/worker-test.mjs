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

// Cloudflare ใส่ CF-Connecting-IP ให้ทุก request ที่ผ่านขอบเสมอ (ปลอมไม่ได้ CF เขียนทับให้)
// Worker ใช้ header นี้จำกัดจำนวนครั้งการเดารหัสผ่าน จึงต้องมีในทุก request จำลองด้วย
const req = (path, opts = {}) =>
  new Request(`https://w.dev${path}`, { ...opts, headers: { 'CF-Connecting-IP': '1.1.1.1', ...(opts.headers || {}) } });
const authed = (path, opts = {}) => req(path, { ...opts, headers: { 'X-API-Key': 'key', 'Content-Type': 'application/json', ...(opts.headers || {}) } });

/** ขอตั๋วแอดมินจริงจาก /auth/login — งานของแอดมินต้องแนบตั๋วนี้ทุกครั้ง */
const adminToken = async (env) => {
  const res = await worker.fetch(
    req('/auth/login', { method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify({ password: 'pw' }) }),
    env, ctx
  );
  return (await res.json()).token;
};

/** request ที่มีทั้ง API Key และตั๋วแอดมิน */
const asAdmin = async (env, path, opts = {}) =>
  authed(path, { ...opts, headers: { 'X-Admin-Token': await adminToken(env), ...(opts.headers || {}) } });

let lineCalls = [];
let lineResponder = () => new Response('{}', { status: 200 });
globalThis.fetch = async (url, init) => { lineCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return lineResponder(String(url)); };

const sign = async (body) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
};

const recipientState = async (env, id) => {
  const raw = await env.ROOM_BOOKINGS_KV.get(`recipient:${id}`);
  return raw === null ? null : JSON.parse(raw);
};

const getStatus = async (env) => (await worker.fetch(await asAdmin(env, '/status'), env, ctx)).json();

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

// ── 1) /status ──────────────────────────────────────────────────────────────
console.log('\n[1] /status');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cgroup1', '1');
  const res = await worker.fetch(await asAdmin(env, '/status'), env, ctx);
  const body = await res.json();
  check('มี channelSecretSet', body.channelSecretSet === true);
  check('นับผู้รับได้', body.recipientCount === 1, JSON.stringify(body));

  // สถานะการตั้งค่าเป็นข้อมูลที่ช่วยคนที่จะโจมตีเลือกช่องทาง — ต้องไม่เปิดสาธารณะ
  const anon = await worker.fetch(req('/status'), env, ctx);
  check('ไม่มีตั๋วแอดมิน → 401', anon.status === 401);
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
  check('ไม่มีกลุ่มรับแจ้งซ่อมเลย → บอกว่าไม่สำเร็จพร้อมวิธีแก้', noGroup.success === false && String(noGroup.error).includes('REPAIR_GROUP_ID'), noGroup.error);
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
  check('ลายเซ็นถูก → เพิ่มกลุ่มเป็นผู้รับ', (await recipientState(env, 'Cforged'))?.topics.includes('rooms'));

  // leave → ลบออก
  const leaveBody = JSON.stringify({ events: [{ type: 'leave', source: { groupId: 'Cforged' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: leaveBody, headers: { 'x-line-signature': await sign(leaveBody) } }), env, ctx);
  check('leave → หยุดรับแจ้งเตือน (แต่ยังเก็บ Group ID ไว้)',
    String((await recipientState(env, 'Cforged'))?.left).startsWith('left:'));

  // ยังไม่ตั้ง CHANNEL_SECRET → ต้องปฏิเสธทุก event (fail-closed)
  // เดิมข้ามการตรวจลายเซ็นให้ ทำให้ตอนตั้งค่าไม่ครบกลายเป็นตอนที่ไม่มีการป้องกันเลย
  // ใครรู้ URL ก็ยิง join ปลอมเพื่อเอากลุ่มตัวเองไปรับข้อมูลการจอง/แจ้งซ่อมได้
  const envNoSecret = { ...baseEnv(), CHANNEL_SECRET: undefined };
  const noSecret = await worker.fetch(req('/webhook', { method: 'POST', body }), envNoSecret, ctx);
  check('ไม่ตั้ง CHANNEL_SECRET → ปฏิเสธ event (503)', noSecret.status === 503);
  check('ไม่ตั้ง CHANNEL_SECRET → ไม่เพิ่มกลุ่มปลอมเข้า KV',
    (await recipientState(envNoSecret, 'Cforged')) === null);
}

// ── 6b) บอทออกจากกลุ่ม — ต้องเก็บ Group ID ไว้ ไม่ลบ key ทิ้ง ─────────────────
console.log('\n[6b] บอทออกจากกลุ่ม — เก็บ key ไว้ให้ก็อป Group ID ต่อได้');
{
  const env = baseEnv();
  const join = JSON.stringify({ events: [{ type: 'join', source: { groupId: 'Cgroup9' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: join, headers: { 'x-line-signature': await sign(join) } }), env, ctx);
  check('เข้ากลุ่ม → ติ๊ก "จองห้อง" ให้เป็นค่าเริ่มต้น', (await recipientState(env, 'Cgroup9'))?.topics.join() === 'rooms');

  const leave = JSON.stringify({ events: [{ type: 'leave', source: { groupId: 'Cgroup9' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: leave, headers: { 'x-line-signature': await sign(leave) } }), env, ctx);
  const afterLeave = await recipientState(env, 'Cgroup9');
  check('ออกจากกลุ่ม → key ยังอยู่ (ไม่ลืม Group ID)', afterLeave !== null, JSON.stringify(afterLeave));
  check('ออกจากกลุ่ม → มีเครื่องหมาย left พร้อมเวลา', String(afterLeave?.left).startsWith('left:'), JSON.stringify(afterLeave));

  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  const notify = await (await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'x' }) }), env, ctx)).json();
  check('กลุ่มที่ออกไปแล้วไม่ได้รับแจ้งเตือนอีก', notify.total === 1 && lineCalls[0].body.to === 'Ufallback', JSON.stringify(notify));

  // เชิญกลับเข้ากลุ่มเดิม → กลับมารับแจ้งเตือนเอง
  await worker.fetch(req('/webhook', { method: 'POST', body: join, headers: { 'x-line-signature': await sign(join) } }), env, ctx);
  check('เชิญบอทกลับ → กลับมารับแจ้งเตือน', (await getStatus(env)).recipientCount === 1);

  // ปิดรับเองด้วยการแก้ค่าใน Dashboard เป็น "off"
  await env.ROOM_BOOKINGS_KV.put('recipient:Cgroup9', 'off');
  check('แก้ค่าเป็น "off" ด้วยมือ → หยุดรับแจ้งเตือน', (await getStatus(env)).recipientCount === 0);

  // ออกจากกลุ่มอีกครั้ง แล้ว /recipients ต้องยังเห็น เพื่อก็อป Group ID ไปใช้ต่อ
  await worker.fetch(req('/webhook', { method: 'POST', body: leave, headers: { 'x-line-signature': await sign(leave) } }), env, ctx);
  lineResponder = () => new Response(JSON.stringify({ groupName: 'กลุ่มแจ้งซ่อม' }), { status: 200 });
  const listed = await (await worker.fetch(await asAdmin(env, '/recipients'), env, ctx)).json();
  const gone = listed.find(r => r.id === 'Cgroup9');
  check('/recipients ยังคืนกลุ่มที่บอทออกไปแล้ว พร้อม active:false', gone && gone.active === false, JSON.stringify(listed));
}

// ── 6c) เลือกหัวข้อแจ้งเตือนรายกลุ่ม (ติ๊กจากหน้าแอดมิน) ────────────────────
console.log('\n[6c] แต่ละกลุ่มเลือกรับเฉพาะหัวข้อที่ติ๊กไว้');
{
  const env = baseEnv();
  const setTopics = async (id, topics) => worker.fetch(await asAdmin(env, '/recipients', { method: 'POST', body: JSON.stringify({ id, topics }) }), env, ctx);
  const notify = async (target) => {
    lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
    const body = await (await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'x', target }) }), env, ctx)).json();
    return { body, to: lineCalls.filter(c => c.url.endsWith('/message/push')).map(c => c.body.to).sort() };
  };

  await env.ROOM_BOOKINGS_KV.put('recipient:Cห้อง', '1');       // ค่าเดิมแบบเก่า = รับจองห้อง
  await env.ROOM_BOOKINGS_KV.put('recipient:Cทั้งคู่', '1');
  check('บันทึกหัวข้อผ่าน POST /recipients', (await setTopics('Cซ่อม', ['repairs'])).status === 200);
  await setTopics('Cทั้งคู่', ['rooms', 'repairs']);

  const rooms = await notify(undefined);
  check('จองห้อง → เข้าเฉพาะกลุ่มที่ติ๊ก "จองห้อง"', rooms.to.join(',') === ['Cทั้งคู่', 'Cห้อง'].sort().join(','), rooms.to.join(','));
  const repairs = await notify('repair');
  check('แจ้งซ่อม → เข้าเฉพาะกลุ่มที่ติ๊ก "แจ้งซ่อม"', repairs.to.join(',') === ['Cซ่อม', 'Cทั้งคู่'].sort().join(','), repairs.to.join(','));
  check('กลุ่มที่ติ๊กเฉพาะซ่อม ไม่ได้รับเรื่องจองห้อง', !rooms.to.includes('Cซ่อม'));

  // เอาติ๊กออกหมด = ไม่รับอะไรเลย
  await setTopics('Cห้อง', []);
  const afterUncheck = await notify(undefined);
  check('เอาติ๊กออกหมด → กลุ่มนั้นเงียบ', !afterUncheck.to.includes('Cห้อง'), afterUncheck.to.join(','));

  // บอทออกจากกลุ่มแล้วเชิญกลับ — ต้องจำหัวข้อที่เคยติ๊กไว้
  const leave = JSON.stringify({ events: [{ type: 'leave', source: { groupId: 'Cซ่อม' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: leave, headers: { 'x-line-signature': await sign(leave) } }), env, ctx);
  const whileGone = await notify('repair');
  check('บอทออกจากกลุ่ม → ไม่ส่งหาแล้ว', !whileGone.to.includes('Cซ่อม'), whileGone.to.join(','));
  const join = JSON.stringify({ events: [{ type: 'join', source: { groupId: 'Cซ่อม' } }] });
  await worker.fetch(req('/webhook', { method: 'POST', body: join, headers: { 'x-line-signature': await sign(join) } }), env, ctx);
  const back = await notify('repair');
  check('เชิญกลับ → จำได้ว่าเคยติ๊กเฉพาะแจ้งซ่อม', back.to.includes('Cซ่อม'), back.to.join(','));
  const roomsAfterBack = await notify(undefined);
  check('เชิญกลับ → ไม่ถูกรีเซ็ตเป็นรับจองห้อง', !roomsAfterBack.to.includes('Cซ่อม'), roomsAfterBack.to.join(','));

  // ลบกลุ่มออกจากรายการถาวร
  const del = async (id) => worker.fetch(await asAdmin(env, `/recipients?id=${encodeURIComponent(id)}`, { method: 'DELETE' }), env, ctx);
  check('ลบกลุ่มออกจากรายการได้', (await del('Cห้อง')).status === 200);
  check('ลบแล้ว key หายจริง', (await env.ROOM_BOOKINGS_KV.get('recipient:Cห้อง')) === null);
  const delRepairEnv = await (await del('Crepair')).json();
  check('ลบกลุ่มที่ตั้งไว้ใน REPAIR_GROUP_ID → เตือนว่ามันจะกลับมา',
    String(delRepairEnv.warning).includes('REPAIR_GROUP_ID'), JSON.stringify(delRepairEnv));
  check('ลบโดยไม่ส่ง id → 400', (await worker.fetch(await asAdmin(env, '/recipients', { method: 'DELETE' }), env, ctx)).status === 400);

  // ข้อมูลเข้าไม่ถูกรูปแบบ
  const badTopic = await worker.fetch(await asAdmin(env, '/recipients', { method: 'POST', body: JSON.stringify({ id: 'C1', topics: ['ทุกอย่าง'] }) }), env, ctx);
  check('หัวข้อที่ไม่รู้จัก → 400', badTopic.status === 400);
  const noId = await worker.fetch(await asAdmin(env, '/recipients', { method: 'POST', body: JSON.stringify({ topics: [] }) }), env, ctx);
  check('ไม่ส่ง id → 400', noId.status === 400);
}

// ── 6d) ระบบเดิมที่ยังไม่ได้ติ๊กอะไร ต้องทำงานเหมือนเดิม ─────────────────────
console.log('\n[6d] เข้ากันได้กับของเดิม (ยังไม่เคยตั้งค่าในหน้าแอดมิน)');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cเดิม', '1');   // ค่าที่มีอยู่จริงในระบบตอนนี้
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'x' }) }), env, ctx);
  check('ค่าเก่า "1" → ยังได้รับแจ้งเตือนจองห้องเหมือนเดิม', lineCalls[0].body.to === 'Cเดิม');

  lineCalls = [];
  await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'x', target: 'repair' }) }), env, ctx);
  check('ยังไม่มีใครติ๊ก "แจ้งซ่อม" → ใช้ REPAIR_GROUP_ID เป็นตัวสำรอง', lineCalls[0].body.to === 'Crepair');
  check('ค่าเก่า "1" ไม่ได้รับแจ้งซ่อม', lineCalls.every(c => c.body.to !== 'Cเดิม'));

  // /recipients ดึงกลุ่มจาก REPAIR_GROUP_ID เข้ามาให้ติ๊กได้ในหน้าเว็บ
  lineResponder = () => new Response(JSON.stringify({ groupName: 'กลุ่มแจ้งซ่อม' }), { status: 200 });
  const listed = await (await worker.fetch(await asAdmin(env, '/recipients'), env, ctx)).json();
  const repairEntry = listed.find(r => r.id === 'Crepair');
  check('/recipients ดึงกลุ่มจาก REPAIR_GROUP_ID มาให้จัดการในหน้าเว็บ', !!repairEntry, JSON.stringify(listed.map(r => r.id)));
  check('กลุ่มนั้นถูกติ๊ก "แจ้งซ่อม" ไว้ให้แล้ว', repairEntry?.topics.join(',') === 'repairs', JSON.stringify(repairEntry));
  check('กลุ่มเดิมแสดงว่าติ๊ก "จองห้อง" ไว้', listed.find(r => r.id === 'Cเดิม')?.topics.join(',') === 'rooms');
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

// ── 8) scheduled() — ปิดการใช้งานแล้ว ──────────────────────────────────────
console.log('\n[8] scheduled() — สรุปประจำวันถูกปิดแล้ว');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg1', '1');
  const thaiToday = new Date(Date.now() + 7 * 3600e3).toISOString().split('T')[0];
  await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify([
    { roomName: 'ห้อง 1', date: thaiToday, startTime: '09:00', endTime: '12:00', purpose: 'ประชุมครู', bookerName: 'ครูเอ', status: 'จองแล้ว' },
  ]));
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });
  await worker.scheduled({}, env, ctx);
  check('cron ที่ค้างอยู่ยิงมาก็ไม่ส่งอะไรเข้ากลุ่ม', lineCalls.length === 0, `calls=${lineCalls.length}`);
}

// ── 9) migrate ผู้รับแบบเก่า ────────────────────────────────────────────────
console.log('\n[9] ผู้รับแบบเก่า (recipient_ids)');
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient_ids', JSON.stringify(['Cold1', 'Cold2']));
  const first = await (await worker.fetch(await asAdmin(env, '/status'), env, ctx)).json();
  check('migrate ของเก่ามาเป็น key แยก', first.recipientCount === 2, JSON.stringify(first));

  await env.ROOM_BOOKINGS_KV.delete('recipient:Cold1');
  await env.ROOM_BOOKINGS_KV.delete('recipient:Cold2');
  const second = await (await worker.fetch(await asAdmin(env, '/status'), env, ctx)).json();
  check('ลบผู้รับหมดแล้วของเก่าไม่ฟื้นคืนชีพ', second.recipientCount === 0, JSON.stringify(second));
}

// ── 10) ความปลอดภัย — ตั๋วแอดมิน, CORS, การลบยกชุด, ลิงก์ไฟล์แนบ ─────────────
console.log('\n[10] ความปลอดภัย');
{
  const env = baseEnv();

  // ── ตั๋วแอดมินปลอมเองไม่ได้ ────────────────────────────────────────────────
  const forged = authed('/recipients', { headers: { 'X-Admin-Token': `${Date.now() + 60000}.abc.not-a-real-signature` } });
  check('ตั๋วแอดมินที่เซ็นเองไม่ผ่าน', (await worker.fetch(forged, env, ctx)).status === 403);

  const expired = authed('/recipients', { headers: { 'X-Admin-Token': `${Date.now() - 1000}.abc.sig` } });
  check('ตั๋วหมดอายุแล้วไม่ผ่าน', (await worker.fetch(expired, env, ctx)).status === 403);

  // เปลี่ยนรหัสผ่านแอดมิน = ตั๋วเก่าทุกใบใช้ไม่ได้ทันที
  const token = await adminToken(env);
  const rotated = { ...env, ADMIN_PASSWORD: 'รหัสใหม่' };
  const afterRotate = authed('/recipients', { headers: { 'X-Admin-Token': token } });
  check('เปลี่ยนรหัสผ่าน → ตั๋วเก่าใช้ไม่ได้', (await worker.fetch(afterRotate, rotated, ctx)).status === 403);

  // ── CORS จำกัดเฉพาะ Origin ของเรา ─────────────────────────────────────────
  const evil = await worker.fetch(req('/status', { headers: { Origin: 'https://evil.example' } }), env, ctx);
  check('Origin แปลกปลอม → ไม่ได้ Access-Control-Allow-Origin',
    evil.headers.get('Access-Control-Allow-Origin') === null);

  const ours = await worker.fetch(req('/status', { headers: { Origin: 'https://tcc-media-booking.pages.dev' } }), env, ctx);
  check('Origin ของเรา → ได้ Access-Control-Allow-Origin',
    ours.headers.get('Access-Control-Allow-Origin') === 'https://tcc-media-booking.pages.dev');

  const preview = await worker.fetch(req('/status', { headers: { Origin: 'https://abc123.tcc-media-booking.pages.dev' } }), env, ctx);
  check('preview ของ Pages ใช้ได้', preview.headers.get('Access-Control-Allow-Origin') !== null);

  const extraOrigin = { ...env, ALLOWED_ORIGINS: 'https://booking.tcc.ac.th' };
  const custom = await worker.fetch(req('/status', { headers: { Origin: 'https://booking.tcc.ac.th' } }), extraOrigin, ctx);
  check('เพิ่ม Origin ผ่าน ALLOWED_ORIGINS ได้โดยไม่ต้องแก้โค้ด',
    custom.headers.get('Access-Control-Allow-Origin') === 'https://booking.tcc.ac.th');
}

// ── การลบข้อมูลยกชุดต้องเป็นแอดมินเท่านั้น ──────────────────────────────────
{
  const env = baseEnv();
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, bookerName: 'ก' }));
  await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify(many) }), env, ctx);

  const wipe = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify([]) }), env, ctx);
  check('ลบยกชุดโดยไม่มีตั๋วแอดมิน → 403', wipe.status === 403);
  check('ข้อมูลยังอยู่ครบหลังถูกปฏิเสธ',
    (await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json')).length === 20);

  const wipeAsAdmin = await worker.fetch(
    await asAdmin(env, '/data?type=rooms', { method: 'POST', body: JSON.stringify([]) }), env, ctx);
  check('แอดมินลบยกชุดได้', wipeAsAdmin.status === 200);

  // ผู้ใช้ทั่วไปยัง "เพิ่ม/แก้" ได้ตามปกติ — ต้องไม่ไปขวางการใช้งานจริง
  const normal = await worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify([{ id: 'x1' }]) }), env, ctx);
  check('ผู้ใช้ทั่วไปเพิ่มรายการได้ตามปกติ', normal.status === 200);
}

// ── รูปร่างข้อมูลและลิงก์ไฟล์แนบ ─────────────────────────────────────────────
{
  const env = baseEnv();
  const post = (payload) => worker.fetch(authed('/data?type=rooms', { method: 'POST', body: JSON.stringify(payload) }), env, ctx);

  check('รายการที่ไม่มี id → 400', (await post([{ bookerName: 'ไม่มี id' }])).status === 400);
  check('รายการที่ไม่ใช่ object → 400', (await post(['ข้อความเปล่า'])).status === 400);
  check('เกินจำนวนรายการสูงสุด → 413',
    (await post(Array.from({ length: 5001 }, (_, i) => ({ id: `b${i}` })))).status === 413);

  // javascript: ในลิงก์ไฟล์แนบ = XSS ตอนเจ้าหน้าที่กดลิงก์ในรายการจอง
  await post([{ id: 'x', attachmentUrl: 'javascript:alert(document.cookie)' }]);
  const saved = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json');
  check('ลิงก์ javascript: ถูกล้างทิ้ง', saved[0].attachmentUrl === '', JSON.stringify(saved));

  await post([{ id: 'y', attachmentUrl: 'https://docs.google.com/d/1' }]);
  check('ลิงก์ https ปกติเก็บไว้เหมือนเดิม',
    (await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json'))[0].attachmentUrl === 'https://docs.google.com/d/1');

  await post([{ id: 'z', attachmentUrl: 'docs.google.com/d/2' }]);
  check('ลิงก์ที่ไม่ใส่ https:// ให้เติมให้เอง',
    (await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json'))[0].attachmentUrl.startsWith('https://'));
}

// ── /notify — จำกัดความยาวและความถี่ ────────────────────────────────────────
{
  const env = baseEnv();
  await env.ROOM_BOOKINGS_KV.put('recipient:Cg1', '1');
  lineCalls = []; lineResponder = () => new Response('{}', { status: 200 });

  const tooLong = await worker.fetch(
    authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ก'.repeat(30000) }) }), env, ctx);
  check('ข้อความยาวเกินที่ส่งได้จริง → 413', tooLong.status === 413);

  for (let i = 0; i < 20; i++) {
    await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ทดสอบ' }) }), env, ctx);
  }
  const throttled = await worker.fetch(authed('/notify', { method: 'POST', body: JSON.stringify({ message: 'ทดสอบ' }) }), env, ctx);
  check('ยิงแจ้งเตือนถี่เกินไป → 429', throttled.status === 429);

  const adminBypass = await worker.fetch(
    await asAdmin(env, '/notify', { method: 'POST', body: JSON.stringify({ message: 'แอดมินส่งซ้ำ' }) }), env, ctx);
  check('แอดมินส่งซ้ำได้ไม่ติดลิมิต', adminBypass.status === 200);
}

console.log(`\n──────────────\nผ่าน ${pass} / ล้มเหลว ${fail}`);
process.exit(fail === 0 ? 0 : 1);
