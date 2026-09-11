/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  useSwipeNavigation — ลำดับหน้าเดียวทั้งแอป สำหรับปัดซ้าย/ขวา
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ลำดับการปัด (ปัดซ้าย = ไปข้างหน้า, ปัดขวา = ย้อนกลับ) — ตรงกับลำดับเมนู 1-2-3
 *    หน้าแรก → ระบบจองห้องประชุม → ตารางการจอง → สรุปรายงาน
 *            → ระบบแจ้งซ่อม  → สถิติการแจ้งซ่อม
 *            → ระบบยืมอุปกรณ์ → สถิติการยืม
 *
 *  ทำไมต้องมี Provider
 *    ลำดับนี้ข้ามทั้ง "หน้า (URL)" และ "แท็บภายในระบบ" จึงต้องยกสถานะแท็บของทุกระบบ
 *    ขึ้นมาไว้ที่เดียว เพื่อให้การปัดข้ามระบบเปิดแท็บปลายทางได้ถูกตัว
 *    (เช่น ปัดขวาจาก "ระบบยืมอุปกรณ์" ต้องกลับไปที่ "สถิติการแจ้งซ่อม" ไม่ใช่แท็บแรกของระบบแจ้งซ่อม)
 *
 *  วิธีใช้ในระบบย่อย — แทน useState เดิมได้ทันที (signature เหมือนกัน)
 *    const [currentPage, setCurrentPage] = useSystemPage<RoomPage>('/room', 'home');
 *
 *  หน้าที่ไม่อยู่ในลำดับ (ฟอร์มจอง/ฟอร์มยืม/ฟอร์มแจ้งซ่อม) จะปิดการปัดอัตโนมัติ
 *  กันปัดหลุดตอนกรอกข้อมูล
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface SwipeStep {
  /** URL ของระบบ */
  path: string;
  /** แท็บภายในระบบ — null สำหรับหน้าที่ไม่มีแท็บ (หน้าแรก) */
  tab: string | null;
  /** ชื่อที่ใช้แสดงในคำใบ้ตอนปัด */
  label: string;
}

/** ลำดับหน้าทั้งหมดของแอป เรียงจากซ้ายไปขวา
 *  ⚠️ ลำดับระบบต้องตรงกับเมนู (Navbar.tsx → NAV_ITEMS, BottomNav.tsx) และการ์ดหน้าแรก */
export const SWIPE_STEPS: readonly SwipeStep[] = [
  { path: '/',          tab: null,         label: 'หน้าแรก' },
  { path: '/room',      tab: 'home',       label: 'ระบบจองห้องประชุม' },
  { path: '/room',      tab: 'mybookings', label: 'ตารางการจอง' },
  { path: '/room',      tab: 'statistics', label: 'สรุปรายงาน' },
  { path: '/repair',    tab: 'list',       label: 'ระบบแจ้งซ่อม' },
  { path: '/repair',    tab: 'statistics', label: 'สถิติการแจ้งซ่อม' },
  { path: '/equipment', tab: 'list',       label: 'ระบบยืมอุปกรณ์' },
  { path: '/equipment', tab: 'statistics', label: 'สถิติการยืม' },
] as const;

/** แท็บเริ่มต้นของแต่ละระบบ (ตรงกับ step แรกของระบบนั้นในลำดับด้านบน) */
const DEFAULT_TABS: Record<string, string> = {
  '/room': 'home',
  '/equipment': 'list',
  '/repair': 'list',
};

/** key ของ localStorage สำหรับซ่อนคำใบ้ "ปัดเพื่อเปลี่ยนหน้า" หลังผู้ใช้ปัดสำเร็จครั้งแรก */
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

export type SwipeDirection = 'forward' | 'backward' | null;

interface SwipeNavigationValue {
  /** แท็บที่เปิดอยู่ของแต่ละระบบ */
  tabs: Record<string, string>;
  /** เปลี่ยนแท็บของระบบหนึ่ง (ใช้ผ่าน useSystemPage) — ข้ามระบบได้ด้วยการส่ง path อื่น */
  setTab: (path: string, tab: string) => void;
  /** ตำแหน่งในลำดับ SWIPE_STEPS — (-1) เมื่ออยู่หน้าที่ปัดไม่ได้ เช่น หน้าฟอร์ม */
  stepIndex: number;
  /** step ปลายทางของการปัด (delta = +1 ถัดไป, -1 ก่อนหน้า) หรือ null เมื่อสุดปลายทาง */
  peekStep: (delta: number) => SwipeStep | null;
  /** ไปยัง step ถัดไป/ก่อนหน้า — คืนค่า true เมื่อเปลี่ยนหน้าจริง */
  go: (delta: number) => boolean;
  /** ทิศทางของการเปลี่ยนหน้าครั้งล่าสุด ใช้เลือกอนิเมชันขาเข้า */
  direction: SwipeDirection;
  /** เอกลักษณ์ของหน้าปัจจุบัน (URL + แท็บ) ใช้เป็น key ให้อนิเมชันเล่นใหม่ทุกครั้ง */
  stepKey: string;
  /** ยังไม่เคยปัดสำเร็จ — แสดงคำใบ้บนจอเล็ก */
  showSwipeHint: boolean;
}

const SwipeNavigationContext = createContext<SwipeNavigationValue | null>(null);

const indexOfStep = (path: string, tab: string | undefined): number =>
  SWIPE_STEPS.findIndex(step => step.path === path && (step.tab === null || step.tab === tab));

export const SwipeNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [tabs, setTabs] = useState<Record<string, string>>(DEFAULT_TABS);
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const [hintSeen, setHintSeen] = useState<boolean>(readHintSeen);

  /** true = การเปลี่ยน URL ครั้งนี้มาจากการปัด/กดแท็บ ไม่ใช่กดเมนูหรือปุ่มย้อนกลับของเบราว์เซอร์ */
  const fromSwipe = useRef(false);
  /** หน้าก่อนหน้า ใช้เทียบเพื่อหาทิศทางของอนิเมชัน */
  const [previous, setPrevious] = useState(() => ({ path: location.pathname, tab: tabs[location.pathname] }));

  let currentTab = tabs[location.pathname];

  // ── ปรับ state ระหว่าง render เมื่อ URL เปลี่ยน (รูปแบบ "adjusting state on props change" ของ React)
  //    ทำที่นี่แทน useEffect เพื่อให้หน้าใหม่ได้ทิศทาง/แท็บที่ถูกต้องตั้งแต่เฟรมแรก ไม่กระพริบ
  if (previous.path !== location.pathname) {
    // เข้าระบบจากเมนู/หน้าแรก (ไม่ใช่การปัด) ให้เริ่มที่แท็บแรกของระบบนั้นเสมอ
    if (!fromSwipe.current && DEFAULT_TABS[location.pathname]) {
      currentTab = DEFAULT_TABS[location.pathname];
      setTabs(prev => ({ ...prev, [location.pathname]: currentTab as string }));
    }
    fromSwipe.current = false;

    const from = indexOfStep(previous.path, previous.tab);
    const to = indexOfStep(location.pathname, currentTab);
    setDirection(from >= 0 && to >= 0 && from !== to ? (to > from ? 'forward' : 'backward') : null);
    setPrevious({ path: location.pathname, tab: currentTab });
  } else if (previous.tab !== currentTab) {
    // เปลี่ยนแท็บภายในระบบเดิม
    const from = indexOfStep(previous.path, previous.tab);
    const to = indexOfStep(location.pathname, currentTab);
    setDirection(from >= 0 && to >= 0 && from !== to ? (to > from ? 'forward' : 'backward') : null);
    setPrevious({ path: location.pathname, tab: currentTab });
  }

  const stepIndex = indexOfStep(location.pathname, currentTab);

  const setTab = useCallback(
    (path: string, tab: string) => {
      setTabs(prev => (prev[path] === tab ? prev : { ...prev, [path]: tab }));
      if (path !== location.pathname) {
        fromSwipe.current = true; // แท็บถูกตั้งไว้แล้ว อย่าให้ถูกรีเซ็ตเป็นแท็บแรก
        navigate(path);
      }
    },
    [location.pathname, navigate]
  );

  const peekStep = useCallback(
    (delta: number): SwipeStep | null => {
      if (stepIndex < 0) return null; // หน้าฟอร์ม — ปิดการปัด
      return SWIPE_STEPS[stepIndex + delta] ?? null; // สุดปลายทางแล้วไม่วนกลับ
    },
    [stepIndex]
  );

  const go = useCallback(
    (delta: number): boolean => {
      const target = peekStep(delta);
      if (!target) return false;

      if (target.tab) setTabs(prev => ({ ...prev, [target.path]: target.tab as string }));
      if (target.path !== location.pathname) {
        fromSwipe.current = true;
        navigate(target.path);
      }

      if (!readHintSeen()) {
        writeHintSeen();
        setHintSeen(true);
      }
      return true;
    },
    [peekStep, location.pathname, navigate]
  );

  const value = useMemo<SwipeNavigationValue>(
    () => ({
      tabs,
      setTab,
      stepIndex,
      peekStep,
      go,
      direction,
      stepKey: `${location.pathname}:${currentTab ?? ''}`,
      showSwipeHint: stepIndex >= 0 && !hintSeen,
    }),
    [tabs, setTab, stepIndex, peekStep, go, direction, location.pathname, currentTab, hintSeen]
  );

  return <SwipeNavigationContext.Provider value={value}>{children}</SwipeNavigationContext.Provider>;
};

export function useSwipeNavigation(): SwipeNavigationValue {
  const context = useContext(SwipeNavigationContext);
  if (!context) throw new Error('useSwipeNavigation ต้องอยู่ภายใน <SwipeNavigationProvider>');
  return context;
}

/**
 * แท็บที่เปิดอยู่ของระบบหนึ่ง — ใช้แทน useState ได้ตรง ๆ
 * สถานะถูกเก็บไว้ที่ Provider เพื่อให้การปัดข้ามระบบเปิดแท็บปลายทางได้ถูกตัว
 */
export function useSystemPage<T extends string>(path: string, fallback: T): [T, (page: T) => void] {
  const { tabs, setTab } = useSwipeNavigation();
  const page = (tabs[path] ?? fallback) as T;
  const setPage = useCallback((next: T) => setTab(path, next), [setTab, path]);
  return [page, setPage];
}

export default useSwipeNavigation;
