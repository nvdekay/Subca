import { rollForward, type RollableSubscription } from './roll-forward.js';

const monthly: RollableSubscription = {
  status: 'ACTIVE',
  startDate: '2026-01-31',
  anchorDay: 31,
  intervalUnit: 'MONTH',
  intervalCount: 1,
  nextRenewalDate: '2026-09-30',
  trialEndDate: null,
  autoRenew: true,
};

describe('rollForward', () => {
  it('chưa tới hoặc đúng ngày gia hạn → không đổi', () => {
    expect(rollForward(monthly, '2026-09-29')).toBeNull();
    expect(rollForward(monthly, '2026-09-30')).toBeNull();
  });

  it('qua ngày gia hạn → ghi 1 khoản trừ tiền, kỳ tới về đúng ngày 31', () => {
    expect(rollForward(monthly, '2026-10-01')).toEqual({
      status: 'ACTIVE',
      nextRenewalDate: '2026-10-31',
      charges: ['2026-09-30'],
      cancelled: false,
    });
  });

  it('server tắt lâu → ghi đủ các kỳ đã bỏ lỡ', () => {
    const r = rollForward(monthly, '2026-12-15')!;
    expect(r.charges).toEqual(['2026-09-30', '2026-10-31', '2026-11-30']);
    expect(r.nextRenewalDate).toBe('2026-12-31');
  });

  it('giữ trạng thái REVIEW', () => {
    expect(
      rollForward({ ...monthly, status: 'REVIEW' }, '2026-10-01')!.status,
    ).toBe('REVIEW');
  });

  it('không tự gia hạn → kết thúc, không ghi khoản trừ tiền', () => {
    expect(rollForward({ ...monthly, autoRenew: false }, '2026-10-01')).toEqual(
      {
        status: 'CANCELLED',
        nextRenewalDate: null,
        charges: [],
        cancelled: true,
      },
    );
  });

  it('hết trial + tự gia hạn → chuyển ACTIVE, ghi khoản trừ tiền đầu tiên', () => {
    const trial: RollableSubscription = {
      ...monthly,
      status: 'TRIAL',
      startDate: '2026-09-29',
      anchorDay: 29,
      nextRenewalDate: '2026-09-29',
      trialEndDate: '2026-09-29',
    };
    expect(rollForward(trial, '2026-09-30')).toEqual({
      status: 'ACTIVE',
      nextRenewalDate: '2026-10-29',
      charges: ['2026-09-29'],
      cancelled: false,
    });
    expect(
      rollForward({ ...trial, autoRenew: false }, '2026-09-30')!.status,
    ).toBe('CANCELLED');
  });

  it('bỏ qua gói đã hủy hoặc lưu trữ', () => {
    expect(
      rollForward({ ...monthly, status: 'CANCELLED' }, '2027-01-01'),
    ).toBeNull();
    expect(
      rollForward({ ...monthly, status: 'ARCHIVED' }, '2027-01-01'),
    ).toBeNull();
  });
});
