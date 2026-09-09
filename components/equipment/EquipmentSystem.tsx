

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
import SystemToolbar from '../shared/SystemToolbar';
import { useSystemPage, useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { ClipboardList, BarChart3, Plus } from 'lucide-react';
import { APP_URL } from '../../constants';

interface EquipmentSystemProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  isAdmin: boolean;
}

const EquipmentSystem: React.FC<EquipmentSystemProps> = ({ showToast, isAdmin }) => {
    // แท็บที่เปิดอยู่เก็บไว้ที่ SwipeNavigationProvider เพื่อให้ปัดข้ามระบบได้ต่อเนื่อง
    // (หน้า 'form' เป็นฟอร์ม ไม่อยู่ในลำดับการปัด — ระบบจะปิดการปัดให้เอง)
    const [currentPage, setCurrentPage] = useSystemPage<EquipmentPage>('/equipment', 'list');
    const [borrowings, setBorrowings] = useState<BorrowingRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
    const [editingRequest, setEditingRequest] = useState<BorrowingRequest | null>(null);
    const [myBorrowingIds, setMyBorrowingIds] = useState<string[]>(() => getMyBorrowingIds());

    const pollTimer = useRef<number | null>(null);

    const { showSwipeHint } = useSwipeNavigation();

    // ออกจากหน้าฟอร์ม (กดแท็บหรือปัด) ต้องล้างรายการที่กำลังแก้ไขทิ้ง กันข้อมูลค้าง
    useEffect(() => {
        if (currentPage !== 'form') setEditingRequest(null);
    }, [currentPage]);

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
                <div className="flex flex-col items-center justify-center h-64 bg-surface-container-lowest rounded-xl shadow-card">
                    <LoadingSpinner />
                    <p className="mt-4 font-heading text-headline-sm text-on-surface-variant">กำลังดึงข้อมูลการยืมล่าสุด...</p>
                </div>
            );
        }
        
        if (error && borrowings.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-surface-container-lowest rounded-xl shadow-card text-center p-10">
                    <div className="w-20 h-20 bg-error-container rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">🔌</span>
                    </div>
                    <p className="font-heading text-headline-lg text-error mb-4">โหลดข้อมูลไม่สำเร็จ</p>
                    <div className="bg-error-container/40 p-4 rounded-lg mb-8 max-w-md mx-auto">
                        <p className="font-body text-body-md text-on-error-container break-words leading-relaxed">
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
        <div className="mb-20">
            <SystemToolbar
                tabs={[
                    { key: 'list',       label: 'รายการยืมทั้งหมด', icon: <ClipboardList className="w-4 h-4" /> },
                    { key: 'statistics', label: 'สถิติการยืม',      icon: <BarChart3 className="w-4 h-4" /> },
                ]}
                activeKey={currentPage === 'form' ? 'list' : currentPage}
                onSelect={setCurrentPage}
                connectionStatus={connectionStatus}
                swipeHint={showSwipeHint}
                action={{
                    label: 'ขอยืมอุปกรณ์',
                    icon: <Plus className="w-4 h-4" />,
                    onClick: () => { setEditingRequest(null); setCurrentPage('form'); },
                }}
            />
            {renderCurrentPage()}
        </div>
    );
};

export default EquipmentSystem;
