import React, { useMemo } from 'react';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  minDate?: string;
}

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({ value, onChange, label, icon, required, minDate }) => {
  // แยกค่าจาก YYYY-MM-DD
  const [year, month, day] = useMemo(() => {
    if (!value) return ['', '', ''];
    const parts = value.split('-');
    return [parts[0], parseInt(parts[1]).toString(), parseInt(parts[2]).toString()];
  }, [value]);

  // คำนวณขีดจำกัดของวันที่ผ่านไปแล้ว
  const limitDate = useMemo(() => {
    const target = minDate || new Date().toISOString().split('T')[0];
    const parts = target.split('-');
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parseInt(parts[2]),
    };
  }, [minDate]);

  // คำนวณจำนวนวันในเดือนนั้นๆ แบบ Dynamic
  const maxDays = useMemo(() => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [year, month]);

  const days = Array.from({ length: maxDays }, (_, i) => (i + 1).toString());
  
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const range = [];
    // แสดงปีปัจจุบันย้อนหลัง 1 ปี ไปจนถึง 5 ปีข้างหน้า
    for (let i = -1; i <= 5; i++) {
      range.push((currentYear + i).toString());
    }
    return range;
  }, []);

  const handleChange = (type: 'd' | 'm' | 'y', newVal: string) => {
    let d = day;
    let m = month;
    let y = year;

    if (type === 'd') d = newVal;
    if (type === 'm') m = newVal;
    if (type === 'y') y = newVal;

    // ถ้าเปลี่ยนเดือนหรือปีแล้วทำให้วันสูงสุดลดลง ให้ลดวันปัจจุบันลงมาที่ค่าสูงสุดของเดือนใหม่
    if (m && y) {
      const max = new Date(parseInt(y), parseInt(m), 0).getDate();
      if (d && parseInt(d) > max) {
        d = max.toString();
      }
    }

    if (d && m && y) {
      const formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      onChange(formattedDate);
    }
  };

  const selectClasses = "block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none";

  return (
    <div className="group">
      <label className="flex items-center text-sm font-bold text-gray-600 mb-2 group-focus-within:text-blue-600 transition-colors">
        <span className="mr-2 text-slate-400 flex items-center justify-center shrink-0">{icon}</span>
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="grid grid-cols-3 gap-2">
        {/* วัน */}
        <div className="relative">
          <select 
            value={day} 
            onChange={(e) => handleChange('d', e.target.value)}
            className={selectClasses}
            required={required}
          >
            <option value="">วัน</option>
            {days.map(d => {
              // disable วันที่อยู่ในอดีต
              const isDayDisabled = (year && month)
                ? (parseInt(year) === limitDate.year && parseInt(month) === limitDate.month && parseInt(d) < limitDate.day)
                : false;
              return (
                <option key={d} value={d} disabled={isDayDisabled}>
                  {d}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        {/* เดือน */}
        <div className="relative">
          <select 
            value={month} 
            onChange={(e) => handleChange('m', e.target.value)}
            className={selectClasses}
            required={required}
          >
            <option value="">เดือน</option>
            {thaiMonths.map((m, i) => {
              // disable เดือนที่อยู่ในอดีต
              const isMonthDisabled = year
                ? (parseInt(year) === limitDate.year && (i + 1) < limitDate.month)
                : false;
              return (
                <option key={i+1} value={i+1} disabled={isMonthDisabled}>
                  {m}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        {/* ปี พ.ศ. */}
        <div className="relative">
          <select 
            value={year} 
            onChange={(e) => handleChange('y', e.target.value)}
            className={selectClasses}
            required={required}
          >
            <option value="">ปี พ.ศ.</option>
            {years.map(y => {
              // disable ปีที่อยู่ในอดีต
              const isYearDisabled = parseInt(y) < limitDate.year;
              return (
                <option key={y} value={y} disabled={isYearDisabled}>
                  {parseInt(y) + 543}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThaiDatePicker;