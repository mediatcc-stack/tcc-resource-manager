import React from 'react';
import { createPortal } from 'react-dom';
import { Booking, Room } from '../../types';
import Button from '../shared/Button';
import RoomAvailabilityTimeline from './RoomAvailabilityTimeline';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookings: Booking[];
    date: string;
    room: Room | null;
    onBookNow: (room: Room, date: string) => void;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({ isOpen, onClose, bookings, date, room, onBookNow }) => {
    if (!isOpen || !room) return null;

    const formattedDate = new Date(date).toLocaleDateString('th-TH');
    
    const handleBookNow = () => {
        onBookNow(room, date);
    };

    const modalContent = (
        <div 
            className="fixed inset-0 w-screen h-screen bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
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
                            {room.name}
                            <p className="text-sm font-normal text-gray-500">วันที่ {formattedDate}</p>
                        </span>
                    </h3>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-sm font-bold text-gray-600 mb-3">ภาพรวมเวลา</h4>
                        <RoomAvailabilityTimeline bookings={bookings} simplified={false}/>
                    </div>

                    <div className="max-h-[30vh] overflow-y-auto pr-2">
                        <h4 className="text-sm font-bold text-gray-600 mb-3">รายการจอง</h4>
                        {bookings.length > 0 ? (
                            <div className="space-y-3">
                                {bookings.map(booking => (
                                    <div key={booking.id} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                        <p className="font-bold text-gray-800 text-md">
                                            <span className="text-blue-500">⏰</span> {booking.startTime} - {booking.endTime}
                                        </p>
                                        <div className="pl-4 mt-1 border-l-2 border-blue-100 ml-1 space-y-1">
                                           <p className="text-xs text-gray-700"><strong className="font-semibold text-gray-500">เรื่อง:</strong> {booking.purpose}</p>
                                           <p className="text-xs text-gray-600"><strong className="font-semibold text-gray-500">ผู้จอง:</strong> {booking.bookerName}</p>
                                           {booking.roomArrangement && (
                                             <p className="text-xs text-gray-600">
                                               <strong className="font-semibold text-gray-500">🪑 จัดห้อง:</strong>{' '}
                                               {booking.roomArrangement === 'classroom' && 'แบบห้องเรียนปกติ'}
                                               {booking.roomArrangement === 'u-shape' && 'แบบตัว U'}
                                               {booking.roomArrangement?.startsWith('other:') && `อื่นๆ — ${booking.roomArrangement.slice(6)}`}
                                               {booking.roomArrangement === 'other' && 'อื่นๆ'}
                                             </p>
                                           )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                           <div className="text-center py-6 px-4 bg-green-50 rounded-xl border border-green-200">
                                <p className="text-lg font-semibold text-green-800">✅ ว่าง</p>
                                <p className="text-sm text-green-700">ยังไม่มีรายการจองสำหรับห้องนี้ในวันที่เลือก</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center rounded-b-2xl gap-3">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        ปิด
                    </Button>
                     <Button variant="primary" size="sm" onClick={handleBookNow}>
                        จองห้องนี้
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default BookingDetailsModal;
