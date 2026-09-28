import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUSH_SENDER, type PushSender } from '../push/push-sender.js';

export interface GroupNotification {
  title: string;
  body: string;
  /** Kèm theo để app mở thẳng màn Chi tiết nhóm khi bấm thông báo. */
  groupId: string;
}

/**
 * Thông báo của nhóm chia tiền được gửi ngay (không qua BullMQ) vì luôn do một hành động
 * của người dùng sinh ra và cần tới liền: báo đã chuyển tiền, xác nhận đã nhận, nhắc trả tiền.
 * Gửi lỗi thì chỉ ghi log — hành động chính (đánh dấu đã trả…) vẫn phải thành công.
 */
@Injectable()
export class GroupNotifier {
  private readonly logger = new Logger(GroupNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
  ) {}

  async notify(userId: string, n: GroupNotification): Promise<void> {
    try {
      const user = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: {
          pushTokens: { select: { token: true } },
          settings: { select: { notificationsEnabled: true } },
        },
      });
      if (!user || (user.settings && !user.settings.notificationsEnabled))
        return;
      if (user.pushTokens.length === 0) return;

      const messages: ExpoPushMessage[] = user.pushTokens.map((t) => ({
        to: t.token,
        title: n.title,
        body: n.body,
        sound: 'default',
        priority: 'high',
        data: { type: 'group', groupId: n.groupId },
      }));
      const tickets = await this.push.send(messages);
      const dead = tickets.flatMap((ticket, i) =>
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
          ? [user.pushTokens[i]!.token]
          : [],
      );
      if (dead.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: dead } },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Không gửi được thông báo nhóm ${n.groupId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
