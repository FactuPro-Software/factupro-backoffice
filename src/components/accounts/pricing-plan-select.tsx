'use client';

import { useTranslations } from 'next-intl';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRICING_PLAN_OPTIONS, PRICING_PLAN_SELECTABLE, type PricingPlanOption } from './pricing-plan-options';

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
