'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavItems } from './nav-items';
import { NavUser } from './nav-user';
import { data } from './sidebar-data';
import { SidebarLogo } from './sidebar-logo';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader
        className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear"
        aria-label="Sidebar Header"
      >
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        <NavItems navItems={data.navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
