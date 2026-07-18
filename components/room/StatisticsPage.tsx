import React, { useMemo, useState } from 'react';
import { Booking } from '../../types';
import { ROOMS } from '../../constants';
import Button from '../shared/Button';
import * as XLSX from 'xlsx';

interface StatisticsPageProps {
  bookings: Booking[];
  onBack: () => void;
}

const StatCard: React.FC<{icon: string, title: string, value: string | number, description: string, color: string}> = ({icon, title, value, description, color}) => (
    <div className={`p-6 rounded-2xl border bg-white shadow-sm transition-transform hover:-translate-y-1`}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text', 'bg').replace('-600', '-100')}`}>
                <span className={`text-2xl ${color}`}>{icon}</span>
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-500">{title}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">{description}</p>
    </div>
);

const StatisticsPage: React.FC<StatisticsPageProps> = ({ bookings, onBack }) => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    bookings.forEach(b => {
      const year = new Date(b.date).getFullYear().toString();
      yearsSet.add(year);
    });
    yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
        const bDate = new Date(b.date);
        const yearMatch = bDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (bDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    });
  }, [bookings, selectedYear, selectedMonth]);

  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const completed = filteredBookings.filter(b => b.status === 'หมดเวลา' || b.status === 'จองแล้ว').length;
    const cancelled = filteredBookings.filter(b => b.status === 'ยกเลิก').length;
    const usageRate = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;
    
    const bookingsByRoom = ROOMS.map(room => ({
      name: room.name,
      count: filteredBookings.filter(b => b.roomName === room.name && (b.status === 'หมดเวลา' || b.status === 'จองแล้ว')).length,
    })).sort((a,b) => b.count - a.count);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        return {
            month: month,
            count: filteredBookings.filter(b => new Date(b.date).getMonth() === i && (b.status === 'หมดเวลา' || b.status === 'จองแล้ว')).length
        };
    });

    const maxMonthlyCount = Math.max(...monthlyData.map(d => d.count), 1);
    const maxRoomCount = Math.max(...bookingsByRoom.map(r => r.count), 1);
    
    return {
      total,
      completed,
      cancelled,
      usageRate,
      bookingsByRoom,
      monthlyData,
      maxMonthlyCount,
      maxRoomCount
    };
  }, [filteredBookings]);

  const handleExportExcel = () => {
    const dataToExport = filteredBookings.map((b, index) => ({
        'ลำดับ': index + 1,
        'วันที่': new Date(b.date).toLocaleDateString('th-TH'),
        'เวลา': `${b.startTime} - ${b.endTime} น.`,
        'ห้องประชุม': b.roomName,
        'ชื่องาน/วัตถุประสงค์': b.purpose,
        'ผู้จอง': b.bookerName,
        'เบอร์โทรศัพท์': b.phone,
        'จำนวนผู้เข้าร่วม': b.participants,
        // FIX: The meetingType property is an array of strings. Updated logic to check array contents instead of comparing to a string.
        'รูปแบบ': b.meetingType.includes('Onsite') && b.meetingType.includes('Online') ? 'ไฮบริด' : b.meetingType.includes('Online') ? 'ออนไลน์' : 'ออนไซต์',
        'สถานะ': b.status,
        'อุปกรณ์เพิ่มเติม': b.equipment || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายการจองห้องประชุม");
    
    const fileName = `รายงานการจองห้องประชุม_${parseInt(selectedYear) + 543}_${selectedMonth === 'all' ? 'ทั้งปี' : thaiMonths[parseInt(selectedMonth)-1]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">สรุปสถิติและรายงาน</h2>
                <p className="text-sm text-gray-500 font-medium">ภาพรวมการใช้งานห้องประชุมของวิทยาลัย</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
             <div className="flex gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg text-sm font-bold p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="all">ทุกเดือน</option>
                    {thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                </select>
                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg text-sm font-bold p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    {years.map(y => <option key={y} value={y}>พ.ศ. {parseInt(y) + 543}</option>)}
                </select>
             </div>
             <Button onClick={handleExportExcel} variant="stats" className="flex items-center gap-2">
                <span>📥</span>
                <span>ส่งออกข้อมูล (Excel)</span>
             </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard 
                icon="📊"
                title="รายการจองรวม"
                value={stats.total}
                description="รวมทุกสถานะในช่วงเวลาที่เลือก"
                color="text-blue-600"
            />
             <StatCard 
                icon="✅"
                title="ใช้งานสำเร็จ"
                value={stats.completed}
                description="จองแล้ว และ หมดเวลาแล้ว"
                color="text-green-600"
            />
             <StatCard 
                icon="❌"
                title="ยกเลิกการจอง"
                value={stats.cancelled}
                description="รายการที่ไม่เกิดขึ้นจริง"
                color="text-red-600"
            />
            <StatCard 
                icon="📈"
                title="อัตราการใช้งาน"
                value={`${stats.usageRate}%`}
                description="สัดส่วนการจองที่ใช้งานจริง"
                color="text-purple-600"
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>📅</span> สถิติการใช้งานรายเดือน (ปี พ.ศ. {parseInt(selectedYear) + 543})
                </h3>
                <div className="flex items-end justify-between h-48 gap-1 pt-4">
                    {stats.monthlyData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                            <div 
                                className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 relative ${selectedMonth === (i+1).toString() ? 'bg-blue-600' : 'bg-blue-200 group-hover:bg-blue-300'}`}
                                style={{ height: `${(d.count / stats.maxMonthlyCount) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                            >
                                {d.count > 0 && (
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {d.count}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] mt-2 font-bold ${selectedMonth === (i+1).toString() ? 'text-blue-700' : 'text-gray-400'}`}>
                                {thaiMonths[i]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>🏢</span> อันดับห้องที่ถูกจองมากที่สุด
                </h3>
                <div className="space-y-4">
                    {stats.bookingsByRoom.map((room, index) => (
                        <div key={room.name} className="flex items-center gap-4">
                            <div className={`font-bold w-8 text-center ${index < 3 ? 'text-primary' : 'text-gray-300'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-bold text-gray-700 text-xs truncate max-w-[200px]">{room.name}</p>
                                    <p className="font-black text-primary text-xs">{room.count} ครั้ง</p>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-primary h-full rounded-full transition-all duration-700 ease-out" 
                                        style={{ width: `${(room.count / stats.maxRoomCount) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {stats.total === 0 && (
                         <div className="text-center py-10 text-gray-400 italic text-sm">
                            ไม่มีข้อมูลในเดือนที่เลือก
                         </div>
                    )}
                </div>
            </div>
        </div>

        <div className="mt-10 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
             <p className="text-xs text-blue-800 font-bold">
                ⚠️ ข้อมูลเหล่านี้สรุปผลตามวันที่จัดกิจกรรม ไม่ใช่ตามวันที่ทำรายการจองในระบบ
             </p>
        </div>

      </div>
    </div>
  );
};

export default StatisticsPage;