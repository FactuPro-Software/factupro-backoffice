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
import type { BackofficeMerchantPricingDto } from '@/server/api/endpoints/merchant-pricing';
import { PlanBadge } from './plan-badge';

interface MerchantPickerTableProps {
  email: string;
  merchants: BackofficeMerchantPricingDto[];
}

/** F3: zero date-math — this is a plain string slice, never a re-derivation of the Madrid day. */
const toDdMmYyyy = (dateOnly: string) => dateOnly.split('-').reverse().join('/');

/** STATE 2 — shown only when `by=email` and the user belongs to more than one merchant. */
export function MerchantPickerTable({ email, merchants }: MerchantPickerTableProps) {
  const t = useTranslations('plans.picker');

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/plans">
          <ArrowLeft />
          {t('back')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('title', { email })}</CardTitle>
          <CardDescription>{t('count', { n: merchants.length })}</CardDescription>
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
            {merchants.map(({ merchant, pricing, editable }) => (
              <TableRow key={merchant.id}>
                <TableCell className="font-medium">{merchant.name}</TableCell>
                <TableCell className="font-mono text-sm">
                  {merchant.nif ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <PlanBadge planName={pricing.planName} editable={editable} />
                </TableCell>
                <TableCell>
                  {toDdMmYyyy(pricing.expirationDateMadrid)}
                  {pricing.expired && (
                    <Badge variant="destructive" className="ml-2">
                      {t('expired')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/plans?by=email&q=${encodeURIComponent(email)}&merchantId=${merchant.id}`}
                    >
                      {t('select')}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
