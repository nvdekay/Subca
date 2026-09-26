import type { PrismaService } from '../prisma/prisma.service.js';
import { AccountStatusService } from './account-status.service.js';

const USER = '11111111-1111-4111-8111-111111111111';

function setup(bannedAt: Date | null) {
  const findUnique = vi.fn().mockResolvedValue({ bannedAt });
  const service = new AccountStatusService({
    profile: { findUnique },
  } as unknown as PrismaService);
  return { service, findUnique };
}

describe('AccountStatusService', () => {
  it('trả về trạng thái khóa từ DB', async () => {
    expect(await setup(new Date()).service.isBanned(USER)).toBe(true);
    expect(await setup(null).service.isBanned(USER)).toBe(false);
  });

  it('dùng cache trong TTL, hết TTL thì truy vấn lại', async () => {
    const { service, findUnique } = setup(null);
    await service.isBanned(USER, 0);
    await service.isBanned(USER, AccountStatusService.TTL_MS - 1);
    expect(findUnique).toHaveBeenCalledTimes(1);
    await service.isBanned(USER, AccountStatusService.TTL_MS + 1);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('invalidate xóa cache ngay', async () => {
    const { service, findUnique } = setup(null);
    await service.isBanned(USER, 0);
    service.invalidate(USER);
    await service.isBanned(USER, 1);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('không có profile → coi như không bị khóa (để /me trả 404 rõ ràng)', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = new AccountStatusService({
      profile: { findUnique },
    } as unknown as PrismaService);
    expect(await service.isBanned(USER)).toBe(false);
  });
});
