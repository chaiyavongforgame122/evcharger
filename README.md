# EVCharger — OCPP 1.6J Test Server

OCPP 1.6J (JSON over WebSocket) test Central System (CSMS) แบบ minimal
สำหรับพิสูจน์ว่าตู้ชาร์จ **Schneider EVlink** เชื่อมต่อ OCPP เข้ามาได้จริง
โดย log ทุกข้อความที่ตู้ส่งเข้ามา

## ความสามารถ

- รองรับ OCPP 1.6J ผ่าน WebSocket (subprotocol `ocpp1.6`)
- ตอบกลับ action หลัก: `BootNotification`, `Heartbeat`, `Authorize`,
  `StartTransaction`, `StopTransaction`, `StatusNotification`, `MeterValues`, `DataTransfer`
- มี HTTP endpoint ไว้ทำ health check และเช็คว่า server ยังรันอยู่

## การรันบนเครื่อง (local)

```bash
npm install
npm start              # default port 9000
# หรือกำหนด port เอง
PORT=80 node ocpp-test-server.js
```

จากนั้นตั้งค่า **Supervision URL** ที่ตู้เป็น:

```
ws://<IP-เครื่องนี้>:9000/ocpp
```

แล้วกด Reboot ที่ตู้ — ถ้าใน log ขึ้น `[CONNECT]` ตามด้วย `[<- BootNotification]` แปลว่าต่อติด 100%

## Deploy ขึ้น Cloud (Railway / Render / Fly.io)

1. push โฟลเดอร์นี้ขึ้น GitHub (มี `ocpp-test-server.js` + `package.json`)
2. สร้าง project ใหม่ → Deploy from GitHub repo
3. ระบบจะให้ URL มา เช่น `https://xxx.up.railway.app`
   → Supervision URL ที่ตู้ใช้คือ `wss://xxx.up.railway.app/ocpp`

(PORT ถูกอ่านจาก environment variable ให้อัตโนมัติ ไม่ต้องแก้โค้ด)

## โครงสร้างไฟล์

- `ocpp-test-server.js` — ตัว server หลัก
- `package.json` — ข้อมูล project + dependency (`ws`)
