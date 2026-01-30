

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS, STAFF_PASSWORDS } from '../../constants';

interface MyBookingsPageProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
  onDeleteBooking: (id: string) => void;
  onDeleteBookingGroup: (groupId: string) => void;
  onEditBooking: (booking: Booking) => void;
  onBack: () => void;
  isAdmin: boolean;
  onOpenNotificationSettings: () => void;
}

const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

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

const DetailItem: React.FC<{icon: string, label: string, children: React.ReactNode}> = ({ icon, label, children }) => (
    <div className="flex items-start text-sm">
        <div className="w-8 text-center text-lg text-gray-400">{icon}</div>
        <div className="flex-1">
            <p className="font-bold text-gray-500">{label}</p>
            <div className="text-gray-800 break-words">{children}</div>
        </div>
    </div>
);


const BookingCard: React.FC<{
  booking: Booking;
  isExpanded: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
  onDeleteBooking: (id: string) => void;
  onDeleteBookingGroup: (groupId: string) => void;
  onEditBooking: (booking: Booking) => void;
  groupDetails?: { roomCount: number; roomNames: string[] };
  isToday: boolean;
}> = ({ booking, isExpanded, onToggle, isAdmin, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, groupDetails, isToday }) => {
  const statusInfo = getStatusInfo(booking.status, isToday);

  const handleStaffAction = (action: 'cancel' | 'delete' | 'edit') => {
    if (action === 'edit') {
      onEditBooking(booking);
      return;
    }

    const performAction = () => {
        if (action === 'cancel') {
            const isGroup = !!booking.groupId;
            const confirmMessage = isGroup
                ? `ยืนยันการยกเลิกการจองกลุ่ม "${booking.purpose}" ทั้งหมดใช่หรือไม่?`
                : `ยืนยันการยกเลิกการจอง "${booking.purpose}" ใช่หรือไม่?`;
            
            if (confirm(confirmMessage)) {
                if (isGroup) onCancelBookingGroup(booking.groupId!);
                else onCancelBooking(booking.id);
            }
        } else if (action === 'delete') {
             const isGroup = !!booking.groupId;
             const confirmMessage = isGroup
                ? `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจองกลุ่ม "${booking.purpose}" ทั้งหมดจะถูกลบออกจากระบบ\n\nต้องการดำเนินการต่อใช่หรือไม่?`
                : `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจอง "${booking.purpose}" จะถูกลบออกจากระบบ\n\nต้องการดำเนินการต่อใช่หรือไม่?`;

            if (confirm(confirmMessage)) {
                if (isGroup) onDeleteBookingGroup(booking.groupId!);
                else onDeleteBooking(booking.id);
            }
        }
    };

    if (isAdmin) {
        performAction();
        return;
    }
    
    const password = prompt(`(สำหรับเจ้าหน้าที่) กรุณาใส่รหัสผ่าน:`);
    if (password === null) return;
    if (STAFF_PASSWORDS.includes(password)) {
        performAction();
    } else {
        alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const roomTitle = groupDetails && groupDetails.roomNames.length > 1
    ? `${groupDetails.roomNames[0]} และอีก ${groupDetails.roomCount - 1} ห้อง`
    : booking.roomName;

  return (
      <div className={`bg-white rounded-2xl shadow-sm border-2 ${isExpanded ? 'border-blue-500 shadow-lg' : 'border-gray-100'} transition-all animate-fade-in`}>
          <div className="p-4 cursor-pointer" onClick={onToggle}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <div className={`px-3 py-1 text-xs font-bold rounded-full inline-block mb-2 ${statusInfo.color}`}>{statusInfo.text}</div>
                    <h4 className="font-bold text-lg text-[#0D448D]">{roomTitle}</h4>
                    <p className="text-sm text-gray-500 font-medium">
                      🗓️ {booking.isMultiDay && booking.dateRange ? booking.dateRange : new Date(booking.date).toLocaleDateString('th-TH')}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">
                      ⏰ {booking.startTime} - {booking.endTime} น.
                    </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-sm font-semibold text-gray-700">👤 {booking.bookerName}</p>
                  <svg className={`w-5 h-5 text-gray-400 mt-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
            </div>
          </div>
          
          {isExpanded && (
            <div className="px-4 pb-4 animate-fade-in">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <DetailItem icon="🎯" label="วัตถุประสงค์ / เรื่อง">{booking.purpose}</DetailItem>
                  <DetailItem icon="👥" label="ผู้เข้าร่วม">{booking.participants} คน</DetailItem>
                  <DetailItem icon="💻" label="รูปแบบ">
                      {Array.isArray(booking.meetingType) ? booking.meetingType.join(', ') : booking.meetingType}
                  </DetailItem>
                  {booking.equipment && <DetailItem icon="📦" label="อุปกรณ์เพิ่มเติม">{booking.equipment}</DetailItem>}
                  {booking.attachmentUrl && (
                      <DetailItem icon="📎" label="ไฟล์แนบ">
                          <a href={booking.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate">
                              คลิกเพื่อเปิดไฟล์
                          </a>
                      </DetailItem>
                  )}
                  {groupDetails && groupDetails.roomCount > 1 && (
                      <DetailItem icon="🏢" label="ห้องทั้งหมด">
                          <ul className="list-disc pl-5">
                            {groupDetails.roomNames.map(name => <li key={name}>{name}</li>)}
                          </ul>
                      </DetailItem>
                  )}
              </div>
              <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                  {booking.status === 'จองแล้ว' && (
                      <>
                        <Button size="sm" variant="primary" onClick={() => handleStaffAction('edit')}>แก้ไข</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleStaffAction('cancel')}>ยกเลิก</Button>
                      </>
                  )}
                  {isAdmin && (
                      <Button size="sm" variant="danger" onClick={() => handleStaffAction('delete')}>ลบถาวร</Button>
                  )}
              </div>
            </div>
          )}
      </div>
  );
};


const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ bookings, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, onBack, isAdmin, onOpenNotificationSettings }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [roomFilter, setRoomFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  
  const inputClasses = "w-full rounded-xl border border-gray-200 bg-white p-2.5 text-gray-800 transition-all text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none";
  
  const renderBookingList = (list: Booking[], isToday = false) => {
      if (list.length === 0) return null;
      return (
          <div className="space-y-4">
              {list.map(b => (
                  <BookingCard 
                      key={b.groupId || b.id} 
                      booking={b} 
                      isAdmin={isAdmin} 
                      isToday={isToday}
                      isExpanded={expandedId === (b.groupId || b.id)}
                      onToggle={() => setExpandedId(expandedId === (b.groupId || b.id) ? null : (b.groupId || b.id))}
                      onCancelBooking={onCancelBooking}
                      onCancelBookingGroup={onCancelBookingGroup}
                      onDeleteBooking={onDeleteBooking}
                      onDeleteBookingGroup={onDeleteBookingGroup}
                      onEditBooking={onEditBooking}
                      groupDetails={b.groupId ? groupedAndFilteredBookings.groupDetailsMap.get(b.groupId) : undefined}
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
                {isAdmin && <Button onClick={onOpenNotificationSettings} variant="primary" className="bg-green-600 hover:bg-green-700 focus:ring-green-500">⚙️ ตั้งค่า LINE</Button>}
            </div>

            <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-8 max-w-sm">
                <button onClick={() => { setActiveTab('current'); setExpandedId(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'current' ? 'bg-white text-[#0D448D] shadow-md' : 'text-gray-400'}`}>ปัจจุบัน</button>
                <button onClick={() => { setActiveTab('history'); setExpandedId(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-[#0D448D] shadow-md' : 'text-gray-400'}`}>ประวัติ</button>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-8">
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
                        {groupedAndFilteredBookings.today.length > 0 && <div><h3 className="text-rose-600 font-bold mb-4">🔴 วันนี้</h3>{renderBookingList(groupedAndFilteredBookings.today, true)}</div>}
                        <div><h3 className="text-sky-700 font-bold mb-4">📅 เร็วๆ นี้</h3>{renderBookingList(groupedAndFilteredBookings.upcoming) || <p className="text-center text-gray-400 pt-8">ไม่มีรายการจองที่จะมาถึง</p>}</div>
                    </>
                ) : (
                    <div><h3 className="text-gray-500 font-bold mb-4">📂 ประวัติ</h3>{renderBookingList(groupedAndFilteredBookings.history) || <p className="text-center text-gray-400 pt-8">ไม่พบประวัติการจอง</p>}</div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MyBookingsPage;
