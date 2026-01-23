import React, { useState, useEffect } from 'react';
import { fetchGroups, saveGroups } from '../../services/apiService';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import Modal from '../shared/Modal';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose, showToast }) => {
  const [groupIdsText, setGroupIdsText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadGroups = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const groups = await fetchGroups();
          setGroupIdsText(groups.join('\n'));
        } catch (err: any) {
          setError(err.message || 'ไม่สามารถโหลดข้อมูล Group ID ได้');
          showToast('โหลดข้อมูล Group ID ไม่สำเร็จ', 'error');
        } finally {
          setIsLoading(false);
        }
      };
      loadGroups();
    }
  }, [isOpen, showToast]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const groups = groupIdsText.split('\n').map(id => id.trim()).filter(id => id);
      await saveGroups(groups);
      showToast('บันทึก Group ID สำเร็จ', 'success');
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || 'เกิดข้อผิดพลาดในการบันทึก';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="ตั้งค่าการแจ้งเตือน LINE" onClose={onClose}>
      <div className="space-y-6 text-sm">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-bold text-blue-800 text-base mb-2">วิธีหา Group ID</h4>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li><strong>เชิญบอท</strong> เข้าไปใน LINE Group ที่คุณต้องการ</li>
            <li>พิมพ์ <code className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded">/getid</code> แล้วกดส่ง</li>
            <li>บอทจะตอบกลับพร้อมกับ Group ID ของกลุ่มนั้น</li>
            <li>คัดลอก ID มาวางในกล่องข้อความด้านล่างนี้ (หนึ่ง ID ต่อหนึ่งบรรทัด)</li>
          </ol>
        </div>

        <div>
          <label htmlFor="groupIds" className="block text-sm font-bold text-gray-700 mb-2">
            รายชื่อ Group ID ที่รับการแจ้งเตือน
          </label>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center bg-slate-100 rounded-lg">
              <LoadingSpinner />
              <span className="ml-2 text-slate-500">กำลังโหลด...</span>
            </div>
          ) : (
            <textarea
              id="groupIds"
              value={groupIdsText}
              onChange={(e) => setGroupIdsText(e.target.value)}
              placeholder="วาง Group ID ที่นี่ (หนึ่ง ID ต่อบรรทัด)"
              rows={8}
              className="block w-full rounded-lg border-slate-300 bg-slate-50 focus:border-blue-500 focus:ring-blue-500 transition"
              disabled={isSaving}
            />
          )}
        </div>

        {error && <p className="text-red-600 font-semibold">ข้อผิดพลาด: {error}</p>}

        <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ยกเลิก
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving}>
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default NotificationSettingsModal;