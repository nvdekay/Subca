import { describe, expect, it } from 'vitest';
import { formatMoney, splitEvenly, toMinor } from './money.js';

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
