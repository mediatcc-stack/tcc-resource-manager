import React, { useState, useMemo } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { STAFF_PASSWORDS, CONTACTS } from '../../constants';
import BorrowingCard from './BorrowingCard';

interface BorrowingListPageProps {
    borrowings: BorrowingRequest[];
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyOverdue: (req: BorrowingRequest) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    lastUpdated: Date | null;
}

const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const BorrowingListPage: React.FC<BorrowingListPageProps> = ({ borrowings, onChangeStatus, onDeleteRequest, onNotifyOverdue, showToast, lastUpdated }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [nameFilter, setNameFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');

    // สร้างรายการปีที่มีข้อมูลยืมจริงในระบบ
    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        borrowings.forEach(b => {
            const year = new Date(b.borrowDate).getFullYear().toString();
            yearsSet.add(year);
        });
        yearsSet.add(new Date().getFullYear().toString());
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [borrowings]);

    const handleAdminLogin = () => {
        if (isAdmin) {
            setIsAdmin(false);
            showToast('ออกจากโหมดแอดมิน', 'success');
            return;
        }
        const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
        if (password && STAFF_PASSWORDS.includes(password)) {
            setIsAdmin(true);
            showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
        } else if (password) {
            showToast('รหัสผ่านไม่ถูกต้อง', 'error');
        }
    };

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
            
            // กรองตามเดือนและปี
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
    
    const inputClasses = "block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm";

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
                <div className="flex items-center gap-2">
                    {isAdmin && <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-sm">Admin</span>}
                    <Button onClick={handleAdminLogin} variant="secondary" size="sm">
                      {isAdmin ? 'ปิดโหมด' : '🔑 เจ้าหน้าที่'}
                    </Button>
                </div>
            </div>

            {activeTab === 'current' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                        <span className="text-xl">📞</span>
                        สามารถติดต่อสอบถามอุปกรณ์เพิ่มเติมได้ที่
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {CONTACTS.map((contact, index) => (
                            <div key={index} className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                                <p className="font-semibold text-gray-700 text-sm">{contact.name}</p>
                                <p className="text-xs text-gray-500">{contact.position}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters Box */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">🔍 ค้นหาชื่อ</label>
                        <input type="text" placeholder="ชื่อผู้ยืม..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className={inputClasses}/>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">🗓️ เดือนที่ยืม</label>
                        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}>
                            <option value="all">ทุกเดือน</option>
                            {thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">📅 ปี พ.ศ.</label>
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}>
                            <option value="all">ทุกปี</option>
                            {years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">📊 สถานะ</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClasses} >
                            <option value="ทั้งหมด">ทั้งหมด</option>
                            {Object.values(BorrowStatus)
                                .filter(s => {
                                    if (activeTab === 'current') return s !== BorrowStatus.Returned && s !== BorrowStatus.Cancelled;
                                    return s === BorrowStatus.Returned || s === BorrowStatus.Cancelled;
                                })
                                .map(s => <option key={s} value={s}>{s}</option>)
                            }
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary" className="w-full">🔄 ล้างค่า</Button>
                </div>
            </div>

            {/* Borrowing List */}
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
                            ลองเปลี่ยนตัวกรองเดือนหรือปี หรือชื่อผู้ยืมใหม่อีกครั้ง
                        </p>
                    </div>
                )}
            </div>
             {lastUpdated && (
                <div className="text-center text-xs text-gray-400 font-medium mt-4">
                    อัปเดตข้อมูลล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
                </div>
            )}
        </div>
    );
};

export default BorrowingListPage;