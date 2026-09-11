/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  PageTransition.tsx — ปัดเปลี่ยนหน้า + โมชั่นตอนเปลี่ยนหน้า
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ครอบเนื้อหาทั้งหมดไว้ใน App.tsx ทำหน้าที่ 3 อย่าง
 *
 *  1) ปัดนิ้วซ้าย/ขวาเพื่อเลื่อนไปตามลำดับหน้าเดียวของทั้งแอป (ดู hooks/useSwipeNavigation)
 *       หน้าแรก → ระบบจองห้องประชุม → ตารางการจอง → สรุปรายงาน
 *               → ระบบแจ้งซ่อม → สถิติการแจ้งซ่อม → ระบบยืมอุปกรณ์ → สถิติการยืม
 *
 *  2) เนื้อหาขยับตามนิ้วขณะปัด (ยังไม่ปล่อยนิ้ว) พร้อมป้ายบอกหน้าปลายทาง
 *       - ลากไม่ถึงเกณฑ์แล้วปล่อย → สปริงกลับที่เดิม
 *       - ลากเกินเกณฑ์ หรือสะบัดเร็ว → เลื่อนออกแล้วหน้าใหม่เลื่อนเข้ามาแทน
 *       - สุดปลายทางหรืออยู่หน้าฟอร์ม → ลากได้นิดเดียวแบบมีแรงต้าน แล้วเด้งกลับ
 *
 *  3) เลื่อนจอกลับขึ้นบนสุดทุกครั้งที่เปลี่ยนหน้า
 *
 *  โครงสร้าง DOM (สำคัญ)
 *    .swipe-viewport   — รับ touch event, ตัดส่วนที่ล้นออกด้านข้าง
 *      .swipe-pane     — ชั้นที่ถูกลาก (แก้ style ตรง ๆ ผ่าน ref ไม่ผ่าน React จึงลื่นไม่กระตุก)
 *        .swipe-enter  — ชั้นอนิเมชันขาเข้า
 *
 *  ⚠️  ห้ามใส่ key ให้ชั้นในสุดเพื่อให้อนิเมชันเล่นใหม่ เพราะจะ remount ทั้งระบบที่อยู่ข้างใน
 *      (ข้อมูลที่โหลดไว้และ state ของฟอร์มจะหายทุกครั้งที่เปลี่ยนแท็บ) — ที่นี่จึงสั่งให้
 *      อนิเมชันเล่นใหม่ด้วยการถอด/ใส่ class แทน
 *
 *  ผู้ใช้ที่ตั้งค่า "ลดการเคลื่อนไหว" ในระบบปฏิบัติการจะยังปัดได้ แต่ไม่มีโมชั่น
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';

/** ระยะที่ต้องขยับก่อน จึงตัดสินว่าผู้ใช้ตั้งใจปัดแนวนอนหรือเลื่อนจอแนวตั้ง (px) */
const AXIS_LOCK_DISTANCE = 12;
/** ลากเกินสัดส่วนนี้ของความกว้างจอแล้วปล่อย = เปลี่ยนหน้า */
const COMMIT_RATIO = 0.22;
/** ระยะขั้นต่ำที่ถือว่าตั้งใจเปลี่ยนหน้า (px) — กันจอเล็กมากเปลี่ยนหน้าง่ายเกินไป */
const COMMIT_MIN_DISTANCE = 56;
/** สะบัดเร็วกว่านี้ (px/ms) ถือว่าตั้งใจเปลี่ยนหน้า แม้ลากได้ไม่ไกล */
const FLICK_VELOCITY = 0.45;
/** ระยะขั้นต่ำของการสะบัดเร็ว (px) — กันนิ้วสะบัดโดนปุ่ม */
const FLICK_MIN_DISTANCE = 24;
/** ลากได้ไกลสุดกี่ส่วนของความกว้างจอ (ยิ่งลากยิ่งฝืด ไม่เลยค่านี้) */
const MAX_DRAG_RATIO = 0.34;
/** แรงต้านเมื่อปัดไปทางที่ไม่มีหน้าถัดไป */
const RESISTANCE_RATIO = 0.06;
/** เวลาที่หน้าเดิมเลื่อนออก ก่อนหน้าใหม่เข้ามา (ms) */
const EXIT_DURATION = 170;
/** เวลาสปริงกลับที่เดิมเมื่อลากไม่ถึงเกณฑ์ (ms) */
const SETTLE_DURATION = 260;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/**
 * แปลงระยะนิ้วเป็นระยะที่เนื้อหาขยับจริง
 * ยิ่งลากไกลยิ่งฝืด และไม่มีวันเกิน max — ให้ความรู้สึกว่าหน้าถูก "ดึง" ไม่ใช่ลากอิสระ
 */
const dampen = (distance: number, max: number): number => {
  const sign = Math.sign(distance);
  return sign * max * (1 - Math.exp(-Math.abs(distance) / max));
};

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  axis: 'x' | 'y' | null;
  tracking: boolean;
}

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { stepKey, direction, peekStep, go } = useSwipeNavigation();

  const viewportRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLDivElement>(null);
  const peekLabelRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState>({ startX: 0, startY: 0, startTime: 0, lastX: 0, axis: null, tracking: false });
  const settleTimer = useRef<number | null>(null);

  // อ่านค่าล่าสุดจาก context ภายใน native listener ที่ผูกไว้ครั้งเดียว
  const navRef = useRef({ peekStep, go });
  navRef.current = { peekStep, go };

  /** วาดตำแหน่งของเนื้อหาขณะลาก (แก้ style ตรง ๆ ให้ลื่น ไม่ re-render ทุกเฟรม) */
  const paint = useCallback((x: number, maxDrag: number) => {
    const pane = paneRef.current;
    if (!pane) return;
    const progress = maxDrag > 0 ? Math.min(Math.abs(x) / maxDrag, 1) : 0;
    pane.style.transform = x === 0 ? '' : `translate3d(${x.toFixed(1)}px, 0, 0)`;
    pane.style.opacity = x === 0 ? '' : String(1 - 0.25 * progress);

    const label = peekLabelRef.current;
    if (label) label.style.opacity = String(Math.min(progress * 1.6, 1));
  }, []);

  /** ล้าง style ที่ใส่ไว้ระหว่างลาก กลับสู่สถานะปกติ */
  const clearPane = useCallback(() => {
    const pane = paneRef.current;
    if (pane) {
      pane.style.transition = '';
      pane.style.transform = '';
      pane.style.opacity = '';
    }
    const label = peekLabelRef.current;
    if (label) {
      label.style.opacity = '0';
      label.textContent = '';
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const reduced = prefersReducedMotion();
    const clearSettleTimer = () => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };

    const stopTracking = () => {
      gesture.current.tracking = false;
      gesture.current.axis = null;
    };

    /** ลากไม่ถึงเกณฑ์ — สปริงกลับที่เดิม */
    const settleBack = () => {
      const pane = paneRef.current;
      if (pane && !reduced) {
        pane.style.transition = `transform ${SETTLE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${SETTLE_DURATION}ms ease-out`;
        pane.style.transform = '';
        pane.style.opacity = '';
      }
      const label = peekLabelRef.current;
      if (label) label.style.opacity = '0';
      clearSettleTimer();
      settleTimer.current = window.setTimeout(clearPane, SETTLE_DURATION);
    };

    /** ลากถึงเกณฑ์ — เลื่อนหน้าเดิมออกให้สุด แล้วค่อยสลับเป็นหน้าใหม่ */
    const commit = (delta: number) => {
      if (reduced) {
        clearPane();
        navRef.current.go(delta);
        return;
      }
      const pane = paneRef.current;
      const width = viewport.clientWidth || window.innerWidth;
      if (pane) {
        pane.style.transition = `transform ${EXIT_DURATION}ms ease-in, opacity ${EXIT_DURATION}ms ease-in`;
        pane.style.transform = `translate3d(${(delta > 0 ? -1 : 1) * width * 0.32}px, 0, 0)`;
        pane.style.opacity = '0';
      }
      const label = peekLabelRef.current;
      if (label) label.style.opacity = '0';

      clearSettleTimer();
      settleTimer.current = window.setTimeout(() => {
        // ปล่อยให้หน้าเดิมค้างอยู่นอกจอ แล้วสั่งเปลี่ยนหน้า
        // style ที่ค้างจะถูกล้างใน useLayoutEffect (ก่อนเบราว์เซอร์วาดเฟรมของหน้าใหม่) จึงไม่มีภาพกระตุก
        if (!navRef.current.go(delta)) settleBack();
      }, EXIT_DURATION);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || shouldIgnoreSwipe(e.target)) {
        stopTracking();
        return;
      }
      clearSettleTimer();
      const pane = paneRef.current;
      if (pane) pane.style.transition = 'none'; // จับนิ้วระหว่างอนิเมชันได้ทันที

      const touch = e.touches[0];
      gesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        lastX: touch.clientX,
        axis: null,
        tracking: true,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = gesture.current;
      if (!state.tracking) return;
      if (e.touches.length > 1) {           // นิ้วที่สอง = กำลังซูม ไม่ใช่การปัด
        stopTracking();
        settleBack();
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;

      if (!state.axis) {
        if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE) return;
        // เอียงให้แนวตั้งชนะเล็กน้อย เพื่อไม่ไปขวางการเลื่อนอ่านเนื้อหา
        state.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
        if (state.axis === 'y') {
          stopTracking();
          return;
        }
      }

      // ล็อกเป็นการปัดแนวนอนแล้ว — กันจอเลื่อนขึ้นลง/ปัดย้อนกลับของเบราว์เซอร์
      if (e.cancelable) e.preventDefault();
      state.lastX = touch.clientX;
      if (reduced) return;

      const width = viewport.clientWidth || window.innerWidth;
      const target = navRef.current.peekStep(dx < 0 ? 1 : -1);
      const maxDrag = width * (target ? MAX_DRAG_RATIO : RESISTANCE_RATIO);

      const label = peekLabelRef.current;
      if (label) {
        const text = target ? (dx < 0 ? `${target.label} →` : `← ${target.label}`) : '';
        if (label.textContent !== text) label.textContent = text;
      }

      paint(dampen(dx, maxDrag), width * MAX_DRAG_RATIO);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = gesture.current;
      if (!state.tracking || state.axis !== 'x') {
        stopTracking();
        return;
      }
      stopTracking();

      const endX = e.changedTouches[0]?.clientX ?? state.lastX;
      const dx = endX - state.startX;
      const delta = dx < 0 ? 1 : -1;
      const width = viewport.clientWidth || window.innerWidth;
      const velocity = Math.abs(dx) / Math.max(performance.now() - state.startTime, 1);

      const farEnough = Math.abs(dx) >= Math.max(COMMIT_MIN_DISTANCE, width * COMMIT_RATIO);
      const flicked = velocity >= FLICK_VELOCITY && Math.abs(dx) >= FLICK_MIN_DISTANCE;

      if ((farEnough || flicked) && navRef.current.peekStep(delta)) commit(delta);
      else settleBack();
    };

    const onTouchCancel = () => {
      if (!gesture.current.tracking) return;
      stopTracking();
      settleBack();
    };

    // touchmove ต้องเป็น non-passive เพื่อ preventDefault ได้ (React ผูกให้แบบ passive เท่านั้น)
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    viewport.addEventListener('touchcancel', onTouchCancel);

    return () => {
      clearSettleTimer();
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [clearPane, paint]);

  // เปลี่ยนหน้าแล้วล้าง style ที่ค้างจากการลาก + เริ่มอ่านจากบนสุดเสมอ
  // ใช้ useLayoutEffect เพื่อให้ทำงานก่อนเบราว์เซอร์วาดเฟรมแรกของหน้าใหม่
  useLayoutEffect(() => {
    clearPane();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [stepKey, clearPane]);

  const enterClass =
    direction === 'forward' ? 'animate-swipe-from-right'
    : direction === 'backward' ? 'animate-swipe-from-left'
    : 'animate-fade-in';

  // สั่งให้อนิเมชันขาเข้าเล่นใหม่ทุกครั้งที่เปลี่ยนหน้า โดยไม่ remount เนื้อหาข้างใน
  useLayoutEffect(() => {
    const el = enterRef.current;
    if (!el) return;
    el.classList.remove('animate-swipe-from-right', 'animate-swipe-from-left', 'animate-fade-in');
    void el.offsetWidth; // บังคับให้เบราว์เซอร์คำนวณใหม่ อนิเมชันจึงเริ่มนับหนึ่ง
    el.classList.add(enterClass);
  }, [stepKey, enterClass]);

  return (
    <div ref={viewportRef} className="swipe-viewport">
      <div ref={paneRef} className="swipe-pane">
        <div ref={enterRef} className={enterClass}>
          {children}
        </div>
      </div>

      {/* ป้ายบอกหน้าปลายทางระหว่างลาก — ซ่อนไว้จนกว่าจะเริ่มปัด */}
      <div ref={peekLabelRef} className="swipe-peek" aria-hidden="true" />
    </div>
  );
};

export default PageTransition;
