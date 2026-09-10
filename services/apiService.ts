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

/** หัวข้อแจ้งเตือนที่กลุ่มหนึ่งสมัครรับได้ (ตรงกับ ALL_TOPICS ใน cloudflare-worker.js) */
export type NotificationTopic = 'rooms' | 'repairs';

export const TOPIC_LABELS: Record<NotificationTopic, string> = {
    rooms: 'จองห้องประชุม',
    repairs: 'แจ้งซ่อม',
};

/** กลุ่ม/ผู้ใช้ LINE ที่จะได้รับแจ้งเตือน (ชื่อดึงสดจาก LINE ทุกครั้งที่เรียก) */
export interface NotificationRecipient {
    id: string;
    name: string | null;
    type: 'group' | 'user';
    /** false = บอทไม่ได้อยู่ในกลุ่มแล้ว (ถูกเตะออก) แต่ยังเก็บ Group ID ไว้ */
    active: boolean;
    /** หัวข้อที่กลุ่มนี้สมัครรับไว้ */
    topics: NotificationTopic[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  ตั๋วแอดมิน (Admin Token) — เก็บไว้ที่เครื่อง แล้วแนบไปกับงานของเจ้าหน้าที่
// ─────────────────────────────────────────────────────────────────────────────
//  ⚠️  เดิมหน้าเว็บจำสถานะแอดมินด้วย localStorage.isAdmin = 'true' เฉย ๆ
//      ใครเปิด DevTools พิมพ์บรรทัดนั้นเองก็เป็นแอดมินได้ทันที เพราะ Worker
//      ไม่เคยตรวจว่าคนเรียกเป็นแอดมินจริงไหม
//
//      ตอนนี้ /auth/login ตอบ "ตั๋ว" ที่ Worker เซ็นด้วย HMAC กลับมา หน้าเว็บเก็บ
//      ตั๋วไว้แล้วแนบไปทุกครั้งที่เรียกงานของแอดมิน — พิมพ์เองไม่ได้เพราะไม่รู้กุญแจ
//      ตัวปุ่ม/เมนูในหน้าเว็บยังซ่อนตามสถานะเหมือนเดิม แต่ตัวที่กันจริงคือฝั่ง Worker
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_TOKEN_EXPIRY_KEY = 'adminTokenExpiresAt';

/** ตั๋วที่ยังไม่หมดอายุ — คืน null ถ้าไม่มีหรือหมดอายุแล้ว (พร้อมล้างของเก่าทิ้ง) */
export const getAdminToken = (): string | null => {
    try {
        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        const expiresAt = Number(localStorage.getItem(ADMIN_TOKEN_EXPIRY_KEY));
        if (!token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            if (token) clearAdminToken();
            return null;
        }
        return token;
    } catch (e) {
        // localStorage ใช้ไม่ได้ (เช่น โหมด Private Browsing) — ถือว่ายังไม่ได้ล็อกอิน
        return null;
    }
};

export const storeAdminToken = (token: string, expiresAt: number): void => {
    try {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        localStorage.setItem(ADMIN_TOKEN_EXPIRY_KEY, String(expiresAt));
    } catch (e) { /* เก็บไม่ได้ก็ใช้ได้แค่รอบนี้ ไม่ต้อง throw */ }
};

export const clearAdminToken = (): void => {
    try {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_TOKEN_EXPIRY_KEY);
        localStorage.removeItem('isAdmin');   // ค่าเดิมจากเวอร์ชันก่อน — ล้างทิ้งด้วย
    } catch (e) { /* ไม่มีอะไรต้องทำ */ }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getApiHeaders() — สร้าง HTTP Headers สำหรับ request ที่ต้องการ Authentication
//  API Key อ่านมาจาก environment variable VITE_API_SECRET_KEY
//  (ตั้งค่าใน Cloudflare Pages Settings หรือไฟล์ .env.local สำหรับ dev)
//
//  ⚠️  API Key นี้ไม่ใช่ความลับ — Vite แทนค่า import.meta.env.VITE_* ลงในไฟล์ JS
//      ตอน build ใครเปิด DevTools ก็อ่านได้ มันกันได้แค่การเรียกแบบสุ่มจากภายนอก
//      ตัวที่กันงานของเจ้าหน้าที่จริง ๆ คือ X-Admin-Token ด้านล่าง
// ─────────────────────────────────────────────────────────────────────────────
const getApiHeaders = (): Record<string, string> => {
    // ⚠️  ลบ console.log ของ API Key ออกแล้ว (security fix)
    //     ไม่ควร log ค่า secret ออก console แม้ในโหมด dev
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': import.meta.env.VITE_API_SECRET_KEY,
    };
    const adminToken = getAdminToken();
    if (adminToken) headers['X-Admin-Token'] = adminToken;
    return headers;
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
        // /status ต้องเป็นแอดมินแล้ว — สถานะการตั้งค่าเป็นข้อมูลที่ไม่ควรเปิดสาธารณะ
        const response = await fetch(`${WORKER_BASE_URL}/status`, { headers: getApiHeaders() });
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
//  updateRecipientTopics(id, topics) — ตั้งว่ากลุ่มนี้รับแจ้งเตือนหัวข้ออะไรบ้าง
//  ส่ง [] = ไม่รับอะไรเลย (บอทยังอยู่ในกลุ่ม แต่เงียบ)
// ─────────────────────────────────────────────────────────────────────────────
export const updateRecipientTopics = async (id: string, topics: NotificationTopic[]): Promise<void> => {
    const response = await fetch(`${WORKER_BASE_URL}/recipients`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ id, topics }),
    });
    await handleResponse(response, 'บันทึกการตั้งค่าแจ้งเตือนล้มเหลว');
};

// ─────────────────────────────────────────────────────────────────────────────
//  deleteRecipient(id) — เอากลุ่มออกจากรายการถาวร (ใช้กับกลุ่มที่บอทไม่ได้อยู่แล้ว)
//  คืน warning เมื่อกลุ่มนั้นถูกตั้งไว้ใน REPAIR_GROUP_ID ของ Worker (จะกลับมาอีก)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteRecipient = async (id: string): Promise<{ warning?: string }> => {
    const response = await fetch(`${WORKER_BASE_URL}/recipients?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
    });
    return await handleResponse(response, 'ลบกลุ่มออกจากรายการล้มเหลว');
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
