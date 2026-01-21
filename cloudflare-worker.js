// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

// ฟังก์ชันช่วยจัดรูปแบบวันที่ไทย (เพื่อความแม่นยำใน Cloudflare)
const formatThaiDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  const months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return `${parseInt(d)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
};

// ฟังก์ชันดึงวันที่เป้าหมาย
const parseTargetDate = (rawText) => {
  // 1. ทำความสะอาดข้อความ (ลบ Mention และช่องว่างส่วนเกิน)
  const text = rawText.replace(/@[\w\s.-]+/, '').trim();
  const bkkTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  const today = new Date(bkkTime.getFullYear(), bkkTime.getMonth(), bkkTime.getDate());
  
  // 2. เช็ค Keyword พิเศษ
  if (text.includes('พรุ่งนี้')) {
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }
  if (text.includes('มะรืน')) {
    today.setDate(today.getDate() + 2);
    return today.toISOString().split('T')[0];
  }
  if (text.includes('เมื่อวาน')) {
    today.setDate(today.getDate() - 1);
    return today.toISOString().split('T')[0];
  }

  // 3. ค้นหา Full Date (วว/ดด/ปปปป)
  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (fullDateMatch) {
    let [_, d, m, y] = fullDateMatch;
    let year = parseInt(y);
    if (year > 2500) year -= 543;
    if (year < 100) year += 2000;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 4. ค้นหาตัวเลขโดดๆ (เช่น "วันที่ 22" หรือ "รายงาน 22")
  // ค้นหาตัวเลข 1 หรือ 2 หลักที่อยู่ในประโยค
  const numbers = text.match(/\d{1,2}/g);
  if (numbers && numbers.length > 0) {
    // เลือกตัวเลขตัวแรกที่เจอ (โดยปกติคือวันที่)
    const day = parseInt(numbers[0]);
    if (day >= 1 && day <= 31) {
      const year = bkkTime.getFullYear();
      const month = (bkkTime.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}-${day.toString().padStart(2, '0')}`;
    }
  }

  // ถ้าไม่เจออะไรเลย ให้ยึด "วันนี้"
  return bkkTime.toISOString().split('T')[0];
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
            const rawText = event.message.text;
            const isMentioned = event.message.mention?.mentionees?.some(m => m.isSelf) || event.source.type === 'user';

            if (isMentioned && (rawText.includes('รายงาน') || rawText.includes('จอง') || rawText.match(/\d+/))) {
              const targetDate = parseTargetDate(rawText);
              const data = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
              const bookings = data.filter(b => b.date === targetDate && b.status === 'จองแล้ว');
              
              const displayDate = formatThaiDate(targetDate);
              const todayIso = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"})).toISOString().split('T')[0];
              
              let msg = `📅 รายงานจองห้องประชุม\n📌 วันที่: ${displayDate}`;
              if (targetDate === todayIso) msg += ` (วันนี้)`;
              msg += `\n\n`;
              
              if (bookings.length > 0) {
                bookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).forEach((b, i) => {
                  msg += `${i+1}. ⏰ ${b.startTime}-${b.endTime}\n🏢 ${b.roomName}\n📝 ${b.purpose}\n👤 ผู้จอง: ${b.bookerName}\n\n`;
                });
                msg += `✨ รวมทั้งหมด ${bookings.length} รายการ`;
              } else {
                msg += "✅ ไม่มีรายการจองครับ ว่างทุกห้อง!";
              }
              
              await sendLineReply(env, event.replyToken, msg);
            }
          }
        }
        return new Response('OK');
      }

      // API สำหรับหน้าเว็บ (จัดการผ่าน App.tsx)
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