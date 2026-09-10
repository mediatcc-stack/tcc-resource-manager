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
| `recipient:<id>` | กลุ่มนั้นรับแจ้งเตือนเรื่องอะไรบ้าง (1 key ต่อ 1 กลุ่ม)<br>`{"topics":["rooms"],"left":null}` — `rooms` = จองห้อง, `repairs` = แจ้งซ่อม<br>`left` ไม่ว่าง = บอทไม่ได้อยู่ในกลุ่มแล้ว (ไม่ลบ key เพื่อให้ Group ID ยังอยู่)<br>ตั้งจากหน้าแอดมินในเว็บได้เลย (ปุ่มเกียร์) ไม่ต้องแก้ KV เอง<br>ค่าเก่ายังอ่านได้: `1`/`on` = รับจองห้อง, `off` = ไม่รับ |
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

แต่ละกลุ่มเลือกได้ว่ารับเรื่องอะไร (จองห้อง / แจ้งซ่อม) — ติ๊กที่ปุ่มเกียร์บนแถบหัวเรื่อง
ในโหมดเจ้าหน้าที่ กลุ่มไหนไม่ติ๊กอะไรเลยก็จะไม่ได้รับแจ้งเตือน
ถ้ายังไม่มีกลุ่มไหนติ๊กหัวข้อนั้นเลย ระบบจะใช้ `RECIPIENT_ID` / `REPAIR_GROUP_ID` เป็นตัวสำรอง
```

### วิธีเพิ่มกลุ่มที่รับแจ้งเตือน

1. เชิญ LINE Official Account ของระบบเข้ากลุ่มที่ต้องการ
2. Worker รับ Webhook event `join` แล้วบันทึก Group ID ลง KV ให้เอง (เริ่มต้นรับ "จองห้อง")
3. เข้าเว็บ → โหมดเจ้าหน้าที่ → ปุ่มเกียร์ → ติ๊กว่ากลุ่มนั้นจะรับเรื่องอะไรบ้าง

> ระบบเก็บเฉพาะ **กลุ่ม** เป็นผู้รับแจ้งเตือน (ตั้งแต่ v2.5) การแอดเพื่อนบอทแบบส่วนตัว
> (event `follow`) ไม่ถูกบันทึกเป็นผู้รับอีกต่อไป

**วิธี manual (ถ้าจำเป็น):** Cloudflare Dashboard → KV → `TCC_ROOM_BOOKINGS` →
สร้าง key `recipient:<Group ID>` ค่า `{"topics":["rooms"],"left":null}`

> ⚠️ ตั้งแต่ v2.3 เปลี่ยนจากเก็บเป็น array ก้อนเดียวใน `recipient_ids` มาเป็น 1 key ต่อ 1 ผู้รับ
> (`recipient:<id>`) เพื่อแก้บั๊กที่ผู้รับบางคนหายไปเงียบๆ เวลามีหลาย webhook event (join/leave/
> follow/unfollow) เข้ามาพร้อมกัน — ข้อมูลเก่าจะถูก migrate มาเป็น key แยกให้อัตโนมัติ ไม่ต้องทำอะไรเพิ่ม

### แจ้งเตือนอัตโนมัติ (Cron) — ❌ ปิดใช้งานแล้ว

เดิม Worker มี `scheduled()` ส่งสรุปการจองเข้ากลุ่มทุกเช้า ตอนนี้เอาออกแล้ว  
ถ้ายังมี Cron Trigger ค้างที่ Dashboard → tcc-line-notifier → Settings → Triggers ให้ลบทิ้งได้เลย  
(`scheduled()` เหลือไว้เป็นตัวเปล่า ๆ เพื่อไม่ให้ trigger ที่ค้างอยู่ error)

ดูรายการจองแทนได้ที่แท็บ **ตารางการจอง** ในเว็บ หรือพิมพ์ `@ชื่อบอท จองวันนี้` ในกลุ่ม

---

## 🔐 Environment Variables

### Cloudflare Worker Settings

| ชื่อตัวแปร | ใช้ทำอะไร |
|---|---|
| `ADMIN_PASSWORD` | รหัสผ่านโหมดเจ้าหน้าที่ |
| `API_SECRET_KEY` | Key สำหรับ Frontend เรียก API (ต้องตรงกับ Pages) |
| `CHANNEL_ACCESS_TOKEN` | LINE Bot Long-lived Token |
| `CHANNEL_SECRET` | LINE Channel Secret — ใช้ตรวจลายเซ็น `/webhook` ⚠️ **ต้องตั้ง** ไม่งั้น Worker จะปฏิเสธทุก event ที่เข้ามา (503) |
| `RECIPIENT_ID` | LINE User ID สำรอง (ใช้เมื่อยังไม่มีผู้รับใน KV) |
| `REPAIR_GROUP_ID` | LINE Group ID ของกลุ่มแจ้งซ่อม (`/notify` target=repair ส่งเข้ากลุ่มนี้เท่านั้น) |
| `ALLOWED_ORIGINS` | *(ไม่บังคับ)* Origin ที่เรียก API ได้ คั่นด้วย comma — ค่าเริ่มต้นครอบคลุม `tcc-media-booking.pages.dev` + preview + localhost ใส่เพิ่มเมื่อย้ายไปโดเมนของวิทยาลัยเอง |
| `ADMIN_TOKEN_SECRET` | *(ไม่บังคับ)* กุญแจเซ็นตั๋วแอดมิน ถ้าไม่ตั้งจะใช้ `ADMIN_PASSWORD` เซ็นแทน — **ควรตั้ง** เพราะถ้าไม่ตั้ง การเปลี่ยนรหัสผ่านจะเตะทุกคนที่ล็อกอินค้างอยู่ออกทันที |

### Cloudflare Pages Settings

| ชื่อตัวแปร | ใช้ทำอะไร |
|---|---|
| `VITE_API_SECRET_KEY` | ต้องตรงกับ `API_SECRET_KEY` ใน Worker |

> ⚠️ `VITE_API_SECRET_KEY` **ไม่ใช่ความลับ** แม้จะชื่อ SECRET — Vite แทนค่าลงในไฟล์ JS
> ตอน build ทุกคนที่เปิดเว็บอ่านได้จาก DevTools อ่านหัวข้อ
> [ข้อจำกัดด้านความปลอดภัย](#-ข้อจำกัดด้านความปลอดภัยที่ยังเหลืออยู่) ก่อนตัดสินใจว่าจะเอาข้อมูลอะไรเข้าระบบนี้

---

## 🚀 การ Deploy

### Frontend (Cloudflare Pages)

```bash
npm run build      # สร้างไฟล์ใน dist/
# แล้ว drag dist/ ไปที่ Cloudflare Pages Dashboard
# หรือใช้ GitHub Integration (auto deploy เมื่อ push)
```

### เพิ่มเว็บลงหน้าจอหลักของโทรศัพท์ (PWA)

ระบบตั้งค่า PWA ไว้แล้ว ผู้ใช้จึงเพิ่มเว็บลงหน้าจอหลักได้เหมือนแอป

*   **Android (Chrome):** เมนู ⋮ → "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"
*   **iPhone (Safari):** ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" (ต้องเปิดผ่าน Safari เท่านั้น)

ไฟล์ที่เกี่ยวข้อง (อยู่ใน `public/` ถูกคัดลอกไป `dist/` ตอน build):

| ไฟล์ | ทำอะไร |
|---|---|
| `manifest.webmanifest` | ชื่อแอป ไอคอน สีธีม และทางลัดไปแต่ละระบบ |
| `sw.js` | Service Worker แบบผ่านตรง **ไม่แคชอะไรเลย** มีไว้ให้ Chrome ยอมให้ติดตั้ง |
| `icon-192.png` / `icon-512.png` | ไอคอนแอปทั่วไป |
| `icon-maskable-512.png` | ไอคอนสำหรับ Android ที่ตัดกรอบเป็นทรงต่างๆ |
| `apple-touch-icon.png` | ไอคอนบน iPhone / iPad |

⚠️ ถ้าจะแก้ `sw.js` ให้แคชไฟล์ ต้องระวังมาก — ระบบนี้ดึงข้อมูลสดจาก Worker
ตลอดเวลา การแคชผิดจุดจะทำให้ผู้ใช้เห็นรายการจอง/ยืม/แจ้งซ่อมเวอร์ชันเก่า

### Backend (Cloudflare Worker)

1. เปิด Cloudflare Dashboard → Workers & Pages → `tcc-line-notifier`
2. คลิก **Edit code**
3. วาง code จาก `cloudflare-worker.js`
4. คลิก **Deploy**
5. ทดสอบ: `GET /status` ต้องได้ค่า `true` ทุกฟิลด์

---

## 📡 API Endpoints

ทุก request ต้องมาจาก Origin ที่อยู่ในรายการ (ดู `ALLOWED_ORIGINS`) และแบ่งสิทธิ์เป็น 3 ชั้น:
**ไม่ต้อง** → **X-API-Key** (คีย์สาธารณะ กันการเรียกแบบสุ่ม) → **+ X-Admin-Token** (ตั๋วที่ต้องล็อกอินก่อน)

| Method | Path | Auth | ทำอะไร |
|---|---|---|---|
| POST | `/auth/login` | ไม่ต้อง | ล็อกอิน Admin → ตอบ `{ success, token, expiresAt }` |
| POST | `/webhook` | ลายเซ็น LINE | LINE Webhook (ไม่มีลายเซ็นที่ถูกต้อง = 401) |
| GET | `/status` | **+ X-Admin-Token** | ตรวจสอบการตั้งค่า Worker |
| GET | `/data?type=rooms` | X-API-Key | ดึงข้อมูลการจอง |
| GET | `/data?type=rooms&version=prev` | X-API-Key | สำเนาก่อนการบันทึกครั้งล่าสุด (ใช้กู้ข้อมูล) |
| POST | `/data?type=rooms` | X-API-Key | บันทึกข้อมูลการจอง |
| GET | `/data?type=equipment` | X-API-Key | ดึงข้อมูลการยืม |
| POST | `/data?type=equipment` | X-API-Key | บันทึกข้อมูลการยืม |
| GET | `/data?type=repairs` | X-API-Key | ดึงข้อมูลการแจ้งซ่อม |
| POST | `/data?type=repairs` | X-API-Key | บันทึกข้อมูลการแจ้งซ่อม |
| POST | `/notify` | X-API-Key | ส่ง LINE แจ้งเตือน — ตอบ `{ success, sent, failed, total }` (`success:false` = ไม่ถึงสักปลายทาง) |
| GET | `/recipients` | **+ X-Admin-Token** | ดูกลุ่มที่รับแจ้งเตือน + หัวข้อที่แต่ละกลุ่มรับ |
| POST | `/recipients` | **+ X-Admin-Token** | ตั้งว่ากลุ่มนี้รับเรื่องอะไร `{ id, topics: ["rooms","repairs"] }` |
| DELETE | `/recipients?id=C...` | **+ X-Admin-Token** | เอากลุ่มออกจากรายการถาวร (ใช้กับกลุ่มที่บอทไม่ได้อยู่แล้ว) |

> `GET /data` ส่ง header `X-Data-Version` กลับมา — `POST /data` ต้องแนบกลับไป
> ถ้าเลขไม่ตรง (มีคนบันทึกแทรก) Worker ตอบ **409** พร้อมข้อมูลล่าสุด แล้ว `saveData()`
> ฝั่งเว็บจะรวมข้อมูลให้เองแล้วส่งใหม่ — ผู้เรียกต้องส่ง `previousData` มาด้วยเสมอ
> `POST /auth/login` จำกัดการเดารหัส 10 ครั้ง/IP/15 นาที (เกินแล้วตอบ 429)
> `POST /data` ปฏิเสธเมื่อรายการหายไปเกินครึ่ง เว้นแต่มีตั๋วแอดมิน (กันลบยกชุด) และจำกัด
> ที่ 5,000 รายการ / 2 MB ต่อครั้ง — `POST /notify` จำกัด 20 ครั้ง/IP/10 นาที สำหรับผู้ใช้ทั่วไป


---

## 🔒 ข้อจำกัดด้านความปลอดภัยที่ยังเหลืออยู่

**อ่านหัวข้อนี้ก่อนตัดสินใจว่าจะเอาข้อมูลอะไรเข้าระบบนี้**

### ใครก็อ่านข้อมูลทั้งหมดได้ ถ้าตั้งใจจริง

ระบบนี้เป็น static site ที่ไม่มีระบบล็อกอินผู้ใช้รายคน (ตั้งใจให้เป็นแบบนั้น —
ครู/นักเรียนจองห้องได้เลยโดยไม่ต้องสมัครสมาชิก) ผลที่ตามมาคือ **`VITE_API_SECRET_KEY`
ต้องอยู่ในไฟล์ JS ที่ทุกคนโหลดไปได้** ไม่มีที่ให้ซ่อน

แปลว่าคนที่เปิด DevTools ก็อปคีย์ไป แล้วเรียก `GET /data?type=rooms` เองได้
ซึ่งจะได้ **ชื่อผู้จอง เบอร์โทรศัพท์ หน่วยงาน และหัวข้อการประชุมทั้งหมด**

สิ่งที่ทำไปแล้วช่วยจำกัดความเสียหาย แต่ไม่ได้ปิดช่องนี้:

| ทำไปแล้ว | กันอะไรได้ | ยังกันไม่ได้ |
|---|---|---|
| CORS allowlist | เว็บอื่นเรียก API แทนผู้ใช้ในเบราว์เซอร์ | คนที่ยิงตรงด้วย `curl` (CORS เป็นกลไกของเบราว์เซอร์เท่านั้น) |
| ตั๋วแอดมิน | ลบ/แก้สถานะ/ย้ายปลายทางแจ้งเตือน | การ**อ่าน**ข้อมูล |
| กันลบยกชุด | ลบข้อมูลทั้งระบบในคำขอเดียว | การเพิ่มรายการขยะทีละน้อย |
| จำกัดความถี่ `/notify` | สแปมกลุ่ม LINE รัวๆ | ข้อความหลอกลวงจำนวนน้อยแต่แนบเนียน |

**ข้อสรุปที่ต้องยอมรับ: อย่าใส่ข้อมูลที่เปิดเผยไม่ได้ลงในระบบนี้**
ถ้าวันหนึ่งจำเป็นต้องเก็บข้อมูลที่อ่อนไหวกว่านี้ ต้องเพิ่มระบบล็อกอินผู้ใช้จริงก่อน
(เช่น Cloudflare Access ผูกกับบัญชี Google ของวิทยาลัย) ไม่ใช่แค่เปลี่ยนคีย์ให้เดายากขึ้น

### เรื่องที่ควรทำต่อ (เรียงตามความคุ้มค่า)

1. **ผูกล็อกอินกับบัญชีของวิทยาลัย** (Cloudflare Access / Google Workspace)
   ปิดช่อง "ใครก็อ่านได้" ได้จริง และเลิกใช้รหัสผ่านแอดมินตัวเดียวที่ทุกคนใช้ร่วมกัน
2. **แยกสิทธิ์ตอนเขียนข้อมูลเป็นรายรายการ** ตอนนี้ `POST /data` เขียนทับทั้ง array
   ถ้าเปลี่ยนเป็น endpoint ต่อรายการ (`POST /bookings`, `PATCH /bookings/:id`) จะบังคับ
   ได้ว่า "แก้ได้เฉพาะรายการของตัวเอง" ซึ่งตอนนี้ทำไม่ได้เลย — ต้องย้ายไป D1 หรือ
   Durable Objects (แก้ปัญหาข้อมูลชนกันที่ยังเหลืออยู่ด้วย)
3. **บันทึก audit log** ว่าใครลบ/แก้อะไรเมื่อไหร่ ตอนนี้ย้อนดูไม่ได้เลยว่ารายการหายเพราะใคร
4. **ย้ายออกจาก `xlsx@0.18.5`** ตัวนี้มีประกาศช่องโหว่และไม่ได้อัปเดตบน npm แล้ว
   ระบบนี้ใช้แค่ `writeFile` (เขียนออกอย่างเดียว ไม่ได้อ่านไฟล์จากผู้ใช้) ความเสี่ยงจึงต่ำ
   แต่ถ้าวันหลังเพิ่มฟีเจอร์ "อัปโหลด Excel" ขึ้นมาเมื่อไหร่ ต้องเปลี่ยนก่อนทันที

### ตรวจ security headers หลัง deploy

ไฟล์ `public/_headers` ตั้ง CSP และ header อื่นๆ ไว้ (Cloudflare Pages อ่านเอง)
หลัง deploy ตรวจได้ที่ https://securityheaders.com

⚠️ CSP ตั้ง `script-src 'self'` ไว้ **ไม่มี `'unsafe-inline'`** ถ้าเพิ่ม inline `<script>`
ลงใน `index.html` เมื่อไหร่ หน้าเว็บจะพังทันที — ให้ย้ายไปไฟล์ `.ts` แล้ว import แทน
อย่าแก้ด้วยการเติม `'unsafe-inline'` เพราะจะทำให้ CSP แทบไม่เหลือประโยชน์

---

## 🧪 ทดสอบ Worker ก่อน Deploy

Worker deploy ด้วยมือผ่าน Dashboard ถ้าโค้ดพังจะรู้ตอนของจริงพังแล้ว — ก่อน deploy ให้รัน

```bash
node scripts/worker-test.mjs     # ต้องได้ "ล้มเหลว 0"
```

จำลอง KV และ LINE API ไว้ในหน่วยความจำ ไม่ยิงเข้า LINE จริงและไม่แตะข้อมูลใน Cloudflare

---

## 🛠️ สิ่งที่ต้องทำต่อ (TODO)

- [x] เปลี่ยน `prompt()` เป็น Modal login สำหรับ Admin
- [x] เก็บสถานะ admin ไว้เมื่อ refresh — ตอนนี้ใช้ตั๋วที่ Worker เซ็น (อายุ 12 ชม.)
- [ ] รวม `ROOM_METADATA` ใน `HomePage.tsx` กลับมาที่ `constants.ts`
- [x] ลบ `console.log(API Key)` ใน `apiService.ts` (security)
- [ ] `VITE_API_SECRET_KEY` ถูกฝังอยู่ในไฟล์ JS ที่ส่งให้เบราว์เซอร์ ใครเปิด DevTools ก็อ่านได้
      → ใครก็เรียก `/data` อ่าน/เขียนทับข้อมูลทั้งก้อน หรือยิง `/notify` เข้ากลุ่ม LINE ได้
      ต้องแก้ด้วยการทำ auth จริง (ล็อกอินแล้วออก token อายุสั้น) ไม่ใช่แค่เปลี่ยน key
- [ ] KV เป็น eventually consistent ไม่ใช่ transaction — ระบบเลขรุ่น (X-Data-Version) ลด
      โอกาสข้อมูลหายลงมาก แต่ถ้าสองคนบันทึกพร้อมกันในวินาทีเดียวจากคนละภูมิภาค
      ยังตรวจไม่เจอ ทางแก้ที่ปิดช่องได้จริงคือย้ายไป Durable Objects หรือ D1
- [ ] `reminderSent` ใน `types.ts` ไม่ถูกใช้ที่ไหนเลย (ตั้งใจทำเตือนล่วงหน้าก่อนถึงเวลาจอง แต่ยังไม่ได้ทำ)
- [ ] `GroupIdFinder.tsx` และ `NotificationSettingsModal.tsx` เป็นไฟล์ว่าง 0 บรรทัด — ลบหรือทำให้เสร็จ
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
