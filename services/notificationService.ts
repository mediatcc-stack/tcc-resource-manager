
// !!! สำคัญ: โปรดตรวจสอบให้แน่ใจว่า URL นี้ตรงกับ URL ของ Worker ที่คุณใช้งานจริง
const WORKER_BASE_URL = 'https://tcc-line-notifier.media-tcc.workers.dev';
const LINE_NOTIFIER_ENDPOINT = `${WORKER_BASE_URL}/notify`;

export const sendLineNotification = async (message: string): Promise<void> => {
  console.log(`กำลังส่งข้อความแจ้งเตือน...`);
  
  try {
    const response = await fetch(LINE_NOTIFIER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // ส่งแค่ message ไปให้ Worker
      body: JSON.stringify({ message }), 
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(`ส่งการแจ้งเตือนไม่สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);
      throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${responseBody.error || 'Unknown worker error'}`);
    }

    console.log(`Worker ตอบกลับ: ${responseBody.message}`);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่ง LINE:", error);
  }
};