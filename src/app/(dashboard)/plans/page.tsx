import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MerchantPickerTable } from '@/components/plans/merchant-picker-table';
import { MerchantPricingDetail } from '@/components/plans/merchant-pricing-detail';
import { PlanSearchForm } from '@/components/plans/plan-search-form';
import { PlansEmptyState } from '@/components/plans/plans-empty-state';
import { PlansSkeleton } from '@/components/plans/plans-skeleton';
import {
  getMerchantPricingByNif,
  getMerchantPricingsByUserEmail,
  type BackofficeMerchantPricingDto,
} from '@/server/api/endpoints/merchant-pricing';
import { BackofficeApiError } from '@/server/api/errors';

interface PlansPageProps {
  searchParams: Promise<{ by?: string; q?: string; merchantId?: string }>;
}

type SearchErrorKey =
  | 'nifNotFound'
  | 'emailNotFound'
  | 'noActiveMerchant'
  | 'pricingMissing'
  | 'pricingMissingAll'
  | 'connection'
  | 'unexpected';

/**
 * Maps a backend `errorCode` to an i18n key under `plans.errors.*` (design B6 failure matrix).
 * `MERCHANT_PRICING_DATA_NOT_FOUND_ERROR` reuses the searched value for the message body since
 * the 404 response carries no structured merchant name (verified against the live backend
 * service — only the merchant id appears in the plain-text `message`, not as `errorData`).
 */
function resolveSearchErrorKey(error: unknown, by: 'nif' | 'email'): SearchErrorKey {
  if (!(error instanceof BackofficeApiError)) return 'unexpected';
  if (error.statusCode === 0) return 'connection';

  switch (error.errorCode) {
    case 'MERCHANT_NOT_FOUND_ERROR':
      return by === 'nif' ? 'nifNotFound' : 'unexpected';
    case 'MERCHANT_PRICING_DATA_NOT_FOUND_ERROR':
      return 'pricingMissing';
    case 'USER_FIND_NOT_FOUND':
      return 'emailNotFound';
    case 'USER_MERCHANT_NOT_ACTIVE':
      return 'noActiveMerchant';
    default:
      return 'unexpected';
  }
}

function SearchErrorAlert({ errorKey, value }: { errorKey: SearchErrorKey; value: string }) {
  const t = useTranslations('plans.errors');
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

async function PlansResults({ by, q, merchantId }: PlansResultsProps) {
  const minExpirationDate = computeMinExpirationDateMadrid();

  if (by === 'nif') {
    let pricing: BackofficeMerchantPricingDto;
    try {
      pricing = await getMerchantPricingByNif(q);
    } catch (error) {
      return <SearchErrorAlert errorKey={resolveSearchErrorKey(error, 'nif')} value={q} />;
    }
    return (
      <MerchantPricingDetail
        pricing={pricing}
        backHref="/plans"
        backLabel="search"
        minExpirationDate={minExpirationDate}
      />
    );
  }

  let list: Awaited<ReturnType<typeof getMerchantPricingsByUserEmail>>;
  try {
    list = await getMerchantPricingsByUserEmail(q);
  } catch (error) {
    return <SearchErrorAlert errorKey={resolveSearchErrorKey(error, 'email')} value={q} />;
  }

  if (list.merchants.length === 0) {
    return <SearchErrorAlert errorKey="pricingMissingAll" value={q} />;
  }

  if (list.merchants.length === 1) {
    return (
      <MerchantPricingDetail
        pricing={list.merchants[0]}
        backHref="/plans"
        backLabel="search"
        minExpirationDate={minExpirationDate}
      />
    );
  }

  if (merchantId) {
    const selected = list.merchants.find((m) => m.merchant.id === merchantId);
    if (selected) {
      return (
        <MerchantPricingDetail
          pricing={selected}
          backHref={`/plans?by=email&q=${encodeURIComponent(q)}`}
          backLabel="list"
          minExpirationDate={minExpirationDate}
        />
      );
    }
    // Stale/invalid merchantId (e.g. edited URL) — fall back to the picker instead of erroring.
  }

  return <MerchantPickerTable email={list.user.email} merchants={list.merchants} />;
}

export default async function PlansPage({ searchParams }: PlansPageProps) {
  const params = await searchParams;
  const by: 'nif' | 'email' = params.by === 'email' ? 'email' : 'nif';
  const q = params.q?.trim() ?? '';
  const merchantId = params.merchantId;

  const t = await getTranslations('plans');

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('subtitle')}</p>

      <PlanSearchForm by={by} q={q} />

      {q ? (
        <Suspense key={`${by}:${q}:${merchantId ?? ''}`} fallback={<PlansSkeleton />}>
          <PlansResults by={by} q={q} merchantId={merchantId} />
        </Suspense>
      ) : (
        <PlansEmptyState />
      )}
    </div>
  );
}
