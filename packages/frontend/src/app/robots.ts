import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kolobbs.kolostudio.fun';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/u/settings', '/messages', '/compose'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
