# EvCharger CSMS (NestJS)

OCPP 1.6J Central System (CSMS) + REST API for the **LINE Mini App**.
Talks OCPP 1.6J over WebSocket to the Schneider **EVlink** charger, and exposes a REST API
the LIFF front-end calls to show status and start/stop charging.

```
LINE Mini App (LIFF) ──REST──> EvCharger CSMS (this) ──OCPP 1.6J/WebSocket──> Schneider EVlink
```

This is a **runnable scaffold**: state is kept in memory so it starts with zero setup.
Persistence (PostgreSQL) is the next step — schema is in [`db/schema.sql`](db/schema.sql).

## Run locally

```bash
cd csms
npm install
npm run build
npm start            # listens on PORT (default 9000); OCPP at /ocpp
```

Open `http://localhost:9000/` → status JSON. The charger / a simulator connects to
`ws://localhost:9000/ocpp/<ChargePointId>`.

Quick smoke test with the simulator in the repo root:

```bash
node ../test-client.js "ws://localhost:9000/ocpp/EVLINK01"
curl http://localhost:9000/api/chargers
```

## OCPP messages handled (charger → CSMS)
`BootNotification`, `Heartbeat`, `StatusNotification`, `Authorize`,
`StartTransaction`, `StopTransaction`, `MeterValues`, `DataTransfer`.

## OCPP commands the CSMS can send (CSMS → charger)
`RemoteStartTransaction`, `RemoteStopTransaction`, `Reset` (see `OcppServer`).

## REST API (for the LINE LIFF app)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | status / health |
| GET | `/api/chargers` | list chargers + connector status + live sessions |
| GET | `/api/chargers/:id` | one charger |
| POST | `/api/chargers/:id/remote-start` | body `{ connectorId, idTag }` → start charging |
| POST | `/api/chargers/:id/remote-stop` | body `{ transactionId }` → stop charging |

## Deploy to Railway (so the on-site charger connects to it)

The charger is configured to reach `ws://thomas.proxy.rlwy.net:53303/ocpp` (Railway TCP Proxy → port 8080).
To make THIS app the live CSMS, deploy it to the same Railway `evcharger` service:

- Option A: set the Railway service **Root Directory = `csms`** (Settings → Source). Railway runs
  `npm install` → `npm run build` → `npm start`. Keep the TCP Proxy (8080).
- Option B: promote `csms` to the repo root.

The charger keeps its URL — no on-site change needed. It connects via plain `ws://` (the EVlink
can't do `wss://` because its clock resets to 2013 on reboot and fails TLS cert date validation).

## Next steps
1. PostgreSQL: create `db/schema.sql` on the Railway Postgres plugin, wire it via `DATABASE_URL`.
2. LINE: LIFF login (LINE Login) → map `idTag` to the LINE user; LINE Pay for payment.
3. Tariff engine + E-Receipt + Admin dashboard (Command Center) per the project doc.
