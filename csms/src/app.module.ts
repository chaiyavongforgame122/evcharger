import { Module } from '@nestjs/common';
import { ChargersModule } from './chargers/chargers.module';
import { OcppModule } from './ocpp/ocpp.module';
import { AppController } from './app.controller';
import { ChargersController } from './chargers/chargers.controller';

@Module({
  imports: [ChargersModule, OcppModule],
  controllers: [AppController, ChargersController],
})
export class AppModule {}
