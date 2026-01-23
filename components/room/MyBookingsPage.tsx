

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
    return { text: 'กำลังดำเนินงาน (วันนี้)', bg: 'bg-rose-100', text_color: 'text-rose-800', border: 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]' };
  }

  switch(status) {
      case 'จองแล้ว': return { text: 'จองแล้ว', bg: 'bg-sky-100', text_color: 'text-sky-800', border: 'border-sky-500' };
      case 'ยกเลิก': return { text: 'ยกเลิก', bg: 'bg-red-50', text_color: 'text-red-400', border: 'border-gray-200 opacity-60' };
      case 'หมดเวลา': return { text: 'เสร็จสิ้น', bg: 'bg-gray-100', text_color: 'text-gray-500', border: 'border-gray-300 opacity-70' };
      default: return { text: status, bg: 'bg-gray-100', text_color: 'text-gray-800', border: 'border-gray-400' };
  }
};

// ฟังก์ชันสำหรับดึงสีของป้ายรูปแบบการประชุม
const getMeetingTypeDisplay = (type: string[] | string) => {
    const types = Array.isArray(type) ? type : [type];
    
    if (types.includes('Onsite') && types.includes('Online')) {
        return { text: 'ออนไซต์ และ ออนไลน์', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    }
    
    if (types.includes('Online')) {
        return { text: 'ออนไลน์', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    
    return { text: 'ออนไซต์', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};

const BookingCard: React.FC<{
  booking: Booking;
  isAdmin: boolean;
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
  onDeleteBooking: (id: string) => void;
  onDeleteBookingGroup: (groupId: string) => void;
  onEditBooking: (booking: Booking) => void;
  groupDetails?: { roomCount: number; roomNames: string[] };
  isToday: boolean;
}> = ({ booking, isAdmin, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, groupDetails, isToday }) => {
  const statusInfo = getStatusInfo(booking.status, isToday);
  const typeDisplay = getMeetingTypeDisplay(booking.meetingType);

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
                if (isGroup) {
                    onCancelBookingGroup(booking.groupId!);
                } else {
                    onCancelBooking(booking.id);
                }
            }
        } else if (action === 'delete') {
             const isGroup = !!booking.groupId;
             const confirmMessage = isGroup
                ? `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจองกลุ่ม "${booking.purpose}" ทั้งหมดจะถูกลบออกจากระบบ\n\nต้องการดำเนินการต่อใช่หรือไม่?`
                : `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจอง "${booking.purpose}" จะถูกลบออกจากระบบ\n\nต้องการดำเนินการต่อใช่หรือไม่?`;

            if (confirm(confirmMessage)) {
                if (isGroup) {
                    onDeleteBookingGroup(booking.groupId!);
                } else {
                    onDeleteBooking(booking.id);
                }
            }
        }
    };

    if (isAdmin) {
        performAction();
        return;
    }
    
    const password = prompt(`หากต้องการดำเนินการต่อ โปรดแจ้งงานสื่อ ฯ ประชาสัมพันธ์โดยตรง\n\n(สำหรับเจ้าหน้าที่) กรุณาใส่รหัสผ่าน:`);
    if (password === null) return;
    if (STAFF_PASSWORDS.includes(password)) {
        performAction();
    } else {
        alert('รหัสผ่านไม่ถูกต้อง ไม่สามารถดำเนินการได้');
    }
  };

  const roomTitle = groupDetails && groupDetails.roomNames.length > 1
    ? groupDetails.roomNames.join(', ')
    : booking.roomName;

  return (
      <div className={`bg-white p-5 rounded-2xl shadow-md border-l-8 ${statusInfo.border} transition-all hover:shadow-xl animate-fade-in relative overflow-hidden group`}>
          {isToday && booking.status === 'จองแล้ว' && (
              <div className="absolute top-0 right-0">
                  <div className="bg-rose-500 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl shadow-lg flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span> วันนี้
                  </div>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-x-4 gap-y-3">
              <div className="md:col-span-3">
                  <h4 className={`font-bold text-lg ${isToday ? 'text-rose-900' : 'text-[#0D448D]'}`}>{roomTitle}</h4>
                  <p className="text-sm text-gray-600 mt-1 uppercase tracking-tight font-black">
                      หน่วยงาน: <span className="font-medium text-gray-800">{booking.bookerName} {booking.phone ? `(${booking.phone})` : ''}</span>
                  </p>
                  <p className="text-sm text-gray-500 break-words mt-1">
                      <span className="font-bold">วัตถุประสงค์:</span> {booking.purpose}
                  </p>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-[13px]">
                      <div className="flex items-center text-gray-600">
                          <span className="w-6 text-center">👤</span>
                          <span className="font-semibold w-24">ผู้เข้าร่วม:</span>
                          <span>{booking.participants} คน</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                          <span className="w-6 text-center">💻</span>
                          <span className="font-semibold w-24">รูปแบบ:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${typeDisplay.color}`}>
                             {typeDisplay.text}
                          </span>
                      </div>
                      {booking.attachmentUrl && (
                        <div className="flex items-center text-blue-600">
                            <span className="w-6 text-center">📎</span>
                            <span className="font-semibold w-24">ไฟล์แนบ:</span>
                            <a href={booking.attachmentUrl} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-[150px]">
                                คลิกดูไฟล์
                            </a>
                        </div>
                      )}
                  </div>
              </div>
              <div className="md:col-span-2 flex flex-col md:items-end text-left md:text-right">
                <span className={`mb-3 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${statusInfo.bg} ${statusInfo.text_color}`}>
                    {statusInfo.text}
                </span>
                  <p className={`font-black text-sm ${isToday ? 'text-rose-600' : 'text-gray-800'}`}>
                      🗓️ {booking.isMultiDay && booking.dateRange ? booking.dateRange : new Date(booking.date).toLocaleDateString('th-TH')}
                  </p>
                  <p className="text-sm font-bold text-gray-600 mt-1">⏰ เวลา: {booking.startTime} - {booking.endTime} น.</p>
              </div>
              
              <div className="md:col-span-5 flex justify-end gap-2 border-t border-gray-100 pt-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {booking.status === 'จองแล้ว' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => handleStaffAction('edit')}>
                            แก้ไขข้อมูล
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleStaffAction('cancel')}>
                            ยกเลิกรายการ
                          </Button>
                        </>
                    )}
                    {isAdmin && (
                        <Button size="sm" variant="danger" onClick={() => handleStaffAction('delete')}>
                        ลบถาวร
                        </Button>
                    )}
              </div>
          </div>
      </div>
  );
};


const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ bookings, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, onBack, isAdmin, onOpenNotificationSettings }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState('all');

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    bookings.forEach(b => {
      const year = new Date(b.date).getFullYear().toString();
      yearsSet.add(year);
    });
    yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  // ฟังก์ชันแยกข้อมูลเป็น วันนี้, เร็วๆ นี้, ประวัติ
  const groupedData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // กรองพื้นฐานตาม Filter UI
    const filtered = bookings.filter(b => {
        const bDate = new Date(b.date);
        const purposeMatch = purposeFilter ? b.purpose.toLowerCase().includes(purposeFilter.toLowerCase()) : true;
        const roomMatch = roomFilter !== 'all' ? b.roomName === roomFilter : true;
        const monthMatch = monthFilter === 'all' || (bDate.getMonth() + 1).toString() === monthFilter;
        const yearMatch = yearFilter === 'all' || bDate.getFullYear().toString() === yearFilter;
        return purposeMatch && roomMatch && monthMatch && yearMatch;
    });

    // ลบรายการซ้ำ (กรณี Multi-room ใน Group เดียวกัน)
    const processedGroupIds = new Set<string>();
    const uniqueBookings: Booking[] = [];
    for (const b of filtered) {
        if (b.groupId) {
            if (!processedGroupIds.has(b.groupId)) {
                uniqueBookings.push(b);
                processedGroupIds.add(b.groupId);
            }
        } else {
            uniqueBookings.push(b);
        }
    }

    if (activeTab === 'current') {
        const currentItems = uniqueBookings.filter(b => b.status === 'จองแล้ว');
        
        const todayItems = currentItems.filter(b => {
             // สำหรับ Multi-day เช็คว่าวันนี้อยู่ในช่วงไหม
             if (b.isMultiDay && b.dateRange) {
                 const dates = uniqueBookings.filter(allB => allB.groupId === b.groupId).map(allB => allB.date);
                 return dates.includes(todayStr);
             }
             return b.date === todayStr;
        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

        const upcomingItems = currentItems.filter(b => {
             if (b.isMultiDay && b.dateRange) {
                 const dates = uniqueBookings.filter(allB => allB.groupId === b.groupId).map(allB => allB.date);
                 return Math.max(...dates.map(d => new Date(d).getTime())) >= new Date(todayStr).getTime() && !dates.includes(todayStr);
             }
             return b.date > todayStr;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { today: todayItems, upcoming: upcomingItems, history: [] };
    } else {
        const historyItems = uniqueBookings.filter(b => b.status === 'หมดเวลา' || b.status === 'ยกเลิก')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { today: [], upcoming: [], history: historyItems };
    }
  }, [bookings, activeTab, purposeFilter, monthFilter, yearFilter, roomFilter]);

  const clearFilters = () => {
    setPurposeFilter('');
    setMonthFilter('all');
    setYearFilter('all');
    setRoomFilter('all');
  };
  
  const inputClasses = "block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-all text-sm focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none";
  
  return (
    <div className="max-w-6xl mx-auto animate-fade-in mb-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 border border-gray-100">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={onBack}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-gray-600 transition-all active:scale-90"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <h2 className="text-2xl font-black text-gray-800 tracking-tight">รายการจองห้องประชุม</h2>
                </div>
                <div className="flex items-center gap-2">
                   {isAdmin && (
                    <Button onClick={onOpenNotificationSettings} variant="primary" className="bg-green-600 hover:bg-green-700 focus:ring-green-500">
                      ⚙️ ตั้งค่าแจ้งเตือน LINE
                    </Button>
                  )}
                </div>
            </div>

            <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-10 max-w-sm">
                <button 
                    onClick={() => setActiveTab('current')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'current' ? 'bg-white text-[#0D448D] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    ตารางปัจจุบัน
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-[#0D448D] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    ประวัติทั้งหมด
                </button>
            </div>
            
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">🔍 ค้นหาวัตถุประสงค์</label>
                        <input type="text" placeholder="พิมพ์ชื่อโครงการ..." value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">🗓️ เดือน</label>
                        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={inputClasses}>
                            <option value="all">ทุกเดือน</option>
                            {thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">📅 ปี พ.ศ.</label>
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputClasses}>
                            <option value="all">ทุกปี</option>
                            {years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">🏢 ห้อง</label>
                        <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} className={inputClasses} >
                            <option value="all">ห้องทั้งหมด</option>
                            {ROOMS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary" className="w-full">ล้างตัวกรอง</Button>
                </div>
            </div>

            <div className="space-y-12">
                {activeTab === 'current' ? (
                    <>
                        {groupedData.today.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-3 text-rose-600 font-black text-lg mb-6 uppercase tracking-widest">
                                    🔴 วันนี้
                                </h3>
                                <div className="space-y-4">
                                    {groupedData.today.map(b => (
                                        <BookingCard 
                                            key={b.groupId || b.id} 
                                            booking={b} 
                                            isAdmin={isAdmin} 
                                            isToday={true}
                                            onCancelBooking={onCancelBooking}
                                            onCancelBookingGroup={onCancelBookingGroup}
                                            onDeleteBooking={onDeleteBooking}
                                            onDeleteBookingGroup={onDeleteBookingGroup}
                                            onEditBooking={onEditBooking}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="flex items-center gap-3 text-sky-700 font-black text-lg mb-6 uppercase tracking-widest">
                                📅 เร็วๆ นี้
                            </h3>
                            {groupedData.upcoming.length > 0 ? (
                                <div className="space-y-4">
                                    {groupedData.upcoming.map(b => (
                                        <BookingCard 
                                            key={b.groupId || b.id} 
                                            booking={b} 
                                            isAdmin={isAdmin} 
                                            isToday={false}
                                            onCancelBooking={onCancelBooking}
                                            onCancelBookingGroup={onCancelBookingGroup}
                                            onDeleteBooking={onDeleteBooking}
                                            onDeleteBookingGroup={onDeleteBookingGroup}
                                            onEditBooking={onEditBooking}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                    <p className="text-sm font-bold text-gray-400">ไม่มีรายการในอนาคต</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div>
                        <h3 className="flex items-center gap-3 text-gray-500 font-black text-lg mb-6 uppercase tracking-widest">
                            📂 ประวัติการใช้งาน
                        </h3>
                        {groupedData.history.length > 0 ? (
                            <div className="space-y-4">
                                {groupedData.history.map(b => (
                                    <BookingCard 
                                        key={b.groupId || b.id} 
                                        booking={b} 
                                        isAdmin={isAdmin} 
                                        isToday={false}
                                        onCancelBooking={onCancelBooking}
                                        onCancelBookingGroup={onCancelBookingGroup}
                                        onDeleteBooking={onDeleteBooking}
                                        onDeleteBookingGroup={onDeleteBookingGroup}
                                        onEditBooking={onEditBooking}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 rounded-3xl">
                                <p className="text-sm font-bold text-gray-400 italic">ไม่พบประวัติการจอง</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MyBookingsPage;