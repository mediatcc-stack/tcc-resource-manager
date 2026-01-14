
import React, { useMemo } from 'react';
import { Booking } from '../../types';
import { ROOMS } from '../../constants';

interface StatisticsPageProps {
  bookings: Booking[];
}

const StatisticsPage: React.FC<StatisticsPageProps> = ({ bookings }) => {
  const stats = useMemo(() => {
    const activeBookings = bookings.filter(b => b.status === 'จองแล้ว' || b.status === 'หมดเวลา');
    
    const bookingsByRoom = ROOMS.map(room => {
      const roomBookings = activeBookings.filter(b => b.roomName === room.name);
      return {
        name: room.name,
        count: roomBookings.length,
      };
    }).sort((a,b) => b.count - a.count);

    const totalBookings = activeBookings.length;
    
    return {
      totalBookings,
      bookingsByRoom,
    };
  }, [bookings]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">สถิติการใช้งานห้องประชุม</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg text-center">
            <p className="text-lg text-blue-800 font-semibold">จำนวนการจองทั้งหมด</p>
            <p className="text-5xl font-bold text-blue-600">{stats.totalBookings}</p>
            <p className="text-blue-800">รายการ (ที่ไม่ถูกยกเลิก)</p>
        </div>
        
        <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-3 text-center">อันดับห้องยอดนิยม</h3>
            <ul className="space-y-2">
                {stats.bookingsByRoom.map((room, index) => (
                    <li key={room.name} className="flex justify-between items-center bg-white p-3 rounded-md">
                        <span className="font-medium text-gray-700">{index + 1}. {room.name}</span>
                        <span className="font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">{room.count} ครั้ง</span>
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
