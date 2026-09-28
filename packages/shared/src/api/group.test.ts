import { describe, expect, it } from 'vitest';
import {
  computeShares,
  CreateGroupSchema,
  groupTransferNote,
  inviteUrl,
  JoinGroupSchema,
  SetSplitSchema,
  UpdateGroupSchema,
} from './group.js';

const uuid = (n: number) => `0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a${String(n).padStart(2, '0')}`;

describe('CreateGroupSchema', () => {
  it('nhận nhóm tạo từ subscription (tên và giá lấy ở server)', () => {
    const r = CreateGroupSchema.safeParse({ subscriptionId: uuid(1), memberCount: 4 });
    expect(r.success).toBe(true);
  });

  it('nhận nhóm tự nhập khi có đủ tên, giá và tiền tệ', () => {
    const r = CreateGroupSchema.safeParse({
      name: 'Netflix Premium',
      totalAmountMinor: '260000',
      currency: 'VND',
      memberCount: 4,
      memberNames: ['Linh', 'Huy'],
      dueDay: 28,
    });
    expect(r.success).toBe(true);
  });

  it('từ chối khi không có gói mà cũng không nhập giá', () => {
    const r = CreateGroupSchema.safeParse({ name: 'Netflix', memberCount: 3 });
    expect(r.success).toBe(false);
  });

  it('từ chối số người ngoài khoảng 2–6 và hạn chuyển ngoài 1–28', () => {
    expect(CreateGroupSchema.safeParse({ subscriptionId: uuid(1), memberCount: 1 }).success).toBe(
      false,
    );
    expect(CreateGroupSchema.safeParse({ subscriptionId: uuid(1), memberCount: 7 }).success).toBe(
      false,
    );
    expect(
      CreateGroupSchema.safeParse({ subscriptionId: uuid(1), memberCount: 4, dueDay: 29 }).success,
    ).toBe(false);
  });

  it('từ chối khi tên thành viên nhiều hơn số chỗ còn lại', () => {
    const r = CreateGroupSchema.safeParse({
      subscriptionId: uuid(1),
      memberCount: 2,
      memberNames: ['Linh', 'Huy'],
    });
    expect(r.success).toBe(false);
  });
});

describe('UpdateGroupSchema', () => {
  it('cho phép xóa thông tin nhận tiền bằng null', () => {
    expect(UpdateGroupSchema.safeParse({ payout: null }).success).toBe(true);
  });

  it('từ chối giá gói bằng 0, BIN sai và body rỗng', () => {
    expect(UpdateGroupSchema.safeParse({ totalAmountMinor: '0' }).success).toBe(false);
    expect(
      UpdateGroupSchema.safeParse({
        payout: { bankBin: '97042', accountNo: '0901234567', accountName: 'KHANH NGUYEN' },
      }).success,
    ).toBe(false);
    expect(UpdateGroupSchema.safeParse({}).success).toBe(false);
  });
});

describe('SetSplitSchema', () => {
  it('chia đều không cần danh sách phần', () => {
    expect(SetSplitSchema.safeParse({ splitMode: 'EQUAL' }).success).toBe(true);
  });

  it('chia tùy chỉnh cần ít nhất 2 phần, không trùng thành viên', () => {
    expect(
      SetSplitSchema.safeParse({
        splitMode: 'CUSTOM',
        shares: [
          { memberId: uuid(1), amountMinor: '100000' },
          { memberId: uuid(2), amountMinor: '160000' },
        ],
      }).success,
    ).toBe(true);
    expect(
      SetSplitSchema.safeParse({
        splitMode: 'CUSTOM',
        shares: [
          { memberId: uuid(1), amountMinor: '100000' },
          { memberId: uuid(1), amountMinor: '160000' },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('JoinGroupSchema', () => {
  it('chuyển mã mời thành chữ in hoa', () => {
    const r = JoinGroupSchema.safeParse({ inviteCode: ' abcd2345 ' });
    expect(r.success && r.data.inviteCode).toBe('ABCD2345');
  });

  it('từ chối mã có ký tự dễ đọc lẫn hoặc sai độ dài', () => {
    expect(JoinGroupSchema.safeParse({ inviteCode: 'ABCD01OI' }).success).toBe(false);
    expect(JoinGroupSchema.safeParse({ inviteCode: 'ABCD234' }).success).toBe(false);
  });
});

describe('computeShares', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('chia đều và dồn phần lẻ cho người đầu để tổng luôn khớp', () => {
    const shares = computeShares(260000n, members, 'EQUAL');
    expect([...shares.values()]).toEqual([86667n, 86667n, 86666n]);
    expect([...shares.values()].reduce((a, b) => a + b, 0n)).toBe(260000n);
  });

  it('chia tùy chỉnh lấy số đã nhập, ai chưa nhập thì tạm tính theo chia đều', () => {
    const shares = computeShares(
      300000n,
      [
        { id: 'a', customShareMinor: 200000n },
        { id: 'b', customShareMinor: null },
        { id: 'c', customShareMinor: 50000n },
      ],
      'CUSTOM',
    );
    expect(shares.get('a')).toBe(200000n);
    expect(shares.get('b')).toBe(100000n);
    expect(shares.get('c')).toBe(50000n);
  });

  it('bỏ qua số đã nhập khi nhóm đang chia đều', () => {
    const shares = computeShares(100n, [{ id: 'a', customShareMinor: 90n }, { id: 'b' }], 'EQUAL');
    expect([...shares.values()]).toEqual([50n, 50n]);
  });
});

describe('groupTransferNote & inviteUrl', () => {
  it('nội dung chuyển khoản lấy 2 từ đầu của tên nhóm và số tháng', () => {
    expect(groupTransferNote('Netflix Premium Gia đình', '2026-10')).toBe(
      'SUBCA Netflix Premium T10',
    );
  });

  it('link mời theo miền subca.app', () => {
    expect(inviteUrl('ABCD2345')).toBe('https://subca.app/j/ABCD2345');
  });
});
