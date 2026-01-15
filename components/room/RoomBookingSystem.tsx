
import React, { useState, useCallback, useEffect } from 'react';
import { RoomPage, Booking, Room } from '../../types';
import { ROOMS, ADMIN_PASSWORDS } from '../../constants';
import HomePage from './HomePage';
import BookingForm from './BookingForm';
import MyBookingsPage from './MyBookingsPage';
import StatisticsPage from './StatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { fetchData, saveData } from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import NavButton from './NavButton'; // Import the new NavButton component
import LoadingSpinner from '../shared/LoadingSpinner';

interface RoomBookingSystemProps {
  onBackToLanding: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const RoomBookingSystem: React.FC<RoomBookingSystemProps> = ({ onBackToLanding, showToast }) => {
  const [currentPage, setCurrentPage] = useState<RoomPage>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchData('rooms') as Booking[];
    setBookings(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let hasChanged = false;
      const updatedBookings = bookings.map(b => {
        if (b.status === 'จองแล้ว') {
          const bookingDateTime = new Date(`${b.date}T${b.endTime}`);
          if (bookingDateTime < now) {
            hasChanged = true;
            return { ...b, status: 'หมดเวลา' };
          }
        }
        return b;
      });
      
      if (hasChanged) {
        setBookings(updatedBookings);
        saveData('rooms', updatedBookings);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [bookings]);

  const handleSelectRoom = useCallback((room: Room, date: string) => {
    setSelectedRoom(room);
    setSelectedDate(date);
    setCurrentPage('booking');
  }, []);

  const handleBookingSubmit = useCallback(async (newBookingsData: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => {
    const createdBookings: Booking[] = newBookingsData.map(b => ({
      ...b,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'จองแล้ว',
    }));

    const updatedBookings = [...bookings, ...createdBookings];
    setBookings(updatedBookings);
    const success = await saveData('rooms', updatedBookings);

    if (success) {
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
    } else {
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
      await fetchBookings(); // Re-sync with server
    }
  }, [bookings, showToast, fetchBookings]);

  const updateBookingStatus = async (updatedBookings: Booking[]) => {
      setBookings(updatedBookings);
      const success = await saveData('rooms', updatedBookings);
      if (!success) {
          showToast('เกิดข้อผิดพลาดในการอัปเดตข้อมูล', 'error');
          await fetchBookings();
      }
      return success;
  };

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if(bookingToCancel) {
       const updated = bookings.map(b => b.id === bookingId ? { ...b, status: 'ยกเลิก' } : b);
       const success = await updateBookingStatus(updated);
       
       if (success) {
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
    }
  }, [bookings, showToast, fetchBookings]);
  
  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const groupBookings = bookings.filter(b => b.groupId === groupId);
    if(groupBookings.length > 0) {
      const updated = bookings.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' } : b);
      const success = await updateBookingStatus(updated);

      if (success) {
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
    }
  }, [bookings, showToast, fetchBookings]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
      if (!isAdmin) {
          showToast('ต้องใช้สิทธิ์แอดมินในการลบ', 'error');
          return;
      }
      const updated = bookings.filter(b => b.id !== bookingId);
      const success = await updateBookingStatus(updated);
      if(success) {
          showToast('ลบรายการจองถาวรสำเร็จ', 'success');
      }
  }, [bookings, isAdmin, showToast, fetchBookings]);

  const handleAdminLogin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      showToast('ออกจากโหมดแอดมิน', 'success');
      return;
    }
    const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
    if (password && ADMIN_PASSWORDS.includes(password)) {
        setIsAdmin(true);
        showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
    } else if (password) {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
    }
  };


  const renderCurrentPage = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-xl">
          <LoadingSpinner />
          <p className="mt-4 text-lg font-semibold text-gray-600">กำลังโหลดข้อมูลการจอง...</p>
        </div>
      );
    }

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
            showToast={showToast}
          />
        );
      case 'mybookings':
        return <MyBookingsPage 
                  bookings={bookings} 
                  onCancelBooking={handleCancelBooking} 
                  onCancelBookingGroup={handleCancelBookingGroup}
                  onDeleteBooking={handleDeleteBooking}
                  onBack={() => setCurrentPage('home')}
                  isAdmin={isAdmin}
                  onAdminLogin={handleAdminLogin}
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
  
  return (
    <div>
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex items-center justify-center gap-6 flex-wrap border border-gray-100">
            <NavButton page="home" label="หน้าแรก/ปฏิทิน" icon="🏠" currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <NavButton page="mybookings" label="รายการจองทั้งหมด" icon="📋" currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <NavButton page="statistics" label="สถิติ" icon="📊" currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
        {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;
