
import React, { useState, useEffect, useRef } from 'react';
import { Room, Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import ThaiDatePicker from '../shared/ThaiDatePicker';

interface BookingFormProps {
  room: Room;
  rooms: Room[];
  date: string;
  existingBookings: Booking[];
  onSubmit: (newBookings: Omit<Booking, 'id' | 'createdAt' | 'status'>[]) => void;
  onUpdate?: (bookingToEdit: Booking, newFormData: any, newSelectedRoomIds: number[]) => void;
  bookingToEdit?: Booking | null;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

const FormField: React.FC<{label: string, icon: string, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
  <div className="animate-fade-in group">
    <label className="flex items-center text-sm font-bold text-gray-600 mb-2 group-focus-within:text-blue-600 transition-colors">
      <span className="mr-2 text-xl">{icon}</span>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const BookingForm: React.FC<BookingFormProps> = ({ room, rooms, date, existingBookings, onSubmit, onUpdate, bookingToEdit, onCancel, showToast }) => {
  const isEditing = !!bookingToEdit;
  const isInitialized = useRef(false);
  const editingId = useRef<string | null>(bookingToEdit?.id || null);
  const isDirty = useRef(false);

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
    if (isDirty.current) return;
    if (isInitialized.current && editingId.current === (bookingToEdit?.id || null)) return;

    if (bookingToEdit) {
        let roomIdsToSelect: number[] = [];
        let endDateForForm = bookingToEdit.date;
        if (bookingToEdit.groupId) {
            const groupBookings = existingBookings.filter(b => b.groupId === bookingToEdit.groupId);
            const uniqueRoomNames = [...new Set(groupBookings.map(b => b.roomName))];
            roomIdsToSelect = rooms.filter(r => uniqueRoomNames.includes(r.name)).map(r => r.id);
            if (bookingToEdit.isMultiDay && groupBookings.length > 0) {
                endDateForForm = groupBookings.reduce((max, b) => (b.date > max ? b.date : max), groupBookings[0].date);
            }
        } else {
            const roomToEdit = rooms.find(r => r.name === bookingToEdit.roomName);
            if (roomToEdit) roomIdsToSelect = [roomToEdit.id];
        }

        setSelectedRoomIds(roomIdsToSelect);
        setCurrentDate(bookingToEdit.date);
        setFormData({
            bookerName: bookingToEdit.bookerName,
            phone: bookingToEdit.phone,
            participants: bookingToEdit.participants,
            meetingType: bookingToEdit.meetingType,
            purpose: bookingToEdit.purpose,
            equipment: bookingToEdit.equipment || '',
            attachmentUrl: bookingToEdit.attachmentUrl || '',
            startTime: bookingToEdit.startTime,
            endTime: bookingToEdit.endTime,
            isMultiDay: bookingToEdit.isMultiDay || false,
            endDate: endDateForForm,
        });
    } else {
        setSelectedRoomIds([room.id]);
        setCurrentDate(date);
        setFormData(prev => ({ ...prev, bookerName: '', phone: '', purpose: '', startTime: '', endTime: '', isMultiDay: false, endDate: date }));
    }
    isInitialized.current = true;
    editingId.current = bookingToEdit?.id || null;
  }, [bookingToEdit, rooms, room, date, existingBookings]);

  // ฟังก์ชันตรวจสอบการจองซ้ำ (Conflict Detection)
  const checkConflict = (roomName: string, checkDate: string, startTime: string, endTime: string): boolean => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);

    return existingBookings.some(b => {
      // ข้ามรายการที่กำลังแก้ไขอยู่
      if (isEditing && bookingToEdit && b.id === bookingToEdit.id) return false;
      if (isEditing && bookingToEdit && bookingToEdit.groupId && b.groupId === bookingToEdit.groupId) return false;
      
      if (b.roomName === roomName && b.date === checkDate && b.status === 'จองแล้ว') {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        // เงื่อนไขการทับซ้อนของเวลา
        return (startM < bEnd && endM > bStart);
      }
      return false;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    isDirty.current = true;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };
  
  const handleMultiRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    const roomId = parseInt(e.target.value, 10);
    setSelectedRoomIds(prev => e.target.checked ? [...prev, roomId] : prev.filter(id => id !== roomId));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    const isChecked = e.target.checked;
    setFormData(prev => ({ ...prev, isMultiDay: isChecked, endDate: isChecked ? (prev.endDate || currentDate) : currentDate }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (selectedRoomIds.length === 0) {
      setError('⚠️ กรุณาเลือกอย่างน้อยหนึ่งห้องประชุม');
      return;
    }

    if (!formData.bookerName || !formData.startTime || !formData.endTime || !formData.purpose) {
      setError('⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    const startMin = timeToMinutes(formData.startTime);
    const endMin = timeToMinutes(formData.endTime);
    if (startMin >= endMin) {
      setError('⚠️ เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }

    // --- ตรวจสอบ Conflict ก่อนจองจริง ---
    const firstDate = new Date(currentDate);
    const lastDate = formData.isMultiDay ? new Date(formData.endDate) : firstDate;
    
    for (const rid of selectedRoomIds) {
      const rName = rooms.find(r => r.id === rid)?.name;
      if (!rName) continue;
      
      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        if (checkConflict(rName, dStr, formData.startTime, formData.endTime)) {
          setError(`🚫 ขออภัย: ห้อง "${rName}" ในวันที่ ${new Date(dStr).toLocaleDateString('th-TH')} ช่วงเวลา ${formData.startTime}-${formData.endTime} มีผู้จองไปแล้ว กรุณาเลือกเวลาอื่น`);
          return;
        }
      }
    }

    setLoading(true);

    if (isEditing && onUpdate && bookingToEdit) {
        onUpdate(bookingToEdit, { ...formData, date: currentDate }, selectedRoomIds);
        setLoading(false);
        return;
    }

    const bookingsToCreate = [];
    const hasMultiple = selectedRoomIds.length > 1 || formData.isMultiDay;
    const groupId = hasMultiple ? uuidv4() : undefined;
    const dateRange = formData.isMultiDay ? `${new Date(currentDate).toLocaleDateString('th-TH')} - ${lastDate.toLocaleDateString('th-TH')}`: undefined;
        
    for (const roomId of selectedRoomIds) {
      const roomName = rooms.find(r => r.id === roomId)?.name;
      if (!roomName) continue;
      const loopDate = new Date(firstDate);
      for (let d = loopDate; d <= lastDate; d.setDate(d.getDate() + 1)) {
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

  const inputClasses = "block w-full rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-200 placeholder-gray-400";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 md:px-0 mb-20">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-blue-50">
        <div className="mb-10 pb-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-2xl">{isEditing ? '✏️' : '📝'}</div>
            <div>
                <h2 className="text-2xl font-black text-blue-800 tracking-tight">{isEditing ? 'แก้ไขข้อมูลการจอง' : 'กรอกแบบฟอร์มการจอง'}</h2>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Conference Room Booking Form</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-50 text-gray-400 hover:text-gray-600 font-bold text-sm rounded-lg transition-colors">ยกเลิก</button>
        </div>
      
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-100 p-5 rounded-2xl flex items-start gap-4 sticky top-20 z-10">
                <span className="text-2xl">🚫</span>
                <p className="text-red-700 font-black text-sm leading-relaxed">{error}</p>
            </div>
          )}
          
          <FormField label="เลือกห้องประชุม" icon="🏢" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-blue-50/30 rounded-3xl border border-blue-100 max-h-60 overflow-y-auto">
              {rooms.map(r => (
                <div key={r.id} className={`flex items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedRoomIds.includes(r.id) ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent hover:border-blue-200'}`}>
                  <input 
                    type="checkbox" 
                    id={`room-${r.id}`} 
                    value={r.id} 
                    checked={selectedRoomIds.includes(r.id)} 
                    onChange={handleMultiRoomChange} 
                    disabled={r.status === 'closed' && !selectedRoomIds.includes(r.id)} 
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`room-${r.id}`} className="ml-3 text-sm font-bold text-gray-700 cursor-pointer">{r.name}</label>
                </div>
              ))}
            </div>
          </FormField>

          <div className="flex items-center gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
              <input type="checkbox" id="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
              <label htmlFor="isMultiDay" className="font-black text-blue-900 text-sm cursor-pointer">ต้องการจองต่อเนื่องหลายวัน</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <ThaiDatePicker 
                label={formData.isMultiDay ? "วันที่เริ่ม" : "วันที่จัดงาน"} 
                icon="🗓️" 
                value={currentDate} 
                onChange={setCurrentDate} 
                required 
             />
             {formData.isMultiDay && (
                <ThaiDatePicker 
                  label="วันที่สิ้นสุด" 
                  icon="🗓️" 
                  value={formData.endDate} 
                  onChange={(val) => { isDirty.current = true; setFormData(prev => ({...prev, endDate: val})); }} 
                  required 
                />
             )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField label="เริ่มเวลา" icon="⏰" required>
              <select name="startTime" value={formData.startTime} onChange={handleInputChange} className={inputClasses} required>
                  <option value="">-- เลือกเวลา --</option>
                  {timeSlots.slice(0, -1).map(t => <option key={t} value={t}>{t} น.</option>)}
              </select>
            </FormField>
            <FormField label="ถึงเวลา" icon="⏰" required>
              <select name="endTime" value={formData.endTime} onChange={handleInputChange} className={inputClasses} required>
                  <option value="">-- เลือกเวลา --</option>
                  {timeSlots.map(t => <option key={t} value={t} disabled={timeToMinutes(t) <= timeToMinutes(formData.startTime)}>{t} น.</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField label="หน่วยงาน / งาน" icon="🏢" required>
              <input type="text" name="bookerName" value={formData.bookerName} onChange={handleInputChange} className={inputClasses} placeholder="เช่น งานประชาสัมพันธ์" required />
            </FormField>
            <FormField label="เบอร์โทรศัพท์" icon="📱">
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} placeholder="เช่น 0812345678" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField label="จำนวนผู้เข้าร่วม" icon="👥" required>
              <input type="number" name="participants" min="1" value={formData.participants} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
            <FormField label="รูปแบบการประชุม" icon="💻" required>
              <select name="meetingType" value={formData.meetingType} onChange={handleInputChange} className={inputClasses} required>
                <option value="Onsite">Onsite (ที่วิทยาลัย)</option>
                <option value="Online">Online (ผ่านระบบออนไลน์)</option>
              </select>
            </FormField>
          </div>

          <FormField label="วัตถุประสงค์ / ชื่องานกิจกรรม" icon="🎯" required>
            <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุชื่อโครงการ หรือกิจกรรมที่จัด..." required />
          </FormField>

          <FormField label="อุปกรณ์เพิ่มเติม" icon="🛠️">
            <textarea name="equipment" value={formData.equipment} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุอุปกรณ์ที่ต้องการ เช่น ไมโครโฟนเสริม, โปรเจคเตอร์" />
          </FormField>

          <FormField label="ลิงก์ไฟล์แนบ (ถ้ามี)" icon="📎">
            <input 
              type="url" 
              name="attachmentUrl" 
              value={formData.attachmentUrl} 
              onChange={handleInputChange} 
              className={inputClasses}
              placeholder="https://docs.google.com/document/d/..."
            />
          </FormField>
          
          <div className="flex justify-end gap-4 pt-10 border-t border-gray-50">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ย้อนกลับ</Button>
            <Button type="submit" variant="primary" loading={loading} className="px-10">{isEditing ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
