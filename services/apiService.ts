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
 *  saveData('rooms', [...])     → เขียนทับ KV key "rooms_data" ทั้งหมด
 *  saveData('equipment', [...]) → เขียนทับ KV key "equipment_data" ทั้งหมด
 *
 *  ⚠️  saveData ทำงานแบบ overwrite ทั้งหมด ไม่ใช่ append!
 *      ต้องส่ง array ทั้งหมดที่ต้องการบันทึก ไม่ใช่แค่รายการที่เปลี่ยน
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Booking, BorrowingRequest } from '../types';
import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment';

export interface WorkerStatus {
    lineApiToken: boolean;
    roomKvBinding: boolean;
    equipmentKvBinding: boolean;
    recipientIdSet: boolean;
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
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[API] Fetch error for type '${type}':`, error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  saveData(type, data) — บันทึกข้อมูลทั้งหมดลง KV (overwrite)
//  ⚠️  ต้องส่ง array ทั้งหมด ไม่ใช่แค่รายการที่เปลี่ยน
//  return true ถ้าสำเร็จ, throw Error ถ้าล้มเหลว
// ─────────────────────────────────────────────────────────────────────────────
export const saveData = async (type: DataType, data: Booking[] | BorrowingRequest[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ล้มเหลว`);
        return true;
    } catch (error: any) {
        console.error(`[API] Save error for type '${type}':`, error);
        throw error;
    }
};
