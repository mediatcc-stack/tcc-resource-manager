/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  MyBookingsPage.tsx — ตารางการจอง (แท็บ "ตารางการจอง" ของระบบจองห้องประชุม)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  หน้านี้ตอบคำถามเดียวให้ได้เร็วที่สุด: "ตอนนี้ใครใช้ห้องอยู่ และคิวถัดไปคือใคร"
 *  ลำดับเนื้อหาจึงเรียงตามความเร่งด่วน ไม่ใช่ตามวันที่อย่างเดียว
 *
 *    สรุปภาพรวม (กำลังใช้ / วันนี้ / เร็ว ๆ นี้)
 *      → กำลังใช้อยู่ตอนนี้   — การ์ดเด่น มีแถบเวลาที่ใช้ไปแล้วและเวลาที่เหลือ
 *      → ถัดไปวันนี้         — นับถอยหลังว่าอีกกี่นาทีจะเริ่ม
 *      → เร็ว ๆ นี้           — วันข้างหน้า
 *      → จบแล้ววันนี้        — พับเก็บไว้ กดดูได้
 *
 *  บนมือถือ ตัวกรองทั้งหมดถูกยุบไว้ในดรอปดาวน์ "ตัวกรอง" เพื่อไม่ให้ดันการ์ด
 *  ลงไปไกลเกินกว่าจะเห็นในหน้าจอแรก (เดิมตัวกรอง 4 ช่องเรียงลงมากินพื้นที่มาก)
 *  เมื่อมีตัวกรองทำงานอยู่จะมีชิปบอกไว้ข้าง ๆ ปุ่ม พร้อมกากบาทปิดทีละอัน
 *
 *  หมายเหตุเรื่องเวลา
 *    - "วันนี้" คิดจากเวลาเครื่องผู้ใช้ (local) ไม่ใช่ UTC — ช่วงเที่ยงคืนถึงเช้า
 *      ของไทยจะได้วันที่ถูกต้อง
 *    - นาฬิกาเดินเองทุก 30 วินาที การ์ด "กำลังใช้อยู่" จึงอัปเดตโดยไม่ต้องรีเฟรช
 *    - การจองหลายห้อง/หลายวันถูกรวมเป็นการ์ดเดียวด้วย groupId และคิดสถานะจาก
 *      "รอบ" (แถวข้อมูล) ทั้งหมดของกลุ่มนั้น
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS, safeHref } from '../../constants';
import Modal from '../shared/Modal';
import {
  Target, Users, Monitor, Package, Paperclip, Building2, Calendar, ClipboardList,
  SlidersHorizontal, ChevronDown, Search, Clock, CheckCircle2, X,
} from 'lucide-react';

interface MyBookingsPageProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
  onDeleteBooking: (id: string) => void;
  onDeleteBookingGroup: (groupId: string) => void;
  onEditBooking: (booking: Booking) => void;
  onBack: () => void;
  isAdmin: boolean;
  myBookingIds: string[];
}

const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** วันที่ของเครื่องผู้ใช้ในรูปแบบ YYYY-MM-DD (ห้ามใช้ toISOString เพราะเป็นเวลา UTC) */
const localDateStr = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "09:30" → 570 นาทีนับจากเที่ยงคืน */
const toMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 95 → "1 ชม. 35 นาที" */
const formatDuration = (minutes: number): string => {
  const total = Math.max(Math.round(minutes), 0);
  if (total < 60) return `${total} นาที`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
};

const formatThaiDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch (e) {
        return dateStr;
    }
};

/** "วันนี้ / พรุ่งนี้ / 12 มี.ค. 2569" — ใช้บอกวันแบบที่คนอ่านเข้าใจทันที */
const formatRelativeDate = (dateStr: string, todayStr: string): string => {
  if (dateStr === todayStr) return 'วันนี้';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === localDateStr(tomorrow)) return 'พรุ่งนี้';
  return formatThaiDateShort(dateStr);
};

/** ช่วงชีวิตของการจองเทียบกับ "ตอนนี้" — ใช้จัดลำดับความสำคัญของการ์ด */
type BookingPhase = 'live' | 'today' | 'upcoming' | 'done';

interface BookingTiming {
  phase: BookingPhase;
  /** วันของรอบที่กำลังพูดถึง (รอบที่ใช้อยู่ หรือรอบถัดไป) */
  date: string;
  startTime: string;
  endTime: string;
  /** เหลืออีกกี่นาทีจะเริ่ม (phase = today) */
  minutesToStart: number;
  /** เหลืออีกกี่นาทีจะเลิก (phase = live) */
  minutesLeft: number;
  /** ใช้ไปแล้วกี่ส่วนของเวลาทั้งหมด 0–1 (phase = live) */
  progress: number;
}

/**
 * หาสถานะของการจองหนึ่งใบ (หรือหนึ่งกลุ่ม) เทียบกับเวลาปัจจุบัน
 * rows = ทุกแถวของกลุ่มนั้น เพราะจองหลายห้อง/หลายวันจะถูกรวมเป็นการ์ดเดียว
 */
const getTiming = (rows: Booking[], todayStr: string, nowMinutes: number): BookingTiming => {
  const todayRows = rows.filter(r => r.date === todayStr);

  const running = todayRows.find(r => toMinutes(r.startTime) <= nowMinutes && nowMinutes < toMinutes(r.endTime));
  if (running) {
    const start = toMinutes(running.startTime);
    const end = toMinutes(running.endTime);
    const span = Math.max(end - start, 1);
    return {
      phase: 'live',
      date: running.date,
      startTime: running.startTime,
      endTime: running.endTime,
      minutesToStart: 0,
      minutesLeft: end - nowMinutes,
      progress: Math.min(Math.max((nowMinutes - start) / span, 0), 1),
    };
  }

  const nextToday = todayRows
    .filter(r => toMinutes(r.startTime) > nowMinutes)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];
  if (nextToday) {
    return {
      phase: 'today',
      date: nextToday.date,
      startTime: nextToday.startTime,
      endTime: nextToday.endTime,
      minutesToStart: toMinutes(nextToday.startTime) - nowMinutes,
      minutesLeft: 0,
      progress: 0,
    };
  }

  const nextDay = rows
    .filter(r => r.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.startTime) - toMinutes(b.startTime))[0];
  if (nextDay) {
    return {
      phase: 'upcoming',
      date: nextDay.date,
      startTime: nextDay.startTime,
      endTime: nextDay.endTime,
      minutesToStart: 0,
      minutesLeft: 0,
      progress: 0,
    };
  }

  // เหลือแต่รอบที่ผ่านไปแล้ว — เอารอบล่าสุดมาแสดง
  const last = [...rows].sort((a, b) => b.date.localeCompare(a.date) || toMinutes(b.startTime) - toMinutes(a.startTime))[0];
  return {
    phase: 'done',
    date: last?.date ?? '',
    startTime: last?.startTime ?? '',
    endTime: last?.endTime ?? '',
    minutesToStart: 0,
    minutesLeft: 0,
    progress: 1,
  };
};

const getStatusInfo = (status: Booking['status'], phase: BookingPhase) => {
  if (status === 'จองแล้ว') {
    switch (phase) {
      case 'live': return { text: 'กำลังใช้อยู่', color: 'bg-rose-500 text-white' };
      case 'today': return { text: 'วันนี้', color: 'bg-amber-500 text-white' };
      case 'done': return { text: 'จบแล้ว', color: 'bg-slate-400 text-white' };
      default: return { text: 'จองแล้ว', color: 'bg-sky-500 text-white' };
    }
  }
  switch (status) {
      case 'ยกเลิก': return { text: 'ยกเลิก', color: 'bg-outline text-white' };
      case 'หมดเวลา': return { text: 'เสร็จสิ้น', color: 'bg-green-500 text-white' };
      default: return { text: status, color: 'bg-outline text-white' };
  }
};

const DetailItem: React.FC<{icon: React.ReactNode, children: React.ReactNode}> = ({ icon, children }) => (
    <div className="flex items-start gap-3 text-sm">
        <span className="text-outline shrink-0 mt-0.5">{icon}</span>
        <div className="text-on-surface break-words font-medium">{children}</div>
    </div>
);

// SVG icons
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-outline shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-outline shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const BookingCard: React.FC<{
  booking: Booking;
  isExpanded: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isMine: boolean;
  onEditBooking: (booking: Booking) => void;
  groupDetails?: { roomCount: number; roomNames: string[] };
  timing: BookingTiming;
  todayStr: string;
  onTriggerConfirm: (actionType: 'cancel' | 'delete', booking: Booking) => void;
}> = ({ booking, isExpanded, onToggle, isAdmin, isMine, onEditBooking, groupDetails, timing, todayStr, onTriggerConfirm }) => {
  const statusInfo = getStatusInfo(booking.status, timing.phase);
  const isLive = booking.status === 'จองแล้ว' && timing.phase === 'live';
  const isDone = booking.status === 'จองแล้ว' && timing.phase === 'done';


  const formattedDate = booking.isMultiDay && booking.dateRange
    ? booking.dateRange
    : formatRelativeDate(timing.date || booking.date, todayStr);

  const roomTitle = groupDetails && groupDetails.roomNames.length > 1
    ? `${groupDetails.roomNames[0]} และอีก ${groupDetails.roomCount - 1} ห้อง`
    : booking.roomName;

  return (
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          isLive
            ? 'bg-rose-50/60 border-rose-300 shadow-md ring-1 ring-rose-200'
            : isExpanded
              ? 'bg-surface-container-lowest border-primary shadow-md'
              : `bg-surface-container-lowest border-outline-variant shadow-sm ${isDone ? 'opacity-70' : ''}`
        }`}
      >
          <div className="p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50/40 transition-all" onClick={onToggle}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full inline-flex items-center gap-1 whitespace-nowrap ${statusInfo.color}`}>
                        {isLive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                          </span>
                        )}
                        {statusInfo.text}
                      </span>
                      {isMine && !isAdmin && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block whitespace-nowrap bg-primary-light text-primary border border-blue-200">
                          รายการของฉัน
                        </span>
                      )}
                      {/* นับถอยหลังของรอบถัดไปวันนี้ — เห็นตั้งแต่ยังไม่กดเปิดการ์ด */}
                      {booking.status === 'จองแล้ว' && timing.phase === 'today' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          อีก {formatDuration(timing.minutesToStart)}
                        </span>
                      )}
                    </div>
                    <h4 className={`font-bold text-base tracking-tight ${isLive ? 'text-rose-700' : 'text-primary'}`}>{roomTitle}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                      <CalendarIcon />
                      <span>{formattedDate} | {booking.isMultiDay ? `${booking.startTime} - ${booking.endTime}` : `${timing.startTime || booking.startTime} - ${timing.endTime || booking.endTime}`} น.</span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-2 break-words">{booking.purpose}</p>
                    {/* จอแคบ: ชื่อผู้จองขึ้นบรรทัดของตัวเองเต็มความกว้าง จะได้ไม่ถูกตัดจนอ่านไม่ออก */}
                    <div className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container px-2.5 py-1 rounded-lg w-fit max-w-full">
                      <UserIcon />
                      <span className="truncate">{booking.bookerName}</span>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 shrink-0 sm:max-w-[50%]">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container px-2.5 py-1 rounded-lg max-w-full">
                    <UserIcon />
                    <span className="truncate">{booking.bookerName}</span>
                  </div>
                  <svg className={`w-5 h-5 text-outline mt-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
            </div>

            {/* แถบเวลาของรอบที่กำลังใช้อยู่ — ดูปราดเดียวรู้ว่าเหลืออีกนานแค่ไหน */}
            {isLive && (
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-rose-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${Math.round(timing.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-bold text-rose-700">
                  เหลืออีก {formatDuration(timing.minutesLeft)} · เลิก {timing.endTime} น.
                </p>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="px-4 pb-4 animate-fade-in">
              <div className="p-4 bg-slate-50/60 rounded-xl border border-outline-variant space-y-3">
                  <DetailItem icon={<Target className="w-4 h-4 text-outline" />} >{booking.purpose}</DetailItem>
                  <DetailItem icon={<Users className="w-4 h-4 text-outline" />} >{booking.participants} คน</DetailItem>
                  <DetailItem icon={<Monitor className="w-4 h-4 text-outline" />} >{Array.isArray(booking.meetingType) ? booking.meetingType.join(', ') : booking.meetingType}</DetailItem>
                  {booking.equipment && <DetailItem icon={<Package className="w-4 h-4 text-outline" />} >{booking.equipment}</DetailItem>}
                  {/* กรองลิงก์ก่อนแสดงเสมอ — ลิงก์นี้ผู้ใช้พิมพ์เอง ถ้าเป็น javascript:
                      แล้วเจ้าหน้าที่กด จะกลายเป็นสคริปต์ที่รันแทนเจ้าหน้าที่ (ดู safeHref) */}
                  {safeHref(booking.attachmentUrl) && (
                      <DetailItem icon={<Paperclip className="w-4 h-4 text-outline" />} >
                          <a href={safeHref(booking.attachmentUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline truncate">
                              คลิกเพื่อเปิดไฟล์แนบ
                          </a>
                      </DetailItem>
                  )}
                  {groupDetails && groupDetails.roomCount > 1 && (
                      <DetailItem icon={<Building2 className="w-4 h-4 text-outline" />} >
                          <ul className="list-disc pl-5 space-y-0.5">
                            {groupDetails.roomNames.map(name => <li key={name}>{name}</li>)}
                          </ul>
                      </DetailItem>
                  )}
              </div>

              {/* แอดมินจัดการได้ทุกรายการ / เจ้าของการจองแก้ไข-ยกเลิกรายการของตัวเองได้เอง (ตราบใดที่ยังไม่ถึงเวลา/ยังไม่ยกเลิก) */}
              {(isAdmin || (isMine && booking.status === 'จองแล้ว')) && (
                <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-outline-variant">
                    {booking.status === 'จองแล้ว' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => onEditBooking(booking)}>แก้ไข</Button>
                          <Button size="sm" variant="secondary" onClick={() => onTriggerConfirm('cancel', booking)}>ยกเลิกการจอง</Button>
                        </>
                    )}
                    {isAdmin && (
                        <Button size="sm" variant="danger" onClick={() => onTriggerConfirm('delete', booking)}>ลบถาวร</Button>
                    )}
                </div>
              )}
            </div>
          )}
      </div>
  );
};

/** การ์ดหนึ่งใบในรายการ = การจองหนึ่งกลุ่ม พร้อมสถานะเวลาที่คำนวณไว้แล้ว */
interface BookingEntry {
  /** แถวที่ใช้แสดงผล — รอบที่กำลังใช้อยู่หรือรอบถัดไปของกลุ่ม ไม่ใช่รอบแรกเสมอไป */
  booking: Booking;
  timing: BookingTiming;
  groupDetails?: { roomCount: number; roomNames: string[] };
  /** ยังมีรอบที่ยังไม่ผ่าน/ยังไม่ยกเลิกอยู่ — ใช้แยกว่าอยู่แท็บ "ปัจจุบัน" หรือ "ประวัติ" */
  isActive: boolean;
}

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({
  bookings,
  onCancelBooking,
  onCancelBookingGroup,
  onDeleteBooking,
  onDeleteBookingGroup,
  onEditBooking,
  onBack,
  isAdmin,
  myBookingIds,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  // เริ่มที่ 'ทุกปี' เพื่อไม่ให้ซ่อนรายการข้ามปีโดยที่ผู้ใช้ไม่ได้ตั้งใจกรอง
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFinishedToday, setShowFinishedToday] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // นาฬิกาของหน้า — เดินทุก 30 วินาที เพื่อให้ "กำลังใช้อยู่/อีกกี่นาที" ตรงเสมอ
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayStr = localDateStr(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // State สำหรับ Confirm Modal แสนสวย
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    bookings.forEach(b => yearsSet.add(new Date(b.date).getFullYear().toString()));
    yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  const sections = useMemo(() => {
    const keyword = purposeFilter.trim().toLowerCase();
    const filtered = bookings.filter(b => {
        const bDate = new Date(b.date);
        // ค้นหาได้ทั้งหัวข้อ ชื่อผู้จอง และชื่อห้อง — คนส่วนใหญ่จำอย่างใดอย่างหนึ่ง
        const keywordMatch = keyword
          ? `${b.purpose} ${b.bookerName} ${b.roomName}`.toLowerCase().includes(keyword)
          : true;
        const roomMatch = roomFilter !== 'all' ? b.roomName === roomFilter : true;
        const monthMatch = monthFilter === 'all' || (bDate.getMonth() + 1).toString() === monthFilter;
        const yearMatch = yearFilter === 'all' || bDate.getFullYear().toString() === yearFilter;
        return keywordMatch && roomMatch && monthMatch && yearMatch;
    });

    // รวมการจองที่อยู่กลุ่มเดียวกัน (หลายห้อง/หลายวัน) ให้เหลือการ์ดเดียว
    const cardKeys: string[] = [];
    const groupDetailsMap = new Map<string, { roomCount: number, roomNames: string[] }>();
    for (const b of filtered) {
        const key = b.groupId || b.id;
        if (!cardKeys.includes(key)) cardKeys.push(key);
        if (b.groupId) {
            if (!groupDetailsMap.has(b.groupId)) groupDetailsMap.set(b.groupId, { roomCount: 0, roomNames: [] });
            const details = groupDetailsMap.get(b.groupId)!;
            if (!details.roomNames.includes(b.roomName)) {
                details.roomCount++;
                details.roomNames.push(b.roomName);
            }
        }
    }

    // สถานะเวลาคิดจากทุกแถวของกลุ่ม (ใช้ข้อมูลก่อนกรอง เพื่อไม่ให้ตัวกรองทำให้สถานะเพี้ยน)
    const entries: BookingEntry[] = cardKeys.map(key => {
      const rows = bookings.filter(r => (r.groupId || r.id) === key);
      const activeRows = rows.filter(r => r.status === 'จองแล้ว');
      const basis = activeRows.length > 0 ? activeRows : rows;
      const timing = getTiming(basis, todayStr, nowMinutes);
      // การ์ดของกลุ่มต้องแสดง "รอบที่เกี่ยวข้องตอนนี้" ไม่ใช่รอบแรกเสมอ
      // (จองหลายวัน วันแรกผ่านไปแล้ว แต่ยังมีวันถัดไปอยู่)
      const focused = basis.find(r => r.date === timing.date && r.startTime === timing.startTime) ?? basis[0] ?? rows[0];
      return {
        booking: focused,
        timing,
        groupDetails: focused.groupId ? groupDetailsMap.get(focused.groupId) : undefined,
        isActive: activeRows.length > 0,
      };
    });

    if (activeTab === 'history') {
      const history = entries
        .filter(e => !e.isActive)
        .sort((a, b) => b.booking.date.localeCompare(a.booking.date));
      return { live: [], today: [], upcoming: [], finishedToday: [], history };
    }

    const active = entries.filter(e => e.isActive);
    const live = active
      .filter(e => e.timing.phase === 'live')
      .sort((a, b) => a.timing.minutesLeft - b.timing.minutesLeft);
    const today = active
      .filter(e => e.timing.phase === 'today')
      .sort((a, b) => a.timing.minutesToStart - b.timing.minutesToStart);
    const upcoming = active
      .filter(e => e.timing.phase === 'upcoming')
      .sort((a, b) => a.timing.date.localeCompare(b.timing.date) || toMinutes(a.timing.startTime) - toMinutes(b.timing.startTime));
    const finishedToday = active
      .filter(e => e.timing.phase === 'done' && e.timing.date === todayStr)
      .sort((a, b) => toMinutes(b.timing.startTime) - toMinutes(a.timing.startTime));

    return { live, today, upcoming, finishedToday, history: [] };
  }, [bookings, activeTab, purposeFilter, monthFilter, yearFilter, roomFilter, todayStr, nowMinutes]);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (purposeFilter.trim()) chips.push({ key: 'keyword', label: `"${purposeFilter.trim()}"`, clear: () => setPurposeFilter('') });
    if (roomFilter !== 'all') chips.push({ key: 'room', label: roomFilter, clear: () => setRoomFilter('all') });
    if (monthFilter !== 'all') chips.push({ key: 'month', label: thaiMonths[parseInt(monthFilter, 10) - 1], clear: () => setMonthFilter('all') });
    if (yearFilter !== 'all') chips.push({ key: 'year', label: `ปี ${parseInt(yearFilter, 10) + 543}`, clear: () => setYearFilter('all') });
    return chips;
  }, [purposeFilter, roomFilter, monthFilter, yearFilter]);

  const clearFilters = () => {
    setPurposeFilter('');
    setMonthFilter('all');
    setYearFilter('all');
    setRoomFilter('all');
  };

  const inputClasses = "w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5 text-on-surface transition-all text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none";

  const handleTriggerConfirm = (actionType: 'cancel' | 'delete', booking: Booking) => {
    const isGroup = !!booking.groupId;

    if (actionType === 'cancel') {
      const title = '⚠️ ยืนยันการยกเลิกการจอง';
      const message = isGroup
        ? `คุณต้องการยกเลิกการจองกลุ่ม "${booking.purpose}" ทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`
        : `คุณต้องการยกเลิกการจองห้อง "${booking.roomName}" หัวข้อ "${booking.purpose}" ใช่หรือไม่?`;

      setConfirmModal({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          if (isGroup) onCancelBookingGroup(booking.groupId!);
          else onCancelBooking(booking.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      const title = '🚨 ยืนยันการลบรายการถาวร';
      const message = isGroup
        ? `คุณต้องการลบข้อมูลการจองกลุ่ม "${booking.purpose}" ทั้งหมดออกจากระบบอย่างถาวรใช่หรือไม่? การกระทำนี้จะลบฐานข้อมูลทั้งหมด`
        : `คุณต้องการลบข้อมูลการจองห้อง "${booking.roomName}" หัวข้อ "${booking.purpose}" ออกจากระบบอย่างถาวรใช่หรือไม่?`;

      setConfirmModal({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          if (isGroup) onDeleteBookingGroup(booking.groupId!);
          else onDeleteBooking(booking.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    }
  };

  /** twoColumns = จอใหญ่จัดเป็น 2 คอลัมน์ (ใช้กับรายการรอง เพื่อไม่ให้หน้ายาวเกินไป) */
  const renderBookingList = (list: BookingEntry[], twoColumns = false) => {
      if (list.length === 0) return null;
      return (
          <div className={twoColumns ? 'space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:items-start' : 'space-y-3'}>
              {list.map(({ booking, timing, groupDetails }) => {
                  const cardId = booking.groupId || booking.id;
                  return (
                    <BookingCard
                        key={cardId}
                        booking={booking}
                        isAdmin={isAdmin}
                        isMine={myBookingIds.includes(cardId)}
                        timing={timing}
                        todayStr={todayStr}
                        isExpanded={expandedId === cardId}
                        onToggle={() => setExpandedId(expandedId === cardId ? null : cardId)}
                        onEditBooking={onEditBooking}
                        groupDetails={groupDetails}
                        onTriggerConfirm={handleTriggerConfirm}
                    />
                  );
              })}
          </div>
      );
  };

  const todayTotal = sections.live.length + sections.today.length + sections.finishedToday.length;

  /** ตัวเลขสรุปด้านบน — ดูปราดเดียวรู้ว่าตอนนี้แน่นแค่ไหน */
  const summaryTiles = [
    { key: 'live', label: 'กำลังใช้อยู่', value: sections.live.length, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    { key: 'today', label: 'วันนี้', value: todayTotal, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { key: 'upcoming', label: 'เร็ว ๆ นี้', value: sections.upcoming.length, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  ];

  return (
    <div className="max-w-6xl mx-auto animate-fade-in mb-20">
        <div className="bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-10 border border-outline-variant">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">ตารางการจอง</h2>
                <p className="text-xs font-semibold text-on-surface-variant">
                    {now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })} · {now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </p>
            </div>

            {/* ── สรุปภาพรวม (แสดงเฉพาะแท็บปัจจุบัน) ── */}
            {activeTab === 'current' && (
              <div className="grid grid-cols-3 gap-2 mb-4 sm:max-w-lg">
                {summaryTiles.map(tile => (
                  <div key={tile.key} className={`rounded-xl border px-2 py-2.5 text-center ${tile.tone}`}>
                    <p className="text-xl sm:text-2xl font-black leading-none">{tile.value}</p>
                    <p className="mt-1 text-[10px] sm:text-xs font-bold whitespace-nowrap">{tile.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── แถบควบคุม: สลับมุมมอง + ดรอปดาวน์ตัวกรอง ── */}
            <div className="flex items-center gap-2 mb-3">
                <div className="flex p-1 bg-surface-container rounded-xl flex-1 max-w-[240px]">
                    <button onClick={() => { setActiveTab('current'); setExpandedId(null); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'current' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-outline'}`}>ปัจจุบัน</button>
                    <button onClick={() => { setActiveTab('history'); setExpandedId(null); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-outline'}`}>ประวัติ</button>
                </div>
                <button
                    type="button"
                    onClick={() => setIsFilterOpen(open => !open)}
                    aria-expanded={isFilterOpen}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-xs font-bold text-on-surface-variant hover:border-outline transition-all cursor-pointer whitespace-nowrap"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>ค้นหา / ตัวกรอง</span>
                    {activeFilters.length > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-black grid place-items-center">
                            {activeFilters.length}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* ชิปบอกตัวกรองที่ทำงานอยู่ — ปิดทีละอันได้โดยไม่ต้องเปิดแผงกรอง */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {activeFilters.map(chip => (
                        <button
                            key={chip.key}
                            type="button"
                            onClick={chip.clear}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-light text-primary border border-blue-200 text-[11px] font-bold hover:bg-blue-100 transition-all cursor-pointer max-w-full"
                        >
                            <span className="truncate">{chip.label}</span>
                            <X className="w-3 h-3 shrink-0" />
                        </button>
                    ))}
                    <button type="button" onClick={clearFilters} className="text-[11px] font-bold text-outline hover:text-on-surface underline underline-offset-2 cursor-pointer">
                        ล้างทั้งหมด
                    </button>
                </div>
            )}

            {isFilterOpen && (
                <div className="mb-4 p-3 rounded-2xl border border-outline-variant bg-surface-container-low animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2 lg:col-span-1">
                            <label className="text-[10px] font-bold text-outline px-1">ค้นหา (หัวข้อ / ผู้จอง / ห้อง)</label>
                            <div className="relative">
                                <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input type="text" placeholder="พิมพ์คำที่ต้องการ..." value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)} className={`${inputClasses} pl-9`} />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-outline px-1">ห้อง</label>
                            <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} className={inputClasses}>
                                <option value="all">ทุกห้อง</option>
                                {ROOMS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-outline px-1">เดือน</label>
                            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}>
                                <option value="all">ทุกเดือน</option>
                                {thaiMonths.map((m, i) => <option key={i} value={(i + 1).toString()}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-outline px-1">ปี</label>
                            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}>
                                <option value="all">ทุกปี</option>
                                {years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2.5">
                        <Button onClick={clearFilters} variant="secondary" size="sm">ล้างตัวกรอง</Button>
                        <Button onClick={() => setIsFilterOpen(false)} variant="primary" size="sm">ดูผลลัพธ์</Button>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {activeTab === 'current' ? (
                    <>
                        {/* 1) กำลังใช้อยู่ — สำคัญที่สุด อยู่บนสุดเสมอ */}
                        {sections.live.length > 0 ? (
                            <div>
                                <h3 className="text-rose-600 font-bold text-sm mb-3 flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                    กำลังใช้อยู่ตอนนี้ ({sections.live.length})
                                </h3>
                                {renderBookingList(sections.live)}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                <p className="text-sm font-bold text-on-surface-variant">ตอนนี้ยังไม่มีห้องที่กำลังใช้งาน</p>
                            </div>
                        )}

                        {/* 2) คิวถัดไปของวันนี้ */}
                        {sections.today.length > 0 && (
                            <div>
                                <h3 className="text-amber-600 font-bold text-sm mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    ถัดไปวันนี้ ({sections.today.length})
                                </h3>
                                {renderBookingList(sections.today)}
                            </div>
                        )}

                        {/* 3) วันข้างหน้า */}
                        <div>
                            <h3 className="text-sky-700 font-bold text-sm mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                                เร็ว ๆ นี้ ({sections.upcoming.length})
                            </h3>
                            {renderBookingList(sections.upcoming, true) || (
                                <p className="text-center text-outline text-sm py-6">ไม่มีรายการจองที่จะมาถึง</p>
                            )}
                        </div>

                        {/* 4) จบไปแล้ววันนี้ — พับเก็บไว้ ไม่ให้บังของที่สำคัญกว่า */}
                        {sections.finishedToday.length > 0 && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowFinishedToday(open => !open)}
                                    className="flex items-center gap-2 text-on-surface-variant font-bold text-sm hover:text-on-surface transition-all cursor-pointer"
                                >
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    จบแล้ววันนี้ ({sections.finishedToday.length})
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showFinishedToday ? 'rotate-180' : ''}`} />
                                </button>
                                {showFinishedToday && <div className="mt-3">{renderBookingList(sections.finishedToday, true)}</div>}
                            </div>
                        )}
                    </>
                ) : (
                    <div>
                        <h3 className="text-on-surface-variant font-bold text-sm mb-3 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-outline shrink-0" />
                            ประวัติ ({sections.history.length})
                        </h3>
                        {renderBookingList(sections.history, true) || (
                            <p className="text-center text-outline text-sm py-6">ไม่พบประวัติการจอง</p>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Confirmation Modal สำหรับการลบและยกเลิก */}
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          title={confirmModal.title}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-on-surface font-medium">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                ยกเลิก
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmModal.onConfirm}
              >
                ยืนยันดำเนินการ
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
};

export default MyBookingsPage;
