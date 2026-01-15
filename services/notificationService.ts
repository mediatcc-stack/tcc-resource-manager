
const LINE_NOTIFIER_ENDPOINT = 'https://tcc-line-notifier.media-tcc.workers.dev';

export const sendLineNotification = async (message: string): Promise<void> => {
  console.log(`กำลังส่งการแจ้งเตือน: "${message}"`);
  
  try {
    const response = await fetch(LINE_NOTIFIER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }), // ส่งแค่ message
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(`ส่งการแจ้งเตือนไม่สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);
      throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${responseBody.error || 'Unknown worker error'}`);
    }

    console.log(`ส่งการแจ้งเตือนไปที่ LINE สำเร็จ! Status: ${response.status}. Worker ตอบกลับว่า:`, responseBody);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่ง LINE:", error);
  }
};