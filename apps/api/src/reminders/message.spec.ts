import { buildReminderMessage, type ReminderMessageInput } from './message.js';

const base: ReminderMessageInput = {
  kind: 'RENEWAL',
  offsetDays: 3,
  dueDate: '2026-09-30',
  name: 'Netflix',
  amountMinor: 260000n,
  currency: 'VND',
  intervalUnit: 'MONTH',
  intervalCount: 1,
  paymentLabel: 'Visa •• 4821',
};

describe('buildReminderMessage', () => {
  it('gia hạn sau N ngày', () => {
    const m = buildReminderMessage(base);
    expect(m.title).toBe('Netflix gia hạn sau 3 ngày');
    expect(m.body).toMatch(
      /^260\.000đ sẽ được trừ từ Visa •• 4821 vào 30\/09\.$/,
    );
  });
  it('ngày mai / hôm nay, không có phương thức thanh toán', () => {
    expect(buildReminderMessage({ ...base, offsetDays: 1 }).title).toBe(
      'Netflix gia hạn ngày mai',
    );
    const today = buildReminderMessage({
      ...base,
      offsetDays: 0,
      paymentLabel: null,
    });
    expect(today.title).toBe('Hôm nay Netflix gia hạn');
    expect(today.body).toMatch(/sẽ được trừ hôm nay\.$/);
  });
  it('hết dùng thử, kèm giá sau trial theo chu kỳ', () => {
    const m = buildReminderMessage({
      ...base,
      kind: 'TRIAL_END',
      offsetDays: 2,
      name: 'Notion AI',
      amountMinor: 250000n,
      dueDate: '2026-09-29',
    });
    expect(m.title).toBe('Notion AI hết dùng thử sau 2 ngày');
    expect(m.body).toMatch(
      /^Từ 29\/09 bạn sẽ bị trừ 250\.000đ\/tháng\. Hủy trước nếu không dùng nữa\.$/,
    );
  });
  it('USD và chu kỳ nhiều tháng', () => {
    const m = buildReminderMessage({
      ...base,
      kind: 'TRIAL_END',
      currency: 'USD',
      amountMinor: 2000n,
      intervalCount: 3,
    });
    expect(m.body).toContain('/3 tháng');
    expect(m.body).toMatch(/20,00\sUS\$|US\$\s?20,00|\$20/);
  });
});
