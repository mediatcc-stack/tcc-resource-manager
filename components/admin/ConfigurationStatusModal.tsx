/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  ConfigurationStatusModal.tsx — หน้าตรวจสอบสุขภาพระบบ (เฉพาะโหมดเจ้าหน้าที่)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  เปิดจากปุ่มรูปเกียร์บนแถบหัวเรื่องเมื่ออยู่ในโหมดเจ้าหน้าที่
 *  ใช้เช็คหลัง deploy Worker ใหม่ทุกครั้ง — โดยเฉพาะ 2 อย่างนี้
 *    • ลายเซ็น Webhook (CHANNEL_SECRET) — ถ้ายังไม่ตั้ง ใครก็แอบเพิ่มกลุ่มตัวเอง
 *      เป็นผู้รับแจ้งเตือนได้
 *    • กลุ่มที่รับแจ้งเตือน — ถ้าเป็น 0 แปลว่าแจ้งเตือนที่ส่งออกไปไม่ถึงใครเลย
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React from 'react';
import { WorkerStatus, NotificationRecipient } from '../../services/apiService';
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
      <span className="font-bold text-sm text-on-surface">{label}</span>
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
  recipients: NotificationRecipient[] | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const ConfigurationStatusModal: React.FC<ConfigurationStatusModalProps> = ({
  isOpen, onClose, status, error, recipients, isLoading = false, onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
      data-no-swipe
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg animate-zoom-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline-variant">
          <h3 className="text-xl font-bold text-primary flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <span>ผลการตรวจสอบการตั้งค่าระบบ</span>
          </h3>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading && <p className="text-sm text-on-surface-variant text-center py-4">กำลังตรวจสอบ...</p>}
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
                label="ลายเซ็น Webhook (CHANNEL_SECRET)"
                isOk={status.channelSecretSet}
                okText="ตรวจลายเซ็นแล้ว"
                failText="ยังไม่ตั้งค่า — คนนอกแอบเพิ่มกลุ่มรับแจ้งเตือนได้"
              />
              <StatusItem
                label="กลุ่มที่รับแจ้งเตือน"
                isOk={(status.recipientCount ?? 0) > 0}
                okText={`${status.recipientCount} กลุ่ม`}
                failText="ไม่มีกลุ่มไหนรับแจ้งเตือนเลย"
              />
              <StatusItem
                label="LINE Recipient ID"
                isOk={status.recipientIdSet}
                failText="ไม่ได้ตั้งค่า ID ผู้รับใน Worker"
              />
              <StatusItem
                label="LINE กลุ่มแจ้งซ่อม"
                isOk={status.repairGroupIdSet}
                failText="ไม่ได้ตั้งค่า REPAIR_GROUP_ID ใน Worker"
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
              <StatusItem
                label="ฐานข้อมูลแจ้งซ่อม"
                isOk={status.repairKvBinding}
                failText="ไม่ได้ผูก KV Namespace"
              />
            </ul>
          )}

          {recipients && recipients.length > 0 && (
            <div className="pt-4 border-t border-outline-variant mt-4">
              <h4 className="text-sm font-bold text-on-surface mb-1">กลุ่มที่รับแจ้งเตือนการจองห้อง</h4>
              <p className="text-[11px] text-on-surface-variant mb-3">
                แตะที่ Group ID เพื่อคัดลอก (เช่น เอาไปใส่ REPAIR_GROUP_ID)
              </p>
              <ul className="space-y-2">
                {recipients.map(r => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                      r.active
                        ? 'bg-surface-container-low border-outline-variant'
                        : 'bg-surface-container-low border-dashed border-outline-variant opacity-70'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {r.name || '(อ่านชื่อไม่ได้ — บอทไม่ได้อยู่ในกลุ่มแล้ว)'}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(r.id)}
                        title="คัดลอก Group ID"
                        className="text-[10px] text-outline font-mono truncate hover:text-primary cursor-pointer max-w-full block text-left"
                      >
                        {r.id}
                      </button>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                      r.active ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {r.active ? (r.type === 'group' ? 'รับอยู่' : 'รับอยู่ (ส่วนตัว)') : 'หยุดรับแล้ว'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-outline-variant mt-4">
            <h4 className="text-sm font-bold text-on-surface mb-3">คำแนะนำเพิ่มเติม</h4>
            <div className="text-xs text-on-surface bg-surface-container-low p-4 rounded-lg space-y-2 border border-outline-variant">
                <p>• หากการตั้งค่าทั้งหมดถูกต้อง (✅) แต่ยังไม่ได้รับการแจ้งเตือน กรุณาตรวจสอบว่ากลุ่มไลน์ของคุณได้ <strong className="text-red-600">"เชิญ"</strong> บัญชี LINE Official Account ที่ชื่อว่า <strong>TCC Notify</strong> เข้ากลุ่ม และ <strong className="text-red-600">"ยังไม่ได้เตะบอทออก"</strong> (ระบบเก็บเฉพาะกลุ่มเป็นผู้รับแจ้งเตือน ไม่รองรับการแอดเพื่อนแบบส่วนตัวแล้ว)</p>
                <p>• ตรวจสอบให้แน่ใจว่า `WORKER_BASE_URL` ในโค้ด (<code className="bg-surface-container-high p-1 rounded text-red-700 text-[10px]">{WORKER_BASE_URL}</code>) ตรงกับ URL ที่แสดงในหน้า Cloudflare Worker ทุกตัวอักษร</p>
            </div>
          </div>

        </div>

        <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end items-center gap-2 rounded-b-2xl">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2 bg-surface-container text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-container-high transition disabled:opacity-50"
            >
              ตรวจสอบใหม่
            </button>
          )}
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