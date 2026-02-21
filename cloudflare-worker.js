const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key',
};
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key',
};

// --- LINE Messaging API Functions ---
// This function sends a push notification to the configured RECIPIENT_ID.
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

// --- Worker Middleware --- 
const withApiKeyAuth = (request, env) => {
  const apiKey = request.headers.get('X-API-Key');
  if (!env.API_SECRET_KEY || apiKey !== env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
};

// --- Main Worker Logic ---
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Authentication Routes (Public) ---
    if (path === '/auth/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ success: false }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    try {
      // Endpoint for the frontend to check worker configuration status
      if (path === '/status') {
        const status = {
          lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
          roomKvBinding: !!env.ROOM_BOOKINGS_KV,
          equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
          recipientIdSet: !!env.RECIPIENT_ID,
        };
        return new Response(JSON.stringify(status), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // Protected routes - require API Key
      const authError = withApiKeyAuth(request, env);
      if (authError) return authError;

      // Endpoint for fetching/saving data from/to KV storage
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

      // Endpoint for the frontend to trigger a LINE notification
      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        ctx.waitUntil(sendNotification(message, env));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      // The /webhook endpoint for replying to user messages has been intentionally removed.

      return new Response(JSON.stringify({ error: `Route not found` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return new Response(JSON.stringify({ error: `Worker internal error` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  },

  // Scheduled task to send a daily summary of bookings
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