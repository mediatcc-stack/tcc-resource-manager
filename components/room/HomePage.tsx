
import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';

interface HomePageProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectRoom: (room: Room, date: string) => void;
  onBackToLanding: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ rooms, bookings, onSelectRoom, onBackToLanding }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = [];
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    
    // Previous month padding
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    }
    
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    }
    
    return days;
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const hasBooking = (dateStr: string) => {
    return bookings.some(b => b.date === dateStr && b.status === 'จองแล้ว');
  };

  const getBookingsOnDate = (dateStr: string) => {
    return bookings.filter(b => b.date === dateStr && b.status === 'จองแล้ว');
  };

  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  return (
    <div className="max-w-6xl mx-auto animate-fade-in px-2 md:px-0">
      {/* Big Unified White Container */}
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl p-6 md:p-12 border border-gray-100 mb-10 overflow-hidden">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <button 
            onClick={onBackToLanding}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <span>←</span> กลับหน้าหลัก
          </button>
          
          <div className="flex items-center gap-2 text-[#0D448D]">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-bold tracking-wide uppercase">Thonburi Commercial College</span>
          </div>
        </div>

        {/* --- ส่วนที่ 1: ปฏิทิน --- */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8 border-b-2 border-slate-100 pb-4">
            <span className="text-3xl">📅</span>
            <h2 className="text-2xl font-bold text-[#0D448D]">ปฏิทินการใช้ห้องประชุม</h2>
          </div>
          
          <div className="bg-slate-50/70 p-4 md:p-8 rounded-[2.5rem] border border-slate-100/50">
            <div className="flex justify-between items-center mb-10">
              <button onClick={() => changeMonth(-1)} className="p-3.5 bg-[#0D448D] text-white rounded-2xl hover:bg-blue-800 transition-all shadow-lg active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-2xl md:text-3xl font-bold text-[#0D448D] tracking-tight">
                {thaiMonths[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}
              </h3>
              <button onClick={() => changeMonth(1)} className="p-3.5 bg-[#0D448D] text-white rounded-2xl hover:bg-blue-800 transition-all shadow-lg active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-center font-bold text-gray-400 text-xs uppercase tracking-widest">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 md:gap-4">
              {calendarDays.map((item, index) => {
                const dateStr = item.date.toISOString().split('T')[0];
                const selected = selectedDate === dateStr;
                const booked = hasBooking(dateStr);
                const bookingsOnDay = getBookingsOnDate(dateStr);
                const today = isToday(item.date);

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      min-h-[80px] md:min-h-[115px] p-2 md:p-4 border-2 rounded-[1.5rem] cursor-pointer transition-all relative flex flex-col items-center
                      ${!item.currentMonth ? 'bg-transparent text-gray-200 border-transparent opacity-20 pointer-events-none' : 'bg-white border-slate-100 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1'}
                      ${selected ? 'border-[#0D448D] bg-blue-50/50 shadow-inner' : ''}
                      ${booked ? 'bg-orange-50/50 border-orange-100' : ''}
                    `}
                  >
                    <span className={`text-base md:text-xl font-bold ${today ? 'text-green-600' : 'text-gray-700'} ${!item.currentMonth ? 'text-gray-200' : ''}`}>
                      {item.day}
                    </span>
                    {today && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1"></div>}
                    
                    {booked && item.currentMonth && (
                      <div className="mt-2 w-full space-y-1 hidden md:block">
                        {bookingsOnDay.slice(0, 2).map((b, i) => (
                          <div key={i} className="text-[10px] bg-white border border-orange-100 text-orange-700 px-1.5 py-1 rounded-lg truncate shadow-sm text-center font-bold">
                            {b.purpose}
                          </div>
                        ))}
                      </div>
                    )}
                    {booked && item.currentMonth && <div className="md:hidden w-2 h-2 bg-orange-400 rounded-full mt-2"></div>}
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-10 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-50"></div>
                <span>วันนี้</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-orange-300 bg-orange-50"></div>
                <span>มีการจอง</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-[#0D448D] bg-blue-50"></div>
                <span>เลือกแล้ว</span>
              </div>
            </div>
          </div>
        </section>

        {/* --- ส่วนที่ 2: รายการห้อง --- */}
        <section>
          <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-100 pb-5">
            <span className="text-4xl">🏢</span>
            <div>
              <h2 className="text-2xl font-bold text-[#0D448D]">รายการห้องประชุม</h2>
              <p className="text-sm text-gray-400 font-medium">เลือกห้องที่ต้องการจองสำหรับวันที่ {new Date(selectedDate).toLocaleDateString('th-TH')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {rooms.map(room => {
              const isAvailable = room.status === 'available';
              const roomBookings = bookings.filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว');
              
              return (
                <div 
                  key={room.id} 
                  onClick={() => isAvailable && onSelectRoom(room, selectedDate)}
                  className={`
                    flex flex-col bg-white rounded-[2rem] border-2 transition-all duration-300 group relative
                    ${isAvailable ? 'border-slate-100 hover:border-[#0D448D] hover:shadow-2xl hover:-translate-y-2 cursor-pointer shadow-sm' : 'border-gray-100 bg-gray-50/50 opacity-60 cursor-default shadow-none'}
                  `}
                >
                  <div className="p-6 flex flex-col h-full">
                    {/* Header: Room Name */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-800 leading-snug break-words">
                        {room.name}
                      </h3>
                    </div>

                    {/* Body: Status & Bookings */}
                    <div className="flex-1 flex flex-col items-center justify-center py-5 mb-5 border-y border-slate-50">
                      {isAvailable ? (
                        roomBookings.length === 0 ? (
                          <div className="flex flex-col items-center gap-2">
                             <div className="bg-green-50 text-green-600 px-8 py-2 rounded-full text-sm font-bold border border-green-100">
                              ✅ ว่างทั้งวัน
                            </div>
                            <p className="text-[11px] text-gray-400 font-bold mt-2">✨ ยังไม่มีการจองในวันที่เลือก</p>
                          </div>
                        ) : (
                          <div className="w-full space-y-2">
                             <div className="bg-orange-50 text-orange-600 px-6 py-2 rounded-full text-xs font-bold border border-orange-100 text-center mb-3">
                              📅 จองแล้ว {roomBookings.length} รายการ
                            </div>
                            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                              {roomBookings.map((b, i) => (
                                <div key={i} className="text-[11px] text-gray-500 font-bold bg-slate-50/50 rounded-xl py-2 px-3 border border-slate-100 flex justify-between items-center">
                                  <span>⏰ {b.startTime}-{b.endTime}</span>
                                  <span className="text-gray-300 max-w-[80px] truncate">{b.bookerName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="bg-gray-100 text-gray-400 px-10 py-2.5 rounded-full text-sm font-bold border border-gray-200">
                          🔒 งดใช้ชั่วคราว
                        </div>
                      )}
                    </div>

                    {/* Footer: Interactive Button */}
                    {isAvailable ? (
                      <div className="w-full bg-[#0D448D] text-white py-3 rounded-[1.25rem] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 group-hover:bg-blue-800 transition-all active:scale-95">
                        <span>👆</span> คลิกเพื่อจองห้องนี้
                      </div>
                    ) : (
                      <div className="w-full bg-gray-200 text-gray-400 py-3 rounded-[1.25rem] font-bold text-sm flex items-center justify-center gap-2">
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

      {/* Footer Branding Outside Box */}
      <div className="text-center pb-12">
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em]">
          Resource Management System © Thonburi Commercial College
        </p>
      </div>
    </div>
  );
};

export default HomePage;
