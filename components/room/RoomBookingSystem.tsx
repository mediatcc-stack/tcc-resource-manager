

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RoomPage, Booking, Room } from '../../types';
import { ROOMS, STAFF_PASSWORDS, APP_URL } from '../../constants';
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
import Modal from '../shared/Modal';
import GroupIdFinder from '../admin/GroupIdFinder';

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
  const [isGroupIdModalOpen, setIsGroupIdModalOpen] = useState(false);
  
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

  // ฟังก์ชันส่งรายงานสรุปประจำวัน (กดส่งเอง)
  const handleSendDailyReport = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings
        .filter(b => b.date === today && b.status === 'จองแล้ว')
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length === 0) {
        showToast('วันนี้ไม่มีรายการจองห้องประชุม', 'error');
        return;
    }

    let reportMsg = `📊 รายงานการใช้ห้อง (วันนี้)\n`;
    reportMsg += `---------------------\n`;
    
    todayBookings.forEach((b, index) => {
        reportMsg += `${index + 1}. 🕓 ${b.startTime}-${b.endTime}\n`;
        reportMsg += `📍 ${b.roomName}\n`;
        reportMsg += `📝 ${b.purpose}\n`;
        reportMsg += `👤 ${b.bookerName}\n\n`;
    });

    reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ\n${APP_URL}`;

    const confirmSend = confirm('ยืนยันการส่งรายงานสรุปการใช้ห้องวันนี้ไปยัง LINE กลุ่ม?');
    if (confirmSend) {
        setIsSyncing(true);
        try {
            await sendLineNotification(reportMsg);
            showToast('ส่งรายงานเข้า LINE เรียบร้อยแล้ว', 'success');
        } catch (e) {
            showToast('ส่งรายงานไม่สำเร็จ', 'error');
        } finally {
            setIsSyncing(false);
        }
    }
  };

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
    if (await updateBookingList(updated)) {
      showToast('ยกเลิกรายการจองแล้ว', 'success');
    }
  }, [bookings, showToast]);

  const handleCancelBookingGroup = useCallback(async (groupId: string) => {
    const updated = bookings.map(b => b.groupId === groupId ? { ...b, status: 'ยกเลิก' as const } : b);
    if (await updateBookingList(updated)) {
      showToast('ยกเลิกรายการจองกลุ่มแล้ว', 'success');
    }
  }, [bookings, showToast]);

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
                  onShowGroupIdHelp={() => setIsGroupIdModalOpen(true)}
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
            onSendReport={handleSendDailyReport}
          />
        );
    }
  };
  
  return (
    <div className="animate-fade-in">
      {isGroupIdModalOpen && (
        <Modal title="วิธีหา Group ID จาก LINE Developers" onClose={() => setIsGroupIdModalOpen(false)}>
          <GroupIdFinder />
        </Modal>
      )}
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
                    {connectionStatus === 'connected' ? 'เชื่อมต่อแล้ว' : 
                     connectionStatus === 'syncing' ? 'กำลังซิงค์...' : 
                     'ไม่ได้เชื่อมต่อ'}
                </span>
            </div>
        </div>
      </div>
      {renderCurrentPage()}
    </div>
  );
};

export default RoomBookingSystem;