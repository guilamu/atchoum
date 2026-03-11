const CACHE_NAME = 'atchoum-v1';
const STATIC_CACHE = 'atchoum-static-v1';
const DYNAMIC_CACHE = 'atchoum-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip API calls - always fetch from network
    if (url.pathname.startsWith('/api')) {
        return;
    }

    // For static assets, use cache first
    if (request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'image' ||
        request.destination === 'font') {
        event.respondWith(cacheFirst(request));
        return;
    }

    // For HTML pages, use network first
    event.respondWith(networkFirst(request));
});

// Cache first strategy (for static assets)
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return offline fallback if available
        return new Response('Offline', { status: 503 });
    }
}

// Network first strategy (for HTML pages)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Return cached index.html for SPA navigation
        return caches.match('/index.html');
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'Atchoum!',
        body: 'Nouvelle alerte pollen',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            dateOfArrival: Date.now(),
        },
        actions: [
            {
                action: 'open',
                title: 'Voir détails',
            },
            {
                action: 'dismiss',
                title: 'Ignorer',
            },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // Open new window
                return clients.openWindow(urlToOpen);
            })
    );
});

// Background sync (for offline alert creation)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-alerts') {
        event.waitUntil(syncAlerts());
    }
});

async function syncAlerts() {
    // Get pending alerts from IndexedDB and sync with server
    console.log('[SW] Syncing alerts...');
    // This would be implemented with IndexedDB for offline-first
}
