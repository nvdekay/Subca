import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { validateEnv } from './config/env.js';
import { FxModule } from './fx/fx.module.js';
import { HealthController } from './health/health.controller.js';
import { HomeModule } from './home/home.module.js';
import { MeModule } from './me/me.module.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { PlanModule } from './plan/plan.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    PlanModule,
    FxModule,
    AuthModule,
    MeModule,
    CatalogModule,
    SubscriptionsModule,
    HomeModule,
    PaymentMethodsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
