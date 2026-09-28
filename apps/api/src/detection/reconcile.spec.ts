import { CONFIDENCE } from '@subca/shared';
import { reconcile, type EventFacts } from './reconcile.js';

const at = (iso: string) => new Date(`${iso}T03:00:00Z`);

const payment = (iso: string, over: Partial<EventFacts> = {}): EventFacts => ({
  eventType: 'PAYMENT_SUCCESS',
  occurredAt: at(iso),
  amountMinor: 2000n,
  currency: 'USD',
  intervalUnit: 'MONTH',
  intervalCount: 1,
  confidence: 85,
  ...over,
});

const TODAY = '2026-09-28';

describe('reconcile', () => {
  it('trả tiền đều 4 tháng → ACTIVE, tin cậy cao, tự tính kỳ tới', () => {
    const result = reconcile(
      [
        payment('2026-06-18'),
        payment('2026-07-18'),
        payment('2026-08-18'),
        payment('2026-09-18'),
      ],
      TODAY,
    );
    expect(result.state).toBe('ACTIVE');
    expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE.high);
    expect(result.needsReview).toBe(false);
    expect(result.lastChargedOn).toBe('2026-09-18');
    expect(result.nextRenewalDate).toBe('2026-10-18');
    expect(result.amountMinor).toBe(2000n);
  });

  it('email nói rõ ngày gia hạn thì ưu tiên hơn ngày tự tính', () => {
    const result = reconcile(
      [payment('2026-09-18', { renewalDate: '2026-10-20' })],
      TODAY,
    );
    expect(result.nextRenewalDate).toBe('2026-10-20');
  });

  it('mới bắt đầu dùng thử → TRIAL kèm ngày hết dùng thử', () => {
    const result = reconcile(
      [
        {
          eventType: 'TRIAL_STARTED',
          occurredAt: at('2026-09-25'),
          trialEndDate: '2026-10-02',
          confidence: 82,
        },
      ],
      TODAY,
    );
    expect(result.state).toBe('TRIAL');
    expect(result.trialEndDate).toBe('2026-10-02');
  });

  it('trial đã qua ngày kết thúc mà không có email nào khác → POSSIBLY_ACTIVE, cần kiểm tra', () => {
    const result = reconcile(
      [
        {
          eventType: 'TRIAL_STARTED',
          occurredAt: at('2026-08-01'),
          trialEndDate: '2026-08-08',
          confidence: 82,
        },
      ],
      TODAY,
    );
    expect(result.state).toBe('POSSIBLY_ACTIVE');
    expect(result.needsReview).toBe(true);
  });

  it('email hủy là sự kiện mới nhất → CANCELLED, không còn kỳ gia hạn', () => {
    const result = reconcile(
      [
        payment('2026-08-18'),
        {
          eventType: 'SUBSCRIPTION_CANCELLED',
          occurredAt: at('2026-09-20'),
          accessUntil: '2026-10-18',
          confidence: 88,
        },
      ],
      TODAY,
    );
    expect(result.state).toBe('CANCELLED');
    expect(result.nextRenewalDate).toBeNull();
  });

  it('thanh toán lỗi → PAYMENT_ISSUE', () => {
    const result = reconcile(
      [
        payment('2026-08-18'),
        {
          eventType: 'PAYMENT_FAILED',
          occurredAt: at('2026-09-18'),
          confidence: 85,
        },
      ],
      TODAY,
    );
    expect(result.state).toBe('PAYMENT_ISSUE');
  });

  it('mở lại sau khi hủy → ACTIVE', () => {
    const result = reconcile(
      [
        {
          eventType: 'SUBSCRIPTION_CANCELLED',
          occurredAt: at('2026-06-01'),
          confidence: 88,
        },
        {
          eventType: 'SUBSCRIPTION_RESUMED',
          occurredAt: at('2026-09-01'),
          confidence: 78,
        },
      ],
      TODAY,
    );
    expect(result.state).toBe('ACTIVE');
  });

  it('im lặng quá lâu không bị coi là đã hủy, chỉ hạ tin cậy', () => {
    const result = reconcile(
      [payment('2026-03-18'), payment('2026-04-18')],
      TODAY,
    );
    expect(result.state).toBe('POSSIBLY_ACTIVE');
    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toContain('không thấy email gia hạn');
    expect(result.confidence).toBeLessThan(CONFIDENCE.high);
  });

  it('không có chu kỳ trong email thì suy từ khoảng cách các lần trả tiền', () => {
    const yearly = reconcile(
      [
        payment('2024-09-18', { intervalUnit: null, intervalCount: null }),
        payment('2025-09-18', { intervalUnit: null, intervalCount: null }),
        payment('2026-09-18', { intervalUnit: null, intervalCount: null }),
      ],
      TODAY,
    );
    expect(yearly.intervalUnit).toBe('YEAR');
    expect(yearly.nextRenewalDate).toBe('2027-09-18');
  });

  it('đổi giá giữa hai lần thanh toán được ghi nhận', () => {
    const result = reconcile(
      [
        payment('2026-08-18', { amountMinor: 2000n }),
        payment('2026-09-18', { amountMinor: 2500n }),
      ],
      TODAY,
    );
    expect(result.priceChange).toEqual({
      fromMinor: 2000n,
      toMinor: 2500n,
      currency: 'USD',
    });
    expect(result.amountMinor).toBe(2500n);
  });

  it('chỉ một email cũ, không có tiền → tin cậy thấp, cần người dùng xác nhận', () => {
    const result = reconcile(
      [
        {
          eventType: 'SUBSCRIPTION_STARTED',
          occurredAt: at('2025-11-02'),
          amountMinor: null,
          currency: null,
          confidence: 60,
        },
      ],
      TODAY,
    );
    expect(result.confidence).toBeLessThan(CONFIDENCE.medium);
    expect(result.needsReview).toBe(true);
  });
});
