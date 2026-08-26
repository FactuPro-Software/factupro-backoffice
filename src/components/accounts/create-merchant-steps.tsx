'use client';

import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PricingPlanSelect } from './pricing-plan-select';

/**
 * Flat draft object holding every field across all 5 steps (design D1). Only
 * the active step is mounted; the confirm step (5) is the one place the full
 * draft is read to build both the summary AND the submitted hidden inputs, so
 * the two can never disagree.
 */
export interface WizardDraft {
  nif: string;
  name: string;
  fiscalZone: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  isVerifactu: boolean;
  verifactuStartDate: string;
  pricingPlanName: string;
  endDateDigitalKit: string;
  extensionPlan: string;
  internalRef: string;
}

export const INITIAL_DRAFT: WizardDraft = {
  nif: '',
  name: '',
  fiscalZone: '',
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: '',
  isVerifactu: false,
  verifactuStartDate: '',
  pricingPlanName: 'digital_kit',
  endDateDigitalKit: '',
  extensionPlan: '',
  internalRef: '',
};

/**
 * Source: `factupro-backend/src/data/scripts/helpers/fiscal-zones.helper.ts`
 * (`fiscalZonesData`) — the only two ESP fiscal zones currently seeded.
 * Hardcoded here deliberately (design Open Questions): if new zones are
 * seeded this list will drift silently, mitigated by this source-citing
 * comment and by the backend surfacing `MERCHANT_FISCAL_ZONE_NOT_FOUND` as an
 * inline step-1 error rather than a client crash.
 */
export const FISCAL_ZONE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Peninsula', labelKey: 'peninsula' },
  { value: 'Canarias', labelKey: 'canarias' },
];

/** Advisory-only live NIF check status (design D3). `'taken'` blocks step 1;
 * `'error'` does NOT block — the POST re-validates regardless. */
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
 * Pure (design D2) — returns a map of field name -> i18n validation key
 * (under `accounts.create.validation.*`). Drives both the "Continue" gate and
 * the inline field message. `context.nifStatus` is the only non-draft input,
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
    case 4: {
      if (!draft.endDateDigitalKit.trim()) errors.endDateDigitalKit = 'endDateDigitalKitRequired';
      break;
    }
    case 5:
    default:
      break;
  }

  return errors;
}

interface StepProps {
  draft: WizardDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<WizardDraft>) => void;
}

/** Step 1 — fiscal data + live NIF check (spec "Wizard Field Scope", "Live NIF Validation"). */
export function FiscalStep({ draft, errors, onChange, nifStatus }: StepProps & { nifStatus: NifStatus }) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nif">{t('nif')}</Label>
        <Input
          id="nif"
          autoComplete="off"
          value={draft.nif}
          onChange={(event) => onChange({ nif: event.target.value.toUpperCase() })}
        />
        {errors.nif ? (
          <p className="text-sm text-destructive">{tValidation(errors.nif)}</p>
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
        <Input id="merchant-name" value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
        {errors.name && <p className="text-sm text-destructive">{tValidation(errors.name)}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fiscalZone">{t('fiscalZone')}</Label>
        <Select value={draft.fiscalZone} onValueChange={(value) => onChange({ fiscalZone: value })}>
          <SelectTrigger id="fiscalZone" className="w-full" aria-label={t('fiscalZone')}>
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
        {errors.fiscalZone && <p className="text-sm text-destructive">{tValidation(errors.fiscalZone)}</p>}
      </div>
    </div>
  );
}

/** Step 2 — owner identity (spec "Wizard Field Scope"). */
export function OwnerStep({ draft, errors, onChange }: StepProps) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerEmail">{t('ownerEmail')}</Label>
        <Input
          id="ownerEmail"
          type="email"
          value={draft.ownerEmail}
          onChange={(event) => onChange({ ownerEmail: event.target.value })}
        />
        {errors.ownerEmail && <p className="text-sm text-destructive">{tValidation(errors.ownerEmail)}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerFirstName">{t('ownerFirstName')}</Label>
        <Input
          id="ownerFirstName"
          value={draft.ownerFirstName}
          onChange={(event) => onChange({ ownerFirstName: event.target.value })}
        />
        {errors.ownerFirstName && <p className="text-sm text-destructive">{tValidation(errors.ownerFirstName)}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerLastName">{t('ownerLastName')}</Label>
        <Input
          id="ownerLastName"
          value={draft.ownerLastName}
          onChange={(event) => onChange({ ownerLastName: event.target.value })}
        />
        {errors.ownerLastName && <p className="text-sm text-destructive">{tValidation(errors.ownerLastName)}</p>}
      </div>
    </div>
  );
}

/** Step 3 — VeriFactu toggle + conditional start date (spec "Conditional VeriFactu Start Date"). */
export function VerifactuStep({ draft, errors, onChange }: StepProps) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');

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
          />
          {errors.verifactuStartDate && (
            <p className="text-sm text-destructive">{tValidation(errors.verifactuStartDate)}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Step 4 — Kit Digital subsidy fields (spec "Wizard Field Scope"). */
export function KitDigitalStep({ draft, errors, onChange }: StepProps) {
  const t = useTranslations('accounts.create.fields');
  const tValidation = useTranslations('accounts.create.validation');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endDateDigitalKit">{t('endDateDigitalKit')}</Label>
        <Input
          id="endDateDigitalKit"
          type="date"
          className="w-[220px]"
          value={draft.endDateDigitalKit}
          onChange={(event) => onChange({ endDateDigitalKit: event.target.value })}
        />
        {errors.endDateDigitalKit && (
          <p className="text-sm text-destructive">{tValidation(errors.endDateDigitalKit)}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="extensionPlan">{t('extensionPlan')}</Label>
        <Input
          id="extensionPlan"
          value={draft.extensionPlan}
          onChange={(event) => onChange({ extensionPlan: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="internalRef">{t('internalRef')}</Label>
        <Input
          id="internalRef"
          value={draft.internalRef}
          onChange={(event) => onChange({ internalRef: event.target.value })}
        />
      </div>
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
 * Step 5 — read-only summary of the ENTIRE draft plus the single `<form>`
 * (design D1) whose hidden inputs are read from the SAME `draft` object the
 * summary above renders, so the two can never disagree. This is the only
 * place `pricingPlan`'s load-bearing hidden input (D5, via `PricingPlanSelect`)
 * gets mounted.
 */
export function ConfirmStep({ draft, formId, formAction, onPlanChange }: ConfirmStepProps) {
  const t = useTranslations('accounts.create.summary');

  return (
    <form id={formId} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="nif" value={draft.nif} />
      <input type="hidden" name="name" value={draft.name} />
      <input type="hidden" name="fiscalZone" value={draft.fiscalZone} />
      <input type="hidden" name="ownerEmail" value={draft.ownerEmail} />
      <input type="hidden" name="ownerFirstName" value={draft.ownerFirstName} />
      <input type="hidden" name="ownerLastName" value={draft.ownerLastName} />
      <input type="hidden" name="isVerifactu" value={draft.isVerifactu ? 'true' : 'false'} />
      {draft.isVerifactu && (
        <input type="hidden" name="verifactuStartDate" value={draft.verifactuStartDate} />
      )}
      <input type="hidden" name="endDateDigitalKit" value={draft.endDateDigitalKit} />
      <input type="hidden" name="extensionPlan" value={draft.extensionPlan} />
      <input type="hidden" name="internalRef" value={draft.internalRef} />

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
        <div>
          <dt className="text-xs text-muted-foreground">{t('endDateDigitalKit')}</dt>
          <dd className="text-sm">{draft.endDateDigitalKit || '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <dt className="text-xs text-muted-foreground">{t('plan')}</dt>
        <PricingPlanSelect value={draft.pricingPlanName} onValueChange={onPlanChange} />
      </div>
    </form>
  );
}
