# apps/web

แอป Next.js สำหรับเกมการ์ด Alumilive (Alpha prototype)

## ฟีเจอร์หลัก
- แท็บ `ห้องเล่นเกม`:
  - Hotseat 2 ผู้เล่น + โหมดเล่นกับ AI (ง่าย/ปานกลาง/ยาก)
  - ปุ่ม action พร้อม tooltip อธิบายเงื่อนไขจริงของเทิร์น
  - ระบบโจมตีแบบเลือกยูนิต -> เลือกเป้าหมาย พร้อม animation
  - เส้นไกด์เป้าหมายโจมตีบนกระดาน (เปิด/ปิดได้)
  - ปุ่มเมนูบนสุดมี hover/active + feedback หลังคลิก
- แท็บ `จัดเด็ค`:
  - จัดเด็ค 24 ใบต่อผู้เล่น
  - auto deck / preset deck / recommended best combo
  - ตรวจเด็คตามกติกาแบบทันที
  - บันทึก config ลง LocalStorage
- แท็บ `ห้องแสดงการ์ด`:
  - แสดงการ์ดชุด Alpha Expanded 124 ใบ
  - ดูรายละเอียดเงื่อนไขและเอฟเฟกต์ผ่าน popup

## ความต้องการระบบ
- Node `24.9.0`
- npm
- nvm

## ติดตั้ง
จาก root โปรเจกต์:
```bash
cd /Users/lilin/Desktop/Alumilive/Ng
source ~/.nvm/nvm.sh
nvm use 24.9.0
npm --prefix apps/web install
```

## รันโหมดพัฒนา
จาก root โปรเจกต์:
```bash
cd /Users/lilin/Desktop/Alumilive/Ng
source ~/.nvm/nvm.sh
nvm use 24.9.0
npm run dev
```

หรือรันจาก `apps/web` ตรง:
```bash
cd /Users/lilin/Desktop/Alumilive/Ng/apps/web
source ~/.nvm/nvm.sh
nvm use 24.9.0
npm run dev
```

เปิดที่ `http://localhost:3000`

## Build / Lint / Start
```bash
cd /Users/lilin/Desktop/Alumilive/Ng
source ~/.nvm/nvm.sh
nvm use 24.9.0
npm run lint
npm run build
npm run start
```

## API ในแอป
- `GET /api/v1/content/version`
- `GET /api/v1/cards?set=ALPHA_001`

## โฟลเดอร์ที่ควรรู้
- `src/app/page.tsx` โครงแท็บหลัก PLAY/DECK/CARDS
- `src/components/GameRoom.tsx` ห้องเล่นเกม + UI interaction ทั้งหมด
- `src/components/DeckBuilder.tsx` ตัวจัดเด็ค
- `src/components/CardGallery.tsx` ห้องแสดงการ์ด
- `src/lib/game/engine.ts` กฎเกมหลัก
- `src/lib/game/ai.ts` logic AI
- `src/data/cards/sections` แหล่งข้อมูลการ์ดแยกตาม section

## Troubleshooting
- Hydration warning ใน dev มักมาจาก browser extension แก้ DOM ก่อน React hydrate
- ให้ทดสอบใน incognito และใช้ Node ให้ตรงเวอร์ชันที่กำหนด
