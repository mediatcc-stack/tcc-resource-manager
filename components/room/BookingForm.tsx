
import React, { useState, useMemo } from 'react';
import { Room, Booking } from '../../types';
import Button from '../shared/Button';

interface BookingFormProps {
  room: Room;
  date: string;
  existingBookings: Booking[];
  onSubmit: (newBookings: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => void;
  onCancel: () => void;
}

const timeSlots = Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`); // 08:00 to 18:00

const BookingForm: React.FC<BookingFormProps> = ({ room, date, existingBookings, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    bookerName: '',
    phone: '',
    participants: 1,
    meetingType: 'Onsite' as 'Online' | 'Onsite',
    purpose: '',
    equipment: '',
    startTime: '',
    endTime: '',
    isMultiDay: false,
    endDate: date,
  });
  const [error, setError] = useState('');

  const bookedSlots = useMemo(() => {
    const bookingsOnDate = existingBookings.filter(b => b.roomName === room.name && b.date === date && b.status === 'จองแล้ว');
    const slots = new Set<string>();
    bookingsOnDate.forEach(b => {
      const start = timeSlots.indexOf(b.startTime);
      const end = timeSlots.indexOf(b.endTime);
      for (let i = start; i < end; i++) {
        slots.add(timeSlots[i]);
      }
    });
    return slots;
  }, [existingBookings, room.name, date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, isMultiDay: e.target.checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.bookerName || !formData.phone || !formData.startTime || !formData.endTime || !formData.purpose) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }
    
    // Multi-day booking logic
    const bookingsToCreate = [];
    if (formData.isMultiDay) {
        let currentDate = new Date(date);
        const lastDate = new Date(formData.endDate);
        const groupId = Math.random().toString(36).substring(2, 15);
        const dateRange = `${new Date(date).toLocaleDateString('th-TH')} - ${lastDate.toLocaleDateString('th-TH')}`;
        
        while(currentDate <= lastDate) {
            bookingsToCreate.push({ ...formData, attachments: [], isMultiDay: true, date: currentDate.toISOString().split('T')[0], roomName: room.name, groupId, dateRange });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else {
        bookingsToCreate.push({ ...formData, attachments: [], isMultiDay: false, date: date, roomName: room.name });
    }
    
    onSubmit(bookingsToCreate);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">จอง {room.name}</h2>
      <p className="text-gray-600 mb-6">วันที่: {new Date(date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อผู้จอง</label>
            <input type="text" name="bookerName" value={formData.bookerName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
          </div>
        </div>

        <div className="flex items-center gap-4">
            <input type="checkbox" id="isMultiDay" name="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <label htmlFor="isMultiDay" className="text-sm font-medium text-gray-700">จองหลายวัน</label>
        </div>
        
        {formData.isMultiDay && (
            <div>
                <label className="block text-sm font-medium text-gray-700">ถึงวันที่</label>
                <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} min={date} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">เวลาเริ่มต้น</label>
            <select name="startTime" value={formData.startTime} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                <option value="">เลือกเวลา</option>
                {timeSlots.map(t => <option key={t} value={t} disabled={bookedSlots.has(t)}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">เวลาสิ้นสุด</label>
            <select name="endTime" value={formData.endTime} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                <option value="">เลือกเวลา</option>
                {timeSlots.map(t => <option key={t} value={t} disabled={t <= formData.startTime}>{t}</option>)}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">วัตถุประสงค์การจอง</label>
          <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        
        {/* Other fields */}
        
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button>
          <Button type="submit" variant="primary">ยืนยันการจอง</Button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
