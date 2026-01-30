
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-control-allow-headers': 'Content-Type, Authorization, Accept',
};

// --- LINE Messaging API Functions ---
async function replyToLine(replyToken, message, env) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: message }] }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LINE Reply Error] Status: ${response.status}, Body: ${errorBody}`);
    }
  } catch (error) {
    console.error(`[LINE Reply Fetch Error] Failed to send reply: ${error.message}`);
  }
}

async function sendNotification(message, env) {
  const recipientId = env.RECIPIENT_ID;

  if (!recipientId) {
    console.error("[LINE Push Error] The RECIPIENT_ID environment variable is not set. Please add it to the Cloudflare Worker settings to enable notifications.");
    return;
  }
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: recipientId, messages: [{ type: 'text', text: message }] }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LINE Push Error] Failed to send to ID: ${recipientId}, Status: ${response.status}, Body: ${errorBody}`);
    }
  } catch (error) {
     console.error(`[LINE Push Fetch Error] Failed to send to ID: ${recipientId}, Error: ${error.message}`);
  }
}

const checkKvBinding = (kv, name) => {
    if (!kv) {
        const errorMsg = `Configuration Error: KV Namespace binding "${name}" not found.`;
        console.error(`[KV Binding Error] ${errorMsg}`);
        return new Response(JSON.stringify({ error: errorMsg }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    return null;
};

// --- Main Worker Logic ---
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/status') {
        const status = {
          lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
          roomKvBinding: !!env.ROOM_BOOKINGS_KV,
          equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
          recipientIdSet: !!env.RECIPIENT_ID,
        };
        return new Response(JSON.stringify(status), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV_NAME = type === 'rooms' ? 'ROOM_BOOKINGS_KV' : 'EQUIPMENT_BORROWINGS_KV';
        const KV = env[KV_NAME];
        if (checkKvBinding(KV, KV_NAME)) return checkKvBinding(KV, KV_NAME);
        
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
        await sendNotification(message, env);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text' && event.message.text.trim().toLowerCase() === '/getid') {
            const id = event.source.groupId || event.source.userId;
            const idType = event.source.groupId ? 'Group ID' : 'User ID';
            if (id) {
              await replyToLine(event.replyToken, `✅ ${idType} ของแชทนี้คือ:\n\n${id}`, env);
            }
          }
        }
        return new Response('OK');
      }

      return new Response(JSON.stringify({ error: `Route not found` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return new Response(JSON.stringify({ error: `Worker internal error` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  },

  async scheduled(event, env, ctx) {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
    const todayBookings = bookings.filter(b => b.date === today && b.status === 'จองแล้ว').sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length > 0) {
        let reportMsg = `📊 สรุปการจองห้องประชุม (วันนี้)\n---------------------\n`;
        todayBookings.forEach(b => {
            reportMsg += `📅 ${b.roomName} (${b.startTime}-${b.endTime})\n   - ${b.purpose} (โดย ${b.bookerName})\n\n`;
        });
        reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ`;
        await sendNotification(reportMsg, env);
    }
  }
};