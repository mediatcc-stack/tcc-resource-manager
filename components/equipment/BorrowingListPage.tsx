

import React, { useState, useMemo } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { CONTACTS } from '../../constants';
import BorrowingCard from './BorrowingCard';

interface BorrowingListPageProps {
    borrowings: BorrowingRequest[];
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyOverdue: (req: BorrowingRequest) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    lastUpdated: Date | null;
    isAdmin: boolean;
}

const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const BorrowingListPage: React.FC<BorrowingListPageProps> = ({ borrowings, onChangeStatus, onDeleteRequest, onNotifyOverdue, showToast, lastUpdated, isAdmin }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [nameFilter, setNameFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        borrowings.forEach(b => {
            const year = new Date(b.borrowDate).getFullYear().toString();
            yearsSet.add(year);
        });
        yearsSet.add(new Date().getFullYear().toString());
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [borrowings]);

    const clearFilters = () => {
        setNameFilter('');
        setMonthFilter('all');
        setYearFilter(new Date().getFullYear().toString());
        setStatusFilter('ทั้งหมด');
    };

    const filteredBorrowings = useMemo(() => {
        const borrowingsInTab = borrowings.filter(b => {
            if (activeTab === 'current') {
                return b.status === BorrowStatus.Pending || 
                       b.status === BorrowStatus.Borrowing || 
                       b.status === BorrowStatus.Overdue;
            } else {
                return b.status === BorrowStatus.Returned || 
                       b.status === BorrowStatus.Cancelled;
            }
        });

        const filtered = borrowingsInTab.filter(b => {
            const bDate = new Date(b.borrowDate);
            const nameMatch = nameFilter ? b.borrowerName.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const statusMatch = statusFilter !== 'ทั้งหมด' ? b.status === statusFilter : true;
            const monthMatch = monthFilter === 'all' || (bDate.getMonth() + 1).toString() === monthFilter;
            const yearMatch = yearFilter === 'all' || bDate.getFullYear().toString() === yearFilter;
            
            return nameMatch && statusMatch && monthMatch && yearMatch;
        });

        return filtered.sort((a, b) => {
            if (activeTab === 'current') {
                const priority = {
                    [BorrowStatus.Overdue]: 1,
                    [BorrowStatus.Borrowing]: 2,
                    [BorrowStatus.Pending]: 3,
                    [BorrowStatus.Returned]: 4,
                    [BorrowStatus.Cancelled]: 5,
                };
                const orderA = priority[a.status] || 99;
                const orderB = priority[b.status] || 99;
                
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.borrowDate).getTime() - new Date(b.borrowDate).getTime();
            } else {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    }, [borrowings, activeTab, nameFilter, monthFilter, yearFilter, statusFilter]);
    
    const inputClasses = "w-full rounded-lg border border-gray-200 bg-white p-2.5 text-gray-800 transition-all placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('current')}
                        className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'current' ? 'bg-white text-[#0D448D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        รายการปัจจุบัน
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-[#0D448D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        ประวัติการยืม
                    </button>
                </div>
                {isAdmin && <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-sm animate-fade-in">✅ โหมดผู้ดูแลระบบ</span>}
            </div>

            <div className="pb-4 mb-4 border-b border-gray-200">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-grow min-w-[150px]"><label className="text-[10px] font-bold text-gray-400 px-1">ค้นหาชื่อ</label><input type="text" placeholder="ชื่อผู้ยืม..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className={inputClasses}/></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">เดือน</label><select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}><option value="all">ทุกเดือน</option>{thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">ปี</label><select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}><option value="all">ทุกปี</option>{years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">สถานะ</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClasses}>
                            <option value="ทั้งหมด">ทั้งหมด</option>
                            {Object.values(BorrowStatus).filter(s => (activeTab === 'current' ? (s !== BorrowStatus.Returned && s !== BorrowStatus.Cancelled) : (s === BorrowStatus.Returned || s === BorrowStatus.Cancelled))).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary" size="sm" className="h-[42px] px-4">ล้าง</Button>
                </div>
            </div>

            <div className="space-y-4 min-h-[400px]">
                {filteredBorrowings.length > 0 ? (
                    filteredBorrowings.map(req => 
                        <BorrowingCard 
                            key={req.id}
                            req={req}
                            onChangeStatus={onChangeStatus}
                            onDeleteRequest={onDeleteRequest}
                            onNotifyOverdue={onNotifyOverdue}
                            isAdmin={isAdmin}
                        />
                    )
                ) : (
                    <div className="text-center text-gray-500 py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-xl font-semibold">ไม่พบรายการ</p>
                        <p className="text-sm mt-2">
                            ยังไม่มีรายการยืมในช่วงเวลาที่เลือก
                        </p>
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

export default BorrowingListPage;