<?php

/**
 * Web Push Handler using minishlink/web-push library
 */

use Minishlink\WebPush\WebPush as WebPushLib;
use Minishlink\WebPush\Subscription;

class WebPush
{
    private string $publicKey;
    private string $privateKey;
    private string $subject;

    public function __construct(string $publicKey, string $privateKey, string $subject = 'mailto:admin@yourdomain.com')
    {
        $this->publicKey = $publicKey;
        $this->privateKey = $privateKey;
        $this->subject = $subject;
    }

    /**
     * Send push notification to a subscription
     */
    public function send(array $subscriptionData, array $payload): bool
    {
        $endpoint = $subscriptionData['endpoint'];
        $p256dh = $subscriptionData['p256dh_key'] ?? $subscriptionData['keys']['p256dh'] ?? '';
        $auth = $subscriptionData['auth_key'] ?? $subscriptionData['keys']['auth'] ?? '';

        if (empty($endpoint) || empty($p256dh) || empty($auth)) {
            error_log("WebPush: Missing subscription data");
            return false;
        }

        try {
            // Create subscription object
            $subscription = Subscription::create([
                'endpoint' => $endpoint,
                'keys' => [
                    'p256dh' => $p256dh,
                    'auth' => $auth,
                ],
            ]);

            // Configure VAPID auth
            $auth = [
                'VAPID' => [
                    'subject' => $this->subject,
                    'publicKey' => $this->publicKey,
                    'privateKey' => $this->privateKey,
                ],
            ];

            $webPush = new WebPushLib($auth);

            // Send notification
            $report = $webPush->sendOneNotification(
                $subscription,
                json_encode($payload)
            );

            if ($report->isSuccess()) {
                return true;
            }

            error_log("WebPush failed: " . $report->getReason());
            return false;
        } catch (Exception $e) {
            error_log("WebPush exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate VAPID keys
     */
    public static function generateVapidKeys(): array
    {
        $keys = \Minishlink\WebPush\VAPID::createVapidKeys();

        return [
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey'],
        ];
    }
}
