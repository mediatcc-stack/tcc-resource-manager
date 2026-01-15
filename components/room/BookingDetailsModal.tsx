import React from 'react';
import { Booking } from '../../types';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookings: Booking[];
    date: string;
    roomName?: string;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({ isOpen, onClose, bookings, date, roomName }) => {
    if (!isOpen) return null;

    const formattedDate = new Date(date).toLocaleDateString('th-TH');

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-[#0D448D]">
                       {roomName ? `จองสำหรับ ${roomName}` : 'รายการจอง'} - วันที่ {formattedDate}
                    </h3>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {bookings.length > 0 ? (
                        <div className="space-y-4">
                            {bookings.map(booking => {
                                const bookingText = [
                                    `${booking.startTime} - ${booking.endTime}`,
                                    "",
                                    `ชื่องาน: ${booking.purpose}`,
                                    `ผู้จอง: ${booking.bookerName}`
                                ].join('\n');

                                return (
                                    <div key={booking.id}>
                                        <pre className="font-sans text-sm text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap">
                                            {bookingText}
                                        </pre>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                           ✅ ไม่มีรายการจองสำหรับห้องนี้ในวันที่เลือก
                        </p>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-right rounded-b-2xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-all"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingDetailsModal;