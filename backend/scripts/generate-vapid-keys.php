#!/usr/bin/env php
<?php
/**
 * Generate VAPID keys for Web Push notifications
 * Requires: composer require minishlink/web-push
 * 
 * Usage: php generate-vapid-keys.php
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use Minishlink\WebPush\VAPID;

echo "=== VAPID Key Generator ===\n\n";

$keys = VAPID::createVapidKeys();

echo "Public Key:\n";
echo $keys['publicKey'] . "\n\n";

echo "Private Key:\n";
echo $keys['privateKey'] . "\n\n";

echo "=== Add to config/database.php ===\n";
echo "'vapid_public_key' => '" . $keys['publicKey'] . "',\n";
echo "'vapid_private_key' => '" . $keys['privateKey'] . "',\n";
echo "'vapid_subject' => 'mailto:admin@yourdomain.com',\n";
