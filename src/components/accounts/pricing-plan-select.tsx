'use client';

import { useTranslations } from 'next-intl';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PricingPlanOption {
  value: string;
  labelKey: string;
}

/**
 * D5 (design `sdd/merchant-kit-digital-creation/design`) — the only pricing
 * plan this wizard ever creates a merchant under is Kit Digital. This list and
 * `PRICING_PLAN_SELECTABLE` below are the ONLY two things a future change
 * needs to touch to offer more plans and un-lock the control: add entries
 * here, flip the flag, no component tree / action signature / payload shape
 * changes required.
 */
export const PRICING_PLAN_OPTIONS: PricingPlanOption[] = [{ value: 'digital_kit', labelKey: 'digitalKit' }];

/** Flip to `true` (and extend `PRICING_PLAN_OPTIONS`) to let the operator choose a plan. */
export const PRICING_PLAN_SELECTABLE = false;

interface PricingPlanSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: PricingPlanOption[];
  disabled?: boolean;
  /** Form field name for the load-bearing hidden input below. */
  name?: string;
}

/**
 * Renders the visible plan selector AND a separate, non-disabled hidden input
 * carrying the same value.
 *
 * LOAD-BEARING (D5 gotcha): a disabled form control — including the native
 * `<select>` Radix renders under the hood for `name` — is excluded from
 * `FormData` on submit. Without the hidden input below, `pricingPlan` would
 * silently vanish from the submitted payload despite the visible control
 * showing "Kit Digital". Do not remove it as "redundant".
 */
export function PricingPlanSelect({
  value,
  onValueChange,
  options = PRICING_PLAN_OPTIONS,
  disabled = !PRICING_PLAN_SELECTABLE,
  name = 'pricingPlan',
}: PricingPlanSelectProps) {
  const t = useTranslations('accounts.create.plan');

  return (
    <>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={t('label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Load-bearing — see the LOAD-BEARING note above. */}
      <input type="hidden" name={name} value={value} />
    </>
  );
}
