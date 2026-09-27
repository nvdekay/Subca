import type { ConfigService } from '@nestjs/config';
import type { ExpoPushReceipt } from 'expo-server-sdk';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PushSender } from '../push/push-sender.js';
import { ReceiptChecker } from './receipt-checker.service.js';

const NOW = new Date('2026-09-27T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function setup(
  rows: { id: string; pushTicketId: string; sentAt: Date }[],
  receipts: Record<string, ExpoPushReceipt>,
) {
  const prisma = {
    reminder: {
      findMany: vi.fn().mockResolvedValue(rows),
      update: vi.fn().mockResolvedValue({}),
    },
    pushToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const push: PushSender = {
    send: vi.fn(),
    getReceipts: vi.fn().mockResolvedValue(receipts),
  };
  const checker = new ReceiptChecker(prisma as unknown as PrismaService, push, {
    get: () => true,
  } as unknown as ConfigService<never, true>);
  return { prisma, push, checker };
}

describe('ReceiptChecker', () => {
  it('mọi biên nhận ok → đánh dấu đã kiểm tra', async () => {
    const { checker, prisma, push } = setup(
      [{ id: 'r1', pushTicketId: 't1,t2', sentAt: minutesAgo(20) }],
      {
        t1: { status: 'ok' },
        t2: { status: 'ok' },
      },
    );
    expect(await checker.check(NOW)).toEqual({
      checked: 1,
      failed: 0,
      tokensRemoved: 0,
    });
    expect(push.getReceipts).toHaveBeenCalledWith(['t1', 't2']);
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { receiptCheckedAt: NOW },
    });
  });

  it('máy đã gỡ app → xóa token; mọi máy đều lỗi → FAILED', async () => {
    const { checker, prisma } = setup(
      [{ id: 'r1', pushTicketId: 't1', sentAt: minutesAgo(20) }],
      {
        t1: {
          status: 'error',
          message: 'gone',
          details: {
            error: 'DeviceNotRegistered',
            expoPushToken: 'ExponentPushToken[x]',
          } as never,
        },
      },
    );
    expect(await checker.check(NOW)).toEqual({
      checked: 1,
      failed: 1,
      tokensRemoved: 1,
    });
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        receiptCheckedAt: NOW,
        status: 'FAILED',
        error: 'RECEIPT:DeviceNotRegistered',
      },
    });
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[x]'] } },
    });
  });

  it('chưa có đủ biên nhận → để lượt sau; quá 24 giờ → đánh dấu đã kiểm tra', async () => {
    const pending = setup(
      [{ id: 'r1', pushTicketId: 't1', sentAt: minutesAgo(20) }],
      {},
    );
    expect((await pending.checker.check(NOW)).checked).toBe(0);
    expect(pending.prisma.reminder.update).not.toHaveBeenCalled();

    const old = setup(
      [{ id: 'r1', pushTicketId: 't1', sentAt: minutesAgo(25 * 60) }],
      {},
    );
    expect((await old.checker.check(NOW)).checked).toBe(1);
  });

  it('không có gì cần kiểm tra → không gọi Expo', async () => {
    const { checker, push } = setup([], {});
    expect(await checker.check(NOW)).toEqual({
      checked: 0,
      failed: 0,
      tokensRemoved: 0,
    });
    expect(push.getReceipts).not.toHaveBeenCalled();
  });
});
