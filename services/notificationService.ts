// แก้ไข URL นี้เป็น URL ของ Worker ของคุณ และเพิ่ม /notify ต่อท้าย
const LINE_NOTIFIER_ENDPOINT = 'https://tcc-line-notifier.media-tcc.workers.dev/notify';

export const sendLineNotification = async (message: string): Promise<void> => {
  console.log(`กำลังส่งการแจ้งเตือนไปที่ LINE: "${message}"`);
  
  try {
    const response = await fetch(LINE_NOTIFIER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    // อ่านข้อความตอบกลับมาจาก Worker เสมอ เพื่อการดีบัก
    const responseBody = await response.text();

    if (!response.ok) {
      console.error(`ส่งการแจ้งเตือนไม่สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);
      throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${response.status}`);
    }

    console.log(`ส่งการแจ้งเตือนไปที่ LINE สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่ง LINE:", error);
  }
};