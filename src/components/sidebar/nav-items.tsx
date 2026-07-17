'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from './sidebar-data';

interface NavItemsProps {
  navItems: NavItem[];
}

export function NavItems({ navItems }: NavItemsProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const isRouteActive = (url: string) =>
    pathname === url || (url !== '/' && pathname?.startsWith(url + '/'));

  return (
    <SidebarGroup>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton
              asChild
              tooltip={t(item.key)}
              isActive={isRouteActive(item.url)}
              className="data-[active=true]:bg-brand-soft data-[active=true]:text-foreground data-[active=true]:font-medium"
            >
              <Link href={item.url} className="flex items-center w-full">
                {item.icon && <item.icon />}
                <span>{t(item.key)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
