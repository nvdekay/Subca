import type { CurrencyCode } from '../money.js';
import type { IntervalUnit } from '../enums.js';

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  /** true = danh mục hệ thống, false = người dùng tự tạo. */
  isSystem: boolean;
}

export interface ServicePlanDto {
  id: string;
  name: string;
  amountMinor: string;
  currency: CurrencyCode;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  isFamily: boolean;
  maxMembers: number | null;
}

export interface CatalogServiceDto {
  id: string;
  slug: string;
  name: string;
  categoryId: string | null;
  logoKey: string | null;
  brandColor: string | null;
  website: string | null;
  cancelUrl: string | null;
  plans: ServicePlanDto[];
}
