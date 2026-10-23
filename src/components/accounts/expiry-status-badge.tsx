import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ExpiryStatusBadgeProps {
  /** `null` when the plan has no known end date (a paid plan without a Stripe period end). */
  expired: boolean | null;
  className?: string;
}

export function ExpiryStatusBadge({ expired, className }: ExpiryStatusBadgeProps) {
  const t = useTranslations('accounts.expiry');

  if (expired === null) {
    return (
      <Badge variant="outline" className={className}>
        {t('unknown')}
      </Badge>
    );
  }

  return expired ? (
    <Badge variant="destructive" className={className}>
      {t('expired')}
    </Badge>
  ) : (
    <Badge className={cn('bg-brand-soft text-foreground', className)}>{t('active')}</Badge>
  );
}
