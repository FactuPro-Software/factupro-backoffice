import type { MEMBER_ROLE_NAMES } from '@/lib/constants/roles';

/** SCRUM-154 — how the searched user relates to a merchant; doubles as the `accounts.relations` i18n key. */
export type MerchantRelation = 'owner' | 'superAdmin' | (typeof MEMBER_ROLE_NAMES)[number] | 'member';
