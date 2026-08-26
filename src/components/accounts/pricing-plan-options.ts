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
 *
 * Deliberately NOT in `pricing-plan-select.tsx` ('use client'): the server
 * action in `accounts/new/actions.ts` needs the real array too, and importing
 * a value export from a 'use client' module into server code resolves to an
 * opaque client reference there, not the actual array.
 */
export const PRICING_PLAN_OPTIONS: PricingPlanOption[] = [{ value: 'digital_kit', labelKey: 'digitalKit' }];

/** Flip to `true` (and extend `PRICING_PLAN_OPTIONS`) to let the operator choose a plan. */
export const PRICING_PLAN_SELECTABLE = false;
