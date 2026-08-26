import 'server-only';

import { backofficeApiFetch } from '../client';

/**
 * Cross-checked directly against `factupro-backend`'s source:
 *   - `src/merchant/controller/backoffice-merchant.controller.ts`
 *   - `src/merchant/dto/create-merchant.dto.ts`
 *   - `src/merchant/services/check-nif.service.ts`
 *
 * Only the fields the KIT_DIGITAL wizard actually collects are modeled here —
 * `CreateMerchantDto` has many more optional business-profile/marketing
 * fields on the backend that this app deliberately never renders or sends.
 *
 * `PATCH merchants/:nif/kit_digital` (Kit Digital subsidy tracking fields:
 * endDateDigitalKit/extensionPlan/internalRef) is intentionally NOT bound
 * here — the wizard creates the plan's expiration date directly via
 * `pricingPlanExpirationDate` on the POST instead (a different field on a
 * different table, `merchant_pricing_data.expiration_date`, not
 * `merchant.end_date_digital_kit`). The backend endpoint itself is untouched
 * for other callers.
 */

/** Mirrors the backend's inline `PricingPlanDto` on `CreateMerchantDto`. */
export interface PricingPlanInputDto {
  name: string;
}

/**
 * POST merchants request body — the subset of `CreateMerchantDto` this wizard
 * collects. `country` and `acquisitionChannel` are always sent explicitly;
 * `verifactuStartDate` is present only when `isVerifactu` is true.
 * `pricingPlanExpirationDate` sets `merchant_pricing_data.expiration_date` at
 * creation time; omitted -> backend default (now + 7 days) applies.
 */
export interface CreateMerchantInput {
  nif: string;
  name: string;
  country: 'ESP';
  fiscalZone: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  isVerifactu: boolean;
  verifactuStartDate?: string;
  pricingPlan: PricingPlanInputDto;
  acquisitionChannel: 'KIT_DIGITAL';
  pricingPlanExpirationDate?: string;
}

/**
 * POST merchants response shape — the backend returns the full `Merchant`
 * entity, but `CreateMerchantService` returns the entity it captured BEFORE
 * attaching the owner relation (a backend response-shape gap found via
 * manual testing: `setOwner()`'s refetched-with-owner result is discarded),
 * so `owner` is never actually populated here. Only model the fields that
 * ARE reliably present; callers needing the owner's email should use the
 * value they already submitted in `CreateMerchantInput.ownerEmail` instead.
 */
export interface CreatedMerchantDto {
  id: string;
  nif: string;
  name: string;
}

/** GET merchants/check-nif/:nif response shape. */
export interface CheckNifResultDto {
  exists: boolean;
}

/**
 * GET merchants/check-nif/:nif — case-insensitive existence check against the
 * live merchant table. Advisory only: a later `MERCHANT_NIF_ALREADY_EXISTS`
 * from `createMerchant` MUST be treated identically to `exists: true` here.
 */
export async function checkMerchantNif(
  nif: string,
  options?: { signal?: AbortSignal },
): Promise<CheckNifResultDto> {
  const envelope = await backofficeApiFetch<CheckNifResultDto>(
    `merchants/check-nif/${encodeURIComponent(nif)}`,
    { method: 'GET', signal: options?.signal },
  );
  return envelope.data;
}

/**
 * POST merchants — creates the merchant with `isDataMigration: false` forced
 * server-side. Not idempotent (a successful call emails the owner); the
 * wizard MUST NOT retry this call once it succeeds.
 */
export async function createMerchant(input: CreateMerchantInput): Promise<CreatedMerchantDto> {
  const envelope = await backofficeApiFetch<CreatedMerchantDto>('merchants', {
    method: 'POST',
    body: input,
  });
  return envelope.data;
}
