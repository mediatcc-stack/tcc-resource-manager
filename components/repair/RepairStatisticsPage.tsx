
import React, { useMemo, useState } from 'react';
import { RepairRequest, RepairStatus } from '../../types';
import Button from '../shared/Button';
import * as XLSX from 'xlsx';

interface RepairStatisticsPageProps {
    repairs: RepairRequest[];
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

const RepairStatisticsPage: React.FC<RepairStatisticsPageProps> = ({ repairs, onBack }) => {
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        repairs.forEach(r => yearsSet.add(new Date(r.createdAt).getFullYear().toString()));
        yearsSet.add(new Date().getFullYear().toString());
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [repairs]);

    const filteredRepairs = useMemo(() => {
        return repairs.filter(r => {
            const rDate = new Date(r.createdAt);
            const yearMatch = rDate.getFullYear().toString() === selectedYear;
            const monthMatch = selectedMonth === 'all' || (rDate.getMonth() + 1).toString() === selectedMonth;
            return yearMatch && monthMatch;
        });
    }, [repairs, selectedYear, selectedMonth]);

    const stats = useMemo(() => {
        const total = filteredRepairs.length;
        const pending = filteredRepairs.filter(r => r.status === RepairStatus.Pending).length;
        const inProgress = filteredRepairs.filter(r => r.status === RepairStatus.InProgress).length;
        const completed = filteredRepairs.filter(r => r.status === RepairStatus.Completed).length;

        const problemTypeCounts: Record<string, number> = {};
        filteredRepairs.forEach(r => {
            problemTypeCounts[r.problemType] = (problemTypeCounts[r.problemType] || 0) + 1;
        });
        const topProblemTypes = Object.entries(problemTypeCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const deptCounts: Record<string, number> = {};
        filteredRepairs.forEach(r => {
            const dept = r.department || 'ไม่ระบุหน่วยงาน';
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
        const topDepartments = Object.entries(deptCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            count: filteredRepairs.filter(r => new Date(r.createdAt).getMonth() === i).length
        }));

        const maxMonthly = Math.max(...monthlyData.map(d => d.count), 1);
        const maxProblemType = Math.max(...topProblemTypes.map(d => d.count), 1);

        return { total, pending, inProgress, completed, topProblemTypes, topDepartments, monthlyData, maxMonthly, maxProblemType };
    }, [filteredRepairs]);

    const handleExportExcel = () => {
        const dataToExport = filteredRepairs.map((r, index) => ({
            'ลำดับ': index + 1,
            'วันที่แจ้ง': new Date(r.createdAt).toLocaleDateString('th-TH'),
            'ผู้แจ้ง': r.requesterName,
            'แผนก/ฝ่าย': r.department,
            'ห้อง/สถานที่': r.roomName,
            'ประเภทปัญหา': r.problemType,
            'ความเร่งด่วน': r.priority,
            'รายละเอียด': r.description,
            'สถานะ': r.status,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Repair_Requests");

        const fileName = `รายงานแจ้งซ่อมอุปกรณ์_${selectedYear}_${selectedMonth}.xlsx`;
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
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">สถิติการแจ้งซ่อมอุปกรณ์</h2>
                            <p className="text-sm text-gray-400 font-medium">สรุปข้อมูลการแจ้งซ่อมอุปกรณ์ไอที</p>
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
                    <StatCard icon="🛠️" title="แจ้งซ่อมทั้งหมด" value={stats.total} description="จำนวนใบแจ้งซ่อมในช่วงเวลา" color="text-indigo-600" />
                    <StatCard icon="⏳" title="รอดำเนินการ" value={stats.pending} description="ยังไม่มีการรับเรื่อง" color="text-amber-600" />
                    <StatCard icon="⚙️" title="กำลังซ่อม" value={stats.inProgress} description="อยู่ระหว่างดำเนินการ" color="text-sky-600" />
                    <StatCard icon="✅" title="ซ่อมเสร็จสิ้น" value={stats.completed} description="ดำเนินการเรียบร้อยแล้ว" color="text-emerald-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
                            <span className="text-xl">📈</span> ปริมาณแจ้งซ่อมรายเดือน
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
                                <span className="text-lg">🔧</span> ประเภทปัญหาที่พบบ่อย
                            </h3>
                            <div className="space-y-4">
                                {stats.topProblemTypes.slice(0, 5).map((item, index) => (
                                    <div key={index} className="space-y-1.5">
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="text-gray-600 truncate mr-2">{item.name}</span>
                                            <span className="text-indigo-600">{item.count} ครั้ง</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div
                                                className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                                                style={{ width: `${(item.count / stats.maxProblemType) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {stats.topProblemTypes.length === 0 && <p className="text-center text-gray-400 text-sm italic">ไม่มีข้อมูล</p>}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                                <span className="text-lg">🏢</span> หน่วยงานที่แจ้งซ่อมบ่อย
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {stats.topDepartments.slice(0, 10).map((d, i) => (
                                    <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 shadow-sm flex items-center gap-2">
                                        <span>{d.name}</span>
                                        <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px]">{d.count}</span>
                                    </div>
                                ))}
                                {stats.topDepartments.length === 0 && <p className="text-center text-gray-400 text-sm italic w-full">ไม่มีข้อมูล</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RepairStatisticsPage;
