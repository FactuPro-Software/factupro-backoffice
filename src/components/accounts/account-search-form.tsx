'use client';

import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AccountSearchFormProps {
  by: 'nif' | 'email';
  q: string;
}

/** useFormStatus must run in a descendant of the <form>, never in the component that renders it. */
function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Search />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** STATE 1 — always-visible search card. Plain `<form method="GET">` — URL is the state (F1). */
export function AccountSearchForm({ by, q }: AccountSearchFormProps) {
  const t = useTranslations('accounts.search');
  const [tab, setTab] = useState<'nif' | 'email'>(by);
  const [nifError, setNifError] = useState(false);
  const [emailError, setEmailError] = useState(false);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'nif' | 'email')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="nif">{t('tabNif')}</TabsTrigger>
            <TabsTrigger value="email">{t('tabEmail')}</TabsTrigger>
          </TabsList>

          <TabsContent value="nif">
            <form
              method="GET"
              action="/accounts"
              className="flex flex-col gap-2 pt-4"
              onSubmit={(event) => {
                const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
                if (!input.value.trim()) {
                  event.preventDefault();
                  setNifError(true);
                }
              }}
            >
              <input type="hidden" name="by" value="nif" />
              <Label htmlFor="q-nif">{t('nifLabel')}</Label>
              <Input
                id="q-nif"
                name="q"
                placeholder="B12345678"
                autoComplete="off"
                required
                defaultValue={by === 'nif' ? q : ''}
                onChange={() => setNifError(false)}
              />
              {nifError ? (
                <p className="text-sm text-destructive">{t('nifRequired')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('nifHelper')}</p>
              )}
              <div>
                <SubmitButton label={t('submit')} pendingLabel={t('submitPending')} />
              </div>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form
              method="GET"
              action="/accounts"
              className="flex flex-col gap-2 pt-4"
              onSubmit={(event) => {
                const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
                if (!input.value.trim()) {
                  event.preventDefault();
                  setEmailError(true);
                }
              }}
            >
              <input type="hidden" name="by" value="email" />
              <Label htmlFor="q-email">{t('emailLabel')}</Label>
              <Input
                id="q-email"
                name="q"
                type="email"
                placeholder="usuario@empresa.com"
                required
                defaultValue={by === 'email' ? q : ''}
                onChange={() => setEmailError(false)}
              />
              {emailError ? (
                <p className="text-sm text-destructive">{t('emailRequired')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('emailHelper')}</p>
              )}
              <div>
                <SubmitButton label={t('submit')} pendingLabel={t('submitPending')} />
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
