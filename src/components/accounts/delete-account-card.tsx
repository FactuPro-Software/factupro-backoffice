'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deleteAccountAction,
  fetchAccountDeletionImpactAction,
  type DeleteAccountState,
} from '@/app/(dashboard)/accounts/actions';
import type {
  AccountTargetSelector,
  ResolvedBackofficeAccountDto,
} from '@/server/api/endpoints/merchant-pricing';
import type { BackofficeAccountDeletionImpactDto } from '@/server/api/endpoints/account-deletion';
import { AccountImpactTable, ThirdPartyExposurePanel, VerifactuExposurePanel } from './account-impact-table';

interface DeleteAccountCardProps {
  /** D3/D7/A26/A27 — always present, always non-empty `targetMerchants`
   * (guaranteed by `page.tsx`'s `PlansResults`: `account.targetMerchants.length
   * === 0` is handled upstream as the true not-found state, so this component
   * never needs to degrade — the Rev 2/3 "resolution unavailable" branch and the
   * "owns zero merchants" branch are both structurally unreachable now, per A26,
   * and have been removed entirely rather than left as dead code). */
  account: ResolvedBackofficeAccountDto;
}

type DialogStep = 'impact' | 'warnings' | 'confirm';
type ImpactFetchState = 'idle' | 'loading' | 'loaded' | 'error';

const INITIAL_DELETE_STATE: DeleteAccountState = { status: 'idle' };
const FORM_ID = 'delete-account-form';

/** D2 — derives the SAME selector the operator searched with; never re-derived
 * from anything else, and forwarded verbatim to both the impact preview and the
 * delete submit (the confirm dialog must never disagree with what it previewed). */
function selectorFromAccount(account: ResolvedBackofficeAccountDto): AccountTargetSelector {
  return account.entryPoint === 'nif'
    ? { entryPoint: 'nif', nif: account.matchedNif ?? '' }
    : { entryPoint: 'email' };
}

/**
 * Danger zone (D17) — rendered below the expiration editor (or the picker, for
 * the multi-target email case). One non-dismissable `AlertDialog` (D15) with
 * three internal steps: `impact -> warnings -> confirm`. The 'impact' fetch runs
 * on dialog open, never on page load (D16), and is re-run every time against the
 * SAME `selector` (D2) the operator arrived with.
 */
export function DeleteAccountCard({ account }: DeleteAccountCardProps) {
  const t = useTranslations('accounts.delete');
  const tToast = useTranslations('accounts.delete.toast');
  const router = useRouter();

  const { user, targetMerchants } = account;
  const selector = selectorFromAccount(account);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>('impact');
  const [impactState, setImpactState] = useState<ImpactFetchState>('idle');
  const [impact, setImpact] = useState<BackofficeAccountDeletionImpactDto | null>(null);
  const [impactErrorKey, setImpactErrorKey] = useState<string | null>(null);
  const [verifactuAck, setVerifactuAck] = useState(false);
  const [thirdPartyAck, setThirdPartyAck] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');
  const [, startImpactTransition] = useTransition();

  const [deleteState, formAction, isDeleting] = useActionState(
    deleteAccountAction,
    INITIAL_DELETE_STATE,
  );

  useEffect(() => {
    if (deleteState.status === 'success') {
      toast.success(tToast('successTitle'), {
        description: tToast('successBody', { email: deleteState.ownerEmail }),
      });
      setDialogOpen(false);
      router.replace(`/accounts?deleted=${encodeURIComponent(deleteState.ownerEmail)}`);
    } else if (deleteState.status === 'error') {
      toast.error(tToast(`${deleteState.errorKey}Title`), {
        description: tToast(`${deleteState.errorKey}Body`),
      });
      // Dialog stays open on error (matches expiration-date-editor pattern) so the
      // operator can see exactly what the server rejected and correct it.
    }
  }, [deleteState, tToast, router]);

  function resetDialogState() {
    setStep('impact');
    setImpactState('idle');
    setImpact(null);
    setImpactErrorKey(null);
    setVerifactuAck(false);
    setThirdPartyAck(false);
    setConfirmValue('');
  }

  function loadImpact() {
    setImpactState('loading');
    startImpactTransition(async () => {
      const result = await fetchAccountDeletionImpactAction(user.id, selector);
      if (result.status === 'success') {
        setImpact(result.impact);
        setImpactState('loaded');
      } else {
        setImpactErrorKey(result.errorKey);
        setImpactState('error');
      }
    });
  }

  function handleOpenChange(open: boolean) {
    if (isDeleting) return; // non-dismissable while the delete request is in flight
    if (open) {
      resetDialogState();
      setDialogOpen(true);
      loadImpact();
    } else {
      setDialogOpen(false);
      resetDialogState();
    }
  }

  const verifactuRequired = impact ? impact.verifactuExposure.totalInvoices > 0 : false;
  const thirdPartyRequired = impact ? impact.thirdPartyExposure.totalRows > 0 : false;
  const warningsAcked = (!verifactuRequired || verifactuAck) && (!thirdPartyRequired || thirdPartyAck);
  const tokenMatches = impact
    ? confirmValue.trim().toLowerCase() === impact.confirmationToken.trim().toLowerCase()
    : false;
  const deleteDisabled = !impact || !tokenMatches || !warningsAcked || isDeleting;
  // account-deletion-plan-guard — the whole target set is blocked when ANY
  // merchant in it is on a non-editable pricing plan (or has no pricing row at
  // all, fail-closed). The server is the sole enforcement authority (DELETE
  // still 409s with ME035 regardless); this only gates the client's Continue
  // button so the operator cannot reach the confirmation step.
  const planBlocked = impact?.blockedByPlan === true;
  const impactStepCanContinue = impactState === 'loaded' && impact !== null && !planBlocked;

  function handleContinue() {
    if (step === 'impact') {
      if (!impact) return;
      setStep(verifactuRequired || thirdPartyRequired ? 'warnings' : 'confirm');
    } else if (step === 'warnings') {
      setStep('confirm');
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">{t('cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('ownerLabel')}
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">{user.email}</span>
        </div>

        <p className="text-sm text-muted-foreground">{t('description')}</p>

        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{t('targetMerchantsTitle', { n: targetMerchants.length })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {targetMerchants.map((m) => (
                <li key={m.id}>
                  {m.name} <span className="font-mono">({m.nif ?? '—'})</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          variant="destructive"
          className="w-fit"
          onClick={() => handleOpenChange(true)}
        >
          {t('openButton')}
        </Button>
      </CardContent>

      <AlertDialog open={dialogOpen} onOpenChange={handleOpenChange}>
        {/* Escape blocked explicitly (Radix already prevents outside-click/interact on
            alertdialog role) — fully non-dismissable while pending or otherwise, same
            as expiration-date-editor.tsx. */}
        <AlertDialogContent
          onEscapeKeyDown={(event) => event.preventDefault()}
          className="max-h-[85vh] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`dialog.${step}Title`)}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <form
                id={FORM_ID}
                action={formAction}
                className="flex flex-col gap-4 text-left text-sm text-foreground"
              >
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="entryPoint" value={selector.entryPoint} />
                {selector.entryPoint === 'nif' && (
                  <input type="hidden" name="nif" value={selector.nif} />
                )}
                <input type="hidden" name="verifactuAcknowledged" value={verifactuAck ? 'true' : 'false'} />
                <input
                  type="hidden"
                  name="thirdPartyDataAcknowledged"
                  value={thirdPartyAck ? 'true' : 'false'}
                />

                {step === 'impact' &&
                  (impactState === 'loading' || impactState === 'idle' ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="animate-spin" />
                      {t('dialog.loadingImpact')}
                    </div>
                  ) : impactState === 'error' ? (
                    <Alert variant="destructive">
                      <AlertTitle>{tToast(`${impactErrorKey}Title`)}</AlertTitle>
                      <AlertDescription>{tToast(`${impactErrorKey}Body`)}</AlertDescription>
                    </Alert>
                  ) : impact ? (
                    <div className="flex flex-col gap-4">
                      {planBlocked && (
                        <Alert variant="destructive">
                          <AlertTriangle />
                          <AlertTitle>{t('planBlocked.title')}</AlertTitle>
                          <AlertDescription>
                            <p>{t('planBlocked.description')}</p>
                            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                              {impact.blockedByPlanMerchants.map((m) => (
                                <li key={m.id}>
                                  {m.name} — {m.nif ?? '—'} —{' '}
                                  {m.pricingPlanName ?? t('planBlocked.unknownPlan')}
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                      <AccountImpactTable
                        rowCounts={impact.rowCounts}
                        verifactuExposure={impact.verifactuExposure}
                        thirdPartyExposure={impact.thirdPartyExposure}
                      />
                    </div>
                  ) : null)}

                {step === 'warnings' && impact && (
                  <div className="flex flex-col gap-4">
                    {verifactuRequired && (
                      <div className="flex flex-col gap-2">
                        <VerifactuExposurePanel exposure={impact.verifactuExposure} />
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="verifactu-ack"
                            checked={verifactuAck}
                            onCheckedChange={(checked) => setVerifactuAck(checked === true)}
                          />
                          <Label htmlFor="verifactu-ack" className="text-sm font-normal">
                            {t('dialog.verifactuAck')}
                          </Label>
                        </div>
                      </div>
                    )}
                    {thirdPartyRequired && (
                      <div className="flex flex-col gap-2">
                        <ThirdPartyExposurePanel exposure={impact.thirdPartyExposure} />
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="third-party-ack"
                            checked={thirdPartyAck}
                            onCheckedChange={(checked) => setThirdPartyAck(checked === true)}
                          />
                          <Label htmlFor="third-party-ack" className="text-sm font-normal">
                            {t('dialog.thirdPartyAck')}
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 'confirm' && impact && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-destructive">
                      {impact.deleteUserRow ? t('dialog.confirmWarning') : t('dialog.confirmWarningSurvivor')}
                    </p>

                    {/* A23 — when the user survives (deleteUserRow=false), name WHICH
                        merchant(s) caused survival, split by relationship. Driven by the
                        freshly-fetched impact (never the stale search-time resolution). */}
                    {!impact.deleteUserRow && (
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs font-semibold text-foreground">{t('dialog.retentionTitle')}</p>
                        {impact.retention.stillOwns.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t('dialog.retentionStillOwns')}
                            </p>
                            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                              {impact.retention.stillOwns.map((m) => (
                                <li key={m.id}>
                                  {m.name} <span className="font-mono">({m.nif ?? '—'})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {impact.retention.stillMemberOf.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t('dialog.retentionStillMemberOf')}
                            </p>
                            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                              {impact.retention.stillMemberOf.map((m) => (
                                <li key={m.id}>
                                  {m.name} <span className="font-mono">({m.nif ?? '—'})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('dialog.retentionUnchangedNote')}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="confirmation">{t('dialog.confirmLabel')}</Label>
                      <div className="rounded-md border bg-muted p-2 font-mono text-sm">
                        {impact.confirmationToken}
                      </div>
                      <Input
                        id="confirmation"
                        name="confirmation"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={confirmValue}
                        onChange={(event) => setConfirmValue(event.target.value)}
                        disabled={isDeleting}
                      />
                    </div>
                  </div>
                )}
              </form>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('dialog.cancel')}</AlertDialogCancel>
            {step === 'impact' && impactState === 'error' ? (
              <Button type="button" onClick={() => loadImpact()}>
                {t('dialog.retry')}
              </Button>
            ) : step !== 'confirm' ? (
              <Button
                type="button"
                onClick={handleContinue}
                disabled={step === 'impact' ? !impactStepCanContinue : !warningsAcked}
              >
                {t('dialog.continue')}
              </Button>
            ) : (
              // Plain Button, deliberately NOT AlertDialogAction: Radix's Action
              // primitive auto-closes the dialog synchronously on click, which fired
              // BEFORE useActionState's isDeleting flipped true — the form's DOM node
              // (and all local state via resetDialogState) was torn down mid-submit,
              // so the request never completed and no loader ever appeared. A plain
              // submit button has no such built-in close behavior — the dialog only
              // closes via our own isDeleting guard / the success effect below.
              <Button
                type="submit"
                form={FORM_ID}
                disabled={deleteDisabled}
                variant="destructive"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('dialog.submitPending')}
                  </>
                ) : (
                  t('dialog.submit')
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
