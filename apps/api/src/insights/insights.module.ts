import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { CalendarService } from './calendar.service.js';
import { InsightsController } from './insights.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [InsightsController],
  providers: [CalendarService, ReviewsService, AnalyticsService],
})
export class InsightsModule {}
