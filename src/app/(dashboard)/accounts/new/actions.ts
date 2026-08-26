'use server';

import {
  checkMerchantNif,
  createMerchant,
  updateMerchantKitDigitalData,
  type CreateMerchantInput,
  type CreatedMerchantDto,
  type UpdateKitDigitalInput,
} from '@/server/api/endpoints/merchant-creation';
import { BackofficeApiError } from '@/server/api/errors';
import { PRICING_PLAN_OPTIONS } from '@/components/accounts/pricing-plan-options';

export type CreateMerchantState =
  | { status: 'idle' }
  | { status: 'success'; merchantId: string; nif: string; name: string; ownerEmail: string }
  | {
      status: 'partial';
      merchantId: string;
      nif: string;
      name: string;
      ownerEmail: string;
      errorKey: string;
      fallbackMessage?: string;
    }
  | { status: 'error'; stage: 'create'; errorKey: string; step: number; fallbackMessage?: string };

/**
 * Design D6 — this action's OWN error map (deliberately not imported from
 * `accounts/actions.ts`, which is namespace-coupled to `accounts.toast.*` /
 * `accounts.delete.toast.*`). Covers both stages: `create` (POST merchants)
 * and `kit_digital` (PATCH merchants/:nif/kit_digital) — the two never share
 * a code, so one flat map is safe.
 */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  MERCHANT_NIF_ALREADY_EXISTS: 'nifTaken',
  MERCHANT_FISCAL_ZONE_NOT_FOUND: 'fiscalZoneNotFound',
  MERCHANT_PRICING_PLAN_NOT_FOUND_ERROR: 'planNotFound',
  MERCHANT_VERIFACTU_INVALID_COUNTRY: 'verifactuCountry',
  MERCHANT_VERIFACTU_NOT_VALID_NIF: 'verifactuNif',
  MERCHANT_CREATE_ERROR: 'createFailed',
  MERCHANT_NOT_FOUND_ERROR: 'kitDigitalMerchantGone',
  MERCHANT_NOT_KIT_DIGITAL_ERROR: 'kitDigitalChannelMismatch',
  // Thrown by CreateUserService when the owner email belongs to an existing,
  // non-active user, or one already attached to a different merchant — found
  // via manual testing against a real backend (was falling through to
  // 'unexpected' before this map covered them).
  MERCHANT_USER_NOT_ACTIVE_ERROR: 'ownerUserNotActive',
  MERCHANT_USER_ALREADY_EXISTS_ERROR: 'ownerUserAlreadyExists',
};

/** Only meaningful for `create`-stage keys — `kit_digital`-stage keys always
 * resolve to `partial`, which carries no `step`. Default (5, confirm) covers
 * `connection`/`unexpected`/any unmapped code per spec's fallback scenario. */
const STEP_BY_ERROR_KEY: Record<string, number> = {
  nifTaken: 1,
  fiscalZoneNotFound: 1,
  verifactuCountry: 3,
  verifactuNif: 3,
  planNotFound: 5,
  createFailed: 5,
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
 * `country` and `acquisitionChannel` are always hardcoded here (design D8,
 * spec "Wizard Field Scope") — never read from `formData` — so a tampered
 * client can never send anything else. `pricingPlan` is allow-listed against
 * `PRICING_PLAN_OPTIONS` (design D5) rather than trusted verbatim.
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
  };
}

function buildKitDigitalInput(formData: FormData): UpdateKitDigitalInput {
  const endDateDigitalKit = optionalString(formData.get('endDateDigitalKit'));
  const extensionPlan = optionalString(formData.get('extensionPlan'));
  const internalRef = optionalString(formData.get('internalRef'));

  return {
    ...(endDateDigitalKit ? { endDateDigitalKit } : {}),
    ...(extensionPlan ? { extensionPlan } : {}),
    ...(internalRef ? { internalRef } : {}),
  };
}

/**
 * `ownerEmail` is taken from the SUBMITTED input, never from `created.owner`
 * (design fix — found via manual testing against a real backend):
 * `POST merchants` returns the `Merchant` entity captured before
 * `CreateMerchantService` attaches the owner relation, so the response's
 * `owner` field is never populated. We already know the email we sent; no
 * need to trust a response shape the backend doesn't actually fill in.
 */
function toPartialState(
  created: Pick<CreatedMerchantDto, 'id' | 'nif' | 'name'>,
  ownerEmail: string,
  error: unknown,
): Extract<CreateMerchantState, { status: 'partial' }> {
  const errorKey = error instanceof BackofficeApiError ? resolveErrorKey(error) : 'unexpected';
  const fallbackMessage = error instanceof BackofficeApiError ? error.message : undefined;
  return {
    status: 'partial',
    merchantId: created.id,
    nif: created.nif,
    name: created.name,
    ownerEmail,
    errorKey,
    fallbackMessage,
  };
}

/**
 * `useActionState` action (design D4) — POST `merchants` then PATCH
 * `merchants/:nif/kit_digital`, tri-state result. POST failure ⇒ `error`
 * (nothing created, wizard stays editable, spec "Full failure before
 * creation"). POST ok + PATCH fail ⇒ `partial`, carrying the CANONICAL nif
 * returned by the POST (never the operator-typed one). This action MUST NEVER
 * be re-invoked once `partial` is reached for a given nif — only
 * `retryKitDigitalAction` (PATCH-only) is safe to retry.
 */
export async function createKitDigitalMerchantAction(
  _prevState: CreateMerchantState,
  formData: FormData,
): Promise<CreateMerchantState> {
  const input = buildCreateMerchantInput(formData);
  const kitDigitalInput = buildKitDigitalInput(formData);

  let created: CreatedMerchantDto;
  try {
    created = await createMerchant(input);
  } catch (error) {
    if (error instanceof BackofficeApiError) {
      const errorKey = resolveErrorKey(error);
      return {
        status: 'error',
        stage: 'create',
        errorKey,
        step: STEP_BY_ERROR_KEY[errorKey] ?? 5,
        fallbackMessage: error.message,
      };
    }
    return { status: 'error', stage: 'create', errorKey: 'unexpected', step: 5 };
  }

  try {
    await updateMerchantKitDigitalData(created.nif, kitDigitalInput);
    return {
      status: 'success',
      merchantId: created.id,
      nif: created.nif,
      name: created.name,
      ownerEmail: input.ownerEmail,
    };
  } catch (error) {
    return toPartialState(created, input.ownerEmail, error);
  }
}

/**
 * PATCH-only retry (design D4) for the `partial` recovery path. Addressed by
 * the CANONICAL nif carried on the `partial` state — never re-issues
 * `createMerchant`. Returns the SAME union restricted to `success` | `partial`
 * so the result panel needs no second branch shape.
 */
export async function retryKitDigitalAction(
  _prevState: CreateMerchantState,
  formData: FormData,
): Promise<CreateMerchantState> {
  const merchantId = String(formData.get('merchantId') ?? '');
  const nif = String(formData.get('nif') ?? '');
  const name = String(formData.get('name') ?? '');
  const ownerEmail = String(formData.get('ownerEmail') ?? '');
  const kitDigitalInput = buildKitDigitalInput(formData);

  try {
    await updateMerchantKitDigitalData(nif, kitDigitalInput);
    return { status: 'success', merchantId, nif, name, ownerEmail };
  } catch (error) {
    return toPartialState({ id: merchantId, nif, name }, ownerEmail, error);
  }
}

/**
 * Plain (non-`useActionState`) server action (design D3) — advisory-only live
 * NIF check called from the wizard's debounced effect. `errorKey` results are
 * NOT treated as blocking by the caller; only `exists: true` blocks step 1.
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
