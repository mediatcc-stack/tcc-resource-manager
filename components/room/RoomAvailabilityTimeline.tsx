import React from 'react';
import { Booking } from '../../types';

interface RoomAvailabilityTimelineProps {
  bookings: Booking[];
}

const RoomAvailabilityTimeline: React.FC<RoomAvailabilityTimelineProps> = ({ bookings }) => {
    if (bookings.length === 0) {
        return (
            <div className="text-center">
                <div className="bg-sky-50 text-sky-600 px-8 py-2 rounded-full text-sm font-bold border border-sky-100">
                    ✅ ว่างทั้งวัน
                </div>
                <p className="text-[11px] text-gray-400 font-bold mt-2">✨ แตะเพื่อดูรายละเอียดเพิ่มเติม</p>
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
            <div className="relative h-4 w-full bg-sky-100 rounded-full overflow-hidden border border-sky-200">
                {bookedIntervals.map((interval, index) => {
                    const left = ((interval.start - 7) / 11) * 100; // 11 hours total (7 to 18)
                    const width = ((interval.end - interval.start) / 11) * 100;
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
                <span>07:00</span>
                <span>12:00</span>
                <span>18:00</span>
            </div>
            <p className="text-center text-xs text-red-600 font-bold mt-2 bg-red-50 py-2 px-4 rounded-full border border-red-100">
                มี {bookings.length} รายการจอง (คลิกเพื่อดู)
            </p>
        </div>
    );
};

export default RoomAvailabilityTimeline;