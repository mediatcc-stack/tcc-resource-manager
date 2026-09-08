

import React, { useState, useRef, useEffect } from 'react';
import { RepairRequest, RepairStatus } from '../../types';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Clock, Wrench, CheckCircle2, Trash2, Bell, HelpCircle, MapPin, Pencil, Eye, EyeOff, CalendarClock } from 'lucide-react';

interface RepairCardProps {
    req: RepairRequest;
    onChangeStatus: (id: string, newStatus: RepairStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyAgain?: (req: RepairRequest) => void;
    onEdit: (req: RepairRequest) => void;
    isAdmin: boolean;
    isMine: boolean;
}

const getStatusIcon = (status: RepairStatus, className = "w-3.5 h-3.5") => {
    switch (status) {
        case RepairStatus.Pending: return <Clock className={className} />;
        case RepairStatus.InProgress: return <Wrench className={className} />;
        case RepairStatus.Completed: return <CheckCircle2 className={className} />;
        default: return <HelpCircle className={className} />;
    }
};

// สีป้ายสถานะ/ความเร่งด่วน อ้างอิงโทเคนของดีไซน์ระบบ
const statusColors: Record<string, { bg: string; text: string }> = {
    [RepairStatus.Pending]: { bg: 'bg-warning-container', text: 'text-on-warning-container' },
    [RepairStatus.InProgress]: { bg: 'bg-secondary-fixed', text: 'text-on-secondary-fixed' },
    [RepairStatus.Completed]: { bg: 'bg-success-container', text: 'text-on-success-container' },
};

const priorityColors: Record<string, string> = {
    'ปกติ': 'bg-surface-container-low text-on-surface-variant',
    'ด่วน': 'bg-warning-container text-on-warning-container',
    'ด่วนที่สุด': 'bg-error-container text-on-error-container',
};

const ActionMenu: React.FC<{
    req: RepairRequest;
    onChangeStatus: (newStatus: RepairStatus) => void;
    onDeleteRequest: () => void;
    onNotifyAgain?: () => void;
    onEdit: () => void;
}> = ({ req, onChangeStatus, onDeleteRequest, onNotifyAgain, onEdit }) => {
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
                <div className="grid grid-cols-1 gap-1">
                    {Object.values(RepairStatus).map(status => (
                        <button key={status} onClick={() => onChangeStatus(status)} disabled={req.status === status}
                            className={`px-2 py-1.5 font-label text-label-md rounded-md flex items-center gap-1.5 cursor-pointer ${req.status === status ? 'bg-surface-container-high text-primary' : 'hover:bg-surface-container-low'}`}>
                            {getStatusIcon(status, "w-3 h-3")} {status}
                        </button>
                    ))}
                </div>
            </div>
            <div className="border-t border-outline-variant/40 p-2 space-y-1">
                {req.status === RepairStatus.Pending && onNotifyAgain && (
                    <button onClick={onNotifyAgain} className="w-full text-left font-label text-label-md text-on-surface hover:bg-surface-container-low rounded-md p-2 flex items-center gap-2 cursor-pointer">
                        <Bell className="w-3.5 h-3.5 text-outline shrink-0" />
                        ส่งแจ้งเตือนซ้ำ
                    </button>
                )}
                <button onClick={onDeleteRequest} className="w-full text-left font-label text-label-md text-error hover:bg-error-container/40 rounded-md p-2 flex items-center gap-2 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-error shrink-0" />
                    ลบรายการถาวร
                </button>
            </div>
        </div>
    );
};

const RepairCard: React.FC<RepairCardProps> = ({ req, onChangeStatus, onDeleteRequest, onNotifyAgain, onEdit, isAdmin, isMine }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const colorClasses = statusColors[req.status] || statusColors[RepairStatus.Pending];
    const canSelfEdit = isMine && !isAdmin && req.status === RepairStatus.Pending;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setIsActionMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleStatusChangeAttempt = (newStatus: RepairStatus) => {
        setIsActionMenuOpen(false);
        if (newStatus === req.status) return;
        onChangeStatus(req.id, newStatus);
    };

    const handleDeleteClick = () => {
        setIsActionMenuOpen(false);
        setIsDeleteConfirmOpen(true);
    };

    const handleNotifyClick = () => {
        setIsActionMenuOpen(false);
        if (onNotifyAgain) onNotifyAgain(req);
    };

    const handleEditClick = () => {
        setIsActionMenuOpen(false);
        onEdit(req);
    };

    return (
        <div className={`bg-surface-container-lowest rounded-xl shadow-card hover:shadow-md transition-all ${isExpanded ? 'ring-1 ring-secondary' : ''}`}>
            <div className="p-space-md">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-3 py-1 font-label text-label-sm rounded-full inline-flex items-center gap-1.5 ${colorClasses.bg} ${colorClasses.text}`}>
                                {getStatusIcon(req.status, "w-3 h-3")} {req.status}
                            </div>
                            <span className={`px-2.5 py-1 rounded-full font-label text-label-sm inline-block ${priorityColors[req.priority] || priorityColors['ปกติ']}`}>
                                {req.priority === 'ด่วนที่สุด' ? '🔥 ' : ''}{req.priority}
                            </span>
                            {isMine && !isAdmin && (
                                <span className="px-2.5 py-1 rounded-full font-label text-label-sm inline-block bg-surface-container-high text-primary">
                                    รายการของฉัน
                                </span>
                            )}
                        </div>
                        <h3 className="font-heading text-headline-sm text-on-surface mt-2">{req.requesterName}</h3>
                        <p className="font-body text-body-md text-on-surface-variant mt-0.5 flex items-start gap-1.5">
                            <Wrench className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{req.description}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-space-md mt-1 font-body text-body-sm text-on-surface-variant">
                            <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-outline shrink-0" />
                                {req.roomName} · {req.department}
                            </span>
                            <span className="inline-flex items-center gap-1 text-outline">
                                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                {new Date(req.createdAt).toLocaleString('th-TH')}
                            </span>
                        </div>
                        {isMine && !isAdmin && !canSelfEdit && (
                            <p className="font-body text-body-sm text-outline mt-1.5 italic">
                                เจ้าหน้าที่เริ่มดำเนินการแล้ว จึงแก้ไขคำขอนี้เองไม่ได้แล้ว
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-space-xs shrink-0">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-space-sm py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label text-label-sm transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</span>
                    </button>

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
                                    onNotifyAgain={handleNotifyClick}
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
                        <p><strong className="font-label text-label-md text-on-surface-variant">ปัญหาที่พบ:</strong> {req.problemType}</p>
                        <div>
                            <p className="font-label text-label-md text-on-surface-variant mb-1">รายละเอียดปัญหาที่พบ:</p>
                            <p className="bg-surface-container-low p-3 rounded-lg whitespace-pre-wrap font-body text-body-md text-on-surface">{req.description}</p>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="ยืนยันการลบรายการถาวร"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="font-body text-body-md text-on-surface-variant">
                        คุณต้องการลบคำแจ้งซ่อมของ <strong className="text-primary">"{req.requesterName}"</strong> ออกจากระบบอย่างถาวรใช่หรือไม่?
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button variant="secondary" size="sm" onClick={() => setIsDeleteConfirmOpen(false)}>ยกเลิก</Button>
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

export default RepairCard;
