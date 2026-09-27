import { describe, expect, it } from 'vitest';
import { CreatePaymentMethodSchema, UpdateSettingsSchema, UpsertBudgetSchema } from './account.js';

describe('UpdateSettingsSchema', () => {
  it('nhận múi giờ hợp lệ, từ chối múi giờ sai và giờ ngoài khoảng', () => {
    expect(UpdateSettingsSchema.safeParse({ timezone: 'Asia/Ho_Chi_Minh' }).success).toBe(true);
    expect(UpdateSettingsSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ reminderMinuteOfDay: 1440 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({}).success).toBe(false);
  });
});

describe('UpsertBudgetSchema', () => {
  it('hạn mức phải > 0', () => {
    expect(
      UpsertBudgetSchema.parse({ amountMinor: '2000000', currency: 'VND' }).alertAtPercent,
    ).toBe(90);
    expect(UpsertBudgetSchema.safeParse({ amountMinor: '0', currency: 'VND' }).success).toBe(false);
  });
});

describe('CreatePaymentMethodSchema', () => {
  it('chỉ chấp nhận 4 số cuối, chuẩn hóa brand', () => {
    const r = CreatePaymentMethodSchema.parse({
      type: 'CARD',
      brand: 'visa',
      label: 'Visa chính',
      last4: '4821',
    });
    expect(r).toMatchObject({ brand: 'VISA', isDefault: false });
    expect(
      CreatePaymentMethodSchema.safeParse({
        type: 'CARD',
        label: 'Visa',
        last4: '4111111111111111',
      }).success,
    ).toBe(false);
    expect(CreatePaymentMethodSchema.safeParse({ type: 'CARD', label: '' }).success).toBe(false);
  });
});
