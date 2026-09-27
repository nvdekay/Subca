import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { createRedisConnection } from './redis-connection.js';

/** Kết nối BullMQ tới Redis (REDIS_URL). Dev: docker compose up -d. */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: createRedisConnection(
          config.get('REDIS_URL', { infer: true }),
        ),
        prefix: 'subca',
      }),
    }),
  ],
})
export class QueueModule {}
