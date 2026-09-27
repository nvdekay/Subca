import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ExpoPushSender, PUSH_SENDER } from './push-sender.js';
import { PushTokensController } from './push-tokens.controller.js';
import { PushTokensService } from './push-tokens.service.js';

@Global()
@Module({
  controllers: [PushTokensController],
  providers: [
    PushTokensService,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new ExpoPushSender(config.get('EXPO_ACCESS_TOKEN', { infer: true })),
    },
  ],
  exports: [PUSH_SENDER],
})
export class PushModule {}
