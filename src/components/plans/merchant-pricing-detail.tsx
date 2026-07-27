import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BackofficeMerchantPricingDto } from '@/server/api/endpoints/merchant-pricing';
import { ExpirationDateEditor } from './expiration-date-editor';
import { PlanBadge } from './plan-badge';

interface MerchantPricingDetailProps {
  pricing: BackofficeMerchantPricingDto;
  backHref: string;
  /** Came from the picker (email, >1 merchant) vs. straight from search (nif, or email w/ 1 match). */
  backLabel: 'search' | 'list';
  minExpirationDate: string;
}

/** F3: zero date-math — this is a plain string slice, never a re-derivation of the Madrid day. */
const toDdMmYyyy = (dateOnly: string) => dateOnly.split('-').reverse().join('/');

/** STATE 3 — read-only Cards 1-2 + the editable Card 3 (`ExpirationDateEditor`). */
export function MerchantPricingDetail({
  pricing,
  backHref,
  backLabel,
  minExpirationDate,
}: MerchantPricingDetailProps) {
  const { merchant, pricing: plan, editable } = pricing;
  const t = useTranslations('plans.detail');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href={backHref}>
          <ArrowLeft />
          {t(backLabel === 'list' ? 'backToList' : 'backToSearch')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('merchantCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t('name')}</dt>
            <dd className="text-sm font-medium">{merchant.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('nif')}</dt>
            <dd className="font-mono text-sm font-medium">
              {merchant.nif ?? <span className="text-muted-foreground">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('id')}</dt>
            <dd className="break-all font-mono text-xs text-muted-foreground">{merchant.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('status')}</dt>
            <dd className="text-sm font-medium">{merchant.status}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('planCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t('plan')}</dt>
            <dd className="text-sm font-medium">
              <PlanBadge planName={plan.planName} editable={editable} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('level')}</dt>
            <dd className="text-sm font-medium">{plan.planLevel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('expiresOn')}</dt>
            <dd>
              <p className="text-base font-semibold">{toDdMmYyyy(plan.expirationDateMadrid)}</p>
              <p className="text-xs text-muted-foreground">{t('expiresHint')}</p>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('status')}</dt>
            <dd>
              {plan.expired ? (
                <Badge variant="destructive">{t('expired')}</Badge>
              ) : (
                <Badge className="bg-brand-soft text-foreground">{t('active')}</Badge>
              )}
            </dd>
          </div>
        </CardContent>
      </Card>

      <ExpirationDateEditor pricing={pricing} minExpirationDate={minExpirationDate} />
    </div>
  );
}
