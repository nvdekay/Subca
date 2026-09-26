import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth.types.js';

/** Lấy người dùng hiện tại (đã được AuthGuard xác thực) trong controller. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user)
      throw new Error('CurrentUser dùng trên endpoint không đi qua AuthGuard');
    return request.user;
  },
);
