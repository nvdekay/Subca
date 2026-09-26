import { Controller, Get, Query } from '@nestjs/common';
import type { CatalogServiceDto, CategoryDto } from '@subca/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogService, type CatalogQuery } from './catalog.service.js';

const CatalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  categoryId: z.uuid().optional(),
});

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(@CurrentUser() user: AuthUser): Promise<CategoryDto[]> {
    return this.catalog.categories(user.id);
  }

  /** Dùng cho ô "Chọn nhanh" và tìm dịch vụ ở màn Thêm subscription. */
  @Get('services')
  services(
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQuery,
  ): Promise<CatalogServiceDto[]> {
    return this.catalog.services(query);
  }
}
