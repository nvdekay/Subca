import { Injectable } from '@nestjs/common';
import type { RegisterPushToken } from '@subca/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đăng ký thiết bị nhận push. Token là của thiết bị: nếu máy đổi tài khoản thì token
   * chuyển sang tài khoản mới, để người dùng cũ không nhận thông báo trên máy người khác.
   */
  async register(userId: string, input: RegisterPushToken): Promise<void> {
    const data = {
      userId,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      appVersion: input.appVersion ?? null,
      lastSeenAt: new Date(),
    };
    await this.prisma.pushToken.upsert({
      where: { token: input.token },
      create: { token: input.token, ...data },
      update: data,
    });
  }

  /** Gọi khi đăng xuất: máy này ngừng nhận thông báo của tài khoản. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }
}
