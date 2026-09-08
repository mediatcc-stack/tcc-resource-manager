import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';
import BookingDetailsModal from './BookingDetailsModal';
import {
  Calendar, Building2, Wrench, ChevronLeft, ChevronRight,
  BookOpen, CalendarPlus, CheckCircle2, Clock, DoorOpen,
} from 'lucide-react';

// ── ประเภทของแต่ละห้อง (ใช้กับตัวกรองหมวดหมู่) ────────────────────────────
const ROOM_TYPES_BY_NAME: Record<string, string> = {
  'ห้องประชุมธีรธรรมานันท์':            'ห้องประชุม',
  'ห้องประชุมเฉลิมพระเกียรติ':          'ห้องประชุม',
  'ห้องประชุมมูลนิธิสมเด็จพระธีรญาณมุนี': 'ห้องประชุม',
  'ห้องประชุมสำเภาทอง':                 'ห้องประชุม',
  'ห้องประชุมไพโรจน์ปวะบุตร':           'ห้องประชุม',
  'ห้องงานสื่อการเรียนการสอน 421':       'ห้องปฏิบัติการ',
  'ห้อง CVM (ศูนย์บริหารเครือข่าย)':    'ห้องปฏิบัติการ',
  'ลานโดมอเนกประสงค์':                  'อาคาร/โดม',
  'หอประชุมประทีป ปฐมกสิกุล':           'อาคาร/โดม',
};

const ROOM_TYPES = ['ทั้งหมด', 'ห้องประชุม', 'ห้องปฏิบัติการ', 'อาคาร/โดม'];

const BOOKING_STEPS = ['เลือกวันที่', 'เลือกห้อง', 'กรอกแบบฟอร์มการจอง'];

interface HomePageProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectRoom: (room: Room, date: string) => void;
  onNavigateToMyBookings: () => void;
  onQuickBook: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ rooms, bookings, onSelectRoom, onQuickBook }) => {
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
    : rooms.filter(r => ROOM_TYPES_BY_NAME[r.name] === activeFilter);

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

      <div className="flex flex-col w-full gap-space-md pb-16 animate-fade-in">

        {/* ── แถบแนะนำวิธีใช้งาน ─────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-xl shadow-card p-space-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading text-headline-sm text-on-surface">วิธีใช้งานระบบจองห้องประชุม</span>
                <span className="bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-label text-label-sm">3 ขั้นตอนง่าย</span>
              </div>
              <p className="font-body text-body-sm text-on-surface-variant mt-0.5">
                เลือกวันที่บนปฏิทิน → เลือกห้องที่ต้องการ → กด "ดูรายละเอียด / จอง" เพื่อตรวจสอบช่วงเวลาว่างและกรอกแบบฟอร์ม
              </p>
              <div className="flex flex-wrap items-center gap-space-sm mt-space-xs">
                {BOOKING_STEPS.map((step, i) => (
                  <React.Fragment key={step}>
                    {i > 0 && <span className="text-outline text-body-sm">→</span>}
                    <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-md">
                      <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-label text-label-sm text-on-surface">{step}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onQuickBook}
            className="hidden md:inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary px-space-lg py-2 rounded-lg font-label text-label-md shadow-sm transition-all active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <CalendarPlus className="w-5 h-5" />
            <span>จองห้อง</span>
          </button>
        </div>

        {/* ── เนื้อหาหลัก: ปฏิทิน + รายการห้อง ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

          {/* ── ปฏิทิน ─────────────────────────────────────────────────── */}
          <aside className="lg:col-span-4 flex flex-col gap-space-md lg:sticky lg:top-32">
            <div className="bg-surface-container-lowest rounded-xl shadow-card p-space-md flex flex-col">
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="font-heading text-headline-sm text-on-surface">ปฏิทินการใช้ห้อง</h2>
                </div>
                <span className="bg-surface-container px-2 py-0.5 rounded-full text-on-surface font-label text-label-sm">
                  {currentMonth.getFullYear() + 543}
                </span>
              </div>

              {/* เลือกเดือน */}
              <div className="flex items-center justify-between my-space-xs px-space-xs bg-surface-container-low py-1.5 rounded-lg">
                <button
                  onClick={() => changeMonth(-1)}
                  aria-label="เดือนก่อน"
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-heading text-headline-sm text-on-surface">
                  {thaiMonths[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}
                </span>
                <button
                  onClick={() => changeMonth(1)}
                  aria-label="เดือนถัดไป"
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center py-2 text-outline font-label text-label-md">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-body text-body-sm">
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
                        'h-11 rounded-lg flex flex-col items-center justify-center relative transition-colors',
                        !item.currentMonth ? 'opacity-0 pointer-events-none' : 'cursor-pointer',
                        today ? 'bg-primary text-on-primary font-bold shadow-sm' : '',
                        !today && selected ? 'bg-surface-container-high text-primary font-bold' : '',
                        !today && !selected && booked ? 'bg-error-container text-on-error-container font-semibold' : '',
                        !today && !selected && !booked ? 'hover:bg-surface-container text-on-surface' : '',
                      ].join(' ')}
                    >
                      <span>{item.day}</span>
                      {booked && item.currentMonth ? (
                        <span className="text-[9px] leading-none absolute bottom-0.5">{bksOnDay.length} จอง</span>
                      ) : item.currentMonth && (
                        <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${today ? 'bg-live' : 'bg-live opacity-70'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* คำอธิบายสัญลักษณ์ */}
              <div className="mt-space-md bg-surface-container-low p-space-sm rounded-xl flex flex-col gap-1.5">
                <span className="font-label text-label-sm text-outline tracking-wider">คำอธิบายสัญลักษณ์</span>
                <div className="grid grid-cols-2 gap-2 font-body text-body-sm text-on-surface-variant">
                  {[
                    { cls: 'bg-primary', label: 'วันนี้' },
                    { cls: 'bg-error-container', label: 'มีการจอง' },
                    { cls: 'bg-surface-container-high', label: 'วันที่เลือก' },
                    { cls: 'bg-live', label: 'ห้องว่าง' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.cls}`} />
                      <span>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── รายการห้อง ─────────────────────────────────────────────── */}
          <section className="lg:col-span-8 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl shadow-card p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                  <DoorOpen className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-heading text-headline-md text-on-surface">เลือกห้องประชุม</h1>
                  <p className="font-body text-body-sm text-on-surface-variant">
                    สถานะการใช้ห้อง ณ <strong className="text-on-surface">{selectedDateLabel}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl overflow-x-auto">
                {ROOM_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-space-md py-1.5 rounded-lg font-label text-label-md whitespace-nowrap transition-colors cursor-pointer ${
                      activeFilter === type
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {filteredRooms.map(room => {
                const roomType = ROOM_TYPES_BY_NAME[room.name];
                const isAvailable = room.status === 'available';
                const roomBookings = bookings
                  .filter(b => b.roomName === room.name && b.date === selectedDate && b.status === 'จองแล้ว')
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                return (
                  <div
                    key={room.id}
                    className={`bg-surface-container-lowest rounded-xl shadow-card p-space-md flex flex-col justify-between gap-space-md transition-all ${
                      isAvailable ? 'hover:shadow-card-hover' : 'opacity-70'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      {/* หัวการ์ด */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isAvailable ? 'bg-surface-container text-primary' : 'bg-surface-container-low text-outline'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className={`font-heading text-headline-sm ${isAvailable ? 'text-on-surface' : 'text-outline'}`}>
                              {room.name}
                            </h3>
                            {roomType && (
                              <p className="font-body text-body-sm text-outline mt-0.5">{roomType}</p>
                            )}
                          </div>
                        </div>

                        {!isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label text-label-sm shrink-0">
                            <Wrench className="w-3.5 h-3.5" />
                            ปิดปรับปรุง
                          </span>
                        ) : roomBookings.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-container text-on-success-container font-label text-label-sm shrink-0">
                            <span className="w-2 h-2 rounded-full bg-on-success-container" />
                            ว่างตลอดวัน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label text-label-sm shrink-0">
                            <span className="w-2 h-2 rounded-full bg-secondary" />
                            มีการจอง {roomBookings.length} รายการ
                          </span>
                        )}
                      </div>

                      {/* กล่องสรุปสถานะและช่วงเวลา */}
                      <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-label text-label-md text-on-surface flex items-center gap-1.5">
                            {!isAvailable ? (
                              <><Wrench className="w-4 h-4 text-outline" /> งดให้บริการชั่วคราว</>
                            ) : roomBookings.length === 0 ? (
                              <><CheckCircle2 className="w-4 h-4 text-on-success-container" /> พร้อมใช้งานตลอดทั้งวัน</>
                            ) : (
                              <><Clock className="w-4 h-4 text-secondary" /> ช่วงเวลาที่ถูกจองไว้แล้ว</>
                            )}
                          </span>
                        </div>

                        {isAvailable && roomBookings.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {roomBookings.map(b => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-lowest text-on-surface-variant font-label text-label-sm"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                {b.startTime} - {b.endTime} น.
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ปุ่ม */}
                    {isAvailable ? (
                      <button
                        onClick={() => handleShowRoomDetails(room)}
                        className="w-full bg-primary hover:bg-primary-container text-on-primary py-2 px-3 rounded-lg font-label text-label-md shadow-sm transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span>ดูรายละเอียด / จอง</span>
                      </button>
                    ) : (
                      <div className="w-full bg-surface-container-low text-outline py-2 px-3 rounded-lg font-label text-label-md text-center">
                        ไม่สามารถจองได้
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredRooms.length === 0 && (
              <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-card">
                <Building2 className="w-12 h-12 text-outline-variant mx-auto mb-3" />
                <p className="font-heading text-headline-sm text-on-surface">ไม่พบห้องในหมวดหมู่นี้</p>
              </div>
            )}
          </section>
        </div>

        {/* ปุ่มลอยสำหรับมือถือ */}
        <div className="md:hidden fixed bottom-6 right-5 z-30">
          <button
            onClick={onQuickBook}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-2xl shadow-lg font-label text-label-lg active:scale-95 hover:bg-primary-container transition-all cursor-pointer"
          >
            <CalendarPlus className="w-5 h-5" /> จองห้องประชุม
          </button>
        </div>
      </div>
    </>
  );
};

export default HomePage;
