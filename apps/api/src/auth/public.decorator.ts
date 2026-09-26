import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Cho phép gọi endpoint mà không cần đăng nhập (mặc định mọi endpoint đều bắt buộc đăng nhập). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
