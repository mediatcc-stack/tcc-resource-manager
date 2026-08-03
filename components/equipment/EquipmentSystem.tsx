

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EquipmentPage, BorrowingRequest, BorrowStatus } from '../../types';
import BorrowingListPage from './BorrowingListPage';
import BorrowingFormPage from './BorrowingFormPage';
import BorrowingStatisticsPage from './BorrowingStatisticsPage';
import { fetchData, saveData } from '../../services/apiService';
import { addMyBorrowingId, getMyBorrowingIds } from '../../services/myBorrowingsStorage';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from '../shared/LoadingSpinner';
import Button from '../shared/Button';
import { APP_URL } from '../../constants';

interface EquipmentSystemProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  isAdmin: boolean;
}

const EquipmentSystem: React.FC<EquipmentSystemProps> = ({ showToast, isAdmin }) => {
    const [currentPage, setCurrentPage] = useState<EquipmentPage>('list');
    const [borrowings, setBorrowings] = useState<BorrowingRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
    const [editingRequest, setEditingRequest] = useState<BorrowingRequest | null>(null);
    const [myBorrowingIds, setMyBorrowingIds] = useState<string[]>(() => getMyBorrowingIds());

    const pollTimer = useRef<number | null>(null);

    const fetchBorrowings = useCallback(async (isBackground = false) => {
        if (!isBackground) {
            setIsLoading(true);
            setError(null);
        } else {
            setIsSyncing(true);
            setConnectionStatus('syncing');
        }
        
        try {
            const data = await fetchData('equipment') as BorrowingRequest[];
            setBorrowings(data);
            setLastUpdated(new Date());
            setError(null);
            setConnectionStatus('connected');
        } catch (error: any) {
            const errorMessage = error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
            setConnectionStatus('error');
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
        setConnectionStatus('syncing');
        try {
            await saveData('equipment', newList);
            setBorrowings(newList);
            setLastUpdated(new Date());
            setConnectionStatus('connected');
            fetchBorrowings(true);
            return true;
        } catch (error: any) {
            setConnectionStatus('error');
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

    const handleEditRequest = useCallback((req: BorrowingRequest) => {
        setEditingRequest(req);
        setCurrentPage('form');
    }, []);

    const handleFormCancel = useCallback(() => {
        setEditingRequest(null);
        setCurrentPage('list');
    }, []);

    const handleFormSubmit = useCallback(async (formValues: Omit<BorrowingRequest, 'id' | 'createdAt' | 'status'>) => {
        // โหมดแก้ไขคำขอเดิม (จากเจ้าของรายการหรือแอดมิน) — อัปเดตข้อมูลในตำแหน่งเดิม ไม่สร้างรายการใหม่
        if (editingRequest) {
            const updatedBorrowings = borrowings.map(b => b.id === editingRequest.id ? { ...b, ...formValues } : b);
            try {
                await saveData('equipment', updatedBorrowings);
                setBorrowings(updatedBorrowings);
                setLastUpdated(new Date());
                setCurrentPage('list');
                setEditingRequest(null);
                showToast('บันทึกการแก้ไขเรียบร้อย', 'success');
                fetchBorrowings(true);
            } catch (error: any) {
                showToast(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            }
            return;
        }

        const createdRequest: BorrowingRequest = {
            ...formValues,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            status: BorrowStatus.Pending,
        };
        const updatedBorrowings = [createdRequest, ...borrowings];

        try {
            await saveData('equipment', updatedBorrowings);
            setBorrowings(updatedBorrowings);
            setLastUpdated(new Date());

            // จำไว้ว่ารายการนี้เป็นของผู้ใช้เครื่องนี้ (เบราว์เซอร์นี้) เพื่อให้กลับมาแก้ไขเองได้ทีหลัง
            addMyBorrowingId(createdRequest.id);
            setMyBorrowingIds(prev => [...prev, createdRequest.id]);

            setCurrentPage('list');
            showToast('ส่งคำขอยืมอุปกรณ์สำเร็จ', 'success');
            fetchBorrowings(true);
        } catch (error: any) {
            showToast(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
        }
    }, [borrowings, showToast, fetchBorrowings, editingRequest]);
    
    const renderCurrentPage = () => {
        if (isLoading) {
             return (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg font-semibold text-gray-600">กำลังดึงข้อมูลการยืมล่าสุด...</p>
                </div>
            );
        }
        
        if (error && borrowings.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl shadow-xl text-center p-10 border-2 border-red-50">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">🔌</span>
                    </div>
                    <p className="text-2xl font-black text-red-600 mb-4">โหลดข้อมูลไม่สำเร็จ</p>
                    <div className="bg-red-50 p-4 rounded-xl mb-8 max-w-md mx-auto">
                        <p className="text-sm text-red-700 font-medium break-words leading-relaxed">
                           {error}
                        </p>
                    </div>
                    <Button onClick={() => fetchBorrowings(false)}>🔄 ลองใหม่อีกครั้ง</Button>
                </div>
            );
        }

        switch(currentPage) {
            case 'form':
                return <BorrowingFormPage onSubmit={handleFormSubmit} onCancel={handleFormCancel} editingRequest={editingRequest} />;
            case 'statistics':
                return <BorrowingStatisticsPage borrowings={borrowings} onBack={() => setCurrentPage('list')} />;
            case 'list':
            default:
                return (
                    <BorrowingListPage
                        borrowings={borrowings}
                        onChangeStatus={handleChangeStatus}
                        onDeleteRequest={handleDeleteRequest}
                        onEditRequest={handleEditRequest}
                        myBorrowingIds={myBorrowingIds}
                        showToast={showToast}
                        lastUpdated={lastUpdated}
                        isAdmin={isAdmin}
                    />
                );
        }
    };
    
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in mb-20">
             <div className="bg-white rounded-2xl shadow-lg p-4 flex items-center justify-between gap-6 flex-wrap border border-gray-100">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage('list')}
                        className={`font-bold px-5 py-2.5 rounded-xl transition-all text-xs cursor-pointer ${currentPage === 'list' ? 'bg-primary text-white shadow' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                       📋 รายการยืมทั้งหมด
                    </button>
                     <button 
                        onClick={() => setCurrentPage('statistics')}
                        className={`font-bold px-5 py-2.5 rounded-xl transition-all text-xs cursor-pointer ${currentPage === 'statistics' ? 'bg-primary text-white shadow' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                       📊 สถิติการยืม
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    {/* Connection Status Badge สม่ำเสมอเหมือนระบบจองห้อง */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 shadow-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                            connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                            connectionStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 
                            'bg-red-500'
                        }`}></span>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                            {connectionStatus === 'connected' ? 'เชื่อมต่อแล้ว' : 
                             connectionStatus === 'syncing' ? 'กำลังซิงค์...' : 
                             'ไม่ได้เชื่อมต่อ'}
                        </span>
                    </div>

                    <Button onClick={() => { setEditingRequest(null); setCurrentPage('form'); }} variant="primary" className="shadow-lg" size="sm">
                        + ขอยืมอุปกรณ์
                    </Button>
                </div>
             </div>
             <div>
                {renderCurrentPage()}
             </div>
        </div>
    );
};

export default EquipmentSystem;