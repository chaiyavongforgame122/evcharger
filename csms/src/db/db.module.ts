import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

// Global so DbService is injectable anywhere without re-importing.
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
