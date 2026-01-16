// Helper function to send LINE push messages
const sendLinePush = async (env, message) => {
  if (!env.CHANNEL_ACCESS_TOKEN) {
    console.error('Secret [CHANNEL_ACCESS_TOKEN] is not set.');
    return;
  }

  const groupIds = Object.keys(env)
    .filter(key => key.startsWith('GROUP_ID'))
    .map(key => env[key]);

  if (groupIds.length === 0) {
    console.error('No [GROUP_ID] secrets found.');
    return;
  }

  const sendPromises = groupIds.map(groupId => {
    return fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] }),
    });
  });

  await Promise.all(sendPromises);
};

// Helper function to send LINE reply messages
const sendLineReply = async (env, replyToken, message) => {
    if (!env.CHANNEL_ACCESS_TOKEN) {
        console.error('Secret [CHANNEL_ACCESS_TOKEN] is not set.');
        return;
    }
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: message }] }),
    });
};


// Main logic for the scheduled cron job
const handleScheduled = async (env) => {
  if (!env.ROOM_BOOKINGS_KV) return;

  // Use Bangkok Standard Time (UTC+7)
  const nowBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const currentHourBKK = nowBKK.getHours();

  // Only run this logic at 8 AM
  if (currentHourBKK !== 8) {
    return;
  }

  const allBookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
  let bookingsModified = false;
  const todayBKKStr = nowBKK.toISOString().split('T')[0];

  for (const booking of allBookings) {
    // Check for bookings on the current day that haven't had a reminder sent
    if (booking.status === 'จองแล้ว' && booking.date === todayBKKStr && !booking.reminderSent) {
      
      const reminderMessage = [
        `------`,
        `📢 แจ้งเตือนการจอง (วันนี้)`,
        ``,
        `ห้อง: ${booking.roomName}`,
        `วันที่: ${new Date(booking.date).toLocaleDateString('th-TH')}`,
        `เวลา: ${booking.startTime} - ${booking.endTime}`,
        ``,
        `ชื่องาน: ${booking.purpose}`,
        `ผู้จอง: ${booking.bookerName}`,
        `------`,
      ].join('\n');

      await sendLinePush(env, reminderMessage);
      booking.reminderSent = true;
      bookingsModified = true;
    }
  }

  if (bookingsModified) {
    await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify(allBookings));
  }
};


export default {
  // Cron job handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },

  // HTTP request handler
  async fetch(request, env, ctx) {
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
      // Endpoint for LINE Push Notifications from Web App
      if (path === '/notify') {
        if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'ต้องการเมธอด POST' }), { status: 405, headers: corsHeaders });
        const { message } = await request.json();
        if (!message) return new Response(JSON.stringify({ error: 'จำเป็นต้องมีข้อความ' }), { status: 400, headers: corsHeaders });
        await sendLinePush(env, message);
        return new Response(JSON.stringify({ success: true, message: 'ส่งการแจ้งเตือนแล้ว' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // Endpoint for LINE Webhooks (Bot replies)
      if (path === '/webhook') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        if (!env.CHANNEL_SECRET) return new Response('Channel secret not set', { status: 500 });
        
        // Verify signature
        const signature = request.headers.get('x-line-signature');
        const bodyText = await request.text();
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(env.CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
        const hash = btoa(String.fromCharCode(...new Uint8Array(signed)));
        if (hash !== signature) return new Response('Invalid signature', { status: 401 });

        const data = JSON.parse(bodyText);
        for (const event of data.events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const text = event.message.text.toLowerCase();
                if (text.includes('ประชุม') || text.includes('วันนี้') || text.includes('จองห้อง')) {
                    const allBookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"})).toISOString().split('T')[0];
                    
                    const todayBookings = allBookings
                        .filter(b => b.date === today && b.status === 'จองแล้ว')
                        .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    let replyMessage = `🗓️ สรุปรายการจองห้องประชุม วันที่ ${new Date(today).toLocaleDateString('th-TH')}:\n\n`;
                    if (todayBookings.length > 0) {
                        todayBookings.forEach(b => {
                            replyMessage += `ห้อง: ${b.roomName}\n`;
                            replyMessage += `เวลา: ${b.startTime} - ${b.endTime}\n`;
                            replyMessage += `เรื่อง: ${b.purpose}\n`;
                            replyMessage += `ผู้จอง: ${b.bookerName}\n`;
                            replyMessage += `------\n`;
                        });
                    } else {
                        replyMessage = `✅ วันนี้(${new Date(today).toLocaleDateString('th-TH')}) ไม่มีรายการจองห้องประชุมครับ`;
                    }
                    await sendLineReply(env, event.replyToken, replyMessage.trim());
                }
            }
        }
        return new Response('OK', { status: 200 });
      }

      // Endpoint for Data (KV Storage)
      if (path === '/data') {
        const type = url.searchParams.get('type');
        let KV;
        if (type === 'rooms') KV = env.ROOM_BOOKINGS_KV;
        else if (type === 'equipment') KV = env.EQUIPMENT_BORROWINGS_KV;
        else return new Response(JSON.stringify({ error: 'จำเป็นต้องมีพารามิเตอร์ type' }), { status: 400, headers: corsHeaders });
        if (!KV) return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า KV binding' }), { status: 500, headers: corsHeaders });

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
      
      // Endpoint for File Uploads (R2)
      if (path === '/upload') {
        if (!env.ATTACHMENT_BUCKET) return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า R2 binding' }), { status: 500, headers: corsHeaders });
        if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'ต้องการเมธอด POST' }), { status: 405, headers: corsHeaders });
        
        const file = (await request.formData()).get('file');
        if (!file) return new Response(JSON.stringify({ error: 'ไม่พบไฟล์' }), { status: 400, headers: corsHeaders });
        
        const fileKey = `${Date.now()}-${file.name}`;
        await env.ATTACHMENT_BUCKET.put(fileKey, file.stream(), { httpMetadata: { contentType: file.type } });
        
        const publicUrl = `https://${url.hostname}/attachments/${fileKey}`;
        return new Response(JSON.stringify({ url: publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      // Public Access for R2 files
      if (path.startsWith('/attachments/')) {
        if (!env.ATTACHMENT_BUCKET) return new Response(JSON.stringify({ error: 'ไม่ได้กำหนดค่า R2 binding' }), { status: 500, headers: corsHeaders });
        const fileKey = path.substring('/attachments/'.length);
        const object = await env.ATTACHMENT_BUCKET.get(fileKey);
        if (object === null) return new Response(JSON.stringify({ error: 'ไม่พบอ็อบเจกต์' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        
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