# Alumilive NG - Alpha Web Prototype

เว็บต้นแบบเกมการ์ด Alumilive สำหรับทดสอบกติกาและ UX ได้ทันทีบนเบราว์เซอร์

## สถานะปัจจุบัน (อัปเดตล่าสุด)
- ห้องเล่นเกม (`PLAY`) เล่นได้จริงตามกติกาหลักแบบ Hotseat
- ห้องจัดเด็ค (`DECK`) มี auto deck, preset deck และบันทึก config ใน LocalStorage
- ห้องแสดงการ์ด (`CARDS`) แสดงชุดการ์ด Alpha Expanded 124 ใบ
- มีโหมดเล่นกับ AI 3 ระดับ: ง่าย / ปานกลาง / ยาก
- มี tooltip อธิบายปุ่ม, popup รายละเอียดการ์ด, และการเลือกเป้าหมายตามเงื่อนไข
- มีเส้นไกด์เป้าหมายโจมตีบนกระดาน (เปิด/ปิดได้)
- มี feedback หลังคลิกปุ่มเมนูบนสุด เพื่อให้ผู้ใช้รู้ว่าคำสั่งทำงานแล้ว
- มี API mock และ SQL schema เตรียมไว้สำหรับต่อ backend จริง

## เทคสแต็ก
- Next.js `16.1.6` (App Router + Turbopack)
- React `19.2.0`
- TypeScript
- Zustand (state ฝั่ง client)
- Tailwind CSS v4

## ความต้องการระบบ
- Node.js `24.9.0` (บังคับให้ใช้เวอร์ชันนี้)
- npm
- nvm

## โครงสร้างโปรเจกต์
- `apps/web` แอป Next.js หลัก
- `apps/web/src/components` UI หลัก (`GameRoom`, `DeckBuilder`, `CardGallery`)
- `apps/web/src/lib/game` game engine, AI, store, explainers
- `apps/web/src/data/cards/sections` ไฟล์การ์ดแบบแบ่ง section
- `docs` เอกสาร schema/spec และตัวอย่างข้อมูล
- `database/schema.sql` โครงสร้างฐานข้อมูล PostgreSQL

## ติดตั้งและรัน (แนะนำจาก root)
```bash
cd /Users/lilin/Desktop/Alumilive/Ng
source ~/.nvm/nvm.sh
nvm use 24.9.0
npm --prefix apps/web install
npm run dev
```

เปิดที่ `http://localhost:3000`

## คำสั่งหลัก
```bash
cd /Users/lilin/Desktop/Alumilive/Ng
source ~/.nvm/nvm.sh
nvm use 24.9.0

npm run lint
npm run build
npm run start
```

## วิธีใช้งานหน้าเว็บแบบเร็ว
1. เข้าแท็บ `จัดเด็ค` เพื่อเลือกเด็คผู้เล่น 1/2 หรือกดใช้เด็คแนะนำ
2. กลับแท็บ `ห้องเล่นเกม`
3. ใช้ปุ่มบนสุดเพื่อเริ่มแมตช์:
   - `เริ่มเกมด้วยชุดที่ตั้งไว้`
   - `รีเซ็ตแมตช์`
   - `เล่นกับ AI (ง่าย/ปานกลาง/ยาก)`
4. เล่นตาม flow: เลือกการ์ด/วางยูนิต/เลือกยูนิตโจมตี/เลือกเป้าหมาย/จบเทิร์น

## สิ่งที่เพิ่มใน GameRoom (สำคัญ)
- โฟกัสกระดานตามเทิร์น: กระดานฝั่งที่ถึงเทิร์นจะแสดงเป็นบล็อกหลักด้านบน
- ไฮไลต์การ์ดที่ลงได้/เล่นได้ในมือชัดเจนขึ้น
- ปุ่ม action ทางขวาพร้อม tooltip อธิบายเงื่อนไขจริงในเทิร์นนั้น:
  - `ใช้อัลติเมต`
  - `ใช้ออร่าแม่ทัพ`
  - `ลงแม่ทัพ`
  - `โจมตีราชา`
  - `จบเทิร์น`
- โหมดเลือกโจมตี/เลือกเป้าหมายมี animation แยกชัดเจน
- เส้นไกด์การโจมตี (SVG overlay) แสดงเส้นจากยูนิตที่เลือกไปยังเป้าหมายที่โจมตีได้จริง
- ปุ่ม `เส้นไกด์โจมตี: เปิด/ปิด` สำหรับปรับมุมมองผู้เล่น
- ปุ่มเมนูบนสุดมีสถานะ hover/active + ข้อความ feedback หลังคลิก

## กติกาและระบบที่รองรับในต้นแบบ
- เทิร์น: จั่ว 1, เพิ่มมานา +1 (สูงสุด 10), ลงการ์ด, โจมตี, จบเทิร์น
- กระดานหน้า/หลัง 3x2 ต่อฝั่ง + ราชา
- ตำแหน่งโจมตีประชิด/ระยะไกลตามกฎที่กำหนด
- ราชา + Ultimate (ใช้ได้ 1 ครั้ง/เกม)
- แม่ทัพ + Aura (`BURST` หรือ `PULSE`)
- Cost แบบมานา + side stack
- ระบบ Human Combo stack
- ระบบเลือกเป้าหมายจากเอฟเฟกต์การ์ดที่ต้องเลือกเอง
- ระบบล็อก input ระหว่างเทิร์น AI

## การ์ด 124 ใบและโครงสร้างไฟล์
- ชุดการ์ดแยกเป็น section เพื่อง่ายต่อการบาลานซ์ภายหลัง
- โฟลเดอร์จริง: `apps/web/src/data/cards/sections`
- ไฟล์อธิบายโครงสร้าง: `apps/web/src/data/cards/README.md`
- Schema การ์ด: `docs/card.schema.json`
- ตัวอย่าง 20 ใบแรก: `docs/cards.alpha.first20.json`

## API Mock
- `GET /api/v1/content/version`
- `GET /api/v1/cards?set=ALPHA_001`

ทดสอบเร็ว:
```bash
curl -s http://localhost:3000/api/v1/content/version
curl -s 'http://localhost:3000/api/v1/cards?set=ALPHA_001' | jq '.cards | length'
```

## เอกสารสเปก
- Card JSON Schema: `docs/card.schema.json`
- API/Event Spec: `docs/api-event-spec.alpha.md`
- แผนการ์ดแบบแบ่ง section: `docs/cards/README.md`

## Database Schema (เตรียมไว้ก่อน)
- ไฟล์: `database/schema.sql`
- ตารางหลัก:
  - `players`, `decks`, `deck_cards`
  - `rooms`, `room_players`
  - `matches`, `match_players`
  - `match_actions`, `match_snapshots`

ตัวอย่าง apply schema:
```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Troubleshooting

### 1) Node เวอร์ชันไม่ตรง
ถ้า build/dev แปลก ให้เช็กว่าใช้ `v24.9.0`
```bash
source ~/.nvm/nvm.sh
nvm use 24.9.0
node -v
```

### 2) Hydration warning/error ใน dev
สาเหตุที่เจอบ่อย:
- browser extension แก้ DOM ก่อน React hydrate (ตัวอย่าง attribute แปลกบน `<body>`)
- client state เปลี่ยนไม่ตรงกับ server snapshot

แนวทาง:
- ทดสอบใน incognito (ปิด extension)
- refresh หน้าใหม่
- ใช้ Node เวอร์ชันที่กำหนด

### 3) ปุ่มกดแล้วเหมือนไม่ทำงาน
ตอนนี้ระบบเพิ่ม feedback หลังคลิกที่หัวห้องเล่นแล้ว:
- ปุ่มจะติดสถานะ active ชั่วคราว
- มีข้อความยืนยันการทำงานใต้แถวปุ่ม

## ข้อจำกัดปัจจุบัน
- ยังเป็น client-side state ไม่ใช่ authoritative multiplayer server
- ยังไม่มี real-time sync ข้ามเครื่องแบบ online PvP
- เหมาะกับ local/hotseat และทดสอบกติกา/UX ก่อนต่อ backend จริง
