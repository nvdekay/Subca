import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** Kiểm tra tham số :id là UUID, lỗi trả cùng định dạng với ZodValidationPipe. */
export const uuidParam = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'ID không hợp lệ',
    }),
});
