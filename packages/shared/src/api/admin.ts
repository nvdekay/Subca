/**
 * Hợp đồng API cho Admin Console (`/admin/*`).
 *
 * Mọi endpoint yêu cầu tài khoản có trong bảng `admin_users`, đang bật, và phiên đăng nhập
 * **đã qua MFA** (`aal2`). Phân quyền theo `AdminRole`.
 */
import { z } from 'zod';
import { AdminRole, AuditSeverity, IntervalUnit, PriceReportStatus } from '../enums.js';
import { CurrencyCode } from '../money.js';
import type { IsoDate } from '../renewal.js';
import { MinorAmountString, type ServiceSummaryDto } from './subscription.js';

/** Quyền theo vai trò — dùng chung để API chặn và admin ẩn nút. */
export const ADMIN_PERMISSIONS = {
  /** Xem mọi trang. */
  read: ['OWNER', 'ADMIN', 'SUPPORT', 'MARKETING', 'VIEWER'],
  /** Khóa / mở khóa tài khoản, tặng Plus. */
  manageUsers: ['OWNER', 'ADMIN', 'SUPPORT'],
  /** Sửa thư viện dịch vụ, duyệt đề xuất giá. */
  manageCatalog: ['OWNER', 'ADMIN', 'MARKETING'],
  /** Xóa vĩnh viễn dữ liệu người dùng. */
  deleteUsers: ['OWNER', 'ADMIN'],
  /** Thêm / sửa / gỡ tài khoản quản trị. */
  manageTeam: ['OWNER'],
  /** Bật / tắt feature flag. */
  manageFlags: ['OWNER', 'ADMIN'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function adminCan(role: AdminRole, permission: AdminPermission): boolean {
  return (ADMIN_PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}

// ─────────────── Phiên đăng nhập admin ───────────────

export interface AdminMeDto {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

// ─────────────── Tổng quan ───────────────

export interface AdminOverviewDto {
  /** Tiền tệ quy đổi của mọi số tiền trong trang (VND). */
  currency: CurrencyCode;
  users: {
    total: number;
    /** Đăng ký trong 30 ngày qua. */
    new30d: number;
    /** Có hoạt động trong 7 ngày qua. */
    active7d: number;
    banned: number;
    plus: number;
  };
  subscriptions: {
    tracked: number;
    trial: number;
    cancelled30d: number;
    /** Tổng chi phí tháng của mọi gói đang theo dõi (đã quy đổi). */
    trackedMonthlyMinor: string;
    /** Tổng chi phí tháng của các gói người dùng đã hủy trong 30 ngày. */
    savedMonthlyMinor: string;
  };
  reminders: {
    sent7d: number;
    failed7d: number;
    /** Tỷ lệ mở thông báo 7 ngày qua (0–100, làm tròn). */
    openRate7d: number;
    pending: number;
  };
  groups: { total: number; members: number };
  /** Đăng ký mới theo ngày, 30 ngày gần nhất (cũ → mới). */
  signups: { date: IsoDate; count: number }[];
  /** Dịch vụ được theo dõi nhiều nhất. */
  topServices: { service: ServiceSummaryDto | null; name: string; count: number }[];
  /** Tiền tệ thiếu tỷ giá nên chưa cộng vào tổng. */
  missingRates: CurrencyCode[];
}

// ─────────────── Người dùng ───────────────

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'BANNED']).optional(),
  plan: z.enum(['FREE', 'PLUS']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type AdminUsersQuery = z.output<typeof AdminUsersQuerySchema>;

export interface AdminUserRowDto {
  id: string;
  email: string | null;
  displayName: string | null;
  plan: 'FREE' | 'PLUS';
  subscriptionCount: number;
  /** Chi tiêu theo dõi mỗi tháng (đã quy đổi về VND). */
  monthlyMinor: string;
  createdAt: string;
  lastActiveAt: string | null;
  bannedAt: string | null;
}

export interface AdminUsersDto {
  items: AdminUserRowDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetailDto extends AdminUserRowDto {
  banReason: string | null;
  referralCode: string;
  settings: { currency: CurrencyCode; timezone: string; notificationsEnabled: boolean } | null;
  entitlement: {
    product: string;
    store: string;
    status: string;
    startedAt: string;
    expiresAt: string | null;
  } | null;
  devices: { platform: string; deviceName: string | null; lastSeenAt: string | null }[];
  subscriptions: {
    id: string;
    name: string;
    service: ServiceSummaryDto | null;
    status: string;
    amountMinor: string;
    currency: CurrencyCode;
    nextRenewalDate: IsoDate | null;
  }[];
  reminders: { sent: number; failed: number; opened: number };
  groups: { id: string; name: string; isOwner: boolean; memberCount: number }[];
}

export const BanUserSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});
export type BanUser = z.infer<typeof BanUserSchema>;

export const GrantPlusSchema = z.object({
  /** Số tháng tặng; bỏ trống = trọn đời. */
  months: z.number().int().min(1).max(36).optional(),
  reason: z.string().trim().min(3).max(300),
});
export type GrantPlus = z.infer<typeof GrantPlusSchema>;

// ─────────────── Thư viện dịch vụ ───────────────

export const AdminServicesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  includeInactive: z.coerce.boolean().default(false),
});
export type AdminServicesQuery = z.output<typeof AdminServicesQuerySchema>;

export interface AdminServicePlanDto {
  id: string;
  name: string;
  amountMinor: string;
  currency: CurrencyCode;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  isFamily: boolean;
  maxMembers: number | null;
  isActive: boolean;
}

export interface AdminServiceDto {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  brandColor: string | null;
  website: string | null;
  cancelUrl: string | null;
  cancelSteps: string[];
  isActive: boolean;
  /** Số subscription đang theo dõi dịch vụ này. */
  subscriptionCount: number;
  plans: AdminServicePlanDto[];
  pendingReports: number;
}

const ServiceFields = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  name: z.string().trim().min(1).max(80),
  logoKey: z.string().trim().max(60).nullable().optional(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Màu dạng #RRGGBB')
    .nullable()
    .optional(),
  website: z.url().max(300).nullable().optional(),
  cancelUrl: z.url().max(300).nullable().optional(),
  cancelSteps: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
  isActive: z.boolean().default(true),
});

export const CreateServiceSchema = ServiceFields;
export type CreateService = z.output<typeof CreateServiceSchema>;

export const UpdateServiceSchema = ServiceFields.partial().refine(
  (d) => Object.keys(d).length > 0,
  'Không có trường nào để cập nhật',
);
export type UpdateService = z.infer<typeof UpdateServiceSchema>;

export const UpsertServicePlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountMinor: MinorAmountString,
  currency: CurrencyCode.default('VND'),
  intervalUnit: IntervalUnit.default('MONTH'),
  intervalCount: z.number().int().min(1).max(36).default(1),
  isFamily: z.boolean().default(false),
  maxMembers: z.number().int().min(2).max(10).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type UpsertServicePlan = z.output<typeof UpsertServicePlanSchema>;

// ─────────────── Đề xuất giá ───────────────

export const PriceReportsQuerySchema = z.object({
  status: PriceReportStatus.default('PENDING'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type PriceReportsQuery = z.output<typeof PriceReportsQuerySchema>;

export interface PriceReportDto {
  id: string;
  service: { id: string; name: string; slug: string };
  plan: { id: string; name: string; amountMinor: string; currency: CurrencyCode } | null;
  reportedAmountMinor: string;
  currency: CurrencyCode;
  note: string | null;
  status: PriceReportStatus;
  reportedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PriceReportsDto {
  items: PriceReportDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const ReviewPriceReportSchema = z.object({
  /** Duyệt = cập nhật giá gói theo đề xuất; từ chối = chỉ đánh dấu. */
  decision: z.enum(['APPROVE', 'REJECT']),
});
export type ReviewPriceReport = z.infer<typeof ReviewPriceReportSchema>;

// ─────────────── Nhân sự & phân quyền ───────────────

/** Mật khẩu admin: đủ dài và có đủ loại ký tự vì đây là cửa vào dữ liệu người dùng. */
export const AdminPasswordSchema = z
  .string()
  .min(12, 'Mật khẩu ít nhất 12 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .refine((v) => /[a-z]/.test(v), 'Cần ít nhất một chữ thường')
  .refine((v) => /[A-Z]/.test(v), 'Cần ít nhất một chữ hoa')
  .refine((v) => /\d/.test(v), 'Cần ít nhất một chữ số');

export const CreateAdminSchema = z.object({
  email: z.email().max(160),
  name: z.string().trim().min(1).max(80),
  role: AdminRole.exclude(['OWNER']).default('VIEWER'),
  password: AdminPasswordSchema,
});
export type CreateAdmin = z.output<typeof CreateAdminSchema>;

export const UpdateAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    role: AdminRole,
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdateAdmin = z.infer<typeof UpdateAdminSchema>;

export const SetAdminPasswordSchema = z.object({ password: AdminPasswordSchema });
export type SetAdminPassword = z.infer<typeof SetAdminPasswordSchema>;

export interface AdminTeamMemberDto {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  /** Chính mình — giao diện chặn tự hạ quyền hoặc tự tắt tài khoản. */
  isMe: boolean;
}

export interface AdminTeamDto {
  items: AdminTeamMemberDto[];
  /** Thiếu `SUPABASE_SERVICE_ROLE_KEY` thì không tạo được tài khoản mới / đổi mật khẩu. */
  canCreateAccounts: boolean;
}

// ─────────────── Hàng đợi nhắc ───────────────

export interface AdminQueueDto {
  name: string;
  /** Có kết nối được Redis không; false thì các số bên dưới là 0. */
  connected: boolean;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
  /** Job lỗi gần nhất để dò nguyên nhân. */
  recentFailed: {
    id: string;
    reminderId: string | null;
    attemptsMade: number;
    failedReason: string | null;
    finishedAt: string | null;
  }[];
  /** Lượt nhắc theo trạng thái trong 7 ngày gần nhất. */
  reminders7d: { status: string; count: number }[];
}

// ─────────────── Sức khỏe hệ thống ───────────────

export interface AdminHealthCheckDto {
  key: 'database' | 'redis' | 'reminders' | 'exchangeRates' | 'push';
  label: string;
  status: 'ok' | 'warn' | 'down';
  detail: string;
}

export interface AdminSystemDto {
  checks: AdminHealthCheckDto[];
  api: {
    env: string;
    /** Giây kể từ lúc tiến trình API khởi động. */
    uptimeSeconds: number;
    remindersEnabled: boolean;
    fxSyncEnabled: boolean;
    adminRequireMfa: boolean;
  };
}

// ─────────────── Sử dụng tính năng ───────────────

export interface FeatureUsageRowDto {
  key: string;
  label: string;
  /** Số người dùng đã dùng tính năng. */
  users: number;
  /** Phần trăm trên tổng người dùng (0–100, làm tròn). */
  percent: number;
  note?: string;
}

export interface FeatureFlagDto {
  key: string;
  description: string | null;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AdminFeaturesDto {
  totalUsers: number;
  usage: FeatureUsageRowDto[];
  flags: FeatureFlagDto[];
}

export const UpdateFeatureFlagSchema = z.object({ enabled: z.boolean() });
export type UpdateFeatureFlag = z.infer<typeof UpdateFeatureFlagSchema>;

// ─────────────── Nhật ký thao tác ───────────────

export const AuditLogsQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  severity: AuditSeverity.optional(),
  targetId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type AuditLogsQuery = z.output<typeof AuditLogsQuerySchema>;

export interface AuditLogDto {
  id: string;
  actorType: 'ADMIN' | 'SYSTEM';
  actor: { id: string; name: string; email: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  severity: AuditSeverity;
  createdAt: string;
}

export interface AuditLogsDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Tên thao tác ghi vào nhật ký (dùng chung để lọc ở admin). */
export const AUDIT_ACTIONS = {
  userBan: 'user.ban',
  userUnban: 'user.unban',
  userGrantPlus: 'user.grant_plus',
  userDelete: 'user.delete',
  serviceCreate: 'service.create',
  serviceUpdate: 'service.update',
  servicePlanUpsert: 'service_plan.upsert',
  priceReportApprove: 'price_report.approve',
  priceReportReject: 'price_report.reject',
  adminCreate: 'admin.create',
  adminUpdate: 'admin.update',
  adminPassword: 'admin.password',
  adminRemove: 'admin.remove',
  featureFlagUpdate: 'feature_flag.update',
} as const;
