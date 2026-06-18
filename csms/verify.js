// verify.js — end-to-end smoke test against a running CSMS on :9100
// simulates the EVlink: connect -> BootNotification -> StatusNotification,
// then exercises the REST API incl. RemoteStartTransaction round-trip.
const WebSocket = require('ws');
const BASE = 'http://localhost:9100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ws = new WebSocket('ws://localhost:9100/ocpp/EVLINK01', ['ocpp1.6']);
let n = 0;
const call = (action, payload) => {
  const id = 'c' + Date.now() + '-' + ++n;
  ws.send(JSON.stringify([2, id, action, payload]));
};

ws.on('open', async () => {
  console.log('[sim] WS connected to CSMS');
  call('BootNotification', { chargePointVendor: 'Schneider Electric', chargePointModel: 'MONOBLOCK', firmwareVersion: '3.2.0.12', chargeBoxSerialNumber: 'EV.TEST123' });
  await sleep(300);
  call('StatusNotification', { connectorId: 1, errorCode: 'NoError', status: 'Available' });
  call('StatusNotification', { connectorId: 2, errorCode: 'NoError', status: 'Available' });
  await sleep(500);

  console.log('\n=== GET /api/chargers ===');
  console.log(JSON.stringify(await (await fetch(BASE + '/api/chargers')).json(), null, 2));

  console.log('\n=== POST /api/chargers/EVLINK01/remote-start ===');
  const r = await fetch(BASE + '/api/chargers/EVLINK01/remote-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connectorId: 1, idTag: 'LINE-USER-123' }) });
  console.log('HTTP response:', JSON.stringify(await r.json()));

  await sleep(900);
  console.log('\n=== GET /api/chargers/EVLINK01 (after remote-start -> StartTransaction) ===');
  console.log(JSON.stringify(await (await fetch(BASE + '/api/chargers/EVLINK01')).json(), null, 2));

  await sleep(200);
  ws.close();
  process.exit(0);
});

ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m[0] === 2) {
    const [, id, action, payload] = m;
    console.log('[sim] <- CALL from CSMS:', action, JSON.stringify(payload));
    if (action === 'RemoteStartTransaction') {
      ws.send(JSON.stringify([3, id, { status: 'Accepted' }]));
      setTimeout(() => call('StartTransaction', { connectorId: payload.connectorId, idTag: payload.idTag, meterStart: 0, timestamp: new Date().toISOString() }), 150);
    } else {
      ws.send(JSON.stringify([3, id, {}]));
    }
  }
});
ws.on('error', (e) => { console.log('[sim] ERROR', e.message); process.exit(1); });
setTimeout(() => { console.log('[sim] timeout'); process.exit(1); }, 15000);
