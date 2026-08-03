'use server';

import { revalidatePath } from 'next/cache';

import {
  updateMerchantExpirationDate,
  type AccountTargetSelector,
} from '@/server/api/endpoints/merchant-pricing';
import {
  deleteAccount,
  getAccountDeletionImpact,
  type BackofficeAccountDeletionImpactDto,
} from '@/server/api/endpoints/account-deletion';
import { BackofficeApiError } from '@/server/api/errors';

export type UpdateExpirationState =
  | { status: 'idle' }
  | { status: 'success'; merchantName: string; from: string; to: string }
  | { status: 'error'; errorKey: string; fallbackMessage?: string };

/**
 * Maps a backend `errorCode` to an i18n key (B5). Shared across both the
 * expiration-date-editor toasts (`accounts.toast.*`) and the delete-account flow
 * (`accounts.delete.toast.*`) — same lookup pattern, different i18n namespace per
 * caller, per design B1 ("`ERROR_KEY_BY_CODE` extended... `resolveErrorKey` pattern
 * reused verbatim"). The 4 delete error codes never overlap with the expiration ones.
 */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  PRICING_PLAN_NOT_EDITABLE_ERROR: 'notEditable',
  MERCHANT_NOT_FOUND_ERROR: 'merchantGone',
  MERCHANT_PRICING_DATA_NOT_FOUND_ERROR: 'merchantGone',
  INVALID_EXPIRATION_DATE_ERROR: 'invalidDate',
  MERCHANT_ACCOUNT_CONFIRMATION_MISMATCH_ERROR: 'confirmationMismatch',
  MERCHANT_ACCOUNT_VERIFACTU_ACK_REQUIRED_ERROR: 'verifactuAckRequired',
  MERCHANT_ACCOUNT_THIRD_PARTY_ACK_REQUIRED_ERROR: 'thirdPartyAckRequired',
  MERCHANT_ACCOUNT_USER_NOT_FOUND_ERROR: 'userNotFound',
  MERCHANT_ACCOUNT_TARGET_SET_INVALID_ERROR: 'targetSetInvalid',
};

function resolveErrorKey(error: BackofficeApiError): string {
  if (error.statusCode === 0) return 'connection'; // NETWORK_ERROR / CONFIG_MISSING_*
  if (error.errorCode && ERROR_KEY_BY_CODE[error.errorCode]) {
    return ERROR_KEY_BY_CODE[error.errorCode];
  }
  return 'unexpected';
}

/**
 * `useActionState` action. Client-side eligibility gating is UX only — the server
 * re-validates on every submit, so a stale "editable" snapshot surfaces here as a
 * typed 4xx, never a crash or a false success (spec: race-condition scenario).
 * No redirect on 401/403 — matches the backoffice-api-client design decision; it
 * simply surfaces as the `unexpected` toast.
 */
export async function updateExpirationDateAction(
  _prevState: UpdateExpirationState,
  formData: FormData,
): Promise<UpdateExpirationState> {
  const merchantId = String(formData.get('merchantId') ?? '');
  const currentExpirationDate = String(formData.get('currentExpirationDate') ?? '');
  const expirationDate = String(formData.get('expirationDate') ?? '');
  const reasonRaw = formData.get('reason');
  const reason = typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : undefined;

  try {
    const updated = await updateMerchantExpirationDate(merchantId, { expirationDate, reason });
    revalidatePath('/accounts');
    return {
      status: 'success',
      merchantName: updated.merchant.name,
      from: currentExpirationDate,
      to: updated.pricing.expirationDateMadrid,
    };
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      return {
        status: 'error',
        errorKey: resolveErrorKey(error),
        fallbackMessage: error.message,
      };
    }
    return { status: 'error', errorKey: 'unexpected' };
  }
}

export type FetchDeletionImpactState =
  | { status: 'success'; impact: BackofficeAccountDeletionImpactDto }
  | { status: 'error'; errorKey: string; fallbackMessage?: string };

/**
 * Plain async server action (NOT `useActionState`-bound) — called directly from
 * `delete-account-card.tsx` when the delete dialog opens. Deliberately NOT
 * prefetched with the page (D16): the impact preview runs ~55 COUNTs against a
 * live account, and most account-detail visits never open this dialog.
 *
 * D2 — `selector` is the SAME entry-point selector the operator searched with
 * (`{entryPoint: 'nif', nif}` or `{entryPoint: 'email'}`), never re-derived. The
 * server re-derives and re-validates the actual target-merchant set from it.
 */
export async function fetchAccountDeletionImpactAction(
  userId: string,
  selector: AccountTargetSelector,
): Promise<FetchDeletionImpactState> {
  try {
    const impact = await getAccountDeletionImpact(userId, selector);
    return { status: 'success', impact };
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      return {
        status: 'error',
        errorKey: resolveErrorKey(error),
        fallbackMessage: error.message,
      };
    }
    return { status: 'error', errorKey: 'unexpected' };
  }
}

export type DeleteAccountState =
  | { status: 'idle' }
  | { status: 'success'; ownerEmail: string }
  | { status: 'error'; errorKey: string; fallbackMessage?: string };

/**
 * `useActionState` action for the irreversible delete. Deliberately does NOT call
 * `revalidatePath` or `redirect()` (D18): a bare `revalidatePath('/accounts')` would
 * re-run the current search against a now-deleted account (confusing 404), and a
 * `redirect()` thrown here would swallow `useActionState`'s success state and kill
 * the toast. The client reads `state.status === 'success'`, fires the toast, and
 * performs `router.replace('/accounts?deleted=<email>')` itself.
 *
 * The server independently re-validates `confirmation` and the two acknowledgement
 * flags against RECOMPUTED counts (A7/D6/D10) — client-side gating here is UX only,
 * exactly like `updateExpirationDateAction`. `entryPoint`/`nif` (D2) — forwarded
 * from the SAME selector the operator previewed with, via hidden form inputs; the
 * server re-derives and re-validates the actual target set from these, inside the
 * delete transaction's row lock. Never trusted/re-derived on the client.
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const userId = String(formData.get('userId') ?? '');
  const entryPoint = String(formData.get('entryPoint') ?? '');
  const nifRaw = formData.get('nif');
  const confirmation = String(formData.get('confirmation') ?? '');
  const verifactuAcknowledged = formData.get('verifactuAcknowledged') === 'true';
  const thirdPartyDataAcknowledged = formData.get('thirdPartyDataAcknowledged') === 'true';

  const selector: AccountTargetSelector =
    entryPoint === 'nif' ? { entryPoint: 'nif', nif: String(nifRaw ?? '') } : { entryPoint: 'email' };

  try {
    const result = await deleteAccount(userId, {
      ...selector,
      confirmation,
      verifactuAcknowledged,
      thirdPartyDataAcknowledged,
    });
    return { status: 'success', ownerEmail: result.ownerEmail };
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      return {
        status: 'error',
        errorKey: resolveErrorKey(error),
        fallbackMessage: error.message,
      };
    }
    return { status: 'error', errorKey: 'unexpected' };
  }
}
