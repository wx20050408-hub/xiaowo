/* Serenade Service Worker：同源资源网络优先、断网走缓存；API 请求不拦截 */
const CACHE = 'xiaowo-v67';
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

/* 后台保活：心跳让 SW 偶尔醒着（配合主线程消息）。只是尽量延缓休眠，浏览器仍可能回收 */
setInterval(() => { /* heartbeat：什么都不做，仅保持线程活跃 */ }, 30000);
self.addEventListener('message', e => { /* 收到主线程消息本身就会重置 SW 休眠倒计时 */ });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* 保活假请求：配合主线程 fetch('./__xw_keepalive')，直接回 200、不走网络 */
  if (url.pathname.includes('/__xw_keepalive')) { e.respondWith(new Response('ok')); return; }
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

/* 点系统通知 → 聚焦已开的Serenade（并切到对应聊天）；没开就打开 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const chatId = e.notification.data && e.notification.data.chatId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      for (const c of cls) {
        if (c.url.includes('xiaowo.html') && 'focus' in c) {
          if (chatId) c.postMessage({ type: 'openChat', chatId });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./xiaowo.html' + (chatId ? '#chat=' + chatId : ''));
    })
  );
});
