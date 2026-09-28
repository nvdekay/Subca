import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_PERMISSIONS,
  CreateAdminSchema,
  SetAdminPasswordSchema,
  UpdateAdminSchema,
  UpdateFeatureFlagSchema,
  AdminServicesQuerySchema,
  AdminUsersQuerySchema,
  AuditLogsQuerySchema,
  BanUserSchema,
  CreateServiceSchema,
  GrantPlusSchema,
  PriceReportsQuerySchema,
  ReviewPriceReportSchema,
  UpdateServiceSchema,
  UpsertServicePlanSchema,
  type AdminMeDto,
  type AdminFeaturesDto,
  type AdminOverviewDto,
  type AdminPermission,
  type AdminQueueDto,
  type AdminServiceDto,
  type AdminServicesQuery,
  type AdminSystemDto,
  type AdminTeamDto,
  type AdminTeamMemberDto,
  type AdminUserDetailDto,
  type AdminUsersDto,
  type AdminUsersQuery,
  type AuditLogsDto,
  type AuditLogsQuery,
  type BanUser,
  type CreateAdmin,
  type CreateService,
  type FeatureFlagDto,
  type GrantPlus,
  type PriceReportDto,
  type PriceReportsDto,
  type PriceReportsQuery,
  type ReviewPriceReport,
  type SetAdminPassword,
  type UpdateAdmin,
  type UpdateFeatureFlag,
  type UpdateService,
  type UpsertServicePlan,
} from '@subca/shared';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { AdminUser } from '../generated/prisma/client.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { AdminQueueService } from './admin-queue.service.js';
import { AdminSystemService } from './admin-system.service.js';
import { AdminTeamService } from './admin-team.service.js';
import { AdminUsersService } from './admin-users.service.js';
import {
  AdminGuard,
  ClientIp,
  CurrentAdmin,
  RequireAdmin,
} from './admin.guard.js';

/** Admin Console. Mọi endpoint cần tài khoản admin + phiên đã qua MFA (xem AdminGuard). */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly users: AdminUsersService,
    private readonly catalog: AdminCatalogService,
    private readonly queue: AdminQueueService,
    private readonly team: AdminTeamService,
    private readonly system: AdminSystemService,
  ) {}

  @Get('me')
  me(@CurrentAdmin() admin: AdminUser): AdminMeDto {
    const permissions = (
      Object.keys(ADMIN_PERMISSIONS) as AdminPermission[]
    ).filter((p) =>
      (ADMIN_PERMISSIONS[p] as readonly string[]).includes(admin.role),
    );
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions,
    };
  }

  @Get('overview')
  getOverview(): Promise<AdminOverviewDto> {
    return this.overview.get();
  }

  @Get('queues')
  getQueue(): Promise<AdminQueueDto> {
    return this.queue.get();
  }

  // ─────────────── Người dùng ───────────────

  @Get('users')
  listUsers(
    @Query(new ZodValidationPipe(AdminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<AdminUsersDto> {
    return this.users.list(query);
  }

  @Get('users/:id')
  getUser(@Param('id', uuidParam) id: string): Promise<AdminUserDetailDto> {
    return this.users.get(id);
  }

  @Post('users/:id/ban')
  @RequireAdmin('manageUsers')
  banUser(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(BanUserSchema)) body: BanUser,
    @ClientIp() ip: string | null,
  ): Promise<AdminUserDetailDto> {
    return this.users.ban(admin, id, body, ip);
  }

  @Post('users/:id/unban')
  @RequireAdmin('manageUsers')
  unbanUser(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @ClientIp() ip: string | null,
  ): Promise<AdminUserDetailDto> {
    return this.users.unban(admin, id, ip);
  }

  @Post('users/:id/plus')
  @RequireAdmin('manageUsers')
  grantPlus(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(GrantPlusSchema)) body: GrantPlus,
    @ClientIp() ip: string | null,
  ): Promise<AdminUserDetailDto> {
    return this.users.grantPlus(admin, id, body, ip);
  }

  @Delete('users/:id')
  @RequireAdmin('deleteUsers')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.users.deleteUser(admin, id, ip);
  }

  // ─────────────── Thư viện dịch vụ ───────────────

  @Get('services')
  listServices(
    @Query(new ZodValidationPipe(AdminServicesQuerySchema))
    query: AdminServicesQuery,
  ): Promise<AdminServiceDto[]> {
    return this.catalog.services(query);
  }

  @Post('services')
  @RequireAdmin('manageCatalog')
  createService(
    @CurrentAdmin() admin: AdminUser,
    @Body(new ZodValidationPipe(CreateServiceSchema)) body: CreateService,
    @ClientIp() ip: string | null,
  ): Promise<AdminServiceDto> {
    return this.catalog.createService(admin, body, ip);
  }

  @Patch('services/:id')
  @RequireAdmin('manageCatalog')
  updateService(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) body: UpdateService,
    @ClientIp() ip: string | null,
  ): Promise<AdminServiceDto> {
    return this.catalog.updateService(admin, id, body, ip);
  }

  @Post('services/:id/plans')
  @RequireAdmin('manageCatalog')
  createPlan(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpsertServicePlanSchema))
    body: UpsertServicePlan,
    @ClientIp() ip: string | null,
  ): Promise<AdminServiceDto> {
    return this.catalog.upsertPlan(admin, id, body, ip);
  }

  @Patch('services/:id/plans/:planId')
  @RequireAdmin('manageCatalog')
  updatePlan(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Param('planId', uuidParam) planId: string,
    @Body(new ZodValidationPipe(UpsertServicePlanSchema))
    body: UpsertServicePlan,
    @ClientIp() ip: string | null,
  ): Promise<AdminServiceDto> {
    return this.catalog.upsertPlan(admin, id, body, ip, planId);
  }

  // ─────────────── Đề xuất giá ───────────────

  @Get('price-reports')
  priceReports(
    @Query(new ZodValidationPipe(PriceReportsQuerySchema))
    query: PriceReportsQuery,
  ): Promise<PriceReportsDto> {
    return this.catalog.priceReports(query);
  }

  @Post('price-reports/:id/review')
  @RequireAdmin('manageCatalog')
  reviewPriceReport(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(ReviewPriceReportSchema))
    body: ReviewPriceReport,
    @ClientIp() ip: string | null,
  ): Promise<PriceReportDto> {
    return this.catalog.reviewPriceReport(admin, id, body, ip);
  }

  // ─────────────── Hệ thống & tính năng ───────────────

  @Get('system')
  getSystem(): Promise<AdminSystemDto> {
    return this.system.system();
  }

  @Get('features')
  getFeatures(): Promise<AdminFeaturesDto> {
    return this.system.features();
  }

  @Patch('flags/:key')
  @RequireAdmin('manageFlags')
  setFlag(
    @CurrentAdmin() admin: AdminUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateFeatureFlagSchema))
    body: UpdateFeatureFlag,
    @ClientIp() ip: string | null,
  ): Promise<FeatureFlagDto> {
    return this.system.setFlag(admin, key, body, ip);
  }

  // ─────────────── Nhân sự & phân quyền ───────────────

  @Get('team')
  listTeam(@CurrentAdmin() admin: AdminUser): Promise<AdminTeamDto> {
    return this.team.list(admin);
  }

  @Post('team')
  @RequireAdmin('manageTeam')
  createAdmin(
    @CurrentAdmin() admin: AdminUser,
    @Body(new ZodValidationPipe(CreateAdminSchema)) body: CreateAdmin,
    @ClientIp() ip: string | null,
  ): Promise<AdminTeamMemberDto> {
    return this.team.create(admin, body, ip);
  }

  @Patch('team/:id')
  @RequireAdmin('manageTeam')
  updateAdmin(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdateAdminSchema)) body: UpdateAdmin,
    @ClientIp() ip: string | null,
  ): Promise<AdminTeamMemberDto> {
    return this.team.update(admin, id, body, ip);
  }

  @Post('team/:id/password')
  @RequireAdmin('manageTeam')
  @HttpCode(HttpStatus.NO_CONTENT)
  setAdminPassword(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(SetAdminPasswordSchema)) body: SetAdminPassword,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.team.setPassword(admin, id, body, ip);
  }

  @Delete('team/:id')
  @RequireAdmin('manageTeam')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAdmin(
    @CurrentAdmin() admin: AdminUser,
    @Param('id', uuidParam) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.team.remove(admin, id, ip);
  }

  // ─────────────── Nhật ký ───────────────

  @Get('audit-logs')
  auditLogs(
    @Query(new ZodValidationPipe(AuditLogsQuerySchema)) query: AuditLogsQuery,
  ): Promise<AuditLogsDto> {
    return this.catalog.auditLogs(query);
  }
}
