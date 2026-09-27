import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  CalendarQuerySchema,
  ReviewQuerySchema,
  SetReviewDecisionSchema,
  type AnalyticsDto,
  type CalendarDto,
  type CalendarQuery,
  type ReviewDto,
  type ReviewQuery,
  type SetReviewDecision,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AnalyticsService } from './analytics.service.js';
import { CalendarService } from './calendar.service.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class InsightsController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly reviews: ReviewsService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Lịch gia hạn của một tháng (mặc định tháng hiện tại theo múi giờ người dùng). */
  @Get('calendar')
  getCalendar(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(CalendarQuerySchema)) query: CalendarQuery,
  ): Promise<CalendarDto> {
    return this.calendar.month(user.id, query.month);
  }

  @Get('reviews')
  getReviews(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQuery,
  ): Promise<ReviewDto> {
    return this.reviews.get(user.id, query.period);
  }

  /** Đặt quyết định Giữ / Xem lại / Hủy cho một gói; trả về cả bản đánh giá tháng đã cập nhật. */
  @Put('reviews/:subscriptionId')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId', uuidParam) subscriptionId: string,
    @Body(new ZodValidationPipe(SetReviewDecisionSchema))
    body: SetReviewDecision,
  ): Promise<ReviewDto> {
    return this.reviews.decide(user.id, subscriptionId, body);
  }

  @Delete('reviews/:subscriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearDecision(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId', uuidParam) subscriptionId: string,
    @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQuery,
  ): Promise<void> {
    return this.reviews.clear(user.id, subscriptionId, query.period);
  }

  @Get('analytics')
  getAnalytics(@CurrentUser() user: AuthUser): Promise<AnalyticsDto> {
    return this.analytics.get(user.id);
  }
}
