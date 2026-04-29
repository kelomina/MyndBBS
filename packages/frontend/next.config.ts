import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const apiBaseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  ...(isDev && allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  poweredByHeader: false,
  /* config options here */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ]
      }
    ];
  },
  /**
     * Callers: []
     * Callees: []
     * Description: Handles the rewrites logic for the application.
     * Keywords: rewrites, auto-annotated
     */
    async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiBaseUrl}/uploads/:path*`,
      },
    ]
  }
};

export default nextConfig;
