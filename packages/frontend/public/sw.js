/*
 * MyndBBS 极简 Service Worker：
 * 仅提供 PWA 安装能力所需的 fetch 处理器，不做任何离线缓存声明——
 * 所有请求按原样放行（network passthrough），避免动态内容陈旧问题。
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', () => {
  // 透传：不拦截、不缓存
  return;
});
