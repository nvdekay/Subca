import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import type {
  ConnectedAccountDto,
  ConnectionsDto,
  DiscoverySummaryDto,
  StartConnectionDto,
  SyncRunDto,
} from '@subca/shared';
import { SecretBox } from '../common/secret-box.js';
import { DetectionService } from '../detection/detection.service.js';
import type {
  ConnectedAccount,
  EmailSyncRun,
  Prisma,
} from '../generated/prisma/client.js';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from '../integrations/mail/mail-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SYNC_QUEUE, type EmailSyncJob } from './email-sync.constants.js';

/** Mặc định quét ngắn để giới hạn dữ liệu tải về; người dùng có thể chọn tối đa 12 tháng. */
const DEFAULT_INITIAL_WINDOW_MONTHS = 3;
/** Số email tối đa cho một lượt quét, để lượt chạy không kéo dài vô tận. */
const MAX_MESSAGES_PER_RUN = 400;
const PAGE_SIZE = 50;
/** Mã `state` của OAuth sống trong bộ nhớ, hết hạn sau 10 phút. */
const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
  userId: string;
  redirectTo: string | undefined;
  expiresAt: number;
}

/**
 * Kết nối hộp thư và chạy quét. Đây là chỗ duy nhất chạm tới token; token đã mã hóa,
 * không bao giờ rời khỏi máy chủ.
 */
@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);
  private readonly pendingStates = new Map<string, PendingState>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly secrets: SecretBox,
    private readonly detection: DetectionService,
    @InjectQueue(EMAIL_SYNC_QUEUE)
    private readonly syncQueue: Queue<EmailSyncJob>,
  ) {}

  async list(userId: string): Promise<ConnectionsDto> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { syncRuns: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    return {
      accounts: accounts.map((account) =>
        toDto(account, account.syncRuns[0] ?? null),
      ),
      gmailAvailable: this.mail.configured && this.secrets.configured,
    };
  }

  /** Bước 1: tạo URL trang đồng ý của Google. */
  start(userId: string, redirectTo: string | undefined): StartConnectionDto {
    this.assertConfigured();
    this.sweepStates();
    const state = randomUUID();
    this.pendingStates.set(state, {
      userId,
      redirectTo,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    return { authorizeUrl: this.mail.authorizeUrl(state) };
  }

  /**
   * Bước 2 (Google gọi về): đổi mã lấy refresh token, lưu đã mã hóa, rồi trả deep link
   * để mở lại app. Không có token nào đi xuống client.
   */
  async completeOAuth(
    code: string,
    state: string,
  ): Promise<{ redirectTo: string | null }> {
    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'OAUTH_STATE_INVALID',
        message: 'Phiên kết nối đã hết hạn, thử kết nối lại.',
      });
    }

    const tokens = await this.mail.exchangeCode(code);
    const encrypted = this.secrets.encrypt(tokens.refreshToken);
    const account = await this.prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerEmail: {
          userId: pending.userId,
          provider: 'GMAIL',
          providerEmail: tokens.email,
        },
      },
      create: {
        userId: pending.userId,
        provider: 'GMAIL',
        providerEmail: tokens.email,
        encryptedRefreshToken: encrypted,
        scope: tokens.scope,
      },
      update: {
        encryptedRefreshToken: encrypted,
        scope: tokens.scope,
        status: 'ACTIVE',
        lastError: null,
      },
    });
    this.logger.log(
      `Đã kết nối hộp thư ${account.id} cho người dùng ${pending.userId}`,
    );
    return { redirectTo: pending.redirectTo ?? null };
  }

  /** Quét theo cửa sổ người dùng chọn; lượt nền incremental mặc định lấy thư mới từ lastSyncAt. */
  async sync(
    userId: string,
    accountId: string,
    windowMonths?: number,
  ): Promise<SyncRunDto> {
    const account = await this.findOwned(userId, accountId);
    const kind = account.initialSyncDoneAt ? 'INCREMENTAL' : 'INITIAL';
    const run = await this.prisma.emailSyncRun.create({
      data: {
        accountId: account.id,
        kind,
        since: this.syncSince(account, windowMonths),
      },
    });
    return this.runSync(userId, account, run);
  }

  /** Tạo run và đưa quét vào BullMQ để API trả ngay, kể cả hộp thư lớn. */
  async enqueueSync(
    userId: string,
    accountId: string,
    windowMonths?: number,
  ): Promise<SyncRunDto> {
    const account = await this.findOwned(userId, accountId);
    const current = await this.prisma.emailSyncRun.findFirst({
      where: { accountId, status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });
    if (current) return toSyncDto(current);

    const run = await this.prisma.emailSyncRun.create({
      data: {
        accountId,
        kind: account.initialSyncDoneAt ? 'INCREMENTAL' : 'INITIAL',
        since: this.syncSince(account, windowMonths),
      },
    });
    try {
      await this.syncQueue.add(
        'sync',
        { userId, accountId, runId: run.id },
        {
          jobId: run.id,
          removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      );
    } catch (error) {
      await this.prisma.emailSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: message(error).slice(0, 500),
          finishedAt: new Date(),
        },
      });
      throw error;
    }
    return toSyncDto(run);
  }

  /** Worker BullMQ chạy một lượt đã tạo, ghi tiến độ sau từng trang Gmail. */
  async processSyncRun(job: EmailSyncJob): Promise<SyncRunDto> {
    const account = await this.findOwned(job.userId, job.accountId);
    const run = await this.prisma.emailSyncRun.findFirst({
      where: { id: job.runId, accountId: account.id, status: 'RUNNING' },
    });
    if (!run) throw new BadRequestException('Lượt quét không còn hoạt động');
    return this.runSync(job.userId, account, run);
  }

  private async runSync(
    userId: string,
    account: ConnectedAccount,
    run: EmailSyncRun,
  ): Promise<SyncRunDto> {
    const since = run.since ?? this.syncSince(account);

    try {
      const refreshToken = this.secrets.decrypt(account.encryptedRefreshToken);
      let pageToken: string | undefined;
      let scanned = 0;
      let candidates = 0;
      let events = 0;

      do {
        const page = await this.mail.listMessages(refreshToken, {
          since,
          limit: PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        });
        const result = await this.detection.processCandidates(
          userId,
          account.id,
          page.messages,
        );
        scanned += result.scanned;
        candidates += result.candidates;
        events += result.events;
        await this.prisma.emailSyncRun.update({
          where: { id: run.id },
          data: {
            scannedCount: scanned,
            candidateCount: candidates,
            eventCount: events,
          },
        });
        pageToken = page.nextPageToken ?? undefined;
      } while (pageToken && scanned < MAX_MESSAGES_PER_RUN);

      await this.detection.reconcileUser(userId);

      const finished = await this.prisma.emailSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'DONE',
          scannedCount: scanned,
          candidateCount: candidates,
          eventCount: events,
          finishedAt: new Date(),
        },
      });
      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: new Date(),
          initialSyncDoneAt: account.initialSyncDoneAt ?? new Date(),
          status: 'ACTIVE',
          lastError: null,
        },
      });
      return toSyncDto(finished);
    } catch (error) {
      const text = message(error);
      this.logger.error(`Quét hộp thư ${account.id} lỗi: ${text}`);
      const failed = await this.prisma.emailSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: text.slice(0, 500),
          finishedAt: new Date(),
        },
      });
      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: { status: 'ERROR', lastError: text.slice(0, 500) },
      });
      return toSyncDto(failed);
    }
  }

  private syncSince(account: ConnectedAccount, windowMonths?: number): Date {
    if (windowMonths !== undefined) return monthsAgo(windowMonths);
    return account.initialSyncDoneAt
      ? (account.lastSyncAt ?? monthsAgo(1))
      : monthsAgo(DEFAULT_INITIAL_WINDOW_MONTHS);
  }

  /** Ngắt kết nối: thu hồi quyền ở Google rồi xóa hẳn token khỏi database. */
  async disconnect(userId: string, accountId: string): Promise<void> {
    const account = await this.findOwned(userId, accountId);
    try {
      await this.mail.revoke(
        this.secrets.decrypt(account.encryptedRefreshToken),
      );
    } catch (error) {
      // Token có thể đã bị thu hồi từ phía Google — vẫn xóa ở phía mình
      this.logger.warn(`Không thu hồi được token: ${message(error)}`);
    }
    await this.prisma.connectedAccount.delete({ where: { id: account.id } });
  }

  /** Số liệu cho màn "Đã tìm thấy N subscription" sau lần quét đầu. */
  async summary(userId: string): Promise<DiscoverySummaryDto> {
    const [run, detected, active, trial, needsReview, cancelled, openInbox] =
      await Promise.all([
        this.prisma.emailSyncRun.findFirst({
          where: { account: { userId } },
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.subscription.count({ where: { userId, source: 'EMAIL' } }),
        this.prisma.subscription.count({
          where: { userId, source: 'EMAIL', detectionState: 'ACTIVE' },
        }),
        this.prisma.subscription.count({
          where: { userId, source: 'EMAIL', detectionState: 'TRIAL' },
        }),
        this.prisma.subscription.count({
          where: { userId, source: 'EMAIL', needsReview: true },
        }),
        this.prisma.subscription.count({
          where: {
            userId,
            source: 'EMAIL',
            detectionState: { in: ['CANCELLED', 'EXPIRED'] },
          },
        }),
        this.prisma.inboxItem.count({ where: { userId, status: 'OPEN' } }),
      ]);
    return {
      runId: run?.id ?? null,
      status: run?.status ?? 'IDLE',
      scannedCount: run?.scannedCount ?? 0,
      candidateCount: run?.candidateCount ?? 0,
      detected,
      active,
      trial,
      needsReview,
      cancelled,
      openInboxCount: openInbox,
    };
  }

  /** Tài khoản đến hạn quét lại (dùng cho job nền). */
  dueForSync(olderThan: Date): Promise<ConnectedAccount[]> {
    const where: Prisma.ConnectedAccountWhereInput = {
      status: 'ACTIVE',
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: olderThan } }],
    };
    return this.prisma.connectedAccount.findMany({ where, take: 50 });
  }

  private async findOwned(
    userId: string,
    accountId: string,
  ): Promise<ConnectedAccount> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'CONNECTION_NOT_FOUND',
        message: 'Không tìm thấy hộp thư đã kết nối',
      });
    }
    return account;
  }

  private assertConfigured(): void {
    if (!this.mail.configured || !this.secrets.configured) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'GMAIL_UNAVAILABLE',
        message:
          'Máy chủ chưa cấu hình kết nối Gmail (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SECRETS_KEY).',
      });
    }
  }

  /** Dọn các `state` OAuth quá hạn để map không phình. */
  private sweepStates(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingStates) {
      if (value.expiresAt < now) this.pendingStates.delete(key);
    }
  }
}

function toDto(
  account: ConnectedAccount,
  run: EmailSyncRun | null,
): ConnectedAccountDto {
  return {
    id: account.id,
    provider: account.provider,
    providerEmail: account.providerEmail,
    status: account.status,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    initialSyncDoneAt: account.initialSyncDoneAt?.toISOString() ?? null,
    sync: run ? toSyncDto(run) : null,
    createdAt: account.createdAt.toISOString(),
  };
}

function toSyncDto(run: EmailSyncRun): SyncRunDto {
  return {
    id: run.id,
    kind: run.kind,
    status: run.status,
    scannedCount: run.scannedCount,
    candidateCount: run.candidateCount,
    eventCount: run.eventCount,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    error: run.error,
  };
}

function monthsAgo(months: number): Date {
  const date = new Date();
  const targetMonth = date.getMonth() - months;
  const targetDate = new Date(date);
  targetDate.setDate(1);
  targetDate.setMonth(targetMonth);
  const lastDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    0,
  ).getDate();
  targetDate.setDate(Math.min(date.getDate(), lastDay));
  targetDate.setHours(
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  return targetDate;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
