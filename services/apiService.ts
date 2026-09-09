/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  apiService.ts — ฟังก์ชันสำหรับติดต่อ Cloudflare Worker (Backend)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  📁 SOURCE CODE (GitHub)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Repository : https://github.com/[your-org]/tcc-resource-manager
 *  ไฟล์นี้    : services/apiService.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔌  การเชื่อมต่อ Frontend ↔ Cloudflare Worker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ทุก request ที่ส่งไปยัง /data endpoint ต้องมี Header: X-API-Key
 *  ค่าของ Key มาจาก VITE_API_SECRET_KEY ที่ตั้งใน Cloudflare Pages Settings
 *  และต้องตรงกับ API_SECRET_KEY ใน Cloudflare Worker Settings
 *
 *  ถ้าระบบแจ้ง "Unauthorized":
 *    1. ตรวจสอบว่า VITE_API_SECRET_KEY ใน Pages ตรงกับ API_SECRET_KEY ใน Worker
 *    2. ตรวจสอบว่า .env.local มีค่าที่ถูกต้อง (ทดสอบ local)
 *    3. ถ้าเพิ่งเปลี่ยนค่า ต้อง Redeploy Pages ด้วย
 *
 *  ถ้าระบบแจ้ง "KV Namespace not found":
 *    ตรวจสอบ Bindings ที่ Cloudflare Worker Dashboard → tcc-line-notifier → Bindings
 *    ต้องมี ROOM_BOOKINGS_KV และ EQUIPMENT_BORROWINGS_KV ที่ bind แล้ว
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🗄️  โครงสร้างข้อมูลใน KV
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  fetchData('rooms')      → อ่าน KV key "rooms_data"      → Booking[]
 *  fetchData('equipment')  → อ่าน KV key "equipment_data"  → BorrowingRequest[]
 *  fetchData('repairs')    → อ่าน KV key "repairs_data"    → RepairRequest[]
 *  saveData('rooms', [...])     → เขียนทับ KV key "rooms_data" ทั้งหมด
 *  saveData('equipment', [...]) → เขียนทับ KV key "equipment_data" ทั้งหมด
 *  saveData('repairs', [...])   → เขียนทับ KV key "repairs_data" ทั้งหมด
 *
 *  ⚠️  saveData ทำงานแบบ overwrite ทั้งหมด ไม่ใช่ append!
 *      ต้องส่ง array ทั้งหมดที่ต้องการบันทึก ไม่ใช่แค่รายการที่เปลี่ยน
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔀  กันข้อมูลหายเมื่อสองคนบันทึกพร้อมกัน
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  เพราะ saveData เขียนทับทั้งก้อน ถ้า A กับ B เปิดหน้าเดียวกันแล้วบันทึกไล่กัน
 *  รายการที่ A เพิ่งเพิ่มจะหายไปพร้อมการบันทึกของ B โดยไม่มีใครรู้
 *
 *  ตอนนี้ Worker ส่ง "เลขรุ่นข้อมูล" (X-Data-Version) มาให้ตอน GET และตรวจตอน POST
 *  ถ้าเลขไม่ตรง = มีคนบันทึกแทรกเข้ามาก่อน Worker จะตอบ 409 พร้อมข้อมูลล่าสุด
 *  แล้ว saveData จะรวมข้อมูลให้อัตโนมัติตามกติกานี้ แล้วส่งใหม่
 *
 *    - รายการที่เราแก้/เพิ่ม        → ใช้ของเรา
 *    - รายการที่เราตั้งใจลบ         → ลบจริง
 *    - รายการที่คนอื่นเพิ่มระหว่างนั้น → เก็บไว้ ไม่หาย
 *
 *  ผู้เรียกต้องส่ง previousData (state ก่อนแก้) มาด้วย ไม่งั้นจะรวมข้อมูลไม่ได้
 *  และ saveData จะคืน array ที่บันทึกลงไปจริง ๆ (อาจไม่เท่ากับที่ส่งไป ถ้ามีการรวม)
 *  จึงควรเอาค่าที่คืนมา setState ต่อ
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment' | 'repairs';

/** ทุกชนิดข้อมูลในระบบมี id เป็นตัวอ้างอิงรายการ ใช้ตอนรวมข้อมูลที่ชนกัน */
interface Identifiable { id: string }

/** เลขรุ่นล่าสุดของข้อมูลแต่ละชนิดที่เครื่องนี้เห็น (ได้มาจาก header X-Data-Version) */
const dataVersions: Record<DataType, string | null> = {
    rooms: null,
    equipment: null,
    repairs: null,
};

/**
 * รวมข้อมูลเมื่อบันทึกชนกัน
 *   server   = ข้อมูลล่าสุดบนเซิร์ฟเวอร์ (มีของคนอื่นที่บันทึกแทรกเข้ามา)
 *   previous = ข้อมูลก่อนที่เราจะแก้
 *   next     = ข้อมูลที่เราตั้งใจจะบันทึก
 *
 * กติกา: ของเราชนะสำหรับรายการที่เราแตะ, รายการที่เราลบก็ลบจริง,
 * ส่วนรายการที่คนอื่นเพิ่มเข้ามาระหว่างนั้นจะถูกเก็บต่อท้ายไว้ ไม่หายไป
 */
const mergeWithServerData = <T extends Identifiable>(server: T[], previous: T[], next: T[]): T[] => {
    const nextIds = new Set(next.map(item => item.id));
    const previousIds = new Set(previous.map(item => item.id));

    const addedByOthers = server.filter(item => !nextIds.has(item.id) && !previousIds.has(item.id));
    return [...next, ...addedByOthers];
};

export interface WorkerStatus {
    lineApiToken: boolean;
    /** ตั้ง CHANNEL_SECRET แล้วหรือยัง — ถ้ายัง /webhook รับ event ปลอมได้ */
    channelSecretSet: boolean;
    roomKvBinding: boolean;
    equipmentKvBinding: boolean;
    repairKvBinding: boolean;
    recipientIdSet: boolean;
    repairGroupIdSet: boolean;
    /** จำนวนกลุ่ม LINE ที่รับแจ้งเตือนจริงใน KV (0 = แจ้งเตือนไม่ถึงใครเลย) */
    recipientCount: number | null;
}

/** กลุ่ม/ผู้ใช้ LINE ที่จะได้รับแจ้งเตือน (ชื่อดึงสดจาก LINE ทุกครั้งที่เรียก) */
export interface NotificationRecipient {
    id: string;
    name: string | null;
    type: 'group' | 'user';
}

// ─────────────────────────────────────────────────────────────────────────────
//  getApiHeaders() — สร้าง HTTP Headers สำหรับ request ที่ต้องการ Authentication
//  API Key อ่านมาจาก environment variable VITE_API_SECRET_KEY
//  (ตั้งค่าใน Cloudflare Pages Settings หรือไฟล์ .env.local สำหรับ dev)
// ─────────────────────────────────────────────────────────────────────────────
const getApiHeaders = () => {
    // ⚠️  ลบ console.log ของ API Key ออกแล้ว (security fix)
    //     ไม่ควร log ค่า secret ออก console แม้ในโหมด dev
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': import.meta.env.VITE_API_SECRET_KEY,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  handleResponse() — จัดการ HTTP Response และ Error จาก Worker
// ─────────────────────────────────────────────────────────────────────────────
const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || JSON.stringify(errorBody);
        } catch (e) {
            errorMsg = response.statusText || errorMsg;
        }
        throw new Error(`${errorMessagePrefix}: ${errorMsg}`);
    }
    return await response.json();
};

// ─────────────────────────────────────────────────────────────────────────────
//  fetchWorkerStatus() — เรียก GET /status เพื่อตรวจสอบว่า Worker พร้อมหรือไม่
//  ใช้ใน ConfigurationStatusModal ของ Admin
// ─────────────────────────────────────────────────────────────────────────────
export const fetchWorkerStatus = async (): Promise<WorkerStatus> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/status`);
        return await handleResponse(response, `ตรวจสอบสถานะ Worker ล้มเหลว`);
    } catch (error: any) {
        console.error(`[API] Fetch worker status error:`, error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  fetchRecipients() — เรียก GET /recipients เพื่อดูว่าแจ้งเตือนจะไปเข้ากลุ่มไหนบ้าง
//  ใช้ในหน้าตรวจสอบระบบของแอดมิน
// ─────────────────────────────────────────────────────────────────────────────
export const fetchRecipients = async (): Promise<NotificationRecipient[]> => {
    const response = await fetch(`${WORKER_BASE_URL}/recipients`, { headers: getApiHeaders() });
    const data = await handleResponse(response, 'ดึงรายชื่อผู้รับแจ้งเตือนล้มเหลว');
    return Array.isArray(data) ? data : [];
};

// ─────────────────────────────────────────────────────────────────────────────
//  fetchData(type) — ดึงข้อมูลทั้งหมดจาก KV
//  type = 'rooms'     → การจองห้องประชุม
//  type = 'equipment' → การยืมอุปกรณ์
// ─────────────────────────────────────────────────────────────────────────────
export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'GET',
            headers: getApiHeaders()
        });
        const data = await handleResponse(response, `ดึงข้อมูล ${type} ล้มเหลว`);
        // จำเลขรุ่นไว้แนบตอนบันทึก เพื่อให้ Worker รู้ว่าเราอ่านข้อมูลรุ่นไหนไป
        dataVersions[type] = response.headers.get('X-Data-Version');
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[API] Fetch error for type '${type}':`, error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  saveData(type, data, previousData?) — บันทึกข้อมูลทั้งหมดลง KV (overwrite)
//  ⚠️  ต้องส่ง array ทั้งหมด ไม่ใช่แค่รายการที่เปลี่ยน
//  previousData = state ก่อนแก้ ใช้รวมข้อมูลเมื่อมีคนบันทึกแทรก (ดูหัวข้อด้านบน)
//  return: array ที่บันทึกลงไปจริง, throw Error ถ้าล้มเหลว
// ─────────────────────────────────────────────────────────────────────────────
export const saveData = async <T extends Identifiable>(
    type: DataType,
    data: T[],
    previousData?: T[]
): Promise<T[]> => {
    let payload = data;

    // ลองได้มากสุด 3 รอบ กันกรณีชนกันซ้ำ ๆ ตอนหลายคนกดบันทึกพร้อมกัน
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const headers: Record<string, string> = { ...getApiHeaders() };
            if (dataVersions[type]) headers['X-Data-Version'] = dataVersions[type] as string;

            const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            // 409 = มีคนบันทึกแทรกเข้ามาก่อน — รวมข้อมูลแล้วลองใหม่
            if (response.status === 409) {
                const conflict = await response.json();
                dataVersions[type] = conflict.version ?? null;
                const serverData: T[] = Array.isArray(conflict.data) ? conflict.data : [];

                if (!previousData) {
                    // ไม่มี state ก่อนแก้ให้เทียบ — รวมไม่ได้ ต้องให้ผู้ใช้โหลดใหม่แล้วทำซ้ำ
                    throw new Error('มีคนอื่นเพิ่งบันทึกข้อมูลนี้ กรุณารีเฟรชหน้าแล้วทำรายการอีกครั้ง');
                }

                payload = mergeWithServerData(serverData, previousData, payload);
                console.warn(`[API] ข้อมูล ${type} ชนกัน — รวมข้อมูลแล้วบันทึกใหม่ (ครั้งที่ ${attempt})`);
                continue;
            }

            await handleResponse(response, `บันทึกข้อมูล ${type} ล้มเหลว`);
            dataVersions[type] = response.headers.get('X-Data-Version');
            return payload;
        } catch (error: any) {
            console.error(`[API] Save error for type '${type}':`, error);
            throw error;
        }
    }

    throw new Error(`บันทึกข้อมูล ${type} ไม่สำเร็จ: มีการแก้ไขจากผู้ใช้อื่นต่อเนื่อง กรุณาลองใหม่อีกครั้ง`);
};
