import React, { useMemo, useState } from 'react';
import { BorrowingRequest, BorrowStatus } from '../../types';
import Button from '../shared/Button';
import * as XLSX from 'xlsx';

interface BorrowingStatisticsPageProps {
    borrowings: BorrowingRequest[];
    onBack: () => void;
}

const StatCard: React.FC<{icon: string, title: string, value: string | number, description: string, color: string}> = ({icon, title, value, description, color}) => (
    <div className={`p-5 rounded-2xl border bg-white shadow-sm`}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text', 'bg').replace('-600', '-100')}`}>
                <span className={`text-2xl ${color}`}>{icon}</span>
            </div>
            <div className="overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
                <p className={`text-2xl font-bold truncate ${color}`}>{value}</p>
            </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-3 font-medium">{description}</p>
    </div>
);

const BorrowingStatisticsPage: React.FC<BorrowingStatisticsPageProps> = ({ borrowings, onBack }) => {
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        borrowings.forEach(b => {
            const year = new Date(b.borrowDate).getFullYear().toString();
            yearsSet.add(year);
        });
        yearsSet.add(new Date().getFullYear().toString());
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [borrowings]);

    const filteredBorrowings = useMemo(() => {
        return borrowings.filter(b => {
            const bDate = new Date(b.borrowDate);
            const yearMatch = bDate.getFullYear().toString() === selectedYear;
            const monthMatch = selectedMonth === 'all' || (bDate.getMonth() + 1).toString() === selectedMonth;
            return yearMatch && monthMatch;
        });
    }, [borrowings, selectedYear, selectedMonth]);

    const stats = useMemo(() => {
        const total = filteredBorrowings.length;
        const returned = filteredBorrowings.filter(b => b.status === BorrowStatus.Returned).length;
        const borrowing = filteredBorrowings.filter(b => b.status === BorrowStatus.Borrowing || b.status === BorrowStatus.Overdue).length;
        const cancelled = filteredBorrowings.filter(b => b.status === BorrowStatus.Cancelled).length;

        const deptCounts: Record<string, number> = {};
        filteredBorrowings.forEach(b => {
            const dept = b.department || 'ไม่ระบุหน่วยงาน';
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
        const topDepartments = Object.entries(deptCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const borrowerCounts: Record<string, number> = {};
        filteredBorrowings.forEach(b => {
            borrowerCounts[b.borrowerName] = (borrowerCounts[b.borrowerName] || 0) + 1;
        });
        const topBorrowers = Object.entries(borrowerCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            count: filteredBorrowings.filter(b => new Date(b.borrowDate).getMonth() === i).length
        }));

        const maxMonthly = Math.max(...monthlyData.map(d => d.count), 1);
        const maxDept = Math.max(...topDepartments.map(d => d.count), 1);

        return { total, returned, borrowing, cancelled, topDepartments, topBorrowers, monthlyData, maxMonthly, maxDept };
    }, [filteredBorrowings]);

    const handleExportExcel = () => {
        const dataToExport = filteredBorrowings.map((b, index) => ({
            'ลำดับ': index + 1,
            'วันที่ยืม': new Date(b.borrowDate).toLocaleDateString('th-TH'),
            'กำหนดคืน': new Date(b.returnDate).toLocaleDateString('th-TH'),
            'ผู้ขอยืม': b.borrowerName,
            'เบอร์โทรศัพท์': b.phone,
            'หน่วยงาน': b.department || '-',
            'วัตถุประสงค์': b.purpose,
            'รายการอุปกรณ์': b.equipmentList,
            'สถานะ': b.status,
            'หมายเหตุ': b.notes || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Equipment_Borrowings");
        
        const fileName = `รายงานการยืมอุปกรณ์_${selectedYear}_${selectedMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-10 border border-gray-100">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-10 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-90">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">สถิติการยืมอุปกรณ์</h2>
                            <p className="text-sm text-gray-400 font-medium">Media & PR Department Statistics</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                            <select 
                                value={selectedMonth} 
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-white border-none rounded-xl text-xs font-black p-2.5 focus:ring-2 focus:ring-blue-500 shadow-sm"
                            >
                                <option value="all">ทุกเดือน</option>
                                {thaiMonths.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                            </select>
                            <select 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(e.target.value)}
                                className="bg-white border-none rounded-xl text-xs font-black p-2.5 focus:ring-2 focus:ring-blue-500 shadow-sm"
                            >
                                {years.map(y => <option key={y} value={y}>พ.ศ. {parseInt(y) + 543}</option>)}
                            </select>
                        </div>
                        <Button onClick={handleExportExcel} variant="stats" className="flex items-center gap-2">
                            <span>📥</span>
                            <span>Excel</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard icon="📥" title="รายการยืมทั้งหมด" value={stats.total} description="จำนวนใบคำขอในช่วงเวลา" color="text-indigo-600" />
                    <StatCard icon="📦" title="กำลังยืม / เกินกำหนด" value={stats.borrowing} description="อุปกรณ์ที่ยังไม่ถูกส่งคืน" color="text-orange-600" />
                    <StatCard icon="✅" title="คืนสำเร็จ" value={stats.returned} description="ทำรายการเรียบร้อยแล้ว" color="text-emerald-600" />
                    <StatCard icon="❌" title="ยกเลิก" value={stats.cancelled} description="คำขอที่ถูกยกเลิก" color="text-red-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
                            <span className="text-xl">📈</span> ปริมาณการยืมรายเดือน
                        </h3>
                        <div className="flex items-end justify-between h-40 gap-1.5 px-2">
                            {stats.monthlyData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center group">
                                    <div 
                                        className={`w-full max-w-[14px] rounded-t-full transition-all duration-500 relative ${selectedMonth === (i+1).toString() ? 'bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-400'}`}
                                        style={{ height: `${(d.count / stats.maxMonthly) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                                    ></div>
                                    <span className={`text-[9px] mt-3 font-black uppercase ${selectedMonth === (i+1).toString() ? 'text-indigo-700' : 'text-slate-400'}`}>
                                        {thaiMonths[i]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                                <span className="text-lg">🏢</span> หน่วยงานที่ใช้งานบ่อย
                            </h3>
                            <div className="space-y-4">
                                {stats.topDepartments.slice(0, 5).map((dept, index) => (
                                    <div key={index} className="space-y-1.5">
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="text-gray-600 truncate mr-2">{dept.name}</span>
                                            <span className="text-indigo-600">{dept.count} ครั้ง</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                                                style={{ width: `${(dept.count / stats.maxDept) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {stats.topDepartments.length === 0 && <p className="text-center text-gray-400 text-sm italic">ไม่มีข้อมูล</p>}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                                <span className="text-lg">👤</span> รายชื่อผู้ยืมดีเด่น
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {stats.topBorrowers.slice(0, 10).map((b, i) => (
                                    <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 shadow-sm flex items-center gap-2">
                                        <span>{b.name}</span>
                                        <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px]">{b.count}</span>
                                    </div>
                                ))}
                                {stats.topBorrowers.length === 0 && <p className="text-center text-gray-400 text-sm italic w-full">ไม่มีข้อมูล</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BorrowingStatisticsPage;