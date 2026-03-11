<?php

/**
 * Atchoum! Backend API - PRODUCTION VERSION v2
 * 
 * Full API with:
 * - Atmo Data proxy (pollen data)
 * - User authentication (passwordless)
 * - User cities management
 * 
 * Deployed to: /var/www/atchoum/public_html/api/index.php
 */

// Enable error reporting but hide from users
error_reporting(E_ALL);
ini_set('display_errors', 0);

// CORS headers - Production: restrict to yourdomain.com
header('Access-Control-Allow-Origin: https://yourdomain.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Autoload source classes
spl_autoload_register(function ($class) {
    // Use dirname(__DIR__, 2) for production: /var/www/atchoum/public_html/api/index.php -> /var/www/atchoum/src/
    $file = dirname(__DIR__, 2) . '/src/' . $class . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Load Atmo API configuration
$atmoConfig = require dirname(__DIR__, 2) . '/config/config.php';

// Simple router
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Remove /api prefix if present
$path = preg_replace('#^/api#', '', $path);
if (empty($path)) {
    $path = '/';
}

try {
    // ==========================================
    // PUBLIC ROUTES (no auth required)
    // ==========================================

    switch ($path) {
        case '/':
        case '/health':
            echo json_encode([
                'status' => 'ok',
                'service' => 'Atchoum API v2',
                'php' => PHP_VERSION,
                'curl' => function_exists('curl_init'),
                'auth' => 'enabled',
            ]);
            exit;

        case '/auth/request-code':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit;
            }
            $input = getJsonInput();
            $result = Auth::requestCode($input['email'] ?? '');
            if (!$result['success']) {
                http_response_code(400);
            }
            echo json_encode($result);
            exit;

        case '/auth/verify-code':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit;
            }
            $input = getJsonInput();
            $result = Auth::verifyCode($input['email'] ?? '', $input['code'] ?? '');
            if (!$result['success']) {
                http_response_code(401);
            }
            echo json_encode($result);
            exit;

            // Pollen data (public)
        case '/pollen':
            handlePollenRequest($atmoConfig);
            exit;

        case '/pollen/forecast':
            handleForecastRequest($atmoConfig);
            exit;

        case '/pollen/history':
            handlePollenHistoryRequest($atmoConfig);
            exit;

        case '/zones':
            handleZonesRequest($atmoConfig);
            exit;

        case '/zones/search':
            handleZoneSearchRequest($atmoConfig);
            exit;
    }

    // ==========================================
    // PROTECTED ROUTES (auth required)
    // ==========================================

    $user = Auth::getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Non authentifié', 'code' => 'UNAUTHORIZED']);
        exit;
    }

    // Match routes with parameters
    $matches = [];

    switch (true) {
        // Get current user
        case $path === '/auth/me':
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'consent_diagnostic' => (bool)$user['consent_diagnostic'],
                    'created_at' => $user['created_at'],
                ],
            ]);
            break;

        // User's cities
        case $path === '/cities' && $method === 'GET':
            echo json_encode(getUserCities($user['id']));
            break;

        case $path === '/cities' && $method === 'POST':
            $input = getJsonInput();
            $result = addUserCity($user['id'], $input);
            echo json_encode($result);
            break;

        case preg_match('#^/cities/(\d+)$#', $path, $matches) && $method === 'DELETE':
            $result = deleteUserCity($user['id'], (int)$matches[1]);
            echo json_encode($result);
            break;

        case preg_match('#^/cities/(\d+)/main$#', $path, $matches) && $method === 'PUT':
            $result = setMainCity($user['id'], (int)$matches[1]);
            echo json_encode($result);
            break;

        // User's alerts
        case $path === '/alerts' && $method === 'GET':
            echo json_encode(getUserAlerts($user['id']));
            break;

        case $path === '/alerts' && $method === 'POST':
            $input = getJsonInput();
            $result = addUserAlert($user['id'], $input);
            echo json_encode($result);
            break;

        case preg_match('#^/alerts/(\d+)$#', $path, $matches) && $method === 'PUT':
            $input = getJsonInput();
            $result = updateUserAlert($user['id'], (int)$matches[1], $input);
            echo json_encode($result);
            break;

        case preg_match('#^/alerts/(\d+)$#', $path, $matches) && $method === 'DELETE':
            $result = deleteUserAlert($user['id'], (int)$matches[1]);
            echo json_encode($result);
            break;

        // Push notifications
        case $path === '/push/subscribe' && $method === 'POST':
            $input = getJsonInput();
            $result = Notifications::subscribe($user['id'], $input);
            echo json_encode($result);
            break;

        case $path === '/push/unsubscribe' && $method === 'POST':
            $input = getJsonInput();
            $result = Notifications::unsubscribe($user['id'], $input['endpoint'] ?? '');
            echo json_encode($result);
            break;

        // ==========================================
        // HEALTH LOG: Symptoms & Medications
        // ==========================================

        // Get symptoms catalog
        case $path === '/symptoms' && $method === 'GET':
            echo json_encode(HealthLog::getSymptoms());
            break;

        // Get medications catalog
        case $path === '/medications' && $method === 'GET':
            echo json_encode(HealthLog::getMedications());
            break;

        // Daily entries
        case $path === '/daily-entries' && $method === 'GET':
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            echo json_encode(HealthLog::getDailyEntries($user['id'], $startDate, $endDate));
            break;

        case $path === '/daily-entries' && $method === 'POST':
            $input = getJsonInput();
            echo json_encode(HealthLog::saveDailyEntry($user['id'], $input));
            break;

        case preg_match('#^/daily-entries/(\d{4}-\d{2}-\d{2})$#', $path, $matches) && $method === 'GET':
            $result = HealthLog::getOrCreateDailyEntry($user['id'], $matches[1]);
            echo json_encode($result);
            break;

        // Medication intakes
        case $path === '/medication-intakes' && $method === 'GET':
            $date = $_GET['date'] ?? null;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            echo json_encode(HealthLog::getMedicationIntakes($user['id'], $date, $startDate, $endDate));
            break;

        case $path === '/medication-intakes' && $method === 'POST':
            $input = getJsonInput();
            echo json_encode(HealthLog::addMedicationIntake($user['id'], $input));
            break;

        case preg_match('#^/medication-intakes/(\d+)$#', $path, $matches) && $method === 'DELETE':
            echo json_encode(HealthLog::deleteMedicationIntake($user['id'], (int)$matches[1]));
            break;

        // Health summary (for charts)
        case $path === '/health-summary' && $method === 'GET':
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            echo json_encode(HealthLog::getHealthSummary($user['id'], $startDate, $endDate));
            break;

        // ==========================================
        // DIAGNOSTIC MODE (Phase 3)
        // ==========================================

        case $path === '/diagnostic/status' && $method === 'GET':
            echo json_encode(Diagnostic::getStatus($user['id']));
            break;

        case $path === '/diagnostic/consent' && $method === 'POST':
            $input = getJsonInput();
            $activate = $input['activate'] ?? true;
            if ($activate) {
                echo json_encode(Diagnostic::activateConsent($user['id']));
            } else {
                echo json_encode(Diagnostic::deactivateConsent($user['id']));
            }
            break;

        case $path === '/diagnostic/analyze' && $method === 'POST':
            echo json_encode(Diagnostic::analyze($user['id']));
            break;

        case $path === '/diagnostic/results' && $method === 'GET':
            echo json_encode(Diagnostic::getResults($user['id']));
            break;

        case preg_match('#^/diagnostic/results/(\d+)$#', $path, $matches) && $method === 'GET':
            echo json_encode(Diagnostic::getResult($user['id'], (int)$matches[1]));
            break;

        case $path === '/diagnostic/timeline' && $method === 'GET':
            $days = (int)($_GET['days'] ?? 30);
            echo json_encode(Diagnostic::getTimeline($user['id'], $days));
            break;

        case $path === '/diagnostic/data' && $method === 'DELETE':
            echo json_encode(Diagnostic::deleteAllData($user['id']));
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Not found', 'path' => $path]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
    error_log("Atchoum API Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ==========================================
// CITIES FUNCTIONS
// ==========================================

function getUserCities(string $userId): array
{
    $db = Database::getInstance();
    $stmt = $db->prepare(
        'SELECT id, insee_code, city_name, is_main, created_at 
         FROM cities WHERE user_id = ? ORDER BY is_main DESC, city_name ASC'
    );
    $stmt->execute([$userId]);

    $cities = $stmt->fetchAll();
    foreach ($cities as &$city) {
        $city['is_main'] = (bool)$city['is_main'];
    }

    return ['success' => true, 'cities' => $cities];
}

function addUserCity(string $userId, array $data): array
{
    if (empty($data['insee_code']) || empty($data['city_name'])) {
        return ['success' => false, 'error' => 'insee_code et city_name requis'];
    }

    $db = Database::getInstance();

    // Check if already exists
    $stmt = $db->prepare('SELECT id FROM cities WHERE user_id = ? AND insee_code = ?');
    $stmt->execute([$userId, $data['insee_code']]);
    if ($stmt->fetch()) {
        return ['success' => false, 'error' => 'Cette ville est déjà enregistrée'];
    }

    // Check city limit (max 5)
    $stmt = $db->prepare('SELECT COUNT(*) as count FROM cities WHERE user_id = ?');
    $stmt->execute([$userId]);
    if ($stmt->fetch()['count'] >= 5) {
        return ['success' => false, 'error' => 'Maximum 5 villes autorisées'];
    }

    // Check if this should be main (first city)
    $stmt = $db->prepare('SELECT COUNT(*) as count FROM cities WHERE user_id = ?');
    $stmt->execute([$userId]);
    $isFirst = $stmt->fetch()['count'] === 0;

    $stmt = $db->prepare(
        'INSERT INTO cities (user_id, insee_code, city_name, is_main) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $data['insee_code'],
        $data['city_name'],
        $isFirst ? 1 : 0,
    ]);

    return [
        'success' => true,
        'city' => [
            'id' => $db->lastInsertId(),
            'insee_code' => $data['insee_code'],
            'city_name' => $data['city_name'],
            'is_main' => $isFirst,
        ],
    ];
}

function deleteUserCity(string $userId, int $cityId): array
{
    $db = Database::getInstance();

    $stmt = $db->prepare('DELETE FROM cities WHERE id = ? AND user_id = ?');
    $stmt->execute([$cityId, $userId]);

    if ($stmt->rowCount() === 0) {
        return ['success' => false, 'error' => 'Ville non trouvée'];
    }

    return ['success' => true];
}

function setMainCity(string $userId, int $cityId): array
{
    $db = Database::getInstance();

    // Verify city belongs to user
    $stmt = $db->prepare('SELECT id FROM cities WHERE id = ? AND user_id = ?');
    $stmt->execute([$cityId, $userId]);
    if (!$stmt->fetch()) {
        return ['success' => false, 'error' => 'Ville non trouvée'];
    }

    // Unset all as main
    $stmt = $db->prepare('UPDATE cities SET is_main = 0 WHERE user_id = ?');
    $stmt->execute([$userId]);

    // Set this one as main
    $stmt = $db->prepare('UPDATE cities SET is_main = 1 WHERE id = ?');
    $stmt->execute([$cityId]);

    return ['success' => true];
}

// ==========================================
// ALERTS FUNCTIONS
// ==========================================

function getUserAlerts(string $userId): array
{
    $db = Database::getInstance();
    $stmt = $db->prepare(
        'SELECT a.id, a.city_id, a.pollen_type, a.threshold_level, a.notify_email, a.notify_push, a.is_active,
                c.city_name, c.insee_code
         FROM alerts a
         JOIN cities c ON a.city_id = c.id
         WHERE a.user_id = ?
         ORDER BY c.city_name, a.pollen_type'
    );
    $stmt->execute([$userId]);

    $alerts = $stmt->fetchAll();
    foreach ($alerts as &$alert) {
        $alert['is_active'] = (bool)$alert['is_active'];
        $alert['notify_email'] = (bool)$alert['notify_email'];
        $alert['notify_push'] = (bool)$alert['notify_push'];
        $alert['threshold_level'] = (int)$alert['threshold_level'];
    }

    return ['success' => true, 'alerts' => $alerts];
}

function addUserAlert(string $userId, array $data): array
{
    if (empty($data['city_id'])) {
        return ['success' => false, 'error' => 'city_id requis'];
    }

    $db = Database::getInstance();

    // Verify city belongs to user
    $stmt = $db->prepare('SELECT id FROM cities WHERE id = ? AND user_id = ?');
    $stmt->execute([$data['city_id'], $userId]);
    if (!$stmt->fetch()) {
        return ['success' => false, 'error' => 'Ville non trouvée'];
    }

    $stmt = $db->prepare(
        'INSERT INTO alerts (user_id, city_id, pollen_type, threshold_level, notify_email, notify_push, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $data['city_id'],
        $data['pollen_type'] ?? 'global',
        $data['threshold_level'] ?? 3,
        $data['notify_email'] ?? true,
        $data['notify_push'] ?? true,
        $data['is_active'] ?? true,
    ]);

    return [
        'success' => true,
        'alert' => ['id' => $db->lastInsertId()],
    ];
}

function updateUserAlert(string $userId, int $alertId, array $data): array
{
    $db = Database::getInstance();

    // Verify alert belongs to user
    $stmt = $db->prepare('SELECT id FROM alerts WHERE id = ? AND user_id = ?');
    $stmt->execute([$alertId, $userId]);
    if (!$stmt->fetch()) {
        return ['success' => false, 'error' => 'Alerte non trouvée'];
    }

    $stmt = $db->prepare(
        'UPDATE alerts SET
            pollen_type = COALESCE(?, pollen_type),
            threshold_level = COALESCE(?, threshold_level),
            notify_email = COALESCE(?, notify_email),
            notify_push = COALESCE(?, notify_push),
            is_active = COALESCE(?, is_active)
         WHERE id = ?'
    );
    $stmt->execute([
        $data['pollen_type'] ?? null,
        $data['threshold_level'] ?? null,
        isset($data['notify_email']) ? ($data['notify_email'] ? 1 : 0) : null,
        isset($data['notify_push']) ? ($data['notify_push'] ? 1 : 0) : null,
        isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : null,
        $alertId,
    ]);

    return ['success' => true];
}

function deleteUserAlert(string $userId, int $alertId): array
{
    $db = Database::getInstance();

    $stmt = $db->prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?');
    $stmt->execute([$alertId, $userId]);

    if ($stmt->rowCount() === 0) {
        return ['success' => false, 'error' => 'Alerte non trouvée'];
    }

    return ['success' => true];
}

// ==========================================
// POLLEN DATA FUNCTIONS (from Atmo API)
// ==========================================

function handlePollenRequest(array $config): void
{
    $inseeCode = $_GET['code_zone'] ?? $_GET['insee'] ?? null;
    $date = $_GET['date'] ?? date('Y-m-d');

    if (!$inseeCode) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing code_zone parameter']);
        return;
    }

    $data = fetchPollenData($config, $inseeCode, $date);

    if ($data === null) {
        echo json_encode(getMockPollenData($inseeCode, $date));
        return;
    }

    echo json_encode($data);
}

function handleForecastRequest(array $config): void
{
    $inseeCode = $_GET['code_zone'] ?? $_GET['insee'] ?? null;

    if (!$inseeCode) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing code_zone parameter']);
        return;
    }

    $forecast = [];
    $today = new DateTime();

    for ($i = 0; $i <= 2; $i++) {
        $date = clone $today;
        $date->modify("+{$i} days");
        $dateStr = $date->format('Y-m-d');

        $data = fetchPollenData($config, $inseeCode, $dateStr);
        if ($data === null) {
            $data = getMockPollenData($inseeCode, $dateStr);
        }

        $data['isToday'] = ($i === 0);
        $data['isTomorrow'] = ($i === 1);
        $forecast[] = $data;
    }

    echo json_encode($forecast);
}

function handlePollenHistoryRequest(array $config): void
{
    $inseeCode = $_GET['code_zone'] ?? $_GET['insee'] ?? null;
    $days = min(30, max(1, (int)($_GET['days'] ?? 14)));

    if (!$inseeCode) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing code_zone parameter']);
        return;
    }

    $history = [];
    $today = new DateTime();

    for ($i = $days - 1; $i >= 0; $i--) {
        $date = clone $today;
        $date->modify("-{$i} days");
        $dateStr = $date->format('Y-m-d');

        $data = fetchPollenData($config, $inseeCode, $dateStr);

        if ($data !== null) {
            $history[] = [
                'date' => $dateStr,
                'globalLevel' => $data['globalLevel'] ?? 0,
                'pollens' => $data['pollens'] ?? [],
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'inseeCode' => $inseeCode,
        'days' => $days,
        'count' => count($history),
        'history' => $history,
    ]);
}

function handleZonesRequest(array $config): void
{
    $token = getAtmoToken($config);

    if (!$token) {
        http_response_code(500);
        echo json_encode(['error' => 'Authentication failed']);
        return;
    }

    $url = 'https://admindata.atmo-france.org/api/v2/data/indices/pollens/zones?format=json';

    $response = httpRequest($url, [
        'method' => 'GET',
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ],
    ]);

    if ($response['status'] !== 200) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch zones']);
        return;
    }

    $data = json_decode($response['body'], true);

    $zones = [];
    if (isset($data['features'])) {
        foreach ($data['features'] as $feature) {
            $props = $feature['properties'] ?? [];
            $zones[] = [
                'code' => $props['code_zone'] ?? '',
                'name' => $props['lib_zone'] ?? '',
                'type' => $props['type_zone'] ?? '',
            ];
        }
    }

    echo json_encode(['count' => count($zones), 'zones' => $zones]);
}

function handleZoneSearchRequest(array $config): void
{
    $query = $_GET['q'] ?? $_GET['query'] ?? '';

    if (strlen($query) < 2) {
        echo json_encode(['zones' => [], 'message' => 'Query too short']);
        return;
    }

    $token = getAtmoToken($config);

    if (!$token) {
        http_response_code(500);
        echo json_encode(['error' => 'Authentication failed']);
        return;
    }

    $url = 'https://admindata.atmo-france.org/api/v2/data/indices/pollens/zones?format=json';

    $response = httpRequest($url, [
        'method' => 'GET',
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ],
    ]);

    if ($response['status'] !== 200) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch zones']);
        return;
    }

    $data = json_decode($response['body'], true);
    $zones = [];
    $queryLower = mb_strtolower($query);

    $allZones = $data['features'] ?? $data ?? [];
    foreach ($allZones as $feature) {
        $props = $feature['properties'] ?? $feature;
        $name = $props['lib_zone'] ?? $props['name'] ?? '';
        $code = $props['code_zone'] ?? $props['code'] ?? '';

        if (stripos($name, $query) !== false || stripos($code, $query) !== false) {
            $zones[] = [
                'code' => $code,
                'name' => $name,
                'type' => $props['type_zone'] ?? $props['type'] ?? '',
            ];
        }
    }

    usort($zones, function ($a, $b) use ($queryLower) {
        $aExact = mb_strtolower($a['name']) === $queryLower;
        $bExact = mb_strtolower($b['name']) === $queryLower;
        if ($aExact && !$bExact) return -1;
        if (!$aExact && $bExact) return 1;
        return strcasecmp($a['name'], $b['name']);
    });

    echo json_encode([
        'query' => $query,
        'count' => count($zones),
        'zones' => array_slice($zones, 0, 20),
    ]);
}

// ==========================================
// ATMO API FUNCTIONS
// ==========================================

function httpRequest(string $url, array $options = []): array
{
    $method = $options['method'] ?? 'GET';
    $headers = $options['headers'] ?? [];
    $body = $options['body'] ?? null;

    $ch = curl_init($url);

    $curlHeaders = [];
    foreach ($headers as $key => $value) {
        $curlHeaders[] = "$key: $value";
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => $curlHeaders,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $httpCode,
        'body' => $response ?: '',
        'error' => $error ?: null,
    ];
}

function getAtmoToken(array $config): ?string
{
    $tokenFile = dirname(dirname(__DIR__)) . '/cache/atchoum_atmo_token.json';

    if (file_exists($tokenFile)) {
        $cached = json_decode(file_get_contents($tokenFile), true);
        if ($cached && isset($cached['token'], $cached['expires']) && $cached['expires'] > time()) {
            return $cached['token'];
        }
    }

    $response = httpRequest('https://admindata.atmo-france.org/api/login', [
        'method' => 'POST',
        'headers' => [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'body' => json_encode([
            'username' => $config['atmo_username'],
            'password' => $config['atmo_password'],
        ]),
    ]);

    if ($response['status'] !== 200 || empty($response['body'])) {
        error_log("Atmo auth failed: HTTP {$response['status']}");
        return null;
    }

    $data = json_decode($response['body'], true);
    if (!isset($data['token'])) {
        return null;
    }

    $cache = [
        'token' => $data['token'],
        'expires' => time() + (23 * 3600),
    ];
    file_put_contents($tokenFile, json_encode($cache));

    return $data['token'];
}

function fetchPollenData(array $config, string $inseeCode, string $date): ?array
{
    $token = getAtmoToken($config);

    if (!$token) {
        return null;
    }

    $url = sprintf(
        'https://admindata.atmo-france.org/api/v2/data/indices/pollens?code_zone=%s&date=%s',
        urlencode($inseeCode),
        urlencode($date)
    );

    $response = httpRequest($url, [
        'method' => 'GET',
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ],
    ]);

    if ($response['status'] !== 200) {
        return null;
    }

    $data = json_decode($response['body'], true);
    return parsePollenResponse($data, $inseeCode, $date);
}

function parsePollenResponse(?array $apiResponse, string $inseeCode, string $date): ?array
{
    if (!$apiResponse) {
        return null;
    }

    $properties = null;
    if (isset($apiResponse['features'][0]['properties'])) {
        $properties = $apiResponse['features'][0]['properties'];
    } elseif (isset($apiResponse[0])) {
        $properties = $apiResponse[0];
    } else {
        $properties = $apiResponse;
    }

    if (!$properties || !isset($properties['code_qual'])) {
        return null;
    }

    $pollenLevels = [
        0 => ['label' => 'Indisponible', 'color' => '#DDDDDD'],
        1 => ['label' => 'Très faible', 'color' => '#50F0E6'],
        2 => ['label' => 'Faible', 'color' => '#50CCAA'],
        3 => ['label' => 'Modéré', 'color' => '#F0E641'],
        4 => ['label' => 'Élevé', 'color' => '#FF5050'],
        5 => ['label' => 'Très élevé', 'color' => '#960032'],
        6 => ['label' => 'Extrêmement élevé', 'color' => '#872181'],
    ];

    $globalLevel = $properties['code_qual'] ?? 0;

    return [
        'inseeCode' => $properties['code_zone'] ?? $inseeCode,
        'cityName' => $properties['lib_zone'] ?? '',
        'date' => $date,
        'dateEch' => $properties['date_ech'] ?? $date,
        'dateDif' => $properties['date_dif'] ?? date('c'),
        'source' => $properties['source'] ?? 'Atmo Data',

        'globalLevel' => $globalLevel,
        'globalLabel' => $pollenLevels[$globalLevel]['label'] ?? 'Inconnu',
        'globalColor' => $properties['coul_qual'] ?? $pollenLevels[$globalLevel]['color'] ?? '#999',

        'isAlert' => ($properties['alerte'] ?? false) || $globalLevel >= 4,
        'pollenResp' => $properties['pollen_resp'] ?? '',

        'pollens' => [
            ['name' => 'Aulne', 'code' => 'aul', 'level' => $properties['code_aul'] ?? 0],
            ['name' => 'Bouleau', 'code' => 'boul', 'level' => $properties['code_boul'] ?? 0],
            ['name' => 'Olivier', 'code' => 'oliv', 'level' => $properties['code_oliv'] ?? 0],
            ['name' => 'Graminées', 'code' => 'gram', 'level' => $properties['code_gram'] ?? 0],
            ['name' => 'Armoise', 'code' => 'arm', 'level' => $properties['code_arm'] ?? 0],
            ['name' => 'Ambroisie', 'code' => 'ambr', 'level' => $properties['code_ambr'] ?? 0],
        ],
    ];
}

function getMockPollenData(string $inseeCode, string $date): array
{
    $pollenLevels = [
        0 => ['label' => 'Indisponible', 'color' => '#DDDDDD'],
        1 => ['label' => 'Très faible', 'color' => '#50F0E6'],
        2 => ['label' => 'Faible', 'color' => '#50CCAA'],
        3 => ['label' => 'Modéré', 'color' => '#F0E641'],
        4 => ['label' => 'Élevé', 'color' => '#FF5050'],
        5 => ['label' => 'Très élevé', 'color' => '#960032'],
        6 => ['label' => 'Extrêmement élevé', 'color' => '#872181'],
    ];

    $month = (int)date('n', strtotime($date));
    $isSpring = $month >= 3 && $month <= 6;
    $isSummer = $month >= 6 && $month <= 9;

    $pollens = [
        ['name' => 'Aulne', 'code' => 'aul', 'level' => $month <= 5 ? rand(0, 3) : 0],
        ['name' => 'Bouleau', 'code' => 'boul', 'level' => $isSpring ? rand(2, 4) : 0],
        ['name' => 'Olivier', 'code' => 'oliv', 'level' => $isSpring ? rand(0, 2) : 0],
        ['name' => 'Graminées', 'code' => 'gram', 'level' => ($isSpring || $isSummer) ? rand(2, 5) : 0],
        ['name' => 'Armoise', 'code' => 'arm', 'level' => $isSummer ? rand(1, 3) : 0],
        ['name' => 'Ambroisie', 'code' => 'ambr', 'level' => $isSummer ? rand(1, 4) : 0],
    ];

    $globalLevel = max(array_column($pollens, 'level'));
    $responsiblePollens = array_filter($pollens, fn($p) => $p['level'] === $globalLevel && $p['level'] > 0);
    $pollenResp = implode(', ', array_column($responsiblePollens, 'name'));

    return [
        'inseeCode' => $inseeCode,
        'cityName' => '',
        'date' => $date,
        'dateEch' => $date,
        'dateDif' => date('c'),
        'source' => 'Données simulées',

        'globalLevel' => $globalLevel,
        'globalLabel' => $pollenLevels[$globalLevel]['label'],
        'globalColor' => $pollenLevels[$globalLevel]['color'],

        'isAlert' => $globalLevel >= 4,
        'pollenResp' => $pollenResp,

        'pollens' => $pollens,
    ];
}
