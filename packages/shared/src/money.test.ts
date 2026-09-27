import { describe, expect, it } from 'vitest';
import { formatAmountVi, formatMoney, splitEvenly, toMinor } from './money.js';

describe('toMinor', () => {
  it('đổi VND (không có phần thập phân)', () => {
    expect(toMinor('260000', 'VND')).toBe(260000n);
    expect(toMinor(89000, 'VND')).toBe(89000n);
  });
  it('đổi USD sang cent', () => {
    expect(toMinor('19.99', 'USD')).toBe(1999n);
    expect(toMinor('20', 'USD')).toBe(2000n);
    expect(toMinor(0.1, 'USD')).toBe(10n);
  });
  it('từ chối giá trị sai', () => {
    expect(() => toMinor('abc', 'VND')).toThrow();
    expect(() => toMinor('1.5', 'VND')).toThrow();
    expect(() => toMinor('-5', 'USD')).toThrow();
  });
});

describe('splitEvenly', () => {
  it('tổng các phần luôn bằng tổng tiền', () => {
    const parts = splitEvenly(89000n, 4);
    expect(parts).toEqual([22250n, 22250n, 22250n, 22250n]);
    const odd = splitEvenly(100000n, 3);
    expect(odd).toEqual([33334n, 33333n, 33333n]);
    expect(odd.reduce((a, b) => a + b, 0n)).toBe(100000n);
  });
  it('từ chối số phần không hợp lệ', () => {
    expect(() => splitEvenly(1000n, 0)).toThrow();
  });
});

describe('formatMoney', () => {
  it('định dạng VND và USD', () => {
    expect(formatMoney(260000n, 'VND')).toMatch(/260\.000/);
    expect(formatMoney(1999n, 'USD', 'en-US')).toBe('$19.99');
  });
});

describe('convertMinor', () => {
  it('USD → VND và VND → USD', async () => {
    const { convertMinor } = await import('./money.js');
    expect(convertMinor(2000n, 'USD', 'VND', 26000)).toBe(520000n);
    expect(convertMinor(520000n, 'VND', 'USD', 1 / 26000)).toBe(2000n);
    expect(convertMinor(1999n, 'USD', 'VND', 25432.5)).toBe(508396n); // 19,99 × 25.432,5 = 508.395,675
  });
  it('cùng tiền tệ thì giữ nguyên; tỷ giá sai thì báo lỗi', async () => {
    const { convertMinor } = await import('./money.js');
    expect(convertMinor(123n, 'VND', 'VND', 0)).toBe(123n);
    expect(() => convertMinor(1n, 'USD', 'VND', 0)).toThrow();
    expect(() => convertMinor(1n, 'USD', 'VND', Number.NaN)).toThrow();
  });
});

describe('formatAmountVi', () => {
  it('VND kiểu Việt, ngoại tệ kiểu en-US', () => {
    expect(formatAmountVi(260000n, 'VND')).toBe('260.000đ');
    expect(formatAmountVi(1999n, 'USD')).toBe('$19.99');
    expect(formatAmountVi(1200n, 'JPY')).toBe('¥1,200');
  });
});
