
import React, { useState, useCallback, useEffect } from 'react';
import { RoomPage, Booking, Room, ToastMessage } from '../../types';
import { ROOMS } from '../../constants';
import HomePage from './HomePage';
import BookingForm from './BookingForm';
import MyBookingsPage from './MyBookingsPage';
import StatisticsPage from './StatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

interface RoomBookingSystemProps {
  onBackToLanding: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const RoomBookingSystem: React.FC<RoomBookingSystemProps> = ({ onBackToLanding, showToast }) => {
  const [currentPage, setCurrentPage] = useState<RoomPage>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const savedBookings = localStorage.getItem('roomBookings');
      return savedBookings ? JSON.parse(savedBookings) : [];
    // FIX: Added braces around the catch block to fix syntax error.
    } catch (error) {
      console.error("Error reading bookings from localStorage", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('roomBookings', JSON.stringify(bookings));
    } catch (error) {
      console.error("Error saving bookings to localStorage", error);
    }
  }, [bookings]);


  useEffect(() => {
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
    const dateString = firstBooking.isMultiDay && firstBooking.dateRange 
      ? `ช่วงวันที่: ${firstBooking.dateRange}`
      : `วันที่: ${new Date(firstBooking.date).toLocaleDateString('th-TH')}`;

    const notifyMessage = `รายงานใหม่\n
🗓️ จองห้องใหม่
ชื่องาน: ${firstBooking.purpose}
ห้อง: ${firstBooking.roomName}
${dateString}
เวลา: ${firstBooking.startTime} - ${firstBooking.endTime}
ผู้ขอจอง: ${firstBooking.bookerName}`.trim();

    await sendLineNotification(notifyMessage);
    
    setCurrentPage('home');
    showToast('การจองห้องสำเร็จ!', 'success');
  }, [showToast]);

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if(bookingToCancel) {
       setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'ยกเลิก' } : b));
       const formattedDate = new Date(bookingToCancel.date).toLocaleDateString('th-TH');
       const notifyMessage = `รายงานใหม่\n
❌ ยกเลิกการจอง
ชื่องาน: ${bookingToCancel.purpose}
ห้อง: ${bookingToCancel.roomName}
วันที่: ${formattedDate}
เวลา: ${bookingToCancel.startTime} - ${bookingToCancel.endTime}
ผู้ยกเลิก: ${bookingToCancel.bookerName}`.trim();

       await sendLineNotification(notifyMessage);
       
       showToast('ยกเลิกการจองเรียบร้อยแล้ว', 'success');
    }
  }, [bookings, showToast]);
  
  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const groupBookings = bookings.filter(b => b.groupId === groupId);
    if(groupBookings.length > 0) {
      setBookings(prev => prev.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' } : b));
      const firstBooking = groupBookings[0];
       const notifyMessage = `รายงานใหม่\n
❌ ยกเลิกการจอง (หลายวัน)
ชื่องาน: ${firstBooking.purpose}
ห้อง: ${firstBooking.roomName}
ช่วงวันที่: ${firstBooking.dateRange}
เวลา: ${firstBooking.startTime} - ${firstBooking.endTime}
ผู้ยกเลิก: ${firstBooking.bookerName}`.trim();

       await sendLineNotification(notifyMessage);
       
       showToast('ยกเลิกการจองกลุ่มเรียบร้อยแล้ว', 'success');
    }
  }, [bookings, showToast]);

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
            rooms={ROOMS}
            date={selectedDate} 
            existingBookings={bookings}
            onSubmit={handleBookingSubmit}
            onCancel={() => setCurrentPage('home')}
          />
        );
      case 'mybookings':
        return <MyBookingsPage 
                  bookings={bookings} 
                  onCancelBooking={handleCancelBooking} 
                  onCancelBookingGroup={handleCancelBookingGroup}
                  onBack={() => setCurrentPage('home')}
                />;
      case 'statistics':
        return <StatisticsPage bookings={bookings} onBack={() => setCurrentPage('home')} />;
      case 'home':
      default:
        return (
          <HomePage 
            rooms={ROOMS} 
            bookings={bookings} 
            onSelectRoom={handleSelectRoom}
            onBackToLanding={onBackToLanding}
          />
        );
    }
  };
  
  const NavButton: React.FC<{page: RoomPage, label: string, icon: string}> = ({ page, label, icon }) => {
    const isActive = currentPage === page;
    const baseClasses = 'flex items-center gap-2 text-sm font-semibold rounded-lg transition-all duration-300';
    const activeClasses = 'bg-[#0D448D] text-white px-4 py-2 shadow-md';
    const inactiveClasses = 'bg-transparent text-gray-500 hover:text-[#0D448D] px-2 py-2';

    return (
        <button 
        onClick={() => setCurrentPage(page)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
        <span>{icon}</span> {label}
        </button>
    );
  };

  return (
    <div>
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex items-center justify-center gap-6 flex-wrap border border-gray-100">
            <NavButton page="home" label="หน้าแรก/ปฏิทิน" icon="🏠" />
            <NavButton page="mybookings" label="รายการจองทั้งหมด" icon="📋" />
            <NavButton page="statistics" label="สถิติ" icon="📊" />
        </div>
        {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;