// test-client.js — จำลองตู้ OCPP 1.6J ต่อเข้า server เพื่อทดสอบว่า wss ใช้ได้
// ใช้: node test-client.js [url]
const WebSocket = require('ws');

const url = process.argv[2] || 'wss://evcharger-production-7271.up.railway.app/ocpp/TESTPC';
console.log('[client] connecting to', url, 'subprotocol=ocpp1.6');

const ws = new WebSocket(url, ['ocpp1.6'], { handshakeTimeout: 10000 });

const timer = setTimeout(() => {
  console.log('[client] ❌ TIMEOUT — ต่อไม่ติดใน 12 วินาที');
  process.exit(1);
}, 12000);

ws.on('open', () => {
  console.log('[client] ✅ WebSocket OPEN (wss handshake สำเร็จ, subprotocol =', ws.protocol + ')');
  const boot = [2, 'msg-1', 'BootNotification', {
    chargePointVendor: 'Schneider Electric',
    chargePointModel: 'EVlink',
    firmwareVersion: 'test-client',
  }];
  ws.send(JSON.stringify(boot));
  console.log('[client] -> sent BootNotification');
});

ws.on('message', (data) => {
  console.log('[client] <- received:', data.toString());
  clearTimeout(timer);
  console.log('[client] ✅✅ server ตอบกลับแล้ว — Railway wss ทำงาน 100%');
  ws.close();
  setTimeout(() => process.exit(0), 300);
});

ws.on('unexpected-response', (req, res) => {
  console.log('[client] ❌ unexpected HTTP response:', res.statusCode, res.statusMessage);
  process.exit(1);
});

ws.on('error', (err) => {
  console.log('[client] ❌ ERROR:', err.message);
  process.exit(1);
});
