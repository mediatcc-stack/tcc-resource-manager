import { Booking, BorrowingRequest } from '../types';
import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment';

const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) { }
        throw new Error(`${errorMessagePrefix}: ${errorMsg}`);
    }
    return await response.json();
};

export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await handleResponse(response, `ดึงข้อมูล ${type} ล้มเหลว`);
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[API] Fetch error:`, error);
        throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาเช็คการ Bind KV ใน Cloudflare');
    }
};

export const saveData = async (type: DataType, data: Booking[] | BorrowingRequest[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ล้มเหลว`);
        return true;
    } catch (error: any) {
        console.error(`[API] Save error:`, error);
        throw error;
    }
};