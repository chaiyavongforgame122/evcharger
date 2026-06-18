import { Injectable } from '@nestjs/common';

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
 * In-memory store of charger state — good enough to run and demo end-to-end.
 * Next step: back this with PostgreSQL (see db/schema.sql) without changing the API.
 */
@Injectable()
export class ChargersService {
  private chargers = new Map<string, Charger>();

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
  }

  stopTransaction(id: string, transactionId: number, meterStop: number) {
    const c = this.upsert(id);
    const s = c.sessions[transactionId];
    if (s && typeof meterStop === 'number') s.meterLast = meterStop;
    // Keep it simple for the scaffold: drop the active session on stop.
    delete c.sessions[transactionId];
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
}
