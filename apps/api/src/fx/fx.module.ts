import { Global, Module } from '@nestjs/common';
import { FxService } from './fx.service.js';

@Global()
@Module({
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
