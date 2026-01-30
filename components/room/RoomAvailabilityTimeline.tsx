import React from 'react';
import { Booking } from '../../types';

interface RoomAvailabilityTimelineProps {
  bookings: Booking[];
  simplified?: boolean;
}

const RoomAvailabilityTimeline: React.FC<RoomAvailabilityTimelineProps> = ({ bookings, simplified = true }) => {
    if (simplified) { // This is the old, simple bar view. Currently unused in HomePage but kept for potential future use.
        return (
             <div className="relative h-4 w-full bg-sky-100 rounded-full overflow-hidden border border-sky-200">
                {bookings.map((b, index) => {
                    const start = parseInt(b.startTime.split(':')[0], 10);
                    const end = parseInt(b.endTime.split(':')[0], 10);
                    const left = ((start - 7) / 11) * 100;
                    const width = ((end - start) / 11) * 100;
                    return (
                        <div
                            key={index}
                            className="absolute h-full bg-gradient-to-r from-orange-400 to-red-500"
                            style={{ left: `${left}%`, width: `${width}%` }}
                        ></div>
                    );
                })}
            </div>
        );
    }
    
    // New detailed view for Modal
    const bookedIntervals = bookings.map(b => {
        const start = parseInt(b.startTime.split(':')[0], 10);
        const end = parseInt(b.endTime.split(':')[0], 10);
        return { start, end };
    });

    return (
        <div className="w-full">
            <div className="relative h-4 w-full bg-green-100 rounded-full overflow-hidden border border-green-200">
                {bookedIntervals.map((interval, index) => {
                    const left = ((interval.start - 7) / 12) * 100; // Total 12 hours from 7:00 to 19:00
                    const width = ((interval.end - interval.start) / 12) * 100;
                    return (
                        <div
                            key={index}
                            className="absolute h-full bg-gradient-to-r from-orange-400 to-red-500"
                            style={{ left: `${left}%`, width: `${width}%` }}
                        ></div>
                    );
                })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] font-semibold text-gray-400 px-1">
                <span>07:00</span>
                <span>13:00</span>
                <span>19:00</span>
            </div>
        </div>
    );
};

export default RoomAvailabilityTimeline;