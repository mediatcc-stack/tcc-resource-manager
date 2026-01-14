
import React, { useState, useCallback, useEffect } from 'react';
import { EquipmentPage, BorrowingRequest, BorrowStatus } from '../../types';
import BorrowingListPage from './BorrowingListPage';
import BorrowingFormPage from './BorrowingFormPage';
import { sendLineNotification } from '../../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

const MOCK_BORROWINGS: BorrowingRequest[] = [
    // state will hold data
];


const EquipmentSystem: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<EquipmentPage>('list');
    const [borrowings, setBorrowings] = useState<BorrowingRequest[]>(MOCK_BORROWINGS);

    useEffect(() => {
        const interval = setInterval(() => {
            const today = new Date().toISOString().split('T')[0];
            setBorrowings(prev => 
                prev.map(b => {
                    if (b.status === BorrowStatus.Borrowing && b.returnDate < today) {
                        return { ...b, status: BorrowStatus.Overdue };
                    }
                    return b;
                })
            );
        }, 60 * 60 * 1000); // Check every hour
        return () => clearInterval(interval);
    }, []);

    const handleFormSubmit = useCallback(async (newRequest: Omit<BorrowingRequest, 'id' | 'createdAt' | 'status'>) => {
        const createdRequest: BorrowingRequest = {
            ...newRequest,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            status: BorrowStatus.Pending,
        };
        setBorrowings(prev => [createdRequest, ...prev]);

        const notifyMessage = `ขอยืมอุปกรณ์ใหม่:\nผู้ยืม: ${createdRequest.borrowerName}\nอุปกรณ์: ${createdRequest.equipmentList.substring(0, 50)}...`;
        await sendLineNotification(notifyMessage);
        setCurrentPage('list');
    }, []);

    const handleChangeStatus = useCallback(async (id: string, newStatus: BorrowStatus) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
            setBorrowings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
            const notifyMessage = `สถานะการยืม #${id.substring(0,4)} อัปเดตเป็น: ${newStatus}\nผู้ยืม: ${req.borrowerName}`;
            await sendLineNotification(notifyMessage);
        }
    }, [borrowings]);

    const handleCancelRequest = useCallback(async (id: string) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
            // We'll mark as returned to effectively remove it from active lists
             setBorrowings(prev => prev.map(b => b.id === id ? { ...b, status: BorrowStatus.Returned } : b));
            const notifyMessage = `ยกเลิกการยืม: #${id.substring(0,4)}\nผู้ยืม: ${req.borrowerName}`;
            await sendLineNotification(notifyMessage);
        }
    }, [borrowings]);


    const renderCurrentPage = () => {
        switch(currentPage) {
            case 'form':
                return <BorrowingFormPage onSubmit={handleFormSubmit} onCancel={() => setCurrentPage('list')} />;
            case 'list':
            default:
                return <BorrowingListPage 
                    borrowings={borrowings} 
                    onNewRequest={() => setCurrentPage('form')}
                    onChangeStatus={handleChangeStatus}
                    onCancelRequest={handleCancelRequest}
                />;
        }
    };
    
    return <div>{renderCurrentPage()}</div>;
};

export default EquipmentSystem;
