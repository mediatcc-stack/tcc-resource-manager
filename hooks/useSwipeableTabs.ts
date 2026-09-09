/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  useSwipeableTabs — ปัดซ้าย/ขวาเพื่อสลับแท็บภายในระบบ (มือถือ/แท็บเล็ต)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ใช้ที่ไหน
 *    RoomBookingSystem  : หน้าแรก ↔ จัดการจอง ↔ สรุปรายงาน
 *    EquipmentSystem    : รายการยืมทั้งหมด ↔ สถิติการยืม
 *    RepairSystem       : รายการแจ้งซ่อมทั้งหมด ↔ สถิติการแจ้งซ่อม
 *
 *  วิธีใช้
 *    const { swipeHandlers, selectTab, contentAnimationClass, showSwipeHint } =
 *      useSwipeableTabs({ order: ['home', 'mybookings'], activeKey: currentPage, onChange: setCurrentPage });
 *
 *    <div {...swipeHandlers}>
 *      <SystemToolbar onSelect={selectTab} ... />
 *      <div key={currentPage} className={contentAnimationClass}>{...}</div>
 *    </div>
 *
 *  กติกาการปัด
 *    - ปัดซ้าย  → แท็บถัดไป | ปัดขวา → แท็บก่อนหน้า | สุดปลายทางแล้วไม่วนกลับ
 *    - ไม่ดักการปัดที่เริ่มบน input/textarea/select, องค์ประกอบที่เลื่อนแนวนอนได้เอง
 *      (เช่น แถบแท็บ/ตารางกว้าง) หรือองค์ประกอบที่ใส่ data-no-swipe ไว้
 *    - หน้าที่ไม่อยู่ใน order (เช่น หน้าฟอร์ม) จะปิดการปัดอัตโนมัติ กันปัดหลุดตอนกรอกข้อมูล
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useRef, useState } from 'react';

/** ระยะปัดขั้นต่ำ (px) ที่ถือว่าตั้งใจปัด ไม่ใช่นิ้วขยับตอนกดปุ่ม */
const MIN_DISTANCE = 60;
/** ระยะเบี่ยงแนวตั้งสูงสุด (px) เกินกว่านี้ถือว่ากำลังเลื่อนหน้าจอขึ้นลง */
const MAX_OFF_AXIS = 80;
/** เวลาสูงสุดของการปัด (ms) ลากค้างนาน ๆ ไม่นับเป็นการปัด */
const MAX_DURATION = 700;

/** key ของ localStorage สำหรับซ่อนคำใบ้ "ปัดเพื่อสลับแท็บ" หลังผู้ใช้ปัดสำเร็จครั้งแรก */
const HINT_STORAGE_KEY = 'swipeTabsHintSeen';

const readHintSeen = (): boolean => {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeHintSeen = () => {
  try {
    localStorage.setItem(HINT_STORAGE_KEY, 'true');
  } catch {
    /* โหมดส่วนตัว/บล็อกคุกกี้ — ไม่ต้องทำอะไร แค่แสดงคำใบ้ต่อไป */
  }
};

/** true = จุดเริ่มปัดอยู่บนสิ่งที่ผู้ใช้ต้องเลื่อน/ลากเอง จึงไม่ควรดักการปัด */
const shouldIgnoreSwipe = (target: EventTarget | null): boolean => {
  let el: Element | null = target instanceof Element ? target : null;

  while (el) {
    if (el instanceof HTMLElement && el.dataset.noSwipe !== undefined) return true;

    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

    // องค์ประกอบที่มีเนื้อหาล้นและเลื่อนแนวนอนได้เอง (แถบแท็บ, ตารางกว้าง) ต้องเลื่อนได้ตามปกติ
    if (el.scrollWidth > el.clientWidth + 4) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }

    el = el.parentElement;
  }

  return false;
};

interface TouchOrigin {
  x: number;
  y: number;
  time: number;
}

interface UseSwipeableTabsOptions<T extends string> {
  /** ลำดับแท็บจากซ้ายไปขวา ต้องเรียงตรงกับที่แสดงใน SystemToolbar */
  order: readonly T[];
  /** แท็บที่เปิดอยู่ — ถ้าไม่อยู่ใน order (เช่น หน้าฟอร์ม) การปัดจะถูกปิด */
  activeKey: T;
  onChange: (key: T) => void;
  /** ปิดการปัดชั่วคราว เช่น ระหว่างโหลดข้อมูล */
  enabled?: boolean;
}

export function useSwipeableTabs<T extends string>({
  order,
  activeKey,
  onChange,
  enabled = true,
}: UseSwipeableTabsOptions<T>) {
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);
  const [hintSeen, setHintSeen] = useState<boolean>(readHintSeen);
  const origin = useRef<TouchOrigin | null>(null);

  const activeIndex = order.indexOf(activeKey);
  const canSwipe = enabled && activeIndex >= 0 && order.length > 1;

  /** เปลี่ยนแท็บพร้อมกำหนดทิศทางอนิเมชันจากตำแหน่งแท็บ (ใช้ได้ทั้งการกดและการปัด) */
  const selectTab = useCallback(
    (key: T) => {
      const from = order.indexOf(activeKey);
      const to = order.indexOf(key);
      setDirection(from >= 0 && to >= 0 && to !== from ? (to > from ? 'forward' : 'backward') : null);
      onChange(key);
    },
    [order, activeKey, onChange]
  );

  /** ขยับไปแท็บถัดไป (delta = 1) หรือก่อนหน้า (delta = -1) */
  const step = useCallback(
    (delta: number) => {
      if (!canSwipe) return;
      const next = order[activeIndex + delta];
      if (!next) return; // สุดปลายทางแล้ว — ไม่วนกลับ
      setDirection(delta > 0 ? 'forward' : 'backward');
      onChange(next);
      if (!readHintSeen()) {
        writeHintSeen();
        setHintSeen(true);
      }
    },
    [canSwipe, order, activeIndex, onChange]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canSwipe || e.touches.length !== 1 || shouldIgnoreSwipe(e.target)) {
        origin.current = null;
        return;
      }
      const touch = e.touches[0];
      origin.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    },
    [canSwipe]
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    // นิ้วที่สอง = ผู้ใช้กำลังซูม ไม่ใช่การปัด
    if (e.touches.length > 1) origin.current = null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = origin.current;
      origin.current = null;
      if (!start || !canSwipe) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (Date.now() - start.time > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dy) > MAX_OFF_AXIS || Math.abs(dy) > Math.abs(dx)) return;

      step(dx < 0 ? 1 : -1);
    },
    [canSwipe, step]
  );

  const onTouchCancel = useCallback(() => {
    origin.current = null;
  }, []);

  const contentAnimationClass =
    activeIndex < 0 || direction === null
      ? ''
      : direction === 'forward'
        ? 'animate-swipe-from-right'
        : 'animate-swipe-from-left';

  return {
    /** กระจายลง element ที่ครอบเนื้อหาของระบบ */
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    /** ใช้แทน onSelect ของ SystemToolbar เพื่อให้อนิเมชันไปทางเดียวกับการปัด */
    selectTab,
    /** class อนิเมชันของเนื้อหา (ใส่คู่กับ key={activeKey} เพื่อให้เล่นใหม่ทุกครั้ง) */
    contentAnimationClass,
    /** ยังไม่เคยปัดสำเร็จ — แสดงคำใบ้บนจอเล็ก */
    showSwipeHint: canSwipe && !hintSeen,
  };
}

export default useSwipeableTabs;
