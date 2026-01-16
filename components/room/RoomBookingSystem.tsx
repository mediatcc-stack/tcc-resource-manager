import React, { useState, useCallback, useEffect } from 'react';
import { RoomPage, Booking, Room } from '../../types';
import { ROOMS, STAFF_PASSWORDS } from '../../constants';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const data = await fetchData('rooms') as Booking[];
      setBookings(data);
      setLastUpdated(new Date());
    } catch (error: any) {
      if (!isBackground) {
        showToast(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
        setBookings([]);
      }
      console.error("Background fetch failed:", error);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [showToast]);

  // Initial fetch and polling
  useEffect(() => {
    fetchBookings();
    const pollInterval = setInterval(() => {
      fetchBookings(true); // Background fetch
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [fetchBookings]);

  // Status update interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let hasChanged = false;
      const bookingsToCheck = [...bookings];
      const updatedBookings = bookingsToCheck.map(b => {
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
        saveData('rooms', updatedBookings).then(() => {
          setBookings(updatedBookings);
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [bookings]);

  const handleSelectRoom = useCallback((room: Room, date: string) => {
    setSelectedRoom(room);
    setSelectedDate(date);
    setCurrentPage('booking');
    setEditingBooking(null);
  }, []);

  const handleBookingSubmit = useCallback(async (newBookingsData: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => {
    const createdBookings: Booking[] = newBookingsData.map(b => ({
      ...b,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'จองแล้ว',
    }));

    const updatedBookings = [...bookings, ...createdBookings];
    
    try {
      await saveData('rooms', updatedBookings);
      setBookings(updatedBookings); // Optimistic update
      setLastUpdated(new Date());

      const firstBooking = createdBookings[0];
      const roomNames = [...new Set(createdBookings.map(b => b.roomName))];
      const roomString = roomNames.length > 1 ? `ห้อง: ${roomNames.join(', ')}` : roomNames[0];
      
      const timeString = `${firstBooking.startTime} - ${firstBooking.endTime}`;
      const dateInfo = firstBooking.isMultiDay && firstBooking.dateRange
          ? `${firstBooking.dateRange}`
          : `${new Date(firstBooking.date).toLocaleDateString('th-TH')}`;

      const dateTimeLine = `${dateInfo} | ${timeString}`;

      const notifyMessage = [
          "------",
          "📌 มีการจองห้องใหม่",
          "",
          roomString,
          dateTimeLine,
          "",
          `ชื่องาน: ${firstBooking.purpose}`,
          `ผู้จอง: ${firstBooking.bookerName}`,
          "------"
      ].join('\n');

      await sendLineNotification(notifyMessage);
      
      setCurrentPage('home');
      showToast('การจองห้องสำเร็จ!', 'success');
      fetchBookings(true); // Fetch latest data silently
    } catch (error: any) {
      showToast(`บันทึกการจองไม่สำเร็จ: ${error.message}`, 'error');
      fetchBookings(); // Revert on failure
    }
  }, [bookings, showToast, fetchBookings]);
  
  const handleBookingUpdate = async (updatedBookingData: Booking) => {
    const updatedList = bookings.map(b => b.id === updatedBookingData.id ? updatedBookingData : b);
    const success = await updateBookingList(updatedList);
    if (success) {
      showToast('แก้ไขการจองสำเร็จ!', 'success');
      setCurrentPage('mybookings');
      setEditingBooking(null);
    }
  };

  const updateBookingList = async (newList: Booking[]): Promise<boolean> => {
    try {
      await saveData('rooms', newList);
      setBookings(newList);
      setLastUpdated(new Date());
      fetchBookings(true); // Trigger a silent refresh for other clients
      return true;
    } catch (error: any) {
      showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
      fetchBookings();
      return false;
    }
  };

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if(bookingToCancel) {
       const updated = bookings.map(b => b.id === bookingId ? { ...b, status: 'ยกเลิก' } : b);
       const success = await updateBookingList(updated);
       
       if (success) {
            showToast('ยกเลิกการจองเรียบร้อยแล้ว', 'success');
       }
    }
  }, [bookings, fetchBookings, showToast]);
  
  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const groupBookings = bookings.filter(b => b.groupId === groupId);
    if(groupBookings.length > 0) {
      const updated = bookings.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' } : b);
      const success = await updateBookingList(updated);

      if (success) {
            showToast('ยกเลิกการจองกลุ่มเรียบร้อยแล้ว', 'success');
      }
    }
  }, [bookings, fetchBookings, showToast]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
      const updated = bookings.filter(b => b.id !== bookingId);
      const success = await updateBookingList(updated);
      if(success) {
          showToast('ลบรายการจองถาวรสำเร็จ', 'success');
      }
  }, [bookings, fetchBookings]);
  
  const handleDeleteBookingGroup = useCallback(async (groupId: string) => {
      const updated = bookings.filter(b => b.groupId !== groupId);
      const success = await updateBookingList(updated);
      if(success) {
          showToast('ลบกลุ่มการจองถาวรสำเร็จ', 'success');
      }
  }, [bookings, fetchBookings]);


  const handleAdminLogin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      showToast('ออกจากโหมดแอดมิน', 'success');
      return;
    }
    const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
    if (password && STAFF_PASSWORDS.includes(password)) {
        setIsAdmin(true);
        showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
    } else if (password) {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
    }
  };

  const handleStartEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setCurrentPage('booking');
  };

  const handleNavigateToMyBookings = () => {
    setCurrentPage('mybookings');
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
        if (!selectedRoom && !editingBooking) {
            setCurrentPage('home');
            return null;
        }
        return (
          <BookingForm 
            room={editingBooking ? ROOMS.find(r => r.name === editingBooking.roomName)! : selectedRoom!} 
            rooms={ROOMS}
            date={editingBooking ? editingBooking.date : selectedDate} 
            existingBookings={bookings}
            onSubmit={handleBookingSubmit}
            onUpdate={handleBookingUpdate}
            bookingToEdit={editingBooking}
            onCancel={() => { setCurrentPage(editingBooking ? 'mybookings' : 'home'); setEditingBooking(null); }}
            showToast={showToast}
          />
        );
      case 'mybookings':
        return <MyBookingsPage 
                  bookings={bookings} 
                  onCancelBooking={handleCancelBooking} 
                  onCancelBookingGroup={handleCancelBookingGroup}
                  onDeleteBooking={handleDeleteBooking}
                  onDeleteBookingGroup={handleDeleteBookingGroup}
                  onEditBooking={handleStartEdit}
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
            onNavigateToMyBookings={handleNavigateToMyBookings}
          />
        );
    }
  };
  
  return (
    <div>
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex items-center justify-between gap-6 flex-wrap border border-gray-100">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <NavButton page="home" label="หน้าแรก/ปฏิทิน" icon="🏠" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavButton page="mybookings" label="รายการจองทั้งหมด" icon="📋" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavButton page="statistics" label="สถิติ" icon="📊" currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
        {lastUpdated && (
          <div className="text-xs text-gray-400 font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
          </div>
        )}
      </div>
      {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;