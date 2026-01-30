

import React, { useState, useRef, useEffect } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { STAFF_PASSWORDS } from '../../constants';

interface BorrowingCardProps {
    req: BorrowingRequest;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyOverdue?: (req: BorrowingRequest) => void;
    isAdmin: boolean;
}

const getStatusInfo = (status: BorrowStatus) => {
    switch (status) {
        case BorrowStatus.Pending: return { text: 'รออนุมัติ', icon: '⏳', color: 'yellow' };
        case BorrowStatus.Borrowing: return { text: 'กำลังยืม', icon: '➡️', color: 'sky' };
        case BorrowStatus.Returned: return { text: 'คืนแล้ว', icon: '✅', color: 'green' };
        case BorrowStatus.Overdue: return { text: 'เกินกำหนด', icon: '⚠️', color: 'red' };
        case BorrowStatus.Cancelled: return { text: 'ยกเลิก', icon: '❌', color: 'gray' };
        default: return { text: status, icon: '❓', color: 'gray' };
    }
};

const colors = {
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400', ring: 'ring-yellow-300' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-400', ring: 'ring-sky-300' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400', ring: 'ring-green-300' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400', ring: 'ring-red-300' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400', ring: 'ring-gray-300' },
};

const ActionMenu: React.FC<{
    req: BorrowingRequest;
    isAdmin: boolean;
    onChangeStatus: (newStatus: BorrowStatus) => void;
    onDeleteRequest: () => void;
    onNotifyOverdue?: () => void;
    onClose: () => void;
}> = ({ req, onChangeStatus, onDeleteRequest, onNotifyOverdue, onClose }) => {
    
    return (
        <div className="absolute top-12 right-0 z-20 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 animate-fade-in">
            <div className="p-2">
                <p className="text-xs font-bold text-gray-400 px-2 pt-1 pb-2">เปลี่ยนสถานะเป็น</p>
                <div className="grid grid-cols-2 gap-1">
                    {Object.values(BorrowStatus).map(status => (
                        <button key={status} onClick={() => onChangeStatus(status)} disabled={req.status === status}
                            className={`px-2 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${req.status === status ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}>
                            {getStatusInfo(status).icon} {status}
                        </button>
                    ))}
                </div>
            </div>
            <div className="border-t border-gray-100 p-2 space-y-1">
                {req.status === BorrowStatus.Overdue && onNotifyOverdue && (
                    <button onClick={onNotifyOverdue} className="w-full text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md p-2 flex items-center gap-2">🔔 แจ้งเตือน LINE</button>
                )}
                <button onClick={onDeleteRequest} className="w-full text-left text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md p-2 flex items-center gap-2">🗑️ ลบรายการถาวร</button>
            </div>
        </div>
    );
};


const BorrowingCard: React.FC<BorrowingCardProps> = ({ req, onChangeStatus, onDeleteRequest, onNotifyOverdue, isAdmin }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    
    const statusInfo = getStatusInfo(req.status);
    const colorClasses = colors[statusInfo.color as keyof typeof colors];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setIsActionMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleActionWithAuth = (action: () => void) => {
        if (isAdmin) {
            action();
            return;
        }
        const password = prompt('กรุณาใส่รหัสผ่านเจ้าหน้าที่:');
        if (password && STAFF_PASSWORDS.includes(password)) {
            action();
        } else if (password !== null) {
            alert('รหัสผ่านไม่ถูกต้อง');
        }
    };

    const handleStatusChangeAttempt = (newStatus: BorrowStatus) => {
        setIsActionMenuOpen(false);
        if (newStatus === req.status) return;
        handleActionWithAuth(() => onChangeStatus(req.id, newStatus));
    };
    
    const handleDeleteClick = () => {
        setIsActionMenuOpen(false);
        if (confirm(`⚠️ ยืนยันการลบถาวร\n\nคำขอยืมของ "${req.borrowerName}" จะถูกลบอย่างถาวร`)) {
            handleActionWithAuth(() => onDeleteRequest(req.id));
        }
    };

    const handleNotifyClick = () => {
        setIsActionMenuOpen(false);
        if (onNotifyOverdue) handleActionWithAuth(() => onNotifyOverdue(req));
    };

    return (
        <div className={`bg-white rounded-2xl shadow-sm border ${isExpanded ? 'border-blue-400' : 'border-gray-200'} transition-all`}>
            <div className="p-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className={`px-2.5 py-1 text-xs font-bold rounded-full inline-flex items-center gap-1.5 ${colorClasses.bg} ${colorClasses.text}`}>
                            {statusInfo.icon} {statusInfo.text}
                        </div>
                        <h3 className="text-md font-bold text-gray-800 mt-2">{req.borrowerName}</h3>
                        <p className="text-xs text-gray-500 font-medium">
                            🗓️ {new Date(req.borrowDate).toLocaleDateString('th-TH')} - {new Date(req.returnDate).toLocaleDateString('th-TH')}
                        </p>
                    </div>
                    <div className="flex flex-col items-end" ref={actionMenuRef}>
                       <button onClick={() => setIsActionMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                       </button>
                        {isActionMenuOpen && (
                            <ActionMenu 
                                req={req}
                                isAdmin={isAdmin}
                                onChangeStatus={handleStatusChangeAttempt}
                                onDeleteRequest={handleDeleteClick}
                                onNotifyOverdue={handleNotifyClick}
                                onClose={() => setIsActionMenuOpen(false)}
                            />
                        )}
                    </div>
                </div>

                {isExpanded && (
                     <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in space-y-2 text-sm">
                        <p><strong className="font-semibold text-gray-500">วัตถุประสงค์:</strong> {req.purpose}</p>
                        <p><strong className="font-semibold text-gray-500">เบอร์โทร:</strong> {req.phone || 'ไม่ได้ระบุ'}</p>
                        <div>
                           <p className="font-semibold text-gray-500 mb-1">รายการอุปกรณ์:</p>
                           <pre className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap font-sans text-gray-800 border border-gray-200">{req.equipmentList}</pre>
                        </div>
                         {req.notes && (
                            <div>
                               <p className="font-semibold text-gray-500 mb-1">หมายเหตุ:</p>
                               <p className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-yellow-800">{req.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BorrowingCard;