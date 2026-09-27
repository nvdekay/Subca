import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import type { Env } from '../config/env.js';
import { AccountStatusService } from './account-status.service.js';
import { AuthGuard } from './auth.guard.js';
import { SupabaseAdminClient } from './supabase-admin.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

/** Toàn cục: guard, xác minh token, trạng thái tài khoản và Supabase Admin dùng ở nhiều module. */
@Global()
@Module({
  providers: [
    {
      provide: SupabaseJwtVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const base = config
          .get('SUPABASE_URL', { infer: true })
          .replace(/\/+$/, '');
        // jose tự cache khóa và tải lại khi gặp `kid` mới (Supabase xoay vòng khóa)
        const jwks = createRemoteJWKSet(
          new URL(`${base}/auth/v1/.well-known/jwks.json`),
          {
            cacheMaxAge: 10 * 60 * 1000,
            cooldownDuration: 30 * 1000,
          },
        );
        return new SupabaseJwtVerifier(jwks, `${base}/auth/v1`);
      },
    },
    AccountStatusService,
    {
      provide: SupabaseAdminClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SupabaseAdminClient(
          config.get('SUPABASE_URL', { infer: true }),
          config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
        ),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SupabaseJwtVerifier, AccountStatusService, SupabaseAdminClient],
})
export class AuthModule {}
