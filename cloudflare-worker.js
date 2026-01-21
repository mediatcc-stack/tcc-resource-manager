// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
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
      // 1. Webhook สำหรับ LINE
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text.trim().toLowerCase();
            const isMentioned = event.message.mention?.mentionees?.some(m => m.isSelf) || event.source.type === 'user';

            if (isMentioned) {
              if (text.includes('รายงาน') || text.includes('จอง')) {
                const data = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                const bkk = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const today = bkk.toISOString().split('T')[0];
                
                const bookings = data.filter(b => b.date === today && b.status === 'จองแล้ว');
                let msg = `📅 รายการจองวันนี้ (${bkk.toLocaleDateString('th-TH')}):\n`;
                if (bookings.length > 0) {
                  bookings.forEach((b, i) => msg += `${i+1}. ${b.startTime}-${b.endTime} | ${b.roomName}\n📝 ${b.purpose}\n`);
                } else {
                  msg += "✅ วันนี้ไม่มีรายการจองครับ";
                }
                await sendLineReply(env, event.replyToken, msg);
              } else {
                await sendLineReply(env, event.replyToken, "สวัสดีครับ! ผมบอท TCC Notify 🚀\nพิมพ์ 'รายงาน' เพื่อดูคิวจองวันนี้ครับ");
              }
            }
          }
        }
        return new Response('OK');
      }

      // 2. ระบบดึงข้อมูล (API สำหรับเว็บ)
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

      // 3. ระบบ Push แจ้งเตือน
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