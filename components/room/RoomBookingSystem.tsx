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
import Button from '../shared/Button';

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
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
  
  const pollTimer = useRef<number | null>(null);

  const fetchBookings = useCallback(async (isBackground = false) => {
    if (!isBackground) {
        setIsLoading(true);
        setError(null);
    } else {
        setIsSyncing(true);
        setConnectionStatus('syncing');
    }
    
    try {
      const data = await fetchData('rooms') as Booking[];
      setBookings(data);
      setLastUpdated(new Date());
      setError(null);
      setConnectionStatus('connected');
    } catch (err: any) {
      const errorMessage = err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล';
      setConnectionStatus('error');
      if (!isBackground) {
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } else {
        // หากเป็นการซิงค์เบื้องหลังล้มเหลว แค่แจ้งเตือนเบาๆ
        console.warn('Background sync failed:', errorMessage);
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
      fetchBookings(true);
      return false;
    }
  };

  const handleBookingUpdate = useCallback(async (original: Booking, formData: any, selectedRoomIds: number[]) => {
    setIsLoading(true);
    try {
      let newList = bookings.filter(b => original.groupId ? b.groupId !== original.groupId : b.id !== original.id);
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
      const roomNames = [...new Set(createdBookings.map(b => b.roomName))].join(', ');
      const dateInfo = firstBooking.isMultiDay && firstBooking.dateRange ? firstBooking.dateRange : new Date(firstBooking.date).toLocaleDateString('th-TH');
      const timeInfo = `${firstBooking.startTime} - ${firstBooking.endTime}`;
      const notifyMessage = `📢 มีการจองห้องใหม่\n\nห้อง: ${roomNames}\nวันที่: ${dateInfo}\nเวลา: ${timeInfo}\n\nเรื่อง: ${firstBooking.purpose}\nผู้จอง: ${firstBooking.bookerName}\n\n🔗 ตรวจสอบรายละเอียดในระบบ`;

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
          <p className="mt-4 text-lg font-semibold text-gray-600">กำลังดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์...</p>
        </div>
      );
    }

    if (error && bookings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl shadow-xl text-center p-10 border-2 border-red-50">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">🔌</span>
          </div>
          <p className="text-2xl font-black text-red-600 mb-4">โหลดข้อมูลไม่สำเร็จ</p>
          <div className="bg-red-50 p-4 rounded-xl mb-8 max-w-md mx-auto">
            <p className="text-sm text-red-700 font-medium break-words leading-relaxed">
               {error}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => fetchBookings(false)} className="px-8 py-3">
              🔄 ลองใหม่อีกครั้ง
            </Button>
            <Button variant="secondary" onClick={onBackToLanding} className="px-8 py-3">
              🏠 กลับหน้าหลัก
            </Button>
          </div>
          <p className="mt-8 text-xs text-gray-400 font-bold uppercase tracking-widest">
            หากยังพบปัญหากรุณาติดต่อฝ่ายไอที
          </p>
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
    <div className="animate-fade-in">
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-8 flex items-center justify-between gap-6 flex-wrap border border-gray-100">
        <div className="flex items-center justify-center gap-3 md:gap-6 flex-wrap">
          <NavButton page="home" label="หน้าแรก" icon="🏠" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavButton page="mybookings" label="จัดการจอง" icon="📋" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavButton page="statistics" label="สรุปรายงาน" icon="📊" currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                    connectionStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 
                    'bg-red-500'
                }`}></span>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                    {connectionStatus === 'connected' ? 'Connected' : 
                     connectionStatus === 'syncing' ? 'Syncing...' : 
                     'Offline'}
                </span>
            </div>
            {lastUpdated && (
              <button 
                onClick={() => fetchBookings(false)}
                title="กดเพื่อรีเฟรชข้อมูลใหม่"
                className="group text-xs text-gray-400 font-bold flex items-center gap-2 hover:text-blue-600 transition-all p-2 rounded-lg hover:bg-blue-50"
              >
                {lastUpdated.toLocaleTimeString('th-TH')}
                <span className={`text-lg transition-transform duration-500 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180'}`}>🔄</span>
              </button>
            )}
        </div>
      </div>
      {renderCurrentPage()}
      
      {/* แจ้งเตือนหากรายการว่างเปล่าแต่โหลดสำเร็จ */}
      {!isLoading && !error && bookings.length === 0 && currentPage === 'home' && (
        <div className="mt-8 p-6 bg-blue-50 border-2 border-dashed border-blue-200 rounded-3xl text-center">
            <p className="text-blue-800 font-bold mb-1">🔍 เชื่อมต่อสำเร็จ แต่ไม่พบข้อมูลการจองในระบบ</p>
            <p className="text-xs text-blue-500">หากคุณมั่นใจว่าเคยมีการจอง กรุณาตรวจสอบว่าใช้ Worker URL ที่ถูกต้องหรือไม่</p>
        </div>
      )}
    </div>
  );
};

export default RoomBookingSystem;