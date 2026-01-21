// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

// ฟังก์ชันช่วยจัดการวันที่แบบยืดหยุ่น
const parseTargetDate = (text) => {
  const bkk = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  const today = new Date(bkk.getFullYear(), bkk.getMonth(), bkk.getDate());
  
  // 1. ตรวจสอบ Keyword พิเศษ
  if (text.includes('พรุ่งนี้')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (text.includes('เมื่อวาน')) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  // 2. ค้นหารูปแบบ วว/ดด/ปปปป หรือ วว-ดด-ปปปป (พ.ศ. หรือ ค.ศ.)
  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (fullDateMatch) {
    let [_, d, m, y] = fullDateMatch;
    let year = parseInt(y);
    if (year > 2500) year -= 543; // แปลง พ.ศ. -> ค.ศ.
    if (year < 100) year += 2000; // กรณีพิมพ์แค่ 68 -> 2025
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 3. ค้นหาตัวเลขวันที่ในประโยค (เช่น "วันที่ 22", "รายงาน 22", "จองห้องวันที่ 22")
  // ค้นหาตัวเลข 1-2 หลักที่อยู่หลังคำสำคัญ หรือถ้ามีคำว่ารายงาน ให้หาเลขตัวแรกที่เจอ
  const dateMatch = text.match(/(?:วันที่|วัน|ของวัน|รายงาน|เลข)\s*(\d{1,2})/) || text.match(/(\d{1,2})/);
  
  if (dateMatch && (text.includes('รายงาน') || text.includes('วันที่') || text.includes('จอง'))) {
    const d = dateMatch[1].padStart(2, '0');
    const m = (bkk.getMonth() + 1).toString().padStart(2, '0');
    const y = bkk.getFullYear();
    
    // ตรวจสอบเบื้องต้นว่าถ้าเลขวันที่น้อยกว่าวันนี้ อาจหมายถึงเดือนหน้า (Option เสริม)
    // ในที่นี้เรายึดเดือนปัจจุบันเป็นหลักก่อน
    return `${y}-${m}-${d}`;
  }

  return bkk.toISOString().split('T')[0];
};

const sendLineReply = async (env, replyToken, messages) => {
  if (!env.CHANNEL_ACCESS_TOKEN) return;
  const msgs = Array.isArray(messages) ? messages : [{ type: 'text', text: messages }];
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
            const text = event.message.text.trim();
            const isMentioned = event.message.mention?.mentionees?.some(m => m.isSelf) || event.source.type === 'user';

            if (isMentioned && (text.includes('รายงาน') || text.includes('จอง') || text.match(/\d{1,2}/))) {
              const targetDate = parseTargetDate(text);
              const data = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
              
              // กรองรายการจองตามวันที่
              const bookings = data.filter(b => b.date === targetDate && b.status === 'จองแล้ว');
              
              const dateObj = new Date(targetDate);
              const displayDate = dateObj.toLocaleDateString('th-TH', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              });

              let msg = `🔎 ตรวจสอบรายการจอง\n📅 ประจำวันที่: ${displayDate}\n`;
              if (targetDate === new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"})).toISOString().split('T')[0]) {
                msg += `(วันนี้)\n`;
              }
              msg += `\n`;
              
              if (bookings.length > 0) {
                bookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).forEach((b, i) => {
                  msg += `${i+1}. ⏰ ${b.startTime}-${b.endTime}\n🏢 ${b.roomName}\n📝 ${b.purpose}\n👤 ผู้จอง: ${b.bookerName}\n\n`;
                });
                msg += `✨ รวมทั้งหมด ${bookings.length} รายการ`;
              } else {
                msg += "✅ ไม่พบรายการจองครับ ว่างทุกห้อง!";
              }
              
              await sendLineReply(env, event.replyToken, msg);
            } else if (isMentioned) {
              await sendLineReply(env, event.replyToken, "สวัสดีครับ! ผมบอท TCC Notify 🚀\n\n🔹 พิมพ์ 'รายงาน' (ดูวันนี้)\n🔹 พิมพ์ 'รายงาน พรุ่งนี้'\n🔹 พิมพ์ 'ขอรายงานวันที่ 22'\n🔹 หรือ 'รายงาน 22/1/68' ครับ");
            }
          }
        }
        return new Response('OK');
      }

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