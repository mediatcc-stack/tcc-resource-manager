import React from 'react';
import { Booking } from '../../types';

interface RoomAvailabilityTimelineProps {
  bookings: Booking[];
}

const timeSlots = Array.from({ length: 11 }, (_, i) => (i + 8)); // 8 to 18

const RoomAvailabilityTimeline: React.FC<RoomAvailabilityTimelineProps> = ({ bookings }) => {

    if (bookings.length === 0) {
        return (
            <div className="text-center">
                <div className="bg-green-50 text-green-600 px-8 py-2 rounded-full text-sm font-bold border border-green-100">
                    ✅ ว่างทั้งวัน
                </div>
                <p className="text-[11px] text-gray-400 font-bold mt-2">✨ ยังไม่มีการจองในวันที่เลือก</p>
            </div>
        );
    }
    
    const bookedIntervals = bookings.map(b => {
        const start = parseInt(b.startTime.split(':')[0], 10);
        const end = parseInt(b.endTime.split(':')[0], 10);
        return { start, end };
    });

    return (
        <div className="w-full">
            <div className="relative h-4 w-full bg-green-100 rounded-full overflow-hidden border border-green-200">
                {bookedIntervals.map((interval, index) => {
                    const left = ((interval.start - 8) / 10) * 100; // 10 hours total (8 to 18)
                    const width = ((interval.end - interval.start) / 10) * 100;
                    return (
                        <div
                            key={index}
                            className="absolute h-full bg-gradient-to-r from-orange-400 to-red-500"
                            style={{ left: `${left}%`, width: `${width}%` }}
                        ></div>
                    );
                })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] font-semibold text-gray-400 px-1">
                <span>08:00</span>
                <span>13:00</span>
                <span>18:00</span>
            </div>
            <p className="text-center text-xs text-orange-600 font-bold mt-2 bg-orange-50 py-1 rounded-full border border-orange-100">
                มี {bookings.length} รายการจอง
            </p>
        </div>
    );
};

export default RoomAvailabilityTimeline;
