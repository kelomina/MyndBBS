/**
 * PWA Service Worker：经 /api/pwa/sw 提供以绕过边缘 WAF 对 sw.js 的拦截。
 * 极简透传实现——仅满足浏览器可安装判定，不做任何离线缓存。
 */
export async function GET(): Promise<Response> {
  const body = `/*
 * MyndBBS minimal service worker: passthrough only (installability).
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // passthrough
});
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
}
