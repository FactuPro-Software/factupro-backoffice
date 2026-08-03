'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  BackofficeThirdPartyExposureDto,
  BackofficeVerifactuExposureDto,
} from '@/server/api/endpoints/account-deletion';

/**
 * Row-count step keys are internal purge-order identifiers (design A4, ~55 across 19
 * phases) — translating every single one into es/en is out of scope and would rot
 * silently the moment a new step is appended (D3). Humanize instead of translate:
 * `payroll_items` / `paymentTags` -> "Payroll items" / "Payment tags".
 */
function humanizeStepKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface RowCountsTableProps {
  rowCounts: Record<string, number>;
}

/** Ordered exactly as returned by the impact response (step order = purge order, D3/D4). */
function RowCountsTable({ rowCounts }: RowCountsTableProps) {
  const t = useTranslations('accounts.impact');
  const entries = Object.entries(rowCounts);
  const totalRows = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium">{t('rowCountsTitle')}</h4>
        <span className="text-xs text-muted-foreground">
          {t('rowCountsTotal', { n: totalRows })}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rowCountsTable')}</TableHead>
              <TableHead className="text-right">{t('rowCountsCount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, count]) => (
              <TableRow key={key} className={count === 0 ? 'text-muted-foreground' : undefined}>
                <TableCell className="text-sm">{humanizeStepKey(key)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface VerifactuExposurePanelProps {
  exposure: BackofficeVerifactuExposureDto;
}

/** A15 — informational when this renders in the 'impact' step, wrapped with a required
 * acknowledgement checkbox by the caller when it renders in the 'warnings' step. */
export function VerifactuExposurePanel({ exposure }: VerifactuExposurePanelProps) {
  const t = useTranslations('accounts.verifactu');

  if (exposure.totalInvoices === 0) {
    return (
      <Alert>
        <AlertTitle>{t('cleanTitle')}</AlertTitle>
        <AlertDescription>{t('cleanBody')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <ShieldAlert />
      <AlertTitle>{t('title', { n: exposure.totalInvoices })}</AlertTitle>
      <AlertDescription>
        <p>{t('retentionWarning')}</p>
        {exposure.byMerchant.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            {exposure.byMerchant.map((m) => (
              <li key={m.merchantId}>
                {t('byMerchantLine', { name: m.name, nif: m.nif ?? '—', n: m.count })}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface ThirdPartyExposurePanelProps {
  exposure: BackofficeThirdPartyExposureDto;
}

/** D8 — grouped by the foreign merchant, never a bare number: the operator needs to
 * know WHICH other company's data is at risk, not just a scary count. */
export function ThirdPartyExposurePanel({ exposure }: ThirdPartyExposurePanelProps) {
  const t = useTranslations('accounts.thirdParty');

  if (exposure.totalRows === 0) {
    return (
      <Alert>
        <AlertTitle>{t('cleanTitle')}</AlertTitle>
        <AlertDescription>{t('cleanBody')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{t('title', { n: exposure.totalRows })}</AlertTitle>
      <AlertDescription>
        <p>{t('body')}</p>
        <ul className="mt-2 flex w-full flex-col gap-2 text-xs">
          {exposure.merchants.map((m) => {
            const breakdown = Object.entries(m.rows).filter(([, count]) => count > 0);
            const merchantTotal = breakdown.reduce((sum, [, count]) => sum + count, 0);
            return (
              <li key={m.merchantId} className="rounded-md border bg-background p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {m.name} <span className="font-mono text-muted-foreground">({m.nif ?? '—'})</span>
                  </span>
                  <Badge variant="destructive">{t('rowsBadge', { n: merchantTotal })}</Badge>
                </div>
                {breakdown.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    {breakdown.map(([table, count]) => `${humanizeStepKey(table)}: ${count}`).join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

interface AccountImpactTableProps {
  rowCounts: Record<string, number>;
  verifactuExposure: BackofficeVerifactuExposureDto;
  thirdPartyExposure: BackofficeThirdPartyExposureDto;
}

/** The 'impact' dialog step — full-picture, informational, no gating. */
export function AccountImpactTable({
  rowCounts,
  verifactuExposure,
  thirdPartyExposure,
}: AccountImpactTableProps) {
  return (
    <div className="flex flex-col gap-4">
      <RowCountsTable rowCounts={rowCounts} />
      <VerifactuExposurePanel exposure={verifactuExposure} />
      <ThirdPartyExposurePanel exposure={thirdPartyExposure} />
    </div>
  );
}
