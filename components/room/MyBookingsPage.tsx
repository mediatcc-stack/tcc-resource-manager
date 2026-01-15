
import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS } from '../../constants';

interface MyBookingsPageProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
  onDeleteBooking: (id: string) => void;
  onBack: () => void;
  isAdmin: boolean;
  onAdminLogin: () => void;
}

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ bookings, onCancelBooking, onCancelBookingGroup, onDeleteBooking, onBack, isAdmin, onAdminLogin }) => {
  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');

  const filteredBookings = useMemo(() => {
    return bookings
      .filter(b => {
        const nameMatch = nameFilter ? b.bookerName.toLowerCase().includes(nameFilter.toLowerCase()) : true;
        const dateMatch = dateFilter ? b.date === dateFilter : true;
        const roomMatch = roomFilter !== 'all' ? b.roomName === roomFilter : true;
        return nameMatch && dateMatch && roomMatch;
      })
      .sort((a, b) => {
        const aIsActive = a.status === 'จองแล้ว';
        const bIsActive = b.status === 'จองแล้ว';
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        const dateTimeA = new Date(`${a.date}T${a.startTime}`).getTime();
        const dateTimeB = new Date(`${b.date}T${b.startTime}`).getTime();
        if (aIsActive && bIsActive) return dateTimeA - dateTimeB;
        return dateTimeB - dateTimeA;
      });
  }, [bookings, nameFilter, dateFilter, roomFilter]);

  const clearFilters = () => {
    setNameFilter('');
    setDateFilter('');
    setRoomFilter('all');
  };
  
  const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  const getStatusInfo = (status: Booking['status']) => {
    switch(status) {
        case 'จองแล้ว': return { text: 'จองแล้ว', bg: 'bg-blue-100', text_color: 'text-blue-800', border: 'border-blue-500' };
        case 'ยกเลิก': return { text: 'ยกเลิก', bg: 'bg-red-100', text_color: 'text-red-800', border: 'border-red-500' };
        case 'หมดเวลา': return { text: 'เสร็จสิ้น', bg: 'bg-gray-100', text_color: 'text-gray-800', border: 'border-gray-400' };
        default: return { text: status, bg: 'bg-gray-100', text_color: 'text-gray-800', border: 'border-gray-400' };
    }
  };

  const BookingCard: React.FC<{booking: Booking}> = ({ booking }) => {
    const statusInfo = getStatusInfo(booking.status);
    return (
        <div className={`bg-white p-5 rounded-xl shadow-md border-l-4 ${statusInfo.border} transition-shadow hover:shadow-lg`}>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-3">
                <div className="sm:col-span-3">
                    <h4 className="font-bold text-lg text-[#0D448D]">{booking.roomName}</h4>
                    <p className="text-sm text-gray-600 mt-1">ผู้จอง: <span className="font-medium">{booking.bookerName} ({booking.phone})</span></p>
                    <p className="text-sm text-gray-500 break-words">วัตถุประสงค์: {booking.purpose}</p>
                     {booking.attachmentUrl && (
                        <p className="text-sm text-gray-500 mt-2">
                            <a 
                                href={booking.attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                            >
                                📎 ดูไฟล์แนบ
                            </a>
                        </p>
                    )}
                </div>
                <div className="sm:col-span-2">
                    <p className="font-semibold text-gray-800 text-sm">🗓️ {booking.isMultiDay && booking.dateRange ? `ช่วงวันที่: ${booking.dateRange}` : `วันที่: ${new Date(booking.date).toLocaleDateString('th-TH')}`}</p>
                    <p className="text-sm text-gray-600">⏰ เวลา: {booking.startTime} - {booking.endTime}</p>
                </div>
                <div className="sm:col-span-1 flex flex-col items-start sm:items-end justify-between">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.bg} ${statusInfo.text_color}`}>{statusInfo.text}</span>
                    <div className="mt-3 w-full flex flex-col sm:flex-row sm:justify-end gap-2">
                        {booking.status === 'จองแล้ว' && (
                            <Button size="sm" variant="secondary" onClick={() => {
                                if (confirm(`คุณต้องการยกเลิกการจอง ${booking.roomName} ใช่หรือไม่?`)) {
                                    if (booking.isMultiDay && booking.groupId) {
                                        onCancelBookingGroup(booking.groupId);
                                    } else {
                                        onCancelBooking(booking.id);
                                    }
                                }
                            }}>
                            ยกเลิก
                            </Button>
                        )}
                        {isAdmin && (
                            <Button size="sm" variant="danger" onClick={() => {
                                if (confirm(`⚠️ ยืนยันการลบถาวร ⚠️\n\nการจองนี้จะหายไปจากระบบอย่างถาวรและไม่สามารถกู้คืนได้\n\nคุณต้องการ "ลบถาวร" การจองนี้ใช่หรือไม่?`)) {
                                    onDeleteBooking(booking.id);
                                }
                            }}>
                            ลบ
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  };

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
            
            {/* Filter Section */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">🔍 ค้นหาชื่อผู้จอง</label>
                        <input type="text" placeholder="ค้นหา..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className={inputClasses}/>
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

            {/* Bookings List */}
            <div className="space-y-4">
                {filteredBookings.length > 0 ? (
                    filteredBookings.map(b => <BookingCard key={b.id} booking={b} />)
                ) : (
                    <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
                        <p className="text-lg font-semibold">ไม่พบรายการจอง</p>
                        <p className="text-sm mt-1">{nameFilter || dateFilter || roomFilter !== 'all' ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีการจองในระบบ'}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MyBookingsPage;
