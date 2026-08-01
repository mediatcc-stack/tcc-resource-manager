import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS } from '../../constants';
import Modal from '../shared/Modal';
import { Target, Users, Monitor, Package, Paperclip, Building2, Calendar, AlertTriangle, AlertCircle, ClipboardList } from 'lucide-react';

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

const getStatusInfo = (status: Booking['status'], isToday: boolean) => {
  if (isToday && status === 'จองแล้ว') {
    return { text: 'กำลังใช้ (วันนี้)', color: 'bg-rose-500 text-white' };
  }
  switch(status) {
      case 'จองแล้ว': return { text: 'จองแล้ว', color: 'bg-sky-500 text-white' };
      case 'ยกเลิก': return { text: 'ยกเลิก', color: 'bg-gray-500 text-white' };
      case 'หมดเวลา': return { text: 'เสร็จสิ้น', color: 'bg-green-500 text-white' };
      default: return { text: status, color: 'bg-gray-400 text-white' };
  }
};

const DetailItem: React.FC<{icon: React.ReactNode, children: React.ReactNode}> = ({ icon, children }) => (
    <div className="flex items-start gap-3 text-sm">
        <span className="text-gray-400 shrink-0 mt-0.5">{icon}</span>
        <div className="text-gray-800 break-words font-medium">{children}</div>
    </div>
);

// SVG icons
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-slate-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-slate-400">
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
  isToday: boolean;
  onTriggerConfirm: (actionType: 'cancel' | 'delete', booking: Booking) => void;
}> = ({ booking, isExpanded, onToggle, isAdmin, isMine, onEditBooking, groupDetails, isToday, onTriggerConfirm }) => {
  const statusInfo = getStatusInfo(booking.status, isToday);
  
  const formattedDate = booking.isMultiDay && booking.dateRange 
    ? booking.dateRange
    : formatThaiDateShort(booking.date);

  const roomTitle = groupDetails && groupDetails.roomNames.length > 1
    ? `${groupDetails.roomNames[0]} และอีก ${groupDetails.roomCount - 1} ห้อง`
    : booking.roomName;

  return (
      <div 
        className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
          isExpanded ? 'border-primary shadow-md' : 'border-slate-100 hover:border-slate-200'
        }`}
      >
          <div className="p-4 cursor-pointer hover:bg-slate-50/40 transition-all" onClick={onToggle}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full inline-block ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                      {isMine && !isAdmin && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block bg-primary-light text-primary border border-blue-200">
                          รายการของฉัน
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-primary tracking-tight">{roomTitle}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <CalendarIcon />
                      <span>{formattedDate} | {booking.startTime} - {booking.endTime} น.</span>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <UserIcon />
                    <span>{booking.bookerName}</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 mt-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
            </div>
          </div>
          
          {isExpanded && (
            <div className="px-4 pb-4 animate-fade-in">
              <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3">
                  <DetailItem icon={<Target className="w-4 h-4 text-slate-400" />} >{booking.purpose}</DetailItem>
                  <DetailItem icon={<Users className="w-4 h-4 text-slate-400" />} >{booking.participants} คน</DetailItem>
                  <DetailItem icon={<Monitor className="w-4 h-4 text-slate-400" />} >{Array.isArray(booking.meetingType) ? booking.meetingType.join(', ') : booking.meetingType}</DetailItem>
                  {booking.equipment && <DetailItem icon={<Package className="w-4 h-4 text-slate-400" />} >{booking.equipment}</DetailItem>}
                  {booking.attachmentUrl && (
                      <DetailItem icon={<Paperclip className="w-4 h-4 text-slate-400" />} >
                          <a href={booking.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline truncate">
                              คลิกเพื่อเปิดไฟล์แนบ
                          </a>
                      </DetailItem>
                  )}
                  {groupDetails && groupDetails.roomCount > 1 && (
                      <DetailItem icon={<Building2 className="w-4 h-4 text-slate-400" />} >
                          <ul className="list-disc pl-5 space-y-0.5">
                            {groupDetails.roomNames.map(name => <li key={name}>{name}</li>)}
                          </ul>
                      </DetailItem>
                  )}
              </div>
              
              {/* แอดมินจัดการได้ทุกรายการ / เจ้าของการจองแก้ไข-ยกเลิกรายการของตัวเองได้เอง (ตราบใดที่ยังไม่ถึงเวลา/ยังไม่ยกเลิก) */}
              {(isAdmin || (isMine && booking.status === 'จองแล้ว')) && (
                <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
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
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [roomFilter, setRoomFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const groupedAndFilteredBookings = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const filtered = bookings.filter(b => {
        const bDate = new Date(b.date);
        const purposeMatch = purposeFilter ? b.purpose.toLowerCase().includes(purposeFilter.toLowerCase()) : true;
        const roomMatch = roomFilter !== 'all' ? b.roomName === roomFilter : true;
        const monthMatch = monthFilter === 'all' || (bDate.getMonth() + 1).toString() === monthFilter;
        const yearMatch = yearFilter === 'all' || bDate.getFullYear().toString() === yearFilter;
        return purposeMatch && roomMatch && monthMatch && yearMatch;
    });

    const bookingsById = new Map<string, Booking>();
    const groupDetailsMap = new Map<string, { roomCount: number, roomNames: string[] }>();

    for (const b of filtered) {
        const id = b.groupId || b.id;
        if (!bookingsById.has(id) || (b.groupId && b.date < bookingsById.get(id)!.date)) {
            bookingsById.set(id, b);
        }
        if (b.groupId) {
            if (!groupDetailsMap.has(b.groupId)) groupDetailsMap.set(b.groupId, { roomCount: 0, roomNames: [] });
            const details = groupDetailsMap.get(b.groupId)!;
            if (!details.roomNames.includes(b.roomName)) {
                details.roomCount++;
                details.roomNames.push(b.roomName);
            }
        }
    }
    const uniqueBookings = Array.from(bookingsById.values());

    if (activeTab === 'current') {
        const currentItems = uniqueBookings.filter(b => b.status === 'จองแล้ว');
        const todayItems = currentItems.filter(b => (b.groupId ? bookings.some(gb => gb.groupId === b.groupId && gb.date === todayStr) : b.date === todayStr)).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const upcomingItems = currentItems.filter(b => !todayItems.includes(b) && (b.groupId ? bookings.some(gb => gb.groupId === b.groupId && gb.date > todayStr) : b.date > todayStr)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return { today: todayItems, upcoming: upcomingItems, history: [], groupDetailsMap };
    } else {
        const historyItems = uniqueBookings.filter(b => b.status === 'หมดเวลา' || b.status === 'ยกเลิก').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { today: [], upcoming: [], history: historyItems, groupDetailsMap };
    }
  }, [bookings, activeTab, purposeFilter, monthFilter, yearFilter, roomFilter]);

  const clearFilters = () => {
    setPurposeFilter('');
    setMonthFilter('all');
    setYearFilter(new Date().getFullYear().toString());
    setRoomFilter('all');
  };
  
  const inputClasses = "w-full rounded-xl border border-slate-200 bg-white p-2.5 text-gray-800 transition-all text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none";
  
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

  const renderBookingList = (list: Booking[], isToday = false) => {
      if (list.length === 0) return null;
      return (
          <div className="space-y-4">
              {list.map(b => (
                  <BookingCard
                      key={b.groupId || b.id}
                      booking={b}
                      isAdmin={isAdmin}
                      isMine={myBookingIds.includes(b.groupId || b.id)}
                      isToday={isToday}
                      isExpanded={expandedId === (b.groupId || b.id)}
                      onToggle={() => setExpandedId(expandedId === (b.groupId || b.id) ? null : (b.groupId || b.id))}
                      onEditBooking={onEditBooking}
                      groupDetails={b.groupId ? groupedAndFilteredBookings.groupDetailsMap.get(b.groupId) : undefined}
                      onTriggerConfirm={handleTriggerConfirm}
                  />
              ))}
          </div>
      );
  };
  
  return (
    <div className="max-w-6xl mx-auto animate-fade-in mb-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 border border-gray-100">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">รายการจองห้องประชุม</h2>
            </div>

            <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-8 max-w-sm">
                <button onClick={() => { setActiveTab('current'); setExpandedId(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activeTab === 'current' ? 'bg-white text-primary shadow-md' : 'text-gray-400'}`}>ปัจจุบัน</button>
                <button onClick={() => { setActiveTab('history'); setExpandedId(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white text-primary shadow-md' : 'text-gray-400'}`}>ประวัติ</button>
            </div>
            
            <div className="pb-6 mb-6 border-b border-gray-200">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-grow min-w-[150px]"><label className="text-[10px] font-bold text-gray-400 px-1">ค้นหา</label><input type="text" placeholder="วัตถุประสงค์..." value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)} className={inputClasses}/></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">เดือน</label><select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}><option value="all">ทุกเดือน</option>{thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">ปี</label><select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}><option value="all">ทุกปี</option>{years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}</select></div>
                    <div className="flex-grow"><label className="text-[10px] font-bold text-gray-400 px-1">ห้อง</label><select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} className={inputClasses}><option value="all">ทุกห้อง</option>{ROOMS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
                    <Button onClick={clearFilters} variant="secondary" size="sm" className="h-[42px] px-4">ล้าง</Button>
                </div>
            </div>

            <div className="space-y-10">
                {activeTab === 'current' ? (
                    <>
                        {groupedAndFilteredBookings.today.length > 0 && (
                            <div>
                                <h3 className="text-rose-600 font-bold mb-4 flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                    วันนี้
                                </h3>
                                {renderBookingList(groupedAndFilteredBookings.today, true)}
                            </div>
                        )}
                        <div>
                            <h3 className="text-sky-700 font-bold mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                                เร็วๆ นี้
                            </h3>
                            {renderBookingList(groupedAndFilteredBookings.upcoming) || <p className="text-center text-gray-400 pt-8">ไม่มีรายการจองที่จะมาถึง</p>}
                        </div>
                    </>
                ) : (
                    <div>
                        <h3 className="text-gray-500 font-bold mb-4 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-gray-400 shrink-0" />
                            ประวัติ
                        </h3>
                        {renderBookingList(groupedAndFilteredBookings.history) || <p className="text-center text-gray-400 pt-8">ไม่พบประวัติการจอง</p>}
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
            <p className="text-slate-600 font-medium">{confirmModal.message}</p>
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