

import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';
import BookingDetailsModal from './BookingDetailsModal';
import RoomAvailabilityTimeline from './RoomAvailabilityTimeline';
import Button from '../shared/Button';

interface HomePageProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectRoom: (room: Room, date: string) => void;
  onBackToLanding: () => void;
  onNavigateToMyBookings: () => void;
  onQuickBook: () => void;
}

const getRoomStatusInfo = (room: Room, roomBookings: Booking[]) => {
    if (room.status === 'closed') {
        return { icon: '🔧', text: 'ไม่พร้อมใช้งาน', textColor: 'text-gray-600' };
    }
    if (roomBookings.length === 0) {
        return { icon: '🟢', text: 'ว่าง', textColor: 'text-green-700' };
    }
    return { icon: '📅', text: 'มีการจอง', textColor: 'text-blue-700' };
};


const HomePage: React.FC<HomePageProps> = ({ rooms, bookings, onSelectRoom, onNavigateToMyBookings, onQuickBook }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBookings, setModalBookings] = useState<Booking[]>([]);
  const [modalRoom, setModalRoom] = useState<Room | null>(null);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };
  
  const handleShowRoomDetails = (room: Room) => {
    const roomBookings = bookings.filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว')
                                 .sort((a,b) => a.startTime.localeCompare(b.startTime));
    setModalBookings(roomBookings);
    setModalRoom(room);
    setModalOpen(true);
  };
  
  const handleBookFromModal = (room: Room, date: string) => {
    setModalOpen(false);
    onSelectRoom(room, date);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = [];
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(Date.UTC(year, month - 1, prevMonthDays - i)) });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(Date.UTC(year, month, i)) });
    }
    
    const cellsSoFar = days.length;
    const remaining = (7 - (cellsSoFar % 7)) % 7;

    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(Date.UTC(year, month + 1, i)) });
    }
    
    return days;
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getUTCDate() === today.getDate() && 
           date.getUTCMonth() === today.getMonth() && 
           date.getUTCFullYear() === today.getFullYear();
  };

  const hasBooking = (dateStr: string) => bookings.some(b => b.date === dateStr && b.status === 'จองแล้ว');

  const getBookingsOnDate = (dateStr: string) => {
    return bookings.filter(b => b.date === dateStr && b.status === 'จองแล้ว')
      .sort((a,b) => a.startTime.localeCompare(b.startTime));
  };

  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  return (
    <>
    <BookingDetailsModal 
      isOpen={modalOpen} 
      onClose={() => setModalOpen(false)} 
      bookings={modalBookings}
      date={selectedDate}
      room={modalRoom}
      onBookNow={handleBookFromModal}
    />
    <div className="max-w-6xl mx-auto animate-fade-in px-2 md:px-0">
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl p-6 md:p-12 border border-gray-100 mb-10 overflow-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-2 text-[#0D448D]">
            <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-bold tracking-wide uppercase">Thonburi Commercial College</span>
          </div>
          <div className="flex gap-4">
            <Button 
                onClick={onQuickBook}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 shadow-lg hover:shadow-blue-200"
            >
                <span className="text-xl">+</span>
                <span>จองห้องประชุม</span>
            </Button>
          </div>
        </div>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8 border-b-2 border-slate-100 pb-4">
            <span className="text-3xl">📅</span>
            <h2 className="text-2xl font-bold text-[#0D448D]">ปฏิทินการใช้ห้องประชุม</h2>
          </div>
          
          <div className="bg-slate-50/70 p-4 md:p-8 rounded-[2.5rem] border border-slate-100/50">
            <div className="flex justify-between items-center mb-10">
              <button onClick={() => changeMonth(-1)} className="p-3.5 bg-[#0D448D] text-white rounded-2xl hover:bg-blue-800 transition-all shadow-lg active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-2xl md:text-3xl font-bold text-[#0D448D] tracking-tight">{thaiMonths[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}</h3>
              <button onClick={() => changeMonth(1)} className="p-3.5 bg-[#0D448D] text-white rounded-2xl hover:bg-blue-800 transition-all shadow-lg active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-center font-bold text-gray-400 text-xs uppercase tracking-widest">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => <div key={day} className="py-2">{day}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1.5 md:gap-4">
              {calendarDays.map((item, index) => {
                const dateStr = item.date.toISOString().split('T')[0];
                const selected = selectedDate === dateStr;
                const booked = hasBooking(dateStr);
                const bookingsOnDay = getBookingsOnDate(dateStr);
                const today = isToday(item.date);

                return (
                  <div key={index} onClick={() => item.currentMonth && handleDayClick(dateStr)}
                    className={`min-h-[80px] md:min-h-[115px] p-2 md:p-4 border-2 rounded-[1.5rem] cursor-pointer transition-all relative flex flex-col items-center
                      ${!item.currentMonth ? 'bg-transparent text-gray-200 border-transparent opacity-20 pointer-events-none' : 'bg-white border-slate-100 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1'}
                      ${selected ? 'border-sky-500 bg-sky-50/50 shadow-inner' : ''} ${booked ? 'bg-red-50/50 border-red-200' : ''}`}>
                    <span className={`text-base md:text-xl font-bold ${today ? 'text-green-600' : 'text-gray-700'} ${!item.currentMonth ? 'text-gray-200' : ''}`}>{item.day}</span>
                    {today && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1"></div>}
                    {booked && item.currentMonth && (<div className="mt-2 w-full space-y-1 hidden md:block">
                        {bookingsOnDay.slice(0, 2).map((b, i) => (<div key={i} className="text-[10px] bg-white border border-red-100 text-red-700 px-1.5 py-1 rounded-lg truncate shadow-sm text-center font-bold">{b.purpose}</div>))}
                      </div>)}
                    {booked && item.currentMonth && <div className="md:hidden w-2 h-2 bg-red-400 rounded-full mt-2"></div>}
                  </div>
                );
              })}
            </div>
            <div className="mt-12 flex flex-wrap justify-center gap-10 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-50"></div><span>วันนี้</span></div>
              <div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full border-2 border-red-300 bg-red-50"></div><span>มีการจอง</span></div>
              <div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full border-2 border-sky-500 bg-sky-50"></div><span>เลือกแล้ว</span></div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-100 pb-5">
            <span className="text-4xl">🏢</span>
            <div>
              <h2 className="text-2xl font-bold text-[#0D448D]">เลือกห้องประชุม</h2>
              <p className="text-sm text-gray-400 font-medium">สำหรับวันที่ {new Date(selectedDate).toLocaleDateString('th-TH')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {rooms.map(room => {
              const isAvailable = room.status === 'available';
              const roomBookings = bookings.filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว');
              const statusInfo = getRoomStatusInfo(room, roomBookings);

              return (
                <div key={room.id}
                  className={`flex flex-col bg-white rounded-[2rem] border-2 transition-all duration-300 group relative
                    ${isAvailable ? 'border-slate-100 hover:border-[#0D448D] hover:shadow-2xl hover:-translate-y-2 shadow-sm' : 'border-gray-100 bg-gray-50/50 opacity-60 cursor-default shadow-none'}`}>
                  
                  <div className="p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-800 leading-snug break-words mb-4 flex-grow">{room.name}</h3>
                    
                    <div className="flex items-center gap-2 mb-5">
                        <span className="text-xl">{statusInfo.icon}</span>
                        <span className={`text-sm font-bold ${statusInfo.textColor}`}>
                            {statusInfo.text}
                        </span>
                    </div>

                    {isAvailable && (
                      <Button 
                        onClick={() => handleShowRoomDetails(room)}
                        variant="primary"
                        className="w-full mt-auto"
                      >
                        ดูรายละเอียด / จอง
                      </Button>
                    )}
                    {!isAvailable && (
                      <div className="w-full text-center bg-gray-200 text-gray-400 py-3 rounded-xl font-bold text-sm mt-auto">
                        ไม่สามารถจองได้
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
    </>
  );
};

export default HomePage;