import { Injectable, Logger } from '@nestjs/common';
import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ChargersService } from '../chargers/chargers.service';

// OCPP-J framing: CALL=[2,id,action,payload], CALLRESULT=[3,id,payload], CALLERROR=[4,id,code,desc,details]
interface Pending {
  resolve: (v: any) => void;
  reject: (e: any) => void;
  timer: NodeJS.Timeout;
}

@Injectable()
export class OcppServer {
  private readonly logger = new Logger('OCPP');
  private wss: WebSocketServer;
  private sockets = new Map<string, WebSocket>(); // chargePointId -> socket
  private pending = new Map<string, Pending>(); // our outgoing CALL id -> pending promise
  private msgCounter = 0;
  private txCounter = 1000;

  constructor(private readonly chargers: ChargersService) {}

  attach(server: HttpServer) {
    this.wss = new WebSocketServer({
      server,
      // OCPP charge points request the 'ocpp1.6' subprotocol — must be negotiated or the handshake fails.
      handleProtocols: (protocols: Set<string>) =>
        protocols.has('ocpp1.6') ? 'ocpp1.6' : protocols.size ? [...protocols][0] : false,
    });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req as any));
    this.logger.log('OCPP 1.6J WebSocket server attached (path: /ocpp/<ChargePointId>)');
  }

  private onConnection(ws: WebSocket, req: any) {
    const cpId = decodeURIComponent((req.url || '/').split('/').filter(Boolean).pop() || 'UNKNOWN');
    this.sockets.set(cpId, ws);
    this.chargers.markOnline(cpId, req.socket?.remoteAddress);
    this.logger.log(`[CONNECT] ${cpId} from ${req.socket?.remoteAddress} (subprotocol=${ws.protocol})`);

    ws.on('message', (data) => this.onMessage(cpId, ws, data.toString()));
    ws.on('close', (code) => {
      if (this.sockets.get(cpId) === ws) this.sockets.delete(cpId);
      this.chargers.markOffline(cpId);
      this.logger.warn(`[DISCONNECT] ${cpId} code=${code}`);
    });
    ws.on('error', (e) => this.logger.error(`[WS ERROR] ${cpId} ${e.message}`));
  }

  private onMessage(cpId: string, ws: WebSocket, raw: string) {
    let msg: any[];
    try {
      msg = JSON.parse(raw);
    } catch {
      this.logger.warn(`non-JSON from ${cpId}: ${raw}`);
      return;
    }
    const type = msg[0];

    if (type === 2) {
      // CALL from charger -> handle and reply with CALLRESULT
      const [, id, action, payload] = msg;
      this.logger.log(`[<- ${action}] ${cpId} ${JSON.stringify(payload)}`);
      const resp = this.handleCall(cpId, action, payload || {});
      ws.send(JSON.stringify([3, id, resp]));
      this.logger.log(`[-> ${action}.conf] ${cpId} ${JSON.stringify(resp)}`);
    } else if (type === 3) {
      // CALLRESULT -> resolve the matching outgoing CALL
      const [, id, payload] = msg;
      const p = this.pending.get(id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.resolve(payload);
      }
    } else if (type === 4) {
      // CALLERROR
      const [, id, errCode, errDesc] = msg;
      const p = this.pending.get(id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.reject(new Error(`${errCode}: ${errDesc}`));
      }
    }
  }

  private handleCall(cpId: string, action: string, payload: any): any {
    const now = new Date().toISOString();
    switch (action) {
      case 'BootNotification':
        this.chargers.setBootInfo(cpId, payload);
        return { status: 'Accepted', currentTime: now, interval: 300 };
      case 'Heartbeat':
        this.chargers.heartbeat(cpId);
        return { currentTime: now };
      case 'StatusNotification':
        this.chargers.setConnectorStatus(cpId, payload.connectorId, payload.status, payload.errorCode);
        return {};
      case 'Authorize':
        // TODO: validate the idTag against the LINE user / wallet before accepting.
        return { idTagInfo: { status: 'Accepted' } };
      case 'StartTransaction': {
        const transactionId = ++this.txCounter;
        this.chargers.startTransaction(cpId, payload.connectorId, transactionId, payload.idTag, payload.meterStart);
        return { transactionId, idTagInfo: { status: 'Accepted' } };
      }
      case 'StopTransaction':
        this.chargers.stopTransaction(cpId, payload.transactionId, payload.meterStop);
        return { idTagInfo: { status: 'Accepted' } };
      case 'MeterValues':
        this.chargers.addMeterValues(cpId, payload.connectorId, payload.transactionId, payload.meterValue);
        return {};
      case 'DataTransfer':
        return { status: 'Accepted' };
      default:
        this.logger.warn(`Unhandled action '${action}' from ${cpId}`);
        return {};
    }
  }

  // ---------- Outgoing CALLs (CSMS -> charger) ----------

  async sendCall(cpId: string, action: string, payload: any, timeoutMs = 30000): Promise<any> {
    const ws = this.sockets.get(cpId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Charger '${cpId}' is not connected`);
    }
    const id = `srv-${Date.now()}-${++this.msgCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OCPP call '${action}' to '${cpId}' timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify([2, id, action, payload]));
      this.logger.log(`[-> ${action}] ${cpId} ${JSON.stringify(payload)}`);
    });
  }

  remoteStart(cpId: string, connectorId: number, idTag: string) {
    return this.sendCall(cpId, 'RemoteStartTransaction', { connectorId, idTag });
  }

  remoteStop(cpId: string, transactionId: number) {
    return this.sendCall(cpId, 'RemoteStopTransaction', { transactionId });
  }

  reset(cpId: string, type: 'Soft' | 'Hard' = 'Soft') {
    return this.sendCall(cpId, 'Reset', { type });
  }
}
