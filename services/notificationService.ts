
import { NOTIFICATION_URL } from '../constants';

export const sendLineNotification = async (message: string): Promise<void> => {
  console.log(`กำลังส่งข้อความแจ้งเตือนไปยัง Cloudflare Worker...`);
  
  try {
    const response = await fetch(NOTIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }), 
    });

    if (!response.ok) {
      console.warn(`Worker ตอบกลับด้วยสถานะ: ${response.status}`);
      const errorText = await response.text();
      console.error("รายละเอียดข้อผิดพลาด:", errorText);
    } else {
      console.log(`ส่งการแจ้งเตือนสำเร็จผ่าน Cloudflare Worker`);
    }

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่งแจ้งเตือน:", error);
  }
};
