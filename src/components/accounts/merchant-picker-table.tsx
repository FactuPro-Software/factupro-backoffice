'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  AccountMerchantFactsDto,
  BackofficeMerchantPricingDto,
} from '@/server/api/endpoints/merchant-pricing';
import { PlanBadge } from './plan-badge';

interface MerchantPickerTableProps {
  email: string;
  /** A24 — ALL merchants the resolved user OWNS (the email entry point's full
   * target set), never a partial/paginated view. */
  targets: AccountMerchantFactsDto[];
  /** Pricing is a distinct, optional overlay (D7) — a target merchant without a
   * `MerchantPricingData` row is still listed, with `—` + a "no plan data" badge. */
  pricingByMerchantId: Map<string, BackofficeMerchantPricingDto>;
}

/** F3: zero date-math — this is a plain string slice, never a re-derivation of the Madrid day. */
const toDdMmYyyy = (dateOnly: string) => dateOnly.split('-').reverse().join('/');

/** STATE 2 — shown only when `by=email` and the resolved account's target set has more than 1 merchant. */
export function MerchantPickerTable({ email, targets, pricingByMerchantId }: MerchantPickerTableProps) {
  const t = useTranslations('accounts.picker');

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/accounts">
          <ArrowLeft />
          {t('back')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('title', { email })}</CardTitle>
          <CardDescription>{t('count', { n: targets.length })}</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columnMerchant')}</TableHead>
              <TableHead>{t('columnNif')}</TableHead>
              <TableHead>{t('columnPlan')}</TableHead>
              <TableHead>{t('columnExpires')}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((merchant) => {
              const pricing = pricingByMerchantId.get(merchant.id) ?? null;
              return (
                <TableRow key={merchant.id}>
                  <TableCell className="font-medium">{merchant.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {merchant.nif ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {pricing ? (
                      <PlanBadge planName={pricing.pricing.planName} editable={pricing.editable} />
                    ) : (
                      <Badge variant="outline">{t('noPlanData')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {pricing ? (
                      <>
                        {toDdMmYyyy(pricing.pricing.expirationDateMadrid)}
                        {pricing.pricing.expired && (
                          <Badge variant="destructive" className="ml-2">
                            {t('expired')}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/accounts?by=email&q=${encodeURIComponent(email)}&merchantId=${merchant.id}`}
                      >
                        {t('select')}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
