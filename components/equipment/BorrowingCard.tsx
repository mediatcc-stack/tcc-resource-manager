import React, { useState } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import { STAFF_PASSWORDS } from '../../constants';

interface BorrowingCardProps {
    req: BorrowingRequest;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onDeleteRequest: (id: string) => void;
    isAdmin: boolean;
}

const getStatusInfo = (status: BorrowStatus) => {
    switch (status) {
        case BorrowStatus.Pending:
            return { text: 'รออนุมัติ', icon: '⏳', color: 'yellow' };
        case BorrowStatus.Borrowing:
            return { text: 'อยู่ระหว่างการยืม', icon: '➡️', color: 'blue' };
        case BorrowStatus.Returned:
            return { text: 'คืนแล้ว', icon: '✅', color: 'green' };
        case BorrowStatus.Overdue:
            return { text: 'เกินกำหนด', icon: '⚠️', color: 'red' };
        case BorrowStatus.Cancelled:
            return { text: 'ยกเลิก', icon: '❌', color: 'gray' };
        default:
            return { text: status, icon: '❓', color: 'gray' };
    }
};

const colors = {
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' },
};


const BorrowingCard: React.FC<BorrowingCardProps> = ({ req, onChangeStatus, onDeleteRequest, isAdmin }) => {
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    
    const statusInfo = getStatusInfo(req.status);
    const colorClasses = colors[statusInfo.color as keyof typeof colors];

    const handleActionWithAuth = (action: () => void) => {
        if (isAdmin) {
            action();
            return;
        }
        const password = prompt('กรุณาใส่รหัสผ่านเจ้าหน้าที่เพื่อดำเนินการ:');
        if (password && STAFF_PASSWORDS.includes(password)) {
            action();
        } else if (password !== null) {
            alert('รหัสผ่านไม่ถูกต้อง ไม่สามารถดำเนินการได้');
        }
    };

    const handleStatusChangeAttempt = (newStatus: BorrowStatus) => {
        setIsChangingStatus(false);
        if (newStatus === req.status) return;

        handleActionWithAuth(() => {
            onChangeStatus(req.id, newStatus);
        });
    };
    
    const handleDeleteClick = () => {
        setIsChangingStatus(false);
        if (confirm(`⚠️ ยืนยันการลบถาวร ⚠️\n\nคำขอยืมของ "${req.borrowerName}" จะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้\n\nคุณต้องการ "ลบถาวร" ใช่หรือไม่?`)) {
            handleActionWithAuth(() => {
                onDeleteRequest(req.id);
            });
        }
    };

    const InfoLine: React.FC<{icon: string, label: string, value: string | React.ReactNode}> = ({icon, label, value}) => (
        <div className="flex items-start text-sm">
            <span className="w-6 text-center">{icon}</span>
            <span className="font-semibold text-gray-500 mr-2">{label}:</span>
            <span className="text-gray-800 break-words">{value}</span>
        </div>
    );
    
    return (
    <>
        <div className={`bg-white rounded-2xl shadow-sm border-l-8 p-5 ${colorClasses.border} transition hover:shadow-lg`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                
                {/* Left Column - Main Info */}
                <div className="md:col-span-2 space-y-2">
                    <h3 className="text-lg font-bold text-[#0D448D]">{`ผู้ยืม: ${req.borrowerName}`}</h3>
                    <div className="space-y-1.5">
                        <InfoLine icon="📞" label="เบอร์" value={req.phone} />
                        <InfoLine icon="🏢" label="หน่วยงาน" value={req.department} />
                        <InfoLine icon="🎯" label="วัตถุประสงค์" value={req.purpose} />
                        <InfoLine icon="🗓️" label="ยืม" value={`${new Date(req.borrowDate).toLocaleDateString('th-TH')}  -  ${new Date(req.returnDate).toLocaleDateString('th-TH')}`} />
                    </div>
                </div>

                {/* Right Column - Status & Actions */}
                <div className="flex flex-col items-start md:items-end justify-between gap-3">
                    <button 
                        onClick={() => setIsChangingStatus(true)}
                        className={`w-full text-sm font-bold p-2.5 rounded-lg border-2 flex items-center justify-center gap-2 transition-transform active:scale-95 ${colorClasses.border} ${colorClasses.bg} ${colorClasses.text} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    >
                        {statusInfo.icon} {statusInfo.text}
                    </button>
                </div>

                {/* Bottom Row - Equipment List */}
                <div className="md:col-span-3 border-t border-gray-100 pt-3 mt-2">
                    <p className="font-semibold text-gray-600 mb-2">📦 รายการอุปกรณ์ที่ยืม:</p>
                    <pre className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap font-sans text-gray-800 border border-gray-200">{req.equipmentList}</pre>
                </div>
            </div>
        </div>

        {isChangingStatus && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 animate-fade-in" onClick={() => setIsChangingStatus(false)}>
                <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md animate-zoom-in" onClick={e => e.stopPropagation()}>
                    <h4 className="font-bold text-xl mb-2 text-center text-[#0D448D]">เปลี่ยนสถานะการยืม</h4>
                    <p className="text-center text-sm text-gray-500 mb-6">สำหรับ: <span className="font-semibold">{req.borrowerName}</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.values(BorrowStatus).map(status => {
                            const currentStatusInfo = getStatusInfo(status);
                            const isCurrent = req.status === status;
                            const color = colors[currentStatusInfo.color as keyof typeof colors];
                            return (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChangeAttempt(status)}
                                    disabled={isCurrent}
                                    className={`p-4 rounded-lg text-sm font-semibold transition-all border-2 flex flex-col items-center justify-center gap-2 active:scale-95
                                        ${isCurrent 
                                        ? `${color.bg} ${color.text} ${color.border} cursor-not-allowed opacity-100` 
                                        : `bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-400`}
                                    `}
                                >
                                    <span className="text-2xl">{currentStatusInfo.icon}</span>
                                    <span>{status}</span>
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-6 space-y-3 pt-4 border-t border-gray-200">
                        <Button variant="danger" onClick={handleDeleteClick} className="w-full">
                            ลบรายการนี้ถาวร
                        </Button>
                        <Button variant="secondary" onClick={() => setIsChangingStatus(false)} className="w-full">
                            ปิด
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

export default BorrowingCard;