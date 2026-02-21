# Card Sections

โครงสร้างการ์ดถูกแยกเป็น section เพื่อให้ง่ายต่อการค้นหาและปรับสมดุลรายหมวด โดยตั้งใจให้แต่ละไฟล์มีขนาดประมาณ 300-400 บรรทัด

## โฟลเดอร์สำคัญ

- `src/data/cards.alpha.first20.json`
  - เป็น manifest หลักของชุดการ์ด
  - เก็บ metadata และรายการ section ทั้งหมด
- `src/data/cards/sections/*.json`
  - ไฟล์ section จริงที่เก็บข้อมูลการ์ด
  - รูปแบบชื่อไฟล์:
    - `NN.kind-or-deck.faction.card-type.PP.json`
    - ตัวอย่าง: `25.deck.neutral.spell-generic.01.json`
- `src/data/card-set.ts`
  - รวมทุก section ให้กลายเป็น `cardSet.cards` สำหรับระบบเกม/API

## แนวทางแก้การ์ด

1. เปิด manifest (`cards.alpha.first20.json`) เพื่อหา section ที่ต้องการ
2. แก้ค่าการ์ดในไฟล์ section นั้นโดยตรง
3. คงรูปแบบ fields ให้ตรง schema เดิม (`docs/card.schema.json`)
4. รัน `npm run lint` และ `npm run build` เพื่อตรวจความถูกต้อง

## หมายเหตุ

- ห้ามแก้ `id` การ์ดซ้ำหรือชนกัน
- ถ้าจะเพิ่มการ์ดใหม่ ให้เพิ่มใน section ที่ตรงเงื่อนไข (kind/faction/cardType) ก่อน
