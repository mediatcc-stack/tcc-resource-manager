import React, { useState, useMemo } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { STAFF_PASSWORDS, CONTACTS } from '../../constants';
import BorrowingCard from './BorrowingCard';

interface BorrowingListPageProps {
    borrowings: BorrowingRequest[];
    onNewRequest: () => void;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onCancelRequest: (id: string) => void;
    onBackToLanding: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    lastUpdated: Date | null;
}

const BorrowingListPage: React.FC<BorrowingListPageProps> = ({ borrowings, onNewRequest, onChangeStatus, onCancelRequest, onBackToLanding, showToast, lastUpdated }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');

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
        setDateFilter('');
        setStatusFilter('ทั้งหมด');
    };

    const filteredBorrowings = useMemo(() => {
        // Sort by active status first, then by creation date
        const sorted = [...borrowings].sort((a, b) => {
            const statusOrder = {
                [BorrowStatus.Pending]: 1,
                [BorrowStatus.Borrowing]: 2,
                [BorrowStatus.Overdue]: 3,
                [BorrowStatus.Returned]: 4,
                [BorrowStatus.Cancelled]: 5,
            };
            
            const orderA = statusOrder[a.status] || 99;
            const orderB = statusOrder[b.status] || 99;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return sorted.filter(b => {
            const nameMatch = nameFilter ? b.borrowerName.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const dateMatch = dateFilter ? b.borrowDate === dateFilter || b.returnDate === dateFilter : true;
            const statusMatch = statusFilter !== 'ทั้งหมด' ? b.status === statusFilter : true;
            return nameMatch && dateMatch && statusMatch;
        });
    }, [borrowings, nameFilter, dateFilter, statusFilter]);
    
    const inputClasses = "block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button onClick={onBackToLanding} variant="secondary">
                        ← กลับหน้าหลัก
                    </Button>
                    <div className="flex items-center gap-3">
                       <span className="text-2xl">📋</span>
                       <h2 className="text-2xl font-bold text-gray-800">รายการขอยืมทั้งหมด</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-sm">Admin Mode</span>}
                    <Button onClick={handleAdminLogin} variant="secondary">
                      {isAdmin ? 'ปิดโหมด' : '🔑 เจ้าหน้าที่'}
                    </Button>
                    <Button onClick={onNewRequest} variant="primary">
                        + ขอยืมอุปกรณ์
                    </Button>
                </div>
            </div>

            {/* Contacts Box */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
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

            {/* Filters Box */}
            <div className="bg-gray-100 p-5 rounded-2xl border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-1">🔍 ค้นหาชื่อผู้ยืม</label>
                        <input type="text" placeholder="ค้นหา..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-1">🗓️ กรองตามวันที่ยืม</label>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={inputClasses} />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-1">📊 กรองตามสถานะ</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClasses} >
                            <option value="ทั้งหมด">ทั้งหมด</option>
                            {Object.values(BorrowStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary">🔄 ล้างตัวกรอง</Button>
                </div>
            </div>

            {/* Borrowing List */}
            <div className="space-y-4">
                {filteredBorrowings.length > 0 ? (
                    filteredBorrowings.map(req => 
                        <BorrowingCard 
                            key={req.id}
                            req={req}
                            isAdmin={isAdmin}
                            onChangeStatus={onChangeStatus}
                            onCancelRequest={onCancelRequest}
                        />
                    )
                ) : (
                    <div className="text-center text-gray-500 py-20 bg-white rounded-2xl shadow-sm">
                        <p className="text-xl font-semibold">ไม่พบรายการขอยืม</p>
                        <p className="text-sm mt-2">{nameFilter || dateFilter || statusFilter !== 'ทั้งหมด' ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีการขอยืมอุปกรณ์ในระบบ'}</p>
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
