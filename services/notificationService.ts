
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

    // Worker ที่ใช้ Messaging API ควรจะตอบกลับเป็น JSON เสมอ
    const responseBody = await response.json();

    if (!response.ok) {
      // หาก response ไม่ใช่ 2xx, แสดงว่าเกิดข้อผิดพลาด
      console.error(`ส่งการแจ้งเตือนไม่สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);
      // โยน error พร้อมรายละเอียดจาก Worker เพื่อให้ catch block ด้านล่างทำงาน
      throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${responseBody.error || 'Unknown worker error'}`);
    }

    console.log(`ส่งการแจ้งเตือนไปที่ LINE สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);

  } catch (error) {
    // error อาจจะมาจากการ fetch ล้มเหลว (เช่น network error) หรือจาก throw ด้านบน
    console.error("เกิดข้อผิดพลาดในการส่ง LINE:", error);
    // ไม่ต้อง throw ต่อ เพื่อไม่ให้แอปแครช แค่ log ไว้ก็พอ
  }
};
