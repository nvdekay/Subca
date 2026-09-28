import { Injectable, Logger } from '@nestjs/common';
import type { AuditSeverity } from '@subca/shared';
import type { AdminUser, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  severity?: AuditSeverity;
  ip?: string | null;
}

/**
 * Nhật ký thao tác admin: mọi hành động thay đổi dữ liệu người dùng đều phải ghi lại.
 * Ghi lỗi thì chỉ log — không làm hỏng thao tác chính, nhưng cảnh báo để còn điều tra.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(actor: AdminUser | null, entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: actor ? 'ADMIN' : 'SYSTEM',
          actorId: actor?.id ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
          ip: entry.ip ?? null,
          severity: entry.severity ?? 'INFO',
        },
      });
    } catch (error) {
      this.logger.error(
        `Không ghi được nhật ký ${entry.action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
