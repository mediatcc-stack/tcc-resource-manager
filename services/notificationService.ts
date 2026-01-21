import { WORKER_BASE_URL } from '../constants';

// !!! สำคัญ: URL ของ Worker ถูกจัดการจากไฟล์ constants.ts แล้ว
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
      throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${responseBody.error || 'ข้อผิดพลาดที่ไม่รู้จักจาก worker'}`);
    }

    console.log(`Worker ตอบกลับ: ${responseBody.message}`);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่ง LINE:", error);
  }
};