// cloudflare-worker.js (Register/Unregister & Multicast Notifications)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

async function replyToLine(replyToken, message, env) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
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
    
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LINE Reply Error] Status: ${response.status}, Body: ${errorBody}`);
    }

  } catch (error) {
    console.error(`[LINE Reply Fetch Error] Failed to send reply: ${error.message}`);
  }
}

// ฟังก์ชันสำหรับส่งข้อความไปยังหลายกลุ่มพร้อมกัน
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
      body: JSON.stringify({
        to: groupIds,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LINE Multicast Error] Status: ${response.status}, Body: ${errorBody}`);
    }
  } catch (error) {
     console.error(`[LINE Multicast Fetch Error] Failed to send multicast: ${error.message}`);
  }
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
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, message, env);
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        for (const event of body.events) {

          // Event: บอทถูกเชิญเข้ากลุ่ม
          if (event.type === 'join') {
            const welcomeMessage = `สวัสดีครับ! ผมคือ TCC Notify Bot\n\nหากต้องการให้กลุ่มนี้รับการแจ้งเตือนจากระบบจองห้องประชุมและยืมอุปกรณ์ กรุณาพิมพ์คำสั่ง:\n\n/register`;
            await replyToLine(event.replyToken, welcomeMessage, env);
            continue;
          }

          // Event: ได้รับข้อความในกลุ่ม
          if (event.type === 'message' && event.message.type === 'text' && (event.source.type === 'group' || event.source.type === 'room')) {
            const messageText = event.message.text.trim().toLowerCase();
            const groupId = event.source.groupId;
            const replyToken = event.replyToken;

            if (messageText === '/getid') {
              const replyMsg = `✅ Group ID ของกลุ่มนี้คือ:\n\n${groupId}`;
              await replyToLine(replyToken, replyMsg, env);

            } else if (messageText === '/register') {
                let groups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
                if (!groups.includes(groupId)) {
                    groups.push(groupId);
                    await env.LINE_GROUPS_KV.put('registered_groups', JSON.stringify(groups));
                    await replyToLine(replyToken, "✅ ลงทะเบียนรับการแจ้งเตือนสำหรับกลุ่มนี้เรียบร้อยแล้ว", env);
                } else {
                    await replyToLine(replyToken, "ℹ️ กลุ่มนี้ได้ลงทะเบียนรับการแจ้งเตือนอยู่แล้ว", env);
                }

            } else if (messageText === '/unregister') {
                let groups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
                if (groups.includes(groupId)) {
                    groups = groups.filter(id => id !== groupId);
                    await env.LINE_GROUPS_KV.put('registered_groups', JSON.stringify(groups));
                    await replyToLine(replyToken, "☑️ ยกเลิกการรับการแจ้งเตือนสำหรับกลุ่มนี้แล้ว", env);
                } else {
                    await replyToLine(replyToken, "ℹ️ กลุ่มนี้ยังไม่ได้ลงทะเบียนรับการแจ้งเตือน", env);
                }
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

  /**
   * 2. ส่วนของ Scheduled (Cron Trigger) 
   * ทำหน้าที่ส่งรายงานอัตโนมัติทุกเช้า
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
        
        const registeredGroups = await env.LINE_GROUPS_KV.get('registered_groups', 'json') || [];
        if (registeredGroups.length > 0) {
            await sendMulticast(registeredGroups, reportMsg, env);
        }
    }
  }
};