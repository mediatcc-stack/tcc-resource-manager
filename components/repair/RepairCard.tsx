

import React, { useState, useRef, useEffect } from 'react';
import { RepairRequest, RepairStatus } from '../../types';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Clock, Wrench, CheckCircle2, Trash2, Bell, HelpCircle, MapPin } from 'lucide-react';

interface RepairCardProps {
    req: RepairRequest;
    onChangeStatus: (id: string, newStatus: RepairStatus) => void;
    onDeleteRequest: (id: string) => void;
    onNotifyAgain?: (req: RepairRequest) => void;
    isAdmin: boolean;
}

const getStatusIcon = (status: RepairStatus, className = "w-3.5 h-3.5") => {
    switch (status) {
        case RepairStatus.Pending: return <Clock className={className} />;
        case RepairStatus.InProgress: return <Wrench className={className} />;
        case RepairStatus.Completed: return <CheckCircle2 className={className} />;
        default: return <HelpCircle className={className} />;
    }
};

const statusColors: Record<string, { bg: string; text: string }> = {
    [RepairStatus.Pending]: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    [RepairStatus.InProgress]: { bg: 'bg-sky-100', text: 'text-sky-800' },
    [RepairStatus.Completed]: { bg: 'bg-green-100', text: 'text-green-800' },
};

const priorityColors: Record<string, string> = {
    'ปกติ': 'bg-slate-100 text-slate-600 border border-slate-200',
    'ด่วน': 'bg-amber-50 text-amber-700 border border-amber-200',
    'ด่วนที่สุด': 'bg-red-50 text-red-600 border border-red-200 font-bold',
};

const ActionMenu: React.FC<{
    req: RepairRequest;
    onChangeStatus: (newStatus: RepairStatus) => void;
    onDeleteRequest: () => void;
    onNotifyAgain?: () => void;
}> = ({ req, onChangeStatus, onDeleteRequest, onNotifyAgain }) => {
    return (
        <div className="absolute top-12 right-0 z-20 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 animate-fade-in">
            <div className="p-2">
                <p className="text-xs font-bold text-gray-400 px-2 pt-1 pb-2">เปลี่ยนสถานะเป็น</p>
                <div className="grid grid-cols-1 gap-1">
                    {Object.values(RepairStatus).map(status => (
                        <button key={status} onClick={() => onChangeStatus(status)} disabled={req.status === status}
                            className={`px-2 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer ${req.status === status ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}>
                            {getStatusIcon(status, "w-3 h-3")} {status}
                        </button>
                    ))}
                </div>
            </div>
            <div className="border-t border-gray-100 p-2 space-y-1">
                {req.status === RepairStatus.Pending && onNotifyAgain && (
                    <button onClick={onNotifyAgain} className="w-full text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md p-2 flex items-center gap-2 cursor-pointer">
                        <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        แจ้งเตือน LINE ซ้ำ
                    </button>
                )}
                <button onClick={onDeleteRequest} className="w-full text-left text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md p-2 flex items-center gap-2 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ลบรายการถาวร
                </button>
            </div>
        </div>
    );
};

const RepairCard: React.FC<RepairCardProps> = ({ req, onChangeStatus, onDeleteRequest, onNotifyAgain, isAdmin }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const colorClasses = statusColors[req.status] || statusColors[RepairStatus.Pending];

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

    return (
        <div className={`bg-white rounded-2xl shadow-sm border ${isExpanded ? 'border-blue-400' : 'border-gray-200'} transition-all`}>
            <div className="p-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2.5 py-1 text-xs font-bold rounded-full inline-flex items-center gap-1.5 ${colorClasses.bg} ${colorClasses.text}`}>
                                {getStatusIcon(req.status, "w-3 h-3")} {req.status}
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide inline-block ${priorityColors[req.priority] || priorityColors['ปกติ']}`}>
                                {req.priority === 'ด่วนที่สุด' ? '🔥 ' : ''}{req.priority}
                            </span>
                        </div>
                        <h3 className="text-md font-bold text-gray-800 mt-2">{req.requesterName}</h3>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {req.roomName} · {req.department}
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                            {new Date(req.createdAt).toLocaleString('th-TH')}
                        </p>
                    </div>

                    {isAdmin && (
                        <div className="relative flex flex-col items-end" ref={actionMenuRef}>
                            <button onClick={() => setIsActionMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="เมนูจัดการ">
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
                                />
                            )}
                        </div>
                    )}
                </div>

                {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in space-y-2 text-sm">
                        <p><strong className="font-semibold text-gray-500">ประเภทปัญหา:</strong> {req.problemType}</p>
                        <div>
                            <p className="font-semibold text-gray-500 mb-1">รายละเอียดอาการเสีย:</p>
                            <p className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap font-sans text-gray-800 border border-gray-200">{req.description}</p>
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
                    <p className="text-slate-600 font-medium">
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
