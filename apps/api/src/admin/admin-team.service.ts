import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type AdminTeamDto,
  type AdminTeamMemberDto,
  type CreateAdmin,
  type SetAdminPassword,
  type UpdateAdmin,
} from '@subca/shared';
import { SupabaseAdminClient } from '../auth/supabase-admin.js';
import type { AdminUser } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

/**
 * Trang Nhân sự & phân quyền. Tài khoản đăng nhập nằm ở Supabase Auth (email + mật khẩu),
 * còn quyền quản trị nằm ở bảng `admin_users` — gỡ quyền không xóa tài khoản đăng nhập.
 */
@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminClient,
    private readonly audit: AuditService,
  ) {}

  async list(current: AdminUser): Promise<AdminTeamDto> {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return {
      items: rows.map((row) => toDto(row, current.id)),
      canCreateAccounts: this.supabaseAdmin.configured,
    };
  }

  async create(
    actor: AdminUser,
    input: CreateAdmin,
    ip: string | null,
  ): Promise<AdminTeamMemberDto> {
    this.assertCanCreateAccounts();
    const email = input.email.trim().toLowerCase();
    const taken = await this.prisma.adminUser.count({ where: { email } });
    if (taken) {
      throw badRequest(
        'ADMIN_EMAIL_TAKEN',
        `${email} đã là tài khoản quản trị`,
        'email',
      );
    }

    // Tài khoản đăng nhập có thể đã tồn tại (người này đang dùng app) → dùng lại, chỉ cấp quyền
    const existing = await this.prisma.profile.findFirst({
      where: { email },
      select: { id: true },
    });
    let userId = existing?.id;
    if (userId) {
      await this.supabaseAdmin.setPassword(userId, input.password);
    } else {
      userId = await this.supabaseAdmin.createUser(email, input.password);
    }

    const created = await this.prisma.adminUser.create({
      data: { id: userId, email, name: input.name, role: input.role },
    });
    await this.audit.log(actor, {
      action: AUDIT_ACTIONS.adminCreate,
      targetType: 'admin_user',
      targetId: created.id,
      metadata: { email, role: created.role, reusedAccount: Boolean(existing) },
      severity: 'CRITICAL',
      ip,
    });
    return toDto(created, actor.id);
  }

  async update(
    actor: AdminUser,
    id: string,
    input: UpdateAdmin,
    ip: string | null,
  ): Promise<AdminTeamMemberDto> {
    const target = await this.find(id);
    // Không tự hạ quyền / tự tắt tài khoản của mình: tránh khóa hết đường vào trang quản trị
    if (
      target.id === actor.id &&
      (input.role !== undefined || input.isActive === false)
    ) {
      throw badRequest(
        'CANNOT_EDIT_SELF',
        'Không đổi được vai trò hay tắt chính tài khoản của bạn. Nhờ một OWNER khác làm.',
      );
    }
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      throw badRequest(
        'CANNOT_EDIT_OWNER',
        'Chỉ OWNER mới sửa được tài khoản OWNER khác',
      );
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    await this.audit.log(actor, {
      action: AUDIT_ACTIONS.adminUpdate,
      targetType: 'admin_user',
      targetId: id,
      metadata: { ...input, email: updated.email },
      severity: 'SENSITIVE',
      ip,
    });
    return toDto(updated, actor.id);
  }

  async setPassword(
    actor: AdminUser,
    id: string,
    input: SetAdminPassword,
    ip: string | null,
  ): Promise<void> {
    this.assertCanCreateAccounts();
    const target = await this.find(id);
    await this.supabaseAdmin.setPassword(target.id, input.password);
    await this.audit.log(actor, {
      action: AUDIT_ACTIONS.adminPassword,
      targetType: 'admin_user',
      targetId: id,
      metadata: { email: target.email, self: target.id === actor.id },
      severity: 'CRITICAL',
      ip,
    });
  }

  /** Gỡ quyền quản trị; tài khoản đăng nhập vẫn còn để người đó dùng app như thường. */
  async remove(actor: AdminUser, id: string, ip: string | null): Promise<void> {
    const target = await this.find(id);
    if (target.id === actor.id) {
      throw badRequest('CANNOT_EDIT_SELF', 'Không tự gỡ quyền của mình được');
    }
    if (target.role === 'OWNER') {
      const owners = await this.prisma.adminUser.count({
        where: { role: 'OWNER', isActive: true },
      });
      if (owners <= 1) {
        throw badRequest(
          'LAST_OWNER',
          'Phải còn ít nhất một OWNER đang hoạt động',
        );
      }
    }
    await this.prisma.adminUser.delete({ where: { id } });
    await this.audit.log(actor, {
      action: AUDIT_ACTIONS.adminRemove,
      targetType: 'admin_user',
      targetId: id,
      metadata: { email: target.email, role: target.role },
      severity: 'CRITICAL',
      ip,
    });
  }

  private assertCanCreateAccounts(): void {
    if (!this.supabaseAdmin.configured) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'ADMIN_ACCOUNTS_UNAVAILABLE',
        message:
          'Máy chủ chưa có SUPABASE_SERVICE_ROLE_KEY nên không tạo được tài khoản hay đổi mật khẩu.',
      });
    }
  }

  private async find(id: string): Promise<AdminUser> {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ADMIN_NOT_FOUND',
        message: 'Không tìm thấy tài khoản quản trị',
      });
    }
    return row;
  }
}

function toDto(row: AdminUser, currentId: string): AdminTeamMemberDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    isMe: row.id === currentId,
  };
}

function badRequest(
  code: string,
  message: string,
  field?: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code,
    message,
    ...(field ? { issues: [{ path: field, message }] } : {}),
  });
}
