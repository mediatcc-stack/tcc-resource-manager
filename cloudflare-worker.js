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

  // Create a date object representing the current time in Bangkok (UTC+7)
  const bkkTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const currentHourBKK = bkkTime.getHours();

  // Only run this logic at 8 AM Bangkok time
  if (currentHourBKK !== 8) {
    return;
  }

  const allBookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
  
  // Create YYYY-MM-DD string for today in Bangkok
  const year = bkkTime.getFullYear();
  const month = (bkkTime.getMonth() + 1).toString().padStart(2, '0');
  const day = bkkTime.getDate().toString().padStart(2, '0');
  const todayBKKStr = `${year}-${month}-${day}`;

  // 1. Find all bookings for today that need a reminder
  const todaysBookings = allBookings.filter(booking => 
    booking.status === 'จองแล้ว' && 
    booking.date === todayBKKStr && 
    !booking.reminderSent
  );

  // 2. If there are bookings, create one summary message
  if (todaysBookings.length > 0) {
    // Sort by start time
    todaysBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const todayFormatted = new Date(todayBKKStr).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
    let summaryMessage = `📢 รายงานการขอใช้ห้อง (วันนี้ - ${todayFormatted})\n\n`;

    todaysBookings.forEach((booking, index) => {
      summaryMessage += `รายการที่ ${index + 1}:\n`;
      summaryMessage += `ห้อง: ${booking.roomName}\n`;
      summaryMessage += `เวลา: ${booking.startTime} - ${booking.endTime}\n`;
      summaryMessage += `ชื่องาน: ${booking.purpose}\n`;
      summaryMessage += `ผู้จอง: ${booking.bookerName}\n`;
      if (index < todaysBookings.length - 1) {
          summaryMessage += `------\n\n`;
      }
    });

    // 3. Send the single message
    await sendLinePush(env, summaryMessage.trim());

    // 4. Mark them as sent
    const todaysBookingIds = new Set(todaysBookings.map(b => b.id));
    const updatedAllBookings = allBookings.map(booking => {
      if (todaysBookingIds.has(booking.id)) {
        return { ...booking, reminderSent: true };
      }
      return booking;
    });

    // 5. Save the updated list
    await env.ROOM_BOOKINGS_KV.put('rooms_data', JSON.stringify(updatedAllBookings));
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
                if (text.includes('ประชุม') || text.includes('วันนี้') || text.includes('จองห้อง') || text.includes('รายงาน')) {
                    const allBookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                    
                    let targetDateStr;
                    let dateForDisplay;

                    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
                    const match = text.match(dateRegex);

                    if (match) {
                        let day = parseInt(match[1], 10);
                        let month = parseInt(match[2], 10);
                        let year = parseInt(match[3], 10);

                        if (year > 2500) {
                            year -= 543;
                        }

                        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                             const targetDate = new Date(year, month - 1, day);
                             targetDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                             dateForDisplay = targetDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
                        }
                    }

                    if (!targetDateStr) {
                        const todayBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
                        const year = todayBKK.getFullYear();
                        const month = (todayBKK.getMonth() + 1).toString().padStart(2, '0');
                        const day = todayBKK.getDate().toString().padStart(2, '0');
                        targetDateStr = `${year}-${month}-${day}`;
                        dateForDisplay = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
                    }
                    
                    const targetBookings = allBookings
                        .filter(b => b.date === targetDateStr && b.status === 'จองแล้ว')
                        .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    let replyMessage;
                    if (targetBookings.length > 0) {
                        replyMessage = `🗓️ สรุปรายการขอใช้ห้อง วันที่ ${dateForDisplay}:\n\n`;
                        targetBookings.forEach((b, index) => {
                            replyMessage += `รายการที่ ${index + 1}:\n`;
                            replyMessage += `ห้อง: ${b.roomName}\n`;
                            replyMessage += `เวลา: ${b.startTime} - ${b.endTime}\n`;
                            replyMessage += `เรื่อง: ${b.purpose}\n`;
                            replyMessage += `ผู้จอง: ${b.bookerName}\n`;
                            if (index < targetBookings.length - 1) {
                                replyMessage += `------\n\n`;
                            }
                        });
                    } else {
                        replyMessage = `✅ วันที่ ${dateForDisplay} ไม่มีรายการจองห้องประชุมครับ`;
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