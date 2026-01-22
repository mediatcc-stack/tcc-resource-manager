
import { NOTIFICATION_URL } from '../constants';

export const sendLineNotification = async (message: string): Promise<void> => {
  console.log(`กำลังส่งข้อความแจ้งเตือนไปยัง Webhook...`);
  
  try {
    const response = await fetch(NOTIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }), 
    });

    if (!response.ok) {
      console.warn(`Webhook ตอบกลับด้วยสถานะ: ${response.status}`);
    } else {
      console.log(`ส่งการแจ้งเตือนสำเร็จ`);
    }

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่งแจ้งเตือน:", error);
  }
};
