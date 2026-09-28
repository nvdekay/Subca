import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { validateEnv } from './config/env.js';
import { FxModule } from './fx/fx.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { HealthController } from './health/health.controller.js';
import { HomeModule } from './home/home.module.js';
import { InsightsModule } from './insights/insights.module.js';
import { MeModule } from './me/me.module.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { PlanModule } from './plan/plan.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PushModule } from './push/push.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PlanModule,
    FxModule,
    AuthModule,
    MeModule,
    CatalogModule,
    SubscriptionsModule,
    HomeModule,
    InsightsModule,
    PaymentMethodsModule,
    GroupsModule,
    QueueModule,
    PushModule,
    RemindersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
