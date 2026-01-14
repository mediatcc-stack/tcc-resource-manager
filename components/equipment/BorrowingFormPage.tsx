
import React, { useState } from 'react';
import { BorrowingRequest } from '../../types';
import Button from '../shared/Button';
import { EQUIPMENT_CATEGORIES, CONTACTS } from '../../constants';

interface BorrowingFormPageProps {
    onSubmit: (newRequest: Omit<BorrowingRequest, 'id' | 'createdAt' | 'status'>) => void;
    onCancel: () => void;
}

const BorrowingFormPage: React.FC<BorrowingFormPageProps> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        borrowerName: '',
        phone: '',
        department: '',
        purpose: '',
        borrowDate: new Date().toISOString().split('T')[0],
        returnDate: new Date().toISOString().split('T')[0],
        equipmentList: '',
        notes: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const { borrowerName, phone, department, purpose, borrowDate, returnDate, equipmentList } = formData;
        if (!borrowerName || !phone || !department || !purpose || !borrowDate || !returnDate || !equipmentList) {
            setError('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
            return;
        }

        if (new Date(returnDate) < new Date(borrowDate)) {
            setError('วันที่คืนต้องไม่ก่อนวันที่ยืม');
            return;
        }

        setLoading(true);
        // Simulate API call delay
        setTimeout(() => {
            onSubmit(formData);
            setLoading(false);
        }, 500);
    };
    
    const inputClasses = "block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 transition-colors duration-200 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    
    const FormField: React.FC<{label: string, required?: boolean, children: React.ReactNode}> = ({ label, required, children }) => (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                {label} {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {children}
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl shadow-xl">
                 <div className="mb-6 pb-5 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-[#0D448D]">แบบฟอร์มขอยืมอุปกรณ์</h2>
                    <p className="text-gray-500 mt-1">กรุณากรอกข้อมูลให้ครบถ้วนเพื่อส่งคำขอ</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg font-semibold border border-red-200">{error}</p>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField label="ชื่อ-นามสกุลผู้ยืม" required>
                            <input type="text" name="borrowerName" value={formData.borrowerName} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                        <FormField label="เบอร์โทรศัพท์" required>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                    </div>
                     <FormField label="ฝ่าย/แผนก" required>
                        <input type="text" name="department" value={formData.department} onChange={handleInputChange} className={inputClasses} required />
                    </FormField>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField label="วันที่ยืม" required>
                            <input type="date" name="borrowDate" value={formData.borrowDate} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                        <FormField label="วันที่คืน" required>
                            <input type="date" name="returnDate" value={formData.returnDate} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                    </div>
                    <FormField label="วัตถุประสงค์การยืม" required>
                        <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={2} className={inputClasses} required />
                    </FormField>
                    <FormField label="รายการอุปกรณ์ที่ขอยืม (ระบุรายละเอียด เช่น ยี่ห้อ, รุ่น, จำนวน)" required>
                        <textarea name="equipmentList" value={formData.equipmentList} onChange={handleInputChange} rows={4} className={inputClasses} placeholder="เช่น กล้อง Sony A7III 1 ตัว, ขาตั้งกล้อง 1 อัน, ไมค์ลอย 2 ตัว" required />
                    </FormField>
                     <FormField label="หมายเหตุ (ถ้ามี)">
                        <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} className={inputClasses} />
                    </FormField>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ยกเลิก</Button>
                        <Button type="submit" variant="primary" loading={loading}>ส่งคำขอ</Button>
                    </div>
                </form>
            </div>
            
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl">
                    <h3 className="text-lg font-bold text-[#0D448D] mb-4">หมวดหมู่อุปกรณ์</h3>
                    <ul className="space-y-3 text-sm">
                        {EQUIPMENT_CATEGORIES.map(cat => (
                            <li key={cat.title}>
                                <p className="font-semibold text-gray-700">{cat.title}</p>
                                <p className="text-gray-500 pl-2">{cat.items}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="bg-white p-6 rounded-2xl shadow-xl">
                    <h3 className="text-lg font-bold text-[#0D448D] mb-4">ติดต่อเจ้าหน้าที่</h3>
                    <ul className="space-y-2 text-sm">
                        {CONTACTS.map(contact => (
                            <li key={contact.name}>
                                <p className="font-medium text-gray-700">{contact.name}</p>
                                <p className="text-gray-500 text-xs pl-2">{contact.position}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default BorrowingFormPage;
