import React from 'react';

export interface SubTabItem<T extends string> {
  key: T;
  label: string;
  count?: number;
  /** ให้ตัวเลขเด่นเป็นสีแจ้งเตือน (เช่น งานที่ยังค้าง) */
  emphasis?: boolean;
}

interface SubTabsProps<T extends string> {
  tabs: SubTabItem<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
}

/** กลุ่มปุ่มสลับมุมมองย่อย เช่น "รายการปัจจุบัน / ประวัติ" พร้อมตัวเลขกำกับ */
function SubTabs<T extends string>({ tabs, activeKey, onSelect }: SubTabsProps<T>) {
  return (
    <div className="bg-surface-container-low p-1 rounded-xl inline-flex items-center gap-1 overflow-x-auto max-w-full">
      {tabs.map(tab => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`px-space-lg py-2.5 rounded-lg font-label text-label-md transition-all flex items-center gap-space-xs whitespace-nowrap cursor-pointer shrink-0 ${
              isActive
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-label-sm font-label px-2 py-0.5 rounded-full ${
                  tab.emphasis && tab.count > 0
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabs;
