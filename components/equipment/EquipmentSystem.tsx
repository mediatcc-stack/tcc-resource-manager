

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EquipmentPage, BorrowingRequest, BorrowStatus } from '../../types';
import BorrowingListPage from './BorrowingListPage';
import BorrowingFormPage from './BorrowingFormPage';
import BorrowingStatisticsPage from './BorrowingStatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { fetchData, saveData } from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from '../shared/LoadingSpinner';
import Button from '../shared/Button';
import { APP_URL } from '../../constants';

interface EquipmentSystemProps {
  onBackToLanding: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  isAdmin: boolean;
}

const EquipmentSystem: React.FC<EquipmentSystemProps> = ({ onBackToLanding, showToast, isAdmin }) => {
    const [currentPage, setCurrentPage] = useState<EquipmentPage>('list');
    const [borrowings, setBorrowings] = useState<BorrowingRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const pollTimer = useRef<number | null>(null);

    const fetchBorrowings = useCallback(async (isBackground = false) => {
        if (!isBackground) {
            setIsLoading(true);
            setError(null);
        } else {
            setIsSyncing(true);
        }
        
        try {
            const data = await fetchData('equipment') as BorrowingRequest[];
            setBorrowings(data);
            setLastUpdated(new Date());
            setError(null);
        } catch (error: any) {
            const errorMessage = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
            if (!isBackground) {
               setError(errorMessage);
               showToast(errorMessage, 'error');
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

    const updateBorrowingList = async (newList: BorrowingRequest[]): Promise<boolean> => {
        try {
            await saveData('equipment', newList);
            setBorrowings(newList);
            setLastUpdated(new Date());
            fetchBorrowings(true);
            return true;
        } catch (error: any) {
            showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            fetchBorrowings(true);
            return false;
        }
    };

    const handleChangeStatus = useCallback(async (id: string, newStatus: BorrowStatus) => {
        const updated = borrowings.map(b => b.id === id ? { ...b, status: newStatus } : b);
        if (await updateBorrowingList(updated)) showToast('เปลี่ยนสถานะเรียบร้อย', 'success');
    }, [borrowings]);

    const handleDeleteRequest = useCallback(async (id: string) => {
        const updated = borrowings.filter(b => b.id !== id);
        if (await updateBorrowingList(updated)) showToast('ลบรายการถาวรแล้ว', 'success');
    }, [borrowings]);

    const handleNotifyOverdue = useCallback(async (req: BorrowingRequest) => {
        const msg = `⚠️ แจ้งเตือน: เลยกำหนดคืนอุปกรณ์\n\n👤 ผู้ยืม: ${req.borrowerName}\n📦 อุปกรณ์: ${req.equipmentList}\n🗓️ กำหนดคืน: ${new Date(req.returnDate).toLocaleDateString('th-TH')}\n\n🚩 กรุณาติดต่อคืนอุปกรณ์ที่งานสื่อฯ โดยด่วนครับ`;
        try {
            await sendLineNotification(msg);
            showToast('ส่งแจ้งเตือน LINE สำเร็จ', 'success');
        } catch (e) {
            showToast('ส่งแจ้งเตือนไม่สำเร็จ', 'error');
        }
    }, [showToast]);

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

            const borrowDateStr = new Date(createdRequest.borrowDate).toLocaleDateString('th-TH');
            const returnDateStr = new Date(createdRequest.returnDate).toLocaleDateString('th-TH');

            const notifyMessage = `📋 แจ้งเตือนยืมอุปกรณ์ใหม่\n\n👤 ผู้ยืม: ${createdRequest.borrowerName}\n📞 เบอร์โทร: ${createdRequest.phone || '-'}\n🎯 เรื่อง: ${createdRequest.purpose}\n📅 ระยะเวลา: ${borrowDateStr} ถึง ${returnDateStr}\n\n📦 รายการอุปกรณ์:\n${createdRequest.equipmentList}\n\n🌐 ตรวจสอบ: ${APP_URL}`;

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
                <div className="flex flex-col items-center justify-center h-96">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg font-semibold text-gray-500">กำลังโหลดข้อมูลการยืม...</p>
                </div>
            );
        }
        
        if (error && borrowings.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl shadow-xl text-center p-4">
                    <p className="text-4xl mb-4 text-red-500">⚠️</p>
                    <p className="text-xl font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</p>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <Button onClick={() => fetchBorrowings(false)}>ลองใหม่อีกครั้ง</Button>
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
                    <BorrowingListPage 
                        borrowings={borrowings}
                        onChangeStatus={handleChangeStatus}
                        onDeleteRequest={handleDeleteRequest}
                        onNotifyOverdue={handleNotifyOverdue}
                        showToast={showToast}
                        lastUpdated={lastUpdated}
                        isAdmin={isAdmin}
                    />
                );
        }
    };
    
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
             <div className="bg-white rounded-2xl shadow-lg p-5 flex items-center justify-between gap-6 flex-wrap border border-gray-100">
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={() => setCurrentPage('list')}
                        className={`font-bold px-5 py-2.5 rounded-lg transition-all text-sm ${currentPage === 'list' ? 'bg-[#0D448D] text-white shadow' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                       📋 รายการยืมทั้งหมด
                    </Button>
                     <Button 
                        onClick={() => setCurrentPage('statistics')}
                        className={`font-bold px-5 py-2.5 rounded-lg transition-all text-sm ${currentPage === 'statistics' ? 'bg-[#0D448D] text-white shadow' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                       📊 สถิติการยืม
                    </Button>
                </div>
                <Button onClick={() => setCurrentPage('form')} variant="primary" className="shadow-lg">
                    + ขอยืมอุปกรณ์
                </Button>
             </div>
             <div>
                {renderCurrentPage()}
             </div>
        </div>
    );
};

export default EquipmentSystem;