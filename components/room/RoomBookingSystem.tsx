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

  useEffect(() => {
    const startPolling = () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = window.setInterval(() => {
            if (!document.hidden) {
                fetchBookings(true);
            }
        }, 30000);
    };

    const handleVisibilityChange = () => {
        if (document.hidden) {
            if (pollTimer.current) {
                clearInterval(pollTimer.current);
                pollTimer.current = null;
            }
        } else {
            fetchBookings(true);
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

  const updateBookingList = async (newList: Booking[]): Promise<boolean> => {
    try {
      await saveData('rooms', newList);
      setBookings(newList);
      setLastUpdated(new Date());
      fetchBookings(true);
      return true;
    } catch (error: any) {
      showToast(`อัปเดตข้อมูลไม่สำเร็จ: ${error.message}`, 'error');
      fetchBookings();
      return false;
    }
  };

  const handleBookingUpdate = useCallback(async (original: Booking, formData: any, selectedRoomIds: number[]) => {
    setIsLoading(true);
    try {
      // 1. Remove old version (group or single)
      let newList = bookings.filter(b => original.groupId ? b.groupId !== original.groupId : b.id !== original.id);

      // 2. Create new versions
      const newBookings: Booking[] = [];
      const hasMultiple = selectedRoomIds.length > 1 || formData.isMultiDay;
      const groupId = hasMultiple ? (original.groupId || uuidv4()) : undefined;
      
      const firstDate = new Date(formData.date);
      const lastDate = formData.isMultiDay ? new Date(formData.endDate) : firstDate;

      for (const rid of selectedRoomIds) {
        const rName = ROOMS.find(r => r.id === rid)?.name || original.roomName;
        for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
          newBookings.push({
            ...formData,
            id: uuidv4(),
            roomName: rName,
            date: d.toISOString().split('T')[0],
            groupId,
            status: 'จองแล้ว',
            createdAt: original.createdAt,
          });
        }
      }

      const success = await updateBookingList([...newList, ...newBookings]);
      if (success) {
        showToast('แก้ไขข้อมูลการจองเรียบร้อยแล้ว', 'success');
        setCurrentPage('home');
        setEditingBooking(null);
      }
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [bookings, showToast]);

  const handleCancelBooking = useCallback(async (id: string) => {
    const updated = bookings.map(b => b.id === id ? { ...b, status: 'ยกเลิก' as const } : b);
    if (await updateBookingList(updated)) showToast('ยกเลิกรายการจองแล้ว', 'success');
  }, [bookings]);

  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const updated = bookings.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' as const } : b);
    if (await updateBookingList(updated)) showToast('ยกเลิกรายการจองกลุ่มแล้ว', 'success');
  }, [bookings]);

  const handleDeleteBooking = useCallback(async (id: string) => {
    const updated = bookings.filter(b => b.id !== id);
    if (await updateBookingList(updated)) showToast('ลบรายการถาวรแล้ว', 'success');
  }, [bookings]);

  const handleDeleteBookingGroup = useCallback(async (groupId: string) => {
    const updated = bookings.filter(b => b.groupId !== groupId);
    if (await updateBookingList(updated)) showToast('ลบรายการกลุ่มถาวรแล้ว', 'success');
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
      const notifyMessage = `📌 มีการจองห้องใหม่\nเรื่อง: ${firstBooking.purpose}\nผู้จอง: ${firstBooking.bookerName}`;

      await sendLineNotification(notifyMessage);
      setCurrentPage('home');
      showToast('การจองห้องสำเร็จ!', 'success');
      fetchBookings(true);
    } catch (error: any) {
      showToast(`บันทึกการจองไม่สำเร็จ: ${error.message}`, 'error');
    }
  }, [bookings, showToast, fetchBookings]);

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