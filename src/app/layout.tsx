import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import type React from 'react';

import { dmSans } from '@/lib/fonts';
import { ThemeProvider } from '@/providers/theme-provider';

import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    template: '%s | FactuPro Backoffice',
    default: 'FactuPro Backoffice',
  },
  description: 'FactuPro Backoffice',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const themeDefault =
    (cookieStore.get('theme')?.value as 'light' | 'dark' | 'system') || 'light';

  return (
    <html lang={locale} className={dmSans.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme={themeDefault}
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
