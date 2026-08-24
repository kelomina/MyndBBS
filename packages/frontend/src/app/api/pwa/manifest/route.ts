import { NextResponse } from 'next/server';

/**
 * PWA manifest：经 /api/pwa/manifest 提供以绕过边缘 WAF 对
 * .webmanifest 扩展名的拦截。内容为标准 Web App Manifest。
 */
export function GET(): NextResponse {
  const manifest = {
    name: 'MyndBBS - Modern Community',
    short_name: 'MyndBBS',
    description: 'A clean, fast, and secure community platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
