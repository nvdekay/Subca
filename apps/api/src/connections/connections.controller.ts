import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  StartConnectionSchema,
  type ConnectionsDto,
  type DiscoverySummaryDto,
  type StartConnection,
  type StartConnectionDto,
  type SyncRunDto,
} from '@subca/shared';
import type { FastifyReply } from 'fastify';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ConnectionsService } from './connections.service.js';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ConnectionsDto> {
    return this.connections.list(user.id);
  }

  /** Bước 1: app mở URL này trong trình duyệt hệ thống để người dùng đồng ý. */
  @Post('gmail/start')
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(StartConnectionSchema)) body: StartConnection,
  ): StartConnectionDto {
    return this.connections.start(user.id, body.redirectTo);
  }

  /**
   * Bước 2: Google gọi về đây (không kèm token của Subca nên phải @Public).
   * Bảo vệ bằng `state` dùng một lần đã tạo ở bước 1.
   */
  @Public()
  @Get('gmail/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (error || !code || !state) {
      await reply
        .type('text/html')
        .send(page('Kết nối bị hủy', 'Bạn có thể đóng cửa sổ này.'));
      return;
    }
    const result = await this.connections.completeOAuth(code, state);
    if (result.redirectTo) {
      await reply.redirect(result.redirectTo, 302);
      return;
    }
    await reply
      .type('text/html')
      .send(
        page(
          'Đã kết nối Gmail',
          'Quay lại ứng dụng Subca để xem kết quả quét.',
        ),
      );
  }

  /** Quét ngay (người dùng bấm "Đồng bộ"). */
  @Post(':id/sync')
  sync(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<SyncRunDto> {
    return this.connections.enqueueSync(user.id, id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<DiscoverySummaryDto> {
    return this.connections.summary(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    return this.connections.disconnect(user.id, id);
  }
}

/** Trang tĩnh rất gọn cho trường hợp không mở lại được app. */
const page = (title: string, body: string): string =>
  `<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#F8F7F3;color:#2F3A31;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;padding:24px"><h1 style="font-size:20px">${title}</h1><p style="color:#657166">${body}</p></div>
</body></html>`;
