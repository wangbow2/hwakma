// 앱을 꺼 둔 사이에 오는 알림을 받는 일꾼.
// 홈 화면에 추가해 둔 아이들 폰에서 이 파일이 돌면서 알림을 띄운다.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBH-ogVqi9C63GIrllY2aIK76i5dwFBGgQ",
  authDomain: "ladi-manager.firebaseapp.com",
  projectId: "ladi-manager",
  storageBucket: "ladi-manager.firebasestorage.app",
  messagingSenderId: "583728554598",
  appId: "1:583728554598:web:b5127dc45914432eadc3a7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || '확~마! 제자반', {
    body: d.body || '새 댓글이 있어요',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    tag: d.tag || 'hwakma-note',
    renotify: true,
    data: { url: d.url || './' }
  });
});

// 알림을 누르면 앱을 연다. 이미 열려 있으면 그 창을 앞으로 가져온다.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/hwakma') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
