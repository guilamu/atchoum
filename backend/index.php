<?php

/**
 * Atchoum! Backend API Proxy
 * 
 * This script proxies requests to the Atmo Data API to avoid CORS issues.
 * It handles JWT authentication and caches tokens.
 * 
 * Usage: php -S localhost:8080 -t backend
 */

// Enable error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 0);

// CORS headers - allow requests from any origin (dev mode)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Load configuration
$config = require __DIR__ . '/config.php';

// Simple router
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

try {
    switch ($path) {
        case '/':
        case '/health':
            echo json_encode([
                'status' => 'ok',
                'service' => 'Atchoum API Proxy',
                'php' => PHP_VERSION,
                'curl' => function_exists('curl_init'),
                'allow_url_fopen' => ini_get('allow_url_fopen'),
            ]);
            break;

        case '/api/pollen':
            handlePollenRequest($config);
            break;

        case '/api/pollen/forecast':
            handleForecastRequest($config);
            break;

        case '/api/token':
            // For debugging
            $token = getAtmoToken($config);
            echo json_encode(['hasToken' => !empty($token), 'tokenPreview' => $token ? substr($token, 0, 20) . '...' : null]);
            break;

        case '/api/test-auth':
            // Test authentication endpoint
            $result = testAtmoAuth($config);
            echo json_encode($result);
            break;

        case '/api/zones':
            // Fetch available RAEP zones
            handleZonesRequest($config);
            break;

        case '/api/zones/search':
            // Search zones by name
            handleZoneSearchRequest($config);
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Not found', 'path' => $path]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}

/**
 * Handle pollen data request
 */
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
        // Return mock data if API fails
        echo json_encode(getMockPollenData($inseeCode, $date));
        return;
    }

    echo json_encode($data);
}

/**
 * Handle forecast request (J, J+1, J+2)
 */
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

/**
 * Fetch available RAEP zones from Atmo API
 */
function handleZonesRequest(array $config): void
{
    $token = getAtmoToken($config);

    if (!$token) {
        http_response_code(500);
        echo json_encode(['error' => 'Authentication failed']);
        return;
    }

    // Fetch zones list
    $url = 'https://admindata.atmo-france.org/api/v2/data/indices/pollens/zones?format=json';

    $response = httpRequest($url, [
        'method' => 'GET',
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ],
    ]);

    if ($response['status'] !== 200) {
        error_log("Zones fetch failed: HTTP {$response['status']} - {$response['body']}");
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch zones', 'status' => $response['status']]);
        return;
    }

    $data = json_decode($response['body'], true);

    // Parse zones into a simpler format
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
    } elseif (is_array($data)) {
        foreach ($data as $zone) {
            $zones[] = [
                'code' => $zone['code_zone'] ?? $zone['code'] ?? '',
                'name' => $zone['lib_zone'] ?? $zone['name'] ?? '',
                'type' => $zone['type_zone'] ?? $zone['type'] ?? '',
            ];
        }
    }

    echo json_encode([
        'count' => count($zones),
        'zones' => $zones,
    ]);
}

/**
 * Search zones by name
 */
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

    // Fetch all zones and filter locally (API doesn't support search)
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

    // Sort by relevance (exact matches first)
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
        'zones' => array_slice($zones, 0, 20), // Limit to 20 results
    ]);
}

/**
 * Make HTTP request - tries cURL first, then file_get_contents
 */
function httpRequest(string $url, array $options = []): array
{
    // Try cURL first if available
    if (function_exists('curl_init')) {
        return curlRequest($url, $options);
    }

    // Fallback to file_get_contents
    return streamRequest($url, $options);
}

/**
 * Make request using cURL
 */
function curlRequest(string $url, array $options = []): array
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

    if ($error) {
        error_log("cURL error: $error");
    }

    return [
        'status' => $httpCode,
        'body' => $response ?: '',
        'error' => $error ?: null,
    ];
}

/**
 * Make request using file_get_contents (fallback)
 */
function streamRequest(string $url, array $options = []): array
{
    $method = $options['method'] ?? 'GET';
    $headers = $options['headers'] ?? [];
    $body = $options['body'] ?? null;

    // Build headers string
    $headerLines = [];
    foreach ($headers as $key => $value) {
        $headerLines[] = "$key: $value";
    }

    // Find CA bundle for Windows
    $caBundle = findCaBundle();

    $contextOptions = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headerLines),
            'content' => $body,
            'timeout' => 30,
            'ignore_errors' => true,
        ],
    ];

    // Add SSL options if CA bundle found
    if ($caBundle) {
        $contextOptions['ssl'] = [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'cafile' => $caBundle,
        ];
    } else {
        // Disable SSL verification if no CA bundle (not recommended for production)
        $contextOptions['ssl'] = [
            'verify_peer' => false,
            'verify_peer_name' => false,
        ];
    }

    $context = stream_context_create($contextOptions);

    $response = @file_get_contents($url, false, $context);

    // Get response status from headers
    $httpCode = 0;
    $responseHeaders = $http_response_header ?? [];
    if (!empty($responseHeaders[0])) {
        preg_match('/HTTP\/[\d.]+\s+(\d+)/', $responseHeaders[0], $matches);
        $httpCode = (int)($matches[1] ?? 0);
    }

    return [
        'status' => $httpCode,
        'body' => $response ?: '',
        'headers' => $responseHeaders,
    ];
}

/**
 * Find CA bundle on Windows
 */
function findCaBundle(): ?string
{
    $possiblePaths = [
        'C:/php/extras/ssl/cacert.pem',
        'C:/php/cacert.pem',
        'C:/xampp/apache/bin/curl-ca-bundle.crt',
        'C:/xampp/php/extras/ssl/cacert.pem',
        dirname(__DIR__) . '/cacert.pem',
        __DIR__ . '/cacert.pem',
    ];

    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            return $path;
        }
    }

    return null;
}

/**
 * Test authentication with Atmo API
 */
function testAtmoAuth(array $config): array
{
    $url = 'https://admindata.atmo-france.org/api/login';
    $body = json_encode([
        'username' => $config['atmo_username'],
        'password' => $config['atmo_password'],
    ]);

    $response = httpRequest($url, [
        'method' => 'POST',
        'headers' => [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'body' => $body,
    ]);

    return [
        'status' => $response['status'],
        'hasToken' => isset(json_decode($response['body'], true)['token']),
        'bodyPreview' => substr($response['body'], 0, 200),
        'error' => $response['error'] ?? null,
        'caBundle' => findCaBundle(),
    ];
}

/**
 * Get or refresh Atmo API JWT token
 */
function getAtmoToken(array $config): ?string
{
    $tokenFile = sys_get_temp_dir() . '/atchoum_atmo_token.json';

    // Check cached token
    if (file_exists($tokenFile)) {
        $cached = json_decode(file_get_contents($tokenFile), true);
        if ($cached && isset($cached['token'], $cached['expires']) && $cached['expires'] > time()) {
            return $cached['token'];
        }
    }

    // Request new token
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
        error_log("Atmo auth failed: HTTP {$response['status']} - " . ($response['error'] ?? 'Unknown error'));
        return null;
    }

    $data = json_decode($response['body'], true);
    if (!isset($data['token'])) {
        error_log("Atmo auth failed: No token in response - " . $response['body']);
        return null;
    }

    // Cache token (expires in 23 hours to be safe)
    $cache = [
        'token' => $data['token'],
        'expires' => time() + (23 * 3600),
    ];
    file_put_contents($tokenFile, json_encode($cache));

    return $data['token'];
}

/**
 * Fetch pollen data from Atmo API
 */
function fetchPollenData(array $config, string $inseeCode, string $date): ?array
{
    $token = getAtmoToken($config);

    if (!$token) {
        error_log("No token available for Atmo API");
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
        error_log("Atmo API request failed: HTTP {$response['status']} - URL: $url");
        error_log("Atmo API response body: " . substr($response['body'], 0, 500));
        return null;
    }

    $data = json_decode($response['body'], true);
    return parsePollenResponse($data, $inseeCode, $date);
}

/**
 * Parse Atmo API response into our format
 */
function parsePollenResponse(?array $apiResponse, string $inseeCode, string $date): ?array
{
    if (!$apiResponse) {
        return null;
    }

    // Handle GeoJSON format
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

/**
 * Generate mock pollen data for development
 */
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

    // Generate random but seasonal mock data
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
        'source' => 'Données simulées (backend)',

        'globalLevel' => $globalLevel,
        'globalLabel' => $pollenLevels[$globalLevel]['label'],
        'globalColor' => $pollenLevels[$globalLevel]['color'],

        'isAlert' => $globalLevel >= 4,
        'pollenResp' => $pollenResp,

        'pollens' => $pollens,
    ];
}
