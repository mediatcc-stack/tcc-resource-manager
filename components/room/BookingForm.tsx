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
  onUpdate?: (bookingToEdit: Booking, newFormData: any, newSelectedRoomIds: number[]) => void;
  bookingToEdit?: Booking | null;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 07:00 to 18:00

// Helper: Convert "HH:mm" to total minutes since start of day
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

const FormField: React.FC<{label: string, icon: string, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
  <div className="animate-fade-in">
    <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
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
        let roomIdsToSelect: number[] = [];
        if (bookingToEdit.groupId) {
            const groupBookings = existingBookings.filter(b => b.groupId === bookingToEdit.groupId);
            const uniqueRoomNames = [...new Set(groupBookings.map(b => b.roomName))];
            roomIdsToSelect = rooms.filter(r => uniqueRoomNames.includes(r.name)).map(r => r.id);
        } else {
            const roomToEdit = rooms.find(r => r.name === bookingToEdit.roomName);
            if (roomToEdit) {
                roomIdsToSelect = [roomToEdit.id];
            }
        }
        setSelectedRoomIds(roomIdsToSelect);
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
            isMultiDay: false, 
            endDate: bookingToEdit.date,
        });
    } else {
        setSelectedRoomIds([room.id]);
        setCurrentDate(date);
    }
}, [bookingToEdit, rooms, room, date, existingBookings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(''); // Clear error when user types
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
      setError('⚠️ กรุณาเลือกอย่างน้อยหนึ่งห้องประชุม');
      return;
    }

    if (!formData.bookerName || !formData.startTime || !formData.endTime || !formData.purpose) {
      setError('⚠️ กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);

    if (startMinutes >= endMinutes) {
      setError('⚠️ เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }

    // Check for past time if booking for today
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentDate === todayStr) {
        const now = new Date();
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        if (startMinutes < currentMinutes && !isEditing) {
            setError('⚠️ ไม่สามารถจองย้อนหลังในเวลาที่ผ่านมาแล้วของวันนี้ได้');
            return;
        }
    }
    
    setLoading(true);

    const firstDate = new Date(currentDate);
    const lastDate = formData.isMultiDay ? new Date(formData.endDate) : new Date(currentDate);

    if (lastDate < firstDate) {
        setError('⚠️ วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
        setLoading(false);
        return;
    }

    // --- Core Overlap Check Logic ---
    for (const roomId of selectedRoomIds) {
      const roomObj = rooms.find(r => r.id === roomId);
      if (!roomObj) continue;

      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
          const checkDateStr = d.toISOString().split('T')[0];
          
          const conflictBookings = existingBookings.filter(b => 
              b.roomName === roomObj.name && 
              b.date === checkDateStr && 
              b.status === 'จองแล้ว'
          );

          for (const existing of conflictBookings) {
              // Skip self or group-mates when editing
              if (isEditing && bookingToEdit) {
                  if (existing.id === bookingToEdit.id) continue;
                  if (bookingToEdit.groupId && existing.groupId === bookingToEdit.groupId) continue;
              }

              const exStart = timeToMinutes(existing.startTime);
              const exEnd = timeToMinutes(existing.endTime);

              // Overlap check: (NewStart < ExistEnd) AND (NewEnd > ExistStart)
              if (startMinutes < exEnd && endMinutes > exStart) {
                  setError(`❌ ตรวจพบการจองซ้อน: "${roomObj.name}" มีผู้จองแล้วในช่วงเวลา ${existing.startTime} - ${existing.endTime} (ผู้จอง: ${existing.bookerName}) กรุณาเลือกเวลาอื่น`);
                  setLoading(false);
                  return;
              }
          }
      }
    }
    
    if (isEditing && onUpdate && bookingToEdit) {
        onUpdate(bookingToEdit, formData, selectedRoomIds);
        setLoading(false);
        return;
    }

    const bookingsToCreate = [];
    const hasMultipleSelections = selectedRoomIds.length > 1 || formData.isMultiDay;
    const groupId = hasMultipleSelections ? uuidv4() : undefined;
    const dateRange = formData.isMultiDay ? `${new Date(currentDate).toLocaleDateString('th-TH')} - ${lastDate.toLocaleDateString('th-TH')}`: undefined;
        
    for (const roomId of selectedRoomIds) {
      const roomName = rooms.find(r => r.id === roomId)?.name;
      if (!roomName) continue;

      const createDate = new Date(firstDate);
      for (let d = new Date(createDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
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

  const inputClasses = "block w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 transition-all duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white disabled:bg-gray-200 disabled:cursor-not-allowed font-medium";
  
  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 md:px-0 mb-20">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-gray-100">
        <div className="mb-10 pb-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-2xl">
                {isEditing ? '✏️' : '📝'}
            </div>
            <div>
                <h2 className="text-2xl font-black text-[#0D448D] tracking-tight">{isEditing ? 'แก้ไขข้อมูลการจอง' : 'กรอกแบบฟอร์มการจอง'}</h2>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Conference Room Booking Form</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 font-bold text-sm">ยกเลิกและกลับหน้าหลัก</button>
        </div>
      
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-100 p-5 rounded-2xl flex items-start gap-4 animate-shake">
                <span className="text-2xl">🚫</span>
                <p className="text-red-700 font-black text-sm leading-relaxed">{error}</p>
            </div>
          )}
          
          <FormField label="เลือกห้องประชุมที่ต้องการ" icon="🏢" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-slate-50 rounded-3xl border border-slate-100 max-h-60 overflow-y-auto shadow-inner">
              {rooms.map(r => (
                <div key={r.id} 
                     className={`flex items-center p-3 rounded-xl border-2 transition-all ${selectedRoomIds.includes(r.id) ? 'bg-white border-[#0D448D] shadow-sm' : 'border-transparent bg-transparent hover:bg-white/50'}`}>
                  <input
                    type="checkbox"
                    id={`room-${r.id}`}
                    value={r.id}
                    checked={selectedRoomIds.includes(r.id)}
                    onChange={handleMultiRoomChange}
                    disabled={r.status === 'closed' && !selectedRoomIds.includes(r.id)}
                    className="h-5 w-5 rounded-md border-gray-300 text-[#0D448D] focus:ring-[#0D448D]"
                  />
                  <label htmlFor={`room-${r.id}`} className={`ml-3 text-sm font-black ${selectedRoomIds.includes(r.id) ? 'text-[#0D448D]' : 'text-gray-500'} ${r.status === 'closed' ? 'opacity-40 italic' : ''}`}>
                    {r.name} {r.status === 'closed' && '(งดใช้)'}
                  </label>
                </div>
              ))}
            </div>
          </FormField>

          {!isEditing && (
            <div className="flex items-center gap-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 group transition-all hover:bg-indigo-50">
                <input type="checkbox" id="isMultiDay" name="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-6 w-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                <label htmlFor="isMultiDay" className="font-black text-indigo-900 text-sm cursor-pointer">ต้องการจองต่อเนื่องหลายวัน (เช่น อบรม 2-3 วัน)</label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <FormField label={formData.isMultiDay ? "วันที่เริ่ม" : "วันที่จัดงาน"} icon="🗓️" required>
                <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} min={isEditing ? undefined : new Date().toISOString().split('T')[0]} className={inputClasses} required disabled={isEditing}/>
            </FormField>
             {formData.isMultiDay && !isEditing && (
                <FormField label="วันที่สิ้นสุด" icon="🗓️" required>
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} min={currentDate} className={inputClasses} required />
                </FormField>
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
            <FormField label="ชื่อผู้จอง / ผู้ประสานงาน" icon="👤" required>
              <input type="text" name="bookerName" placeholder="ระบุชื่อ-นามสกุล" value={formData.bookerName} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
            <FormField label="เบอร์โทรศัพท์ที่ติดต่อได้" icon="📱" required>
              <input type="tel" name="phone" placeholder="08x-xxx-xxxx" value={formData.phone} onChange={handleInputChange} className={inputClasses} required />
            </FormField>
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField label="จำนวนผู้เข้าร่วม" icon="👥" required>
              <div className="relative">
                <input type="number" name="participants" min="1" placeholder="1" value={formData.participants} onChange={handleInputChange} className={`${inputClasses} pr-12`} required />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">คน</span>
              </div>
            </FormField>
            <FormField label="รูปแบบงาน" icon="💻" required>
              <select name="meetingType" value={formData.meetingType} onChange={handleInputChange} className={inputClasses} required>
                  <option value="Onsite">Onsite (ที่วิทยาลัย)</option>
                  <option value="Online">Online / Hybrid</option>
              </select>
            </FormField>
          </div>

          <FormField label="ชื่องาน / วัตถุประสงค์" icon="🎯" required>
            <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุรายละเอียด เช่น ประชุมวางแผนงบประมาณปี 2568" required />
          </FormField>
          
          <FormField label="อุปกรณ์ที่ต้องเตรียมเพิ่มเติม" icon="🛠️">
            <input type="text" name="equipment" value={formData.equipment} onChange={handleInputChange} className={inputClasses} placeholder="เช่น ป้ายชื่อหน้าห้อง, ไมค์ลอย 2 ตัว" />
          </FormField>

          <FormField label="ลิงก์เอกสารประกอบ (ถ้ามี)" icon="🔗">
              <input type="url" name="attachmentUrl" value={formData.attachmentUrl} onChange={handleInputChange} className={inputClasses} placeholder="เช่น Google Drive หรือลิงก์โครงการ" />
          </FormField>
          
          <div className="flex flex-col md:flex-row justify-end gap-4 pt-10 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onCancel} className="w-full md:w-auto px-10 py-4 rounded-2xl" disabled={loading}>
              ย้อนกลับ
            </Button>
            <Button type="submit" variant="primary" loading={loading} className="w-full md:w-auto px-12 py-4 rounded-2xl shadow-xl shadow-blue-200">
                {isEditing ? 'บันทึกการแก้ไข' : 'ยืนยันการจองห้อง'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;