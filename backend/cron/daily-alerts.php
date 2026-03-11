#!/usr/bin/env php
<?php
/**
 * Atchoum! - Daily Pollen Alert CRON Job
 * 
 * This script should be run daily (e.g., 8:00 AM) via cron:
 * 0 8 * * * /usr/bin/php /var/www/atchoum/cron/daily-alerts.php
 * 
 * It checks all active alerts and sends notifications when pollen levels exceed thresholds.
 */

// Set timezone
date_default_timezone_set('Europe/Paris');

// Load configuration
$configPath = dirname(__DIR__) . '/config/database.php';
if (!file_exists($configPath)) {
    die("Error: Configuration file not found at $configPath\n");
}

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

echo "=== Atchoum! Daily Alert Job ===\n";
echo "Started at: " . date('Y-m-d H:i:s') . "\n\n";

try {
    $db = Database::getInstance();

    // Get all active alerts with user info
    $stmt = $db->query("
        SELECT 
            a.id as alert_id,
            a.user_id,
            a.city_id,
            a.pollen_type,
            a.threshold_level,
            a.notify_email,
            a.notify_push,
            c.insee_code,
            c.city_name,
            u.email
        FROM alerts a
        JOIN cities c ON a.city_id = c.id
        JOIN users u ON a.user_id = u.id
        WHERE a.is_active = 1
        ORDER BY u.id, c.id
    ");

    $alerts = $stmt->fetchAll();
    echo "Found " . count($alerts) . " active alerts\n\n";

    if (empty($alerts)) {
        echo "No alerts to process. Exiting.\n";
        exit(0);
    }

    // Group alerts by city to minimize API calls
    $citiesPollenData = [];
    $notificationsSent = 0;
    $errors = 0;

    foreach ($alerts as $alert) {
        $inseeCode = $alert['insee_code'];

        // Fetch pollen data for city if not cached
        if (!isset($citiesPollenData[$inseeCode])) {
            echo "Fetching pollen data for {$alert['city_name']} ({$inseeCode})...\n";
            $pollenData = fetchPollenData($inseeCode);
            $citiesPollenData[$inseeCode] = $pollenData;

            if ($pollenData) {
                echo "  Global level: {$pollenData['globalLevel']}\n";
            } else {
                echo "  WARNING: No data available\n";
            }
        }

        $pollenData = $citiesPollenData[$inseeCode];

        if (!$pollenData) {
            continue;
        }

        // Check if alert should trigger
        $shouldNotify = false;
        $triggerLevel = 0;
        $triggerPollen = '';

        if ($alert['pollen_type'] === 'global') {
            // Global alert: check overall level
            if ($pollenData['globalLevel'] >= $alert['threshold_level']) {
                $shouldNotify = true;
                $triggerLevel = $pollenData['globalLevel'];
                $triggerPollen = 'global';
            }
        } else {
            // Specific pollen alert
            foreach ($pollenData['pollens'] as $pollen) {
                if ($pollen['code'] === $alert['pollen_type'] && $pollen['level'] >= $alert['threshold_level']) {
                    $shouldNotify = true;
                    $triggerLevel = $pollen['level'];
                    $triggerPollen = $pollen['name'];
                    break;
                }
            }
        }

        if ($shouldNotify) {
            echo "  ALERT TRIGGERED for {$alert['email']}: ";
            echo "{$alert['city_name']} - {$triggerPollen} level {$triggerLevel}\n";

            // Send notification
            if (sendAlertNotification($alert, $pollenData, $triggerPollen, $triggerLevel)) {
                $notificationsSent++;
                logNotification($db, $alert['alert_id'], $alert['user_id'], $triggerLevel);
            } else {
                $errors++;
            }
        }
    }

    echo "\n=== Summary ===\n";
    echo "Notifications sent: $notificationsSent\n";
    echo "Errors: $errors\n";
    echo "Completed at: " . date('Y-m-d H:i:s') . "\n";
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

/**
 * Fetch pollen data from Atmo API
 */
function fetchPollenData(string $inseeCode): ?array
{
    $config = require dirname(__DIR__) . '/config/config.php';

    // Get API token
    $token = getAtmoToken($config);
    if (!$token) {
        return null;
    }

    $date = date('Y-m-d');
    $url = "https://admindata.atmo-france.org/api/v2/data/indices/pollens" .
        "?code_zone={$inseeCode}&date={$date}";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return null;
    }

    $data = json_decode($response, true);

    // Parse GeoJSON response
    if (isset($data['features'][0]['properties'])) {
        $props = $data['features'][0]['properties'];

        return [
            'globalLevel' => $props['code_qual'] ?? 0,
            'globalLabel' => $props['lib_qual'] ?? 'Indisponible',
            'source' => $props['source'] ?? 'Atmo Data',
            'pollens' => [
                ['name' => 'Aulne', 'code' => 'aul', 'level' => $props['code_aul'] ?? 0],
                ['name' => 'Bouleau', 'code' => 'boul', 'level' => $props['code_boul'] ?? 0],
                ['name' => 'Olivier', 'code' => 'oliv', 'level' => $props['code_oliv'] ?? 0],
                ['name' => 'Graminées', 'code' => 'gram', 'level' => $props['code_gram'] ?? 0],
                ['name' => 'Armoise', 'code' => 'arm', 'level' => $props['code_arm'] ?? 0],
                ['name' => 'Ambroisie', 'code' => 'ambr', 'level' => $props['code_ambr'] ?? 0],
            ],
        ];
    }

    return null;
}

/**
 * Get Atmo API token
 */
function getAtmoToken(array $config): ?string
{
    $cacheFile = dirname(__DIR__) . '/cache/atmo_token.json';

    // Check cached token
    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if ($cached && $cached['expires'] > time()) {
            return $cached['token'];
        }
    }

    // Request new token
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://admindata.atmo-france.org/api/login',
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'username' => $config['atmo_username'],
            'password' => $config['atmo_password'],
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);

    if (isset($data['token'])) {
        // Cache token (expires in 1 hour, cache for 55 minutes)
        $cacheData = [
            'token' => $data['token'],
            'expires' => time() + 3300,
        ];

        $cacheDir = dirname($cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        file_put_contents($cacheFile, json_encode($cacheData));

        return $data['token'];
    }

    return null;
}

/**
 * Send alert notification via email
 */
function sendAlertNotification(array $alert, array $pollenData, string $triggerPollen, int $triggerLevel): bool
{
    $levelLabels = [
        1 => 'Très faible',
        2 => 'Faible',
        3 => 'Modéré',
        4 => 'Élevé',
        5 => 'Très élevé',
        6 => 'Extrêmement élevé',
    ];

    $levelColors = [
        1 => '#50F0E6',
        2 => '#50CCAA',
        3 => '#F0E641',
        4 => '#FF5050',
        5 => '#960032',
        6 => '#872181',
    ];

    $levelLabel = $levelLabels[$triggerLevel] ?? 'Inconnu';
    $levelColor = $levelColors[$triggerLevel] ?? '#666666';

    $subject = "🤧 Atchoum! Alerte pollen - {$alert['city_name']}";

    $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #fdbb2d 0%, #b21f1f 100%); padding: 30px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 25px; }
        .alert-box { background: ${levelColor}20; border-left: 4px solid ${levelColor}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .level-badge { display: inline-block; background: ${levelColor}; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .pollen-list { margin: 20px 0; }
        .pollen-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .footer { padding: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #fdbb2d, #b21f1f); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤧 Atchoum!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Alerte pollen</p>
        </div>
        
        <div class="content">
            <h2 style="margin-top: 0;">📍 {$alert['city_name']}</h2>
            
            <div class="alert-box">
                <strong>Niveau de pollen {$triggerPollen}</strong><br>
                <span class="level-badge">{$levelLabel} ({$triggerLevel}/6)</span>
            </div>
            
            <p>Les niveaux de pollen ont atteint votre seuil d'alerte.</p>
            
            <div class="pollen-list">
                <h3>Détail des pollens</h3>
HTML;

    foreach ($pollenData['pollens'] as $pollen) {
        $pLevel = $pollen['level'];
        $pLabel = $levelLabels[$pLevel] ?? 'N/D';
        $html .= "<div class='pollen-item'><span>{$pollen['name']}</span><span>{$pLabel} ({$pLevel}/6)</span></div>";
    }

    $html .= <<<HTML
            </div>
            
            <div style="text-align: center;">
                <a href="https://yourdomain.com" class="btn">Voir les détails</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Source: {$pollenData['source']}</p>
            <p>Vous recevez cet email car vous avez configuré une alerte pollen.<br>
            <a href="https://yourdomain.com/settings">Gérer mes alertes</a></p>
        </div>
    </div>
</body>
</html>
HTML;

    // Build push notification payload
    $pushPayload = [
        'title' => "🤧 Alerte pollen - {$alert['city_name']}",
        'body' => "Niveau $triggerPollen: $levelLabel ($triggerLevel/6)",
        'icon' => '/icons/icon-192.png',
        'badge' => '/icons/icon-72.png',
        'url' => 'https://yourdomain.com',
        'data' => [
            'city' => $alert['city_name'],
            'pollen' => $triggerPollen,
            'level' => $triggerLevel,
        ],
    ];

    // Send notifications based on user preferences
    $sendEmail = !empty($alert['notify_email']);
    $sendPush = !empty($alert['notify_push']);

    $result = Notifications::sendNotification(
        $alert['user_id'],
        $sendEmail ? $alert['email'] : null,
        $sendPush ? $pushPayload : null,
        $subject,
        $html
    );

    $emailStatus = $sendEmail ? ($result['email_sent'] ? 'yes' : 'failed') : 'skip';
    $pushStatus = $sendPush ? "{$result['push_sent']}" : 'skip';
    echo "    Push: {$pushStatus}, Email: {$emailStatus}\n";

    return ($sendEmail && $result['email_sent']) || ($sendPush && $result['push_sent'] > 0) || (!$sendEmail && !$sendPush);
}

/**
 * Log notification in database
 */
function logNotification(PDO $db, int $alertId, string $userId, int $level): void
{
    try {
        $stmt = $db->prepare(
            'INSERT INTO notification_logs (alert_id, user_id, trigger_level, sent_at) VALUES (?, ?, ?, NOW())'
        );
        $stmt->execute([$alertId, $userId, $level]);
    } catch (Exception $e) {
        // Table might not exist, ignore
        error_log("Could not log notification: " . $e->getMessage());
    }
}
