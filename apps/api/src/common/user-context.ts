import {
  todayInTimeZone,
  type CurrencyCode,
  type IsoDate,
} from '@subca/shared';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_TIMEZONE } from '../subscriptions/subscriptions.service.js';

export interface UserContext {
  currency: CurrencyCode;
  timezone: string;
  /** Hôm nay theo múi giờ người dùng. */
  today: IsoDate;
}

export async function loadUserContext(
  prisma: PrismaService,
  userId: string,
  now = new Date(),
): Promise<UserContext> {
  const s = await prisma.userSettings.findUnique({
    where: { userId },
    select: { currency: true, timezone: true },
  });
  const timezone = s?.timezone ?? DEFAULT_TIMEZONE;
  return {
    currency: (s?.currency ?? 'VND') as CurrencyCode,
    timezone,
    today: todayInTimeZone(timezone, now),
  };
}
