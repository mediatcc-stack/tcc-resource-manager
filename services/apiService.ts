import { Booking, BorrowingRequest } from '../types';

// ใช้ URL ของ Worker จาก Cloudflare โดยตรงเพื่อความเสถียรหลังจากย้ายโดเมน mediatcc.com ออก
// ตรวจสอบชื่อ Worker ในหน้า Cloudflare Workers ของคุณว่าชื่อ 'tcc-line-notifier' ถูกต้องหรือไม่
const WORKER_BASE_URL = 'https://tcc-line-notifier.media-tcc.workers.dev';

type DataType = 'rooms' | 'equipment';

const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) {
            // response might not be JSON
        }
        throw new Error(`${errorMessagePrefix}: ${errorMsg}`);
    }
    return response.json();
};

export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        return await handleResponse(response, `ดึงข้อมูล ${type} ไม่สำเร็จ`);
    } catch (error) {
        console.error(`[apiService] Fetch error for ${type}:`, error);
        throw error;
    }
};

export const saveData = async (type: DataType, data: Booking[] | BorrowingRequest[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ไม่สำเร็จ`);
        return true;
    } catch (error) {
        console.error(`[apiService] Save error for ${type}:`, error);
        throw error;
    }
};

export const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${WORKER_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });
        const result = await handleResponse(response, 'อัปโหลดไฟล์ไม่สำเร็จ');
        if (!result.url) {
            throw new Error('อัปโหลดสำเร็จแต่ไม่พบ URL ในการตอบกลับ');
        }
        return result.url;
    } catch (error) {
        console.error('[apiService] Upload error:', error);
        throw error;
    }
};