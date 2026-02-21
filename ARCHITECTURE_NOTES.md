# ข้อควรระวังและภาพรวมของระบบ (System Overview and Precautions)

เอกสารนี้สรุปโครงสร้างของโปรเจกต์และจุดที่ต้องระมัดระวังเป็นพิเศษ เพื่อให้การแก้ไขในอนาคตไม่กระทบต่อระบบเดิม

## โครงสร้างโค้ดและระบบเชื่อมต่อทั้งหมด

```javascript
// The following notes describe the core architecture.
// Future modifications must not break the existing system.
```

### 1. Cloudflare Worker (`cloudflare-worker.js`)
- **หน้าที่:** ทำหน้าที่เป็น Backend ของระบบ
- **ความรับผิดชอบ:**
    - จัดการข้อมูลใน KV Storage
    - เป็น Proxy ในการส่งการแจ้งเตือนไปยัง LINE Messaging API

### 2. ระบบแจ้งเตือน LINE (LINE Notification System)
- **ฝั่ง Frontend:** `services/notificationService.ts` เป็นส่วนที่ใช้ในการเรียก API เพื่อส่งการแจ้งเตือน
- **ฝั่ง Worker:** ใช้ Environment Variables `CHANNEL_ACCESS_TOKEN` และ `RECIPIENT_ID` ในการส่ง Push Message ไปยังผู้ใช้ผ่าน LINE

### 3. การจัดการข้อมูล (Data Integration)
- **Service:** `services/apiService.ts`
- **หน้าที่:** ดึงและบันทึกข้อมูลทั้งหมด (เช่น ห้องประชุมและอุปกรณ์) ผ่าน Endpoint ของ Cloudflare Worker

### 4. การตั้งค่าหลัก (Configuration)
- **ไฟล์:** `constants.ts`
- **ตัวแปรสำคัญ:**
    - `WORKER_BASE_URL`: URL หลักของ Cloudflare Worker
    - `NOTIFICATION_URL`: URL สำหรับส่งการแจ้งเตือน

---

## **ข้อควรระวังสูงสุด (Critical Precautions)**

```javascript
// สำคัญมาก: การเชื่อมต่อระหว่าง Frontend และ Worker เป็นหัวใจของระบบ
// ห้ามแก้ไข URL หรือส่วนที่เกี่ยวข้องกับการเชื่อมต่อเหล่านี้หากไม่มีความจำเป็นจริงๆ
```

- **`WORKER_BASE_URL` ใน `constants.ts`:** ต้องรักษาค่านี้ไว้ให้ถูกต้องเสมอ เพราะเป็นจุดเชื่อมต่อหลักสำหรับทุกบริการ
- **Cloudflare Worker & Services:** ห้ามแก้ไขโค้ดใน `cloudflare-worker.js`, `notificationService.ts`, หรือ `apiService.ts` หากไม่เข้าใจผลกระทบทั้งหมด เพื่อให้ระบบการแชร์เว็บและการแจ้งเตือนทำงานได้อย่างต่อเนื่องและถูกต้อง

```javascript
// การปฏิบัติตามข้อควรระวังเหล่านี้จะช่วยให้ระบบมีเสถียรภาพในระยะยาว
```
