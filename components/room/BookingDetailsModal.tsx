import React from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookings: Booking[];
    date: string;
    roomName?: string;
    onNavigateToMyBookings: () => void;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({ isOpen, onClose, bookings, date, roomName, onNavigateToMyBookings }) => {
    if (!isOpen) return null;

    const formattedDate = new Date(date).toLocaleDateString('th-TH');
    
    const handleNavigate = () => {
        onNavigateToMyBookings();
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-zoom-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 bg-gray-50/50 border-b border-gray-200 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-[#0D448D] flex items-center gap-3">
                        <span className="text-2xl">🗓️</span>
                        <span>
                            {roomName ? `จองสำหรับ ${roomName}` : 'รายการจอง'}
                            <p className="text-sm font-normal text-gray-500">วันที่ {formattedDate}</p>
                        </span>
                    </h3>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {bookings.length > 0 ? (
                        <div className="space-y-4">
                            {bookings.map(booking => (
                                <div key={booking.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                                    <p className="font-bold text-gray-800 flex items-center gap-2 text-md">
                                        <span className="text-blue-500">⏰</span> {booking.startTime} - {booking.endTime}
                                    </p>
                                    <div className="pl-6 border-l-2 border-blue-200 ml-2 space-y-1 pt-1 pb-1">
                                       <p className="text-sm text-gray-700 flex items-start gap-2"><strong className="font-semibold text-gray-500 w-16 flex-shrink-0">ชื่องาน:</strong> <span className="break-words">{booking.purpose}</span></p>
                                       <p className="text-sm text-gray-600 flex items-start gap-2"><strong className="font-semibold text-gray-500 w-16 flex-shrink-0">ผู้จอง:</strong> {booking.bookerName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                       <div className="text-center py-10 px-6">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-lg font-semibold text-gray-700">ว่าง</p>
                            <p className="text-gray-500">ไม่มีรายการจองสำหรับห้องนี้ในวันที่เลือก</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-2xl">
                    <Button variant="primary" size="sm" onClick={handleNavigate}>
                        ดูรายการจองทั้งหมด
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        ปิด
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BookingDetailsModal;