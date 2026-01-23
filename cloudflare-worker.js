// cloudflare-worker.js (Admin-Managed Group IDs & Multicast Notifications)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
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

async function sendMulticast(groupIds, message, env) {
  if (!groupIds || groupIds.length === 0) {
    console.log("No groups registered for notifications.");
    return;
  }
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/multicast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: groupIds, messages: [{ type: 'text', text: message }] }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LINE Multicast Error] Status: ${response.status}, Body: ${errorBody}`);
    }
  } catch (error) {
     console.error(`[LINE Multicast Fetch Error] Failed to send multicast: ${error.message}`);
  }
}

// --- Main Worker Logic ---
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Endpoint for Booking/Equipment Data
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

      // Endpoint for LINE Group ID Management (Admin Only)
      if (path === '/groups') {
          if (request.method === 'GET') {
              const groups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
              return new Response(JSON.stringify(groups), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          if (request.method === 'POST') {
              const groupIds = await request.json();
              if (!Array.isArray(groupIds)) {
                  return new Response(JSON.stringify({ error: 'Invalid data format, expected an array of strings.' }), { status: 400, headers: corsHeaders });
              }
              await env.LINE_GROUPS_KV.put('registered_groups', JSON.stringify(groupIds));
              return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }
      }

      // Endpoint for Sending Notifications
      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, message, env);
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      // LINE Webhook Endpoint
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text' && (event.source.type === 'group' || event.source.type === 'room')) {
            const messageText = event.message.text.trim().toLowerCase();
            const groupId = event.source.groupId;
            
            if (messageText === '/getid') {
              const replyMsg = `✅ Group ID ของกลุ่มนี้คือ:\n\n${groupId}\n\n(สำหรับผู้ดูแลระบบ) กรุณาคัดลอก ID นี้ไปใส่ในหน้าตั้งค่าการแจ้งเตือนบนเว็บแอปพลิเคชัน`;
              await replyToLine(event.replyToken, replyMsg, env);
            }
          }
        }
        return new Response('OK');
      }

      return new Response('TCC API Active', { headers: corsHeaders });
    } catch (e) {
      console.error(`[Worker Error] Uncaught exception: ${e.message}`);
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  },

  // Cron Trigger for Daily Reports
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
        
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, reportMsg, env);
        }
    }
  }
};