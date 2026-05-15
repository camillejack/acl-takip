// Service Worker - ACL Depo Yönetim Sistemi
const CACHE = 'acl-takip-v14';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() { return caches.match('/index.html'); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      });
    }).catch(function() { return caches.match('/index.html'); })
  );
});

self.addEventListener('message', function(e) {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── PWA PUSH BİLDİRİM ────────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {title:'ACL', body: e.data ? e.data.text() : 'Yeni bildirim'}; }
  
  var title = data.title || 'ACL Depo Yönetim';
  var options = {
    body: data.body || 'Yeni bir bildiriminiz var',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'acl-bildirim',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };
  
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/';
  e.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      for(var i=0; i<clientList.length; i++) {
        if(clientList[i].url === url && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
