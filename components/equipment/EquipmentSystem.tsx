
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
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchBorrowings = useCallback(async (isBackground = false) => {
        if (!isBackground) setIsLoading(true);
        try {
            const data = await fetchData('equipment') as BorrowingRequest[];
            setBorrowings(data);
            setLastUpdated(new Date());
        } catch (error: any) {
             if (!isBackground) {
                showToast(`โหลดข้อมูลการยืมไม่สำเร็จ: ${error.message}`, 'error');
                setBorrowings([]);
            }
            console.error("Background fetch failed:", error);
        } finally {
            if (!isBackground) setIsLoading(false);
        }
    }, [showToast]);

    // Initial fetch and polling
    useEffect(() => {
        fetchBorrowings();
        const pollInterval = setInterval(() => {
            fetchBorrowings(true); // Background fetch
        }, 30000); // Poll every 30 seconds

        return () => clearInterval(pollInterval);
    }, [fetchBorrowings]);

    // Status update interval
    useEffect(() => {
        const interval = setInterval(() => {
            const today = new Date().toISOString().split('T')[0];
            let hasChanged = false;
            const borrowingsToCheck = [...borrowings];
            const updatedBorrowings = borrowingsToCheck.map(b => {
                if (b.status === BorrowStatus.Borrowing && b.returnDate < today) {
                    hasChanged = true;
                    return { ...b, status: BorrowStatus.Overdue };
                }
                return b;
            });
            if (hasChanged) {
                saveData('equipment', updatedBorrowings).then(() => {
                    setBorrowings(updatedBorrowings);
                });
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
        
        try {
            await saveData('equipment', updatedBorrowings);
            setBorrowings(updatedBorrowings);
            setLastUpdated(new Date());

            const notifyMessage = `รายงานใหม่\n
📢 ขอยืมอุปกรณ์ใหม่
ผู้ยืม: ${createdRequest.borrowerName}
วัตถุประสงค์: ${createdRequest.purpose}
อุปกรณ์: ${createdRequest.equipmentList.substring(0, 50)}...`.trim();
            await sendLineNotification(notifyMessage);
            setCurrentPage('list');
            showToast('ส่งคำขอยืมอุปกรณ์สำเร็จ', 'success');
            fetchBorrowings(true); // Silent refresh
        } catch (error: any) {
            showToast(`บันทึกข้อมูลการยืมไม่สำเร็จ: ${error.message}`, 'error');
            fetchBorrowings(); // Revert on failure
        }
    }, [borrowings, showToast, fetchBorrowings]);

    const updateBorrowingList = async (newList: BorrowingRequest[]): Promise<boolean> => {
        try {
            await saveData('equipment', newList);
            setBorrowings(newList);
            setLastUpdated(new Date());
            fetchBorrowings(true); // Silent refresh for other clients
            return true;
        } catch (error: any) {
            showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            fetchBorrowings(); // Revert UI
            return false;
        }
    };

    const handleChangeStatus = useCallback(async (id: string, newStatus: BorrowStatus) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
            const updated = borrowings.map(b => b.id === id ? { ...b, status: newStatus } : b);
            const success = await updateBorrowingList(updated);
            if (success) {
                const notifyMessage = `รายงานใหม่\n
🔄 สถานะอัปเดต
ผู้ยืม: ${req.borrowerName}
สถานะใหม่: ${newStatus}`.trim();

                await sendLineNotification(notifyMessage);
                showToast(`อัปเดตสถานะเป็น "${newStatus}" เรียบร้อย`, 'success');
            }
        }
    }, [borrowings, showToast, fetchBorrowings]);

    const handleCancelRequest = useCallback(async (id: string) => {
        const req = borrowings.find(b => b.id === id);
        if (req) {
             const updated = borrowings.map(b => b.id === id ? { ...b, status: BorrowStatus.Cancelled } : b);
             const success = await updateBorrowingList(updated);
             if (success) {
                const notifyMessage = `รายงานใหม่\n
❌ ยกเลิกการยืม
ผู้ยืม: ${req.borrowerName}
วัตถุประสงค์: ${req.purpose}`.trim();
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
                    lastUpdated={lastUpdated}
                />;
        }
    };
    
    return <div>{renderCurrentPage()}</div>;
};

export default EquipmentSystem;