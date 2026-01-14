
import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import Button from '../shared/Button';
import { ADMIN_PASSWORDS } from '../../constants';

interface MyBookingsPageProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  onCancelBookingGroup: (groupId: string) => void;
}

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ bookings, onCancelBooking, onCancelBookingGroup }) => {
  const [filterPhone, setFilterPhone] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const handleAdminLogin = () => {
    const password = prompt('กรุณาใส่รหัสผ่านแอดมิน:');
    if (password && ADMIN_PASSWORDS.includes(password)) {
      setIsAdmin(true);
      setFilterPhone('');
    } else if (password) {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (isAdmin) {
      return sorted;
    }
    if (!filterPhone) {
      return [];
    }
    return sorted.filter(b => b.phone.includes(filterPhone));
  }, [bookings, filterPhone, isAdmin]);
  
  const getStatusClass = (status: Booking['status']) => {
    switch(status) {
        case 'จองแล้ว': return 'bg-green-100 text-green-800';
        case 'ยกเลิก': return 'bg-red-100 text-red-800';
        case 'หมดเวลา': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">รายการจองของฉัน</h2>
        <Button onClick={handleAdminLogin} variant="secondary">แอดมิน</Button>
      </div>

      {!isAdmin && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg">
          <label htmlFor="filterPhone" className="block text-sm font-medium text-gray-700">ค้นหารายการจองด้วยเบอร์โทรศัพท์:</label>
          <input
            type="tel"
            id="filterPhone"
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            className="mt-1 w-full md:w-1/2 p-2 border border-gray-300 rounded-md shadow-sm"
            placeholder="เช่น 0812345678"
          />
        </div>
      )}
      
      {filteredBookings.length === 0 && (filterPhone || isAdmin) ? (
        <p className="text-center text-gray-500 py-8">ไม่พบรายการจอง</p>
      ) : null}

      <div className="space-y-4">
        {filteredBookings.map(b => (
          <div key={b.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{b.roomName}</h3>
                    <p className="text-sm text-gray-600">
                        {b.isMultiDay && b.dateRange ? `ช่วงวันที่: ${b.dateRange}` : `วันที่: ${new Date(b.date).toLocaleDateString('th-TH')}`}
                    </p>
                    <p className="text-sm text-gray-600">เวลา: {b.startTime} - {b.endTime}</p>
                    <p className="text-sm text-gray-600">ผู้จอง: {b.bookerName} ({b.phone})</p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusClass(b.status)}`}>{b.status}</span>
            </div>
            {b.status === 'จองแล้ว' && (
              <div className="mt-3 text-right">
                <Button variant="danger" onClick={() => {
                    if (confirm(`คุณต้องการยกเลิกการจอง ${b.roomName} ใช่หรือไม่?`)) {
                        if (b.isMultiDay && b.groupId) {
                            onCancelBookingGroup(b.groupId);
                        } else {
                            onCancelBooking(b.id);
                        }
                    }
                }}>
                  {b.isMultiDay ? 'ยกเลิกการจองทั้งหมด' : 'ยกเลิกการจอง'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyBookingsPage;
