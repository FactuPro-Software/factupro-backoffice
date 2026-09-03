import 'server-only';

import { backofficeApiFetch } from '../client';
import type { AccountTargetSelector } from './merchant-pricing';

/**
 * Rev 4 (design `sdd/merchant-account-deletion/design`, D2/D5/D8/D9) — cross-checked
 * directly against `factupro-backend`'s FINAL Phase 5 source:
 *   - `src/merchant/controllers/backoffice-account-deletion.controller.ts`
 *   - `src/merchant/docs/backoffice/account-deletion.response.ts`
 *   - `src/merchant/dtos/backoffice/delete-account.dto.ts`
 *
 * D2 — the two resolution routes (`by-nif`/`by-user-email`) that used to live on
 * this controller are GONE (deleted in backend Phase 5). Resolution now happens
 * exclusively through the pricing endpoints' `account` block (D7,
 * `merchant-pricing.ts`) — `resolveAccountByNif`/`resolveAccountByUserEmail` have
 * NO replacement here by design (single fetch per search, A27).
 *
 * Both remaining routes (`:userId/impact`, `DELETE :userId`) take an explicit
 * `AccountTargetSelector` (`{entryPoint: 'nif', nif}` or `{entryPoint: 'email'}`)
 * — imported from `merchant-pricing.ts`, the shared D2 wire type — NEVER a
 * merchant-id list. The server re-derives and re-validates the actual target set
 * from this selector on every call, inside the delete transaction's row lock.
 */

/** Matches the backend's `BackofficeAccountOwnerData` — distinct from (smaller
 * than) `ResolvedBackofficeAccountDto.user` in `merchant-pricing.ts`: no
 * `lastName` field, this shape is specific to the deletion-impact response. */
export interface BackofficeAccountOwnerDto {
  id: string;
  email: string;
  name: string | null;
  status: string;
}

/** Matches the backend's `BackofficeAccountOwnedMerchantData` — the RE-DERIVED
 * target-merchant set (D9, renamed from `ownedMerchants`; the VALUE was already
 * the target set since D2, only the name was stale). No `status` field (distinct
 * from `AccountMerchantFactsDto` in `merchant-pricing.ts`). */
export interface BackofficeAccountOwnedMerchantDto {
  id: string;
  name: string;
  nif: string | null;
  /** ISO UTC instant. */
  createdAt: string;
}

/** Matches the backend's `BackofficeAccountRetentionMerchantData` — no `status`,
 * no `createdAt`; retention display only ever needs name + NIF. */
export interface BackofficeAccountRetentionMerchantDto {
  id: string;
  name: string;
  nif: string | null;
}

/**
 * A23/D9 — when `deleteUserRow` is false, names WHY: the merchant(s) the user
 * still owns and/or is a non-owner member of, split by relationship. Both arrays
 * are empty whenever `deleteUserRow`/`userDeleted` is true. Replaces the old
 * `detachOnlyMerchants`/`detachedFromMerchants` fields entirely — nothing is
 * detached any more.
 */
export interface BackofficeAccountRetentionDto {
  userDeleted: boolean;
  stillOwns: BackofficeAccountRetentionMerchantDto[];
  stillMemberOf: BackofficeAccountRetentionMerchantDto[];
}

export interface BackofficeThirdPartyTableCountsDto {
  contract: number;
  absence: number;
  payroll: number;
  massive_loads: number;
  ocr_documents: number;
}

export interface BackofficeThirdPartyMerchantExposureDto {
  merchantId: string;
  name: string;
  nif: string | null;
  rows: BackofficeThirdPartyTableCountsDto;
}

export interface BackofficeThirdPartyExposureDto {
  totalRows: number;
  merchants: BackofficeThirdPartyMerchantExposureDto[];
}

export interface BackofficeVerifactuMerchantExposureDto {
  merchantId: string;
  name: string;
  nif: string | null;
  count: number;
}

export interface BackofficeVerifactuExposureDto {
  totalInvoices: number;
  byMerchant: BackofficeVerifactuMerchantExposureDto[];
}

/** account-deletion-plan-guard (D1) — matches the backend's `BlockedPlanMerchant`
 * (mirrors `MerchantSummary` plus WHY the merchant blocks). `pricingPlanName` is
 * `null` when the merchant has no `merchant_pricing_data` row (or no plan on it)
 * — fail-closed: still blocking, no distinct "data anomaly" wording anywhere. */
export interface BackofficeBlockedPlanMerchantDto {
  id: string;
  name: string;
  nif: string | null;
  pricingPlanName: string | null;
}

/** GET account-deletion/:userId/impact response shape. */
export interface BackofficeAccountDeletionImpactDto {
  user: BackofficeAccountOwnerDto;
  /** D9 — the RE-DERIVED target set (nif → the one matched merchant; email → all owned). */
  targetMerchants: BackofficeAccountOwnedMerchantDto[];
  /** step.key -> row count, ordered per ACCOUNT_PURGE_STEPS (D3). Keys whose phase
   * is P17/P18 are ABSENT (not zero) when `deleteUserRow` is false. */
  rowCounts: Record<string, number>;
  /** D5/A21 — whether the `User` row is (preview) / was (delete) eligible for
   * deletion: zero residual role rows, zero residual permission rows, zero
   * remaining owned merchants, all scoped OUTSIDE the target set. */
  deleteUserRow: boolean;
  /** A23 — names WHY the user survives when `deleteUserRow` is false. */
  retention: BackofficeAccountRetentionDto;
  verifactuExposure: BackofficeVerifactuExposureDto;
  thirdPartyExposure: BackofficeThirdPartyExposureDto;
  /** Exact string to retype (D11). Always `user.email`. */
  confirmationToken: string;
  /** account-deletion-plan-guard (D1) — true when ANY target merchant is on a
   * plan outside `EDITABLE_PLAN_NAMES`, or has no pricing row. All-or-nothing:
   * one offender blocks the whole account. Required, not optional — the backend
   * slice that emits this field is already merged and deployed. */
  blockedByPlan: boolean;
  /** Non-empty iff `blockedByPlan`. Only the offenders, never the whole target set. */
  blockedByPlanMerchants: BackofficeBlockedPlanMerchantDto[];
}

/** GET account-deletion/:userId/impact query params AND DELETE account-deletion/:userId
 * request body both carry this selector (D2) — the confirm dialog forwards the
 * selector it previewed with, verbatim, never re-derived. */
export type DeleteAccountInput = AccountTargetSelector & {
  /** Must exactly equal the account owner's email (server trims/lowercases both sides, D11). */
  confirmation: string;
  /** Required (must be true) only when the recomputed VERIFACTU invoice count is > 0 (D10). */
  verifactuAcknowledged?: boolean;
  /** Required (must be true) only when the recomputed third-party-data row count is > 0 (D10). */
  thirdPartyDataAcknowledged?: boolean;
  reason?: string;
};

/** DELETE account-deletion/:userId response shape. */
export interface BackofficeAccountDeletionResultDto {
  userId: string;
  ownerEmail: string;
  deletedMerchantIds: string[];
  /** D5/A21/A23 — whether the `User` row was actually deleted (re-verified fresh
   * inside the delete transaction's lock). `false` means the user survives. */
  userDeleted: boolean;
  auditLogId: string;
}

/**
 * GET account-deletion/:userId/impact — runs the full purge-step array in count
 * mode (D3/D4) against the target set RE-DERIVED from `selector` (D2, never a
 * client-supplied merchant-id list): per-table row counts, VERIFACTU exposure
 * (D9), third-party-data exposure (D8), grouped by affected merchant. Never
 * blocks on any count (D10). 404 (`MERCHANT_ACCOUNT_USER_NOT_FOUND_ERROR`) if the
 * user does not exist; 400 (`MERCHANT_ACCOUNT_TARGET_SET_INVALID_ERROR`) on a
 * stale/tampered nif.
 */
export async function getAccountDeletionImpact(
  userId: string,
  selector: AccountTargetSelector,
  options?: { signal?: AbortSignal },
): Promise<BackofficeAccountDeletionImpactDto> {
  const query: Record<string, string> = { entryPoint: selector.entryPoint };
  if (selector.entryPoint === 'nif') query.nif = selector.nif;

  const envelope = await backofficeApiFetch<BackofficeAccountDeletionImpactDto>(
    `account-deletion/${encodeURIComponent(userId)}/impact`,
    { method: 'GET', query, signal: options?.signal },
  );
  return envelope.data;
}

/**
 * DELETE account-deletion/:userId — irreversibly deletes the account and the
 * target-merchant set, one transaction (A7). The target set is ALWAYS RE-DERIVED
 * server-side from `input`'s `entryPoint`/`nif` selector (D2), inside the row
 * lock, before any purge step — a stale or tampered `nif` is rejected with a
 * typed 400, never silently substituted with the full owned set. The server also
 * re-validates `confirmation` against the owner's email (D11) and the two
 * acknowledgement flags against RECOMPUTED counts (D10), independent of any
 * client-side gating. Any failure rolls back everything, including the audit
 * tombstone. `DELETE` deliberately carries a body — `backofficeApiFetch` forwards
 * `body` regardless of HTTP method, and Node's `fetch` (undici) supports a body
 * on `DELETE`.
 */
export async function deleteAccount(
  userId: string,
  input: DeleteAccountInput,
): Promise<BackofficeAccountDeletionResultDto> {
  const envelope = await backofficeApiFetch<BackofficeAccountDeletionResultDto>(
    `account-deletion/${encodeURIComponent(userId)}`,
    { method: 'DELETE', body: input },
  );
  return envelope.data;
}
