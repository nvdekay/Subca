import {
  planReminders,
  type PlannerRule,
  type PlannerSubscription,
  type PlannerUser,
} from './planner.js';

const DEFAULT_RULES: PlannerRule[] = [
  {
    kind: 'RENEWAL',
    offsetDays: 30,
    minInterval: 'YEAR',
    minAmountMinor: null,
    enabled: true,
  },
  {
    kind: 'RENEWAL',
    offsetDays: 7,
    minInterval: null,
    minAmountMinor: null,
    enabled: true,
  },
  {
    kind: 'RENEWAL',
    offsetDays: 1,
    minInterval: null,
    minAmountMinor: null,
    enabled: true,
  },
  {
    kind: 'TRIAL_END',
    offsetDays: 1,
    minInterval: null,
    minAmountMinor: null,
    enabled: true,
  },
];
const plus: PlannerUser = {
  timezone: 'Asia/Ho_Chi_Minh',
  reminderMinuteOfDay: 510,
  notificationsEnabled: true,
  currency: 'VND',
  isPlus: true,
};
const free: PlannerUser = { ...plus, isPlus: false };
const netflix: PlannerSubscription = {
  id: 's1',
  userId: 'u1',
  status: 'ACTIVE',
  nextRenewalDate: '2026-10-30',
  trialEndDate: null,
  intervalUnit: 'MONTH',
  amountMinor: 260000n,
  currency: 'VND',
  reminderOffsets: [],
};
// Cửa sổ rất rộng để thấy mọi mốc
const ALL = {
  from: new Date('2020-01-01T00:00:00Z'),
  to: new Date('2030-01-01T00:00:00Z'),
};
const plan = (
  sub = netflix,
  user = plus,
  rules = DEFAULT_RULES,
  window = ALL,
) => planReminders(sub, rules, user, window, 1);

describe('planReminders', () => {
  it('Plus, gói tháng: nhắc 7 ngày và 1 ngày trước lúc 08:30 giờ VN (không có mốc 30 ngày của gói năm)', () => {
    const r = plan();
    expect(r.map((x) => [x.offsetDays, x.scheduledAt.toISOString()])).toEqual([
      [1, '2026-10-29T01:30:00.000Z'],
      [7, '2026-10-23T01:30:00.000Z'],
    ]);
    expect(
      r.every((x) => x.kind === 'RENEWAL' && x.dueDate === '2026-10-30'),
    ).toBe(true);
  });

  it('gói năm có thêm mốc 30 ngày', () => {
    expect(
      plan({ ...netflix, intervalUnit: 'YEAR' }).map((x) => x.offsetDays),
    ).toEqual([1, 7, 30]);
  });

  it('gói Free chỉ giữ 1 mốc gần ngày đến hạn nhất', () => {
    expect(plan(netflix, free).map((x) => x.offsetDays)).toEqual([1]);
  });

  it('mốc riêng của gói thay cho quy tắc chung', () => {
    expect(
      plan({ ...netflix, reminderOffsets: [3, 0] }).map((x) => x.offsetDays),
    ).toEqual([0, 3]);
  });

  it('trial: nhắc theo ngày hết trial với quy tắc TRIAL_END', () => {
    const r = plan({
      ...netflix,
      status: 'TRIAL',
      trialEndDate: '2026-10-04',
      nextRenewalDate: '2026-10-04',
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      kind: 'TRIAL_END',
      offsetDays: 1,
      dueDate: '2026-10-04',
    });
  });

  it('không nhắc khi: đã hủy, tắt thông báo, không có ngày, quy tắc bị tắt', () => {
    expect(plan({ ...netflix, status: 'CANCELLED' })).toEqual([]);
    expect(plan({ ...netflix, status: 'ARCHIVED' })).toEqual([]);
    expect(plan(netflix, { ...plus, notificationsEnabled: false })).toEqual([]);
    expect(plan({ ...netflix, nextRenewalDate: null })).toEqual([]);
    expect(
      plan(
        netflix,
        plus,
        DEFAULT_RULES.map((r) => ({ ...r, enabled: false })),
      ),
    ).toEqual([]);
  });

  it('ngưỡng số tiền: chỉ so khi cùng tiền tệ với người dùng', () => {
    const rules: PlannerRule[] = [
      {
        kind: 'RENEWAL',
        offsetDays: 7,
        minInterval: null,
        minAmountMinor: 200000n,
        enabled: true,
      },
    ];
    expect(plan({ ...netflix, amountMinor: 59000n }, plus, rules)).toEqual([]);
    expect(
      plan({ ...netflix, amountMinor: 260000n }, plus, rules),
    ).toHaveLength(1);
    expect(
      plan({ ...netflix, amountMinor: 2000n, currency: 'USD' }, plus, rules),
    ).toHaveLength(1);
  });

  it('chỉ lấy lượt nhắc trong cửa sổ thời gian, tính theo múi giờ và giờ nhắc của người dùng', () => {
    const window = {
      from: new Date('2026-10-29T00:00:00Z'),
      to: new Date('2026-10-30T00:00:00Z'),
    };
    expect(
      plan(netflix, plus, DEFAULT_RULES, window).map((x) => x.offsetDays),
    ).toEqual([1]);
    const bangkok20h = {
      ...plus,
      timezone: 'Asia/Bangkok',
      reminderMinuteOfDay: 20 * 60,
    };
    expect(
      plan(
        netflix,
        bangkok20h,
        DEFAULT_RULES,
        window,
      )[0]!.scheduledAt.toISOString(),
    ).toBe('2026-10-29T13:00:00.000Z');
  });
});
