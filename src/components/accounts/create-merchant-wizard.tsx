'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createKitDigitalMerchantAction,
  retryKitDigitalAction,
  checkNifAction,
  type CreateMerchantState,
} from '@/app/(dashboard)/accounts/new/actions';
import {
  ConfirmStep,
  FiscalStep,
  INITIAL_DRAFT,
  KitDigitalStep,
  NIF_SYNTAX_PATTERN,
  OwnerStep,
  VerifactuStep,
  validateStep,
  type NifStatus,
  type WizardDraft,
} from './create-merchant-steps';

const INITIAL_STATE: CreateMerchantState = { status: 'idle' };
const CREATE_FORM_ID = 'create-merchant-form';
const RETRY_FORM_ID = 'retry-kit-digital-form';
const NIF_CHECK_DEBOUNCE_MS = 400;
const TOTAL_STEPS = 5;

/** Design D6 — only codes with a natural field home get one; the rest
 * (`planNotFound`, `createFailed`, `connection`, `unexpected`) surface as a
 * generic, non-field alert on the step the operator was returned to. */
const FIELD_BY_ERROR_KEY: Partial<Record<string, keyof WizardDraft>> = {
  nifTaken: 'nif',
  fiscalZoneNotFound: 'fiscalZone',
  verifactuCountry: 'verifactuStartDate',
  verifactuNif: 'verifactuStartDate',
};

/**
 * Wizard shell (design D1-D4). Holds the single flat `WizardDraft`; only the
 * active step is mounted. Live NIF check runs through a 400ms debounce with a
 * monotonic request-id guard (D3) since server actions cannot be aborted with
 * `AbortSignal`. The confirmation step's single `<form>` is bound to
 * `createKitDigitalMerchantAction`; a `partial` result replaces the wizard
 * with a PATCH-only retry panel bound to `retryKitDigitalAction` — retrying
 * NEVER re-invokes `createMerchant` (spec "Tri-State Submission Result").
 */
export function CreateMerchantWizard() {
  const t = useTranslations('accounts.create');
  const tToast = useTranslations('accounts.create.toast');
  const router = useRouter();

  const [draft, setDraft] = useState<WizardDraft>(INITIAL_DRAFT);
  const [step, setStep] = useState(1);
  const [nifStatus, setNifStatus] = useState<NifStatus>('idle');

  const [, startNifCheck] = useTransition();
  const nifRequestIdRef = useRef(0);
  const nifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createState, createFormAction, isCreating] = useActionState(
    createKitDigitalMerchantAction,
    INITIAL_STATE,
  );
  const [retryState, retryFormAction, isRetrying] = useActionState(retryKitDigitalAction, INITIAL_STATE);

  // `retryFormAction` can only ever fire after `createState` is already
  // `partial`, so any non-idle `retryState` always postdates it — no extra
  // bookkeeping needed to know which result is the latest one.
  const result: CreateMerchantState = retryState.status !== 'idle' ? retryState : createState;

  function updateDraft(patch: Partial<WizardDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  // Debounced, latest-wins live NIF check (design D3).
  useEffect(() => {
    const nif = draft.nif.trim();
    if (nifDebounceRef.current) clearTimeout(nifDebounceRef.current);

    if (!NIF_SYNTAX_PATTERN.test(nif)) {
      setNifStatus('idle');
      return;
    }

    setNifStatus('checking');
    nifDebounceRef.current = setTimeout(() => {
      const requestId = ++nifRequestIdRef.current;
      startNifCheck(async () => {
        const checkResult = await checkNifAction(nif);
        // Latest-wins guard — a newer keystroke already superseded this request.
        if (requestId !== nifRequestIdRef.current) return;
        if ('errorKey' in checkResult) {
          setNifStatus('error'); // advisory only (D3) — never blocks
        } else {
          setNifStatus(checkResult.exists ? 'taken' : 'available');
        }
      });
    }, NIF_CHECK_DEBOUNCE_MS);

    return () => {
      if (nifDebounceRef.current) clearTimeout(nifDebounceRef.current);
    };
  }, [draft.nif]);

  // Jump to the offending step / surface a toast whenever a server result arrives.
  useEffect(() => {
    if (result.status === 'error') {
      setStep(result.step);
      if (result.errorKey === 'nifTaken') setNifStatus('taken');
      toast.error(tToast(`${result.errorKey}Title`), { description: tToast(`${result.errorKey}Body`) });
    } else if (result.status === 'partial') {
      toast.error(tToast(`${result.errorKey}Title`), { description: tToast(`${result.errorKey}Body`) });
    } else if (result.status === 'success') {
      toast.success(tToast('successTitle'), { description: tToast('successBody', { name: result.name }) });
      router.replace(`/accounts?by=nif&q=${encodeURIComponent(result.nif)}`);
    }
  }, [result]);

  if (result.status === 'success') {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" />
            {t('result.successTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('result.successBody', { name: result.name })}</p>
        </CardContent>
      </Card>
    );
  }

  if (result.status === 'partial') {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('result.partialTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>{tToast(`${result.errorKey}Title`)}</AlertTitle>
            <AlertDescription>{tToast(`${result.errorKey}Body`)}</AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            {t('result.partialBody', { name: result.name, nif: result.nif })}
          </p>
          {/* PATCH-only retry (design D4) — fiscal/owner fields are never
              re-exposed here, and this form can never trigger a new POST. */}
          <form id={RETRY_FORM_ID} action={retryFormAction} className="hidden">
            <input type="hidden" name="merchantId" value={result.merchantId} />
            <input type="hidden" name="nif" value={result.nif} />
            <input type="hidden" name="name" value={result.name} />
            <input type="hidden" name="ownerEmail" value={result.ownerEmail} />
            <input type="hidden" name="endDateDigitalKit" value={draft.endDateDigitalKit} />
            <input type="hidden" name="extensionPlan" value={draft.extensionPlan} />
            <input type="hidden" name="internalRef" value={draft.internalRef} />
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form={RETRY_FORM_ID} disabled={isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="animate-spin" />
                {t('result.retryPending')}
              </>
            ) : (
              t('result.retry')
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const stepErrors = validateStep(step, draft, { nifStatus });
  const serverFieldErrors: Record<string, string> = {};
  if (result.status === 'error' && result.step === step) {
    const field = FIELD_BY_ERROR_KEY[result.errorKey];
    if (field) serverFieldErrors[field] = result.errorKey;
  }
  const errors = { ...stepErrors, ...serverFieldErrors };
  const canContinue = Object.keys(stepErrors).length === 0;

  const showGenericStepError =
    result.status === 'error' && result.step === step && !FIELD_BY_ERROR_KEY[result.errorKey];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t(`steps.step${step}Title`)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showGenericStepError && result.status === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>{tToast(`${result.errorKey}Title`)}</AlertTitle>
            <AlertDescription>{tToast(`${result.errorKey}Body`)}</AlertDescription>
          </Alert>
        )}

        {step === 1 && <FiscalStep draft={draft} errors={errors} onChange={updateDraft} nifStatus={nifStatus} />}
        {step === 2 && <OwnerStep draft={draft} errors={errors} onChange={updateDraft} />}
        {step === 3 && <VerifactuStep draft={draft} errors={errors} onChange={updateDraft} />}
        {step === 4 && <KitDigitalStep draft={draft} errors={errors} onChange={updateDraft} />}
        {step === 5 && (
          <ConfirmStep
            draft={draft}
            formId={CREATE_FORM_ID}
            formAction={createFormAction}
            onPlanChange={(value) => updateDraft({ pricingPlanName: value })}
          />
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((current) => current - 1)}
          disabled={step === 1 || isCreating}
        >
          {t('back')}
        </Button>
        {step < TOTAL_STEPS ? (
          // Distinct `key` from the submit button below (design D-fix): without it, React
          // mutates type="button" -> type="submit" on the SAME DOM node when `step` reaches
          // TOTAL_STEPS, and browsers resolve a click's default action against the button's
          // type at the end of the event, not at click time — so the very click that was
          // meant to just advance the step ends up auto-submitting the form. A distinct key
          // forces an unmount/remount instead of an in-place attribute mutation.
          <Button
            key="continue"
            type="button"
            onClick={() => setStep((current) => current + 1)}
            disabled={!canContinue}
          >
            {t('continue')}
          </Button>
        ) : (
          <Button key="submit" type="submit" form={CREATE_FORM_ID} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="animate-spin" />
                {t('submitPending')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
