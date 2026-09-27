import type { CurrencyCode } from '../money.js';
import type { IntervalUnit } from '../enums.js';

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
  logoKey: string | null;
  brandColor: string | null;
  website: string | null;
  cancelUrl: string | null;
  plans: ServicePlanDto[];
}
