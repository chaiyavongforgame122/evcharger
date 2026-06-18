import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ChargersService } from './chargers.service';
import { OcppServer } from '../ocpp/ocpp.server';

/**
 * REST API consumed by the LINE Mini App (LIFF).
 *   GET  /api/chargers                      -> list chargers + connector status + live sessions
 *   GET  /api/chargers/:id                  -> one charger
 *   POST /api/chargers/:id/remote-start     -> start charging (RemoteStartTransaction)
 *   POST /api/chargers/:id/remote-stop      -> stop charging (RemoteStopTransaction)
 */
@Controller('api/chargers')
export class ChargersController {
  constructor(
    private readonly chargers: ChargersService,
    private readonly ocpp: OcppServer,
  ) {}

  @Get()
  list() {
    return this.chargers.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const c = this.chargers.find(id);
    if (!c) throw new NotFoundException(`charger '${id}' not found`);
    return c;
  }

  @Post(':id/remote-start')
  async remoteStart(
    @Param('id') id: string,
    @Body() body: { connectorId?: number; idTag?: string },
  ) {
    const response = await this.ocpp.remoteStart(id, body?.connectorId ?? 1, body?.idTag ?? 'LINE-USER');
    return { sent: true, response };
  }

  @Post(':id/remote-stop')
  async remoteStop(@Param('id') id: string, @Body() body: { transactionId: number }) {
    const response = await this.ocpp.remoteStop(id, body?.transactionId);
    return { sent: true, response };
  }
}
