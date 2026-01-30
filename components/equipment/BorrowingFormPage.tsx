
import React, { useState } from 'react';
import { BorrowingRequest } from '../../types';
import Button from '../shared/Button';
import { EQUIPMENT_CATEGORIES } from '../../constants';
import ThaiDatePicker from '../shared/ThaiDatePicker';

interface BorrowingFormPageProps {
    onSubmit: (newRequest: Omit<BorrowingRequest, 'id' | 'createdAt' | 'status'>) => void;
    onCancel: () => void;
}

const FormField: React.FC<{label: string, icon: string, required?: boolean, children: React.ReactNode}> = ({ label, icon, required, children }) => (
    <div>
        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
            <span className="mr-3 text-xl text-gray-500">{icon}</span>
            {label} {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {children}
    </div>
);

const BorrowingFormPage: React.FC<BorrowingFormPageProps> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        borrowerName: '',
        phone: '',
        department: '',
        purpose: '',
        borrowDate: new Date().toISOString().split('T')[0],
        returnDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        equipmentList: '',
        notes: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const { borrowerName, purpose, borrowDate, returnDate, equipmentList } = formData;
        if (!borrowerName || !purpose || !borrowDate || !returnDate || !equipmentList) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }
        
        const bkkTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
        const today = bkkTime.toISOString().split('T')[0];
        if (borrowDate < today) {
            setError('ไม่สามารถเลือกวันที่ย้อนหลังได้');
            return;
        }

        if (new Date(returnDate) < new Date(borrowDate)) {
            setError('วันที่คืนต้องไม่ก่อนวันที่ยืม');
            return;
        }

        setLoading(true);
        setTimeout(() => {
            onSubmit(formData);
            setLoading(false);
        }, 500);
    };
    
    const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="bg-white p-6 md:p-10 rounded-2xl shadow-xl">
                 <div className="mb-8 pb-5 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-[#0D448D] flex items-center gap-3">
                        <span className="text-3xl">📋</span>
                        แบบฟอร์มขอยืมอุปกรณ์
                    </h2>
                </div>

                <div className="mb-8 p-5 border-2 border-blue-200 rounded-xl bg-blue-50/50">
                    <h3 className="flex items-center gap-2 font-bold text-lg text-blue-800 mb-4">
                        <span className="text-xl">💡</span> ประเภทอุปกรณ์ที่ให้บริการ
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {EQUIPMENT_CATEGORIES.map(cat => (
                        <div key={cat.title} className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                            <p className="font-semibold text-gray-800 text-sm">{cat.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{cat.items}</p>
                        </div>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg font-semibold border border-red-200">⚠️ {error}</p>}
                    
                    <fieldset className="space-y-6 p-6 border-2 border-gray-100 rounded-3xl bg-gray-50/50">
                        <legend className="px-4 text-lg font-black text-[#0D448D]">1. ข้อมูลผู้ยืมและวัตถุประสงค์</legend>
                        <FormField icon="🏢" label="หน่วยงาน / งาน" required>
                            <input type="text" name="borrowerName" placeholder="ระบุหน่วยงาน..." value={formData.borrowerName} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                        <FormField icon="📞" label="เบอร์โทรศัพท์">
                            <input type="tel" name="phone" placeholder="081XXXXXXX" value={formData.phone} onChange={handleInputChange} className={inputClasses} />
                        </FormField>
                        <FormField icon="🎯" label="วัตถุประสงค์ / เรื่อง" required>
                            <textarea name="purpose" value={formData.purpose} placeholder="ระบุวัตถุประสงค์..." onChange={handleInputChange} rows={3} className={inputClasses} required />
                        </FormField>
                    </fieldset>
                    
                    <fieldset className="space-y-6 p-6 border-2 border-gray-100 rounded-3xl">
                        <legend className="px-4 text-lg font-black text-[#0D448D]">2. ระยะเวลาและอุปกรณ์</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ThaiDatePicker 
                                label="วันที่เริ่มยืม" 
                                icon="📅" 
                                value={formData.borrowDate} 
                                onChange={(val) => handleDateChange('borrowDate', val)} 
                                required 
                            />
                            <ThaiDatePicker 
                                label="วันที่คืน" 
                                icon="📅" 
                                value={formData.returnDate} 
                                onChange={(val) => handleDateChange('returnDate', val)} 
                                required 
                            />
                        </div>
                        <FormField icon="📦" label="รายการอุปกรณ์ที่ต้องการ" required>
                            <textarea 
                                name="equipmentList" 
                                value={formData.equipmentList} 
                                onChange={handleInputChange} 
                                rows={4} 
                                className={inputClasses} 
                                placeholder="ระบุรายการอุปกรณ์และจำนวน..." 
                                required 
                            />
                        </FormField>
                        <FormField icon="📝" label="หมายเหตุเพิ่มเติม">
                            <textarea name="notes" placeholder="ระบุหมายเหตุ (ถ้ามี)" value={formData.notes} onChange={handleInputChange} rows={2} className={inputClasses} />
                        </FormField>
                    </fieldset>
                    
                    <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
                        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ยกเลิก</Button>
                        <Button type="submit" variant="primary" loading={loading}>ยืนยันการขอยืม</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BorrowingFormPage;
