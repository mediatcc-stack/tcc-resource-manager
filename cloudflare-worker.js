
export default {
  async fetch(request, env, ctx) {
    // CORS Headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- Endpoint for LINE Notifications ---
      if (path === '/notify') {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'ต้องการเมธอด POST' }), { status: 405, headers: corsHeaders });
        }
        
        const { message } = await request.json();
        if (!message) {
            return new Response(JSON.stringify({ error: 'จำเป็นต้องมีข้อความ' }), { status: 400, headers: corsHeaders });
        }
        
        if (!env.CHANNEL_ACCESS_TOKEN) {
          return new Response(JSON.stringify({ error: 'ไม่ได้ตั้งค่า Secret [CHANNEL_ACCESS_TOKEN] ใน Worker' }), { status: 500, headers: corsHeaders });
        }

        const groupIds = [];
        for (const key in env) {
          if (key.startsWith('GROUP_ID')) {
            groupIds.push(env[key]);
          }
        }

        if (groupIds.length === 0) {
          return new Response(JSON.stringify({ error: 'ไม่พบ Secret [GROUP_ID] ใน Worker' }), { status: 500, headers: corsHeaders });
        }

        const sendPromises = groupIds.map(groupId => {
          return fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] }),
          });
        });

        await Promise.all(sendPromises);
        return new Response(JSON.stringify({ success: true, message: 'ส่งการแจ้งเตือนแล้ว' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // --- Endpoint for Data (Bookings) ---
      if (path === '/data') {
        const type = url.searchParams.get('type');
        let KV;

        if (type === 'rooms') {
            if (!env.ROOM_BOOKINGS_KV) {
                return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า KV binding [ROOM_BOOKINGS_KV] ใน Worker' }), { status: 500, headers: corsHeaders });
            }
            KV = env.ROOM_BOOKINGS_KV;
        } else if (type === 'equipment') {
            if (!env.EQUIPMENT_BORROWINGS_KV) {
                return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า KV binding [EQUIPMENT_BORROWINGS_KV] ใน Worker' }), { status: 500, headers: corsHeaders });
            }
            KV = env.EQUIPMENT_BORROWINGS_KV;
        } else {
            return new Response(JSON.stringify({ error: 'จำเป็นต้องมีพารามิเตอร์ type (?type=rooms หรือ ?type=equipment)' }), { status: 400, headers: corsHeaders });
        }
        
        const key = `${type}_data`;

        if (request.method === 'GET') {
          const data = await KV.get(key, 'json') || [];
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        
        if (request.method === 'POST') {
          const newData = await request.json();
          await KV.put(key, JSON.stringify(newData));
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        
        return new Response(JSON.stringify({ error: 'เมธอดไม่ได้รับอนุญาต' }), { status: 405, headers: corsHeaders });
      }

      // --- Endpoint for File Uploads ---
      if (path === '/upload') {
        if (!env.ATTACHMENT_BUCKET) {
          return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า R2 binding [ATTACHMENT_BUCKET] ใน Worker' }), { status: 500, headers: corsHeaders });
        }
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'ต้องการเมธอด POST' }), { status: 405, headers: corsHeaders });
        }
        
        const file = (await request.formData()).get('file');
        if (!file) {
          return new Response(JSON.stringify({ error: 'ไม่พบไฟล์ในข้อมูลฟอร์ม' }), { status: 400, headers: corsHeaders });
        }
        
        const fileKey = `${Date.now()}-${file.name}`;
        await env.ATTACHMENT_BUCKET.put(fileKey, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = `https://${url.hostname}/attachments/${fileKey}`;
        return new Response(JSON.stringify({ url: publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      // --- Public Access for R2 files ---
      if (path.startsWith('/attachments/')) {
        if (!env.ATTACHMENT_BUCKET) {
            return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า R2 binding [ATTACHMENT_BUCKET] ใน Worker' }), { status: 500, headers: corsHeaders });
        }
        const fileKey = path.substring('/attachments/'.length);
        const object = await env.ATTACHMENT_BUCKET.get(fileKey);

        if (object === null) {
          return new Response(JSON.stringify({ error: 'ไม่พบอ็อบเจกต์' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        
        const headers = { ...corsHeaders };
        object.writeHttpMetadata(headers);
        headers['ETag'] = object.httpEtag;
        
        return new Response(object.body, { headers });
      }

      return new Response(JSON.stringify({ error: 'ไม่พบ' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return new Response(JSON.stringify({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', details: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};
