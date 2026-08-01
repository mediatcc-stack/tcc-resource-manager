

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RepairPage, RepairRequest, RepairStatus } from '../../types';
import RepairListPage from './RepairListPage';
import RepairFormPage from './RepairFormPage';
import RepairStatisticsPage from './RepairStatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { fetchData, saveData } from '../../services/apiService';
import { addMyRepairId, getMyRepairIds } from '../../services/myRepairsStorage';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from '../shared/LoadingSpinner';
import Button from '../shared/Button';

interface RepairSystemProps {
    showToast: (message: string, type: 'success' | 'error') => void;
    isAdmin: boolean;
}

const RepairSystem: React.FC<RepairSystemProps> = ({ showToast, isAdmin }) => {
    const [currentPage, setCurrentPage] = useState<RepairPage>('list');
    const [repairs, setRepairs] = useState<RepairRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
    const [editingRequest, setEditingRequest] = useState<RepairRequest | null>(null);
    const [myRepairIds, setMyRepairIds] = useState<string[]>(() => getMyRepairIds());

    const pollTimer = useRef<number | null>(null);

    const fetchRepairs = useCallback(async (isBackground = false) => {
        if (!isBackground) {
            setIsLoading(true);
            setError(null);
        } else {
            setIsSyncing(true);
            setConnectionStatus('syncing');
        }

        try {
            const data = await fetchData('repairs') as RepairRequest[];
            setRepairs(data);
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
                    fetchRepairs(true);
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
                fetchRepairs(true);
                startPolling();
            }
        };

        fetchRepairs();
        startPolling();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [fetchRepairs]);

    const updateRepairList = async (newList: RepairRequest[]): Promise<boolean> => {
        setConnectionStatus('syncing');
        try {
            await saveData('repairs', newList);
            setRepairs(newList);
            setLastUpdated(new Date());
            setConnectionStatus('connected');
            fetchRepairs(true);
            return true;
        } catch (error: any) {
            setConnectionStatus('error');
            showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            fetchRepairs(true);
            return false;
        }
    };

    const handleChangeStatus = useCallback(async (id: string, newStatus: RepairStatus) => {
        const updated = repairs.map(r => r.id === id ? { ...r, status: newStatus } : r);
        if (await updateRepairList(updated)) showToast('เปลี่ยนสถานะเรียบร้อย', 'success');
    }, [repairs]);

    const handleDeleteRequest = useCallback(async (id: string) => {
        const updated = repairs.filter(r => r.id !== id);
        if (await updateRepairList(updated)) showToast('ลบรายการถาวรแล้ว', 'success');
    }, [repairs]);

    const handleNotifyAgain = useCallback(async (req: RepairRequest) => {
        const priorityTag = req.priority === 'ด่วนที่สุด' ? '🔥 ด่วนที่สุด! ' : '';
        const msg = `🔔 แจ้งเตือนซ้ำ: งานแจ้งซ่อมค้างดำเนินการ\n\n${priorityTag}👤 ผู้แจ้ง: ${req.requesterName} (${req.department})\n📍 ห้อง/สถานที่: ${req.roomName}\n🔧 ประเภทปัญหา: ${req.problemType}\n📝 ${req.description}\n\n🚩 กรุณาดำเนินการโดยด่วนครับ`;
        try {
            await sendLineNotification(msg);
            showToast('ส่งแจ้งเตือน LINE สำเร็จ', 'success');
        } catch (e) {
            showToast('ส่งแจ้งเตือนไม่สำเร็จ', 'error');
        }
    }, [showToast]);

    const handleEditRequest = useCallback((req: RepairRequest) => {
        setEditingRequest(req);
        setCurrentPage('form');
    }, []);

    const handleFormCancel = useCallback(() => {
        setEditingRequest(null);
        setCurrentPage('list');
    }, []);

    const handleFormSubmit = useCallback(async (formValues: Omit<RepairRequest, 'id' | 'createdAt' | 'status'>) => {
        // โหมดแก้ไขคำขอเดิม (จากเจ้าของรายการหรือแอดมิน) — อัปเดตข้อมูลในตำแหน่งเดิม ไม่สร้างรายการใหม่
        if (editingRequest) {
            const updatedRepairs = repairs.map(r => r.id === editingRequest.id ? { ...r, ...formValues } : r);
            try {
                await saveData('repairs', updatedRepairs);
                setRepairs(updatedRepairs);
                setLastUpdated(new Date());
                setCurrentPage('list');
                setEditingRequest(null);
                showToast('บันทึกการแก้ไขเรียบร้อย', 'success');
                fetchRepairs(true);
            } catch (error: any) {
                showToast(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
            }
            return;
        }

        const createdRequest: RepairRequest = {
            ...formValues,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            status: RepairStatus.Pending,
        };
        const updatedRepairs = [createdRequest, ...repairs];

        try {
            await saveData('repairs', updatedRepairs);
            setRepairs(updatedRepairs);
            setLastUpdated(new Date());

            // จำไว้ว่ารายการนี้เป็นของผู้ใช้เครื่องนี้ (เบราว์เซอร์นี้) เพื่อให้กลับมาแก้ไขเองได้ทีหลัง
            addMyRepairId(createdRequest.id);
            setMyRepairIds(prev => [...prev, createdRequest.id]);

            const priorityTag = createdRequest.priority === 'ด่วนที่สุด' ? '🔥 ด่วนที่สุด! ' : '';
            const notifyMessage = `🛠️ แจ้งซ่อมอุปกรณ์ไอที\n${priorityTag}ความเร่งด่วน: ${createdRequest.priority}\n\n👤 ผู้แจ้ง: ${createdRequest.requesterName} (${createdRequest.department})\n📍 ห้อง/สถานที่: ${createdRequest.roomName}\n🔧 ประเภทปัญหา: ${createdRequest.problemType}\n📝 ${createdRequest.description}`;

            await sendLineNotification(notifyMessage);
            setCurrentPage('list');
            showToast('ส่งแจ้งซ่อมสำเร็จ', 'success');
            fetchRepairs(true);
        } catch (error: any) {
            showToast(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
        }
    }, [repairs, showToast, fetchRepairs, editingRequest]);

    const renderCurrentPage = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg font-semibold text-gray-600">กำลังดึงข้อมูลแจ้งซ่อมล่าสุด...</p>
                </div>
            );
        }

        if (error && repairs.length === 0) {
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
                    <Button onClick={() => fetchRepairs(false)}>🔄 ลองใหม่อีกครั้ง</Button>
                </div>
            );
        }

        switch (currentPage) {
            case 'form':
                return <RepairFormPage onSubmit={handleFormSubmit} onCancel={handleFormCancel} editingRequest={editingRequest} />;
            case 'statistics':
                return <RepairStatisticsPage repairs={repairs} onBack={() => setCurrentPage('list')} />;
            case 'list':
            default:
                return (
                    <RepairListPage
                        repairs={repairs}
                        onChangeStatus={handleChangeStatus}
                        onDeleteRequest={handleDeleteRequest}
                        onNotifyAgain={handleNotifyAgain}
                        onEditRequest={handleEditRequest}
                        myRepairIds={myRepairIds}
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
                        📋 รายการแจ้งซ่อมทั้งหมด
                    </button>
                    <button
                        onClick={() => setCurrentPage('statistics')}
                        className={`font-bold px-5 py-2.5 rounded-xl transition-all text-xs cursor-pointer ${currentPage === 'statistics' ? 'bg-primary text-white shadow' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                        📊 สถิติการแจ้งซ่อม
                    </button>
                </div>
                <div className="flex items-center gap-4">
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
                        + แจ้งซ่อมอุปกรณ์
                    </Button>
                </div>
            </div>
            <div>
                {renderCurrentPage()}
            </div>
        </div>
    );
};

export default RepairSystem;
