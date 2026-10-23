import type { BackofficeMerchantPricingDto } from '@/server/api/endpoints/merchant-pricing';

/** trial/digital_kit — eligible for date edits once expired, even while `editable` is false because the plan is active. */
export const isPlanEligible = (pricing: BackofficeMerchantPricingDto): boolean =>
  pricing.notEditableReason !== 'PLAN_NOT_ELIGIBLE';
