
import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';

interface HomePageProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectRoom: (room: Room, date: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ rooms, bookings, onSelectRoom }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const bookingsForDate = useMemo(() => {
    return bookings.filter(b => b.date === selectedDate && b.status === 'จองแล้ว');
  }, [bookings, selectedDate]);

  const getRoomStatus = (roomName: string) => {
    const roomBookings = bookingsForDate.filter(b => b.roomName === roomName);
    if (roomBookings.length > 0) {
      return (
        <div className="text-xs text-red-500">
          <p>จองแล้ว {roomBookings.length} รายการ</p>
          {roomBookings.map(b => <p key={b.id}>{b.startTime} - {b.endTime}</p>)}
        </div>
      );
    }
    return <p className="text-green-600 font-semibold">ว่าง</p>;
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">เลือกวันที่และห้องประชุม</h2>
      <div className="mb-6">
        <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700 mb-1">วันที่ต้องการจอง:</label>
        <input
          type="date"
          id="booking-date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div className="space-y-4">
        {rooms.map(room => (
          <div key={room.id} className={`p-4 rounded-lg flex flex-col md:flex-row justify-between items-center ${room.status === 'available' ? 'bg-gray-50' : 'bg-gray-200 opacity-70'}`}>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
              {room.status === 'available' ? getRoomStatus(room.name) : <p className="text-sm text-gray-500">ปิดปรับปรุง</p>}
            </div>
            <button
              onClick={() => onSelectRoom(room, selectedDate)}
              disabled={room.status !== 'available'}
              className="mt-3 md:mt-0 px-4 py-2 bg-[#0D448D] text-white rounded-md hover:bg-[#043986] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              จองห้องนี้
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
