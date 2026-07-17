'use client';

import { useTranslations } from 'next-intl';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { NavUser } from './sidebar/nav-user';

export function Header() {
  const t = useTranslations('header');

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" aria-label={t('toggleSidebar')} />
        <div className="ml-auto flex items-center gap-2">
          <NavUser />
        </div>
      </div>
    </header>
  );
}
