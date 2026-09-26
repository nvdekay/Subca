import { describe, expect, it } from 'vitest';
import { CreateSubscriptionSchema, UpdateSubscriptionSchema } from './subscription.js';

const valid = {
  customName: 'Phòng gym',
  amountMinor: '550000',
  currency: 'VND',
  billingDate: '2026-10-01',
};

describe('CreateSubscriptionSchema', () => {
  it('điền giá trị mặc định', () => {
    const r = CreateSubscriptionSchema.parse(valid);
    expect(r).toMatchObject({
      intervalUnit: 'MONTH',
      intervalCount: 1,
      isTrial: false,
      autoRenew: true,
    });
  });
  it('bắt buộc chọn dịch vụ hoặc nhập tên', () => {
    const r = CreateSubscriptionSchema.safeParse({ ...valid, customName: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['customName']);
    expect(
      CreateSubscriptionSchema.safeParse({
        ...valid,
        customName: undefined,
        serviceId: '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      }).success,
    ).toBe(true);
  });
  it('từ chối số tiền, ngày, tiền tệ, chu kỳ sai', () => {
    for (const bad of [
      { amountMinor: '-1' },
      { amountMinor: '12.5' },
      { amountMinor: 260000 },
      { billingDate: '2026-02-30' },
      { currency: 'XYZ' },
      { intervalCount: 0 },
      { reminderOffsets: [7, 7] },
      { customName: '   ' },
    ]) {
      expect(
        CreateSubscriptionSchema.safeParse({ ...valid, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe('UpdateSubscriptionSchema', () => {
  it('cho phép sửa một phần, không tự điền mặc định', () => {
    expect(UpdateSubscriptionSchema.parse({ amountMinor: '59000' })).toEqual({
      amountMinor: '59000',
    });
  });
  it('từ chối body rỗng và trạng thái ARCHIVED', () => {
    expect(UpdateSubscriptionSchema.safeParse({}).success).toBe(false);
    expect(UpdateSubscriptionSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
    expect(UpdateSubscriptionSchema.safeParse({ status: 'CANCELLED' }).success).toBe(true);
  });
});
