import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface Connector {
  connectorId: number;
  status: string; // Available | Preparing | Charging | SuspendedEV | Finishing | Faulted | Unavailable ...
  errorCode?: string;
  updatedAt: string;
}

export interface Session {
  transactionId: number;
  connectorId: number;
  idTag: string;
  meterStart: number;
  meterLast: number;
  startedAt: string;
  meterValues: any[];
}

export interface Charger {
  id: string;
  online: boolean;
  remoteAddress?: string;
  vendor?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  bootedAt?: string;
  lastHeartbeat?: string;
  connectors: Record<number, Connector>;
  sessions: Record<number, Session>; // active sessions keyed by transactionId
}

/**
 * Live charger state is kept in memory (it's rebuilt whenever the charger reconnects).
 * Durable data — the charger registry and charging transactions — is also written to
 * PostgreSQL when DbService is enabled (DATABASE_URL set). DB writes are best-effort and
 * never block or break the OCPP flow.
 */
@Injectable()
export class ChargersService {
  private chargers = new Map<string, Charger>();

  constructor(private readonly db: DbService) {}

  private upsert(id: string): Charger {
    let c = this.chargers.get(id);
    if (!c) {
      c = { id, online: false, connectors: {}, sessions: {} };
      this.chargers.set(id, c);
    }
    return c;
  }

  markOnline(id: string, remoteAddress?: string) {
    const c = this.upsert(id);
    c.online = true;
    c.remoteAddress = remoteAddress;
  }

  markOffline(id: string) {
    this.upsert(id).online = false;
  }

  setBootInfo(id: string, p: any) {
    const c = this.upsert(id);
    c.vendor = p.chargePointVendor;
    c.model = p.chargePointModel;
    c.firmwareVersion = p.firmwareVersion;
    c.serialNumber = p.chargeBoxSerialNumber || p.chargePointSerialNumber;
    c.bootedAt = new Date().toISOString();
    void this.db.query(
      `INSERT INTO chargers (id, vendor, model, firmware, serial_number, last_seen)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (id) DO UPDATE SET vendor=$2, model=$3, firmware=$4, serial_number=$5, last_seen=now()`,
      [id, c.vendor, c.model, c.firmwareVersion, c.serialNumber],
    );
  }

  heartbeat(id: string) {
    this.upsert(id).lastHeartbeat = new Date().toISOString();
  }

  setConnectorStatus(id: string, connectorId: number, status: string, errorCode?: string) {
    const c = this.upsert(id);
    c.connectors[connectorId] = { connectorId, status, errorCode, updatedAt: new Date().toISOString() };
  }

  startTransaction(id: string, connectorId: number, transactionId: number, idTag: string, meterStart: number) {
    const c = this.upsert(id);
    c.sessions[transactionId] = {
      transactionId,
      connectorId,
      idTag,
      meterStart: meterStart || 0,
      meterLast: meterStart || 0,
      startedAt: new Date().toISOString(),
      meterValues: [],
    };
    void this.db.query(
      `INSERT INTO transactions (ocpp_tx_id, charger_id, connector_id, id_tag, meter_start_wh, status)
       VALUES ($1,$2,$3,$4,$5,'active')`,
      [transactionId, id, connectorId, idTag, meterStart || 0],
    );
  }

  stopTransaction(id: string, transactionId: number, meterStop: number) {
    const c = this.upsert(id);
    const s = c.sessions[transactionId];
    if (s && typeof meterStop === 'number') s.meterLast = meterStop;
    delete c.sessions[transactionId];
    void this.db.query(
      `UPDATE transactions SET status='completed', meter_stop_wh=$1, stopped_at=now()
       WHERE ocpp_tx_id=$2 AND charger_id=$3 AND status='active'`,
      [typeof meterStop === 'number' ? meterStop : null, transactionId, id],
    );
  }

  addMeterValues(id: string, connectorId: number, transactionId: number, meterValue: any[]) {
    const c = this.upsert(id);
    const s = c.sessions[transactionId];
    if (s && Array.isArray(meterValue)) s.meterValues.push(...meterValue);
  }

  list(): Charger[] {
    return [...this.chargers.values()];
  }

  find(id: string): Charger | undefined {
    return this.chargers.get(id);
  }

  // Charging history from PostgreSQL (empty array when running in-memory).
  async recentTransactions(limit = 50): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT id, ocpp_tx_id, charger_id, connector_id, id_tag,
              meter_start_wh, meter_stop_wh,
              COALESCE(meter_stop_wh,0) - COALESCE(meter_start_wh,0) AS energy_wh,
              status, started_at, stopped_at
       FROM transactions ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  get persistence(): 'postgres' | 'in-memory' {
    return this.db.enabled ? 'postgres' : 'in-memory';
  }
}
