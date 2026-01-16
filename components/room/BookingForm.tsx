import React, { useState, useMemo, useEffect } from 'react';
import { Room, Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS } from '../../constants';
import { v4 as uuidv4 } from 'uuid';

interface BookingFormProps {
  room: Room;
  rooms: Room[];
  date: string;
  existingBookings: Booking[];
  onSubmit: (newBookings: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => void;
  onUpdate?: (updatedBooking: Booking) => void;
  bookingToEdit?: Booking | null;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 07:00 to 18:00

// Moved FormField outside the component to prevent re-definition on re-renders, fixing the focus loss issue.
const FormField: React.FC<{label: string, icon: string, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
  <div>
    <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
      <span className="mr-2 text-xl">{icon}</span>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const BookingForm: React.FC<BookingFormProps> = ({ room, rooms, date, existingBookings, onSubmit, onUpdate, bookingToEdit, onCancel, showToast }) => {
  const isEditing = !!bookingToEdit;

  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(date);
  
  const [formData, setFormData] = useState({
    bookerName: '',
    phone: '',
    participants: 1,
    meetingType: 'Onsite' as 'Online' | 'Onsite',
    purpose: '',
    equipment: '',
    attachmentUrl: '',
    startTime: '',
    endTime: '',
    isMultiDay: false,
    endDate: currentDate,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bookingToEdit) {
      const roomToEdit = rooms.find(r => r.name === bookingToEdit.roomName);
      setSelectedRoomIds(roomToEdit ? [roomToEdit.id] : []);
      setCurrentDate(bookingToEdit.date);
      setFormData({
        bookerName: bookingToEdit.bookerName,
        phone: bookingToEdit.phone,
        participants: bookingToEdit.participants,
        meetingType: bookingToEdit.meetingType,
        purpose: bookingToEdit.purpose,
        equipment: bookingToEdit.equipment,
        attachmentUrl: bookingToEdit.attachmentUrl || '',
        startTime: bookingToEdit.startTime,
        endTime: bookingToEdit.endTime,
        isMultiDay: bookingToEdit.isMultiDay,
        endDate: bookingToEdit.isMultiDay && bookingToEdit.dateRange
          ? new Date(bookingToEdit.dateRange.split(' - ')[1].split('/').reverse().join('-')).toISOString().split('T')[0]
          : bookingToEdit.date,
      });
    } else {
      setSelectedRoomIds([room.id]);
    }
  }, [bookingToEdit, rooms, room]);
  
  useEffect(() => {
    if (formData.isMultiDay && !isEditing) {
      setFormData(prev => ({...prev, endDate: currentDate}));
    }
  }, [currentDate, formData.isMultiDay, isEditing]);

  const bookedSlotsByRoom = useMemo(() => {
    const slotsMap = new Map<number, Set<string>>();
    for (const r of rooms) {
      const bookingsOnDate = existingBookings.filter(b => 
          b.roomName === r.name && 
          b.date === currentDate && 
          b.status === 'จองแล้ว' &&
          b.id !== bookingToEdit?.id
      );
      const slots = new Set<string>();
      bookingsOnDate.forEach(b => {
        const start = timeSlots.indexOf(b.startTime);
        const end = timeSlots.indexOf(b.endTime);
        for (let i = start; i < end; i++) {
          slots.add(timeSlots[i]);
        }
      });
      slotsMap.set(r.id, slots);
    }
    return slotsMap;
  }, [existingBookings, rooms, currentDate, bookingToEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleMultiRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const roomId = parseInt(e.target.value, 10);
    setSelectedRoomIds(prev =>
        e.target.checked
            ? [...prev, roomId]
            : prev.filter(id => id !== roomId)
    );
};

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setFormData(prev => ({ 
      ...prev, 
      isMultiDay: isChecked,
      endDate: isChecked ? prev.endDate : currentDate
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (selectedRoomIds.length === 0) {
      setError('กรุณาเลือกอย่างน้อยหนึ่งห้องประชุม');
      return;
    }

    if (!formData.bookerName || !formData.startTime || !formData.endTime || !formData.purpose || formData.participants <= 0) {
      setError('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }
    
    setLoading(true);

    const firstDate = new Date(currentDate);
    const lastDate = formData.isMultiDay ? new Date(formData.endDate) : new Date(currentDate);

    if (lastDate < firstDate) {
        setError('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
        setLoading(false);
        return;
    }

    if (isEditing && onUpdate && bookingToEdit) {
      const updatedRoomName = rooms.find(r => r.id === selectedRoomIds[0])?.name || bookingToEdit.roomName;
      const updatedBooking: Booking = {
        ...bookingToEdit,
        ...formData,
        roomName: updatedRoomName,
        date: currentDate,
      };
      onUpdate(updatedBooking);
      setLoading(false);
      return;
    }

    const startIdx = timeSlots.indexOf(formData.startTime);
    const endIdx = timeSlots.indexOf(formData.endTime);

    for (const roomId of selectedRoomIds) {
      const roomName = rooms.find(r => r.id === roomId)?.name;
      if (!roomName) continue;

      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
          const checkDateStr = d.toISOString().split('T')[0];
          const bookingsOnThisDay = existingBookings.filter(b => b.roomName === roomName && b.date === checkDateStr && b.status === 'จองแล้ว');
          
          for (const existingBooking of bookingsOnThisDay) {
              const existingStartIdx = timeSlots.indexOf(existingBooking.startTime);
              const existingEndIdx = timeSlots.indexOf(existingBooking.endTime);
              if (Math.max(startIdx, existingStartIdx) < Math.min(endIdx, existingEndIdx)) {
                  setError(`เกิดข้อขัดแย้ง: ${roomName} มีการจองทับซ้อนในวันที่ ${d.toLocaleDateString('th-TH')}`);
                  setLoading(false);
                  return;
              }
          }
      }
    }
    
    const bookingsToCreate = [];
    const hasMultipleSelections = selectedRoomIds.length > 1 || formData.isMultiDay;
    const groupId = hasMultipleSelections ? uuidv4() : undefined;
    const dateRange = formData.isMultiDay ? `${new Date(currentDate).toLocaleDateString('th-TH')} - ${lastDate.toLocaleDateString('th-TH')}`: undefined;
        
    for (const roomId of selectedRoomIds) {
      const roomName = rooms.find(r => r.id === roomId)?.name;
      if (!roomName) continue;

      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
          bookingsToCreate.push({ 
              ...formData, 
              roomName,
              date: d.toISOString().split('T')[0], 
              groupId,
              dateRange,
              isMultiDay: formData.isMultiDay
          });
      }
    }
    
    onSubmit(bookingsToCreate);
    setLoading(false);
  };

  const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-200 disabled:cursor-not-allowed";
  
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
        <div className="mb-8 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isEditing ? '✏️' : '📝'}</span>
            <h2 className="text-2xl font-bold text-[#0D448D]">{isEditing ? 'แก้ไขข้อมูลการจอง' : 'แบบฟอร์มการจอง'}</h2>
          </div>
        </div>
      
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg font-semibold border border-red-200">{error}</p>}
          
          <FormField label="ห้องประชุม" icon="🏢" required>
            {isEditing ? (
              <select
                name="room"
                value={selectedRoomIds[0] || ''}
                onChange={e => setSelectedRoomIds([parseInt(e.target.value, 10)])}
                className={inputClasses}
                required
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id} disabled={r.status === 'closed' && !(bookingToEdit && bookingToEdit.roomName === r.name)}>{r.name}</option>
                ))}
              </select>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto space-y-3">
                {rooms.filter(r => r.status === 'available').map(r => (
                  <div key={r.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`room-${r.id}`}
                      value={r.id}
                      checked={selectedRoomIds.includes(r.id)}
                      onChange={handleMultiRoomChange}
                      className="h-4 w-4 rounded border-gray-300 text-[#0D448D] focus:ring-[#0D448D]"
                    />
                    <label htmlFor={`room-${r.id}`} className="ml-3 text-sm font-medium text-gray-800">{r.name}</label>
                  </div>
                ))}
              </div>
            )}
          </FormField>

          {!isEditing && (
            <div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <input type="checkbox" id="isMultiDay" name="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-5 w-5 rounded border-gray-300 text-[#0D448D] focus:ring-[#0D448D]"/>
                    <label htmlFor="isMultiDay" className="font-semibold text-gray-800">จองหลายวันต่อเนื่อง (เช่น อบรม/สัมมนา 3 วัน)</label>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField label={formData.isMultiDay ? "วันเริ่มต้น" : "วันที่"} icon="🗓️" required>
                <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} min={isEditing ? undefined : new Date().toISOString().split('T')[0]} className={inputClasses} required/>
            </FormField>
             {formData.isMultiDay && !isEditing && (
                <FormField label="วันสิ้นสุด" icon="🗓️" required>
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} min={currentDate} className={inputClasses} required />
                </FormField>
             )}
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField label="เวลาเริ่มต้น" icon="⏰" required>
              <select name="startTime" value={formData.startTime} onChange={handleInputChange} className={inputClasses} required>
                  <option value="">-- เลือกเวลา --</option>
                  {timeSlots.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
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
            <FormField label="เบอร์โทรศัพท์" icon="📱">
              <input type="tel" name="phone" placeholder="0812345678" value={formData.phone} onChange={handleInputChange} className={inputClasses} />
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

          <div>
              <FormField label="แนบลิงก์เอกสาร (ถ้ามี)" icon="🔗">
                  <input 
                      type="url" 
                      name="attachmentUrl" 
                      value={formData.attachmentUrl} 
                      onChange={handleInputChange} 
                      className={inputClasses} 
                      placeholder="https://docs.google.com/..." 
                  />
              </FormField>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 space-y-2">
                  <p className="font-bold flex items-center gap-2">📌 วิธีการแนบเอกสาร:</p>
                  <ol className="list-decimal list-inside pl-2 space-y-1">
                      <li>อัปโหลดไฟล์ของคุณไปยัง <strong>Google Drive</strong> หรือ <strong>Dropbox</strong></li>
                      <li>ตั้งสิทธิ์ให้เป็น <strong>"แชร์ให้ทุกคนที่มีลิงก์ดูได้"</strong></li>
                      <li>คัดลอกลิงก์มาวางข้างบน</li>
                  </ol>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="font-semibold flex items-center gap-2">💡 เคล็ดลับ:</p>
                      <ul className="list-disc list-inside pl-2 text-xs mt-1">
                          <li><strong>Google Drive:</strong> คลิกขวาที่ไฟล์ → แชร์ → เปลี่ยนเป็น "ทุกคนที่มีลิงก์" → คัดลอกลิงก์</li>
                          <li><strong>Dropbox:</strong> คลิกขวาที่ไฟล์ → แชร์ → สร้างลิงก์ → คัดลอกลิงก์</li>
                      </ul>
                  </div>
              </div>
          </div>
          
          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ยกเลิก</Button>
            <Button type="submit" variant="primary" loading={loading}>
                {isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'ยืนยันการจอง'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;