import 'server-only';

import { backofficeApiFetch } from '../client';

/**
 * Written against the documented HTTP contract (design `sdd/plan-expiration-editor/design`,
 * Part A6) and cross-checked directly against the backend source
 * (`src/pricing/controllers/backoffice-merchant-pricing.controller.ts`,
 * `src/pricing/docs/backoffice/merchant-pricing.response.ts`) — the 3 endpoints exist in
 * code on `factupro-backend`'s `development` branch but are NOT YET deployed to the Railway
 * instance this app talks to, so these bindings could not be confirmed against a live call.
 */

export interface BackofficeMerchantSummaryDto {
  id: string;
  name: string;
  nif: string | null;
  status: string;
}

export interface BackofficePricingSummaryDto {
  id: string;
  planName: string;
  planLevel: number;
  /** ISO UTC instant, e.g. '2026-11-30T23:00:00.000Z'. */
  expirationDate: string;
  /** Pre-computed Madrid calendar day, 'yyyy-MM-dd' — this is what the UI displays/edits. */
  expirationDateMadrid: string;
  expired: boolean;
}

export type BackofficeNotEditableReason = 'PLAN_NOT_ELIGIBLE';

export interface BackofficeMerchantPricingDto {
  merchant: BackofficeMerchantSummaryDto;
  pricing: BackofficePricingSummaryDto;
  editable: boolean;
  notEditableReason: BackofficeNotEditableReason | null;
}

export interface BackofficeUserSummaryDto {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
}

export interface BackofficeUserMerchantPricingListDto {
  user: BackofficeUserSummaryDto;
  merchants: BackofficeMerchantPricingDto[];
}

export interface BackofficeUpdatedMerchantPricingDto extends BackofficeMerchantPricingDto {
  previousExpirationDate: string;
  previousExpirationDateMadrid: string;
  auditLogId: string;
}

/** GET merchant-pricing/by-nif/:nif — merchant + pricing + editable flag. 404 if no match. */
export async function getMerchantPricingByNif(
  nif: string,
  options?: { signal?: AbortSignal },
): Promise<BackofficeMerchantPricingDto> {
  const envelope = await backofficeApiFetch<BackofficeMerchantPricingDto>(
    `merchant-pricing/by-nif/${encodeURIComponent(nif)}`,
    { method: 'GET', signal: options?.signal },
  );
  return envelope.data;
}

/**
 * GET merchant-pricing/by-user-email — pricing for every merchant the user belongs to.
 * 404 if no user matches; 200 with `merchants: []` if the user has zero active merchant roles.
 */
export async function getMerchantPricingsByUserEmail(
  email: string,
  options?: { signal?: AbortSignal },
): Promise<BackofficeUserMerchantPricingListDto> {
  const envelope = await backofficeApiFetch<BackofficeUserMerchantPricingListDto>(
    'merchant-pricing/by-user-email',
    { method: 'GET', query: { email }, signal: options?.signal },
  );
  return envelope.data;
}

/**
 * PATCH merchant-pricing/:merchantId/expiration-date — server re-validates the plan is
 * `trial`/`digital_kit` regardless of client-side gating. `expirationDate` MUST be `yyyy-MM-dd`.
 */
export async function updateMerchantExpirationDate(
  merchantId: string,
  input: { expirationDate: string; reason?: string },
): Promise<BackofficeUpdatedMerchantPricingDto> {
  const envelope = await backofficeApiFetch<BackofficeUpdatedMerchantPricingDto>(
    `merchant-pricing/${encodeURIComponent(merchantId)}/expiration-date`,
    { method: 'PATCH', body: input },
  );
  return envelope.data;
}
