import { Controller, Get } from '@nestjs/common';
import { ChargersService } from './chargers/chargers.service';

@Controller()
export class AppController {
  constructor(private readonly chargers: ChargersService) {}

  // Simple status page / health check — open the Railway URL in a browser to see it's alive.
  @Get()
  root() {
    return {
      name: 'EvCharger CSMS',
      status: 'running',
      persistence: this.chargers.persistence, // 'postgres' or 'in-memory'
      ocpp: 'OCPP 1.6J WebSocket at /ocpp',
      chargersConnected: this.chargers.list().filter((c) => c.online).length,
      api: [
        '/api/chargers',
        '/api/chargers/:id',
        'POST /api/chargers/:id/remote-start',
        'POST /api/chargers/:id/remote-stop',
        '/api/transactions',
      ],
    };
  }

  @Get('health')
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  // Charging history (from PostgreSQL; empty when running in-memory).
  @Get('api/transactions')
  transactions() {
    return this.chargers.recentTransactions();
  }
}
