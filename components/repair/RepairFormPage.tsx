

import React, { useState } from 'react';
import { RepairRequest, RepairPriority } from '../../types';
import Button from '../shared/Button';
import { PROBLEM_TYPES, PRIORITY_LEVELS } from '../../constants';

interface RepairFormPageProps {
    onSubmit: (newRequest: Omit<RepairRequest, 'id' | 'createdAt' | 'status'>) => void;
    onCancel: () => void;
    editingRequest?: RepairRequest | null;
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

const RepairFormPage: React.FC<RepairFormPageProps> = ({ onSubmit, onCancel, editingRequest }) => {
    const isEditing = !!editingRequest;
    const [formData, setFormData] = useState({
        requesterName: editingRequest?.requesterName ?? '',
        department: editingRequest?.department ?? '',
        roomName: editingRequest?.roomName ?? '',
        problemType: editingRequest?.problemType ?? PROBLEM_TYPES[0],
        priority: (editingRequest?.priority ?? PRIORITY_LEVELS[0]) as RepairPriority,
        description: editingRequest?.description ?? '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const { requesterName, department, roomName, description } = formData;
        if (!requesterName || !department || !roomName || !description) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
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
                    <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
                        <span className="text-3xl">🛠️</span>
                        {isEditing ? 'แก้ไขคำขอแจ้งซ่อม' : 'แบบฟอร์มแจ้งซ่อมอุปกรณ์ไอที'}
                    </h2>
                    {!isEditing && (
                        <p className="text-xs text-slate-400 mt-2">
                            💡 หลังส่งแล้ว ถ้ากรอกผิดสามารถกลับมาแก้ไขได้เอง (จากอุปกรณ์เครื่องเดิม) ตราบใดที่เจ้าหน้าที่ยังไม่เริ่มดำเนินการ
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg font-semibold border border-red-200">⚠️ {error}</p>}

                    <fieldset className="space-y-6 p-6 border-2 border-gray-100 rounded-3xl bg-gray-50/50">
                        <legend className="px-4 text-lg font-black text-primary">1. ข้อมูลผู้แจ้งซ่อม</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField icon="👤" label="ชื่อ-นามสกุลผู้แจ้ง" required>
                                <input type="text" name="requesterName" placeholder="ระบุชื่อผู้แจ้ง..." value={formData.requesterName} onChange={handleInputChange} className={inputClasses} required />
                            </FormField>
                            <FormField icon="🏢" label="แผนก / ฝ่าย" required>
                                <input type="text" name="department" placeholder="เช่น งานทะเบียน, งานวิชาการ" value={formData.department} onChange={handleInputChange} className={inputClasses} required />
                            </FormField>
                        </div>
                        <FormField icon="📍" label="ห้อง / สถานที่" required>
                            <input type="text" name="roomName" placeholder="เช่น ห้องปฏิบัติการคอมพิวเตอร์ 1, ตึก 4 ชั้น 2" value={formData.roomName} onChange={handleInputChange} className={inputClasses} required />
                        </FormField>
                    </fieldset>

                    <fieldset className="space-y-6 p-6 border-2 border-gray-100 rounded-3xl">
                        <legend className="px-4 text-lg font-black text-primary">2. รายละเอียดปัญหา</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField icon="🔧" label="ปัญหาที่พบเป็นเรื่องอะไร" required>
                                <select name="problemType" value={formData.problemType} onChange={handleInputChange} className={inputClasses} required>
                                    {PROBLEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </FormField>
                            <FormField icon="⏱️" label="ความเร่งด่วน" required>
                                <select name="priority" value={formData.priority} onChange={handleInputChange} className={inputClasses} required>
                                    {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p === 'ด่วนที่สุด' ? `${p} 🔥` : p}</option>)}
                                </select>
                            </FormField>
                        </div>
                        <FormField icon="📝" label="รายละเอียดปัญหาที่พบ" required>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={4}
                                className={inputClasses}
                                placeholder="ระบุรายละเอียด เช่น เปิดเครื่องไม่ติด, โปรแกรมค้าง..."
                                required
                            />
                        </FormField>
                    </fieldset>

                    <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
                        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>ยกเลิก</Button>
                        <Button type="submit" variant="primary" loading={loading}>{isEditing ? 'บันทึกการแก้ไข' : 'ส่งแจ้งซ่อม'}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RepairFormPage;
