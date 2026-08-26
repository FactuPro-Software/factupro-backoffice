import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MerchantPickerTable } from '@/components/accounts/merchant-picker-table';
import { AccountDetail } from '@/components/accounts/account-detail';
import { DeleteAccountCard } from '@/components/accounts/delete-account-card';
import { AccountSearchForm } from '@/components/accounts/account-search-form';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { AccountsSkeleton } from '@/components/accounts/accounts-skeleton';
import {
  getMerchantPricingByNif,
  getMerchantPricingsByUserEmail,
  type BackofficeMerchantPricingListDto,
} from '@/server/api/endpoints/merchant-pricing';
import { BackofficeApiError } from '@/server/api/errors';

interface PlansPageProps {
  searchParams: Promise<{ by?: string; q?: string; merchantId?: string }>;
}

type SearchErrorKey = 'nifNotFound' | 'emailNotFound' | 'connection' | 'unexpected';

/**
 * Rev 4 (D4/D7) — maps a backend `errorCode` to an i18n key under `accounts.errors.*`.
 * `MERCHANT_PRICING_DATA_NOT_FOUND_ERROR`/`USER_MERCHANT_NOT_ACTIVE` are GONE from
 * this switch: neither error is thrown by the backend any more (D4 deletes the
 * "not active" 404, D7 makes a missing pricing row a non-error). The "owns zero
 * merchants" not-found state is likewise NOT an exception — it is a 200 response
 * with `account.targetMerchants.length === 0`, handled in `PlansResults` below,
 * not here.
 */
function resolveSearchErrorKey(error: unknown, by: 'nif' | 'email'): SearchErrorKey {
  if (!(error instanceof BackofficeApiError)) return 'unexpected';
  if (error.statusCode === 0) return 'connection';

  switch (error.errorCode) {
    case 'MERCHANT_NOT_FOUND_ERROR':
      return by === 'nif' ? 'nifNotFound' : 'unexpected';
    case 'USER_FIND_NOT_FOUND':
      return 'emailNotFound';
    default:
      return 'unexpected';
  }
}

function SearchErrorAlert({ errorKey, value }: { errorKey: SearchErrorKey; value: string }) {
  const t = useTranslations('accounts.errors');
  return (
    <Alert variant="destructive" className="max-w-2xl">
      <AlertTitle>{t(`${errorKey}Title`)}</AlertTitle>
      <AlertDescription>{t(`${errorKey}Body`, { value })}</AlertDescription>
    </Alert>
  );
}

/**
 * Tomorrow in Europe/Madrid, 'yyyy-MM-dd' — native `Intl.DateTimeFormat` with an explicit
 * IANA zone, computed on THIS server process (never the browser). Zero date-math libraries
 * (F3): this is arithmetic on an absolute UTC instant, then a single Intl projection into
 * Europe/Madrid — not a re-derivation of a specific stored Madrid day.
 */
function computeMinExpirationDateMadrid(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrow);
}

interface PlansResultsProps {
  by: 'nif' | 'email';
  q: string;
  merchantId?: string;
}

/**
 * Rev 4 (D7/A27) — ONE fetch per search. The pricing endpoint itself now returns
 * the resolved `account` block (D3), so there is no separate resolution call any
 * more (`resolveAccountByNif`/`resolveAccountByUserEmail` are deleted, backend and
 * frontend both). `account.targetMerchants.length` is the single source of truth
 * for branching (A24): 0 → not-found, 1 → detail (nif always lands here — the
 * selector narrows to exactly the matched merchant), >1 → picker + danger zone
 * (only reachable via email search).
 */
async function PlansResults({ by, q, merchantId }: PlansResultsProps) {
  const minExpirationDate = computeMinExpirationDateMadrid();

  let list: BackofficeMerchantPricingListDto;
  try {
    list = by === 'nif' ? await getMerchantPricingByNif(q) : await getMerchantPricingsByUserEmail(q);
  } catch (error) {
    return <SearchErrorAlert errorKey={resolveSearchErrorKey(error, by)} value={q} />;
  }

  const { account, merchants } = list;

  // A27/D7 — the ONLY not-found source. A merchant that is owned but has zero
  // pricing rows is a distinct "found, pricing missing" state (handled inside
  // AccountDetail below), never conflated with true not-found.
  if (account.targetMerchants.length === 0) {
    return <SearchErrorAlert errorKey={by === 'nif' ? 'nifNotFound' : 'emailNotFound'} value={q} />;
  }

  if (account.targetMerchants.length === 1) {
    const pricing = merchants.find((entry) => entry.merchant.id === account.targetMerchants[0].id) ?? null;
    return (
      <AccountDetail
        account={account}
        pricing={pricing}
        backHref="/accounts"
        backLabel="search"
        minExpirationDate={minExpirationDate}
      />
    );
  }

  // account.targetMerchants.length > 1 — only reachable via email search (A24:
  // the nif entry point always narrows to exactly one target).
  if (merchantId) {
    const merchant = account.targetMerchants.find((m) => m.id === merchantId);
    if (merchant) {
      const pricing = merchants.find((entry) => entry.merchant.id === merchant.id) ?? null;
      return (
        <AccountDetail
          account={account}
          pricing={pricing}
          backHref={`/accounts?by=email&q=${encodeURIComponent(q)}`}
          backLabel="list"
          minExpirationDate={minExpirationDate}
        />
      );
    }
    // Stale/invalid merchantId (e.g. edited URL) — fall back to the picker instead of erroring.
  }

  // No merchant selected yet — the picker lists every target merchant (A24: ALL
  // owned merchants on the email path), with the danger zone directly below it.
  // A26 — the old "owns zero" degraded state (Gap 2) is unreachable here BY
  // CONSTRUCTION: `account.targetMerchants.length === 0` already returned above,
  // so `DeleteAccountCard` always receives a non-empty target set.
  const pricingByMerchantId = new Map(merchants.map((entry) => [entry.merchant.id, entry]));
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <MerchantPickerTable
        email={account.user.email}
        targets={account.targetMerchants}
        pricingByMerchantId={pricingByMerchantId}
      />
      <DeleteAccountCard account={account} />
    </div>
  );
}

export default async function PlansPage({ searchParams }: PlansPageProps) {
  const params = await searchParams;
  const by: 'nif' | 'email' = params.by === 'email' ? 'email' : 'nif';
  const q = params.q?.trim() ?? '';
  const merchantId = params.merchantId;

  const t = await getTranslations('accounts');

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/accounts/new">
            <Plus />
            {t('newAccount')}
          </Link>
        </Button>
      </div>

      <AccountSearchForm by={by} q={q} />

      {q ? (
        <Suspense key={`${by}:${q}:${merchantId ?? ''}`} fallback={<AccountsSkeleton />}>
          <PlansResults by={by} q={q} merchantId={merchantId} />
        </Suspense>
      ) : (
        <AccountsEmptyState />
      )}
    </div>
  );
}
