// ============================================================================
// ocpp-test-server.js
// OCPP 1.6J (JSON over WebSocket) test Central System (CSMS) แบบ minimal
// ใช้พิสูจน์ว่าตู้ Schneider EVlink ต่อเข้ามาได้จริง — log ทุกข้อความที่ตู้ส่งมา
// รันได้ทั้ง Railway / Render / Fly.io / VPS / เครื่อง local
//
// --- ขึ้น Railway (แนะนำ) ---
//   1) push โฟลเดอร์นี้ขึ้น GitHub (มี ocpp-test-server.js + package.json)
//   2) Railway → New Project → Deploy from GitHub repo
//   3) Railway จะให้ URL มา เช่น  https://xxx.up.railway.app
//      => Supervision URL ที่ตู้ใช้:  wss://xxx.up.railway.app/ocpp
//   (Railway กำหนด PORT มาเองผ่าน env — โค้ดนี้อ่านให้แล้ว ไม่ต้องแก้)
//
// --- รัน local / VPS ---
//   npm install ws
//   node ocpp-test-server.js          (default port 9000)
//   PORT=80 node ocpp-test-server.js  (กำหนด port เองได้)
//
// ดู log: ถ้าเห็น "[CONNECT]" ตามด้วย "[<- BootNotification]" = ต่อติด 100%
// ============================================================================

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 9000;

// HTTP server (ไว้ตอบ health check ของ Railway + เปิดดูในเบราว์เซอร์ว่ายังรันอยู่)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('OCPP 1.6J test server is running. Connect a charge point via WebSocket at /ocpp\n');
});

// WebSocket server ผูกกับ HTTP server เดียวกัน
const wss = new WebSocketServer({
  server,
  // ตู้ OCPP จะขอ subprotocol 'ocpp1.6' — ต้อง negotiate ให้ ไม่งั้น handshake ไม่ผ่าน
  handleProtocols: (protocols) => (protocols.has('ocpp1.6') ? 'ocpp1.6' : false),
});

let txCounter = 1000;

wss.on('connection', (ws, req) => {
  const cpId = decodeURIComponent((req.url || '/').split('/').filter(Boolean).pop() || '?');
  console.log(`✅ [CONNECT] charge point ต่อเข้ามาแล้ว`);
  console.log(`            chargePointId = ${cpId}`);
  console.log(`            path          = ${req.url}`);
  console.log(`            subprotocol   = ${ws.protocol}`);
  console.log(`            remote        = ${req.socket.remoteAddress}\n`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.log('   [WARN] ข้อความไม่ใช่ JSON:', data.toString());
      return;
    }

    const [type, id, action, payload] = msg; // OCPP-J CALL = [2, uniqueId, action, payload]

    if (type !== 2) {
      console.log('   [<-] non-CALL message:', JSON.stringify(msg));
      return;
    }

    console.log(`   [<- ${action}]`, JSON.stringify(payload));

    const now = new Date().toISOString();
    let resp = {};

    switch (action) {
      case 'BootNotification':
        resp = { status: 'Accepted', currentTime: now, interval: 300 };
        break;
      case 'Heartbeat':
        resp = { currentTime: now };
        break;
      case 'Authorize':
        resp = { idTagInfo: { status: 'Accepted' } };
        break;
      case 'StartTransaction':
        resp = { transactionId: ++txCounter, idTagInfo: { status: 'Accepted' } };
        break;
      case 'StopTransaction':
        resp = { idTagInfo: { status: 'Accepted' } };
        break;
      case 'StatusNotification':
      case 'MeterValues':
        resp = {};
        break;
      case 'DataTransfer':
        resp = { status: 'Accepted' };
        break;
      default:
        resp = {}; // ตอบ empty กันตู้ค้าง
    }

    ws.send(JSON.stringify([3, id, resp])); // CALLRESULT = [3, uniqueId, payload]
    console.log(`   [-> ${action}.conf]`, JSON.stringify(resp), '\n');
  });

  ws.on('close', (code) => console.log(`❌ [DISCONNECT] code=${code}\n`));
  ws.on('error', (e) => console.log('   [ERROR]', e.message));
});

server.listen(PORT, () => {
  console.log('============================================================');
  console.log(` OCPP 1.6J test server listening on port ${PORT}`);
  console.log(' รอตู้ต่อเข้ามา... (ตั้ง Supervision URL ที่ตู้แล้วกด Reboot)');
  console.log('============================================================\n');
});
