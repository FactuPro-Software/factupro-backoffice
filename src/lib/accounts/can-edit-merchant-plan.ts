import type { ListedAccountMerchant } from './listed-account-merchant';
import { resolveMerchantRelation } from './resolve-merchant-relation';

/** SCRUM-154 — only the owner or a super admin (`root` role) may edit the plan reached through this user. */
export const canEditMerchantPlan = (listed: ListedAccountMerchant): boolean => {
  const relation = resolveMerchantRelation(listed);
  return relation === 'owner' || relation === 'superAdmin';
};
