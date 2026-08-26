'use server';

import {
  checkMerchantNif,
  createMerchant,
  type CreateMerchantInput,
} from '@/server/api/endpoints/merchant-creation';
import { BackofficeApiError } from '@/server/api/errors';
import { PRICING_PLAN_OPTIONS } from '@/components/accounts/pricing-plan-options';

export type CreateMerchantState =
  | { status: 'idle' }
  | { status: 'success'; merchantId: string; nif: string; name: string; ownerEmail: string }
  | { status: 'error'; errorKey: string; step: number; fallbackMessage?: string };

const ERROR_KEY_BY_CODE: Record<string, string> = {
  MERCHANT_NIF_ALREADY_EXISTS: 'nifTaken',
  MERCHANT_FISCAL_ZONE_NOT_FOUND: 'fiscalZoneNotFound',
  MERCHANT_PRICING_PLAN_NOT_FOUND_ERROR: 'planNotFound',
  MERCHANT_VERIFACTU_INVALID_COUNTRY: 'verifactuCountry',
  MERCHANT_VERIFACTU_NOT_VALID_NIF: 'verifactuNif',
  MERCHANT_CREATE_ERROR: 'createFailed',
  // Thrown by CreateUserService when the owner email belongs to an existing,
  // non-active user, or one already attached to a different merchant — found
  // via manual testing against a real backend (was falling through to
  // 'unexpected' before this map covered them).
  MERCHANT_USER_NOT_ACTIVE_ERROR: 'ownerUserNotActive',
  MERCHANT_USER_ALREADY_EXISTS_ERROR: 'ownerUserAlreadyExists',
};

/** Default (4, confirm) covers `connection`/`unexpected`/any unmapped code. */
const STEP_BY_ERROR_KEY: Record<string, number> = {
  nifTaken: 1,
  fiscalZoneNotFound: 1,
  verifactuCountry: 3,
  verifactuNif: 3,
  planNotFound: 4,
  createFailed: 4,
  ownerUserNotActive: 2,
  ownerUserAlreadyExists: 2,
};

function resolveErrorKey(error: BackofficeApiError): string {
  if (error.statusCode === 0) return 'connection'; // NETWORK_ERROR / CONFIG_MISSING_*
  if (error.errorCode && ERROR_KEY_BY_CODE[error.errorCode]) {
    return ERROR_KEY_BY_CODE[error.errorCode];
  }
  return 'unexpected';
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * `country` and `acquisitionChannel` are always hardcoded here — never read
 * from `formData` — so a tampered client can never send anything else.
 * `pricingPlan` is allow-listed against `PRICING_PLAN_OPTIONS` rather than
 * trusted verbatim. `pricingPlanExpirationDate` sets `merchant_pricing_data
 * .expiration_date` at creation time; omitted -> backend default (now + 7 days).
 */
function buildCreateMerchantInput(formData: FormData): CreateMerchantInput {
  const nif = String(formData.get('nif') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const fiscalZone = String(formData.get('fiscalZone') ?? '').trim();
  const ownerEmail = String(formData.get('ownerEmail') ?? '').trim();
  const ownerFirstName = String(formData.get('ownerFirstName') ?? '').trim();
  const ownerLastName = String(formData.get('ownerLastName') ?? '').trim();
  const isVerifactu = formData.get('isVerifactu') === 'true';
  const verifactuStartDate = isVerifactu ? optionalString(formData.get('verifactuStartDate')) : undefined;
  const pricingPlanExpirationDate = optionalString(formData.get('pricingPlanExpirationDate'));

  const pricingPlanRaw = String(formData.get('pricingPlan') ?? '');
  const pricingPlanName = PRICING_PLAN_OPTIONS.some((option) => option.value === pricingPlanRaw)
    ? pricingPlanRaw
    : PRICING_PLAN_OPTIONS[0].value;

  return {
    nif,
    name,
    country: 'ESP',
    fiscalZone,
    ownerEmail,
    ownerFirstName,
    ownerLastName,
    isVerifactu,
    ...(verifactuStartDate ? { verifactuStartDate } : {}),
    pricingPlan: { name: pricingPlanName },
    acquisitionChannel: 'KIT_DIGITAL',
    ...(pricingPlanExpirationDate ? { pricingPlanExpirationDate } : {}),
  };
}

/**
 * `useActionState` action — a single `POST merchants` call. `ownerEmail` in
 * the result comes from the SUBMITTED input, never from the response: the
 * backend returns the `Merchant` entity captured before the owner relation is
 * attached, so `owner` is never populated there.
 */
export async function createKitDigitalMerchantAction(
  _prevState: CreateMerchantState,
  formData: FormData,
): Promise<CreateMerchantState> {
  const input = buildCreateMerchantInput(formData);

  try {
    const created = await createMerchant(input);
    return {
      status: 'success',
      merchantId: created.id,
      nif: created.nif,
      name: created.name,
      ownerEmail: input.ownerEmail,
    };
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      const errorKey = resolveErrorKey(error);
      return {
        status: 'error',
        errorKey,
        step: STEP_BY_ERROR_KEY[errorKey] ?? 4,
        fallbackMessage: error.message,
      };
    }
    return { status: 'error', errorKey: 'unexpected', step: 4 };
  }
}

/**
 * Plain (non-`useActionState`) server action — advisory-only live NIF check
 * called from the wizard's debounced effect. `errorKey` results are NOT
 * treated as blocking by the caller; only `exists: true` blocks step 1.
 */
export async function checkNifAction(nif: string): Promise<{ exists: boolean } | { errorKey: string }> {
  try {
    const result = await checkMerchantNif(nif);
    return { exists: result.exists };
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      return { errorKey: resolveErrorKey(error) };
    }
    return { errorKey: 'unexpected' };
  }
}
