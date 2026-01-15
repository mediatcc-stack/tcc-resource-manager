
import { Booking, BorrowingRequest } from '../types';

const WORKER_BASE_URL = 'https://tcc-line-notifier.media-tcc.workers.dev';

type DataType = 'rooms' | 'equipment';

// --- Data Fetching and Saving ---

export const fetchData = async (type: DataType): Promise<any[]> => {
    try {
        const response = await fetch(`${WORKER_BASE_URL}/data?type=${type}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${type} data`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${type} data:`, error);
        return [];
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
        if (!response.ok) {
            throw new Error(`Failed to save ${type} data`);
        }
        return true;
    } catch (error) {
        console.error(`Error saving ${type} data:`, error);
        return false;
    }
};


// --- File Uploading ---

export const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${WORKER_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('File upload failed');
        }

        const result = await response.json();
        return result.url;
    } catch (error) {
        console.error('Error uploading file:', error);
        return null;
    }
};