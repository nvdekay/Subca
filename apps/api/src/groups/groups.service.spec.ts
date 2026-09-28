import type { GroupMember, GroupPayment } from '../generated/prisma/client.js';
import {
  activeMembers,
  cycleDto,
  isOpen,
  type GroupRow,
} from './groups.service.js';

const member = (over: Partial<GroupMember>): GroupMember =>
  ({
    id: 'm1',
    groupId: 'g1',
    userId: null,
    displayName: 'Thành viên',
    role: 'MEMBER',
    status: 'ACTIVE',
    customShareMinor: null,
    invitedAt: new Date('2026-09-01T00:00:00Z'),
    joinedAt: null,
    leftAt: null,
    ...over,
  }) as GroupMember;

const payment = (over: Partial<GroupPayment>): GroupPayment =>
  ({
    id: 'p1',
    cycleId: 'c1',
    groupId: 'g1',
    memberId: 'm1',
    amountMinor: 65000n,
    status: 'PENDING',
    claimedAt: null,
    confirmedAt: null,
    lastRemindedAt: null,
    createdAt: new Date(),
    ...over,
  }) as GroupPayment;

describe('activeMembers', () => {
  it('chủ nhóm lên đầu, còn lại theo thứ tự được mời, bỏ người đã rời nhóm', () => {
    const group = {
      members: [
        member({ id: 'b', invitedAt: new Date('2026-09-03T00:00:00Z') }),
        member({ id: 'left', status: 'LEFT' }),
        member({
          id: 'owner',
          role: 'OWNER',
          invitedAt: new Date('2026-09-10T00:00:00Z'),
        }),
        member({ id: 'a', invitedAt: new Date('2026-09-02T00:00:00Z') }),
      ],
    } as GroupRow;
    expect(activeMembers(group).map((m) => m.id)).toEqual(['owner', 'a', 'b']);
  });
});

describe('cycleDto', () => {
  it('cộng số cần thu, đã thu và số người đã xong', () => {
    const dto = cycleDto('2026-09', '2026-09-28', [
      payment({ id: '1', status: 'CONFIRMED' }),
      payment({ id: '2', status: 'CLAIMED_PAID' }),
      payment({ id: '3', status: 'PENDING' }),
      payment({ id: '4', status: 'WAIVED' }),
    ]);
    expect(dto).toEqual({
      period: '2026-09',
      dueDate: '2026-09-28',
      expectedMinor: '260000',
      // Chỉ khoản đã xác nhận mới tính là thu được
      collectedMinor: '65000',
      // Đã xác nhận + được miễn = xong
      paidCount: 2,
      payerCount: 4,
    });
  });

  it('kỳ chưa có ai phải trả', () => {
    expect(cycleDto('2026-09', '2026-09-28', [])).toMatchObject({
      expectedMinor: '0',
      collectedMinor: '0',
      paidCount: 0,
      payerCount: 0,
    });
  });
});

describe('isOpen', () => {
  it('chủ nhóm còn chờ tiền khi khoản chưa trả hoặc mới báo đã chuyển', () => {
    expect(isOpen(payment({ status: 'PENDING' }))).toBe(true);
    expect(isOpen(payment({ status: 'CLAIMED_PAID' }))).toBe(true);
    expect(isOpen(payment({ status: 'CONFIRMED' }))).toBe(false);
    expect(isOpen(payment({ status: 'WAIVED' }))).toBe(false);
  });
});
