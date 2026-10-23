import type { BackofficePricingSummaryDto } from '@/server/api/endpoints/merchant-pricing';

/** `accounts.detail` key explaining where the shown end date comes from. */
export function resolveExpiresHintKey(
  pricing: BackofficePricingSummaryDto,
): 'expiresHint' | 'expiresHintStripe' | 'expiresHintStripeMissing' {
  if (pricing.expirationSource === 'PLAN') return 'expiresHint';
  return pricing.expirationDate ? 'expiresHintStripe' : 'expiresHintStripeMissing';
}
