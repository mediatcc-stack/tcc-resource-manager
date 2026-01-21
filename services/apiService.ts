import { Booking, BorrowingRequest } from '../types';
import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment';

const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
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
            mode: 'cors', // เพิ่มโหมด CORS ให้ชัดเจน
            headers: { 
                'Accept': 'application/json'
            }
        });
        const data = await handleResponse(response, `ดึงข้อมูล ${type} ไม่สำเร็จ`);
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[apiService] Fetch error for ${type}:`, error);
        throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (Network Error) โปรดตรวจสอบการ Deploy โค้ดใน Cloudflare Worker');
    }
};

export const saveData = async (type: DataType, data: Booking[] | BorrowingRequest[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ไม่สำเร็จ`);
        return true;
    } catch (error: any) {
        console.error(`[apiService] Save error for ${type}:`, error);
        throw error;
    }
};

export const uploadFile = async (file: File): Promise<string> => {
    // ระบบอัปโหลดไฟล์ (หากยังไม่ได้ผูก R2 ใน Dashboard จะยังใช้งานไม่ได้ แต่จะไม่ทำให้ระบบหลักล่ม)
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`${WORKER_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });
        const result = await handleResponse(response, 'อัปโหลดไฟล์ไม่สำเร็จ');
        return result.url;
    } catch (error) {
        throw error;
    }
};