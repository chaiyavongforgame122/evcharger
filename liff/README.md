# EvCharger — LINE Mini App (LIFF) starter

หน้าเว็บ static หน้าเดียว ([index.html](index.html)) ที่:
- เข้าสู่ระบบด้วย **LINE Login (LIFF)** — ได้ `userId` มาใช้เป็น `idTag`
- ดึงสถานะตู้จาก CSMS (`GET /api/chargers`) แสดงหัวชาร์จ + สถานะ (refresh ทุก 5 วิ)
- ปุ่ม **เริ่มชาร์จ / หยุดชาร์จ** → เรียก `POST /api/chargers/:id/remote-start | remote-stop`

ไม่มี build step — เปิดไฟล์ในเบราว์เซอร์ได้เลย (โหมด dev จะข้าม login)

## ตั้งค่า (แก้ 2 ค่าใน `index.html`)
```js
const CONFIG = {
  LIFF_ID: 'YOUR_LIFF_ID',   // จาก LINE Developers
  API_BASE: 'https://evcharger-production-7271.up.railway.app',
};
```

## วิธีทำให้ใช้งานจริงบน LINE
1. ไป [LINE Developers Console](https://developers.line.biz/) → สร้าง **Provider** → **LINE Login channel**
2. ในแชนแนล → แท็บ **LIFF** → **Add** → ตั้ง:
   - **Endpoint URL** = URL ที่โฮสต์ `index.html` (เช่น Vercel/Netlify/GitHub Pages)
   - **Size** = Full, **Scope** = `profile`, `openid`
3. ก๊อป **LIFF ID** มาใส่ `CONFIG.LIFF_ID`
4. โฮสต์ `index.html` (เลือกอย่างใดอย่างหนึ่ง):
   - **Vercel/Netlify**: ลากโฟลเดอร์ `liff/` ขึ้น (static) — ฟรี
   - **GitHub Pages**: เปิด Pages ชี้โฟลเดอร์นี้
5. เปิด LIFF URL (`https://liff.line.me/<LIFF_ID>`) ในแอป LINE → login → เห็นสถานะตู้ + กดเริ่ม/หยุดได้

## พัฒนาบนเครื่อง (ไม่ต้องมี LINE)
เปิด `index.html` ในเบราว์เซอร์ตรงๆ (หรือ `npx serve liff`) — ถ้ายังไม่ตั้ง `LIFF_ID` จะข้าม login
และเรียก API production ได้เลย (ดูสถานะตู้จริง). ปุ่มเริ่ม/หยุดจะสั่งตู้จริง — ระวังตอนมีรถเสียบ

## ต่อยอด (ตาม roadmap)
- หน้าจ่ายเงิน (LINE Pay) + E-Receipt
- จองคิว / Wallet (Phase 2)
- โหมด real-time charging (kWh + ค่าใช้จ่าย) จาก MeterValues
