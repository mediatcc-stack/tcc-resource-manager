// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

// ฟังก์ชันช่วยจัดรูปแบบวันที่ไทย (YYYY-MM-DD -> 21 มกราคม 2569)
const formatThaiDate = (dateStr) => {
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `${parseInt(d)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
  } catch (e) {
    return dateStr;
  }
};

// ฟังก์ชันสร้างข้อความวันที่แบบเต็ม (D-M-YYYY พ.ศ.)
const getFullThaiDateStr = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear() + 543;
  return `${d}-${m}-${y}`;
};

// ฟังก์ชันดึงวันที่เป้าหมาย
const parseTargetDate = (rawText) => {
  const text = rawText.replace(/@[\w\s.-]+/, '').trim().toLowerCase();
  const bkkTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  
  const helpKeywords = ['เมนู', 'help', 'ช่วยเหลือ', 'สวัสดี', 'จอง', 'ห้อง', 'ปุ่ม'];
  if (helpKeywords.some(k => text.includes(k)) || text === '') {
    return null;
  }

  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (fullDateMatch) {
    let [_, d, m, y] = fullDateMatch;
    let year = parseInt(y);
    if (year > 2500) year -= 543;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  if (text.includes('รายงานวันนี้') || text === 'วันนี้') {
    return bkkTime.toISOString().split('T')[0];
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
            const isMentioned = event.message.mention?.mentionees?.find(m => m.isSelf) || event.source.type === 'user';

            if (isMentioned) {
              const targetDate = parseTargetDate(rawText);
              if (targetDate) {
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
                await sendLineReply(env, event.replyToken, { type: 'text', text: msg });
              } else {
                // --- ส่ง Flex Message (การ์ดเมนูสวยงาม) ---
                const bkkNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const tomorrow = new Date(bkkNow); tomorrow.setDate(bkkNow.getDate() + 1);
                const tomorrowStr = getFullThaiDateStr(tomorrow);

                const flexMenu = {
                  type: "flex",
                  altText: "เมนูหลัก TCC Notify",
                  contents: {
                    type: "bubble",
                    header: {
                      type: "box",
                      layout: "vertical",
                      contents: [{ type: "text", text: "TCC NOTIFY", weight: "bold", color: "#FFFFFF", size: "sm" }],
                      backgroundColor: "#0D448D"
                    },
                    hero: {
                      type: "image",
                      url: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80",
                      size: "full",
                      aspectRatio: "20:13",
                      aspectMode: "cover"
                    },
                    body: {
                      type: "box",
                      layout: "vertical",
                      contents: [
                        { type: "text", text: "สวัสดีครับ! ผมบอทรายงานจองห้อง", weight: "bold", size: "md", color: "#0D448D" },
                        { type: "text", text: "เลือกดูรายงานหรือเข้าสู่ระบบเว็บจองได้จากปุ่มด้านล่างนี้เลยครับ", size: "xs", color: "#8c8c8c", wrap: true, margin: "md" }
                      ]
                    },
                    footer: {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      contents: [
                        {
                          type: "button",
                          action: { type: "message", label: "📊 รายงานการจองวันนี้", text: "รายงานวันนี้" },
                          style: "primary",
                          color: "#0D448D"
                        },
                        {
                          type: "button",
                          action: { type: "message", label: `🗓️ รายงานของวันที่ ${tomorrowStr}`, text: `รายงาน ${tomorrowStr}` },
                          style: "secondary"
                        },
                        {
                          type: "button",
                          action: { type: "uri", label: "🌐 เข้าสู่เว็บไซต์จองห้อง", uri: "https://tcc-resource-manager.pages.dev" },
                          color: "#3498db",
                          style: "link"
                        }
                      ]
                    }
                  }
                };
                await sendLineReply(env, event.replyToken, flexMenu);
              }
            }
          }
        }
        return new Response('OK');
      }

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

      return new Response('TCC API Online', { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};