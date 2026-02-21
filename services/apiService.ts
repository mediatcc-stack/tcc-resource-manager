import { Booking, BorrowingRequest } from '../types';
import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment';

export interface WorkerStatus {
    lineApiToken: boolean;
    roomKvBinding: boolean;
    equipmentKvBinding: boolean;
    recipientIdSet: boolean;
}

const getApiHeaders = () => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_SECRET_KEY,
});

const handleResponse = async (response: Response, errorMessagePrefix: string): Promise<any> => {
    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || JSON.stringify(errorBody);
        } catch (e) {
            // Could not parse JSON, use status text or default message
            errorMsg = response.statusText || errorMsg;
        }
        throw new Error(`${errorMessagePrefix}: ${errorMsg}`);
    }
    return await response.json();
};

export const fetchWorkerStatus = async (): Promise<WorkerStatus> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/status`);
        return await handleResponse(response, `ตรวจสอบสถานะ Worker ล้มเหลว`);
    } catch (error: any) {
        console.error(`[API] Fetch worker status error:`, error);
        throw error;
    }
}

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
        throw error; // Re-throw the original, more descriptive error
    }
};

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