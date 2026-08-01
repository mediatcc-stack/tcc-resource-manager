

import React, { useState, useMemo } from 'react';
import { RepairRequest, RepairStatus } from '../../types';
import Button from '../shared/Button';
import RepairCard from './RepairCard';

interface RepairListPageProps {
    repairs: RepairRequest[];
    onChangeStatus: (id: string, newStatus: RepairStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyAgain: (req: RepairRequest) => void;
    onEditRequest: (req: RepairRequest) => void;
    myRepairIds: string[];
    lastUpdated: Date | null;
    isAdmin: boolean;
}

const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const RepairListPage: React.FC<RepairListPageProps> = ({ repairs, onChangeStatus, onDeleteRequest, onNotifyAgain, onEditRequest, myRepairIds, lastUpdated, isAdmin }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [nameFilter, setNameFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        repairs.forEach(r => yearsSet.add(new Date(r.createdAt).getFullYear().toString()));
        yearsSet.add(new Date().getFullYear().toString());
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [repairs]);

    const clearFilters = () => {
        setNameFilter('');
        setMonthFilter('all');
        setYearFilter(new Date().getFullYear().toString());
        setStatusFilter('ทั้งหมด');
    };

    const filteredRepairs = useMemo(() => {
        const repairsInTab = repairs.filter(r => {
            if (activeTab === 'current') {
                return r.status === RepairStatus.Pending || r.status === RepairStatus.InProgress;
            }
            return r.status === RepairStatus.Completed;
        });

        const filtered = repairsInTab.filter(r => {
            const rDate = new Date(r.createdAt);
            const nameMatch = nameFilter ? r.requesterName.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const statusMatch = statusFilter !== 'ทั้งหมด' ? r.status === statusFilter : true;
            const monthMatch = monthFilter === 'all' || (rDate.getMonth() + 1).toString() === monthFilter;
            const yearMatch = yearFilter === 'all' || rDate.getFullYear().toString() === yearFilter;
            return nameMatch && statusMatch && monthMatch && yearMatch;
        });

        return filtered.sort((a, b) => {
            if (activeTab === 'current') {
                const priorityRank: Record<string, number> = { 'ด่วนที่สุด': 1, 'ด่วน': 2, 'ปกติ': 3 };
                const statusRank: Record<string, number> = {
                    [RepairStatus.InProgress]: 1,
                    [RepairStatus.Pending]: 2,
                };
                const orderA = statusRank[a.status] || 99;
                const orderB = statusRank[b.status] || 99;
                if (orderA !== orderB) return orderA - orderB;
                const prA = priorityRank[a.priority] || 99;
                const prB = priorityRank[b.priority] || 99;
                if (prA !== prB) return prA - prB;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [repairs, activeTab, nameFilter, monthFilter, yearFilter, statusFilter]);

    const inputClasses = "w-full rounded-lg border border-gray-200 bg-white p-2.5 text-gray-800 transition-all placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('current')}
                        className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'current' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        รายการที่ยังไม่เสร็จ
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        ประวัติการซ่อม
                    </button>
                </div>
                {isAdmin && <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-sm animate-fade-in">✅ โหมดผู้ดูแลระบบ</span>}
            </div>

            <div className="pb-4 mb-4 border-b border-gray-200">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-grow min-w-[150px]"><label className="text-[10px] font-bold text-gray-400 px-1">ค้นหาชื่อ</label><input type="text" placeholder="ชื่อผู้แจ้ง..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className={inputClasses}/></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">เดือน</label><select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}><option value="all">ทุกเดือน</option>{thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">ปี</label><select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}><option value="all">ทุกปี</option>{years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">สถานะ</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClasses}>
                            <option value="ทั้งหมด">ทั้งหมด</option>
                            {Object.values(RepairStatus).filter(s => (activeTab === 'current' ? s !== RepairStatus.Completed : s === RepairStatus.Completed)).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary" size="sm" className="h-[42px] px-4">ล้าง</Button>
                </div>
            </div>

            <div className="space-y-4 min-h-[400px]">
                {filteredRepairs.length > 0 ? (
                    filteredRepairs.map(req =>
                        <RepairCard
                            key={req.id}
                            req={req}
                            onChangeStatus={onChangeStatus}
                            onDeleteRequest={onDeleteRequest}
                            onNotifyAgain={onNotifyAgain}
                            onEdit={onEditRequest}
                            isAdmin={isAdmin}
                            isMine={myRepairIds.includes(req.id)}
                        />
                    )
                ) : (
                    <div className="text-center text-gray-500 py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-xl font-semibold">ไม่พบรายการ</p>
                        <p className="text-sm mt-2">ยังไม่มีรายการแจ้งซ่อมในช่วงเวลาที่เลือก</p>
                    </div>
                )}
            </div>
            {lastUpdated && (
                <div className="text-center text-xs text-gray-400 font-medium mt-4">
                    อัปเดตข้อมูลล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')} น.
                </div>
            )}
        </div>
    );
};

export default RepairListPage;
