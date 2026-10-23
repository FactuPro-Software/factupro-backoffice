import type { ResolvedBackofficeAccountDto } from '@/server/api/endpoints/merchant-pricing';
import type { ListedAccountMerchant } from './listed-account-merchant';

/**
 * SCRUM-154 — owned merchants first, then (email path only) the merchants the user
 * belongs to without owning them. The nif path stays narrowed to the matched merchant
 * (A24). `targetMerchants` itself is never widened: account deletion stays owner-only.
 */
export function listAccountMerchants(account: ResolvedBackofficeAccountDto): ListedAccountMerchant[] {
  const owned = account.targetMerchants.map((merchant) => ({ merchant, isOwner: true }));
  if (account.entryPoint !== 'email') return owned;

  const members = account.otherMembershipMerchants.map((merchant) => ({ merchant, isOwner: false }));
  return [...owned, ...members];
}
