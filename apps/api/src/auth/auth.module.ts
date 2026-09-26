import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import type { Env } from '../config/env.js';
import { AuthGuard } from './auth.guard.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

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
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SupabaseJwtVerifier],
})
export class AuthModule {}
