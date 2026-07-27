'use client';

import { Info, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateExpirationDateAction, type UpdateExpirationState } from '@/app/(dashboard)/plans/actions';
import type { BackofficeMerchantPricingDto } from '@/server/api/endpoints/merchant-pricing';

interface ExpirationDateEditorProps {
  pricing: BackofficeMerchantPricingDto;
  /** Tomorrow in Europe/Madrid, 'yyyy-MM-dd' — computed server-side (F3), never re-derived here. */
  minExpirationDate: string;
}

/** F3: zero date-math — this is a plain string slice, never a re-derivation of the Madrid day. */
const toDdMmYyyy = (dateOnly: string) => dateOnly.split('-').reverse().join('/');

const INITIAL_STATE: UpdateExpirationState = { status: 'idle' };

/** Card 3 — "Nueva fecha de expiración". Native `input[type=date]` (F2), no date libraries (F3). */
export function ExpirationDateEditor({ pricing, minExpirationDate }: ExpirationDateEditorProps) {
  const t = useTranslations('plans.editor');
  const tConfirm = useTranslations('plans.confirm');
  const tToast = useTranslations('plans.toast');

  const currentExpiration = pricing.pricing.expirationDateMadrid;
  const formId = `expiration-date-form-${pricing.merchant.id}`;

  const [selectedDate, setSelectedDate] = useState(currentExpiration);
  const [reason, setReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateExpirationDateAction, INITIAL_STATE);

  // Derived-state-from-props reset: when a fresh `pricing` snapshot arrives (e.g. after
  // revalidatePath on save), sync local editable state without an extra effect-render flash.
  const lastSeenExpirationRef = useRef(currentExpiration);
  if (lastSeenExpirationRef.current !== currentExpiration) {
    lastSeenExpirationRef.current = currentExpiration;
    setSelectedDate(currentExpiration);
    setReason('');
  }

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(tToast('successTitle'), {
        description: tToast('successBody', {
          merchant: state.merchantName,
          from: toDdMmYyyy(state.from),
          to: toDdMmYyyy(state.to),
        }),
      });
      setDialogOpen(false);
    } else if (state.status === 'error') {
      toast.error(tToast(`${state.errorKey}Title`), {
        description: tToast(`${state.errorKey}Body`),
      });
      // Dialog stays open on error so the operator can retry or cancel deliberately.
    }
  }, [state, tToast]);

  if (!pricing.editable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info />
            <AlertTitle>{t('notEditableTitle')}</AlertTitle>
            <AlertDescription>
              {t.rich('notEditableBody', {
                planName: pricing.pricing.planName,
                code: (chunks) => <code>{chunks}</code>,
              })}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = !selectedDate;
  const isInvalidDate = !isEmpty && selectedDate < minExpirationDate;
  const isUnchanged = selectedDate === currentExpiration;
  const saveDisabled = isEmpty || isInvalidDate || isUnchanged || isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="merchantId" value={pricing.merchant.id} />
          <input type="hidden" name="currentExpirationDate" value={currentExpiration} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expirationDate">{t('dateLabel')}</Label>
            <Input
              id="expirationDate"
              name="expirationDate"
              type="date"
              className="w-[220px]"
              required
              min={minExpirationDate}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('dateHelper')}</p>

            {isEmpty ? (
              <p className="text-sm text-destructive">{t('validationEmpty')}</p>
            ) : isInvalidDate ? (
              <p className="text-sm text-destructive">{t('validationPast')}</p>
            ) : isUnchanged ? (
              <p className="text-xs text-muted-foreground">{t('unchanged')}</p>
            ) : (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('previewCurrent')} </span>
                <span className="font-medium text-foreground">{toDdMmYyyy(currentExpiration)}</span>
                <span className="text-muted-foreground"> → {t('previewNew')} </span>
                <span className="font-medium text-foreground">{toDdMmYyyy(selectedDate)}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{t('reasonLabel')}</Label>
            <Textarea
              id="reason"
              name="reason"
              maxLength={500}
              rows={2}
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('reasonHelper')}</p>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={() => setDialogOpen(true)} disabled={saveDisabled}>
              {t('save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedDate(currentExpiration);
                setReason('');
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>

        <AlertDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!isPending) setDialogOpen(open);
          }}
        >
          {/* AlertDialogContent already preventDefaults outside-click/interact internally
              (Radix bakes this in for alertdialog role); Escape still needs to be blocked
              explicitly so the dialog is fully non-dismissable while pending or otherwise. */}
          <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{tConfirm('title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-3 text-left">
                  <p>
                    {tConfirm.rich('merchantLine', {
                      name: pricing.merchant.name,
                      nif: pricing.merchant.nif ?? '—',
                      b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                    })}
                  </p>
                  <p>
                    {tConfirm.rich('planLine', {
                      planName: pricing.pricing.planName,
                      code: (chunks) => <code>{chunks}</code>,
                    })}
                  </p>
                  <div className="rounded-md border bg-muted p-3 text-sm">
                    {tConfirm('currentDateLabel')} {toDdMmYyyy(currentExpiration)}
                    {' → '}
                    {tConfirm('newDateLabel')}{' '}
                    <span className="font-semibold">{toDdMmYyyy(selectedDate)}</span>
                  </div>
                  <p className="text-sm text-destructive">{tConfirm('warning')}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>{tConfirm('cancel')}</AlertDialogCancel>
              <AlertDialogAction type="submit" form={formId} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {tConfirm('submitPending')}
                  </>
                ) : (
                  tConfirm('submit')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
