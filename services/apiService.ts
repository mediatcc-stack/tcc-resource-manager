import { Booking, BorrowingRequest } from '../types';
import { WORKER_BASE_URL } from '../constants';

type DataType = 'rooms' | 'equipment';

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

export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        await handleResponse(response, `บันทึกข้อมูล ${type} ล้มเหลว`);
        return true;
    } catch (error: any) {
        console.error(`[API] Save error for type '${type}':`, error);
        throw error;
    }
};

// --- New Functions for LINE Group Management ---

export const fetchGroups = async (): Promise<string[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/groups`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await handleResponse(response, `ดึงข้อมูล Group ID ล้มเหลว`);
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[API] Fetch groups error:`, error);
        throw error;
    }
};

export const saveGroups = async (groups: string[]): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groups),
        });
        await handleResponse(response, `บันทึกข้อมูล Group ID ล้มเหลว`);
        return true;
    } catch (error: any) {
        console.error(`[API] Save groups error:`, error);
        throw error;
    }
};

export const fetchGroupIdLog = async (): Promise<{id: string, name: string, detectedAt: string}[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/group-id-log`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await handleResponse(response, `ดึงข้อมูล Log ของ Group ID ล้มเหลว`);
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`[API] Fetch Group ID Log error:`, error);
        throw error;
    }
};

export const clearGroupIdLog = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/group-id-log`, {
            method: 'DELETE',
        });
        await handleResponse(response, `ล้างข้อมูล Log ของ Group ID ล้มเหลว`);
        return true;
    } catch (error: any) {
        console.error(`[API] Clear Group ID Log error:`, error);
        throw error;
    }
};