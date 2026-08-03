import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async redirects() {
    return [
      {
        source: '/plans',
        destination: '/accounts',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
