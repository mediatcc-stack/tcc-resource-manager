import React, { useState, useEffect } from 'react';
import { fetchGroups, saveGroups, fetchGroupIdLog, clearGroupIdLog } from '../../services/apiService';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import Modal from '../shared/Modal';

interface DiscoveredGroup {
  id: string;
  name: string;
  detectedAt: string;
}

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

  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroup[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        setIsLoading(true);
        setIsLoadingLog(true);
        setError(null);
        try {
          const [groups, log] = await Promise.all([
            fetchGroups(),
            fetchGroupIdLog()
          ]);
          setGroupIdsText(groups.join('\n'));
          setDiscoveredGroups(log);
        } catch (err: any) {
          const errorMessage = err.message || 'ไม่สามารถโหลดข้อมูลได้';
          setError(errorMessage);
          showToast(errorMessage, 'error');
        } finally {
          setIsLoading(false);
          setIsLoadingLog(false);
        }
      };
      loadData();
    }
  }, [isOpen, showToast]);
  
  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
        showToast('คัดลอก Group ID แล้ว!', 'success');
    }, () => {
        showToast('คัดลอกไม่สำเร็จ', 'error');
    });
  };

  const handleClearLog = async () => {
      if (!confirm('คุณต้องการล้างประวัติกลุ่มที่ค้นพบทั้งหมดใช่หรือไม่?')) return;
      try {
          await clearGroupIdLog();
          setDiscoveredGroups([]);
          showToast('ล้างประวัติเรียบร้อยแล้ว', 'success');
      } catch (err: any) {
          showToast('ไม่สามารถล้างประวัติได้', 'error');
      }
  };


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
            <li>ID จะปรากฏในส่วน "กลุ่มที่เพิ่งถูกค้นพบ" ด้านล่าง ให้กดปุ่มคัดลอกได้เลย</li>
          </ol>
        </div>

        {/* Discovered Groups Section */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-slate-800 text-base">กลุ่มที่เพิ่งถูกค้นพบ</h4>
              {discoveredGroups.length > 0 && 
                <button onClick={handleClearLog} className="text-xs text-red-500 font-semibold hover:underline">
                    ล้างประวัติ
                </button>
              }
          </div>
          {isLoadingLog ? (
            <div className="h-20 flex items-center justify-center">
                <LoadingSpinner /><span className="ml-2 text-slate-500">กำลังโหลดประวัติ...</span>
            </div>
          ) : discoveredGroups.length === 0 ? (
            <p className="text-center text-slate-500 py-4 text-xs italic">ยังไม่มีกลุ่มที่ถูกค้นพบ<br/>ลองใช้คำสั่ง /getid ในกลุ่ม LINE</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {discoveredGroups.map(group => (
                    <div key={group.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg shadow-sm">
                       <div>
                           <p className="font-bold text-slate-700">{group.name}</p>
                           <p className="text-xs text-slate-400 font-mono">{group.id}</p>
                       </div>
                       <Button size="sm" variant="secondary" onClick={() => handleCopy(group.id)}>คัดลอก</Button>
                    </div>
                ))}
            </div>
          )}
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