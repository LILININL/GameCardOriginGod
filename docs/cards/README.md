# Cards Data Sections

เอกสารชุดการ์ดถูกแยกเป็น section files ตามหมวด เพื่อให้ง่ายต่อการแก้ค่า balance ในอนาคต

## โครงสร้าง

- `docs/cards.alpha.first20.json`
  - manifest ของชุดการ์ดและรายการ section
- `docs/cards/sections/*.json`
  - ข้อมูลการ์ดราย section (ไฟล์ละประมาณ 300-400 บรรทัด)

## การใช้งาน

1. ใช้ manifest หา section ที่ต้องแก้
2. ปรับค่าการ์ดในไฟล์ section เป้าหมาย
3. ตรวจความสอดคล้องกับ schema ใน `docs/card.schema.json`
