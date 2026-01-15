
import { Booking, BorrowingRequest } from '../types';

const WORKER_BASE_URL = 'https://tcc-line-notifier.media-tcc.workers.dev';

type DataType = 'rooms' | 'equipment';

/**
 * A helper function to handle fetch responses.
 * If the response is not OK, it attempts to parse a JSON error from the body.
 * This provides more specific error messages from the worker.
 */
const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์! สถานะ: ${response.status}` }));
        throw new Error(`${errorMessagePrefix}: ${errorBody.error || response.statusText}`);
    }
    return response.json();
};


// --- Data Fetching and Saving ---

export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`);
        return await handleResponse(response, `ดึงข้อมูล ${type} ไม่สำเร็จ`);
    } catch (error) {
        console.error(`[apiService] Error fetching ${type} data:`, error);
        throw error; // Re-throw for the component to catch and display
    }
};

export const saveData = async (type: DataType, data: Booking[] | BorrowingRequest[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ไม่สำเร็จ`);
        return true;
    } catch (error) {
        console.error(`[apiService] Error saving ${type} data:`, error);
        throw error; // Re-throw for the component to catch
    }
};


// --- File Uploading ---

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
            throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ไม่พบ URL ในการตอบกลับ');
        }
        return result.url;
    } catch (error) {
        console.error('[apiService] Error uploading file:', error);
        throw error; // Re-throw for the component to catch
    }
};