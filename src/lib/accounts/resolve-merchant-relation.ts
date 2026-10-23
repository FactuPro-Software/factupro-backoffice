import { MEMBER_ROLE_NAMES, ROOT_ROLE_NAME } from '@/lib/constants/roles';
import type { ListedAccountMerchant } from './listed-account-merchant';
import type { MerchantRelation } from './merchant-relation';

const isMemberRoleName = (roleName: string): roleName is (typeof MEMBER_ROLE_NAMES)[number] =>
  (MEMBER_ROLE_NAMES as readonly string[]).includes(roleName);

/** `Merchant.owner` wins over any role; a `root` role without ownership is a super admin. */
export function resolveMerchantRelation({ merchant, isOwner }: ListedAccountMerchant): MerchantRelation {
  if (isOwner) return 'owner';
  if (merchant.roleName === ROOT_ROLE_NAME) return 'superAdmin';
  if (merchant.roleName && isMemberRoleName(merchant.roleName)) return merchant.roleName;
  return 'member';
}
