// cloudflare-worker.js (Manual Report & Auto Scheduled Report)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

async function replyToLine(replyToken, message, env) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: message }],
    }),
  });
}

export default {
  /**
   * 1. ส่วนของ API HTTP Request (หน้าเว็บเรียกใช้)
   */
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV = type === 'rooms' ? env.ROOM_BOOKINGS_KV : env.EQUIPMENT_BORROWINGS_KV;
        
        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        if (request.method === 'POST') {
          const newData = await request.json();
          await KV.put(`${type}_data`, JSON.stringify(newData));
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        const groupId = env.GROUP_ID; // ดึง ID กลุ่มจาก Variables

        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` 
          },
          body: JSON.stringify({ 
            to: groupId, 
            messages: [{ type: 'text', text: message }] 
          }),
        });
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      // [ใหม่] เพิ่ม Handler สำหรับรับ Webhook Events จาก LINE
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text' && event.source.type === 'group') {
            const messageText = event.message.text.trim();
            // ตรวจสอบคำสั่งพิเศษ /getid
            if (messageText === '/getid') {
              const groupId = event.source.groupId;
              const replyToken = event.replyToken;
              const replyMsg = `✅ ได้รับ Group ID แล้วครับ\n\n${groupId}\n\nนำ ID นี้ไปใส่ใน Cloudflare Worker Settings ในส่วนของ 'GROUP_ID' ได้เลยครับ`;
              await replyToLine(replyToken, replyMsg, env);
            }
          }
        }
        return new Response('OK'); // ตอบกลับ 200 OK ให้ LINE ทราบ
      }


      return new Response('TCC API Active', { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  },

  /**
   * 2. ส่วนของ Scheduled (Cron Trigger) 
   * ทำหน้าที่ส่งรายงานอัตโนมัติทุกเช้า (ถ้ามีการตั้งเวลาไว้ใน Cloudflare Dashboard)
   */
  async scheduled(event, env, ctx) {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
    const todayBookings = bookings
        .filter(b => b.date === today && b.status === 'จองแล้ว')
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length > 0) {
        let reportMsg = `📊 รายงานการใช้ห้อง (วันนี้)\n`;
        reportMsg += `---------------------\n`;
        todayBookings.forEach((b, index) => {
            reportMsg += `${index + 1}. 🕓 ${b.startTime}-${b.endTime}\n📍 ${b.roomName}\n📝 ${b.purpose}\n👤 ${b.bookerName}\n\n`;
        });
        reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ`;

        await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` 
            },
            body: JSON.stringify({ to: env.GROUP_ID, messages: [{ type: 'text', text: reportMsg }] }),
        });
    }
  }
};