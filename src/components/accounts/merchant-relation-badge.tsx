import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { ListedAccountMerchant } from '@/lib/accounts/listed-account-merchant';
import { resolveMerchantRelation } from '@/lib/accounts/resolve-merchant-relation';

interface MerchantRelationBadgeProps {
  listed: ListedAccountMerchant;
  className?: string;
}

export function MerchantRelationBadge({ listed, className }: MerchantRelationBadgeProps) {
  const t = useTranslations('accounts.relations');

  return (
    <Badge variant="outline" className={className}>
      {t(resolveMerchantRelation(listed))}
    </Badge>
  );
}
