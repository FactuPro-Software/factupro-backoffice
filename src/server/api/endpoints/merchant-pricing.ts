import 'server-only';

import { backofficeApiFetch } from '../client';

/**
 * Rev 4 (design `sdd/merchant-account-deletion/design`, D2/D3/D7) — cross-checked
 * directly against `factupro-backend`'s FINAL Phase 5 source:
 *   - `src/pricing/controllers/backoffice-merchant-pricing.controller.ts`
 *   - `src/pricing/docs/backoffice/merchant-pricing.response.ts`
 *   - `src/backoffice-account-lookup/types/backoffice-account-lookup.types.ts`
 *
 * D7 — BOTH `by-nif` and `by-user-email` now return the SAME uniform
 * `{ account, merchants[] }` shape. `account` (D3, `ResolvedBackofficeAccountDto`)
 * is the ONLY not-found source (`account.targetMerchants.length === 0`); a merchant
 * that is owned but lacks a `MerchantPricingData` row is simply absent from
 * `merchants` — never a 404, never an error. `entryPoint`/`nif`/`AccountTargetSelector`
 * (D2) are defined here (not in `account-deletion.ts`) because this is where the
 * shared `BackofficeAccountLookupModule`'s wire types are first consumed on the
 * frontend; `account-deletion.ts` imports them from here to avoid duplication.
 */

/** D2 — the two valid entry points the operator can have searched from. */
export type AccountEntryPoint = 'nif' | 'email';

/**
 * D2 — the wire carries the entry POINT, never a merchant-id list. The server
 * ALWAYS re-derives the actual target-merchant set from this against the live,
 * locked DB state (A24) — a client-supplied id list is never accepted, by
 * construction. The confirm dialog forwards the selector it previewed with,
 * verbatim (never re-derived client-side).
 */
export type AccountTargetSelector =
  | { entryPoint: 'nif'; nif: string }
  | { entryPoint: 'email' };

/** D3 — facts-only merchant shape shared by every array on `ResolvedBackofficeAccountDto`. */
export interface AccountMerchantFactsDto {
  id: string;
  name: string;
  nif: string | null;
  status: string;
  /** ISO UTC instant. */
  createdAt: string;
}

/**
 * D3/D7 — mirrors the backend's `ResolvedBackofficeAccount` (shared
 * `backoffice-account-lookup` module). Authoritative and the ONLY not-found
 * source: `targetMerchants.length === 0`. `targetMerchants` is A24's asymmetric
 * set: nif entry point → exactly the one matched merchant; email entry point →
 * every merchant the resolved user OWNS (TRASH included, D4). `allOwnedMerchants`
 * is always a superset; `otherMembershipMerchants` is role/permission membership
 * WITHOUT ownership and never contributes to the target set.
 */
export interface ResolvedBackofficeAccountDto {
  entryPoint: AccountEntryPoint;
  matchedNif: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    lastName: string | null;
    status: string;
  };
  targetMerchants: AccountMerchantFactsDto[];
  allOwnedMerchants: AccountMerchantFactsDto[];
  otherMembershipMerchants: AccountMerchantFactsDto[];
}

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

/**
 * D7 — uniform response for BOTH `by-nif` and `by-user-email`. `merchants` is a
 * subset of `account.targetMerchants` — cross-reference by `merchant.id` to know
 * which target merchants have pricing data (D7's WARNING: never assume index
 * alignment, a target merchant without pricing is simply absent from this array).
 */
export interface BackofficeMerchantPricingListDto {
  account: ResolvedBackofficeAccountDto;
  merchants: BackofficeMerchantPricingDto[];
}

export interface BackofficeUpdatedMerchantPricingDto extends BackofficeMerchantPricingDto {
  previousExpirationDate: string;
  previousExpirationDateMadrid: string;
  auditLogId: string;
}

/**
 * GET merchant-pricing/by-nif/:nif — resolved account (D3) + pricing for the
 * matched merchant, if any. `account.targetMerchants` has length 1 on success
 * (nif narrows to exactly the matched merchant, A24); `merchants` has length 0
 * or 1. 404 (`MERCHANT_NOT_FOUND_ERROR`) only when no merchant matches the NIF
 * at all — a matched-but-unpriced merchant is NOT a 404 (D7).
 */
export async function getMerchantPricingByNif(
  nif: string,
  options?: { signal?: AbortSignal },
): Promise<BackofficeMerchantPricingListDto> {
  const envelope = await backofficeApiFetch<BackofficeMerchantPricingListDto>(
    `merchant-pricing/by-nif/${encodeURIComponent(nif)}`,
    { method: 'GET', signal: options?.signal },
  );
  return envelope.data;
}

/**
 * GET merchant-pricing/by-user-email — resolved account (D3) + pricing for every
 * merchant the user OWNS (TRASH included, D4; non-owner roles excluded, A19/A22).
 * `account.targetMerchants.length === 0` is the ONLY true not-found state (a user
 * existing but owning zero merchants) — 404 (`USER_FIND_NOT_FOUND`) only when no
 * user matches the email at all.
 */
export async function getMerchantPricingsByUserEmail(
  email: string,
  options?: { signal?: AbortSignal },
): Promise<BackofficeMerchantPricingListDto> {
  const envelope = await backofficeApiFetch<BackofficeMerchantPricingListDto>(
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
