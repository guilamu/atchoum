<?php

/**
 * Notifications Handler
 * Handles push subscriptions and sending notifications
 */

class Notifications
{
    /**
     * Subscribe to push notifications
     */
    public static function subscribe(string $userId, array $subscription): array
    {
        $db = Database::getInstance();

        $endpoint = $subscription['endpoint'] ?? '';
        $p256dh = $subscription['keys']['p256dh'] ?? '';
        $auth = $subscription['keys']['auth'] ?? '';

        if (empty($endpoint)) {
            return ['success' => false, 'error' => 'Missing endpoint'];
        }

        // Check if subscription already exists
        $stmt = $db->prepare(
            'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
        );
        $stmt->execute([$userId, $endpoint]);
        $existing = $stmt->fetch();

        if ($existing) {
            // Update existing subscription
            $stmt = $db->prepare(
                'UPDATE push_subscriptions SET p256dh_key = ?, auth_key = ?, updated_at = NOW() WHERE id = ?'
            );
            $stmt->execute([$p256dh, $auth, $existing['id']]);

            return ['success' => true, 'message' => 'Subscription updated'];
        }

        // Create new subscription
        $stmt = $db->prepare(
            'INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $endpoint, $p256dh, $auth]);

        return ['success' => true, 'message' => 'Subscribed to notifications'];
    }

    /**
     * Unsubscribe from push notifications
     */
    public static function unsubscribe(string $userId, string $endpoint): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?');
        $stmt->execute([$userId, $endpoint]);

        return ['success' => true, 'message' => 'Unsubscribed from notifications'];
    }

    /**
     * Get all subscriptions for a user
     */
    public static function getSubscriptions(string $userId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM push_subscriptions WHERE user_id = ?');
        $stmt->execute([$userId]);

        return $stmt->fetchAll();
    }

    /**
     * Send push notification to a user
     */
    public static function sendPushNotification(string $userId, array $payload): int
    {
        $subscriptions = self::getSubscriptions($userId);

        if (empty($subscriptions)) {
            return 0;
        }

        // Get VAPID keys from config or database
        $vapidPublicKey = Database::getConfig('vapid_public_key');
        $vapidPrivateKey = Database::getConfig('vapid_private_key');
        $vapidSubject = Database::getConfig('vapid_subject', 'mailto:admin@yourdomain.com');

        if (empty($vapidPublicKey) || empty($vapidPrivateKey)) {
            error_log('VAPID keys not configured');
            return 0;
        }

        $webPush = new WebPush($vapidPublicKey, $vapidPrivateKey, $vapidSubject);

        $sent = 0;
        foreach ($subscriptions as $subscription) {
            try {
                if ($webPush->send($subscription, $payload)) {
                    $sent++;
                }
            } catch (Exception $e) {
                error_log("Push notification error: " . $e->getMessage());
            }
        }

        return $sent;
    }

    /**
     * Send notification via email as fallback
     */
    public static function sendEmailNotification(string $email, string $subject, string $body): bool
    {
        return Mailer::sendRaw($email, $subject, $body);
    }

    /**
     * Send both push and email notifications
     */
    public static function sendNotification(string $userId, string $email, array $pushPayload, string $emailSubject, string $emailBody): array
    {
        $results = [
            'push_sent' => 0,
            'email_sent' => false,
        ];

        // Try push notification first
        $results['push_sent'] = self::sendPushNotification($userId, $pushPayload);

        // Always send email as well (for now)
        $results['email_sent'] = self::sendEmailNotification($email, $emailSubject, $emailBody);

        return $results;
    }
}
