// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

// ฟังก์ชันช่วยจัดรูปแบบวันที่ไทย (YYYY-MM-DD -> 21 มกราคม 2569)
const formatThaiDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  const months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return `${parseInt(d)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
};

// ฟังก์ชันสร้างข้อความวันที่แบบเต็ม (D-M-YYYY พ.ศ.) สำหรับตัวอย่างและปุ่ม
const getFullThaiDateStr = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear() + 543;
  return `${d}-${m}-${y}`;
};

// ฟังก์ชันดึงวันที่เป้าหมาย (โหมด ยืดหยุ่นรองรับการค้นหาในประโยค)
const parseTargetDate = (rawText) => {
  // ลบ Mention ออกก่อนประมวลผล
  const text = rawText.replace(/@[\w\s.-]+/, '').trim();
  const bkkTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  
  // 1. ค้นหารูปแบบวันที่เต็มในข้อความ (เช่น 21-1-2569)
  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (fullDateMatch) {
    let [_, d, m, y] = fullDateMatch;
    let year = parseInt(y);
    if (year > 2500) year -= 543; // แปลง พ.ศ. เป็น ค.ศ.
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 2. ถ้ามีคำว่า "รายงานวันนี้"
  if (text.includes('รายงานวันนี้')) {
    return bkkTime.toISOString().split('T')[0];
  }

  return null;
};

const sendLineReply = async (env, replyToken, messages) => {
  if (!env.CHANNEL_ACCESS_TOKEN) return;
  const msgs = Array.isArray(messages) ? messages : [
    typeof messages === 'string' ? { type: 'text', text: messages } : messages
  ];
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: msgs }),
  });
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text') {
            const rawText = event.message.text;
            const botMention = event.message.mention?.mentionees?.find(m => m.isSelf);
            const isMentioned = botMention || event.source.type === 'user';

            if (isMentioned) {
              const targetDate = parseTargetDate(rawText);

              if (targetDate) {
                // ส่วนประมวลผลรายงาน
                const data = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                const bookings = data.filter(b => b.date === targetDate && b.status === 'จองแล้ว');
                const displayDate = formatThaiDate(targetDate);
                
                let msg = `📅 รายงานจองห้องประชุม\n📌 วันที่: ${displayDate}\n\n`;
                if (bookings.length > 0) {
                  bookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).forEach((b, i) => {
                    msg += `${i+1}. ⏰ ${b.startTime}-${b.endTime}\n🏢 ${b.roomName}\n📝 ${b.purpose}\n👤 ${b.bookerName}\n\n`;
                  });
                  msg += `✨ รวมทั้งหมด ${bookings.length} รายการ`;
                } else {
                  msg += "✅ ไม่มีรายการจองครับ ว่างทุกห้อง!";
                }
                await sendLineReply(env, event.replyToken, msg);
              } else {
                // --- Help Menu & Quick Replies (3 ปุ่มตามคำขอ) ---
                const bkkNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const tomorrow = new Date(bkkNow); tomorrow.setDate(bkkNow.getDate() + 1);
                const tomorrowStr = getFullThaiDateStr(tomorrow);

                const helpResponse = {
                  type: 'text',
                  text: `🤖 สวัสดีครับ! ต้องการดูรายงานการจองห้องใช่ไหมครับ?\n\n💡 แนะนำ:\n📍 ดูวันอื่นให้พิมพ์ "วัน-เดือน-ปี" (พ.ศ.)\n📝 เช่น: ขอรายงาน ${tomorrowStr}\n\n👇 หรือเลือกเมนูด้านล่างนี้ครับ:`,
                  quickReply: {
                    items: [
                      {
                        type: 'action',
                        action: { type: 'message', label: '📊 รายงานวันนี้', text: 'รายงานวันนี้' }
                      },
                      {
                        type: 'action',
                        action: { type: 'message', label: `🗓️ ดูของพรุ่งนี้`, text: `ขอรายงาน ${tomorrowStr}` }
                      },
                      {
                        type: 'action',
                        action: { type: 'uri', label: '🌐 เข้าสู่เว็บจอง', uri: 'https://tcc-resource-manager.pages.dev' }
                      }
                    ]
                  }
                };
                await sendLineReply(env, event.replyToken, helpResponse);
              }
            }
          }
        }
        return new Response('OK');
      }

      // API Routes
      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV = type === 'rooms' ? env.ROOM_BOOKINGS_KV : env.EQUIPMENT_BORROWINGS_KV;
        if (!KV) return new Response(JSON.stringify({ error: 'KV Binding missing' }), { status: 500, headers: corsHeaders });
        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
          await KV.put(`${type}_data`, JSON.stringify(await request.json()));
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        const targets = Object.keys(env).filter(k => k === 'GROUP_ID' || k.startsWith('GROUP_ID_')).map(k => env[k]);
        await Promise.all(targets.map(id => 
          fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify({ to: id, messages: [{ type: 'text', text: message }] }),
          })
        ));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response('TCC API is online', { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};