
import React, { useState } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { ADMIN_PASSWORDS } from '../../constants';

interface BorrowingListPageProps {
    borrowings: BorrowingRequest[];
    onNewRequest: () => void;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onCancelRequest: (id: string) => void;
}

const BorrowingListPage: React.FC<BorrowingListPageProps> = ({ borrowings, onNewRequest, onChangeStatus, onCancelRequest }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    
    const handleAdminLogin = () => {
        const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
        if (password && ADMIN_PASSWORDS.includes(password)) {
            setIsAdmin(true);
        } else if (password) {
            alert('รหัสผ่านไม่ถูกต้อง');
        }
    };

    const getStatusClass = (status: BorrowStatus) => {
        switch(status) {
            case BorrowStatus.Pending: return 'bg-yellow-100 text-yellow-800';
            case BorrowStatus.Borrowing: return 'bg-blue-100 text-blue-800';
            case BorrowStatus.Returned: return 'bg-green-100 text-green-800';
            case BorrowStatus.Overdue: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const StatusActions: React.FC<{req: BorrowingRequest}> = ({ req }) => {
        if (!isAdmin || req.status === BorrowStatus.Returned) return null;

        const handleStatusChange = (newStatus: BorrowStatus) => {
            if (confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${newStatus}"?`)) {
                onChangeStatus(req.id, newStatus);
            }
        };

        return (
            <div className="flex gap-2 mt-2">
                {req.status === BorrowStatus.Pending && <Button variant="primary" onClick={() => handleStatusChange(BorrowStatus.Borrowing)}>อนุมัติให้ยืม</Button>}
                {req.status === BorrowStatus.Borrowing && <Button variant="secondary" onClick={() => handleStatusChange(BorrowStatus.Returned)}>รับคืนแล้ว</Button>}
                {req.status === BorrowStatus.Overdue && <Button variant="secondary" onClick={() => handleStatusChange(BorrowStatus.Returned)}>รับคืนแล้ว</Button>}
            </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">รายการยืม-คืนอุปกรณ์</h2>
                    <p className="text-gray-500">จัดการคำขอยืมและติดตามสถานะอุปกรณ์</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={onNewRequest} variant="primary">สร้างคำขอยืมใหม่</Button>
                    {!isAdmin && <Button onClick={handleAdminLogin} variant="secondary">แอดมิน</Button>}
                </div>
            </div>

            <div className="space-y-4">
                {borrowings.length === 0 ? <p className="text-center text-gray-500 py-8">ยังไม่มีรายการยืม</p> : null}
                {borrowings.map(req => (
                    <div key={req.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-semibold text-gray-800">ผู้ยืม: {req.borrowerName} ({req.department})</p>
                                <p className="text-sm text-gray-600">วันที่ยืม: {new Date(req.borrowDate).toLocaleDateString('th-TH')} - คืน: {new Date(req.returnDate).toLocaleDateString('th-TH')}</p>
                                <p className="text-sm text-gray-500 mt-2">อุปกรณ์: {req.equipmentList}</p>
                             </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusClass(req.status)}`}>{req.status}</span>
                        </div>
                        <div className="flex justify-end mt-2">
                           <StatusActions req={req} />
                           {req.status === BorrowStatus.Pending && !isAdmin && (
                               <Button variant="danger" onClick={() => {
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
