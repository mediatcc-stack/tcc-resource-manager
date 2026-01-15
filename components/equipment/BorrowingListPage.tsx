
import React, { useState } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { STAFF_PASSWORDS } from '../../constants';

interface BorrowingListPageProps {
    borrowings: BorrowingRequest[];
    onNewRequest: () => void;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onCancelRequest: (id: string) => void;
    onBackToLanding: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    lastUpdated: Date | null;
}

const getStatusClass = (status: BorrowStatus) => {
    switch(status) {
        case BorrowStatus.Pending: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case BorrowStatus.Borrowing: return 'bg-blue-100 text-blue-800 border-blue-200';
        case BorrowStatus.Returned: return 'bg-green-100 text-green-800 border-green-200';
        case BorrowStatus.Overdue: return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const StatusActions: React.FC<{
    req: BorrowingRequest;
    isAdmin: boolean;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
}> = ({ req, isAdmin, onChangeStatus }) => {
    if (!isAdmin || req.status === BorrowStatus.Returned) return null;

    const handleStatusChange = (newStatus: BorrowStatus) => {
        if (confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${newStatus}"?`)) {
            onChangeStatus(req.id, newStatus);
        }
    };

    return (
        <div className="flex gap-2 mt-2">
            {req.status === BorrowStatus.Pending && <Button size="sm" variant="primary" onClick={() => handleStatusChange(BorrowStatus.Borrowing)}>อนุมัติให้ยืม</Button>}
            {(req.status === BorrowStatus.Borrowing || req.status === BorrowStatus.Overdue) && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(BorrowStatus.Returned)}>รับคืนแล้ว</Button>}
        </div>
    );
}

const BorrowingListPage: React.FC<BorrowingListPageProps> = ({ borrowings, onNewRequest, onChangeStatus, onCancelRequest, onBackToLanding, showToast, lastUpdated }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    
    const handleAdminLogin = () => {
        const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
        if (password && STAFF_PASSWORDS.includes(password)) {
            setIsAdmin(true);
            showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
        } else if (password) {
            showToast('รหัสผ่านไม่ถูกต้อง', 'error');
        }
    };
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-5 border-b border-gray-200 gap-4">
                <div className="flex items-center gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-[#0D448D]">ระบบยืม-คืนอุปกรณ์</h2>
                        <p className="text-gray-500 mt-1">จัดการคำขอยืมและติดตามสถานะอุปกรณ์ทั้งหมด</p>
                     </div>
                     {isAdmin && (
                        <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-md">
                            โหมดแอดมิน
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                     <Button onClick={onBackToLanding} variant="secondary">← กลับหน้าหลัก</Button>
                     {!isAdmin && <Button onClick={handleAdminLogin}>🔑 แอดมิน</Button>}
                </div>
            </div>
            
             <div className="flex justify-between items-center mb-6">
                {lastUpdated && (
                    <div className="text-xs text-gray-400 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
                    </div>
                )}
                 <Button onClick={onNewRequest} variant="primary" className="ml-auto">
                    + สร้างคำขอยืมใหม่
                </Button>
             </div>


            <div className="space-y-4">
                {borrowings.length === 0 ? <p className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">ยังไม่มีรายการยืม</p> : null}
                {borrowings.map(req => (
                    <div key={req.id} className={`bg-white p-4 rounded-xl border-l-4 ${getStatusClass(req.status).split(' ')[2].replace('border-','border-l-')}`}>
                        <div className="flex justify-between items-start flex-wrap gap-2">
                             <div>
                                <p className="font-semibold text-gray-800">ผู้ยืม: {req.borrowerName} ({req.department})</p>
                                <p className="text-sm text-gray-600">วันที่ยืม: {new Date(req.borrowDate).toLocaleDateString('th-TH')} - คืน: {new Date(req.returnDate).toLocaleDateString('th-TH')}</p>
                                <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded-md">อุปกรณ์: {req.equipmentList}</p>
                             </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusClass(req.status)}`}>{req.status}</span>
                        </div>
                        <div className="flex justify-end mt-2">
                           <StatusActions req={req} isAdmin={isAdmin} onChangeStatus={onChangeStatus} />
                           {req.status === BorrowStatus.Pending && !isAdmin && (
                               <Button size="sm" variant="danger" onClick={() => {
                                   if(confirm('คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่?')) {
                                       onCancelRequest(req.id);
                                   }
                               }}>ยกเลิก</Button>
                           )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BorrowingListPage;
