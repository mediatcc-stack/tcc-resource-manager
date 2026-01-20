import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EquipmentPage, BorrowingRequest, BorrowStatus } from '../../types';
import BorrowingListPage from './BorrowingListPage';
import BorrowingFormPage from './BorrowingFormPage';
import BorrowingStatisticsPage from './BorrowingStatisticsPage';
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    
    const pollTimer = useRef<number | null>(null);

    const fetchBorrowings = useCallback(async (isBackground = false) => {
        if (!isBackground) setIsLoading(true);
        else setIsSyncing(true);
        
        try {
            const data = await fetchData('equipment') as BorrowingRequest[];
            setBorrowings(data);
            setLastUpdated(new Date());
        } catch (error: any) {
             if (!isBackground) {
                showToast(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            }
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
        }
    }, [showToast]);

    useEffect(() => {
        const startPolling = () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
            pollTimer.current = window.setInterval(() => {
                if (!document.hidden) {
                    fetchBorrowings(true);
                }
            }, 30000);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (pollTimer.current) {
                    clearInterval(pollTimer.current);
                    pollTimer.current = null;
                }
            } else {
                fetchBorrowings(true);
                startPolling();
            }
        };

        fetchBorrowings();
        startPolling();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [fetchBorrowings]);

    useEffect(() => {
        const interval = window.setInterval(() => {
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
                saveData('equipment', updatedBorrowings).then(() => {
                    setBorrowings(updatedBorrowings);
                });
            }
        }, 60 * 60 * 1000); 
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

            const notifyMessage = [
                "------",
                "📢 มีคำขอยืมอุปกรณ์ใหม่",
                "",
                `ผู้ยืม: ${createdRequest.borrowerName}`,
                `อุปกรณ์: ${createdRequest.equipmentList}`,
                "------"
            ].join('\n');

            await sendLineNotification(notifyMessage);
            setCurrentPage('list');
            showToast('ส่งคำขอยืมอุปกรณ์สำเร็จ', 'success');
            fetchBorrowings(true);
        } catch (error: any) {
            showToast(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
        }
    }, [borrowings, showToast, fetchBorrowings]);

    const renderCurrentPage = () => {
        if (isLoading) {
             return (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg font-semibold text-gray-600">กำลังโหลด...</p>
                </div>
            );
        }

        switch(currentPage) {
            case 'form':
                return <BorrowingFormPage onSubmit={handleFormSubmit} onCancel={() => setCurrentPage('list')} />;
            case 'statistics':
                return <BorrowingStatisticsPage borrowings={borrowings} onBack={() => setCurrentPage('list')} />;
            case 'list':
            default:
                return (
                    <div className="relative">
                        {isSyncing && (
                            <div className="absolute -top-4 right-0 flex items-center gap-2 text-[10px] font-black text-blue-500 animate-pulse uppercase">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                Live Refreshing...
                            </div>
                        )}
                        <BorrowingListPage 
                            borrowings={borrowings} 
                            onNewRequest={() => setCurrentPage('form')}
                            onViewStats={() => setCurrentPage('statistics')}
                            onChangeStatus={async (id, s) => { /* logic */ }}
                            onDeleteRequest={async (id) => { /* logic */ }}
                            onNotifyOverdue={async (r) => { /* logic */ }}
                            onBackToLanding={onBackToLanding}
                            showToast={showToast}
                            lastUpdated={lastUpdated}
                        />
                    </div>
                );
        }
    };
    
    return <div>{renderCurrentPage()}</div>;
};

export default EquipmentSystem;