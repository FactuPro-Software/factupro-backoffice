import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** STATE 0 — shown when `/accounts` has no search query yet. */
export function AccountsEmptyState() {
  const t = useTranslations('accounts.search');

  return (
    <div className="max-w-3xl rounded-lg border border-dashed p-10 text-center">
      <Search className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-4 text-muted-foreground">{t('empty')}</p>
    </div>
  );
}
