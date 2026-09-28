/**
 * Hợp đồng API cho Chia tiền nhóm: chủ nhóm tạo nhóm từ một subscription đang trả,
 * mời 1–5 người, mỗi tháng nhóm có một "kỳ thu" và mỗi thành viên có một khoản phải trả.
 *
 * Tiền đi qua API dưới dạng chuỗi số nguyên theo đơn vị nhỏ nhất (xem `subscription.ts`).
 */
import { z } from 'zod';
import { GroupPaymentStatus, SplitMode } from '../enums.js';
import { CurrencyCode, splitEvenly } from '../money.js';
import type { IsoDate } from '../renewal.js';
import { MinorAmountString, type ServiceSummaryDto } from './subscription.js';

/** Tối đa 6 người (gồm chủ nhóm) — bằng giới hạn gói gia đình của phần lớn dịch vụ. */
export const MAX_GROUP_MEMBERS = 6;
/** Miền của link mời; khớp Universal Links / App Links. */
export const INVITE_BASE_URL = 'https://subca.app/j/';

export const inviteUrl = (code: string): string => INVITE_BASE_URL + code;

// ─────────────── Đầu vào ───────────────

const BankBin = z.string().regex(/^\d{6}$/, 'Mã ngân hàng (BIN) phải là 6 số');
const AccountNo = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z]{4,19}$/, 'Số tài khoản chỉ gồm chữ và số, 4–19 ký tự');

/** Thông tin nhận tiền của chủ nhóm để sinh mã QR VietQR. */
export const PayoutSchema = z.object({
  bankBin: BankBin,
  bankName: z.string().trim().min(1).max(60).optional(),
  accountNo: AccountNo,
  accountName: z.string().trim().min(1).max(60),
});
export type PayoutInput = z.infer<typeof PayoutSchema>;

/** Ngày 1–28 để tháng nào cũng có hạn chuyển tiền. */
const DueDay = z.number().int().min(1).max(28);
const MemberName = z.string().trim().min(1).max(40);

export const CreateGroupSchema = z
  .object({
    /** Gói đang trả để chia; bỏ trống thì phải nhập `name` + `totalAmountMinor` + `currency`. */
    subscriptionId: z.uuid().optional(),
    name: z.string().trim().min(1).max(60).optional(),
    totalAmountMinor: MinorAmountString.optional(),
    currency: CurrencyCode.optional(),
    /** Tổng số người dùng chung, tính cả chủ nhóm. */
    memberCount: z.number().int().min(2).max(MAX_GROUP_MEMBERS),
    /** Tên các thành viên khác (không gồm chủ nhóm); thiếu thì để chỗ trống chờ tham gia. */
    memberNames: z
      .array(MemberName)
      .max(MAX_GROUP_MEMBERS - 1)
      .optional(),
    dueDay: DueDay.optional(),
    payout: PayoutSchema.optional(),
  })
  .refine((d) => Boolean(d.subscriptionId) || Boolean(d.name && d.totalAmountMinor && d.currency), {
    message: 'Chọn một gói đang trả, hoặc nhập tên và giá gói',
    path: ['subscriptionId'],
  })
  .refine((d) => (d.memberNames?.length ?? 0) <= d.memberCount - 1, {
    message: 'Số tên thành viên nhiều hơn số người trong nhóm',
    path: ['memberNames'],
  });
export type CreateGroupInput = z.input<typeof CreateGroupSchema>;
export type CreateGroup = z.output<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    totalAmountMinor: MinorAmountString.refine((s) => BigInt(s) > 0n, 'Giá gói phải lớn hơn 0'),
    currency: CurrencyCode,
    dueDay: DueDay,
    /** null = xóa thông tin nhận tiền (không hiện QR nữa). */
    payout: PayoutSchema.nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdateGroup = z.infer<typeof UpdateGroupSchema>;

/**
 * Cách chia tiền. `CUSTOM` phải gửi phần của **mọi** thành viên (kể cả chủ nhóm)
 * và tổng phải khớp giá gói.
 */
export const SetSplitSchema = z.discriminatedUnion('splitMode', [
  z.object({ splitMode: z.literal(SplitMode.enum.EQUAL) }),
  z.object({
    splitMode: z.literal(SplitMode.enum.CUSTOM),
    shares: z
      .array(z.object({ memberId: z.uuid(), amountMinor: MinorAmountString }))
      .min(2)
      .max(MAX_GROUP_MEMBERS)
      .refine(
        (a) => new Set(a.map((s) => s.memberId)).size === a.length,
        'Mỗi thành viên chỉ được một phần',
      ),
  }),
]);
export type SetSplit = z.infer<typeof SetSplitSchema>;

export const AddGroupMemberSchema = z.object({ displayName: MemberName });
export type AddGroupMember = z.infer<typeof AddGroupMemberSchema>;

export const UpdateGroupMemberSchema = z.object({ displayName: MemberName });
export type UpdateGroupMember = z.infer<typeof UpdateGroupMemberSchema>;

/** Mã mời: chỉ chữ in hoa và số, không dùng ký tự dễ đọc lẫn (0/O, 1/I). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

export const JoinGroupSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine(
      (s) => new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(s),
      'Mã mời không hợp lệ',
    ),
});
export type JoinGroup = z.output<typeof JoinGroupSchema>;

export const GroupHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(6),
});
export type GroupHistoryQuery = z.output<typeof GroupHistoryQuerySchema>;

// ─────────────── Trả về ───────────────

export interface GroupPayoutDto {
  bankBin: string;
  bankName: string | null;
  accountNo: string;
  accountName: string;
}

export interface GroupPaymentDto {
  id: string;
  status: GroupPaymentStatus;
  amountMinor: string;
  claimedAt: string | null;
  confirmedAt: string | null;
  lastRemindedAt: string | null;
}

export interface GroupMemberDto {
  id: string;
  displayName: string;
  role: 'OWNER' | 'MEMBER';
  /** INVITED = đã có chỗ nhưng chưa ai tham gia (hiện "Đã gửi link mời"). */
  status: 'INVITED' | 'ACTIVE' | 'LEFT';
  isMe: boolean;
  /** Phần phải trả theo cách chia hiện tại. */
  shareMinor: string;
  /** Khoản phải trả của kỳ đang thu; null với chủ nhóm (người thu tiền). */
  payment: GroupPaymentDto | null;
}

/** Một kỳ thu (mỗi tháng một kỳ). `period` dạng YYYY-MM. */
export interface GroupCycleDto {
  period: string;
  dueDate: IsoDate;
  /** Tổng cần thu từ các thành viên (không tính phần của chủ nhóm). */
  expectedMinor: string;
  /** Đã thu (các khoản CONFIRMED). */
  collectedMinor: string;
  paidCount: number;
  payerCount: number;
}

export interface GroupCardDto {
  id: string;
  name: string;
  service: ServiceSummaryDto | null;
  /** Gói đang được chia; app dùng để không mời chia lại gói đã có nhóm. */
  subscriptionId: string | null;
  isOwner: boolean;
  ownerName: string;
  totalAmountMinor: string;
  currency: CurrencyCode;
  dueDate: IsoDate;
  /** Phần của người đang xem (chủ nhóm cũng có phần của mình). */
  myShareMinor: string;
  /** Khoản phải trả của người đang xem trong kỳ này; null nếu là chủ nhóm. */
  myPaymentStatus: GroupPaymentStatus | null;
  memberCount: number;
  paidCount: number;
  payerCount: number;
  members: {
    id: string;
    displayName: string;
    status: 'INVITED' | 'ACTIVE' | 'LEFT';
    isMe: boolean;
  }[];
}

export interface GroupsOverviewDto {
  currency: CurrencyCode;
  /** Tổng sẽ nhận từ những người chưa trả (các nhóm mình làm chủ), quy đổi về tiền tệ chính. */
  incomingMinor: string;
  incomingPeople: number;
  /** Tổng mình còn phải trả cho các nhóm mình tham gia. */
  outgoingMinor: string;
  outgoingGroups: number;
  owned: GroupCardDto[];
  joined: GroupCardDto[];
  /** Giới hạn số nhóm được làm chủ của gói Free; null khi có Plus. */
  ownedLimit: number | null;
  missingRates: CurrencyCode[];
}

export interface GroupDetailDto {
  id: string;
  name: string;
  service: ServiceSummaryDto | null;
  subscriptionId: string | null;
  isOwner: boolean;
  ownerName: string;
  totalAmountMinor: string;
  currency: CurrencyCode;
  splitMode: 'EQUAL' | 'CUSTOM';
  dueDay: number;
  maxMembers: number;
  inviteCode: string;
  inviteUrl: string;
  /** Chỉ chủ nhóm mới đặt được; thành viên đọc để chuyển khoản. */
  payout: GroupPayoutDto | null;
  /** Tổng các phần chia so với giá gói: dương = còn thiếu, âm = đang dư. */
  splitDiffMinor: string;
  myShareMinor: string;
  cycle: GroupCycleDto;
  members: GroupMemberDto[];
  /** Chuỗi dữ liệu QR VietQR cho phần của người đang xem; null khi chưa có thông tin nhận tiền. */
  vietQrPayload: string | null;
  /** Nội dung chuyển khoản gợi ý, VD "SUBCA NETFLIX T10". */
  transferNote: string | null;
  history: GroupCycleDto[];
}

// ─────────────── Logic dùng chung ───────────────

export interface ShareInput {
  id: string;
  customShareMinor?: bigint | null;
}

/**
 * Phần phải trả của từng thành viên. `EQUAL` chia đều (phần lẻ dồn cho người đầu),
 * `CUSTOM` lấy số đã nhập, ai chưa nhập thì tạm tính theo chia đều.
 */
export function computeShares<T extends ShareInput>(
  totalMinor: bigint,
  members: readonly T[],
  splitMode: 'EQUAL' | 'CUSTOM',
): Map<string, bigint> {
  const even = splitEvenly(totalMinor, Math.max(members.length, 1));
  const shares = new Map<string, bigint>();
  members.forEach((m, i) => {
    const custom = splitMode === 'CUSTOM' ? m.customShareMinor : null;
    shares.set(m.id, custom ?? even[i] ?? 0n);
  });
  return shares;
}

/** Nội dung chuyển khoản: "SUBCA <TÊN NHÓM> T<tháng>" (tên nhóm lấy 1–2 từ đầu). */
export function groupTransferNote(groupName: string, period: string): string {
  const short = groupName.split(/\s+/).slice(0, 2).join(' ');
  return `SUBCA ${short} T${Number(period.slice(5, 7))}`;
}
