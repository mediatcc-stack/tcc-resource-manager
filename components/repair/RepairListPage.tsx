

import React, { useState, useMemo } from 'react';
import { RepairRequest, RepairStatus } from '../../types';
import RepairCard from './RepairCard';
import SubTabs from '../shared/SubTabs';
import { Search, RotateCcw, RefreshCw, Inbox, ShieldCheck, ChevronDown } from 'lucide-react';

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

    const tabCounts = useMemo(() => ({
        current: repairs.filter(r => r.status === RepairStatus.Pending || r.status === RepairStatus.InProgress).length,
        history: repairs.filter(r => r.status === RepairStatus.Completed).length,
    }), [repairs]);

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

    const inputClasses = "w-full px-3 py-2 bg-surface-container-low rounded-lg font-body text-body-md text-on-surface placeholder-outline focus:outline-none focus:bg-surface-container-lowest transition-colors";
    const labelClasses = "font-label text-label-sm text-on-surface-variant";

    return (
        <div className="space-y-space-md">
            {/* ── แท็บย่อย: งานที่ยังไม่เสร็จ / ประวัติ ── */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <SubTabs
                    tabs={[
                        { key: 'current', label: 'รายการที่ยังไม่เสร็จ', count: tabCounts.current, emphasis: true },
                        { key: 'history', label: 'ประวัติการซ่อม',       count: tabCounts.history },
                    ]}
                    activeKey={activeTab}
                    onSelect={setActiveTab}
                />
                {isAdmin && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-container text-on-success-container font-label text-label-sm animate-fade-in">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        โหมดผู้ดูแลระบบ
                    </span>
                )}
            </div>

            {/* ── ค้นหาและตัวกรอง ── */}
            <div className="bg-surface-container-lowest rounded-xl shadow-card p-space-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-space-sm items-end">
                    <div className="lg:col-span-4 flex flex-col gap-1.5">
                        <label className={labelClasses} htmlFor="repair-search">ค้นหาชื่อ</label>
                        <div className="relative flex items-center">
                            <Search className="w-4 h-4 absolute left-3 text-outline pointer-events-none" />
                            <input
                                id="repair-search"
                                type="text"
                                placeholder="ชื่อผู้แจ้ง..."
                                value={nameFilter}
                                onChange={e => setNameFilter(e.target.value)}
                                className={`${inputClasses} pl-9`}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-1.5">
                        <label className={labelClasses} htmlFor="repair-month">เดือน</label>
                        <div className="relative">
                            <select id="repair-month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={`${inputClasses} appearance-none pr-8`}>
                                <option value="all">ทุกเดือน</option>
                                {thaiMonths.map((m, i) => <option key={i} value={(i + 1).toString()}>{m}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-1.5">
                        <label className={labelClasses} htmlFor="repair-year">ปี</label>
                        <div className="relative">
                            <select id="repair-year" value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={`${inputClasses} appearance-none pr-8`}>
                                <option value="all">ทุกปี</option>
                                {years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                        </div>
                    </div>

                    <div className="lg:col-span-3 flex flex-col gap-1.5">
                        <label className={labelClasses} htmlFor="repair-status">สถานะ</label>
                        <div className="relative">
                            <select id="repair-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputClasses} appearance-none pr-8`}>
                                <option value="ทั้งหมด">ทั้งหมด</option>
                                {Object.values(RepairStatus).filter(s => (activeTab === 'current' ? s !== RepairStatus.Completed : s === RepairStatus.Completed)).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label text-label-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>ล้าง</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-space-sm min-h-[400px]">
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
                    <div className="text-center py-24 bg-surface-container-lowest rounded-xl shadow-card">
                        <Inbox className="w-12 h-12 mx-auto text-outline-variant mb-3" />
                        <p className="font-heading text-headline-sm text-on-surface">ไม่พบรายการ</p>
                        <p className="font-body text-body-sm text-on-surface-variant mt-1">ยังไม่มีรายการแจ้งซ่อมในช่วงเวลาที่เลือก</p>
                    </div>
                )}
            </div>
            {lastUpdated && (
                <div className="flex items-center justify-center gap-2 text-outline font-label text-label-sm py-space-sm">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>อัปเดตข้อมูลล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')} น.</span>
                </div>
            )}
        </div>
    );
};

export default RepairListPage;
