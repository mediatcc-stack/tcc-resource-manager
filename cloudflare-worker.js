
// cloudflare-worker.js (One-way Notification Mode Only)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      /**
       * 1. Webhook (ปิดการทำงาน)
       * บอทจะไม่รับฟังและไม่ตอบโต้ข้อความใดๆ จากในกลุ่มอีกต่อไป
       */
      if (path === '/webhook' && request.method === 'POST') {
        return new Response('OK', { status: 200 }); // รับทราบแต่ไม่ทำอะไรเลย (Silence)
      }

      /**
       * 2. Data API (หน้าเว็บใช้ดึงข้อมูล)
       */
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

      /**
       * 3. Notify API (หน้าเว็บสั่งให้บอทส่งข้อความแจ้งเตือน)
       * บอทจะพิมพ์ในกลุ่มเฉพาะตอนที่มีคนจองจากหน้าเว็บเท่านั้น
       */
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
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` 
            },
            body: JSON.stringify({ to: id, messages: [{ type: 'text', text: message }] }),
          })
        ));
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response('TCC API One-way Active', { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
