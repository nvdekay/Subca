import { dueDateOf, dueDayFromDate, periodOf, periodStart } from './cycle.js';

describe('kỳ thu của nhóm', () => {
  it('kỳ lấy theo tháng của hôm nay (múi giờ người dùng)', () => {
    expect(periodOf('2026-10-05')).toBe('2026-10');
    expect(periodStart('2026-10')).toBe('2026-10-01');
  });

  it('hạn chuyển tiền ghép từ kỳ và ngày trong tháng', () => {
    expect(dueDateOf('2026-10', 5)).toBe('2026-10-05');
    expect(dueDateOf('2026-02', 28)).toBe('2026-02-28');
  });

  it('hạn mặc định theo ngày gia hạn, chặn ở 28 để tháng 2 vẫn có', () => {
    expect(dueDayFromDate('2026-10-05')).toBe(5);
    expect(dueDayFromDate('2026-10-31')).toBe(28);
  });
});
