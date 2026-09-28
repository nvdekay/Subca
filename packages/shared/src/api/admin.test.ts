import { describe, expect, it } from 'vitest';
import { AdminRole } from '../enums.js';
import {
  ADMIN_PERMISSIONS,
  AdminUsersQuerySchema,
  adminCan,
  CreateServiceSchema,
  GrantPlusSchema,
  UpsertServicePlanSchema,
} from './admin.js';

describe('phân quyền admin', () => {
  it('mọi vai trò đều xem được', () => {
    for (const role of AdminRole.options) expect(adminCan(role, 'read')).toBe(true);
  });

  it('chỉ OWNER và ADMIN được xóa dữ liệu người dùng', () => {
    expect(adminCan('OWNER', 'deleteUsers')).toBe(true);
    expect(adminCan('ADMIN', 'deleteUsers')).toBe(true);
    expect(adminCan('SUPPORT', 'deleteUsers')).toBe(false);
    expect(adminCan('VIEWER', 'deleteUsers')).toBe(false);
  });

  it('SUPPORT khóa được tài khoản nhưng không sửa thư viện; MARKETING thì ngược lại', () => {
    expect(adminCan('SUPPORT', 'manageUsers')).toBe(true);
    expect(adminCan('SUPPORT', 'manageCatalog')).toBe(false);
    expect(adminCan('MARKETING', 'manageCatalog')).toBe(true);
    expect(adminCan('MARKETING', 'manageUsers')).toBe(false);
  });

  it('VIEWER chỉ có quyền đọc', () => {
    const allowed = Object.entries(ADMIN_PERMISSIONS).filter(([, roles]) =>
      (roles as readonly string[]).includes('VIEWER'),
    );
    expect(allowed.map(([name]) => name)).toEqual(['read']);
  });
});

describe('AdminUsersQuerySchema', () => {
  it('mặc định trang 1, 25 dòng; nhận số dạng chuỗi từ query string', () => {
    expect(AdminUsersQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(AdminUsersQuerySchema.parse({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
  });

  it('chặn pageSize quá lớn và trạng thái lạ', () => {
    expect(AdminUsersQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });
});

describe('GrantPlusSchema', () => {
  it('bỏ trống số tháng = tặng trọn đời, nhưng luôn phải có lý do', () => {
    expect(GrantPlusSchema.safeParse({ reason: 'Hỗ trợ khách VIP' }).success).toBe(true);
    expect(GrantPlusSchema.safeParse({ months: 3, reason: 'Đền bù lỗi' }).success).toBe(true);
    expect(GrantPlusSchema.safeParse({ months: 3 }).success).toBe(false);
    expect(GrantPlusSchema.safeParse({ months: 99, reason: 'Quá dài' }).success).toBe(false);
  });
});

describe('schema thư viện dịch vụ', () => {
  it('slug chỉ nhận chữ thường, số và gạch ngang; màu dạng #RRGGBB', () => {
    const base = { slug: 'netflix', name: 'Netflix' };
    expect(CreateServiceSchema.safeParse(base).success).toBe(true);
    expect(CreateServiceSchema.safeParse({ ...base, slug: 'Netflix VN' }).success).toBe(false);
    expect(CreateServiceSchema.safeParse({ ...base, brandColor: 'đỏ' }).success).toBe(false);
    expect(CreateServiceSchema.safeParse({ ...base, brandColor: '#E50914' }).success).toBe(true);
  });

  it('gói giá mặc định VND, theo tháng, đang bật', () => {
    expect(UpsertServicePlanSchema.parse({ name: 'Cao cấp', amountMinor: '260000' })).toMatchObject(
      { currency: 'VND', intervalUnit: 'MONTH', intervalCount: 1, isActive: true },
    );
  });
});
