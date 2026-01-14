
import React, { useState, useCallback, useEffect } from 'react';
import { RoomPage, Booking, Room } from '../../types';
import { ROOMS } from '../../constants';
import HomePage from './HomePage';
import BookingForm from './BookingForm';
import MyBookingsPage from './MyBookingsPage';
import StatisticsPage from './StatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

// Mock API data - In a real app, this would come from a context or a hook like useSWR/ReactQuery
const MOCK_BOOKINGS: Booking[] = [
    // This will be populated by the component's state
];

const RoomBookingSystem: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<RoomPage>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);

  useEffect(() => {
    // Simulate checking for expired bookings every minute
    const interval = setInterval(() => {
      const now = new Date();
      setBookings(prevBookings => 
        prevBookings.map(b => {
          if (b.status === 'จองแล้ว') {
            const bookingDateTime = new Date(`${b.date}T${b.endTime}`);
            if (bookingDateTime < now) {
              return { ...b, status: 'หมดเวลา' };
            }
          }
          return b;
        })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectRoom = useCallback((room: Room, date: string) => {
    setSelectedRoom(room);
    setSelectedDate(date);
    setCurrentPage('booking');
  }, []);

  const handleBookingSubmit = useCallback(async (newBookings: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => {
    const createdBookings: Booking[] = newBookings.map(b => ({
      ...b,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'จองแล้ว',
    }));

    setBookings(prev => [...prev, ...createdBookings]);

    const firstBooking = createdBookings[0];
    const notifyMessage = `จองห้องใหม่: ${firstBooking.roomName}\nผู้จอง: ${firstBooking.bookerName}\nวันที่: ${firstBooking.date}\nเวลา: ${firstBooking.startTime}-${firstBooking.endTime}`;
    await sendLineNotification(notifyMessage);
    setCurrentPage('home');
  }, []);

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if(bookingToCancel) {
       setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'ยกเลิก' } : b));
       const notifyMessage = `ยกเลิกการจอง: ${bookingToCancel.roomName}\nผู้จอง: ${bookingToCancel.bookerName}\nวันที่: ${bookingToCancel.date}`;
       await sendLineNotification(notifyMessage);
    }
  }, [bookings]);
  
  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const groupBookings = bookings.filter(b => b.groupId === groupId);
    if(groupBookings.length > 0) {
      setBookings(prev => prev.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' } : b));
      const firstBooking = groupBookings[0];
      const notifyMessage = `ยกเลิกการจอง (หลายวัน): ${firstBooking.roomName}\nผู้จอง: ${firstBooking.bookerName}\nช่วง: ${firstBooking.dateRange}`;
       await sendLineNotification(notifyMessage);
    }
  }, [bookings]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'booking':
        if (!selectedRoom) {
            setCurrentPage('home');
            return null;
        }
        return (
          <BookingForm 
            room={selectedRoom} 
            date={selectedDate} 
            existingBookings={bookings}
            onSubmit={handleBookingSubmit}
            onCancel={() => setCurrentPage('home')}
          />
        );
      case 'mybookings':
        return <MyBookingsPage bookings={bookings} onCancelBooking={handleCancelBooking} onCancelBookingGroup={handleCancelBookingGroup}/>;
      case 'statistics':
        return <StatisticsPage bookings={bookings} />;
      case 'home':
      default:
        return (
          <HomePage 
            rooms={ROOMS} 
            bookings={bookings} 
            onSelectRoom={handleSelectRoom} 
          />
        );
    }
  };
  
  const NavButton: React.FC<{page: RoomPage, label: string}> = ({ page, label }) => (
    <button 
      onClick={() => setCurrentPage(page)}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${currentPage === page ? 'bg-[#0D448D] text-white' : 'bg-white text-[#0D448D] hover:bg-blue-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div>
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex items-center justify-center gap-2 flex-wrap">
            <NavButton page="home" label="🏠 หน้าแรก" />
            <NavButton page="mybookings" label="📋 รายการจองของฉัน" />
            <NavButton page="statistics" label="📊 สถิติ" />
        </div>
        {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;
