import { Controller, Get, Query } from '@nestjs/common';
import type { CatalogServiceDto } from '@subca/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogService, type CatalogQuery } from './catalog.service.js';

const CatalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
});

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Dùng cho ô "Chọn nhanh" và tìm dịch vụ ở màn Thêm subscription. */
  @Get('services')
  services(
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQuery,
  ): Promise<CatalogServiceDto[]> {
    return this.catalog.services(query);
  }
}
