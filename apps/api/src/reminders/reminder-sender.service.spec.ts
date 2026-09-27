import type { ExpoPushTicket } from 'expo-server-sdk';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PushSender } from '../push/push-sender.js';
import {
  ReminderSender,
  TransientPushError,
} from './reminder-sender.service.js';

const NOW = new Date('2026-09-27T01:31:00Z');

function reminder(
  over: Record<string, unknown> = {},
  subOver: Record<string, unknown> = {},
  userOver: Record<string, unknown> = {},
) {
  return {
    id: 'r1',
    status: 'PENDING',
    kind: 'RENEWAL',
    offsetDays: 3,
    dueDate: new Date('2026-09-30T00:00:00Z'),
    scheduledAt: new Date('2026-09-27T01:30:00Z'),
    subscription: {
      id: 's1',
      status: 'ACTIVE',
      nextRenewalDate: new Date('2026-09-30T00:00:00Z'),
      trialEndDate: null,
      customName: null,
      service: { name: 'Netflix' },
      amountMinor: 260000n,
      currency: 'VND',
      intervalUnit: 'MONTH',
      intervalCount: 1,
      paymentMethod: { label: 'Visa', last4: '4821', archivedAt: null },
      ...subOver,
    },
    user: {
      settings: { notificationsEnabled: true },
      pushTokens: [
        { token: 'ExponentPushToken[a]' },
        { token: 'ExponentPushToken[b]' },
      ],
      ...userOver,
    },
    ...over,
  };
}

function setup(
  row: unknown,
  tickets: ExpoPushTicket[] | Error = [
    { status: 'ok', id: 't1' },
    { status: 'ok', id: 't2' },
  ],
) {
  const prisma = {
    reminder: {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({}),
    },
    pushToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const push: PushSender = {
    getReceipts: vi.fn().mockResolvedValue({}),
    send: vi.fn(async () => {
      if (tickets instanceof Error) throw tickets;
      return tickets;
    }),
  };
  return {
    prisma,
    push,
    sender: new ReminderSender(prisma as unknown as PrismaService, push),
  };
}

describe('ReminderSender', () => {
  it('gửi tới mọi thiết bị, đánh dấu SENT kèm ticket', async () => {
    const { sender, push, prisma } = setup(reminder());
    expect(await sender.send('r1', NOW)).toBe('SENT');
    const messages = vi.mocked(push.send).mock.calls[0]![0];
    expect(messages.map((m) => m.to)).toEqual([
      'ExponentPushToken[a]',
      'ExponentPushToken[b]',
    ]);
    expect(messages[0]).toMatchObject({
      title: 'Netflix gia hạn sau 3 ngày',
      data: { subscriptionId: 's1', reminderId: 'r1' },
    });
    expect(messages[0]!.body).toContain('Visa •• 4821');
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'SENT', sentAt: NOW, pushTicketId: 't1,t2', error: null },
    });
  });

  it('đã xử lý rồi (không còn PENDING) → bỏ qua, không gửi lại', async () => {
    const { sender, push } = setup(reminder({ status: 'SENT' }));
    expect(await sender.send('r1', NOW)).toBe('SKIPPED');
    expect(push.send).not.toHaveBeenCalled();
  });

  it.each([
    [
      'gói đã hủy',
      reminder({}, { status: 'CANCELLED' }),
      'SUBSCRIPTION_CHANGED',
    ],
    [
      'đổi ngày gia hạn',
      reminder({}, { nextRenewalDate: new Date('2026-10-05T00:00:00Z') }),
      'SUBSCRIPTION_CHANGED',
    ],
    [
      'tắt thông báo',
      reminder({}, {}, { settings: { notificationsEnabled: false } }),
      'NOTIFICATIONS_DISABLED',
    ],
    [
      'quá trễ',
      reminder({ scheduledAt: new Date('2026-09-26T12:00:00Z') }),
      'STALE',
    ],
  ])('%s → hủy lượt nhắc, không gửi', async (_name, row, reason) => {
    const { sender, push, prisma } = setup(row);
    expect(await sender.send('r1', NOW)).toBe('CANCELLED');
    expect(push.send).not.toHaveBeenCalled();
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'CANCELLED', error: reason },
    });
  });

  it('trial đã chuyển sang trả phí → hủy lượt nhắc hết trial', async () => {
    const row = reminder(
      { kind: 'TRIAL_END' },
      { status: 'ACTIVE', trialEndDate: new Date('2026-09-30T00:00:00Z') },
    );
    expect(await setup(row).sender.send('r1', NOW)).toBe('CANCELLED');
  });

  it('không có thiết bị → FAILED NO_PUSH_TOKEN', async () => {
    const { sender, prisma } = setup(reminder({}, {}, { pushTokens: [] }));
    expect(await sender.send('r1', NOW)).toBe('FAILED');
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'FAILED', error: 'NO_PUSH_TOKEN' },
    });
  });

  it('máy đã gỡ app → xóa token đó, vẫn SENT nếu máy khác nhận được', async () => {
    const { sender, prisma } = setup(reminder(), [
      {
        status: 'error',
        message: 'gone',
        details: { error: 'DeviceNotRegistered' },
      },
      { status: 'ok', id: 't2' },
    ]);
    expect(await sender.send('r1', NOW)).toBe('SENT');
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[a]'] } },
    });
  });

  it('mọi máy đều lỗi → FAILED', async () => {
    const { sender } = setup(reminder(), [
      {
        status: 'error',
        message: 'x',
        details: { error: 'MessageRateExceeded' },
      },
      {
        status: 'error',
        message: 'y',
        details: { error: 'MessageRateExceeded' },
      },
    ]);
    expect(await sender.send('r1', NOW)).toBe('FAILED');
  });

  it('lỗi mạng khi gọi Expo → ném TransientPushError để BullMQ thử lại', async () => {
    const { sender, prisma } = setup(reminder(), new Error('ECONNRESET'));
    await expect(sender.send('r1', NOW)).rejects.toBeInstanceOf(
      TransientPushError,
    );
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });
});
