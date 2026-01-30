import React from 'react';
import { WorkerStatus } from '../../services/apiService';
import { WORKER_BASE_URL } from '../../constants';

interface StatusItemProps {
  label: string;
  isOk: boolean;
  okText?: string;
  failText: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, isOk, okText, failText }) => (
  <li className={`flex items-start justify-between p-4 rounded-lg ${isOk ? 'bg-green-50' : 'bg-red-50'}`}>
    <div className="flex items-center gap-3">
      <span className="text-xl">{isOk ? '✅' : '❌'}</span>
      <span className="font-bold text-sm text-gray-700">{label}</span>
    </div>
    <p className={`text-xs font-semibold text-right ${isOk ? 'text-green-700' : 'text-red-700'}`}>
      {isOk ? (okText || 'ตั้งค่าเรียบร้อย') : failText}
    </p>
  </li>
);

interface ConfigurationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WorkerStatus | null;
  error: string | null;
}

const ConfigurationStatusModal: React.FC<ConfigurationStatusModalProps> = ({ isOpen, onClose, status, error }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-zoom-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-[#0D448D] flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <span>ผลการตรวจสอบการตั้งค่าระบบ</span>
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {error && <StatusItem label="การเชื่อมต่อ Worker" isOk={false} failText={error} />}
          
          {status && (
            <ul className="space-y-2">
              <StatusItem label="การเชื่อมต่อ Worker" isOk={true} okText="เชื่อมต่อสำเร็จ" failText="" />
              <StatusItem 
                label="LINE Access Token" 
                isOk={status.lineApiToken} 
                failText="ไม่ได้ตั้งค่าใน Worker" 
              />
              <StatusItem 
                label="LINE Recipient ID" 
                isOk={status.recipientIdSet} 
                failText="ไม่ได้ตั้งค่า ID ผู้รับใน Worker" 
              />
              <StatusItem 
                label="ฐานข้อมูลห้องประชุม" 
                isOk={status.roomKvBinding}
                failText="ไม่ได้ผูก KV Namespace"
              />
              <StatusItem 
                label="ฐานข้อมูลอุปกรณ์" 
                isOk={status.equipmentKvBinding}
                failText="ไม่ได้ผูก KV Namespace"
              />
            </ul>
          )}

          <div className="pt-4 border-t border-gray-100 mt-4">
            <h4 className="text-sm font-bold text-gray-600 mb-3">คำแนะนำเพิ่มเติม</h4>
            <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200">
                <p>• หากการตั้งค่าทั้งหมดถูกต้อง (✅) แต่ยังไม่ได้รับการแจ้งเตือน กรุณาตรวจสอบว่าคุณได้ <strong className="text-red-600">"เพิ่มเพื่อน"</strong> และ <strong className="text-red-600">"ไม่ได้บล็อค"</strong> บัญชี LINE Official Account ที่ชื่อว่า <strong>TCC Notify</strong></p>
                <p>• ตรวจสอบให้แน่ใจว่า `WORKER_BASE_URL` ในโค้ด (<code className="bg-gray-200 p-1 rounded text-red-700 text-[10px]">{WORKER_BASE_URL}</code>) ตรงกับ URL ที่แสดงในหน้า Cloudflare Worker ทุกตัวอักษร</p>
            </div>
          </div>

        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationStatusModal;