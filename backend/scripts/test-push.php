#!/usr/bin/env php
<?php
/**
 * Test Push Notifications
 * 
 * Usage: php test-push.php <user_email>
 * 
 * This sends a test push notification to the specified user.
 */

// Load Composer autoload (for web-push library)
require_once dirname(__DIR__) . '/vendor/autoload.php';

// Autoload project classes
spl_autoload_register(function ($class) {
    $file = dirname(__DIR__) . '/src/' . $class . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Load config
require_once dirname(__DIR__) . '/config/database.php';

echo "=== Atchoum! Push Notification Test ===\n\n";

// Get user email from command line
$email = $argv[1] ?? null;

if (!$email) {
    echo "Usage: php test-push.php <user_email>\n";
    echo "Example: php test-push.php user@example.com\n\n";
    exit(1);
}

try {
    $db = Database::getInstance();

    // Find user
    $stmt = $db->prepare('SELECT id, email FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        echo "❌ User not found: $email\n";
        exit(1);
    }

    echo "✅ User found: {$user['email']} (ID: {$user['id']})\n\n";

    // Check push subscriptions
    $subscriptions = Notifications::getSubscriptions($user['id']);

    if (empty($subscriptions)) {
        echo "⚠️  No push subscriptions found for this user.\n";
        echo "   The user needs to enable notifications in the app first.\n\n";
        echo "To enable notifications:\n";
        echo "1. Open https://yourdomain.com in browser\n";
        echo "2. Login with $email\n";
        echo "3. Go to Settings > Enable notifications\n";
        exit(0);
    }

    echo "📱 Found " . count($subscriptions) . " push subscription(s)\n\n";

    // Check VAPID config
    $vapidPublic = Database::getConfig('vapid_public_key');
    $vapidPrivate = Database::getConfig('vapid_private_key');

    if (empty($vapidPublic) || empty($vapidPrivate)) {
        echo "❌ VAPID keys not configured!\n";
        echo "   Run: php scripts/generate-vapid-keys.php\n";
        echo "   Then add keys to config/database.php\n";
        exit(1);
    }

    echo "✅ VAPID keys configured\n\n";

    // Send test notification
    echo "📤 Sending test notification...\n\n";

    $payload = [
        'title' => '🤧 Test Atchoum!',
        'body' => 'Ceci est une notification de test. Si vous voyez ceci, les push fonctionnent !',
        'icon' => '/icons/icon-192.png',
        'badge' => '/icons/icon-72.png',
        'url' => 'https://yourdomain.com',
        'timestamp' => time(),
    ];

    $sent = Notifications::sendPushNotification($user['id'], $payload);

    if ($sent > 0) {
        echo "✅ Push notification sent successfully!\n";
        echo "   Sent to $sent device(s)\n\n";
        echo "Check your browser/device for the notification.\n";
    } else {
        echo "❌ Failed to send push notification.\n";
        echo "   Check error logs: /var/log/apache2/error.log\n";
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
