import { useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('nav');

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t('settings')}</h1>
      <p className="text-muted-foreground">
        Backoffice shell placeholder — no business content yet.
      </p>
    </div>
  );
}
