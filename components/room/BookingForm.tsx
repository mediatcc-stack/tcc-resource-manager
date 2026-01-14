
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
  const [loading, setLoading] = useState(false);

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
    const isChecked = e.target.checked;
    setFormData(prev => ({ 
      ...prev, 
      isMultiDay: isChecked,
      endDate: isChecked ? prev.endDate : date
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const requiredFields = [formData.bookerName, formData.phone, formData.startTime, formData.endTime, formData.purpose, formData.participants > 0, formData.meetingType];
    if (requiredFields.some(f => !f)) {
      setError('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }
    
    const bookingsToCreate = [];
    let currentDate = new Date(date);
    const lastDate = formData.isMultiDay ? new Date(formData.endDate) : new Date(date);

    if (lastDate < currentDate) {
        setError('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
        return;
    }

    // --- CRITICAL LOGIC FIX: Check for conflicts on all days ---
    const startIdx = timeSlots.indexOf(formData.startTime);
    const endIdx = timeSlots.indexOf(formData.endTime);

    for (let d = new Date(currentDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const checkDateStr = d.toISOString().split('T')[0];
        const bookingsOnThisDay = existingBookings.filter(b => b.roomName === room.name && b.date === checkDateStr && b.status === 'จองแล้ว');
        
        for (const existingBooking of bookingsOnThisDay) {
            const existingStartIdx = timeSlots.indexOf(existingBooking.startTime);
            const existingEndIdx = timeSlots.indexOf(existingBooking.endTime);
            if (Math.max(startIdx, existingStartIdx) < Math.min(endIdx, existingEndIdx)) {
                setError(`เกิดข้อขัดแย้ง: มีการจองทับซ้อนในวันที่ ${d.toLocaleDateString('th-TH')}`);
                return;
            }
        }
    }
    // --- END LOGIC FIX ---

    setLoading(true);

    const groupId = formData.isMultiDay ? Math.random().toString(36).substring(2, 15) : undefined;
    const dateRange = formData.isMultiDay ? `${new Date(date).toLocaleDateString('th-TH')} - ${lastDate.toLocaleDateString('th-TH')}`: undefined;
        
    for (let d = new Date(currentDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        bookingsToCreate.push({ 
            ...formData, 
            attachments: [], 
            isMultiDay: formData.isMultiDay, 
            date: d.toISOString().split('T')[0], 
            roomName: room.name, 
            groupId, 
            dateRange 
        });
    }
    
    // Simulate API call delay
    setTimeout(() => {
        onSubmit(bookingsToCreate);
        setLoading(false);
    }, 500);
  };

  const FormField: React.FC<{label: string, icon: string, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
    <div>
      <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
        <span className="mr-2 text-xl">{icon}</span>
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );

  const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const disabledInputClasses = "block w-full rounded-lg border border-gray-200 p-3 bg-gray-100 text-gray-600 cursor-not-allowed";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
        <div className="mb-8 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <h2 className="text-2xl font-bold text-[#0D448D]">แบบฟอร์มการจอง</h2>
          </div>
          <p className="text-gray-500 mt-2 ml-10">ห้อง: <span className="font-semibold text-gray-700">{room.name}</span></p>
        </div>
      
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg font-semibold border border-red-200">{error}</p>}
          
          <div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <input type="checkbox" id="isMultiDay" name="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-5 w-5 rounded border-gray-300 text-[#0D448D] focus:ring-[#0D448D]" />
                  <label htmlFor="isMultiDay" className="font-semibold text-gray-800">จองหลายวันต่อเนื่อง (เช่น อบรม/สัมมนา 3 วัน)</label>
              </div>
              {formData.isMultiDay && (
                <div className="mt-3 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                    <p className="font-semibold">💡 คำแนะนำสำหรับการจองหลายวัน</p>
                    <p className="text-sm">เหมาะสำหรับการอบรม สัมมนา หรืองานที่ใช้ห้องเดียวกันต่อเนื่อง ระบบจะยึดการจองทุกวันตั้งแต่วันเริ่มต้นถึงสิ้นสุด ในช่วงเวลาเดียวกัน</p>
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField label={formData.isMultiDay ? "วันเริ่มต้น" : "วันที่"} icon="🗓️" required>
                <input type="date" value={date} className={disabledInputClasses} readOnly />
            </FormField>
             {formData.isMultiDay && (
                <FormField label="วันสิ้นสุด" icon="🗓️" required>
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} min={date} className={inputClasses} required />
                </FormField>
             )}
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField label="เวลาเริ่มต้น" icon="⏰" required>
              <select name="startTime" value={formData.startTime} onChange={handleInputChange} className={inputClasses} required>
                  <option value="">-- เลือกเวลา --</option>
                  {timeSlots.map(t => <option key={t} value={t} disabled={bookedSlots.has(t)}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="เวลาสิ้นสุด" icon="⏰" required>
              <select name="endTime" value={formData.endTime} onChange={handleInputChange} className={inputClasses} required>
                  <option value="">-- เลือกเวลา --</option>
                  {timeSlots.map(t => <option key={t} value={t} disabled={t <= formData.startTime}>{t}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="ชื่อ-นามสกุลผู้จอง" icon="👤" required>
              <input type="text" name="bookerName" placeholder="กรอกชื่อ-นามสกุล" value={formData.bookerName} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
            <FormField label="เบอร์โทรศัพท์" icon="📱" required>
              <input type="tel" name="phone" placeholder="0812345678" value={formData.phone} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="จำนวนผู้เข้าร่วม" icon="👥" required>
              <input type="number" name="participants" min="1" placeholder="1" value={formData.participants} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
            <FormField label="รูปแบบการประชุม" icon="💻" required>
              <select name="meetingType" value={formData.meetingType} onChange={handleInputChange} className={inputClasses} required>
                  <option value="Onsite">Onsite (ที่วิทยาลัย)</option>
                  <option value="Online">Online</option>
              </select>
            </FormField>
          </div>

          <FormField label="วัตถุประสงค์การใช้งาน" icon="🎯" required>
            <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุวัตถุประสงค์ เช่น ประชุมฝ่ายบริหาร, จัดอบรมบุคลากร" required />
          </FormField>
          
          <FormField label="อุปกรณ์เพิ่มเติมที่ต้องการ (ถ้ามี)" icon="🛠️">
            <input type="text" name="equipment" value={formData.equipment} onChange={handleInputChange} className={inputClasses} placeholder="เช่น ไมโครโฟน 4 ตัว, Notebook 1 เครื่อง" />
          </FormField>
          
          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ยกเลิก</Button>
            <Button type="submit" variant="primary" loading={loading}>ยืนยันการจอง</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
