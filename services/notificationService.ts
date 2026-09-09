/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  notificationService.ts — ส่งแจ้งเตือน LINE ผ่าน Cloudflare Worker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ฟังก์ชันนี้ "ไม่ throw" แต่คืนผลลัพธ์กลับมาเสมอ เพื่อให้หน้าจอบอกผู้ใช้ได้ตรงความจริง
 *  ว่าแจ้งเตือนถึงกลุ่ม LINE จริงหรือไม่ (เดิมกลืน error ทั้งหมด หน้าเว็บจึงขึ้นว่า
 *  "ส่งแจ้งเตือนสำเร็จ" แม้ push จะล้มเหลวทุกปลายทาง เช่น token หมดอายุ/โควตาเต็ม)
 *
 *  ⚠️  การบันทึกข้อมูลกับการแจ้งเตือนเป็นคนละเรื่องกัน — ถ้าแจ้งเตือนไม่สำเร็จ
 *      ข้อมูลที่บันทึกไปแล้วยังอยู่ครบ ข้อความที่แจ้งผู้ใช้จึงต้องแยกสองเรื่องนี้ให้ชัด
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { NOTIFICATION_URL } from '../constants';

export interface NotifyResult {
  /** ส่งถึงอย่างน้อย 1 ปลายทางหรือไม่ */
  ok: boolean;
  /** จำนวนปลายทางที่ส่งสำเร็จ */
  sent: number;
  /** จำนวนปลายทางทั้งหมดที่พยายามส่ง */
  total: number;
  /** เหตุผลเมื่อส่งไม่สำเร็จ (ใช้แสดงต่อผู้ใช้ได้เลย) */
  error?: string;
}

export const sendLineNotification = async (
  message: string,
  target?: 'repair'
): Promise<NotifyResult> => {
  try {
    const response = await fetch(NOTIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': import.meta.env.VITE_API_SECRET_KEY,
      },
      body: JSON.stringify({ message, target }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[Notify] Worker ตอบกลับสถานะ ${response.status}:`, detail);
      return { ok: false, sent: 0, total: 0, error: `เซิร์ฟเวอร์แจ้งเตือนตอบกลับ ${response.status}` };
    }

    const result = await response.json();
    if (result?.success) {
      console.log(`[Notify] ส่งสำเร็จ ${result.sent}/${result.total} ปลายทาง`);
      return { ok: true, sent: result.sent ?? 0, total: result.total ?? 0 };
    }

    console.error('[Notify] ส่งไม่สำเร็จ:', result?.error);
    return {
      ok: false,
      sent: result?.sent ?? 0,
      total: result?.total ?? 0,
      error: result?.error || 'ส่งแจ้งเตือน LINE ไม่สำเร็จ',
    };
  } catch (error: any) {
    console.error('[Notify] เกิดข้อผิดพลาดในการส่งแจ้งเตือน:', error);
    return { ok: false, sent: 0, total: 0, error: 'ติดต่อเซิร์ฟเวอร์แจ้งเตือนไม่ได้' };
  }
};
