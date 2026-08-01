# คู่มือนักพัฒนา — TCC Resource Manager

> ระบบจองห้องประชุมและยืมอุปกรณ์ — วิทยาลัยพณิชยการธนบุรี

---

## 📁 Source Code

| ส่วน | ที่อยู่ |
|---|---|
| **GitHub Repository** | `https://github.com/[your-org]/tcc-resource-manager` |
| **Frontend (React)** | `/` ทุกไฟล์ `.tsx` และ `.ts` |
| **Backend (Worker)** | `cloudflare-worker.js` |

---

## 🌐 URLs ที่ใช้งานจริง

| ส่วน | URL |
|---|---|
| **Frontend** | https://tcc-media-booking.pages.dev |
| **Backend Worker** | https://tcc-line-notifier.media-tcc.workers.dev |
| **Worker /status** | https://tcc-line-notifier.media-tcc.workers.dev/status |

---

## 🗄️ ฐานข้อมูล (Cloudflare KV) — ⚠️ ห้ามลบเด็ดขาด!

ข้อมูลทั้งหมดเก็บใน **Cloudflare KV Storage** ไม่ใช่ database ทั่วไป  
**ถ้าลบ KV Namespace จะหายถาวร ไม่มี recycle bin!**

### KV Namespaces ที่ใช้งาน

| Binding Name (ในโค้ด) | KV Namespace (ใน Dashboard) | เก็บอะไร |
|---|---|---|
| `ROOM_BOOKINGS_KV` | `TCC_ROOM_BOOKINGS` | การจองห้อง + recipient IDs |
| `EQUIPMENT_BORROWINGS_KV` | `TCC_EQUIPMENT_BORROWINGS` | การยืมอุปกรณ์ |
| `REPAIR_REQUESTS_KV` | `TCC_REPAIR_REQUESTS` | การแจ้งซ่อมอุปกรณ์ไอที |

> ⚠️ **ต้องสร้าง KV Namespace `TCC_REPAIR_REQUESTS` และ bind เป็น `REPAIR_REQUESTS_KV` ใน Worker ก่อนใช้งานระบบแจ้งซ่อม** (Dashboard → Workers & Pages → tcc-line-notifier → Settings → Bindings)

### Keys ภายใน KV

| Key | ข้อมูล |
|---|---|
| `rooms_data` | `Booking[]` — การจองห้องทั้งหมด |
| `equipment_data` | `BorrowingRequest[]` — การยืมอุปกรณ์ทั้งหมด |
| `repairs_data` | `RepairRequest[]` — การแจ้งซ่อมอุปกรณ์ไอทีทั้งหมด |
| `recipient:<id>` | `"1"` — 1 key ต่อ LINE User/Group ID 1 ตัวที่รับแจ้งเตือน (v2.3 ขึ้นไป) |
| `recipient_ids` | (เดิม ก่อน v2.3) `string[]` — เก็บไว้เป็น legacy สำหรับ migrate ครั้งแรกเท่านั้น |

### วิธี Backup ข้อมูล (ทำเป็นประจำ!)

```bash
# ดึงข้อมูลการจองห้อง
curl -H "X-API-Key: [API_SECRET_KEY]" \
  https://tcc-line-notifier.media-tcc.workers.dev/data?type=rooms

# ดึงข้อมูลการยืมอุปกรณ์
curl -H "X-API-Key: [API_SECRET_KEY]" \
  https://tcc-line-notifier.media-tcc.workers.dev/data?type=equipment

# ดึงข้อมูลการแจ้งซ่อมอุปกรณ์ไอที
curl -H "X-API-Key: [API_SECRET_KEY]" \
  https://tcc-line-notifier.media-tcc.workers.dev/data?type=repairs
```

> บันทึก JSON ที่ได้ไว้ใน Google Drive หรือ Sheets เป็นประจำ

---

## 🔔 ระบบแจ้งเตือน LINE

### ภาพรวม

```
ผู้ใช้จอง → Frontend → POST /notify → Worker → LINE API → มือถือเจ้าหน้าที่
```

### วิธีเพิ่มคนรับแจ้งเตือน

**วิธีอัตโนมัติ (แนะนำ):**
1. เพิ่มเพื่อน LINE Official Account ของระบบ
2. Worker รับ Webhook event `follow` แล้วบันทึก userId ลง KV อัตโนมัติ

**วิธี manual:**
1. Cloudflare Dashboard → KV → `TCC_ROOM_BOOKINGS`
2. สร้าง key ใหม่ชื่อ `recipient:<LINE User/Group ID>` ค่าอะไรก็ได้ เช่น `1`

> ⚠️ ตั้งแต่ v2.3 เปลี่ยนจากเก็บเป็น array ก้อนเดียวใน `recipient_ids` มาเป็น 1 key ต่อ 1 ผู้รับ
> (`recipient:<id>`) เพื่อแก้บั๊กที่ผู้รับบางคนหายไปเงียบๆ เวลามีหลาย webhook event (join/leave/
> follow/unfollow) เข้ามาพร้อมกัน — ข้อมูลเก่าจะถูก migrate มาเป็น key แยกให้อัตโนมัติ ไม่ต้องทำอะไรเพิ่ม

### แจ้งเตือนอัตโนมัติ (Cron)

Worker มี `scheduled()` ส่งสรุปการจองทุกเช้า  
ตั้งค่า Cron: Dashboard → tcc-line-notifier → Settings → Triggers  
แนะนำ: `0 1 * * *` (01:00 UTC = 08:00 น. ไทย)

---

## 🔐 Environment Variables

### Cloudflare Worker Settings

| ชื่อตัวแปร | ใช้ทำอะไร |
|---|---|
| `ADMIN_PASSWORD` | รหัสผ่านโหมดเจ้าหน้าที่ |
| `API_SECRET_KEY` | Key สำหรับ Frontend เรียก API (ต้องตรงกับ Pages) |
| `CHANNEL_ACCESS_TOKEN` | LINE Bot Long-lived Token |
| `CHANNEL_SECRET` | LINE Channel Secret |
| `RECIPIENT_ID` | LINE User ID สำรอง |

### Cloudflare Pages Settings

| ชื่อตัวแปร | ใช้ทำอะไร |
|---|---|
| `VITE_API_SECRET_KEY` | ต้องตรงกับ `API_SECRET_KEY` ใน Worker |

---

## 🚀 การ Deploy

### Frontend (Cloudflare Pages)

```bash
npm run build      # สร้างไฟล์ใน dist/
# แล้ว drag dist/ ไปที่ Cloudflare Pages Dashboard
# หรือใช้ GitHub Integration (auto deploy เมื่อ push)
```

### Backend (Cloudflare Worker)

1. เปิด Cloudflare Dashboard → Workers & Pages → `tcc-line-notifier`
2. คลิก **Edit code**
3. วาง code จาก `cloudflare-worker.js`
4. คลิก **Deploy**
5. ทดสอบ: `GET /status` ต้องได้ค่า `true` ทุกฟิลด์

---

## 📡 API Endpoints

| Method | Path | Auth | ทำอะไร |
|---|---|---|---|
| GET | `/status` | ไม่ต้อง | ตรวจสอบ Worker |
| POST | `/auth/login` | ไม่ต้อง | ล็อกอิน Admin |
| POST | `/webhook` | ไม่ต้อง | LINE Webhook |
| GET | `/data?type=rooms` | X-API-Key | ดึงข้อมูลการจอง |
| POST | `/data?type=rooms` | X-API-Key | บันทึกข้อมูลการจอง |
| GET | `/data?type=equipment` | X-API-Key | ดึงข้อมูลการยืม |
| POST | `/data?type=equipment` | X-API-Key | บันทึกข้อมูลการยืม |
| GET | `/data?type=repairs` | X-API-Key | ดึงข้อมูลการแจ้งซ่อม |
| POST | `/data?type=repairs` | X-API-Key | บันทึกข้อมูลการแจ้งซ่อม |
| POST | `/notify` | X-API-Key | ส่ง LINE แจ้งเตือน |
| GET | `/recipients` | X-API-Key | ดู LINE recipients |

---

## 🛠️ สิ่งที่ต้องทำต่อ (TODO)

- [ ] เปลี่ยน `prompt()` เป็น Modal login สำหรับ Admin
- [ ] เพิ่ม `sessionStorage` เก็บ admin state ไว้เมื่อ refresh
- [ ] รวม `ROOM_METADATA` ใน `HomePage.tsx` กลับมาที่ `constants.ts`
- [ ] ลบ `console.log(API Key)` ใน `apiService.ts` (security)
- [ ] ลบ debug log ใน `index.tsx`
- [ ] แก้ Date loop bug ใน `handleBookingUpdate` (clone ก่อน iterate)
- [ ] เปลี่ยน `alert/confirm` เป็น Modal ใน `MyBookingsPage`
- [ ] เพิ่ม search/filter ใน `MyBookingsPage`
- [ ] ย้าย Tailwind จาก CDN มาเป็น Vite build pipeline
- [ ] เพิ่ม React Error Boundary

---

## ⚠️ สิ่งที่ห้ามทำ

- **ห้ามลบ KV Namespace** `TCC_ROOM_BOOKINGS`, `TCC_EQUIPMENT_BORROWINGS` หรือ `TCC_REPAIR_REQUESTS`
- **ห้าม commit** ไฟล์ `.env.local` ขึ้น GitHub
- **ห้าม hardcode** รหัสผ่านหรือ token ในโค้ด
- **ห้ามเปลี่ยน** `id` ของห้องใน `ROOMS` array หากมีข้อมูลการจองอยู่แล้ว
