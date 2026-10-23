import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { canEditMerchantPlan } from '@/lib/accounts/can-edit-merchant-plan';
import { isPlanEligible } from '@/lib/accounts/is-plan-eligible';
import { resolveExpiresHintKey } from '@/lib/accounts/resolve-expires-hint-key';
import type { ListedAccountMerchant } from '@/lib/accounts/listed-account-merchant';
import type {
  BackofficeMerchantPricingDto,
  ResolvedBackofficeAccountDto,
} from '@/server/api/endpoints/merchant-pricing';
import { DeleteAccountCard } from './delete-account-card';
import { ExpirationDateEditor } from './expiration-date-editor';
import { ExpiryStatusBadge } from './expiry-status-badge';
import { MerchantRelationBadge } from './merchant-relation-badge';
import { PlanBadge } from './plan-badge';

interface AccountDetailProps {
  /** D3/D7 — the resolved account, forwarded to `DeleteAccountCard` verbatim
   * (entryPoint/matchedNif threading, D2). */
  account: ResolvedBackofficeAccountDto;
  /** SCRUM-154 — the merchant shown in the card. The danger zone only renders when
   * the user owns it: deleting an account never reaches a merchant it only belongs to.
   * The plan is only editable for the owner or a super admin (`root` role). */
  listed: ListedAccountMerchant;
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
export function AccountDetail({ account, listed, pricing, backHref, backLabel, minExpirationDate }: AccountDetailProps) {
  const { merchant, isOwner } = listed;
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
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{t('relation')}</dt>
            <dd>
              <MerchantRelationBadge listed={listed} />
            </dd>
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
                  <PlanBadge planName={pricing.pricing.planName} eligible={isPlanEligible(pricing)} />
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
                    {pricing.pricing.expirationDateMadrid ? toDdMmYyyy(pricing.pricing.expirationDateMadrid) : '—'}
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">{t(resolveExpiresHintKey(pricing.pricing))}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('status')}</dt>
                <dd>
                  <ExpiryStatusBadge expired={pricing.pricing.expired} />
                </dd>
              </div>
            </CardContent>
          </Card>

          <ExpirationDateEditor
            pricing={pricing}
            canEditPlan={canEditMerchantPlan(listed)}
            minExpirationDate={minExpirationDate}
          />
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{t('pricingMissingNotice')}</CardContent>
        </Card>
      )}

      {isOwner && <DeleteAccountCard account={account} />}
    </div>
  );
}
