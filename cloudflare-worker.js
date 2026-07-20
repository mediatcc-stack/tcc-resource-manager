/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  TCC LINE NOTIFIER — Cloudflare Worker (Backend หลักของระบบทั้งหมด)
 *  วิทยาลัยพณิชยการธนบุรี — งานสื่อการเรียนการสอน
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  📁 SOURCE CODE (GitHub)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Repository  : https://github.com/[your-org]/tcc-resource-manager
 *  Branch หลัก  : main
 *  ไฟล์นี้      : cloudflare-worker.js  (deploy แยกต่างหากจาก frontend)
 *  Frontend    : /  (React + Vite — deploy บน Cloudflare Pages)
 *  Worker นี้   : /cloudflare-worker.js (deploy บน Cloudflare Workers)
 *
 *  วิธี commit และ push ไป GitHub:
 *    git add cloudflare-worker.js
 *    git commit -m "fix: อธิบายสิ่งที่แก้"
 *    git push origin main
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🗄️  ฐานข้อมูล — Cloudflare KV  (⚠️ ห้ามลบ KV namespace เด็ดขาด!)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ข้อมูลทั้งหมดเก็บใน Cloudflare KV Storage (ไม่ใช่ SQL — เป็น key-value)
 *  ไม่มีการ backup อัตโนมัติ ถ้าลบ namespace จะหายถาวร!
 *
 *  KV Namespace ที่ใช้งาน (ดูได้ที่ Cloudflare Dashboard → Workers KV):
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  Binding Name              → KV Namespace (ใน Dashboard)               │
 *  │  ROOM_BOOKINGS_KV          → TCC_ROOM_BOOKINGS                         │
 *  │  EQUIPMENT_BORROWINGS_KV   → TCC_EQUIPMENT_BORROWINGS                  │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 *  Key ที่เก็บข้อมูลจริงภายใน KV:
 *    "rooms_data"       → JSON array ของ Booking[] (การจองห้องทั้งหมด)
 *    "equipment_data"   → JSON array ของ BorrowingRequest[] (การยืมอุปกรณ์)
 *    "recipient_ids"    → JSON array ของ LINE User ID ที่รับแจ้งเตือน
 *
 *  วิธีดูข้อมูลใน KV:
 *    Cloudflare Dashboard → Workers & Pages → KV
 *    → คลิก TCC_ROOM_BOOKINGS → ค้นหา "rooms_data"
 *
 *  ⚠️  วิธี Backup ข้อมูลด้วยตัวเอง (ทำเป็นประจำ):
 *    เปิด URL: https://tcc-line-notifier.media-tcc.workers.dev/data?type=rooms
 *    ใส่ Header: X-API-Key: [API_SECRET_KEY ใน Settings]
 *    Copy JSON ที่ได้ไปเก็บไว้ใน Google Drive หรือ Sheets
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔔  ระบบแจ้งเตือน LINE  (LINE Messaging API)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ภาพรวมการทำงาน:
 *
 *    [ผู้ใช้จองห้อง]
 *         │
 *         ▼
 *    [Frontend React]  ──POST /notify──▶  [Worker นี้]
 *         │                                     │
 *         │                                     ▼
 *         │                          [LINE Messaging API]
 *         │                         POST /v2/bot/message/push
 *         │                                     │
 *         │                                     ▼
 *         │                          [LINE ของเจ้าหน้าที่]
 *         ▼                          (ทุก User ID ใน recipient_ids)
 *    [แสดง Toast สำเร็จ]
 *
 *  วิธีเพิ่ม LINE Admin คนใหม่ให้รับแจ้งเตือน:
 *    1. เพิ่มเพื่อน LINE Official Account ของระบบ
 *    2. Bot จะรับ Webhook event "follow" อัตโนมัติ
 *    3. Worker จะบันทึก userId ลงใน KV key "recipient_ids" ให้เอง
 *    หรือเพิ่มด้วยตัวเองได้ที่ KV → "recipient_ids" → แก้ไข JSON array
 *
 *  LINE Console (ดูและแก้ไข Channel):
 *    https://developers.line.biz/console/
 *    Channel ที่ใช้: ดูชื่อ Channel จาก CHANNEL_ACCESS_TOKEN ใน Settings
 *
 *  แจ้งเตือนอัตโนมัติทุกเช้า (Scheduled):
 *    Worker มี scheduled() handler ที่ส่งสรุปการจองวันนี้ทุกวัน
 *    ตั้งเวลาได้ที่: Cloudflare Dashboard → Worker → Settings → Triggers → Cron
 *    แนะนำ: "0 1 * * *"  (ตี 1 UTC = 8:00 น. ไทย)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔐  Environment Variables (ตั้งค่าใน Cloudflare Dashboard → Settings)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  ห้าม hardcode ค่าเหล่านี้ในโค้ด — ต้องตั้งผ่าน Dashboard เท่านั้น
 *  ⚠️  ถ้า CHANNEL_ACCESS_TOKEN หมดอายุ ให้ออก Token ใหม่จาก LINE Console
 *
 *  ┌──────────────────────────┬────────────────────────────────────────────────┐
 *  │  ชื่อตัวแปร              │  ใช้ทำอะไร                                    │
 *  ├──────────────────────────┼────────────────────────────────────────────────┤
 *  │  ADMIN_PASSWORD          │  รหัสผ่านสำหรับโหมดเจ้าหน้าที่              │
 *  │  API_SECRET_KEY          │  Key สำหรับ Frontend เรียก Worker (/data)     │
 *  │                          │  ต้องตรงกับ VITE_API_SECRET_KEY ใน Pages     │
 *  │  CHANNEL_ACCESS_TOKEN    │  LINE Bot Long-lived Token (ส่ง Push message) │
 *  │  CHANNEL_SECRET          │  LINE Channel Secret (verify Webhook)         │
 *  │  RECIPIENT_ID            │  LINE User ID สำรอง (ถ้า KV ว่าง)            │
 *  └──────────────────────────┴────────────────────────────────────────────────┘
 *
 *  ถ้าต้องการเปลี่ยนรหัสผ่าน Admin:
 *    Dashboard → Settings → Edit → ADMIN_PASSWORD → บันทึก → Deploy ใหม่
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🚀  การ Deploy Worker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  วิธีที่ 1 — ผ่าน Cloudflare Dashboard (ง่ายที่สุด):
 *    Dashboard → tcc-line-notifier → Edit code → วาง code → Deploy
 *
 *  วิธีที่ 2 — ผ่าน Wrangler CLI (สำหรับ developer):
 *    npm install -g wrangler
 *    wrangler login
 *    wrangler deploy cloudflare-worker.js --name tcc-line-notifier
 *
 *  ⚠️  หลัง deploy ต้องทดสอบทันที:
 *    GET https://tcc-line-notifier.media-tcc.workers.dev/status
 *    ต้องได้ { lineApiToken: true, roomKvBinding: true, ... }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  📡  API Endpoints ทั้งหมด
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  PUBLIC (ไม่ต้องใช้ API Key):
 *    GET  /status          → ตรวจสอบว่า Worker พร้อมทำงานหรือไม่
 *    POST /auth/login      → Body: { password } → ตรวจสอบรหัส Admin
 *    POST /webhook         → รับ event จาก LINE (เพิ่ม recipient_ids อัตโนมัติ)
 *
 *  PROTECTED (ต้องใส่ Header: X-API-Key):
 *    GET  /data?type=rooms      → ดึงข้อมูลการจองห้องทั้งหมด
 *    POST /data?type=rooms      → บันทึกข้อมูลการจองห้องทั้งหมด (overwrite)
 *    GET  /data?type=equipment  → ดึงข้อมูลการยืมอุปกรณ์ทั้งหมด
 *    POST /data?type=equipment  → บันทึกข้อมูลการยืมอุปกรณ์ทั้งหมด (overwrite)
 *    POST /notify               → Body: { message } → ส่ง LINE แจ้งเตือน
 *    GET  /recipients           → ดูรายชื่อ LINE User ID ที่รับแจ้งเตือน
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🛠️  แก้ไขล่าสุด
 * ═══════════════════════════════════════════════════════════════════════════════
 *  v2.1 (2026-07-20) — ปรับ parseDate() ใน @mention handler ให้รองรับ
 *                       รูปแบบวันที่แบบชื่อเดือนไทย (เต็ม/ย่อ มีจุด/ไม่มีจุด)
 *                       และปีทั้ง พ.ศ. 2 หลัก / พ.ศ. 4 หลัก / ค.ศ. 4 หลัก
 *  v2.0 (2026-05-20) — แยก public/protected routes ชัดเจน,
 *                       แก้ bug checkKvBinding เรียกซ้ำ,
 *                       เพิ่ม /webhook สำหรับเพิ่ม recipient อัตโนมัติ,
 *                       เพิ่ม scheduled() สรุปการจองประจำวัน
 *  v1.0 (2025-??-??)  — เวอร์ชันแรก
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
//  CORS Headers — อนุญาตให้ Frontend (Cloudflare Pages) เรียก API ได้
//  ถ้าต้องการจำกัดให้เรียกได้แค่จาก domain ของเราเท่านั้น ให้เปลี่ยน '*'
//  เป็น 'https://tcc-media-booking.pages.dev'
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key',
};

// ─────────────────────────────────────────────────────────────────────────────
//  sendNotification(message, env)
//  ส่งข้อความ Push ไปหา LINE ของเจ้าหน้าที่ทุกคนใน recipient_ids
//  ถ้า recipient_ids ใน KV ว่าง จะใช้ RECIPIENT_ID จาก env เป็น fallback
// ─────────────────────────────────────────────────────────────────────────────
async function sendNotification(message, env) {
  let recipientIds = [];
  try {
    recipientIds = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
  } catch (e) {
    recipientIds = [];
  }

  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    if (env.RECIPIENT_ID) {
      recipientIds = [env.RECIPIENT_ID];
    } else {
      console.error("[LINE Push Error] No recipients found.");
      return;
    }
  }

  const pushPromises = recipientIds.map(recipientId =>
    fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: recipientId, messages: [{ type: 'text', text: message }] }),
    })
    .then(async response => {
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LINE Push Error] Failed to ID: ${recipientId}, Status: ${response.status}, Body: ${errorBody}`);
      }
    })
    .catch(error => {
      console.error(`[LINE Push Error] ID: ${recipientId}, Error: ${error.message}`);
    })
  );

  await Promise.all(pushPromises);
}

// ─────────────────────────────────────────────────────────────────────────────
//  checkKvBinding(kv, name)
//  ตรวจสอบว่า KV Namespace ถูก bind กับ Worker หรือยัง
//  คืนค่า Response ข้อผิดพลาดถ้าไม่พบ, คืน null ถ้าพร้อมใช้งาน
// ─────────────────────────────────────────────────────────────────────────────
const checkKvBinding = (kv, name) => {
  if (!kv) {
    const errorMsg = `KV Namespace binding "${name}" not found.`;
    console.error(`[KV Binding Error] ${errorMsg}`);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
};

export default {
  // ───────────────────────────────────────────────────────────────────────────
  //  fetch(request, env, ctx)
  //  Handler หลักที่รับทุก HTTP Request
  // ───────────────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {

    // Preflight CORS request — browser ส่งมาก่อน cross-origin request จริง
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── PUBLIC ROUTES (ไม่ต้องการ API Key) ──────────────────────────────────

    // ตรวจสอบสถานะ Worker — Frontend เรียกตอนโหลดหน้าแรก
    if (path === '/status') {
      const status = {
        lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
        roomKvBinding: !!env.ROOM_BOOKINGS_KV,
        equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
        recipientIdSet: !!env.RECIPIENT_ID,
      };
      return new Response(JSON.stringify(status), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ล็อกอิน Admin — ตรวจสอบรหัสผ่านกับ ADMIN_PASSWORD ใน env
    if (path === '/auth/login' && request.method === 'POST') {
      try {
        const { password } = await request.json();
        if (password && password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ success: false }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Webhook จาก LINE — เพิ่ม userId ลง recipient_ids อัตโนมัติเมื่อมีคน Follow Bot
    // LINE เรียก endpoint นี้เอง ไม่ต้องมี API Key
    // ต้องตั้งค่า Webhook URL ที่ LINE Console:
    //   https://tcc-line-notifier.media-tcc.workers.dev/webhook
    if (path === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        const events = body.events || [];
        for (const event of events) {

          // Helper — เพิ่ม id เข้า recipient_ids ถ้ายังไม่มี
          const saveId = async (id) => {
            if (!id) return;
            let ids = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
            if (!Array.isArray(ids)) ids = [];
            if (!ids.includes(id)) {
              ids.push(id);
              await env.ROOM_BOOKINGS_KV.put('recipient_ids', JSON.stringify(ids));
              console.log(`[Webhook] Saved new recipient: ${id} (type: ${event.type})`);
            }
          };

          if (event.type === 'follow') {
            // คนแอดเพื่อน Bot → เก็บ userId
            await saveId(event.source.userId);
          }

          if (event.type === 'join') {
            // Bot ถูกเชิญเข้ากลุ่ม → เก็บ groupId
            await saveId(event.source.groupId);
          }

          if (event.type === 'leave') {
            // Bot ถูกเตะออกจากกลุ่ม → ลบ groupId ออกจาก KV อัตโนมัติ
            const removeId = event.source.groupId;
            if (removeId) {
              let ids = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
              ids = ids.filter(id => id !== removeId);
              await env.ROOM_BOOKINGS_KV.put('recipient_ids', JSON.stringify(ids));
              console.log(`[Webhook] Removed recipient: ${removeId} (bot left group)`);
            }
          }

          if (event.type === 'unfollow') {
            // คน unfollow Bot → ลบ userId ออกจาก KV อัตโนมัติ
            const removeId = event.source.userId;
            if (removeId) {
              let ids = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
              ids = ids.filter(id => id !== removeId);
              await env.ROOM_BOOKINGS_KV.put('recipient_ids', JSON.stringify(ids));
              console.log(`[Webhook] Removed recipient: ${removeId} (user unfollowed)`);
            }
          }

          // ── @Mention Handler ──────────────────────────────────────────────
          // ทริกเกอร์เฉพาะเมื่อมีคน @Bot ในกลุ่มเท่านั้น
          // ใช้ Reply Token → ไม่กิน Push quota เลย
          if (event.type === 'message' && event.message?.type === 'text') {
            const isBotMentioned = event.message.mention?.mentionees?.some(m => m.isSelf === true);

            if (isBotMentioned) {
              const text = event.message.text.toLowerCase();

              // คำสั่ง: @Bot รายงาน / จอง / จองพรุ่งนี้ / จอง 16-6-69 / จอง 20 ก.ค. 69
              if (text.includes('รายงาน') || text.includes('จอง')) {

                // ── แปลงวันที่จากข้อความ ──────────────────────────────────
                const nowTH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

                // แผนที่ชื่อเดือนไทย (เต็ม / ย่อมีจุด / ย่อไม่มีจุด) → เลขเดือน
                const thaiMonthMap = {
                  'มกราคม': 1, 'ม.ค.': 1, 'มค': 1,
                  'กุมภาพันธ์': 2, 'ก.พ.': 2, 'กพ': 2,
                  'มีนาคม': 3, 'มี.ค.': 3, 'มีค': 3,
                  'เมษายน': 4, 'เม.ย.': 4, 'เมย': 4,
                  'พฤษภาคม': 5, 'พ.ค.': 5, 'พค': 5,
                  'มิถุนายน': 6, 'มิ.ย.': 6, 'มิย': 6,
                  'กรกฎาคม': 7, 'ก.ค.': 7, 'กค': 7,
                  'สิงหาคม': 8, 'ส.ค.': 8, 'สค': 8,
                  'กันยายน': 9, 'ก.ย.': 9, 'กย': 9,
                  'ตุลาคม': 10, 'ต.ค.': 10, 'ตค': 10,
                  'พฤศจิกายน': 11, 'พ.ย.': 11, 'พย': 11,
                  'ธันวาคม': 12, 'ธ.ค.': 12, 'ธค': 12,
                };
                // เรียงชื่อเดือนจากยาว→สั้น กันแมตช์ผิด (เช่น "กค" ไปกินก่อน "กรกฎาคม")
                // แล้วประกอบเป็น regex เดียว: ตัวเลขวัน + ชื่อเดือน + ปี (ไม่บังคับ)
                const monthPattern = Object.keys(thaiMonthMap)
                  .sort((a, b) => b.length - a.length)
                  .map(k => k.replace(/\./g, '\\.'))
                  .join('|');
                const thaiMonthRegex = new RegExp(`(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{2,4})?`);

                // แปลงปี: ไม่ระบุ → ปีปัจจุบัน, 2 หลัก (69) → พ.ศ., 4 หลัก พ.ศ./ค.ศ. → ค.ศ. เสมอ
                const normalizeYear = (yy, fallbackYearCE) => {
                  if (!yy) return fallbackYearCE;
                  if (yy.length === 2) return 2500 + parseInt(yy) - 543; // 69 → 2569(พ.ศ.) → 2026(ค.ศ.)
                  const y = parseInt(yy);
                  return y > 2500 ? y - 543 : y;                        // 2569 → 2026, 2025 → 2025
                };

                const parseDate = (t) => {
                  if (t.includes('วันนี้')) {
                    return nowTH;
                  }
                  if (t.includes('พรุ่งนี้') || t.includes('พรุ่ง')) {
                    const d = new Date(nowTH); d.setDate(d.getDate() + 1); return d;
                  }
                  if (t.includes('มะรืน') || t.includes('มะเรืน')) {
                    const d = new Date(nowTH); d.setDate(d.getDate() + 2); return d;
                  }

                  // รูปแบบชื่อเดือนไทย เช่น "20 ก.ค. 69", "20 กรกฎาคม 2569", "20กค2025"
                  const thaiMatch = t.match(thaiMonthRegex);
                  if (thaiMatch) {
                    const [, dd, monthText, yy] = thaiMatch;
                    const mm = thaiMonthMap[monthText];
                    const yearCE = normalizeYear(yy, nowTH.getFullYear());
                    return new Date(yearCE, mm - 1, parseInt(dd));
                  }

                  // รูปแบบตัวเลข: DD-M-YY, DD-MM-YY, DD/M/YYYY, DD.M.YY ฯลฯ
                  const match = t.match(/(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
                  if (match) {
                    const [, dd, mm, yy] = match;
                    const yearCE = normalizeYear(yy, nowTH.getFullYear());
                    return new Date(yearCE, parseInt(mm) - 1, parseInt(dd));
                  }

                  return nowTH; // default = วันนี้
                };

                const targetDate = parseDate(text);
                const targetISO = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
                const targetDisplay = targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

                // label วันสำหรับหัวข้อ
                const todayISO0 = `${nowTH.getFullYear()}-${String(nowTH.getMonth() + 1).padStart(2, '0')}-${String(nowTH.getDate()).padStart(2, '0')}`;
                const tom = new Date(nowTH); tom.setDate(nowTH.getDate() + 1);
                const tomISO = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;
                const dayAfter = new Date(nowTH); dayAfter.setDate(nowTH.getDate() + 2);
                const dayAfterISO = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;

                let dayLabel = targetDisplay;
                if (targetISO === todayISO0) dayLabel += ' (วันนี้)';
                else if (targetISO === tomISO) dayLabel += ' (พรุ่งนี้)';
                else if (targetISO === dayAfterISO) dayLabel += ' (มะรืนนี้)';

                // ── ดึงข้อมูลจอง ──────────────────────────────────────────
                const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                const dayBookings = bookings
                  .filter(b => b.date === targetISO && b.status === 'จองแล้ว')
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                const arrangementLabel = (a) => {
                  if (!a) return null;
                  if (a === 'classroom') return 'จัดโต๊ะรูปแบบคลาสรูม';
                  if (a === 'u-shape') return 'จัดโต๊ะรูปแบบตัวยู U';
                  if (a.startsWith('other:')) return `จัดโต๊ะ: ${a.slice(6)}`;
                  return null;
                };

                let replyText;
                if (dayBookings.length === 0) {
                  replyText = `📅 รายการจอง ${dayLabel}\n──────────────\nไม่มีการจองครับ`;
                } else {
                  replyText = `📅 รายการจอง ${dayLabel} (${dayBookings.length} รายการ)\n`;
                  dayBookings.forEach((b, i) => {
                    const arr = arrangementLabel(b.roomArrangement);
                    replyText += `\n${b.date} | ${b.startTime}–${b.endTime} น.\n`;
                    replyText += `🏢 ${b.roomName}\n`;
                    replyText += `📝 ${b.purpose}\n`;
                    replyText += `👤 ${b.bookerName}\n`;
                    if (arr) replyText += `🪑 ${arr}\n`;
                    if (i < dayBookings.length - 1) replyText += '\n━━━━━━\n';
                  });
                }

                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: replyText }],
                  }),
                });

                console.log(`[Mention] Replied with ${dayBookings.length} bookings for ${targetISO}`);
              }
            }
          }
          // ── End Mention Handler ───────────────────────────────────────────
        }
      } catch (e) {
        console.error(`[Webhook Error] ${e.message}`);
      }
      return new Response('OK', { status: 200 });
    }

    // ── PROTECTED ROUTES (ต้องใช้ X-API-Key Header) ─────────────────────────

    // ตรวจสอบ API Key ทุก request จากนี้เป็นต้นไป
    // Key ต้องตรงกับ API_SECRET_KEY ใน Worker Settings
    // และ VITE_API_SECRET_KEY ใน Cloudflare Pages Settings
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {

      // ── /data — อ่าน/เขียนข้อมูล KV ─────────────────────────────────────
      // GET  ?type=rooms      → ดึงข้อมูลการจองห้องทั้งหมด
      // POST ?type=rooms      → บันทึก (overwrite ทั้งหมด ระวัง!)
      // GET  ?type=equipment  → ดึงข้อมูลการยืมอุปกรณ์
      // POST ?type=equipment  → บันทึกการยืมอุปกรณ์
      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV_NAME = type === 'rooms' ? 'ROOM_BOOKINGS_KV' : 'EQUIPMENT_BORROWINGS_KV';
        const KV = env[KV_NAME];
        const kvError = checkKvBinding(KV, KV_NAME); // เก็บ error ไว้ตัวแปรก่อน (ไม่เรียกซ้ำ)
        if (kvError) return kvError;

        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (request.method === 'POST') {
          await KV.put(`${type}_data`, JSON.stringify(await request.json()));
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ── /notify — ส่ง LINE Push Message ──────────────────────────────────
      // Frontend ส่ง { message: "ข้อความ" } มา แล้ว Worker ส่งต่อให้ LINE
      // ใช้ ctx.waitUntil เพื่อไม่ให้ response รอ LINE ตอบกลับ (non-blocking)
      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        ctx.waitUntil(sendNotification(message, env));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ── /recipients — ดูรายชื่อ LINE User ID ที่รับแจ้งเตือน ────────────
      if (path === '/recipients' && request.method === 'GET') {
        const recipientIds = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
        return new Response(JSON.stringify(recipientIds), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return new Response(JSON.stringify({ error: 'Worker internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // ───────────────────────────────────────────────────────────────────────────
  //  scheduled(event, env, ctx)
  //  รันตามเวลาที่กำหนด (Cron Trigger)
  //  ตั้งค่า Cron: Dashboard → tcc-line-notifier → Settings → Triggers → Cron
  //  แนะนำ: "0 1 * * *"  (ทุกวัน เวลา 01:00 UTC = 08:00 น. ไทย)
  //  ทำหน้าที่: ส่งสรุปการจองห้องวันนี้ไปยัง LINE
  // ───────────────────────────────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
    const todayBookings = bookings
      .filter(b => b.date === today && b.status === 'จองแล้ว')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length > 0) {
      let reportMsg = `📊 สรุปการจองห้องประชุม (วันนี้)\n---------------------\n`;
      todayBookings.forEach(b => {
        reportMsg += `📅 ${b.roomName} (${b.startTime}-${b.endTime})\n   - ${b.purpose} (โดย ${b.bookerName})\n\n`;
      });
      reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ`;
      await sendNotification(reportMsg, env);
    }
  }
};
