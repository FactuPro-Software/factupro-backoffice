'use client';

import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PricingPlanSelect } from './pricing-plan-select';

/**
 * Flat draft object holding every field across all 4 steps. Only the active
 * step is mounted; the confirm step (4) is the one place the full draft is
 * read to build both the summary AND the submitted hidden inputs, so the two
 * can never disagree.
 */
export interface WizardDraft {
  nif: string;
  name: string;
  fiscalZone: string;
  pricingPlanExpirationDate: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  isVerifactu: boolean;
  verifactuStartDate: string;
  pricingPlanName: string;
}

export const INITIAL_DRAFT: WizardDraft = {
  nif: '',
  name: '',
  fiscalZone: '',
  pricingPlanExpirationDate: '',
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: '',
  isVerifactu: false,
  verifactuStartDate: '',
  pricingPlanName: 'digital_kit',
};

/**
 * Source: `factupro-backend/src/data/scripts/helpers/fiscal-zones.helper.ts`
 * (`fiscalZonesData`) — the only two ESP fiscal zones currently seeded.
 * Hardcoded here deliberately: if new zones are seeded this list will drift
 * silently, mitigated by this source-citing comment and by the backend
 * surfacing `MERCHANT_FISCAL_ZONE_NOT_FOUND` as an inline step-1 error rather
 * than a client crash.
 */
export const FISCAL_ZONE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Peninsula', labelKey: 'peninsula' },
  { value: 'Canarias', labelKey: 'canarias' },
];

/** Advisory-only live NIF check status. `'taken'` blocks step 1; `'error'`
 * does NOT block — the POST re-validates regardless. */
export type NifStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export interface ValidateStepContext {
  nifStatus?: NifStatus;
}

/** Syntactic-only check (9 alphanumeric chars) — the server (`check-nif` /
 * POST) is the sole authority on validity/existence. */
export const NIF_SYNTAX_PATTERN = /^[A-Za-z0-9]{9}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pure — returns a map of field name -> i18n validation key (under
 * `accounts.create.validation.*`). Drives both the "Continue" gate and the
 * inline field message. `context.nifStatus` is the only non-draft input,
 * kept optional so the function stays trivially callable/testable without it.
 */
export function validateStep(
  step: number,
  draft: WizardDraft,
  context: ValidateStepContext = {},
): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (step) {
    case 1: {
      const nif = draft.nif.trim();
      if (!nif) {
        errors.nif = 'nifRequired';
      } else if (!NIF_SYNTAX_PATTERN.test(nif)) {
        errors.nif = 'nifInvalid';
      } else if (context.nifStatus === 'taken') {
        errors.nif = 'nifTaken';
      }

      if (!draft.name.trim()) errors.name = 'nameRequired';
      if (!draft.fiscalZone) errors.fiscalZone = 'fiscalZoneRequired';
      if (draft.pricingPlanExpirationDate.trim() && !ISO_DATE_PATTERN.test(draft.pricingPlanExpirationDate.trim())) {
        errors.pricingPlanExpirationDate = 'pricingPlanExpirationDateInvalid';
      }
      break;
    }
    case 2: {
      const ownerEmail = draft.ownerEmail.trim();
      if (!ownerEmail) {
        errors.ownerEmail = 'ownerEmailRequired';
      } else if (!EMAIL_PATTERN.test(ownerEmail)) {
        errors.ownerEmail = 'ownerEmailInvalid';
      }
      if (!draft.ownerFirstName.trim()) errors.ownerFirstName = 'ownerFirstNameRequired';
      if (!draft.ownerLastName.trim()) errors.ownerLastName = 'ownerLastNameRequired';
      break;
    }
    case 3: {
      if (draft.isVerifactu) {
        const verifactuStartDate = draft.verifactuStartDate.trim();
        if (!verifactuStartDate) {
          errors.verifactuStartDate = 'verifactuStartDateRequired';
        } else if (!ISO_DATE_PATTERN.test(verifactuStartDate)) {
          errors.verifactuStartDate = 'verifactuStartDateInvalid';
        }
      }
      break;
    }
    case 4:
    default:
      break;
  }

  return errors;
}

interface StepProps {
  draft: WizardDraft;
  errors: Record<string, string>;
  /** Fields the operator has already interacted with (blurred, or selected
   * for pickers) — gates whether a validation message is SHOWN. `errors`
   * itself is still computed unconditionally so the "Continue" button stays
   * correctly disabled before any field is touched. */
  touched: Partial<Record<keyof WizardDraft, boolean>>;
  onChange: (patch: Partial<WizardDraft>) => void;
  onBlur: (field: keyof WizardDraft) => void;
}

function shown(touched: StepProps['touched'], errors: StepProps['errors'], field: keyof WizardDraft) {
  return touched[field] ? errors[field] : undefined;
}

/** Step 1 — fiscal data + live NIF check + plan expiration date. */
export function FiscalStep({ draft, errors, touched, onChange, onBlur, nifStatus }: StepProps & { nifStatus: NifStatus }) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');
  const nifError = shown(touched, errors, 'nif');
  const nameError = shown(touched, errors, 'name');
  const fiscalZoneError = shown(touched, errors, 'fiscalZone');
  const expirationError = shown(touched, errors, 'pricingPlanExpirationDate');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nif">{t('nif')}</Label>
        <Input
          id="nif"
          autoComplete="off"
          value={draft.nif}
          onChange={(event) => onChange({ nif: event.target.value.toUpperCase() })}
          onBlur={() => onBlur('nif')}
        />
        {nifError ? (
          <p className="text-sm text-destructive">{tValidation(nifError)}</p>
        ) : nifStatus === 'checking' ? (
          <p className="text-xs text-muted-foreground">{t('nifChecking')}</p>
        ) : nifStatus === 'available' ? (
          <p className="text-xs text-emerald-600">{t('nifAvailable')}</p>
        ) : nifStatus === 'error' ? (
          <p className="text-xs text-muted-foreground">{t('nifCheckUnavailable')}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('nifHelper')}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="merchant-name">{t('name')}</Label>
        <Input
          id="merchant-name"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={() => onBlur('name')}
        />
        {nameError && <p className="text-sm text-destructive">{tValidation(nameError)}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fiscalZone">{t('fiscalZone')}</Label>
        <Select
          value={draft.fiscalZone}
          onValueChange={(value) => {
            onChange({ fiscalZone: value });
            onBlur('fiscalZone');
          }}
        >
          <SelectTrigger id="fiscalZone" className="w-full" aria-label={t('fiscalZone')} onBlur={() => onBlur('fiscalZone')}>
            <SelectValue placeholder={t('fiscalZonePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {FISCAL_ZONE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`fiscalZoneOptions.${option.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fiscalZoneError && <p className="text-sm text-destructive">{tValidation(fiscalZoneError)}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pricingPlanExpirationDate">{t('pricingPlanExpirationDate')}</Label>
        <Input
          id="pricingPlanExpirationDate"
          type="date"
          className="w-[220px]"
          value={draft.pricingPlanExpirationDate}
          onChange={(event) => onChange({ pricingPlanExpirationDate: event.target.value })}
          onBlur={() => onBlur('pricingPlanExpirationDate')}
        />
        <p className="text-xs text-muted-foreground">{t('pricingPlanExpirationDateHelper')}</p>
        {expirationError && <p className="text-sm text-destructive">{tValidation(expirationError)}</p>}
      </div>
    </div>
  );
}

/** Step 2 — owner identity. */
export function OwnerStep({ draft, errors, touched, onChange, onBlur }: StepProps) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');
  const emailError = shown(touched, errors, 'ownerEmail');
  const firstNameError = shown(touched, errors, 'ownerFirstName');
  const lastNameError = shown(touched, errors, 'ownerLastName');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerEmail">{t('ownerEmail')}</Label>
        <Input
          id="ownerEmail"
          type="email"
          value={draft.ownerEmail}
          onChange={(event) => onChange({ ownerEmail: event.target.value })}
          onBlur={() => onBlur('ownerEmail')}
        />
        {emailError && <p className="text-sm text-destructive">{tValidation(emailError)}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerFirstName">{t('ownerFirstName')}</Label>
        <Input
          id="ownerFirstName"
          value={draft.ownerFirstName}
          onChange={(event) => onChange({ ownerFirstName: event.target.value })}
          onBlur={() => onBlur('ownerFirstName')}
        />
        {firstNameError && <p className="text-sm text-destructive">{tValidation(firstNameError)}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerLastName">{t('ownerLastName')}</Label>
        <Input
          id="ownerLastName"
          value={draft.ownerLastName}
          onChange={(event) => onChange({ ownerLastName: event.target.value })}
          onBlur={() => onBlur('ownerLastName')}
        />
        {lastNameError && <p className="text-sm text-destructive">{tValidation(lastNameError)}</p>}
      </div>
    </div>
  );
}

/** Step 3 — VeriFactu toggle + conditional start date. */
export function VerifactuStep({ draft, errors, touched, onChange, onBlur }: StepProps) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');
  const dateError = shown(touched, errors, 'verifactuStartDate');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="isVerifactu"
          checked={draft.isVerifactu}
          onCheckedChange={(checked) =>
            onChange({ isVerifactu: checked === true, verifactuStartDate: checked === true ? draft.verifactuStartDate : '' })
          }
        />
        <Label htmlFor="isVerifactu" className="text-sm font-normal">
          {t('isVerifactu')}
        </Label>
      </div>

      {draft.isVerifactu && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="verifactuStartDate">{t('verifactuStartDate')}</Label>
          <Input
            id="verifactuStartDate"
            type="date"
            className="w-[220px]"
            value={draft.verifactuStartDate}
            onChange={(event) => onChange({ verifactuStartDate: event.target.value })}
            onBlur={() => onBlur('verifactuStartDate')}
          />
          {dateError && <p className="text-sm text-destructive">{tValidation(dateError)}</p>}
        </div>
      )}
    </div>
  );
}

interface ConfirmStepProps {
  draft: WizardDraft;
  formId: string;
  formAction: (formData: FormData) => void;
  onPlanChange: (value: string) => void;
}

/**
 * Step 4 — read-only summary of the ENTIRE draft plus the single `<form>`
 * whose hidden inputs are read from the SAME `draft` object the summary above
 * renders, so the two can never disagree. This is the only place
 * `pricingPlan`'s load-bearing hidden input (via `PricingPlanSelect`) gets
 * mounted.
 */
export function ConfirmStep({ draft, formId, formAction, onPlanChange }: ConfirmStepProps) {
  const t = useTranslations('accounts.create.summary');

  return (
    <form id={formId} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="nif" value={draft.nif} />
      <input type="hidden" name="name" value={draft.name} />
      <input type="hidden" name="fiscalZone" value={draft.fiscalZone} />
      {draft.pricingPlanExpirationDate && (
        <input type="hidden" name="pricingPlanExpirationDate" value={draft.pricingPlanExpirationDate} />
      )}
      <input type="hidden" name="ownerEmail" value={draft.ownerEmail} />
      <input type="hidden" name="ownerFirstName" value={draft.ownerFirstName} />
      <input type="hidden" name="ownerLastName" value={draft.ownerLastName} />
      <input type="hidden" name="isVerifactu" value={draft.isVerifactu ? 'true' : 'false'} />
      {draft.isVerifactu && (
        <input type="hidden" name="verifactuStartDate" value={draft.verifactuStartDate} />
      )}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t('nif')}</dt>
          <dd className="font-mono text-sm">{draft.nif}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('name')}</dt>
          <dd className="text-sm">{draft.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('fiscalZone')}</dt>
          <dd className="text-sm">{draft.fiscalZone}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('pricingPlanExpirationDate')}</dt>
          <dd className="text-sm">{draft.pricingPlanExpirationDate || t('pricingPlanExpirationDateDefault')}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('owner')}</dt>
          <dd className="text-sm">
            {draft.ownerFirstName} {draft.ownerLastName} ({draft.ownerEmail})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('verifactu')}</dt>
          <dd className="text-sm">
            {draft.isVerifactu ? t('verifactuEnabled', { date: draft.verifactuStartDate }) : t('verifactuDisabled')}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <dt className="text-xs text-muted-foreground">{t('plan')}</dt>
        <PricingPlanSelect value={draft.pricingPlanName} onValueChange={onPlanChange} />
      </div>
    </form>
  );
}
