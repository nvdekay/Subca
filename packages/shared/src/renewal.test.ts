import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  isValidIsoDate,
  monthlyEquivalentMinor,
  nextRenewalOnOrAfter,
  nthRenewal,
  previousRenewalBefore,
  reminderInstant,
  renewalsBetween,
  todayInTimeZone,
  trialEndDate,
  zonedTimeToUtc,
  type RenewalSchedule,
} from './renewal.js';

const monthly = (startDate: string, anchorDay?: number): RenewalSchedule => ({
  startDate,
  intervalUnit: 'MONTH',
  intervalCount: 1,
  ...(anchorDay ? { anchorDay } : {}),
});

describe('ngày cơ bản', () => {
  it('kiểm tra ngày hợp lệ', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('26-1-1')).toBe(false);
  });
  it('cộng ngày qua tháng và năm', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-27', '2026-10-04')).toBe(7);
  });
  it('cộng tháng kẹp về cuối tháng', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('ngày 31 → tháng 2 → quay lại 31', () => {
  const s = monthly('2026-01-31');
  it('mỗi kỳ tính từ ngày gốc, không cộng dồn', () => {
    expect([0, 1, 2, 3, 4].map((k) => nthRenewal(s, k))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });
  it('năm nhuận: tháng 2 có 29 ngày', () => {
    expect(nthRenewal(monthly('2028-01-31'), 1)).toBe('2028-02-29');
  });
  it('anchorDay giữ ngày 31 dù ngày bắt đầu đã bị lùi về 28/02', () => {
    const shifted = monthly('2026-02-28', 31);
    expect(nthRenewal(shifted, 1)).toBe('2026-03-31');
    expect(nthRenewal(shifted, 2)).toBe('2026-04-30');
  });
  it('kỳ đầu luôn là startDate kể cả khi anchorDay khác ngày bắt đầu', () => {
    const s = monthly('2024-07-15', 31);
    expect(nthRenewal(s, 0)).toBe('2024-07-15');
    expect(nthRenewal(s, 1)).toBe('2024-08-31');
    expect(nextRenewalOnOrAfter(s, '2024-07-20')).toBe('2024-08-31');
    expect(previousRenewalBefore(s, '2024-07-20')).toBe('2024-07-15');
  });
  it('ngày 30 và 29 cũng đúng', () => {
    expect(nthRenewal(monthly('2026-01-30'), 1)).toBe('2026-02-28');
    expect(nthRenewal(monthly('2026-01-30'), 2)).toBe('2026-03-30');
    expect(nthRenewal(monthly('2026-01-29'), 2)).toBe('2026-03-29');
  });
});

describe('năm nhuận', () => {
  const leap: RenewalSchedule = { startDate: '2024-02-29', intervalUnit: 'YEAR', intervalCount: 1 };
  it('gói năm bắt đầu 29/02: năm thường về 28/02, năm nhuận quay lại 29/02', () => {
    expect([0, 1, 2, 3, 4].map((k) => nthRenewal(leap, k))).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });
  it('năm 2100 không phải năm nhuận, 2000 là năm nhuận', () => {
    expect(nthRenewal({ ...leap, startDate: '2096-02-29' }, 4)).toBe('2100-02-28');
    expect(nthRenewal({ ...leap, startDate: '1996-02-29' }, 4)).toBe('2000-02-29');
  });
});

describe('chu kỳ tuần / quý / năm / N tháng', () => {
  it('hằng tuần và 2 tuần', () => {
    const weekly: RenewalSchedule = {
      startDate: '2026-09-27',
      intervalUnit: 'WEEK',
      intervalCount: 1,
    };
    expect(nthRenewal(weekly, 1)).toBe('2026-10-04');
    expect(nthRenewal({ ...weekly, intervalCount: 2 }, 3)).toBe('2026-11-08');
  });
  it('theo quý (3 tháng)', () => {
    const quarterly: RenewalSchedule = {
      startDate: '2026-11-30',
      intervalUnit: 'MONTH',
      intervalCount: 3,
    };
    expect(renewalsBetween(quarterly, '2026-11-01', '2027-12-31')).toEqual([
      '2026-11-30',
      '2027-02-28',
      '2027-05-30',
      '2027-08-30',
      '2027-11-30',
    ]);
  });
  it('hằng năm và 2 năm', () => {
    const yearly: RenewalSchedule = {
      startDate: '2025-11-12',
      intervalUnit: 'YEAR',
      intervalCount: 1,
    };
    expect(nextRenewalOnOrAfter(yearly, '2026-09-27')).toBe('2026-11-12');
    expect(nthRenewal({ ...yearly, intervalCount: 2 }, 1)).toBe('2027-11-12');
  });
  it('theo ngày (VD gói 30 ngày)', () => {
    const daily: RenewalSchedule = {
      startDate: '2026-09-01',
      intervalUnit: 'DAY',
      intervalCount: 30,
    };
    expect(nextRenewalOnOrAfter(daily, '2026-10-05')).toBe('2026-10-31');
  });
  it('từ chối chu kỳ không hợp lệ', () => {
    expect(() =>
      nthRenewal({ startDate: '2026-01-01', intervalUnit: 'MONTH', intervalCount: 0 }, 1),
    ).toThrow();
    expect(() => nthRenewal(monthly('2026-01-01', 32), 1)).toThrow();
    expect(() => nthRenewal(monthly('2026-02-30'), 1)).toThrow();
  });
});

describe('kỳ gia hạn tiếp theo', () => {
  // Dữ liệu giống mockup: hôm nay 27/09/2026
  const today = '2026-09-27';
  it('Netflix ngày 30 → 30/09, CitiGym ngày 1 → 01/10', () => {
    expect(nextRenewalOnOrAfter(monthly('2023-03-30'), today)).toBe('2026-09-30');
    expect(nextRenewalOnOrAfter(monthly('2025-06-01'), today)).toBe('2026-10-01');
  });
  it('đúng ngày gia hạn thì trả về chính hôm nay', () => {
    expect(nextRenewalOnOrAfter(monthly('2026-01-27'), today)).toBe('2026-09-27');
  });
  it('trước ngày bắt đầu thì trả về ngày bắt đầu', () => {
    expect(nextRenewalOnOrAfter(monthly('2026-12-05'), today)).toBe('2026-12-05');
  });
  it('kỳ trước đó', () => {
    expect(previousRenewalBefore(monthly('2023-03-30'), today)).toBe('2026-08-30');
    expect(previousRenewalBefore(monthly('2026-01-31'), '2026-03-31')).toBe('2026-02-28');
    expect(previousRenewalBefore(monthly('2026-12-05'), today)).toBeNull();
  });
  it('lịch tháng: liệt kê các kỳ trong khoảng', () => {
    expect(
      renewalsBetween(
        { startDate: '2026-09-01', intervalUnit: 'WEEK', intervalCount: 1 },
        '2026-10-01',
        '2026-10-31',
      ),
    ).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
    expect(renewalsBetween(monthly('2020-05-15'), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-15',
    ]);
  });
  it('tính nhanh cả khi gói bắt đầu từ rất lâu', () => {
    expect(
      nextRenewalOnOrAfter(
        { startDate: '1990-01-31', intervalUnit: 'MONTH', intervalCount: 1 },
        today,
      ),
    ).toBe('2026-09-30');
  });
});

describe('trial', () => {
  it('ngày hết trial = ngày tính phí đầu tiên', () => {
    expect(trialEndDate('2026-09-15', 14)).toBe('2026-09-29');
    expect(trialEndDate('2026-09-27', 7)).toBe('2026-10-04');
  });
  it('sau trial, lịch gia hạn bắt đầu từ ngày hết trial', () => {
    const afterTrial = monthly(trialEndDate('2026-01-17', 14)); // 31/01
    expect(nthRenewal(afterTrial, 1)).toBe('2026-02-28');
    expect(nthRenewal(afterTrial, 2)).toBe('2026-03-31');
  });
  it('từ chối số ngày trial không hợp lệ', () => {
    expect(() => trialEndDate('2026-09-15', 0)).toThrow();
  });
});

describe('múi giờ người dùng', () => {
  it('hôm nay theo múi giờ Việt Nam khác UTC sau 17:00 UTC', () => {
    const instant = new Date('2026-09-26T18:30:00Z');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-09-26');
    expect(todayInTimeZone('Asia/Ho_Chi_Minh', instant)).toBe('2026-09-27');
  });
  it('nhắc 3 ngày trước lúc 08:30 giờ Việt Nam', () => {
    expect(reminderInstant('2026-09-30', 3, 510, 'Asia/Ho_Chi_Minh').toISOString()).toBe(
      '2026-09-27T01:30:00.000Z',
    );
  });
  it('nhắc 00:15 → lùi sang ngày hôm trước theo UTC', () => {
    expect(zonedTimeToUtc('2026-10-01', 15, 'Asia/Ho_Chi_Minh').toISOString()).toBe(
      '2026-09-30T17:15:00.000Z',
    );
  });
  it('múi giờ có giờ mùa hè (New York)', () => {
    // Trước và sau ngày đổi giờ 01/11/2026
    expect(zonedTimeToUtc('2026-10-30', 510, 'America/New_York').toISOString()).toBe(
      '2026-10-30T12:30:00.000Z',
    );
    expect(zonedTimeToUtc('2026-11-02', 510, 'America/New_York').toISOString()).toBe(
      '2026-11-02T13:30:00.000Z',
    );
  });
  it('từ chối giờ không hợp lệ', () => {
    expect(() => zonedTimeToUtc('2026-10-01', 1440, 'Asia/Ho_Chi_Minh')).toThrow();
  });
});

describe('quy đổi chi phí về tháng', () => {
  it('tháng, năm, quý', () => {
    expect(monthlyEquivalentMinor(260000n, 'MONTH')).toBe(260000n);
    expect(monthlyEquivalentMinor(1800000n, 'YEAR')).toBe(150000n);
    expect(monthlyEquivalentMinor(199000n, 'YEAR')).toBe(16583n);
    expect(monthlyEquivalentMinor(300000n, 'MONTH', 3)).toBe(100000n);
  });
  it('tuần và ngày', () => {
    expect(monthlyEquivalentMinor(12000n, 'WEEK')).toBe(52000n);
    expect(monthlyEquivalentMinor(1200n, 'DAY')).toBe(36500n);
  });
});

describe('đối chiếu với cách lặp từng kỳ (ngẫu nhiên, có seed cố định)', () => {
  // LCG 32-bit dùng Math.imul để kết quả giống hệt nhau trên mọi máy
  let seed = 20260927;
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const units = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const;

  // Khoảng ngày giới hạn trong ~6 năm quanh ngày bắt đầu để phần lặp đối chiếu chạy nhanh trên CI
  it('nextRenewalOnOrAfter và previousRenewalBefore khớp kết quả lặp', { timeout: 20_000 }, () => {
    for (let i = 0; i < 3000; i++) {
      const s: RenewalSchedule = {
        startDate: addDays('2020-01-01', rand(2200)),
        intervalUnit: units[rand(4)]!,
        intervalCount: 1 + rand(4),
        ...(rand(3) === 0 ? { anchorDay: 28 + rand(4) } : {}),
      };
      const from = addDays(s.startDate, rand(2400) - 200);
      let k = 0;
      while (nthRenewal(s, k) < from) k++;
      expect(nextRenewalOnOrAfter(s, from)).toBe(nthRenewal(s, k));
      expect(previousRenewalBefore(s, from)).toBe(k === 0 ? null : nthRenewal(s, k - 1));
    }
  });
});
