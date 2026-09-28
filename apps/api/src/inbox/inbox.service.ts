import { Injectable, NotFoundException } from '@nestjs/common';
import {
  formatAmountVi,
  type CurrencyCode,
  type InboxDto,
  type InboxItemDto,
  type ResolveInboxItem,
} from '@subca/shared';
import type { InboxItem, Prisma, Service } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type InboxRow = InboxItem & {
  subscription: {
    id: string;
    customName: string | null;
    service: ServiceSummary | null;
  } | null;
};
type ServiceSummary = Pick<
  Service,
  'id' | 'slug' | 'name' | 'logoKey' | 'brandColor'
>;

/**
 * Subca Inbox: chỉ chứa việc cần người dùng quyết định. Mọi thứ Subca đã chắc thì không
 * hiện ở đây — đúng nguyên tắc "đừng hỏi cái máy tự suy ra được".
 */
@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<InboxDto> {
    const rows = await this.prisma.inboxItem.findMany({
      where: { userId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        subscription: {
          select: {
            id: true,
            customName: true,
            service: {
              select: {
                id: true,
                slug: true,
                name: true,
                logoKey: true,
                brandColor: true,
              },
            },
          },
        },
      },
    });
    return { items: rows.map(toDto), openCount: rows.length };
  }

  /**
   * Người dùng trả lời một việc. Câu trả lời được áp thẳng vào subscription (đây chính là
   * lúc hệ thống học được điều nó đoán chưa chắc).
   */
  async resolve(
    userId: string,
    id: string,
    input: ResolveInboxItem,
  ): Promise<InboxDto> {
    const item = await this.prisma.inboxItem.findFirst({
      where: { id, userId, status: 'OPEN' },
    });
    if (!item) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'INBOX_ITEM_NOT_FOUND',
        message: 'Việc này không còn trong hộp thư Subca',
      });
    }

    if (item.subscriptionId) {
      const data = subscriptionUpdateFor(input.action);
      if (data) {
        await this.prisma.subscription.updateMany({
          where: { id: item.subscriptionId, userId },
          data,
        });
      }
    }

    await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: input.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED',
        resolution: input.action,
        resolvedAt: new Date(),
      },
    });
    return this.list(userId);
  }
}

/** Câu trả lời của người dùng đổi gì trên subscription. */
function subscriptionUpdateFor(
  action: ResolveInboxItem['action'],
): Prisma.SubscriptionUncheckedUpdateManyInput | null {
  switch (action) {
    case 'CONFIRM_ACTIVE':
    case 'KEEP':
      // Người dùng xác nhận → chắc chắn 100%, bỏ nhãn cần kiểm tra
      return {
        status: 'ACTIVE',
        detectionState: 'ACTIVE',
        confidence: 100,
        needsReview: false,
        reviewReason: null,
      };
    case 'MARK_CANCELLED':
      return {
        status: 'CANCELLED',
        detectionState: 'CANCELLED',
        confidence: 100,
        needsReview: false,
        reviewReason: null,
        nextRenewalDate: null,
        cancelledAt: new Date(),
      };
    case 'REVIEW_LATER':
      return { status: 'REVIEW', needsReview: true };
    case 'ACKNOWLEDGE':
      return { needsReview: false, reviewReason: null };
    default:
      return null;
  }
}

function toDto(row: InboxRow): InboxItemDto {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const name =
    (payload['merchantName'] as string | undefined) ??
    row.subscription?.service?.name ??
    row.subscription?.customName ??
    'Dịch vụ';
  const content = describe(row.kind, name, payload);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: content.title,
    body: content.body,
    subscriptionId: row.subscriptionId,
    service: row.subscription?.service ?? null,
    actions: content.actions,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Nội dung thẻ trong Inbox — viết sẵn ở server để app chỉ việc hiển thị. */
function describe(
  kind: InboxItem['kind'],
  name: string,
  payload: Record<string, unknown>,
): Pick<InboxItemDto, 'title' | 'body' | 'actions'> {
  switch (kind) {
    case 'PRICE_CHANGED': {
      const currency =
        (payload['currency'] as CurrencyCode | undefined) ?? 'VND';
      const from = payload['fromMinor']
        ? formatAmountVi(BigInt(payload['fromMinor'] as string), currency)
        : '—';
      const to = payload['toMinor']
        ? formatAmountVi(BigInt(payload['toMinor'] as string), currency)
        : '—';
      return {
        title: `${name} đổi giá`,
        body: `Từ ${from} thành ${to} theo email mới nhất.`,
        actions: [{ key: 'ACKNOWLEDGE', label: 'Đã hiểu', tone: 'primary' }],
      };
    }
    case 'PAYMENT_FAILED':
      return {
        title: `${name} thanh toán không thành công`,
        body: 'Email báo thẻ bị từ chối. Kiểm tra lại phương thức thanh toán để không mất quyền dùng.',
        actions: [
          { key: 'ACKNOWLEDGE', label: 'Đã xử lý', tone: 'primary' },
          { key: 'MARK_CANCELLED', label: 'Đã hủy gói', tone: 'danger' },
        ],
      };
    case 'TRIAL_ENDING':
      return {
        title: `${name} sắp hết dùng thử`,
        body: 'Giữ lại thì Subca theo dõi tiếp, còn không thì đánh dấu đã hủy.',
        actions: [
          { key: 'KEEP', label: 'Giữ', tone: 'primary' },
          { key: 'MARK_CANCELLED', label: 'Đã hủy', tone: 'danger' },
        ],
      };
    case 'SUBSCRIPTION_CANCELLED':
      return {
        title: `${name} đã hủy`,
        body: 'Subca đã chuyển gói này sang trạng thái đã hủy.',
        actions: [{ key: 'ACKNOWLEDGE', label: 'Đã hiểu', tone: 'primary' }],
      };
    case 'POSSIBLE_DUPLICATE':
      return {
        title: `${name} có thể bị trùng`,
        body: 'Subca thấy gói này giống một gói bạn đã thêm tay.',
        actions: [
          { key: 'CONFIRM_ACTIVE', label: 'Giữ cả hai', tone: 'default' },
          { key: 'DISMISS', label: 'Bỏ qua', tone: 'default' },
        ],
      };
    default: {
      const reason = payload['reason'] as string | undefined;
      return {
        title: `${name} có thể đang hoạt động`,
        body:
          reason === 'PLAN_LIMIT'
            ? 'Gói Free đã đủ số subscription nên Subca chưa thêm. Nâng cấp Plus hoặc xóa bớt gói cũ.'
            : 'Subca thấy dấu hiệu bạn vẫn đang dùng nhưng chưa đủ chắc.',
        actions: [
          { key: 'CONFIRM_ACTIVE', label: 'Vẫn dùng', tone: 'primary' },
          { key: 'MARK_CANCELLED', label: 'Đã hủy', tone: 'danger' },
          { key: 'DISMISS', label: 'Bỏ qua', tone: 'default' },
        ],
      };
    }
  }
}
