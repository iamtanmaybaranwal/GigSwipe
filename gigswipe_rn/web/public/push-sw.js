/* GigSwipe push notifications — loaded into the service worker (importScripts). */
/* eslint-disable no-restricted-globals */

self.addEventListener('push', function (event) {
  var msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { title: 'GigSwipe', body: event.data ? event.data.text() : '' }; }
  var title = msg.title || 'GigSwipe';
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: msg.tag || undefined,
    renotify: !!msg.tag,
    data: msg.data || {},
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var gigId = (event.notification.data || {}).gigId;
  var target = gigId ? '/?gig=' + encodeURIComponent(gigId) : '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        if (gigId) c.postMessage({ type: 'open-gig', gigId: gigId });
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
