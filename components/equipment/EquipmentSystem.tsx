
import React, { useState, useCallback, useEffect } from 'react';
import { EquipmentPage, BorrowingRequest, BorrowStatus } from '../../types';
import BorrowingListPage from './BorrowingListPage';
import BorrowingFormPage from './BorrowingFormPage';
import { sendLineNotification } from '../../services/notificationService';
import { fetchData, saveData } from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from '../shared/LoadingSpinner';

interface EquipmentSystemProps {
  onBackToLanding: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const EquipmentSystem: React.FC<EquipmentSystemProps> = ({ onBackToLanding, showToast }) => {
    const [currentPage, setCurrentPage] = useState<EquipmentPage>('list');
    const [borrowings, setBorrowings] = useState<BorrowingRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBorrowings = useCallback(async () => {
        setIsLoading(true);
        const data = await fetchData('equipment') as BorrowingRequest[];
        setBorrowings(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchBorrowings();
    }, [fetchBorrowings]);

    useEffect(() => {
        const interval = setInterval(() => {
            const today = new Date().toISOString().split('T')[0];
            let hasChanged = false;
            const updatedBorrowings = borrowings.map(b => {
                if (b.status === BorrowStatus.Borrowing && b.returnDate < today) {
                    hasChanged = true;
                    return { ...b, status: BorrowStatus.Overdue };
                }
                return b;
            });
            if (hasChanged) {
                setBorrowings(updatedBorrowings);
                saveData('equipment', updatedBorrowings);
            }
        }, 60 * 60 * 1000); // Check every hour
        return () => clearInterval(interval);
    }, [borrowings]);

    const handleFormSubmit = useCallback(async (newRequestData: Omit<BorrowingRequest, 'id' | 'createdAt' | 'status'>) => {
        const createdRequest: BorrowingRequest = {
            ...newRequestData,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            status: BorrowStatus.Pending,
        };
        const updatedBorrowings = [createdRequest, ...borrowings];
        setBorrowings(updatedBorrowings);
        const success = await saveData('equipment', updatedBorrowings);

        if(success) {
            const notifyMessage = `รายงานใหม่\n\nขอยืมอุปกรณ์ใหม่:\nผู้ยืม: ${createdRequest.borrowerName}\nอุปกรณ์: ${createdRequest.equipmentList.substring(0, 50)}...`;
            await sendLineNotification(notifyMessage);
            setCurrentPage('list');
            showToast('ส่งคำขอยืมอุปกรณ์สำเร็จ', 'success');
        } else {
            showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
            await fetchBorrowings();
        }
    }, [borrowings, showToast, fetchBorrowings]);

    const updateBorrowingStatus = async (updatedBorrowings: BorrowingRequest[]) => {
        setBorrowings(updatedBorrowings);
        const success = await saveData('equipment', updatedBorrowings);
        if (!success) {
            showToast('เกิดข้อผิดพลาดในการอัปเดตข้อมูล', 'error');
            await fetchBorrowings();
        }
        return success;
    };


    const handleChangeStatus = useCallback(async (id: string, newStatus: BorrowStatus) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
            const updated = borrowings.map(b => b.id === id ? { ...b, status: newStatus } : b);
            const success = await updateBorrowingStatus(updated);
            if (success) {
                const notifyMessage = `รายงานใหม่\n\nสถานะการยืม #${id.substring(0,4)} อัปเดตเป็น: ${newStatus}\nผู้ยืม: ${req.borrowerName}`;
                await sendLineNotification(notifyMessage);
                showToast(`อัปเดตสถานะเป็น "${newStatus}" เรียบร้อย`, 'success');
            }
        }
    }, [borrowings, showToast, fetchBorrowings]);

    const handleCancelRequest = useCallback(async (id: string) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
             const updated = borrowings.map(b => b.id === id ? { ...b, status: BorrowStatus.Returned, notes: (b.notes || '') + ' (ผู้ใช้ยกเลิก)' } : b);
             const success = await updateBorrowingStatus(updated);
             if (success) {
                const notifyMessage = `รายงานใหม่\n\nยกเลิกการยืม: #${id.substring(0,4)}\nผู้ยืม: ${req.borrowerName}`;
                await sendLineNotification(notifyMessage);
                showToast('ยกเลิกคำขอยืมเรียบร้อยแล้ว', 'success');
             }
        }
    }, [borrowings, showToast, fetchBorrowings]);


    const renderCurrentPage = () => {
        if (isLoading) {
             return (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg font-semibold text-gray-600">กำลังโหลดข้อมูลการยืม...</p>
                </div>
            );
        }

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
                    onBackToLanding={onBackToLanding}
                    showToast={showToast}
                />;
        }
    };
    
    return <div>{renderCurrentPage()}</div>;
};

export default EquipmentSystem;
