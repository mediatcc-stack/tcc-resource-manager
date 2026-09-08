import React from 'react';

export type ConnectionStatus = 'connected' | 'error' | 'syncing';

export interface ToolbarTab<T extends string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
}

interface SystemToolbarProps<T extends string> {
  tabs: ToolbarTab<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  connectionStatus: ConnectionStatus;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: 'เชื่อมต่อแล้ว (Sync สด)',
  syncing: 'กำลังซิงค์ข้อมูล...',
  error: 'ไม่ได้เชื่อมต่อ',
};

/**
 * แถบคำสั่งด้านบนของแต่ละระบบ
 * ซ้าย  — กลุ่มแท็บสลับมุมมอง
 * ขวา   — ป้ายสถานะการเชื่อมต่อ + ปุ่มสร้างรายการใหม่
 */
function SystemToolbar<T extends string>({
  tabs,
  activeKey,
  onSelect,
  connectionStatus,
  action,
}: SystemToolbarProps<T>) {
  const dotClass =
    connectionStatus === 'connected' ? 'bg-live'
    : connectionStatus === 'syncing' ? 'bg-secondary'
    : 'bg-error';

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-card p-space-sm md:p-space-md mb-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
      {/* กลุ่มแท็บ */}
      <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl w-full md:w-auto overflow-x-auto">
        {tabs.map(tab => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              className={`flex items-center gap-space-xs px-space-md py-2 rounded-lg font-label text-label-md whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* สถานะ + ปุ่มหลัก */}
      <div className="flex items-center justify-between md:justify-end gap-space-md w-full md:w-auto">
        <div className="flex items-center gap-2 bg-surface-container-low px-space-sm py-1.5 rounded-full">
          <span className="relative flex h-2.5 w-2.5">
            {connectionStatus !== 'error' && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass}`} />
          </span>
          <span className="font-label text-label-sm text-on-surface-variant whitespace-nowrap">
            {STATUS_TEXT[connectionStatus]}
          </span>
        </div>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-1.5 px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label text-label-md shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer whitespace-nowrap"
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default SystemToolbar;
