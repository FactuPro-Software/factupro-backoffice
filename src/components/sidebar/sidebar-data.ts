import { CalendarClock, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  key: string;
  url: string;
  icon?: LucideIcon;
}

export const data: { navItems: NavItem[] } = {
  navItems: [
    { key: 'dashboard', url: '/', icon: LayoutDashboard },
    { key: 'plans', url: '/plans', icon: CalendarClock },
    { key: 'settings', url: '/settings', icon: Settings },
  ],
};
