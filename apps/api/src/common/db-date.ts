import type { IsoDate } from '@subca/shared';

/** Cột @db.Date ↔ chuỗi YYYY-MM-DD. Prisma trả/nhận ngày dạng Date lúc 00:00 UTC. */
export const toDbDate = (date: IsoDate): Date =>
  new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (date: Date): IsoDate =>
  date.toISOString().slice(0, 10);
