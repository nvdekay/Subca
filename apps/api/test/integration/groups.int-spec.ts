import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { todayInTimeZone } from '@subca/shared';
import { FxService } from '../../src/fx/fx.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { GroupNotifier } from '../../src/groups/group-notifier.service.js';
import { GroupPaymentsService } from '../../src/groups/group-payments.service.js';
import { GroupsService } from '../../src/groups/groups.service.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service.js';

/**
 * Chia tiền nhóm trên database thật: chủ nhóm tạo nhóm từ gói đang trả, thành viên vào
 * bằng mã mời, báo đã chuyển, chủ nhóm xác nhận. Tự dọn 2 profile tạm khi xong.
 */
describe('Chia tiền nhóm trên database thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const notified: { userId: string; title: string }[] = [];
  const notifier = {
    notify: async (userId: string, n: { title: string }) => {
      notified.push({ userId, title: n.title });
    },
  } as unknown as GroupNotifier;
  const groups = new GroupsService(db, new PlanService(db), new FxService(db));
  const payments = new GroupPaymentsService(db, groups, notifier);
  const subs = new SubscriptionsService(db, new PlanService(db));

  const ownerId = randomUUID();
  const friendId = randomUUID();
  const today = todayInTimeZone('Asia/Ho_Chi_Minh');
  const thisMonth = today.slice(0, 7);
  let groupId = '';
  let inviteCode = '';

  beforeAll(async () => {
    await prisma.profile.createMany({
      data: [
        { id: ownerId, displayName: 'Khánh' },
        { id: friendId, displayName: 'Thùy Linh' },
      ],
    });
    await prisma.userSettings.createMany({
      data: [{ userId: ownerId }, { userId: friendId }],
    });
  });

  afterAll(async () => {
    await prisma.profile
      .deleteMany({ where: { id: { in: [ownerId, friendId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('tạo nhóm từ gói đang trả: lấy tên, giá, hạn chuyển và chia đều cho 4 người', async () => {
    const sub = await subs.create(ownerId, {
      customName: 'Netflix Premium',
      amountMinor: '260000',
      currency: 'VND',
      intervalUnit: 'MONTH',
      intervalCount: 1,
      billingDate: `${thisMonth}-20`,
      isTrial: false,
      autoRenew: true,
    });
    const group = await groups.create(ownerId, {
      subscriptionId: sub.id,
      memberCount: 4,
      memberNames: ['Thùy Linh'],
      payout: {
        bankBin: '970422',
        bankName: 'MB Bank',
        accountNo: '0901234567',
        accountName: 'NGUYEN KHANH',
      },
    });
    groupId = group.id;
    inviteCode = group.inviteCode;

    expect(group).toMatchObject({
      name: 'Netflix Premium',
      totalAmountMinor: '260000',
      currency: 'VND',
      dueDay: 20,
      isOwner: true,
      splitMode: 'EQUAL',
      splitDiffMinor: '0',
      subscriptionId: sub.id,
    });
    expect(group.members).toHaveLength(4);
    expect(group.members[0]).toMatchObject({
      role: 'OWNER',
      isMe: true,
      status: 'ACTIVE',
    });
    expect(group.members[1]).toMatchObject({
      displayName: 'Thùy Linh',
      status: 'INVITED',
    });
    expect(group.members[3]).toMatchObject({ displayName: 'Chờ tham gia' });
    // 260.000 / 4 = 65.000, tổng các phần luôn khớp giá gói
    expect(group.members.map((m) => m.shareMinor)).toEqual([
      '65000',
      '65000',
      '65000',
      '65000',
    ]);
    // Kỳ thu tháng này được tạo sẵn cho 3 người phải trả
    expect(group.cycle).toMatchObject({
      period: thisMonth,
      dueDate: `${thisMonth}-20`,
      expectedMinor: '195000',
      collectedMinor: '0',
      payerCount: 3,
      paidCount: 0,
    });
    expect(group.inviteUrl).toBe(`https://subca.app/j/${inviteCode}`);
    expect(group.vietQrPayload).toContain('0006970422');
    expect(group.transferNote).toBe(
      `SUBCA Netflix Premium T${Number(thisMonth.slice(5, 7))}`,
    );
  });

  it('gói Free chỉ tạo được 1 nhóm', async () => {
    await expect(
      groups.create(ownerId, {
        name: 'Spotify Family',
        totalAmountMinor: '165000',
        currency: 'VND',
        memberCount: 3,
      }),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_REACHED' } });
  });

  it('người ngoài nhóm không xem được nhóm', async () => {
    await expect(groups.get(friendId, groupId)).rejects.toMatchObject({
      response: { code: 'GROUP_NOT_FOUND' },
    });
  });

  it('vào nhóm bằng mã mời thì nhận chỗ trống đầu tiên', async () => {
    const joined = await groups.join(friendId, { inviteCode });
    expect(joined.isOwner).toBe(false);
    const me = joined.members.find((m) => m.isMe)!;
    expect(me).toMatchObject({
      displayName: 'Thùy Linh',
      status: 'ACTIVE',
      shareMinor: '65000',
    });
    expect(me.payment).toMatchObject({
      status: 'PENDING',
      amountMinor: '65000',
    });
    // Thành viên thấy QR đúng phần của mình và thông tin nhận tiền của chủ nhóm
    expect(joined.payout).toMatchObject({ accountNo: '0901234567' });
    expect(joined.vietQrPayload).toContain('540565000');
    // Vào lại bằng mã cũ không tạo thêm chỗ
    expect((await groups.join(friendId, { inviteCode })).members).toHaveLength(
      4,
    );
  });

  it('thành viên báo đã chuyển, chủ nhóm được thông báo rồi xác nhận', async () => {
    const before = await groups.get(friendId, groupId);
    const paymentId = before.members.find((m) => m.isMe)!.payment!.id;

    const claimed = await payments.claim(friendId, groupId, paymentId);
    expect(claimed.members.find((m) => m.isMe)!.payment).toMatchObject({
      status: 'CLAIMED_PAID',
    });
    expect(notified.at(-1)).toMatchObject({
      userId: ownerId,
      title: 'Thùy Linh đã chuyển 65.000đ',
    });
    // Báo hai lần không được, khoản đang chờ xác nhận
    await expect(
      payments.claim(friendId, groupId, paymentId),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_ALREADY_DONE' },
    });

    // Thành viên không xác nhận thay chủ nhóm được
    await expect(
      payments.confirm(friendId, groupId, paymentId),
    ).rejects.toMatchObject({
      response: { code: 'NOT_GROUP_OWNER' },
    });

    const confirmed = await payments.confirm(ownerId, groupId, paymentId);
    expect(confirmed.cycle).toMatchObject({
      collectedMinor: '65000',
      paidCount: 1,
      payerCount: 3,
    });
    expect(notified.at(-1)).toMatchObject({ userId: friendId });
  });

  it('nhắc: chỉ nhắc được người đã tham gia, và không nhắc dồn trong vài giờ', async () => {
    const detail = await groups.get(ownerId, groupId);
    const waiting = detail.members.find((m) => m.status === 'INVITED')!;
    await expect(
      payments.remind(ownerId, groupId, waiting.payment!.id),
    ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_JOINED' } });

    // Người đã tham gia nhưng đã xác nhận trả rồi → không còn gì để nhắc
    const paid = detail.members.find((m) => m.payment?.status === 'CONFIRMED')!;
    await expect(
      payments.remind(ownerId, groupId, paid.payment!.id),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_ALREADY_DONE' },
    });

    // Mở lại khoản đã xác nhận rồi nhắc: lần đầu được, lần hai bị chặn
    await payments.reopen(ownerId, groupId, paid.payment!.id);
    const reminded = await payments.remind(ownerId, groupId, paid.payment!.id);
    expect(
      reminded.members.find((m) => m.payment?.id === paid.payment!.id)!.payment!
        .lastRemindedAt,
    ).not.toBeNull();
    expect(notified.at(-1)).toMatchObject({
      userId: friendId,
      title: 'Bạn chưa trả Khánh 65.000đ',
    });
    await expect(
      payments.remind(ownerId, groupId, paid.payment!.id),
    ).rejects.toMatchObject({
      response: { code: 'REMIND_TOO_SOON' },
    });

    // Nhắc tất cả: 2 người chưa tham gia và 1 người vừa nhắc → bỏ qua hết
    expect(await payments.remindAll(ownerId, groupId)).toEqual({
      reminded: 0,
      skipped: 3,
    });
  });

  it('chia tùy chỉnh: tổng phải khớp giá gói, khoản chưa trả được cập nhật theo', async () => {
    const detail = await groups.get(ownerId, groupId);
    const ids = detail.members.map((m) => m.id);
    await expect(
      groups.setSplit(ownerId, groupId, {
        splitMode: 'CUSTOM',
        shares: ids.map((memberId) => ({ memberId, amountMinor: '50000' })),
      }),
    ).rejects.toMatchObject({ response: { code: 'SPLIT_TOTAL_MISMATCH' } });

    const custom = await groups.setSplit(ownerId, groupId, {
      splitMode: 'CUSTOM',
      shares: [
        { memberId: ids[0]!, amountMinor: '110000' },
        { memberId: ids[1]!, amountMinor: '50000' },
        { memberId: ids[2]!, amountMinor: '50000' },
        { memberId: ids[3]!, amountMinor: '50000' },
      ],
    });
    expect(custom.splitMode).toBe('CUSTOM');
    expect(custom.splitDiffMinor).toBe('0');
    expect(custom.myShareMinor).toBe('110000');
    expect(custom.cycle.expectedMinor).toBe('150000');
    // Chủ nhóm chia tùy chỉnh thì QR không điền sẵn số tiền (mỗi người một số khác nhau)
    expect(custom.vietQrPayload).not.toContain('5405');

    const back = await groups.setSplit(ownerId, groupId, {
      splitMode: 'EQUAL',
    });
    expect(back.members.map((m) => m.shareMinor)).toEqual([
      '65000',
      '65000',
      '65000',
      '65000',
    ]);
  });

  it('tổng quan: chủ nhóm thấy khoản sẽ nhận, thành viên thấy khoản cần trả', async () => {
    const ownerView = await groups.overview(ownerId);
    expect(ownerView.owned).toHaveLength(1);
    expect(ownerView.joined).toHaveLength(0);
    expect(ownerView.ownedLimit).toBe(1);
    expect(ownerView.owned[0]).toMatchObject({
      name: 'Netflix Premium',
      isOwner: true,
      subscriptionId: expect.any(String),
      myShareMinor: '65000',
      memberCount: 4,
      payerCount: 3,
    });
    // 3 người phải trả, chưa ai trả xong (khoản vừa mở lại) → chờ 195.000đ
    expect(ownerView.incomingMinor).toBe('195000');
    expect(ownerView.incomingPeople).toBe(3);
    expect(ownerView.outgoingMinor).toBe('0');

    const friendView = await groups.overview(friendId);
    expect(friendView.joined[0]).toMatchObject({
      isOwner: false,
      ownerName: 'Khánh',
      myPaymentStatus: 'PENDING',
      myShareMinor: '65000',
    });
    expect(friendView.outgoingMinor).toBe('65000');
    expect(friendView.outgoingGroups).toBe(1);
  });

  it('gỡ thành viên: xóa khoản chưa trả, chủ nhóm không rời được nhóm', async () => {
    const detail = await groups.get(ownerId, groupId);
    const owner = detail.members.find((m) => m.role === 'OWNER')!;
    await expect(
      groups.removeMember(ownerId, groupId, owner.id),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });

    const friend = detail.members.find(
      (m) => m.isMe === false && m.status === 'ACTIVE',
    )!;
    await groups.removeMember(ownerId, groupId, friend.id);
    const after = await groups.get(ownerId, groupId);
    expect(after.members).toHaveLength(3);
    expect(after.cycle.payerCount).toBe(2);
    // Chia đều lại cho 3 người còn lại
    expect(after.members.map((m) => m.shareMinor)).toEqual([
      '86667',
      '86667',
      '86666',
    ]);
    await expect(groups.get(friendId, groupId)).rejects.toMatchObject({
      response: { code: 'GROUP_NOT_FOUND' },
    });
  });

  it('xóa nhóm thì không còn trong tổng quan', async () => {
    await groups.archive(ownerId, groupId);
    expect((await groups.overview(ownerId)).owned).toHaveLength(0);
  });
});
