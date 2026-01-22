
// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

// ฟังก์ชันช่วยจัดรูปแบบวันที่ไทย (YYYY-MM-DD -> 21 มกราคม 2568)
const formatThaiDate = (dateStr) => {
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `${parseInt(d)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
  } catch (e) {
    return dateStr;
  }
};

// ฟังก์ชันดึงวันที่เป้าหมาย และตรวจสอบความตั้งใจในการเรียกรายงาน
const parseTargetDate = (rawText) => {
  // ลบ Mention ออกจากข้อความเพื่อเช็คคีย์เวิร์ด
  const text = rawText.replace(/@[\w\s.-]+/, '').trim().toLowerCase();
  const bkkTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  
  // คีย์เวิร์ดรายงาน
  const reportKeywords = ['รายงาน', 'สรุป', 'เช็คห้อง', 'ดูการจอง', 'list', 'ว่างไหม'];
  const hasKeyword = reportKeywords.some(k => text.includes(k));

  // รูปแบบวันที่ 22/01/2025
  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (fullDateMatch) {
    let [_, d, m, y] = fullDateMatch;
    let year = parseInt(y);
    if (year > 2500) year -= 543;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // ถ้าพิมพ์ "วันนี้" หรือมีคีย์เวิร์ดรายงาน
  if (text.includes('วันนี้') || text === 'รายงาน' || hasKeyword) {
    return bkkTime.toISOString().split('T')[0];
  }

  // ถ้าพิมพ์ "พรุ่งนี้"
  if (text.includes('พรุ่งนี้')) {
    const tomorrow = new Date(bkkTime);
    tomorrow.setDate(bkkTime.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  return null;
};

const sendLineReply = async (env, replyToken, messages) => {
  if (!env.CHANNEL_ACCESS_TOKEN) return;
  const msgs = Array.isArray(messages) ? messages : [messages];
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
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
            
            // --- STRICT MENTION CHECK ---
            // ตรวจสอบว่าบอทถูกแท็กจริงหรือไม่
            const mentionees = event.message.mention?.mentionees || [];
            const isBotMentioned = mentionees.some(m => m.isSelf === true);
            const isDirectChat = event.source.type === 'user';

            // ถ้าอยู่ในกลุ่มแล้วไม่ถูกแท็ก -> ข้ามทันที (IMPORTANT!)
            if (!isBotMentioned && !isDirectChat) {
              continue; 
            }

            // ถ้าถูกแท็ก หรือคุยส่วนตัว ให้เริ่มวิเคราะห์คำสั่ง
            const targetDate = parseTargetDate(rawText);
            
            if (targetDate) {
              const data = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
              const bookings = data.filter(b => b.date === targetDate && b.status === 'จองแล้ว');
              const displayDate = formatThaiDate(targetDate);
              const isToday = targetDate === new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"})).toISOString().split('T')[0];
              
              // ปรับแต่งรายงานให้เหมือนในรูปตัวอย่าง
              let msg = `📊 รายงานการใช้ห้อง (${isToday ? 'วันนี้' : displayDate})\n`;
              msg += `--------------------------\n`;
              
              if (bookings.length > 0) {
                bookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).forEach((b, i) => {
                  msg += `${i+1}. 🕒 ${b.startTime}-${b.endTime}\n`;
                  msg += `📍 ${b.roomName}\n`;
                  msg += `📝 ${b.purpose}\n`;
                  msg += `👤 ${b.bookerName}\n`;
                  msg += `💻 รูปแบบ: ${b.meetingType || 'Onsite'}\n\n`;
                });
                msg += `✨ รวมทั้งหมด ${bookings.length} รายการ`;
              } else {
                msg += "✅ วันนี้ไม่มีรายการจองครับ ว่างทุกห้อง!";
              }
              
              await sendLineReply(env, event.replyToken, { type: 'text', text: msg.trim() });
            } else if (isBotMentioned) {
              // ถ้าแท็กเฉยๆ แต่ไม่มีคำสั่งที่เข้าใจ ให้ส่งเมนูช่วยเหลือ
              await sendLineReply(env, event.replyToken, { 
                type: 'text', 
                text: "สวัสดีครับ! แท็กผมแล้วพิมพ์ 'รายงาน' หรือ 'รายงานวันนี้' เพื่อดูสรุปการจองห้องได้เลยครับ 🏢" 
              });
            }
          }
        }
        return new Response('OK');
      }

      // ส่วนจัดการข้อมูล API อื่นๆ
      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV = type === 'rooms' ? env.ROOM_BOOKINGS_KV : env.EQUIPMENT_BORROWINGS_KV;
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
        const allTargetIds = Object.keys(env)
          .filter(k => k === 'GROUP_ID' || k.startsWith('GROUP_ID_'))
          .map(k => env[k])
          .filter(id => id);

        const uniqueTargets = [...new Set(allTargetIds)];

        await Promise.all(uniqueTargets.map(id => 
          fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify({ to: id, messages: [{ type: 'text', text: message }] }),
          })
        ));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response('TCC API Online', { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
