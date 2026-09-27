import { Global, Module } from '@nestjs/common';
import { FxSyncJob } from './fx-sync.job.js';
import { FxService } from './fx.service.js';

@Global()
@Module({
  providers: [FxService, FxSyncJob],
  exports: [FxService],
})
export class FxModule {}
