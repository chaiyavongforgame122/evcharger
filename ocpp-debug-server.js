// ocpp-debug-server.js
// OCPP 1.6J server แบบ verbose — log "ทุกอย่าง" เพื่อ debug ว่าตู้ส่งอะไรเข้ามาบ้าง
// log: ทุก HTTP request, ทุก WebSocket upgrade attempt (path + subprotocol + headers),
//      ทุก error, ทุกข้อความ OCPP  — รันแทน ocpp-test-server.js ชั่วคราวตอนไล่ปัญหา
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 9000;
const ts = () => new Date().toISOString();

const server = http.createServer((req, res) => {
  console.log(`\n🌐 [HTTP ${ts()}] ${req.method} ${req.url}  from ${req.socket.remoteAddress}`);
  console.log(`            headers: ${JSON.stringify(req.headers)}`);
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('OCPP 1.6J DEBUG server running. WS at /ocpp\n');
});

// log "ทุก" upgrade attempt ก่อนที่ ws จะจัดการ — เห็นแม้ handshake จะล้มทีหลัง
server.on('upgrade', (req, socket) => {
  console.log(`\n🔼 [UPGRADE ${ts()}] url=${req.url}  from ${socket.remoteAddress}`);
  console.log(`            sec-websocket-protocol = ${req.headers['sec-websocket-protocol']}`);
  console.log(`            sec-websocket-version  = ${req.headers['sec-websocket-version']}`);
  console.log(`            host=${req.headers.host}  origin=${req.headers.origin}  ua=${req.headers['user-agent']}`);
});

server.on('clientError', (err, socket) => {
  console.log(`\n⚠️ [clientError ${ts()}] ${err.message}`);
  try { socket.destroy(); } catch {}
});

const wss = new WebSocketServer({
  server,
  // รับ subprotocol แบบใจกว้าง: ชอบ 'ocpp1.6' ก่อน, ถ้าตู้ขอชื่ออื่นก็รับตัวแรกที่ขอมา
  handleProtocols: (protocols) => {
    const offered = Array.from(protocols);
    console.log(`            [handleProtocols] offered = ${JSON.stringify(offered)}`);
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    if (offered.length) {
      console.log(`            [handleProtocols] ไม่มี 'ocpp1.6' — รับตัวแรกที่ขอมาแทน: ${offered[0]}`);
      return offered[0];
    }
    console.log(`            [handleProtocols] ตู้ไม่ขอ subprotocol เลย — ปล่อยผ่านไม่ใส่ header`);
    return false;
  },
});

wss.on('error', (e) => console.log(`\n❌ [wss error ${ts()}] ${e.message}`));

let txCounter = 1000;

wss.on('connection', (ws, req) => {
  const cpId = decodeURIComponent((req.url || '/').split('/').filter(Boolean).pop() || '?');
  console.log(`\n✅ [CONNECT ${ts()}] chargePointId=${cpId}  path=${req.url}  subprotocol=${ws.protocol}  remote=${req.socket.remoteAddress}`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); }
    catch { console.log('   [WARN] non-JSON:', data.toString()); return; }
    const [type, id, action, payload] = msg;
    if (type !== 2) { console.log('   [<- non-CALL]', JSON.stringify(msg)); return; }
    console.log(`   [<- ${action}]`, JSON.stringify(payload));

    const now = ts();
    let resp = {};
    switch (action) {
      case 'BootNotification':  resp = { status: 'Accepted', currentTime: now, interval: 300 }; break;
      case 'Heartbeat':         resp = { currentTime: now }; break;
      case 'Authorize':         resp = { idTagInfo: { status: 'Accepted' } }; break;
      case 'StartTransaction':  resp = { transactionId: ++txCounter, idTagInfo: { status: 'Accepted' } }; break;
      case 'StopTransaction':   resp = { idTagInfo: { status: 'Accepted' } }; break;
      case 'StatusNotification':
      case 'MeterValues':       resp = {}; break;
      case 'DataTransfer':      resp = { status: 'Accepted' }; break;
      default:                  resp = {};
    }
    ws.send(JSON.stringify([3, id, resp]));
    console.log(`   [-> ${action}.conf]`, JSON.stringify(resp));
  });

  ws.on('close', (code, reason) => console.log(`\n❌ [DISCONNECT ${ts()}] code=${code} reason=${reason || ''}`));
  ws.on('error', (e) => console.log('   [ws ERROR]', e.message));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log(` OCPP 1.6J DEBUG server listening on 0.0.0.0:${PORT}`);
  console.log(' จะ log ทุก HTTP request + ทุก upgrade + ทุกข้อความ');
  console.log('============================================================');
});
