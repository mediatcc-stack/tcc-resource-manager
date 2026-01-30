
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

async function getGroupSummary(groupId, env) {
    try {
        const response = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
            headers: { 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
        });
        if (response.ok) {
            const data = await response.json();
            return data.groupName;
        }
        return `กลุ่มที่ไม่รู้จัก`;
    } catch (e) {
        return `กลุ่มที่ไม่รู้จัก`;
    }
}

const checkKvBinding = (kv, name) => {
    if (!kv) {
        const errorMsg = `การตั้งค่าผิดพลาด: ไม่พบ KV Namespace ที่ชื่อ "${name}" ใน Cloudflare Worker`;
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
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- API ROUTING ---
      
      // GET /status: Check worker and bindings status
      if (path === '/status' && request.method === 'GET') {
        const status = {
          lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
          roomKvBinding: !!env.ROOM_BOOKINGS_KV,
          equipmentKvBinding: !!env.EQUIPMENT_BORROWING,
          lineGroupsKvBinding: !!env.LINE_GROUPS_KV
        };
        return new Response(JSON.stringify(status), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // GET & POST /data: Handle booking and equipment data
      if (path === '/data') {
        const type = url.searchParams.get('type');
        if (!type || (type !== 'rooms' && type !== 'equipment')) {
            return new Response(JSON.stringify({ error: "Missing or invalid 'type' parameter. Must be 'rooms' or 'equipment'." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const KV_NAME = type === 'rooms' ? 'ROOM_BOOKINGS_KV' : 'EQUIPMENT_BORROWING';
        const KV = env[KV_NAME];
        const bindingError = checkKvBinding(KV, KV_NAME);
        if (bindingError) return bindingError;
        
        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        if (request.method === 'POST') {
          const newData = await request.json();
          await KV.put(`${type}_data`, JSON.stringify(newData));
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // GET & POST /groups: Manage LINE Group IDs for notifications
      if (path === '/groups') {
        const bindingError = checkKvBinding(env.LINE_GROUPS_KV, 'LINE_GROUPS_KV');
        if (bindingError) return bindingError;

        if (request.method === 'GET') {
            const groups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
            return new Response(JSON.stringify(groups), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
            const groupIds = await request.json();
            if (!Array.isArray(groupIds)) {
                return new Response(JSON.stringify({ error: 'Invalid data format, expected an array of strings.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            await env.LINE_GROUPS_KV.put('registered_groups', JSON.stringify(groupIds));
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      
      // GET & DELETE /group-id-log: Manage discovered Group ID logs
      if (path === '/group-id-log') {
        const bindingError = checkKvBinding(env.LINE_GROUPS_KV, 'LINE_GROUPS_KV');
        if (bindingError) return bindingError;

        if (request.method === 'GET') {
            const log = await env.LINE_GROUPS_KV.get('group_id_log', 'json') || [];
            return new Response(JSON.stringify(log), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        if (request.method === 'DELETE') {
            await env.LINE_GROUPS_KV.put('group_id_log', JSON.stringify([]));
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // POST /notify: Send a notification message
      if (path === '/notify' && request.method === 'POST') {
        const { message } = await request.json();
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, message, env);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // POST /webhook: Handle incoming LINE webhooks
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {
          if (event.type === 'message' && event.message.type === 'text' && (event.source.type === 'group' || event.source.type === 'room')) {
            const messageText = event.message.text.trim().toLowerCase();
            const groupId = event.source.groupId;
            
            if (messageText === '/getid') {
              await replyToLine(event.replyToken, `✅ Group ID ของกลุ่มนี้คือ:\n\n${groupId}`, env);
              
              const bindingError = checkKvBinding(env.LINE_GROUPS_KV, 'LINE_GROUPS_KV');
              if (!bindingError) {
                const groupName = await getGroupSummary(groupId, env);
                const log = await env.LINE_GROUPS_KV.get('group_id_log', 'json') || [];
                if (!log.some(g => g.id === groupId)) {
                    const newLogEntry = { id: groupId, name: groupName, detectedAt: new Date().toISOString() };
                    const updatedLog = [newLogEntry, ...log].slice(0, 20); // Keep last 20 entries
                    await env.LINE_GROUPS_KV.put('group_id_log', JSON.stringify(updatedLog));
                }
              }
            }
          }
        }
        return new Response('OK');
      }

      // If no route matched, return a 404
      return new Response(JSON.stringify({ error: `Route not found: ${request.method} ${path}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      console.error(`[Worker Error] Uncaught exception: ${e.message}\n${e.stack}`);
      return new Response(JSON.stringify({ error: `Worker internal error: ${e.message}` }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
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
        let reportMsg = `📊 สรุปการจองห้องประชุม (วันนี้)\n`;
        reportMsg += `---------------------\n`;
        todayBookings.forEach((b, index) => {
            reportMsg += `📌 ${b.roomName} (${b.startTime}-${b.endTime})\n`;
            reportMsg += `   - ${b.purpose} (โดย ${b.bookerName})\n\n`;
        });
        reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ`;
        
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, reportMsg, env);
        }
    }
  }
};
