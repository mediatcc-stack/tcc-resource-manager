

import React, { useState, useRef, useEffect } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Clock, ArrowRightLeft, CheckCircle2, AlertCircle, XCircle, Calendar, Trash2, HelpCircle, Pencil, Package, Building2, Eye, EyeOff } from 'lucide-react';

interface BorrowingCardProps {
    req: BorrowingRequest;
    onChangeStatus: (id: string, newStatus: BorrowStatus) => void;
    onDeleteRequest: (id: string) => void;
    onEdit: (req: BorrowingRequest) => void;
    isAdmin: boolean;
    isMine: boolean;
}

const getStatusIcon = (status: BorrowStatus, className = "w-3.5 h-3.5") => {
    switch (status) {
        case BorrowStatus.Pending: return <Clock className={className} />;
        case BorrowStatus.Borrowing: return <ArrowRightLeft className={className} />;
        case BorrowStatus.Returned: return <CheckCircle2 className={className} />;
        case BorrowStatus.Overdue: return <AlertCircle className={className} />;
        case BorrowStatus.Cancelled: return <XCircle className={className} />;
        default: return <HelpCircle className={className} />;
    }
};

const getStatusInfo = (status: BorrowStatus) => {
    switch (status) {
        case BorrowStatus.Pending: return { text: 'รออนุมัติ', color: 'yellow' };
        case BorrowStatus.Borrowing: return { text: 'กำลังยืม', color: 'sky' };
        case BorrowStatus.Returned: return { text: 'คืนแล้ว', color: 'green' };
        case BorrowStatus.Overdue: return { text: 'เกินกำหนด', color: 'red' };
        case BorrowStatus.Cancelled: return { text: 'ยกเลิก', color: 'gray' };
        default: return { text: status, color: 'gray' };
    }
};

// สีป้ายสถานะ อ้างอิงโทเคนของดีไซน์ระบบ
const colors = {
    yellow: { bg: 'bg-warning-container', text: 'text-on-warning-container' },
    sky: { bg: 'bg-secondary-fixed', text: 'text-on-secondary-fixed' },
    green: { bg: 'bg-success-container', text: 'text-on-success-container' },
    red: { bg: 'bg-error-container', text: 'text-on-error-container' },
    gray: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

const ActionMenu: React.FC<{
    req: BorrowingRequest;
    onChangeStatus: (newStatus: BorrowStatus) => void;
    onDeleteRequest: () => void;
    onClose: () => void;
    onEdit: () => void;
}> = ({ req, onChangeStatus, onDeleteRequest, onClose, onEdit }) => {
    return (
        <div className="absolute top-12 right-0 z-20 w-56 bg-surface-container-lowest rounded-xl shadow-2xl animate-fade-in">
            <div className="p-2 border-b border-outline-variant/40">
                <button onClick={onEdit} className="w-full text-left font-label text-label-md text-on-surface hover:bg-surface-container-low rounded-md p-2 flex items-center gap-2 cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-outline shrink-0" />
                    แก้ไขข้อมูล
                </button>
            </div>
            <div className="p-2">
                <p className="font-label text-label-sm text-outline px-2 pt-1 pb-2">เปลี่ยนสถานะเป็น</p>
                <div className="grid grid-cols-2 gap-1">
                    {Object.values(BorrowStatus).map(status => (
                        <button key={status} onClick={() => onChangeStatus(status)} disabled={req.status === status}
                            className={`px-2 py-1.5 font-label text-label-md rounded-md flex items-center gap-1.5 cursor-pointer ${req.status === status ? 'bg-surface-container-high text-primary' : 'hover:bg-surface-container-low'}`}>
                            {getStatusIcon(status, "w-3 h-3")} {status}
                        </button>
                    ))}
                </div>
            </div>
            <div className="border-t border-outline-variant/40 p-2 space-y-1">
                <button onClick={onDeleteRequest} className="w-full text-left font-label text-label-md text-error hover:bg-error-container/40 rounded-md p-2 flex items-center gap-2 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-error shrink-0" />
                    ลบรายการถาวร
                </button>
            </div>
        </div>
    );
};


const BorrowingCard: React.FC<BorrowingCardProps> = ({ req, onChangeStatus, onDeleteRequest, onEdit, isAdmin, isMine }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const statusInfo = getStatusInfo(req.status);
    const colorClasses = colors[statusInfo.color as keyof typeof colors];
    const canSelfEdit = isMine && !isAdmin && req.status === BorrowStatus.Pending;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setIsActionMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleStatusChangeAttempt = (newStatus: BorrowStatus) => {
        setIsActionMenuOpen(false);
        if (newStatus === req.status) return;
        onChangeStatus(req.id, newStatus);
    };
    
    const handleDeleteClick = () => {
        setIsActionMenuOpen(false);
        setIsDeleteConfirmOpen(true);
    };

    const handleEditClick = () => {
        setIsActionMenuOpen(false);
        onEdit(req);
    };

    return (
        <div className={`bg-surface-container-lowest rounded-xl shadow-card hover:shadow-md transition-all ${isExpanded ? 'ring-1 ring-secondary' : ''}`}>
            <div className="p-space-md">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <div className={`px-3 py-1 font-label text-label-sm rounded-full inline-flex items-center gap-1.5 whitespace-nowrap ${colorClasses.bg} ${colorClasses.text}`}>
                                {getStatusIcon(req.status, "w-3 h-3")} {statusInfo.text}
                            </div>
                            {isMine && !isAdmin && (
                                <span className="px-2.5 py-0.5 rounded-full font-label text-label-sm inline-block whitespace-nowrap bg-surface-container-high text-primary">
                                    รายการของฉัน
                                </span>
                            )}
                        </div>
                        <h3 className="font-heading text-headline-sm text-on-surface mt-2">{req.borrowerName}</h3>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-space-md mt-1 font-body text-body-sm">
                            <span className="inline-flex items-center gap-1 text-secondary font-medium">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                {new Date(req.borrowDate).toLocaleDateString('th-TH')} - {new Date(req.returnDate).toLocaleDateString('th-TH')}
                            </span>
                            <span className="text-outline">•</span>
                            <span className="inline-flex items-center gap-1 text-on-surface-variant">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                {req.equipmentList.split('\n')[0]}
                                {req.equipmentList.split('\n').length > 1 && ` (+${req.equipmentList.split('\n').length - 1} รายการ)`}
                            </span>
                            {req.department && (
                                <>
                                    <span className="text-outline">•</span>
                                    <span className="inline-flex items-center gap-1 text-on-surface-variant">
                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                        {req.department}
                                    </span>
                                </>
                            )}
                        </div>
                        {isMine && !isAdmin && !canSelfEdit && (
                            <p className="font-body text-body-sm text-outline mt-1.5 italic">
                                เจ้าหน้าที่ดำเนินการแล้ว จึงแก้ไขคำขอนี้เองไม่ได้แล้ว
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-space-xs shrink-0">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-space-sm py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label text-label-sm transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                        <span>{isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</span>
                    </button>

                    {/* แอดมินจัดการได้ทุกอย่าง / เจ้าของคำขอแก้ไขเองได้ตราบใดที่ยังไม่ได้รับการอนุมัติ */}
                    {isAdmin && (
                        <div className="relative flex flex-col items-end" ref={actionMenuRef}>
                           <button onClick={() => setIsActionMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant cursor-pointer" aria-label="เมนูจัดการ">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                           </button>
                            {isActionMenuOpen && (
                                <ActionMenu
                                    req={req}
                                    onChangeStatus={handleStatusChangeAttempt}
                                    onDeleteRequest={handleDeleteClick}
                                    onClose={() => setIsActionMenuOpen(false)}
                                    onEdit={handleEditClick}
                                />
                            )}
                        </div>
                    )}

                    {canSelfEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(req); }}
                            className="shrink-0 px-space-sm py-1.5 font-label text-label-sm rounded-lg bg-surface-container-low text-primary hover:bg-surface-container transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            แก้ไขคำขอ
                        </button>
                    )}
                    </div>
                </div>

                {isExpanded && (
                     <div className="mt-space-sm pt-space-sm border-t border-outline-variant/50 animate-fade-in space-y-2 font-body text-body-md">
                        <p><strong className="font-label text-label-md text-on-surface-variant">วัตถุประสงค์:</strong> {req.purpose}</p>
                        <p><strong className="font-label text-label-md text-on-surface-variant">เบอร์โทร:</strong> {req.phone || 'ไม่ได้ระบุ'}</p>
                        <div>
                           <p className="font-label text-label-md text-on-surface-variant mb-1">รายการอุปกรณ์:</p>
                           <pre className="bg-surface-container-low p-3 rounded-lg whitespace-pre-wrap font-body text-body-md text-on-surface">{req.equipmentList}</pre>
                        </div>
                          {req.notes && (
                             <div>
                                <p className="font-label text-label-md text-on-surface-variant mb-1">หมายเหตุ:</p>
                                <p className="bg-warning-container p-3 rounded-lg font-body text-body-md text-on-warning-container">{req.notes}</p>
                             </div>
                         )}
                    </div>
                )}
            </div>

            {/* Confirmation Modal สำหรับการลบรายการยืมอุปกรณ์ */}
            <Modal
              isOpen={isDeleteConfirmOpen}
              onClose={() => setIsDeleteConfirmOpen(false)}
              title="ยืนยันการลบรายการถาวร"
              size="sm"
            >
              <div className="space-y-4">
                <p className="font-body text-body-md text-on-surface-variant">
                  คุณต้องการลบคำขอยืมอุปกรณ์ของ <strong className="text-primary">"{req.borrowerName}"</strong> ออกจากระบบอย่างถาวรใช่หรือไม่?
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      onDeleteRequest(req.id);
                      setIsDeleteConfirmOpen(false);
                    }}
                  >
                    ยืนยันการลบ
                  </Button>
                </div>
              </div>
            </Modal>
        </div>
    );
};

export default BorrowingCard;