import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretBox } from '../common/secret-box.js';
import type { Env } from '../config/env.js';
import { DetectionModule } from '../detection/detection.module.js';
import { GmailProvider } from '../integrations/mail/gmail.provider.js';
import { MAIL_PROVIDER } from '../integrations/mail/mail-provider.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';
import { EmailSyncScheduler } from './email-sync.scheduler.js';

@Module({
  imports: [DetectionModule],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    EmailSyncScheduler,
    {
      provide: SecretBox,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretBox(config.get('SECRETS_KEY', { infer: true })),
    },
    {
      // Đổi nhà cung cấp hộp thư chỉ cần đổi provider này
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new GmailProvider(
          config.get('GOOGLE_CLIENT_ID', { infer: true }),
          config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
          `${config.get('PUBLIC_API_URL', { infer: true }).replace(/\/+$/, '')}/connections/gmail/callback`,
        ),
    },
  ],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
