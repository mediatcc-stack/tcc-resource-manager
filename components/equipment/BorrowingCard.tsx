import React from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';

interface BorrowingCardProps {
    req: BorrowingRequest;
    isAdmin: boolean;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onCancelRequest: (id: string) => void;
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


const BorrowingCard: React.FC<BorrowingCardProps> = ({ req, isAdmin, onChangeStatus, onCancelRequest }) => {
    
    const statusInfo = getStatusInfo(req.status);
    const colorClasses = colors[statusInfo.color as keyof typeof colors];

    const handleCancelClick = () => {
        if (confirm(`คุณต้องการยกเลิกคำขอยืมของ "${req.borrowerName}" ใช่หรือไม่?`)) {
            onCancelRequest(req.id);
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
                    {isAdmin ? (
                        <select 
                            value={req.status} 
                            onChange={(e) => onChangeStatus(req.id, e.target.value as BorrowStatus)}
                            className={`w-full text-sm font-semibold p-2 rounded-lg border-2 ${colorClasses.border} ${colorClasses.bg} ${colorClasses.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                            {Object.values(BorrowStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    ) : (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-full ${colorClasses.bg} ${colorClasses.text}`}>
                            {statusInfo.icon} {statusInfo.text}
                        </div>
                    )}
                    
                    {req.status !== BorrowStatus.Returned && req.status !== BorrowStatus.Cancelled && (
                         <Button size="sm" variant="danger" onClick={handleCancelClick}>
                            ยกเลิกการยืม
                        </Button>
                    )}
                </div>

                {/* Bottom Row - Equipment List */}
                <div className="md:col-span-3 border-t border-gray-100 pt-3 mt-2">
                    <p className="font-semibold text-gray-600 mb-2">📦 รายการอุปกรณ์ที่ยืม:</p>
                    <pre className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap font-sans text-gray-800 border border-gray-200">{req.equipmentList}</pre>
                </div>

            </div>
        </div>
    );
};

export default BorrowingCard;
