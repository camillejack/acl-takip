// Service Worker - ACL Depo Yönetim Sistemi
const CACHE = 'acl-takip-v103';

// install: kritik olmayan cache hatası SW'yi çökertmesin
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // addAll hata verirse tek tek ekle, biri patlasa diğeri eklensin
      return Promise.allSettled([
        c.add('/'),
        c.add('/index.html')
      ]);
    }).catch(function(){ /* cache hatası install'ı engellemesin */ })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;

  // GET olmayan istekleri dokunma
  if(req.method !== 'GET'){ return; }

  // Firebase / Google / dış kaynaklar — dokunma, direkt network
  var url = req.url;
  if(url.indexOf('firebase') !== -1 || url.indexOf('googleapis') !== -1 ||
     url.indexOf('gstatic') !== -1 || url.indexOf('firestore') !== -1 ||
     url.indexOf('anthropic') !== -1 || url.indexOf('workers.dev') !== -1){
    return; // tarayıcı kendi hallini görsün
  }

  // HTML / navigasyon — her zaman network (en güncel sürüm), offline'da cache
  if(req.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')){
    e.respondWith(
      fetch(req, {cache:'no-store'}).then(function(res){
        // güncel HTML'i cache'e yaz (offline için)
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put('/index.html', clone); });
        return res;
      }).catch(function(){
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Diğer GET kaynaklar — cache-first
  e.respondWith(
    caches.match(req).then(function(cached){
      return cached || fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, clone); });
        }
        return res;
      }).catch(function(){ return caches.match('/index.html'); });
    })
  );
});

self.addEventListener('message', function(e) {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── FCM MESSAGING SW (hata SW'yi çökertmesin) ────────────────
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyDdedlkOrBhYRCcXjXDoSRCilDR-2vwHug",
    authDomain: "acl-takip.firebaseapp.com",
    projectId: "acl-takip",
    storageBucket: "acl-takip.firebasestorage.app",
    messagingSenderId: "1085007217462",
    appId: "1:1085007217462:web:c2d97b91c51462b392a997"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    var title   = (payload.notification && payload.notification.title) || 'ACL Depo — Yeni Duyuru';
    var body    = (payload.notification && payload.notification.body)  || 'Yeni bir duyurunuz var';
    var options = {
      body: body,
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmMGI0MjkiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlODc5ZjkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTAiIGZpbGw9IiMwZDBkMWEiLz4KPHJlY3QgeD0iNTYiIHk9IjU2IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgcng9IjgwIiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIwLjE1Ii8+Cjx0ZXh0IHg9IjI1NiIgeT0iMzEwIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNzAiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFDTDwvdGV4dD4KPHJlY3QgeD0iMTU2IiB5PSIzNTAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTYiIHJ4PSI4IiBmaWxsPSIjZjBiNDI5Ii8+Cjwvc3ZnPg==',
      badge: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmMGI0MjkiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlODc5ZjkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTAiIGZpbGw9IiMwZDBkMWEiLz4KPHJlY3QgeD0iNTYiIHk9IjU2IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgcng9IjgwIiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIwLjE1Ii8+Cjx0ZXh0IHg9IjI1NiIgeT0iMzEwIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNzAiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFDTDwvdGV4dD4KPHJlY3QgeD0iMTU2IiB5PSIzNTAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTYiIHJ4PSI4IiBmaWxsPSIjZjBiNDI5Ii8+Cjwvc3ZnPg==',
      tag: 'acl-duyuru-' + Date.now(),
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data: { url: '/' }
    };
    self.registration.showNotification(title, options);
  });
} catch(fcmErr) {
  // Firebase yüklenemese bile SW çalışmaya devam etsin
  console.warn('FCM SW init hatası (SW yine çalışır):', fcmErr);
}

// ── PWA PUSH (fallback) ──────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {title:'ACL', body: e.data ? e.data.text() : 'Yeni bildirim'}; }
  var title = data.title || 'ACL Depo Yönetim';
  var options = {
    body: data.body || 'Yeni bir bildiriminiz var',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmMGI0MjkiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlODc5ZjkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTAiIGZpbGw9IiMwZDBkMWEiLz4KPHJlY3QgeD0iNTYiIHk9IjU2IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgcng9IjgwIiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIwLjE1Ii8+Cjx0ZXh0IHg9IjI1NiIgeT0iMzEwIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNzAiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFDTDwvdGV4dD4KPHJlY3QgeD0iMTU2IiB5PSIzNTAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTYiIHJ4PSI4IiBmaWxsPSIjZjBiNDI5Ii8+Cjwvc3ZnPg==',
    badge: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmMGI0MjkiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlODc5ZjkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTAiIGZpbGw9IiMwZDBkMWEiLz4KPHJlY3QgeD0iNTYiIHk9IjU2IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgcng9IjgwIiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIwLjE1Ii8+Cjx0ZXh0IHg9IjI1NiIgeT0iMzEwIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNzAiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFDTDwvdGV4dD4KPHJlY3QgeD0iMTU2IiB5PSIzNTAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTYiIHJ4PSI4IiBmaWxsPSIjZjBiNDI5Ii8+Cjwvc3ZnPg==',
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
  var isAcil = e.notification.data && e.notification.data.oncelik === 'acil';
  e.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      for(var i = 0; i < clientList.length; i++){
        var c = clientList[i];
        if('focus' in c){
          c.focus();
          if(isAcil){ c.postMessage({ type: 'ACL_GOTO', screen: 'duyuru' }); }
          return;
        }
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
