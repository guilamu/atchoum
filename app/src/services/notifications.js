/**
 * Notification Service
 * Handles push notifications and permission management
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Check if notifications are supported
 */
export function isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission() {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }
    return Notification.permission; // 'default', 'granted', 'denied'
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
    if (!isNotificationSupported()) {
        return { success: false, error: 'Notifications non supportées' };
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            return { success: true, permission };
        } else if (permission === 'denied') {
            return { success: false, error: 'Permission refusée' };
        } else {
            return { success: false, error: 'Permission non accordée' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush() {
    if (!isNotificationSupported()) {
        throw new Error('Push notifications non supportées');
    }

    const permission = await requestNotificationPermission();
    if (!permission.success) {
        throw new Error(permission.error);
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription && VAPID_PUBLIC_KEY) {
            // Create new subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        // Register subscription with backend
        if (subscription) {
            await registerSubscriptionWithBackend(subscription);
        }

        return subscription;
    } catch (error) {
        console.error('Push subscription failed:', error);
        throw error;
    }
}

/**
 * Register subscription with backend API
 */
async function registerSubscriptionWithBackend(subscription) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const token = localStorage.getItem('atchoum_token');

    if (!token) {
        console.warn('Not authenticated, skipping backend subscription');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(subscription.toJSON()),
        });

        if (!response.ok) {
            throw new Error('Failed to register subscription');
        }

        console.log('Push subscription registered with backend');
    } catch (error) {
        console.error('Backend subscription error:', error);
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Push unsubscription failed:', error);
        return false;
    }
}

/**
 * Check if user is subscribed to push
 */
export async function isPushSubscribed() {
    if (!isNotificationSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}

/**
 * Show a local notification (for testing)
 */
export function showLocalNotification(title, options = {}) {
    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
    }

    const defaultOptions = {
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        requireInteraction: false,
    };

    new Notification(title, { ...defaultOptions, ...options });
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    isPushSubscribed,
    showLocalNotification,
};
