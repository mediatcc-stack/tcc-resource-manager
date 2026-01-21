import React, { useMemo } from 'react';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label: string;
  icon: string;
  required?: boolean;
  minDate?: string;
}

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({ value, onChange, label, icon, required }) => {
  // แยกค่าจาก YYYY-MM-DD
  const [year, month, day] = useMemo(() => {
    if (!value) return ['', '', ''];
    const parts = value.split('-');
    return [parts[0], parseInt(parts[1]).toString(), parseInt(parts[2]).toString()];
  }, [value]);

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const range = [];
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

    if (d && m && y) {
      const formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      onChange(formattedDate);
    }
  };

  const selectClasses = "block w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none";

  return (
    <div className="group">
      <label className="flex items-center text-sm font-bold text-gray-600 mb-2 group-focus-within:text-blue-600 transition-colors">
        <span className="mr-2 text-xl">{icon}</span>
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
            {days.map(d => <option key={d} value={d}>{d}</option>)}
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
            {thaiMonths.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
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
            {years.map(y => <option key={y} value={y}>{parseInt(y) + 543}</option>)}
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