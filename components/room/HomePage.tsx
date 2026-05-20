
import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';
import BookingDetailsModal from './BookingDetailsModal';
import Button from '../shared/Button';

// ── ข้อมูลเสริมเกี่ยวกับแต่ละห้อง (capacity, equipment, type) ──────────────
const ROOM_METADATA: Record<string, { capacity: number; equipment: string[]; type: string; bgColor: string }> = {
  'ห้องประชุมธีรธรรมานันท์':            { capacity: 30,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'Video Call'], type: 'ห้องประชุม',      bgColor: '#1e3a6e' },
  'ห้องประชุมเฉลิมพระเกียรติ':          { capacity: 50,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'ลำโพง'],      type: 'ห้องประชุม',      bgColor: '#1a5276' },
  'ห้องประชุมมูลนิธิสมเด็จพระธีรญาณมุนี': { capacity: 20,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน'],              type: 'ห้องประชุม',      bgColor: '#154360' },
  'ห้องประชุมสำเภาทอง':                 { capacity: 25,  equipment: ['TV Screen', 'ไมโครโฟน'],                 type: 'ห้องประชุม',      bgColor: '#7B3F00' },
  'ห้องประชุมไพโรจน์ปวะบุตร':           { capacity: 40,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'ลำโพง'],      type: 'ห้องประชุม',      bgColor: '#1b2a8a' },
  'ห้องงานสื่อการเรียนการสอน 421':       { capacity: 15,  equipment: ['โน้ตบุ๊ค', 'อุปกรณ์สื่อ'],              type: 'ห้องปฏิบัติการ', bgColor: '#145a32' },
  'ห้อง CVM (ศูนย์บริหารเครือข่าย)':    { capacity: 20,  equipment: ['เซิร์ฟเวอร์', 'เครือข่าย'],             type: 'ห้องปฏิบัติการ', bgColor: '#2c3e50' },
  'ลานโดมอเนกประสงค์':                  { capacity: 200, equipment: ['ระบบเสียง', 'แสงไฟ', 'พื้นที่โล่ง'],    type: 'อาคาร/โดม',      bgColor: '#37474f' },
  'หอประชุมประทีป ปฐมกสิกุล':           { capacity: 500, equipment: ['เวที', 'ระบบเสียง', 'แสงไฟ'],           type: 'อาคาร/โดม',      bgColor: '#424242' },
};

const ROOM_TYPES = ['ทั้งหมด', 'ห้องประชุม', 'ห้องปฏิบัติการ', 'อาคาร/โดม'];

const getRoomStatus = (room: Room, roomBookings: Booking[]) => {
  if (room.status === 'closed')
    return { label: 'ไม่พร้อมใช้งาน', bgClass: 'bg-gray-100', textClass: 'text-gray-500', dotClass: 'bg-gray-400' };
  if (roomBookings.length === 0)
    return { label: 'ว่าง — พร้อมจอง', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', dotClass: 'bg-emerald-500' };
  return {
    label: `มีการจอง ${roomBookings.length} รายการ`,
    bgClass: 'bg-red-50',
    textClass: 'text-red-800',
    dotClass: 'bg-red-500',
  };
};

interface HomePageProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectRoom: (room: Room, date: string) => void;
  onBackToLanding: () => void;
  onNavigateToMyBookings: () => void;
  onQuickBook: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ rooms, bookings, onSelectRoom, onNavigateToMyBookings, onQuickBook }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeFilter, setActiveFilter] = useState('ทั้งหมด');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBookings, setModalBookings] = useState<Booking[]>([]);
  const [modalRoom, setModalRoom] = useState<Room | null>(null);

  const handleDayClick = (dateStr: string) => setSelectedDate(dateStr);

  const handleShowRoomDetails = (room: Room) => {
    const rb = bookings
      .filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    setModalBookings(rb);
    setModalRoom(room);
    setModalOpen(true);
  };

  const handleBookFromModal = (room: Room, date: string) => {
    setModalOpen(false);
    onSelectRoom(room, date);
  };

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const calendarDays = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const days: { day: number; currentMonth: boolean; date: Date }[] = [];
    const totalDays = daysInMonth(y, m);
    const firstDay = firstDayOfMonth(y, m);
    const prevMonthDays = daysInMonth(y, m - 1);

    for (let i = firstDay - 1; i >= 0; i--)
      days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(Date.UTC(y, m - 1, prevMonthDays - i)) });
    for (let i = 1; i <= totalDays; i++)
      days.push({ day: i, currentMonth: true, date: new Date(Date.UTC(y, m, i)) });
    const rem = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= rem; i++)
      days.push({ day: i, currentMonth: false, date: new Date(Date.UTC(y, m + 1, i)) });

    return days;
  }, [currentMonth]);

  const changeMonth = (offset: number) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getUTCDate() === t.getDate() && date.getUTCMonth() === t.getMonth() && date.getUTCFullYear() === t.getFullYear();
  };

  const hasBooking = (dateStr: string) => bookings.some(b => b.date === dateStr && b.status === 'จองแล้ว');
  const getBookingsOnDate = (dateStr: string) =>
    bookings.filter(b => b.date === dateStr && b.status === 'จองแล้ว').sort((a, b) => a.startTime.localeCompare(b.startTime));

  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  const filteredRooms = activeFilter === 'ทั้งหมด'
    ? rooms
    : rooms.filter(r => ROOM_METADATA[r.name]?.type === activeFilter);

  const selectedDateLabel = new Date(selectedDate).toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

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

      <div className="max-w-6xl mx-auto px-3 md:px-0 pb-16 animate-fade-in">

        {/* ── Intro Banner ────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6 flex flex-col md:flex-row items-start gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-xl shrink-0">📖</div>
            <div>
              <p className="text-sm font-bold text-blue-900 mb-1">วิธีใช้งานระบบจองห้องประชุม</p>
              <p className="text-sm text-blue-700 leading-relaxed">
                เลือกวันที่บนปฏิทิน → เลือกห้องที่ต้องการ → กด "ดูรายละเอียด / จอง" เพื่อตรวจสอบช่วงเวลาว่างและกรอกแบบฟอร์ม
              </p>
              <div className="flex flex-wrap gap-4 mt-3">
                {['เลือกวันที่', 'เลือกห้อง', 'กรอกแบบฟอร์ม'].map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <span className="w-5 h-5 rounded-full bg-[#0D448D] text-white flex items-center justify-center text-[10px]">{i + 1}</span>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={onQuickBook} className="shrink-0 hidden md:flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
            + จองห้อง
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

          {/* ── Calendar ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit sticky top-20">
            <h2 className="text-base font-bold text-[#0D448D] mb-5 flex items-center gap-2">
              <span className="text-xl">📅</span> ปฏิทินการใช้ห้อง
            </h2>

            <div className="flex justify-between items-center mb-5">
              <button
                onClick={() => changeMonth(-1)}
                aria-label="เดือนก่อน"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
              >
                <svg className="w-4 h-4 text-[#0D448D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-base font-bold text-[#0D448D]">
                {thaiMonths[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}
              </h3>
              <button
                onClick={() => changeMonth(1)}
                aria-label="เดือนถัดไป"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
              >
                <svg className="w-4 h-4 text-[#0D448D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                const dateStr = item.date.toISOString().split('T')[0];
                const selected = selectedDate === dateStr;
                const booked = hasBooking(dateStr);
                const bksOnDay = getBookingsOnDate(dateStr);
                const today = isToday(item.date);

                return (
                  <button
                    key={idx}
                    onClick={() => item.currentMonth && handleDayClick(dateStr)}
                    disabled={!item.currentMonth}
                    aria-label={`วันที่ ${item.day}${booked ? ' มีการจอง' : ''}`}
                    className={[
                      'rounded-xl p-1 flex flex-col items-center transition-all min-h-[52px] border',
                      !item.currentMonth ? 'opacity-0 pointer-events-none border-transparent' : '',
                      item.currentMonth && !booked && !selected ? 'border-transparent hover:border-sky-200 hover:bg-sky-50' : '',
                      selected ? 'border-[#0D448D] bg-blue-50 shadow-sm' : '',
                      booked && !selected && item.currentMonth ? 'border-red-200 bg-red-50' : '',
                    ].join(' ')}
                  >
                    <span className={`text-sm font-bold leading-none ${today ? 'text-emerald-600' : 'text-gray-700'}`}>{item.day}</span>
                    {today && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />}
                    {booked && item.currentMonth && (
                      <div className="text-[8px] font-bold bg-white text-red-700 border border-red-100 rounded px-1 mt-1 w-full text-center truncate">
                        {bksOnDay.length} จอง
                      </div>
                    )}
                    {!booked && item.currentMonth && !today && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">คำอธิบายสัญลักษณ์</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { colorClass: 'bg-emerald-500', label: 'วันนี้' },
                  { colorClass: 'bg-red-200 border border-red-300', label: 'มีการจอง' },
                  { colorClass: 'bg-blue-50 border border-[#0D448D]', label: 'วันที่เลือก' },
                  { colorClass: 'bg-emerald-300 opacity-70', label: 'ว่าง' },
                ].map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                    <div className={`w-3 h-3 rounded-sm shrink-0 ${l.colorClass}`} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Room List ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold text-[#0D448D] flex items-center gap-2">
                <span className="text-xl">🏢</span> เลือกห้องประชุม
              </h2>
              <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
                {selectedDateLabel}
              </span>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {ROOM_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                    activeFilter === type
                      ? 'bg-[#0D448D] text-white border-[#0D448D]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Room grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRooms.map(room => {
                const meta = ROOM_METADATA[room.name];
                const isAvailable = room.status === 'available';
                const roomBookings = bookings.filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว');
                const status = getRoomStatus(room, roomBookings);

                return (
                  <div
                    key={room.id}
                    className={`rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
                      isAvailable
                        ? 'border-gray-100 hover:border-[#0D448D] hover:shadow-lg hover:-translate-y-1'
                        : 'border-gray-100 opacity-55'
                    }`}
                  >
                    {/* Banner */}
                    <div
                      className="h-20 flex items-center justify-center relative"
                      style={{ backgroundColor: meta?.bgColor ?? '#374151' }}
                    >
                      <span className="text-4xl opacity-25">🏢</span>
                      {meta && (
                        <span className="absolute top-2 left-2 text-[9px] font-bold bg-black/40 text-white/90 rounded-full px-2 py-0.5">
                          {meta.type}
                        </span>
                      )}
                      {room.status === 'closed' && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-black/50 text-gray-300 rounded-full px-2 py-0.5">
                          🔧 ปิดซ่อม
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 flex flex-col flex-1">
                      <h3 className="text-sm font-bold text-gray-800 leading-snug mb-2">{room.name}</h3>

                      {/* Specs */}
                      {meta && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 rounded-md px-2 py-0.5">
                            👤 {meta.capacity} ที่นั่ง
                          </span>
                          {meta.equipment.slice(0, 2).map(eq => (
                            <span key={eq} className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 rounded-md px-2 py-0.5">
                              ✓ {eq}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Status badge */}
                      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 ${status.bgClass}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${status.dotClass}`} />
                        <span className={`text-xs font-bold ${status.textClass}`}>{status.label}</span>
                      </div>

                      {/* CTA */}
                      {isAvailable ? (
                        <button
                          onClick={() => handleShowRoomDetails(room)}
                          className="mt-auto w-full bg-[#0D448D] hover:bg-[#0a357a] text-white text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95"
                        >
                          ดูรายละเอียด / จอง
                        </button>
                      ) : (
                        <div className="mt-auto w-full text-center bg-gray-100 text-gray-400 py-2.5 rounded-xl text-xs font-bold">
                          ไม่สามารถจองได้
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredRooms.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-5xl mb-3">🏢</p>
                <p className="text-sm font-semibold">ไม่พบห้องในหมวดหมู่นี้</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile floating CTA */}
        <div className="md:hidden fixed bottom-6 right-5 z-30">
          <button
            onClick={onQuickBook}
            className="flex items-center gap-2 bg-[#0D448D] text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold active:scale-95 transition-all"
          >
            <span className="text-lg font-black">+</span> จองห้องประชุม
          </button>
        </div>
      </div>
    </>
  );
};

export default HomePage;
