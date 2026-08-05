import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  BackofficeMerchantPricingDto,
  ResolvedBackofficeAccountDto,
} from '@/server/api/endpoints/merchant-pricing';
import { DeleteAccountCard } from './delete-account-card';
import { ExpirationDateEditor } from './expiration-date-editor';
import { PlanBadge } from './plan-badge';

interface AccountDetailProps {
  /** D3/D7 — the resolved account; `account.targetMerchants[0]` is the SINGLE
   * source of truth for the merchant card (guaranteed length 1 by the caller,
   * `page.tsx`'s `PlansResults`). Also forwarded to `DeleteAccountCard` verbatim
   * (entryPoint/matchedNif threading, D2). */
  account: ResolvedBackofficeAccountDto;
  /** `null` when the target merchant has no `MerchantPricingData` row (D7) — a
   * distinct, valid, non-error state. The plan card and `ExpirationDateEditor`
   * only render when this is non-null. */
  pricing: BackofficeMerchantPricingDto | null;
  backHref: string;
  /** Came from the picker (email, >1 target) vs. straight from search (nif, or email w/ 1 target). */
  backLabel: 'search' | 'list';
  minExpirationDate: string;
}

/** F3: zero date-math — this is a plain string slice, never a re-derivation of the Madrid day. */
const toDdMmYyyy = (dateOnly: string) => dateOnly.split('-').reverse().join('/');

/** STATE 3 — read-only Card 1 (merchant facts, D3) + the conditional Cards 2-3
 * (plan + `ExpirationDateEditor`, only when `pricing !== null`, D7). */
export function AccountDetail({ account, pricing, backHref, backLabel, minExpirationDate }: AccountDetailProps) {
  const merchant = account.targetMerchants[0];
  const t = useTranslations('accounts.detail');

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
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{t('name')}</dt>
            <dd className="text-sm font-medium">{merchant.name}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{t('nif')}</dt>
            <dd className="font-mono text-sm font-medium">
              {merchant.nif ?? <span className="text-muted-foreground">—</span>}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{t('id')}</dt>
            <dd className="break-all font-mono text-xs text-muted-foreground">{merchant.id}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{t('status')}</dt>
            <dd className="text-sm font-medium">{merchant.status}</dd>
          </div>
        </CardContent>
      </Card>

      {pricing ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('planCardTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('plan')}</dt>
                <dd className="text-sm font-medium">
                  <PlanBadge planName={pricing.pricing.planName} editable={pricing.editable} />
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('level')}</dt>
                <dd className="text-sm font-medium">{pricing.pricing.planLevel}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">{t('expiresOn')}</dt>
                  <dd className="text-base font-semibold">
                    {toDdMmYyyy(pricing.pricing.expirationDateMadrid)}
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">{t('expiresHint')}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('status')}</dt>
                <dd>
                  {pricing.pricing.expired ? (
                    <Badge variant="destructive">{t('expired')}</Badge>
                  ) : (
                    <Badge className="bg-brand-soft text-foreground">{t('active')}</Badge>
                  )}
                </dd>
              </div>
            </CardContent>
          </Card>

          <ExpirationDateEditor pricing={pricing} minExpirationDate={minExpirationDate} />
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{t('pricingMissingNotice')}</CardContent>
        </Card>
      )}

      <DeleteAccountCard account={account} />
    </div>
  );
}
