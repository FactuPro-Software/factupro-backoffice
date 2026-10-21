import type { AccountMerchantFactsDto } from '@/server/api/endpoints/merchant-pricing';

/** SCRUM-154 — a merchant shown in the accounts search, owned or reached through a role/permission. */
export interface ListedAccountMerchant {
  merchant: AccountMerchantFactsDto;
  isOwner: boolean;
}
