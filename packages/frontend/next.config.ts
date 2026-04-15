import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  ...(isDev ? { allowedDevOrigins: ['run-agent-69df216631a5a8e9f2c02147-mnzlxl5y.remote-agent.svc.cluster.local'] } : {}),
  poweredByHeader: false,
  /* config options here */
  async headers() {
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' blob: data:`,
      `font-src 'self' data:`,
      `connect-src 'self' http://localhost:3001 ws://localhost:3001`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp }
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
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*',
      },
    ]
  }
};

export default nextConfig;
