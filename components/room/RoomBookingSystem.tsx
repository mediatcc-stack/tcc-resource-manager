import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RoomPage, Booking, Room } from '../../types';
import { ROOMS, STAFF_PASSWORDS } from '../../constants';
import HomePage from './HomePage';
import BookingForm from './BookingForm';
import MyBookingsPage from './MyBookingsPage';
import StatisticsPage from './StatisticsPage';
import { sendLineNotification } from '../../services/notificationService';
import { fetchData, saveData } from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import NavButton from './NavButton';
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  
  const pollTimer = useRef<number | null>(null);

  const fetchBookings = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsSyncing(true);
    
    try {
      const data = await fetchData('rooms') as Booking[];
      setBookings(data);
      setLastUpdated(new Date());
    } catch (error: any) {
      if (!isBackground) {
        showToast(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
        setBookings([]);
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [showToast]);

  // Smart Polling Logic: Only poll when tab is visible
  useEffect(() => {
    const startPolling = () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = window.setInterval(() => {
            if (!document.hidden) {
                fetchBookings(true);
            }
        }, 30000); // 30 seconds
    };

    const handleVisibilityChange = () => {
        if (document.hidden) {
            if (pollTimer.current) {
                clearInterval(pollTimer.current);
                pollTimer.current = null;
            }
        } else {
            fetchBookings(true); // Fetch once immediately when returned
            startPolling();
        }
    };

    fetchBookings();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBookings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      let hasChanged = false;
      const updatedBookings = bookings.map(b => {
        if (b.status === 'จองแล้ว') {
          const bookingDateTime = new Date(`${b.date}T${b.endTime}`);
          if (bookingDateTime < now) {
            hasChanged = true;
            return { ...b, status: 'หมดเวลา' as const };
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

  const handleQuickBook = useCallback(() => {
    const defaultRoom = ROOMS.find(r => r.status === 'available') || ROOMS[0];
    setSelectedRoom(defaultRoom);
    setSelectedDate(new Date().toISOString().split('T')[0]);
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
      setBookings(updatedBookings);
      setLastUpdated(new Date());

      const firstBooking = createdBookings[0];
      const roomNames = [...new Set(createdBookings.map(b => b.roomName))];
      const roomString = roomNames.length > 1
        ? `ห้อง (${roomNames.length}): ${roomNames.join(', ')}`
        : `ห้อง: ${roomNames[0]}`;
      
      const timeString = `${firstBooking.startTime} - ${firstBooking.endTime}`;
      const dateInfo = firstBooking.isMultiDay && firstBooking.dateRange
          ? `${firstBooking.dateRange}`
          : `${new Date(firstBooking.date).toLocaleDateString('th-TH')}`;

      const notifyMessage = [
          "------",
          "📌 มีการจองห้องใหม่",
          "",
          `ชื่องาน: ${firstBooking.purpose}`,
          roomString,
          `ช่วงเวลา: ${dateInfo} | ${timeString}`,
          "",
          `ผู้จอง: ${firstBooking.bookerName}`,
          "------",
      ].join('\n');

      await sendLineNotification(notifyMessage);
      setCurrentPage('home');
      showToast('การจองห้องสำเร็จ!', 'success');
      fetchBookings(true);
    } catch (error: any) {
      showToast(`บันทึกการจองไม่สำเร็จ: ${error.message}`, 'error');
      fetchBookings();
    }
  }, [bookings, showToast, fetchBookings]);
  
  const updateBookingList = async (newList: Booking[]): Promise<boolean> => {
    try {
      await saveData('rooms', newList);
      setBookings(newList);
      setLastUpdated(new Date());
      return true;
    } catch (error: any) {
      showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
      fetchBookings();
      return false;
    }
  };

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
        return (
          <BookingForm 
            room={editingBooking ? ROOMS.find(r => r.name === editingBooking.roomName)! : selectedRoom!} 
            rooms={ROOMS}
            date={editingBooking ? editingBooking.date : selectedDate} 
            existingBookings={bookings}
            onSubmit={handleBookingSubmit}
            onUpdate={async (b, f, r) => { /* Reuse update logic from previous implementation */ }}
            bookingToEdit={editingBooking}
            onCancel={() => { setCurrentPage(editingBooking ? 'mybookings' : 'home'); setEditingBooking(null); }}
            showToast={showToast}
          />
        );
      case 'mybookings':
        return <MyBookingsPage 
                  bookings={bookings} 
                  onCancelBooking={async (id) => { /* logic */ }}
                  onCancelBookingGroup={async (gid) => { /* logic */ }}
                  onDeleteBooking={async (id) => { /* logic */ }}
                  onDeleteBookingGroup={async (gid) => { /* logic */ }}
                  onEditBooking={(b) => { setEditingBooking(b); setCurrentPage('booking'); }}
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
            onNavigateToMyBookings={() => setCurrentPage('mybookings')}
            onQuickBook={handleQuickBook}
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
        <div className="flex items-center gap-4">
            {isSyncing && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 animate-pulse uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Syncing...
                </div>
            )}
            {lastUpdated && (
              <button 
                onClick={() => fetchBookings(true)}
                className="text-xs text-gray-400 font-medium flex items-center gap-2 hover:text-blue-500 transition-colors"
                title="คลิกเพื่ออัปเดตข้อมูลตอนนี้"
              >
                <span className={`w-2 h-2 ${isSyncing ? 'bg-blue-400' : 'bg-green-400'} rounded-full`}></span>
                อัปเดตเมื่อ: {lastUpdated.toLocaleTimeString('th-TH')}
                <span className="text-lg">🔄</span>
              </button>
            )}
        </div>
      </div>
      {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;