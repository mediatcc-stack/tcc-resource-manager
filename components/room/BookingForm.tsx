import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Room, Booking } from '../../types';
import Button from '../shared/Button';
import { ROOMS, APP_CONFIG } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import ThaiDatePicker from '../shared/ThaiDatePicker';
import { Calendar, Clock, Building2, Target, Users, Monitor, Package, Paperclip, ChevronRight, ChevronLeft, Check, AlertCircle, Wrench, Phone, ClipboardList } from 'lucide-react';

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

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

const formatThaiDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

const FormField: React.FC<{label: string, icon: React.ReactNode, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
  <div className="animate-fade-in group">
    <label className="flex items-center text-sm font-bold text-gray-600 mb-2 group-focus-within:text-primary transition-colors">
      <span className="mr-2 text-slate-400 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const ROOM_METADATA: Record<string, { capacity: number; equipment: string[]; type: string }> = {
  'ห้องประชุมธีรธรรมานันท์':            { capacity: 30,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'Video Call'], type: 'ห้องประชุม' },
  'ห้องประชุมเฉลิมพระเกียรติ':          { capacity: 50,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'ลำโพง'],      type: 'ห้องประชุม' },
  'ห้องประชุมมูลนิธิสมเด็จพระธีรญาณมุนี': { capacity: 20,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน'],              type: 'ห้องประชุม' },
  'ห้องประชุมสำเภาทอง':                 { capacity: 25,  equipment: ['TV Screen', 'ไมโครโฟน'],                 type: 'ห้องประชุม' },
  'ห้องประชุมไพโรจน์ปวะบุตร':           { capacity: 40,  equipment: ['โปรเจกเตอร์', 'ไมโครโฟน', 'ลำโพง'],      type: 'ห้องประชุม' },
  'ห้องงานสื่อการเรียนการสอน 421':       { capacity: 15,  equipment: ['โน้ตบุ๊ค', 'อุปกรณ์สื่อ'],              type: 'ห้องปฏิบัติการ' },
  'ห้อง CVM (ศูนย์บริหารเครือข่าย)':    { capacity: 20,  equipment: ['เซิร์ฟเวอร์', 'เครือข่าย'],             type: 'ห้องปฏิบัติการ' },
  'ลานโดมอเนกประสงค์':                  { capacity: 200, equipment: ['ระบบเสียง', 'แสงไฟ', 'พื้นที่โล่ง'],    type: 'อาคาร/โดม' },
  'หอประชุมประทีป ปฐมกสิกุล':           { capacity: 500, equipment: ['เวที', 'ระบบเสียง', 'แสงไฟ'],           type: 'อาคาร/โดม' },
};

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
    meetingType: ['Onsite'] as string[],
    purpose: '',
    equipment: '',
    attachmentUrl: '',
    startTime: '',
    endTime: '',
    isMultiDay: false,
    endDate: currentDate,
    roomArrangement: '',
    roomArrangementComment: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const validateStep = (step: number): boolean => {
    setError('');
    if (step === 1) {
      if (selectedRoomIds.length === 0) {
        setError('⚠️ กรุณาเลือกอย่างน้อยหนึ่งห้องประชุม');
        return false;
      }
      if (!currentDate || !formData.startTime || !formData.endTime) {
        setError('⚠️ กรุณาระบุวันที่และเวลาให้ครบถ้วน');
        return false;
      }
      if (formData.isMultiDay && !formData.endDate) {
        setError('⚠️ กรุณาระบุวันที่สิ้นสุดการจอง');
        return false;
      }
      const startMin = timeToMinutes(formData.startTime);
      const endMin = timeToMinutes(formData.endTime);
      if (startMin >= endMin) {
        setError('⚠️ เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
        return false;
      }
      // Check conflict
      const firstDate = new Date(currentDate);
      const lastDate = formData.isMultiDay ? new Date(formData.endDate) : firstDate;
      for (const rid of selectedRoomIds) {
        const rName = rooms.find(r => r.id === rid)?.name;
        if (!rName) continue;
        for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
          const dStr = d.toISOString().split('T')[0];
          if (checkConflict(rName, dStr, formData.startTime, formData.endTime)) {
            setError(`⚠️ ห้อง "${rName}" วันที่ ${new Date(dStr).toLocaleDateString('th-TH')} เวลา ${formData.startTime}-${formData.endTime} น. ไม่ว่าง`);
            return false;
          }
        }
      }
      return true;
    }
    if (step === 2) {
      if (!formData.purpose.trim()) {
        setError('⚠️ กรุณาระบุวัตถุประสงค์การจอง');
        return false;
      }
      if (!formData.participants || formData.participants < 1) {
        setError('⚠️ กรุณาระบุจำนวนผู้เข้าร่วม (อย่างน้อย 1 คน)');
        return false;
      }
      if (formData.meetingType.length === 0) {
        setError('⚠️ กรุณาเลือกรูปแบบการประชุมอย่างน้อยหนึ่งประเภท');
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!formData.bookerName.trim()) {
        setError('⚠️ กรุณาระบุหน่วยงาน / งาน ผู้จอง');
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onCancel();
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step === currentStep) {
      // do nothing
    } else {
      // Validate intermediate steps
      for (let s = currentStep; s < step; s++) {
        if (!validateStep(s)) return;
      }
      setCurrentStep(step);
    }
  };

  // Time picker options
  const hours = useMemo(() => Array.from({ length: 14 }, (_, i) => (i + 5).toString().padStart(2, '0')), []); // 05:00 to 18:00
  const minutes = useMemo(() => ['00', '15', '30', '45'], []);

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
            meetingType: Array.isArray(bookingToEdit.meetingType) ? bookingToEdit.meetingType : [bookingToEdit.meetingType],
            purpose: bookingToEdit.purpose,
            equipment: bookingToEdit.equipment || '',
            attachmentUrl: bookingToEdit.attachmentUrl || '',
            startTime: bookingToEdit.startTime,
            endTime: bookingToEdit.endTime,
            isMultiDay: bookingToEdit.isMultiDay || false,
            endDate: endDateForForm,
            roomArrangement: bookingToEdit.roomArrangement || '',
            roomArrangementComment: bookingToEdit.roomArrangement?.startsWith('other:')
              ? bookingToEdit.roomArrangement.slice(6)
              : '',
        });
    } else {
        setSelectedRoomIds([room.id]);
        setCurrentDate(date);
        setFormData(prev => ({ ...prev, bookerName: '', phone: '', purpose: '', startTime: '', endTime: '', isMultiDay: false, endDate: date, meetingType: ['Onsite'] }));
    }
    isInitialized.current = true;
    editingId.current = bookingToEdit?.id || null;
  }, [bookingToEdit, rooms, room, date, existingBookings]);

  const checkConflict = (roomName: string, checkDate: string, startTime: string, endTime: string): boolean => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);

    return existingBookings.some(b => {
      if (isEditing && bookingToEdit && b.id === bookingToEdit.id) return false;
      if (isEditing && bookingToEdit && bookingToEdit.groupId && b.groupId === bookingToEdit.groupId) return false;
      
      if (b.roomName === roomName && b.date === checkDate && b.status === 'จองแล้ว') {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return (startM < bEnd && endM > bStart);
      }
      return false;
    });
  };

  // ฟังก์ชันช่วยเช็คสถานะว่างของห้องแบบ Real-time
  const getRoomConflictStatus = (roomName: string) => {
    if (!currentDate || !formData.startTime || !formData.endTime || formData.startTime.includes('-') || formData.endTime.includes('-')) {
      return { status: 'idle', message: 'กรุณากรอกวัน-เวลา เพื่อเช็คสถานะ' };
    }

    const startMin = timeToMinutes(formData.startTime);
    const endMin = timeToMinutes(formData.endTime);
    if (startMin >= endMin) {
      return { status: 'error', message: 'เวลาเริ่มต้นต้องมาก่อนเวลาสิ้นสุด' };
    }

    const firstDate = new Date(currentDate);
    const lastDate = formData.isMultiDay ? new Date(formData.endDate) : firstDate;
    const conflictingBookings: Booking[] = [];

    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const conflict = existingBookings.find(b => {
        if (isEditing && bookingToEdit && b.id === bookingToEdit.id) return false;
        if (isEditing && bookingToEdit && bookingToEdit.groupId && b.groupId === bookingToEdit.groupId) return false;
        
        if (b.roomName === roomName && b.date === dStr && b.status === 'จองแล้ว') {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return (startMin < bEnd && endMin > bStart);
        }
        return false;
      });

      if (conflict) {
        conflictingBookings.push(conflict);
      }
    }

    if (conflictingBookings.length > 0) {
      const first = conflictingBookings[0];
      const thaiD = new Date(first.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      return { 
        status: 'conflict', 
        message: `❌ ไม่ว่าง: วันที่ ${thaiD} (${first.startTime}-${first.endTime} น. โดย ${first.bookerName.slice(0, 15)})` 
      };
    }

    return { status: 'available', message: '🟢 ว่าง — พร้อมจอง' };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    isDirty.current = true;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleTimePartChange = (
    fieldName: 'startTime' | 'endTime', 
    part: 'hour' | 'minute', 
    value: string
  ) => {
    isDirty.current = true;
    setError('');
    
    const oldTime = formData[fieldName] || '--:--';
    let [oldHour, oldMinute] = oldTime.split(':');
    
    let newTime;
    if (part === 'hour') {
        newTime = `${value}:${!oldMinute || oldMinute === '--' ? '00' : oldMinute}`;
    } else {
        newTime = `${!oldHour || oldHour === '--' ? '09' : oldHour}:${value}`;
    }
    
    setFormData(prev => ({ ...prev, [fieldName]: newTime }));
  };
  
  const handleMeetingTypeToggle = (type: string) => {
    isDirty.current = true;
    setFormData(prev => {
        const isSelected = prev.meetingType.includes(type);
        let newList = isSelected 
            ? prev.meetingType.filter(t => t !== type) 
            : [...prev.meetingType, type];
        
        if (newList.length === 0) newList = [type];
        
        return { ...prev, meetingType: newList };
    });
  };

  const toggleRoomSelection = (roomId: number, isClosed: boolean, isConflicted: boolean) => {
    isDirty.current = true;
    if (isClosed) {
      showToast('ห้องประชุมปิดปรับปรุงชั่วคราว', 'error');
      return;
    }
    if (isConflicted) {
      showToast('ห้องประชุมนี้ถูกจองแล้วในช่วงเวลาดังกล่าว', 'error');
      return;
    }

    setSelectedRoomIds(prev => 
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
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
    
    // ตรวจสอบความถูกต้องของข้อมูลทุกขั้นตอนก่อนบันทึก
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
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
      
      const loopStartDate = new Date(firstDate);
      for (let d = loopStartDate; d <= lastDate; d.setDate(d.getDate() + 1)) {
          const finalArrangement = formData.roomArrangement === 'other'
            ? `other:${formData.roomArrangementComment}`
            : formData.roomArrangement;

          bookingsToCreate.push({ 
              ...formData, 
              roomName,
              date: d.toISOString().split('T')[0], 
              groupId,
              dateRange,
              isMultiDay: formData.isMultiDay,
              roomArrangement: finalArrangement || undefined,
          });
      }
    }
    
    onSubmit(bookingsToCreate);
    setLoading(false);
  };

  const inputClasses = "block w-full rounded-xl border border-slate-200 bg-white p-3.5 text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-200 placeholder-gray-400 font-medium text-sm";
  
  const SelectWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
      </div>
    </div>
  );

  const selectedRoomNames = selectedRoomIds
    .map(id => rooms.find(r => r.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 md:px-0 mb-20">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-100">
        <div className="mb-10 pb-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-light rounded-2xl text-primary">
              {isEditing ? <Target className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
            </div>
            <div>
                <h2 className="text-xl font-bold text-primary tracking-tight">{isEditing ? 'แก้ไขข้อมูลการจอง' : 'กรอกแบบฟอร์มการจอง'}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{APP_CONFIG.collegeName}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-50 text-slate-400 hover:text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer">ย้อนกลับ</button>
        </div>

        {/* Progress Bar Wizard */}
        <div className="mb-12 flex items-center justify-between relative max-w-md mx-auto">
          <div className="absolute left-0 right-0 top-4.5 -translate-y-1/2 h-0.5 bg-slate-100 z-0">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />
          </div>
          
          {[
            { step: 1, label: 'วัน-เวลาและห้อง', icon: <Building2 className="w-4 h-4" /> },
            { step: 2, label: 'รายละเอียด', icon: <Target className="w-4 h-4" /> },
            { step: 3, label: 'ข้อมูลผู้จอง', icon: <Users className="w-4 h-4" /> },
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isActive = currentStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => goToStep(item.step)}
                className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted 
                      ? 'bg-primary border-primary text-white shadow-sm' 
                      : isActive 
                        ? 'bg-white border-primary text-primary shadow-md shadow-primary/10' 
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : item.icon}
                </div>
                <span 
                  className={`text-[10px] font-bold tracking-tight transition-colors duration-300
                    ${isActive ? 'text-primary' : 'text-slate-400'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-rose-50 border-2 border-rose-100 p-4 rounded-2xl flex items-start gap-3 sticky top-20 z-10 animate-fade-in shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-rose-700 font-bold text-sm leading-relaxed">{error}</p>
            </div>
          )}
          
          {/* STEP 1: วัน-เวลาและห้องประชุม */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <fieldset className="space-y-6 p-6 border border-slate-100 rounded-3xl bg-slate-50/40">
                <legend className="px-4 text-sm font-bold text-primary bg-white border border-slate-100 rounded-xl py-0.5">1. ข้อมูลหลัก (วัน-เวลาและห้อง)</legend>
                
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 mb-2">
                    <input type="checkbox" id="isMultiDay" checked={formData.isMultiDay} onChange={handleCheckboxChange} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                    <label htmlFor="isMultiDay" className="font-bold text-primary text-sm cursor-pointer select-none">ต้องการจองต่อเนื่องหลายวัน</label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ThaiDatePicker 
                      label={formData.isMultiDay ? "วันที่เริ่ม" : "วันที่จัดงาน"} 
                      icon={<Calendar className="w-4 h-4 text-slate-400 shrink-0" />} 
                      value={currentDate} 
                      onChange={setCurrentDate} 
                      required 
                      minDate={new Date().toISOString().split('T')[0]}
                  />
                  {formData.isMultiDay && (
                      <ThaiDatePicker 
                        label="วันที่สิ้นสุด" 
                        icon={<Calendar className="w-4 h-4 text-slate-400 shrink-0" />} 
                        value={formData.endDate} 
                        onChange={(val) => { isDirty.current = true; setFormData(prev => ({...prev, endDate: val})); }} 
                        required 
                        minDate={currentDate}
                      />
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="เริ่มเวลา" icon={<Clock className="w-4 h-4" />} required>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectWrapper>
                        <select
                          value={formData.startTime?.split(':')[0] || ''}
                          onChange={(e) => handleTimePartChange('startTime', 'hour', e.target.value)}
                          className={`${inputClasses} appearance-none`}
                          required
                        >
                          <option value="" disabled>ชั่วโมง</option>
                          {hours.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </SelectWrapper>
                      <SelectWrapper>
                        <select
                          value={formData.startTime?.split(':')[1] || ''}
                          onChange={(e) => handleTimePartChange('startTime', 'minute', e.target.value)}
                          className={`${inputClasses} appearance-none`}
                          required
                        >
                          <option value="" disabled>นาที</option>
                          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </SelectWrapper>
                    </div>
                  </FormField>
                  <FormField label="ถึงเวลา" icon={<Clock className="w-4 h-4" />} required>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectWrapper>
                        <select
                          value={formData.endTime?.split(':')[0] || ''}
                          onChange={(e) => handleTimePartChange('endTime', 'hour', e.target.value)}
                          className={`${inputClasses} appearance-none`}
                          required
                        >
                          <option value="" disabled>ชั่วโมง</option>
                          {hours.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </SelectWrapper>
                      <SelectWrapper>
                        <select
                          value={formData.endTime?.split(':')[1] || ''}
                          onChange={(e) => handleTimePartChange('endTime', 'minute', e.target.value)}
                          className={`${inputClasses} appearance-none`}
                          required
                        >
                          <option value="" disabled>นาที</option>
                          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </SelectWrapper>
                    </div>
                  </FormField>
                </div>

                <hr className="border-slate-100 my-4" />

                <FormField label="เลือกห้องประชุม (ระบบจะแสดงสถานะว่างตามวันเวลาที่คุณระบุ)" icon={<Building2 className="w-4 h-4" />} required>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rooms.map(r => {
                      const meta = ROOM_METADATA[r.name] || { capacity: 0, equipment: [], type: '' };
                      const conflict = getRoomConflictStatus(r.name);
                      const isSelected = selectedRoomIds.includes(r.id);
                      const isClosed = r.status === 'closed';
                      const isConflicted = conflict.status === 'conflict';

                      return (
                        <div 
                          key={r.id} 
                          onClick={() => toggleRoomSelection(r.id, isClosed, isConflicted)}
                          className={`relative flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                            isSelected 
                              ? 'bg-primary-light/50 border-primary shadow-sm shadow-primary/5' 
                              : isClosed 
                                ? 'bg-slate-50 border-slate-200/60 opacity-60 cursor-not-allowed'
                                : isConflicted
                                  ? 'bg-rose-50/20 border-rose-100 hover:border-rose-200'
                                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                disabled={isClosed || isConflicted}
                                onChange={() => {}} // Handle parent click
                                className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="ml-2.5 font-bold text-sm text-primary">{r.name}</span>
                            </div>
                            {isClosed && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Wrench className="w-2.5 h-2.5" /> ปิดชั่วคราว</span>
                            )}
                          </div>

                          <div className="mt-2.5 pl-7 space-y-1">
                            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" /> ความจุ: {meta.capacity} คน ({meta.type})
                            </p>
                            {meta.equipment.length > 0 && (
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                📦 อุปกรณ์: {meta.equipment.join(', ')}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 pl-7">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg inline-block ${
                              isClosed 
                                ? 'text-slate-400 bg-slate-100'
                                : conflict.status === 'available'
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : conflict.status === 'conflict'
                                    ? 'text-rose-700 bg-rose-50 font-semibold'
                                    : 'text-amber-700 bg-amber-50'
                            }`}>
                              {isClosed ? '🚫 ปิดปรับปรุง' : conflict.message}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FormField>
              </fieldset>
            </div>
          )}

          {/* STEP 2: รายละเอียดการประชุม */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <fieldset className="space-y-6 p-6 border border-slate-100 rounded-3xl">
                <legend className="px-4 text-sm font-bold text-primary bg-white border border-slate-100 rounded-xl py-0.5">2. รายละเอียดการประชุม</legend>
                <FormField label="วัตถุประสงค์ / เรื่อง" icon={<Target className="w-4 h-4" />} required>
                  <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุวัตถุประสงค์..." required />
                </FormField>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField label="จำนวนผู้เข้าร่วม" icon={<Users className="w-4 h-4" />} required>
                    <input type="number" name="participants" min="1" value={formData.participants} onChange={handleInputChange} className={inputClasses} required />
                  </FormField>
                  <FormField label="รูปแบบการประชุม" icon={<Monitor className="w-4 h-4" />} required>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { value: 'Onsite', label: 'ออนไซต์', color: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
                        { value: 'Online', label: 'ออนไลน์', color: 'border-blue-200 text-blue-700 bg-blue-50' },
                      ].map((type) => (
                        <label 
                          key={type.value} 
                          className={`flex-1 flex items-center p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${formData.meetingType.includes(type.value) ? `ring-2 ring-offset-2 ring-primary shadow-md ${type.color}` : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={formData.meetingType.includes(type.value)} 
                            onChange={() => handleMeetingTypeToggle(type.value)} 
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="ml-3 text-sm font-black">{type.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400 font-bold">* สามารถเลือกได้ทั้งสองอย่างหากเป็นรูปแบบไฮบริด</p>
                  </FormField>
                </div>

                <FormField label="รูปแบบการจัดห้องประชุม" icon="🪑">
                  <div className="space-y-2">
                    {[
                      {
                        value: 'classroom',
                        label: 'จัดแบบห้องเรียนปกติ',
                        desc: 'ผู้เข้าประชุมทุกคนหันหน้าเข้าหาผู้พูดเพียงคนเดียว',
                      },
                      {
                        value: 'u-shape',
                        label: 'จัดแบบตัว U',
                        desc: 'ประธานอยู่หัวโต๊ะ ผู้เข้าร่วมล้อมรอบเป็นรูปตัว U',
                      },
                      {
                        value: 'other',
                        label: 'อื่นๆ',
                        desc: 'ระบุเพิ่มเติมในช่องด้านล่าง',
                      },
                    ].map((opt) => {
                      const isSelected = formData.roomArrangement === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all select-none
                            ${isSelected ? 'border-primary bg-primary-light shadow-sm' : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
                        >
                          <input
                            type="radio"
                            name="roomArrangement"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => {
                              isDirty.current = true;
                              setFormData(prev => ({
                                ...prev,
                                roomArrangement: opt.value,
                                roomArrangementComment: opt.value !== 'other' ? '' : prev.roomArrangementComment,
                              }));
                            }}
                            className="h-4 w-4 mt-0.5 shrink-0 accent-primary"
                          />
                          <div>
                            <p className="text-sm font-bold text-gray-800">{opt.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {formData.roomArrangement === 'other' && (
                    <textarea
                      rows={2}
                      value={formData.roomArrangementComment}
                      onChange={(e) => {
                        isDirty.current = true;
                        setFormData(prev => ({ ...prev, roomArrangementComment: e.target.value }));
                      }}
                      className={`${inputClasses} mt-3`}
                      placeholder="โปรดระบุรูปแบบการจัดห้องที่ต้องการ..."
                    />
                  )}
                  <p className="mt-2 text-[10px] text-gray-400 font-bold">* ไม่บังคับ — ทิ้งว่างได้หากไม่มีความต้องการพิเศษ</p>
                </FormField>
              </fieldset>
            </div>
          )}

          {/* STEP 3: ข้อมูลผู้จองและไฟล์แนบ */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <fieldset className="space-y-6 p-6 border-2 border-gray-100 rounded-3xl">
                <legend className="px-4 text-sm font-bold text-primary bg-white border border-slate-100 rounded-xl py-0.5">3. ข้อมูลผู้จองและไฟล์แนบ</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField label="หน่วยงาน / งาน" icon={<Building2 className="w-4 h-4" />} required>
                    <input type="text" name="bookerName" value={formData.bookerName} onChange={handleInputChange} className={inputClasses} placeholder="ระบุหน่วยงาน..." required />
                  </FormField>
                  <FormField label="เบอร์โทรศัพท์" icon={<Phone className="w-4 h-4" />}>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} placeholder="081XXXXXXX" />
                  </FormField>
                </div>
                <FormField label="อุปกรณ์เพิ่มเติม" icon={<Package className="w-4 h-4" />}>
                  <textarea name="equipment" value={formData.equipment} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="ระบุอุปกรณ์ที่ต้องการ..." />
                </FormField>
                <FormField label="ลิงก์ไฟล์แนบ" icon={<Paperclip className="w-4 h-4" />}>
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <span className="text-gray-400 text-sm font-bold">https://</span>
                      </div>
                      <input 
                          type="url" 
                          name="attachmentUrl" 
                          value={formData.attachmentUrl} 
                          onChange={handleInputChange} 
                          className={`${inputClasses} pl-16 border border-slate-100 bg-slate-50/30 focus:bg-white`}
                          placeholder="docs.google.com/..."
                      />
                  </div>
                  <p className="mt-2 text-[10px] text-primary font-bold">แนบลิงก์ไฟล์โครงการ หรือเอกสารที่เกี่ยวข้องเพื่อให้เจ้าหน้าที่ตรวจสอบ</p>
                </FormField>
              </fieldset>

              {/* Review Panel */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-4 shadow-inner">
                <h3 className="text-sm font-bold text-primary border-b border-slate-200 pb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> ตรวจสอบรายละเอียดก่อนกดบันทึก
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                  <p>🏢 ห้องที่จอง: <span className="text-primary font-black">{selectedRoomNames.join(', ')}</span></p>
                  <p>📅 วันที่: <span className="text-slate-800 font-bold">{formData.isMultiDay ? `${formatThaiDateShort(currentDate)} - ${formatThaiDateShort(formData.endDate)}` : formatThaiDateShort(currentDate)}</span></p>
                  <p>⏰ เวลา: <span className="text-slate-800 font-bold">{formData.startTime} - {formData.endTime} น.</span></p>
                  <p>🎯 วัตถุประสงค์: <span className="text-slate-800 font-black">{formData.purpose}</span></p>
                  <p>👤 ผู้จัดงาน: <span className="text-slate-800">{formData.bookerName} {formData.phone ? `(โทร: ${formData.phone})` : ''}</span></p>
                  <p>👥 จำนวนผู้เข้าร่วม: <span className="text-slate-800">{formData.participants} คน</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Navigation controls */}
          <div className="flex justify-between items-center pt-8 border-t border-slate-100">
            <button
              type="button"
              onClick={prevStep}
              disabled={loading}
              className="px-6 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              {currentStep === 1 ? 'ยกเลิก' : 'ขั้นตอนก่อนหน้า'}
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-primary/10"
              >
                <span>ขั้นตอนถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <Button 
                type="submit" 
                variant="primary" 
                loading={loading} 
                className="px-10 py-2.5"
              >
                {isEditing ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
