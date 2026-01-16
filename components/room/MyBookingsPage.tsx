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
  onAdminLogin: () => void;
}

const getStatusInfo = (status: Booking['status']) => {
  switch(status) {
      case 'จองแล้ว': return { text: 'จองแล้ว', bg: 'bg-blue-100', text_color: 'text-blue-800', border: 'border-blue-500' };
      case 'ยกเลิก': return { text: 'ยกเลิก', bg: 'bg-red-100', text_color: 'text-red-800', border: 'border-red-500' };
      case 'หมดเวลา': return { text: 'เสร็จสิ้น', bg: 'bg-gray-100', text_color: 'text-gray-800', border: 'border-gray-400' };
      default: return { text: status, bg: 'bg-gray-100', text_color: 'text-gray-800', border: 'border-gray-400' };
  }
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
}> = ({ booking, isAdmin, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, groupDetails }) => {
  const statusInfo = getStatusInfo(booking.status);

  const handleStaffAction = (action: 'cancel' | 'delete' | 'edit') => {
    // Edit action is available for everyone without a password
    if (action === 'edit') {
      onEditBooking(booking);
      return;
    }

    const performAction = () => {
        if (action === 'cancel') {
            const isGroup = booking.isMultiDay && booking.groupId;
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
             const isGroup = booking.isMultiDay && booking.groupId;
             const confirmMessage = isGroup
                ? `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจองกลุ่ม "${booking.purpose}" ทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้\n\nต้องการดำเนินการต่อใช่หรือไม่?`
                : `⚠️ ยืนยันการลบถาวร ⚠️\n\nการจอง "${booking.purpose}" จะถูกลบและไม่สามารถกู้คืนได้\n\nต้องการดำเนินการต่อใช่หรือไม่?`;

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
    
    // For cancel/delete, prompt for password
    const password = prompt(`หากต้องการดำเนินการต่อ โปรดแจ้งงานสื่อ ฯ ประชาสัมพันธ์โดยตรง\n\n(สำหรับเจ้าหน้าที่) กรุณาใส่รหัสผ่าน:`);

    if (password === null) return;

    if (STAFF_PASSWORDS.includes(password)) {
        performAction();
    } else {
        alert('รหัสผ่านไม่ถูกต้อง ไม่สามารถดำเนินการได้');
    }
  };

  const roomTitle = groupDetails && groupDetails.roomCount > 1
    ? `${booking.roomName} (+${groupDetails.roomCount - 1} ห้อง)`
    : booking.roomName;
  const roomTitleTooltip = groupDetails && groupDetails.roomNames.length > 1
    ? `ห้องทั้งหมด:\n- ${groupDetails.roomNames.join('\n- ')}`
    : booking.roomName;

  return (
      <div className={`bg-white p-5 rounded-xl shadow-md border-l-4 ${statusInfo.border} transition-shadow hover:shadow-lg`}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-x-4 gap-y-3">
              <div className="md:col-span-3">
                  <h4 className="font-bold text-lg text-[#0D448D]" title={roomTitleTooltip}>{roomTitle}</h4>
                  <p className="text-sm text-gray-600 mt-1">ผู้จอง: <span className="font-medium">{booking.bookerName} ({booking.phone || 'ไม่มีเบอร์'})</span></p>
                  <p className="text-sm text-gray-500 break-words mt-1">วัตถุประสงค์: {booking.purpose}</p>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                          <span className="w-6 text-center text-lg">👥</span>
                          <span className="font-semibold w-24">ผู้เข้าร่วม:</span>
                          <span>{booking.participants} คน</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                          <span className="w-6 text-center text-lg">💻</span>
                          <span className="font-semibold w-24">รูปแบบ:</span>
                          <span>{booking.meetingType}</span>
                      </div>
                      {booking.equipment && (
                          <div className="flex items-start text-gray-600">
                              <span className="w-6 text-center text-lg pt-0.5">🛠️</span>
                              <span className="font-semibold w-24 flex-shrink-0">อุปกรณ์เพิ่มเติม:</span>
                              <span className="break-words">{booking.equipment}</span>
                          </div>
                      )}
                      {booking.attachmentUrl && (
                          <div className="flex items-start text-gray-600">
                              <span className="w-6 text-center text-lg pt-0.5">📎</span>
                              <span className="font-semibold w-24 flex-shrink-0">ไฟล์แนบ:</span>
                              <a 
                                  href={booking.attachmentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                              >
                                  ดูไฟล์
                              </a>
                          </div>
                      )}
                  </div>
              </div>
              <div className="md:col-span-2 flex flex-col md:items-end text-left md:text-right">
                <span className={`mb-2 px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.bg} ${statusInfo.text_color}`}>{statusInfo.text}</span>
                  <p className="font-semibold text-gray-800 text-sm">🗓️ {booking.isMultiDay && booking.dateRange ? `ช่วงวันที่: ${booking.dateRange}` : `วันที่: ${new Date(booking.date).toLocaleDateString('th-TH')}`}</p>
                  <p className="text-sm text-gray-600">⏰ เวลา: {booking.startTime} - {booking.endTime}</p>
              </div>
              
              <div className="md:col-span-5 flex justify-end gap-2 border-t border-gray-100 pt-3 mt-2">
                    {booking.status === 'จองแล้ว' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => handleStaffAction('edit')}>
                            แก้ไข
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleStaffAction('cancel')}>
                            ยกเลิกการจอง
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


const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ bookings, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onDeleteBookingGroup, onEditBooking, onBack, isAdmin, onAdminLogin }) => {
  const [purposeFilter, setPurposeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');

  const filteredAndGroupedBookings = useMemo(() => {
    const sortedBookings = [...bookings].sort((a, b) => {
        const aIsActive = a.status === 'จองแล้ว';
        const bIsActive = b.status === 'จองแล้ว';
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        const dateTimeA = new Date(`${a.date}T${a.startTime}`).getTime();
        const dateTimeB = new Date(`${b.date}T${b.startTime}`).getTime();
        if (aIsActive && bIsActive) return dateTimeA - dateTimeB;
        return dateTimeB - dateTimeA;
      });
      
    const filtered = sortedBookings.filter(b => {
        const purposeMatch = purposeFilter ? b.purpose.toLowerCase().includes(purposeFilter.toLowerCase()) : true;
        const dateMatch = dateFilter ? b.date === dateFilter : true;
        const roomMatch = roomFilter !== 'all' ? b.roomName === roomFilter : true;
        return purposeMatch && dateMatch && roomMatch;
      });

    const processedGroupIds = new Set<string>();
    const uniqueBookings: Booking[] = [];

    for (const booking of filtered) {
        if (booking.groupId) {
            if (!processedGroupIds.has(booking.groupId)) {
                uniqueBookings.push(booking);
                processedGroupIds.add(booking.groupId);
            }
        } else {
            uniqueBookings.push(booking);
        }
    }
    return uniqueBookings;
  }, [bookings, purposeFilter, dateFilter, roomFilter]);

  const clearFilters = () => {
    setPurposeFilter('');
    setDateFilter('');
    setRoomFilter('all');
  };
  
  const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  
  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <span>←</span> กลับ
                  </button>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">รายการจองทั้งหมด</h2>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && <span className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-full shadow-md">โหมดแอดมิน</span>}
                  <Button onClick={onAdminLogin} variant="secondary">
                      {isAdmin ? 'ปิดโหมดแอดมิน' : '🔑 แอดมิน'}
                  </Button>
                </div>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">🔍 ค้นหาชื่องาน</label>
                        <input type="text" placeholder="ค้นหา..." value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">🗓️ กรองตามวันที่</label>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={inputClasses} />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">🏢 กรองตามห้อง</label>
                        <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} className={inputClasses} >
                            <option value="all">ห้องทั้งหมด</option>
                            {ROOMS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                    </div>
                    <Button onClick={clearFilters} variant="secondary">ล้างตัวกรอง</Button>
                </div>
            </div>

            <div className="space-y-4">
                {filteredAndGroupedBookings.length > 0 ? (
                    filteredAndGroupedBookings.map(b => {
                      let groupDetails;
                      if (b.groupId) {
                        const groupBookings = bookings.filter(gb => gb.groupId === b.groupId);
                        const roomNames = [...new Set(groupBookings.map(gb => gb.roomName))];
                        groupDetails = {
                          roomCount: roomNames.length,
                          roomNames: roomNames,
                        };
                      }
                      return (
                        <BookingCard 
                          key={b.groupId || b.id} 
                          booking={b} 
                          isAdmin={isAdmin}
                          groupDetails={groupDetails}
                          onCancelBooking={onCancelBooking}
                          onCancelBookingGroup={onCancelBookingGroup}
                          onDeleteBooking={onDeleteBooking}
                          onDeleteBookingGroup={onDeleteBookingGroup}
                          onEditBooking={onEditBooking}
                        />
                      );
                    })
                ) : (
                    <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
                        <p className="text-lg font-semibold">ไม่พบรายการจอง</p>
                        <p className="text-sm mt-1">{purposeFilter || dateFilter || roomFilter !== 'all' ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีการจองในระบบ'}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MyBookingsPage;