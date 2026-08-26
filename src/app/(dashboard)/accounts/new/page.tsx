import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { CreateMerchantWizard } from '@/components/accounts/create-merchant-wizard';

/** `/accounts/new` — server component: heading, back link, mounts the
 * (client) wizard. Not yet linked from `/accounts` (that wiring is PR3). */
export default async function NewAccountPage() {
  const t = await getTranslations('accounts.create');

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/accounts">
            <ArrowLeft />
            {t('backToAccounts')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <CreateMerchantWizard />
    </div>
  );
}
