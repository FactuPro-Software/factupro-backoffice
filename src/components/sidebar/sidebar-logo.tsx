'use client';

import { Building2 } from 'lucide-react';

import { useSidebar } from '@/components/ui/sidebar';

export function SidebarLogo() {
  const { open, isMobile } = useSidebar();
  const expanded = open || isMobile;

  return (
    <div
      className={`flex h-full items-center px-2 ${expanded ? 'w-full justify-start gap-2' : 'justify-center'}`}
    >
      <Building2 className="size-6 shrink-0 text-primary-details" />
      {expanded && (
        <span className="truncate font-semibold text-foreground">
          Backoffice
        </span>
      )}
    </div>
  );
}
