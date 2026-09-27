import { ServiceUnavailableException } from '@nestjs/common';
import type { AccountStatusService } from '../auth/account-status.service.js';
import type { SupabaseAdminClient } from '../auth/supabase-admin.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccountService } from './account.service.js';

const USER = '11111111-1111-4111-8111-111111111111';

function setup(configured: boolean) {
  const prisma = {
    profile: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const admin = { configured, deleteUser: vi.fn().mockResolvedValue(true) };
  const status = { invalidate: vi.fn() };
  const service = new AccountService(
    prisma as unknown as PrismaService,
    admin as unknown as SupabaseAdminClient,
    status as unknown as AccountStatusService,
  );
  return { service, prisma, admin, status };
}

describe('AccountService.deleteAccount', () => {
  it('xóa tài khoản auth, dọn profile còn sót và xóa cache trạng thái', async () => {
    const { service, admin, prisma, status } = setup(true);
    await service.deleteAccount(USER);
    expect(admin.deleteUser).toHaveBeenCalledWith(USER);
    expect(prisma.profile.deleteMany).toHaveBeenCalledWith({
      where: { id: USER },
    });
    expect(status.invalidate).toHaveBeenCalledWith(USER);
  });

  it('chưa cấu hình khóa service_role → 503, không xóa gì', async () => {
    const { service, admin, prisma } = setup(false);
    await expect(service.deleteAccount(USER)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(prisma.profile.deleteMany).not.toHaveBeenCalled();
  });
});
