import 'server-only';

import { backofficeApiFetch } from '../client';

/**
 * Cross-checked directly against `factupro-backend`'s source (design
 * `sdd/merchant-kit-digital-creation/design`, File Changes table):
 *   - `src/merchant/controller/backoffice-merchant.controller.ts`
 *   - `src/merchant/dto/create-merchant.dto.ts`
 *   - `src/merchant/dto/update-digital-kit-data.dto.ts`
 *   - `src/merchant/services/check-nif.service.ts`
 *
 * Only the fields the KIT_DIGITAL wizard (this change's scope, per spec
 * "Wizard Field Scope") ever sends/reads are modeled here — `CreateMerchantDto`
 * has many more optional business-profile/marketing fields on the backend that
 * this change deliberately never renders or sends.
 */

/** Mirrors the backend's inline `PricingPlanDto` on `CreateMerchantDto`. */
export interface PricingPlanInputDto {
  name: string;
}

/**
 * POST merchants request body — the subset of `CreateMerchantDto` this wizard
 * collects. `country` and `acquisitionChannel` are always sent explicitly
 * (design D8); `verifactuStartDate` is present only when `isVerifactu` is true.
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
 * PATCH merchants/:nif/kit_digital request body — mirrors
 * `UpdateDigitalKitDataDto` verbatim (all fields optional on the backend).
 */
export interface UpdateKitDigitalInput {
  endDateDigitalKit?: string;
  extensionPlan?: string;
  internalRef?: string;
}

/** PATCH merchants/:nif/kit_digital response shape (`SimpleActionData`). */
export interface SimpleActionResultDto {
  message: string;
}

/**
 * GET merchants/check-nif/:nif — case-insensitive existence check against the
 * live merchant table (design D3, "Live NIF Validation"). Advisory only: a
 * later `MERCHANT_NIF_ALREADY_EXISTS` from `createMerchant` MUST be treated
 * identically to `exists: true` here (spec "Live NIF Validation").
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
 * server-side. Not idempotent (a successful call emails the owner); the wizard
 * MUST NOT retry this call once it succeeds (design D4).
 */
export async function createMerchant(input: CreateMerchantInput): Promise<CreatedMerchantDto> {
  const envelope = await backofficeApiFetch<CreatedMerchantDto>('merchants', {
    method: 'POST',
    body: input,
  });
  return envelope.data;
}

/**
 * PATCH merchants/:nif/kit_digital — updates the Kit Digital subsidy fields
 * for an already-created merchant, addressed by its canonical NIF. Safely
 * retryable (design D4) — this is the ONLY call `retryKitDigitalAction` (PR2)
 * re-issues after a `partial` result.
 */
export async function updateMerchantKitDigitalData(
  nif: string,
  input: UpdateKitDigitalInput,
): Promise<SimpleActionResultDto> {
  const envelope = await backofficeApiFetch<SimpleActionResultDto>(
    `merchants/${encodeURIComponent(nif)}/kit_digital`,
    { method: 'PATCH', body: input },
  );
  return envelope.data;
}
