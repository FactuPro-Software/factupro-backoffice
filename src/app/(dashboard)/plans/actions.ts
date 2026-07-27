'use server';

import { revalidatePath } from 'next/cache';

import { updateMerchantExpirationDate } from '@/server/api/endpoints/merchant-pricing';
import { BackofficeApiError } from '@/server/api/errors';

export type UpdateExpirationState =
  | { status: 'idle' }
  | { status: 'success'; merchantName: string; from: string; to: string }
  | { status: 'error'; errorKey: string; fallbackMessage?: string };

/** Maps a backend `errorCode` to an i18n key under `plans.toast.*` (B5). */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  PRICING_PLAN_NOT_EDITABLE_ERROR: 'notEditable',
  MERCHANT_NOT_FOUND_ERROR: 'merchantGone',
  MERCHANT_PRICING_DATA_NOT_FOUND_ERROR: 'merchantGone',
  INVALID_EXPIRATION_DATE_ERROR: 'invalidDate',
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
    revalidatePath('/plans');
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
