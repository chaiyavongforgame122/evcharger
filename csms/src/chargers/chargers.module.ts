import { Module } from '@nestjs/common';
import { ChargersService } from './chargers.service';

@Module({
  providers: [ChargersService],
  exports: [ChargersService],
})
export class ChargersModule {}
