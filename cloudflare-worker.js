
// cloudflare-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

export default {
  async fetch(request, env) {
    // 1. จัดการ CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      /**
       * 1. Webhook Endpoint (LINE)
       * แก้ไข: ปิดระบบประมวลผลข้อความแชททั้งหมด
       * บอทจะไม่ตอบโต้คำสั่ง 'รายงาน' หรือข้อความใดๆ ในกลุ่มอีกต่อไป
       */
      if (path === '/webhook' && request.method === 'POST') {
        // คืนค่า OK เพื่อให้ LINE Server รับทราบว่าได้รับข้อมูลแล้ว แต่ไม่ต้องทำอะไรต่อ
        // วิธีนี้จะทำให้บอท "เงียบ" สนิท 100% ในทุกแชท
        return new Response('OK', { status: 200 });
      }

      /**
       * 2. Data Endpoint (Web App)
       * ใช้สำหรับรับ-ส่งข้อมูลระหว่างหน้าเว็บกับฐานข้อมูล KV
       */
      if (path === '/data') {
        const type = url.searchParams.get('type'); // 'rooms' หรือ 'equipment'
        const KV = type === 'rooms' ? env.ROOM_BOOKINGS_KV : env.EQUIPMENT_BORROWINGS_KV;
        
        if (!KV) {
          throw new Error(`ไม่พบ KV Namespace สำหรับ ${type}`);
        }

        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        if (request.method === 'POST') {
          const newData = await request.json();
          await KV.put(`${type}_data`, JSON.stringify(newData));
          return new Response(JSON.stringify({ success: true }), { 
            headers: corsHeaders 
          });
        }
      }

      /**
       * 3. Notify Endpoint (Web App -> LINE Push)
       * ระบบแจ้งเตือนทางเดียว: ส่งข้อความ "เมื่อมีการจองใหม่จากหน้าเว็บเท่านั้น"
       */
      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        
        // ดึง IDs ของกลุ่มทั้งหมดที่ตั้งไว้ใน Environment Variables
        const allTargetIds = Object.keys(env)
          .filter(k => k === 'GROUP_ID' || k.startsWith('GROUP_ID_'))
          .map(k => env[k])
          .filter(id => id);

        const uniqueTargets = [...new Set(allTargetIds)];

        if (uniqueTargets.length === 0) {
          return new Response(JSON.stringify({ error: 'No GROUP_ID configured' }), { 
            status: 400, headers: corsHeaders 
          });
        }

        // ส่งข้อความแบบ Push (จู่ๆ บอทก็พิมพ์เข้าไปเองตามคำสั่งเว็บ)
        const sendPromises = uniqueTargets.map(id => 
          fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` 
            },
            body: JSON.stringify({ 
              to: id, 
              messages: [{ type: 'text', text: message }] 
            }),
          })
        );

        await Promise.all(sendPromises);
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response('TCC Notification API is Online', { headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }
};
