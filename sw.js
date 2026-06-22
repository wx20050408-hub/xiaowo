/* 小窝 Service Worker：同源资源网络优先、断网走缓存；API 请求不拦截 */
const CACHE = 'xiaowo-v15';
const ASSETS = ['./xiaowo.html', './manifest.json', './icon.svg', './app-icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // Anthropic/中转站请求直连
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })   // 强制向服务器校验，别吃浏览器 HTTP 旧缓存
      .then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(r => r || caches.match('./xiaowo.html'))
      )
  );
});
