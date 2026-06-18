import { Module } from '@nestjs/common';
import { OcppServer } from './ocpp.server';
import { ChargersModule } from '../chargers/chargers.module';

@Module({
  imports: [ChargersModule],
  providers: [OcppServer],
  exports: [OcppServer],
})
export class OcppModule {}
