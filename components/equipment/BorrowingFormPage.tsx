
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const { borrowerName, phone, department, purpose, borrowDate, returnDate, equipmentList } = formData;
        if (!borrowerName || !phone || !department || !purpose || !borrowDate || !returnDate || !equipmentList) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        if (new Date(returnDate) < new Date(borrowDate)) {
            setError('วันที่คืนต้องไม่ก่อนวันที่ยืม');
            return;
        }

        onSubmit(formData);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">แบบฟอร์มขอยืมอุปกรณ์</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อผู้ยืม</label>
                            <input type="text" name="borrowerName" value={formData.borrowerName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ฝ่าย/แผนก</label>
                        <input type="text" name="department" value={formData.department} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">วันที่ยืม</label>
                            <input type="date" name="borrowDate" value={formData.borrowDate} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">วันที่คืน</label>
                            <input type="date" name="returnDate" value={formData.returnDate} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">วัตถุประสงค์การยืม</label>
                        <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">รายการอุปกรณ์ที่ขอยืม (ระบุรายละเอียด เช่น ยี่ห้อ, รุ่น, จำนวน)</label>
                        <textarea name="equipmentList" value={formData.equipmentList} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="เช่น กล้อง Sony A7III 1 ตัว, ขาตั้งกล้อง 1 อัน, ไมค์ลอย 2 ตัว" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">หมายเหตุ (ถ้ามี)</label>
                        <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button>
                        <Button type="submit" variant="primary">ส่งคำขอ</Button>
                    </div>
                </form>
            </div>
            
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">หมวดหมู่อุปกรณ์</h3>
                    <ul className="space-y-2 text-sm">
                        {EQUIPMENT_CATEGORIES.map(cat => (
                            <li key={cat.title}>
                                <p className="font-semibold text-gray-700">{cat.title}</p>
                                <p className="text-gray-500 pl-2">{cat.items}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">ติดต่อเจ้าหน้าที่</h3>
                    <ul className="space-y-1 text-sm">
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
