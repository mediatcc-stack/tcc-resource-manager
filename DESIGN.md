---
name: TCC Resource Manager
description: ระบบบริหารจัดการทรัพยากรส่วนกลาง (จองห้องประชุม / ยืมอุปกรณ์สื่อฯ / แจ้งซ่อมไอที) - วิทยาลัยพณิชยการธนบุรี
colors:
  primary: "#00236f"
  primary-container: "#1e3a8a"
  on-primary: "#ffffff"
  on-primary-container: "#90a8ff"
  secondary: "#0051d5"
  secondary-container: "#316bf3"
  secondary-fixed: "#dbe1ff"
  accent: "#ea580c"
  surface: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e5eeff"
  surface-container-high: "#dce9ff"
  surface-container-highest: "#d3e4fe"
  on-surface: "#0b1c30"
  on-surface-variant: "#444651"
  outline: "#757682"
  outline-variant: "#c5c5d3"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  success: "#15803d"
  live: "#22c55e"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Prompt, sans-serif"
    fontSize: "36px"
    lineHeight: "44px"
    fontWeight: 700
  headline:
    fontFamily: "Plus Jakarta Sans, Prompt, sans-serif"
    fontSize: "24px"
    lineHeight: "32px"
    fontWeight: 700
  body:
    fontFamily: "Be Vietnam Pro, Prompt, sans-serif"
    fontSize: "14px"
    lineHeight: "22px"
    fontWeight: 400
  label:
    fontFamily: "Plus Jakarta Sans, Prompt, sans-serif"
    fontSize: "12px"
    lineHeight: "16px"
    fontWeight: 600
rounded:
  sm: "4px"
  lg: "8px"
  xl: "12px"
  card: "12px"
  hero: "16px"
  badge: "9999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
layout:
  maxWidthContent: "1360px"
  gutterMobile: "16px"
  gutterTablet: "24px"
  gutterDesktop: "32px"
  headerHeight: "112px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
  button-secondary:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-container}"
---

# Design System: TCC Resource Manager

## 1. Overview

**Creative North Star: "Blue Haven Service" (บริการรวดเร็วใต้เงาสถาบัน)**

ระบบนำเสนออัตลักษณ์ของวิทยาลัยพณิชยการธนบุรีผ่านโครงสีน้ำเงินเข้ม-ขาว บนพื้นผิวโทนฟ้าอ่อนหลายระดับ (Tonal Surfaces) สะท้อนความมั่นคงและเป็นระเบียบ พร้อมสีส้มเป็นสีเน้น (Accent) สำหรับจุดที่ต้องการดึงสายตา

โครงหน้าเว็บทุกหน้าอยู่ภายใต้โครงร่างเดียวกัน คือ แถบหัวเรื่องแบบ 2 ชั้น (Brand bar + เมนูระบบ) → Breadcrumb → เนื้อหาในคอนเทนเนอร์กว้างสูงสุด 1360px → ส่วนท้ายเว็บ

**ค่านิยมหลักของดีไซน์ (Key Characteristics):**
*   **Trustworthy Structure:** โครงหน้าเดียวกันทุกระบบ ผู้ใช้รู้เสมอว่าตัวเองอยู่ตรงไหน
*   **Tonal Layering:** แยกชั้นข้อมูลด้วยระดับพื้นผิว (surface-container-*) แทนการตีเส้นขอบถี่ๆ
*   **Vibrant Signals:** สีส้มและป้ายสถานะสีเฉพาะ ใช้เฉพาะจุดที่ต้องการการตัดสินใจ

## 2. Colors

ระบบสีใช้ชุดโทเคนแบบ Material 3 (role-based) เก็บเป็น CSS Variables ใน `index.css` และ map เข้า Tailwind ใน `tailwind.config.js`

### Primary
*   **TCC Navy** (#00236f): สีหลักของสถาบัน ใช้กับแถบหัวเรื่อง ปุ่มหลัก และแท็บที่ถูกเลือก
*   **Primary Container** (#1e3a8a): น้ำเงินอ่อนกว่าหนึ่งขั้น ใช้เป็นสถานะ hover ของปุ่มหลัก และปลายไล่เฉดของ Hero

### Secondary
*   **Secondary** (#0051d5) / **Secondary Container** (#316bf3): ใช้กับลิงก์ ไอคอนเน้น และข้อมูลเวลา/วันที่ในการ์ด
*   **Secondary Fixed** (#dbe1ff): พื้นป้ายสถานะ "กำลังดำเนินการ / มีการจอง"

### Accent
*   **Accent Orange** (#ea580c): CTA ในการ์ดเลือกระบบ และจุดเน้นในหน้าแรกเท่านั้น

### Surfaces
*   **surface** (#f8f9ff): พื้นหลังของทั้งหน้า
*   **surface-container-lowest** (#ffffff): พื้นการ์ดทุกใบ
*   **surface-container-low / container / high / highest**: ไล่ระดับสำหรับกล่องซ้อนใน เช่น กลุ่มแท็บ ช่องกรอกข้อมูล และป้ายกำกับ

### Status
*   **error / error-container** (#ba1a1a / #ffdad6): เกินกำหนด ปิดปรับปรุง และการลบถาวร
*   **success-container** (#dcfce7): ว่าง / คืนแล้ว / ซ่อมเสร็จสิ้น
*   **warning-container** (#fef3c7): รออนุมัติ / รอดำเนินการ
*   **live** (#22c55e): จุดแสดงสถานะการเชื่อมต่อเรียลไทม์

### Named Rules
**The 10% Accent Rule.** สีส้มใช้ไม่เกิน 10% ของพื้นผิวแต่ละหน้า เฉพาะ CTA และจุดแจ้งเตือนสำคัญ

**The Ink-Only Rule.** ข้อความเนื้อหาต้องใช้ `on-surface` (#0b1c30) หรือ `on-surface-variant` (#444651) เท่านั้น ห้ามใช้สีเทาอ่อนกว่านี้กับข้อความที่ต้องอ่านจริง (`outline` ใช้ได้เฉพาะข้อความประกอบ เช่น timestamp)

## 3. Typography

**Display / Headline / Label Font:** Plus Jakarta Sans → fallback Prompt
**Body Font:** Be Vietnam Pro → fallback Prompt

ฟอนต์ Latin ทั้งสองตัวไม่มีชุดอักขระไทย เบราว์เซอร์จึงถอยไปใช้ **Prompt** สำหรับตัวอักษรไทยโดยอัตโนมัติ (per-glyph fallback) — ผลคือหัวเรื่องภาษาอังกฤษ/ตัวเลขได้บุคลิกตามดีไซน์ ส่วนภาษาไทยยังคงอ่านง่ายด้วย Prompt

### Hierarchy
*   **display-hero** (700, 36/44): หัวเรื่องหลักของ Hero หน้าแรก (มือถือใช้ 26/34)
*   **headline-lg** (700, 24/32): ชื่อระบบในการ์ดหน้าแรก
*   **headline-md** (600, 18/26): หัวเรื่องของหน้าในแต่ละระบบ
*   **headline-sm** (600, 16/24): ชื่อการ์ด ชื่อห้อง ชื่อผู้ยืม/ผู้แจ้ง
*   **body-lg / body-md / body-sm** (400, 16/26 · 14/22 · 12/18): เนื้อความและข้อมูลประกอบ
*   **label-lg / label-md / label-sm** (600, 14/20 · 12/16 · 11/14): ปุ่ม แท็บ ป้ายสถานะ และ label ของช่องกรอก

### Named Rules
**The Auto-Balance Rule.** หัวเรื่องทุกระดับใช้ `text-wrap: balance` (ตั้งไว้ที่ `h1–h6` ใน `index.css`) เพื่อไม่ให้วรรณยุกต์ไทยตกบรรทัดแปลกๆ

## 4. Elevation

แยกชั้นด้วยเฉดพื้นผิวเป็นหลัก และใช้เงาแบบนุ่มกับการ์ดที่กดได้เท่านั้น

### Shadow Vocabulary
*   **card** (`0 4px 24px rgba(15, 23, 42, 0.06)`): เงาพักของการ์ดทุกใบ
*   **card-hover** (`0 16px 36px rgba(30, 58, 138, 0.12)`): เงาเมื่อโฮเวอร์การ์ดที่กดได้ พร้อมยกขึ้น 4px
*   **header** (`0 1px 8px rgba(0, 0, 0, 0.04)`): เส้นแบ่งแถบหัวเรื่องแบบนุ่ม แทนการตีเส้น 1px

### Named Rules
**The Soft-Card Rule.** ห้ามใช้เส้นขอบ 1px รอบการ์ด ให้แยกการ์ดออกจากพื้นหลังด้วยสีพื้น (`surface-container-lowest` บน `surface`) และเงา `card` เท่านั้น

## 5. Components

### Layout Shell
*   **Header:** fixed สูงรวม 112px — ชั้นบน 64px ไล่เฉด `primary → primary-container` (แบรนด์ + ปุ่มโหมดเจ้าหน้าที่), ชั้นล่าง 48px พื้น `surface/90` + backdrop-blur (ปุ่มกลับหน้าแรก + แท็บเลือกระบบ)
*   **Content:** `max-width 1360px` จัดกึ่งกลาง gutter 16/24/32px ตามขนาดจอ และเว้นบน `pt-28` ให้พ้น header
*   **Footer:** พื้น `surface-container-low` แสดงชื่อสถาบันและงานสื่อดิจิทัลฯ

### Buttons
*   **Shape:** ขอบมน 8px (rounded-lg) ปุ่มทรงกลม/pill ใช้กับ chip และปุ่มไอคอนเท่านั้น
*   **Primary:** พื้น `primary` ตัวอักษร `on-primary` hover เป็น `primary-container`
*   **Secondary:** พื้น `surface-container-low` ตัวอักษร `primary` hover เป็น `surface-container`
*   **Danger:** พื้น `error` ตัวอักษรขาว ใช้กับการลบถาวรเท่านั้น

### Cards / Containers
*   **Corner Style:** 12px (rounded-xl) — ยกเว้น Hero หน้าแรกที่ใช้ 16-24px
*   **Background:** `surface-container-lowest` บนพื้น `surface`
*   **Internal Padding:** 16px (p-space-md) ขึ้นไป และ 24-32px สำหรับการ์ดหน้าแรก

### Inputs / Fields
*   **Style:** พื้น `surface-container-low` ไม่มีเส้นขอบ ขอบมน 8px และ label เป็น `label-sm` สี `on-surface-variant`
*   **Focus:** เปลี่ยนพื้นเป็น `surface-container-lowest` (ยกขึ้นมาหนึ่งชั้น) ไม่ใช้เส้นขอบสี
*   **Select:** ใช้ `appearance-none` และวางไอคอน chevron เองทางขวา เพื่อให้เหมือนกันทุกเบราว์เซอร์

### Navigation & Tabs
*   **แท็บระบบ (header):** แท็บที่เลือกพื้น `primary-container` ตัวอักษรขาว มุมมน 8px
*   **แท็บภายในระบบ (SystemToolbar):** กลุ่มปุ่มในกล่อง `surface-container-low` แท็บที่เลือกพื้น `primary`
*   **แท็บย่อย (SubTabs):** แท็บที่เลือกพื้น `surface-container-lowest` ตัวอักษร `primary` พร้อมตัวเลขจำนวนรายการกำกับ
*   **สถานะเชื่อมต่อ:** pill ในกล่อง `surface-container-low` พร้อมจุดสี `live` / `secondary` / `error` ตามสถานะจริงของการ sync
*   **ปัดเปลี่ยนหน้า (มือถือ):** ทั้งแอปเรียงเป็นลำดับเดียว ปัดซ้ายไปหน้าถัดไป ปัดขวาย้อนกลับ (ไม่วนกลับเมื่อสุดปลายทาง)

        หน้าแรก → ระบบจองห้องประชุม → ตารางการจอง → สรุปรายงาน
                → ระบบยืมอุปกรณ์ → สถิติการยืม
                → ระบบแจ้งซ่อม  → สถิติการแจ้งซ่อม

    ระหว่างลาก เนื้อหาจะขยับตามนิ้วแบบมีแรงต้าน (ยิ่งลากยิ่งฝืด) จางลงเล็กน้อย
    และมีป้ายชื่อหน้าปลายทางลอยขึ้นด้านล่าง — ปล่อยนิ้วก่อนถึงเกณฑ์จะสปริงกลับที่เดิม
    เกินเกณฑ์ (~22% ของความกว้างจอ) หรือสะบัดเร็วจึงเปลี่ยนหน้า โดยหน้าเดิมเลื่อนออก
    แล้วหน้าใหม่เลื่อนเข้าด้วย `animate-swipe-from-right` / `animate-swipe-from-left`
    (การกดแท็บและกดเมนูใช้โมชั่นชุดเดียวกัน) มีคำใบ้ใต้แถบแท็บบนจอเล็ก
    ซึ่งจะซ่อนถาวรหลังผู้ใช้ปัดสำเร็จครั้งแรก
    หน้าฟอร์มอยู่นอกลำดับ จึงปิดการปัดอัตโนมัติกันปัดหลุดตอนกรอกข้อมูล

## 6. Do's and Don'ts

### Do:
*   **Do** ใช้พื้นที่กดบนมือถืออย่างน้อย 44x44px
*   **Do** ใช้ระดับพื้นผิว (surface-container-*) แยกกลุ่มข้อมูล แทนการตีเส้นขอบซ้อนกันหลายชั้น
*   **Do** ให้ป้ายสถานะทุกใบมีทั้งสีและข้อความกำกับเสมอ (ไม่สื่อสารด้วยสีอย่างเดียว)
*   **Do** ใช้ตัวเลขจากข้อมูลจริงในป้ายกำกับแท็บและป้ายสถานะเท่านั้น

### Don't:
*   **Don't** ตีขอบแถบสีหนาด้านข้างการ์ด (side-stripe) ให้ใช้ป้ายสถานะแทน
*   **Don't** ใช้ไล่เฉดสีกับตัวหนังสือ หรือใส่ไล่เฉดในปุ่มขนาดเล็ก
*   **Don't** ใช้มุมโค้งน้อยกว่า 8px กับปุ่มหรือการ์ด
*   **Don't** ใส่เอฟเฟกต์กระจกเบลอ (glassmorphism) ทับบริเวณที่ต้องกรอกข้อมูล
