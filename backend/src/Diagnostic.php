<?php

/**
 * Diagnostic Service - Phase 3
 * 
 * Handles diagnostic mode:
 * - RGPD consent management
 * - Reads symptom data from existing health log (daily_entries + symptom_logs)
 * - Pearson correlation analysis between symptoms and pollen levels
 * - Results history
 * 
 * NOTE: Symptom entry is done via the Health tab (HealthLog class).
 * This class only READS health data to perform correlation analysis.
 */

class Diagnostic
{
    // ==========================================
    // CONSENT MANAGEMENT
    // ==========================================

    /**
     * Activate diagnostic mode (set consent)
     */
    public static function activateConsent(string $userId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'UPDATE users SET consent_diagnostic = TRUE WHERE id = ?'
        );
        $stmt->execute([$userId]);

        return ['success' => true, 'message' => 'Mode diagnostique activé'];
    }

    /**
     * Deactivate diagnostic mode
     */
    public static function deactivateConsent(string $userId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'UPDATE users SET consent_diagnostic = FALSE WHERE id = ?'
        );
        $stmt->execute([$userId]);

        return ['success' => true, 'message' => 'Mode diagnostique désactivé'];
    }

    // ==========================================
    // CORRELATION ANALYSIS
    // ==========================================

    /**
     * Pollen types mapped to Atmo API field names
     */
    private static function getPollenTypes(): array
    {
        return [
            'aulne' => ['code' => 'aul', 'label' => 'Aulne', 'emoji' => '🌳'],
            'bouleau' => ['code' => 'boul', 'label' => 'Bouleau', 'emoji' => '🌿'],
            'olivier' => ['code' => 'oliv', 'label' => 'Olivier', 'emoji' => '🫒'],
            'graminees' => ['code' => 'gram', 'label' => 'Graminées', 'emoji' => '🌾'],
            'armoise' => ['code' => 'arm', 'label' => 'Armoise', 'emoji' => '🌱'],
            'ambroisie' => ['code' => 'ambr', 'label' => 'Ambroisie', 'emoji' => '🌼'],
        ];
    }

    /**
     * Get health log data from daily_entries + symptom_logs for correlation analysis.
     * Returns array of [{entry_date, total_score, category_scores, location_insee_code}]
     */
    private static function getHealthLogData(string $userId, int $days = 60): array
    {
        $db = Database::getInstance();

        // Get daily entries with their total symptom scores
        $stmt = $db->prepare(
            'SELECT de.id, de.entry_date,
                    COALESCE(SUM(sl.severity), 0) as total_score
             FROM daily_entries de
             LEFT JOIN symptom_logs sl ON de.id = sl.daily_entry_id
             WHERE de.user_id = ? AND de.entry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY de.id, de.entry_date
             HAVING total_score > 0
             ORDER BY de.entry_date ASC'
        );
        $stmt->execute([$userId, $days]);
        $entries = $stmt->fetchAll();

        // Get user's main city INSEE code
        $stmt = $db->prepare(
            'SELECT insee_code FROM cities WHERE user_id = ? AND is_main = 1 LIMIT 1'
        );
        $stmt->execute([$userId]);
        $city = $stmt->fetch();
        $inseeCode = $city ? $city['insee_code'] : null;

        // Attach INSEE code and get per-category scores
        foreach ($entries as &$entry) {
            $entry['location_insee_code'] = $inseeCode;
            $entry['total_score'] = (int)$entry['total_score'];

            // Get per-category breakdown
            $stmt = $db->prepare(
                'SELECT s.category, SUM(sl.severity) as cat_score
                 FROM symptom_logs sl
                 JOIN symptoms s ON sl.symptom_id = s.id
                 WHERE sl.daily_entry_id = ?
                 GROUP BY s.category'
            );
            $stmt->execute([$entry['id']]);
            $cats = $stmt->fetchAll();
            $entry['category_scores'] = [];
            foreach ($cats as $cat) {
                $entry['category_scores'][$cat['category']] = (int)$cat['cat_score'];
            }
        }

        return $entries;
    }

    /**
     * Run diagnostic analysis: correlate symptoms with pollen data
     * Reads from daily_entries + symptom_logs (Health tab data)
     */
    public static function analyze(string $userId, int $minDays = 1): array
    {
        $db = Database::getInstance();

        // Verify consent
        $stmt = $db->prepare('SELECT consent_diagnostic FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !$user['consent_diagnostic']) {
            return ['success' => false, 'error' => 'Mode diagnostique non activé'];
        }

        // Get symptom data from health log (last 60 days)
        $healthLogs = self::getHealthLogData($userId, 60);

        if (count($healthLogs) < $minDays) {
            return [
                'success' => false,
                'error' => "Pas assez de données. Minimum $minDays jours requis, vous avez " . count($healthLogs) . " jour(s). Saisissez vos symptômes dans l'onglet Santé.",
                'current_days' => count($healthLogs),
                'min_days' => $minDays,
            ];
        }

        // Load Atmo config for API calls
        $atmoConfig = require dirname(__DIR__) . '/config/config.php';
        $pollenTypes = self::getPollenTypes();

        // Fetch pollen data for each log date + location
        $pollenCache = [];
        foreach ($healthLogs as $log) {
            $cacheKey = $log['entry_date'] . '_' . $log['location_insee_code'];
            if (!isset($pollenCache[$cacheKey]) && $log['location_insee_code']) {
                $pollenData = self::fetchPollenForDate($atmoConfig, $log['location_insee_code'], $log['entry_date']);
                $pollenCache[$cacheKey] = $pollenData;
            }
        }

        // Determine analysis mode based on data points
        $dataPointCount = 0;
        foreach ($pollenTypes as $pollenInfo) {
            $count = 0;
            foreach ($healthLogs as $log) {
                $cacheKey = $log['entry_date'] . '_' . $log['location_insee_code'];
                if (isset($pollenCache[$cacheKey])) $count++;
            }
            $dataPointCount = max($dataPointCount, $count);
        }

        $correlations = [];
        $analysisMethod = $dataPointCount >= 3 ? 'pearson' : 'exposure';

        if ($analysisMethod === 'pearson') {
            // === PEARSON CORRELATION (3+ data points) ===
            foreach ($pollenTypes as $pollenKey => $pollenInfo) {
                $x = [];
                $y = [];

                foreach ($healthLogs as $log) {
                    $cacheKey = $log['entry_date'] . '_' . $log['location_insee_code'];
                    $pollenData = $pollenCache[$cacheKey] ?? null;
                    if (!$pollenData) continue;

                    $pollenLevel = 0;
                    foreach ($pollenData as $p) {
                        if (($p['code'] ?? '') === $pollenInfo['code']) {
                            $pollenLevel = (int)($p['level'] ?? 0);
                            break;
                        }
                    }

                    $x[] = $pollenLevel;
                    $y[] = (int)$log['total_score'];
                }

                if (count($x) < 3) continue;

                $result = self::pearsonCorrelation($x, $y);
                $result['pollen'] = $pollenKey;
                $result['label'] = $pollenInfo['label'];
                $result['emoji'] = $pollenInfo['emoji'];
                $result['method'] = 'pearson';

                if (abs($result['coefficient']) > 0.2) {
                    $correlations[$pollenKey] = $result;
                }
            }
        } else {
            // === EXPOSURE-MATCH (1-2 data points) ===
            // Score each pollen by: pollenLevel / 6 × symptomScore weight
            // Higher pollen on symptomatic days = higher suspicion
            $pollenScores = [];

            foreach ($pollenTypes as $pollenKey => $pollenInfo) {
                $totalScore = 0;
                $maxPossible = 0;
                $dayCount = 0;

                foreach ($healthLogs as $log) {
                    $cacheKey = $log['entry_date'] . '_' . $log['location_insee_code'];
                    $pollenData = $pollenCache[$cacheKey] ?? null;
                    if (!$pollenData) continue;

                    $pollenLevel = 0;
                    foreach ($pollenData as $p) {
                        if (($p['code'] ?? '') === $pollenInfo['code']) {
                            $pollenLevel = (int)($p['level'] ?? 0);
                            break;
                        }
                    }

                    $dayCount++;
                    // Weight: pollen level (0-6) × symptom severity, normalized
                    $symptomWeight = min($log['total_score'] / 30, 1); // normalize symptoms
                    $totalScore += ($pollenLevel / 6) * (0.3 + 0.7 * $symptomWeight);
                    $maxPossible += 1; // max is 1 per day
                }

                if ($dayCount === 0 || $totalScore <= 0) continue;

                $coefficient = round($totalScore / $maxPossible, 3);
                $pollenScores[$pollenKey] = [
                    'pollen' => $pollenKey,
                    'label' => $pollenInfo['label'],
                    'emoji' => $pollenInfo['emoji'],
                    'coefficient' => $coefficient,
                    'p_value' => null, // no p-value for exposure match
                    'sample_size' => $dayCount,
                    'method' => 'exposure',
                ];
            }

            // Only keep pollens with meaningful exposure (> 0.1)
            foreach ($pollenScores as $key => $score) {
                if ($score['coefficient'] > 0.1) {
                    $correlations[$key] = $score;
                }
            }
        }

        // Sort by absolute coefficient DESC
        uasort($correlations, fn($a, $b) => abs($b['coefficient']) <=> abs($a['coefficient']));

        // Top 3 suspected allergens
        $suspectedAllergens = [];
        $thresholdForSuspect = $analysisMethod === 'pearson' ? 0.3 : 0.15;
        foreach ($correlations as $key => $corr) {
            if ($corr['coefficient'] > $thresholdForSuspect && count($suspectedAllergens) < 3) {
                $suspectedAllergens[] = $key;
            }
        }

        // Calculate confidence score
        $confidenceScore = self::calculateConfidence($correlations, count($healthLogs), $analysisMethod);

        // Determine analysis period
        $periodStart = $healthLogs[0]['entry_date'];
        $periodEnd = $healthLogs[count($healthLogs) - 1]['entry_date'];

        // Save result
        $stmt = $db->prepare(
            'INSERT INTO diagnostic_results 
             (user_id, analysis_period_start, analysis_period_end, correlations_json, 
              suspected_allergens, confidence_score, sample_size)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $periodStart,
            $periodEnd,
            json_encode($correlations),
            json_encode($suspectedAllergens),
            $confidenceScore,
            count($healthLogs),
        ]);

        $resultId = $db->lastInsertId();

        return [
            'success' => true,
            'result' => [
                'id' => $resultId,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'correlations' => $correlations,
                'suspected_allergens' => $suspectedAllergens,
                'confidence_score' => $confidenceScore,
                'sample_size' => count($healthLogs),
            ],
        ];
    }

    /**
     * Calculate Pearson correlation coefficient + t-test p-value
     */
    private static function pearsonCorrelation(array $x, array $y): array
    {
        $n = count($x);
        if ($n < 3) {
            return ['coefficient' => 0, 'p_value' => 1, 'sample_size' => $n];
        }

        $sumX = array_sum($x);
        $sumY = array_sum($y);
        $sumXY = 0;
        $sumX2 = 0;
        $sumY2 = 0;

        for ($i = 0; $i < $n; $i++) {
            $sumXY += $x[$i] * $y[$i];
            $sumX2 += $x[$i] ** 2;
            $sumY2 += $y[$i] ** 2;
        }

        $numerator = ($n * $sumXY) - ($sumX * $sumY);
        $denomX = ($n * $sumX2) - ($sumX ** 2);
        $denomY = ($n * $sumY2) - ($sumY ** 2);

        if ($denomX <= 0 || $denomY <= 0) {
            return ['coefficient' => 0, 'p_value' => 1, 'sample_size' => $n];
        }

        $denominator = sqrt($denomX * $denomY);
        $coefficient = $numerator / $denominator;

        // t-test for significance
        $r2 = $coefficient ** 2;
        if ($r2 >= 1) {
            $pValue = 0;
        } else {
            $t = $coefficient * sqrt(($n - 2) / (1 - $r2));
            $pValue = self::tTestPValue($t, $n - 2);
        }

        return [
            'coefficient' => round($coefficient, 3),
            'p_value' => round($pValue, 4),
            'sample_size' => $n,
        ];
    }

    /**
     * Approximate two-tailed p-value from t-statistic using normal approximation
     */
    private static function tTestPValue(float $t, int $df): float
    {
        if ($df <= 0) return 1;

        // Use approximation for large df
        $x = abs($t);

        // Abramowitz & Stegun approximation of the normal CDF
        $b1 = 0.319381530;
        $b2 = -0.356563782;
        $b3 = 1.781477937;
        $b4 = -1.821255978;
        $b5 = 1.330274429;
        $p = 0.2316419;

        $t_val = 1.0 / (1.0 + $p * $x);
        $zd = exp(-0.5 * $x * $x) / sqrt(2.0 * M_PI);
        $prob = $zd * $t_val * ($b1 + $t_val * ($b2 + $t_val * ($b3 + $t_val * ($b4 + $t_val * $b5))));

        return min(1.0, max(0.0, 2.0 * $prob)); // two-tailed
    }

    /**
     * Calculate confidence score based on correlations and sample size
     */
    private static function calculateConfidence(array $correlations, int $sampleSize, string $method = 'pearson'): float
    {
        if (empty($correlations)) return 0;

        // Average positive coefficient
        $positiveCoeffs = array_filter(
            array_column($correlations, 'coefficient'),
            fn($c) => $c > 0
        );

        if (empty($positiveCoeffs)) return 0;

        $avgCoefficient = array_sum($positiveCoeffs) / count($positiveCoeffs);

        if ($method === 'exposure') {
            // Exposure-match: lower confidence cap (max ~25%)
            // Reflects that co-occurrence ≠ causation
            $sampleFactor = min($sampleSize / 14, 1); // scales up as more days are added
            $score = $avgCoefficient * $sampleFactor * 25;
        } else {
            // Pearson correlation: full confidence calculation
            $sampleFactor = min($sampleSize / 30, 1);
            $significantCount = count(array_filter($correlations, fn($c) => ($c['p_value'] ?? 1) < 0.05));
            $sigFactor = count($correlations) > 0 ? $significantCount / count($correlations) : 0;
            $score = $avgCoefficient * $sampleFactor * (0.6 + 0.4 * $sigFactor) * 100;
        }

        return round(min(100, max(0, $score)), 1);
    }

    /**
     * Fetch pollen data for a specific date and location via Atmo API
     * Returns array of pollens [{code, level}] or null
     */
    private static function fetchPollenForDate(array $config, string $inseeCode, string $date): ?array
    {
        // Use the global fetchPollenData function from index.php
        // We make a direct API call here
        $token = self::getAtmoToken($config);
        if (!$token) return null;

        $url = sprintf(
            'https://admindata.atmo-france.org/api/v2/data/indices/pollens?code_zone=%s&date=%s',
            urlencode($inseeCode),
            urlencode($date)
        );

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Accept: application/json',
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) return null;

        $data = json_decode($response, true);
        $properties = $data['features'][0]['properties'] ?? $data[0] ?? $data ?? null;

        if (!$properties || !isset($properties['code_qual'])) return null;

        return [
            ['code' => 'aul', 'level' => $properties['code_aul'] ?? 0],
            ['code' => 'boul', 'level' => $properties['code_boul'] ?? 0],
            ['code' => 'oliv', 'level' => $properties['code_oliv'] ?? 0],
            ['code' => 'gram', 'level' => $properties['code_gram'] ?? 0],
            ['code' => 'arm', 'level' => $properties['code_arm'] ?? 0],
            ['code' => 'ambr', 'level' => $properties['code_ambr'] ?? 0],
        ];
    }

    /**
     * Get Atmo API token (reuses cached token logic)
     */
    private static function getAtmoToken(array $config): ?string
    {
        // Reuse the cached token if available
        $tokenFile = dirname(dirname(__DIR__)) . '/cache/atchoum_atmo_token.json';

        if (file_exists($tokenFile)) {
            $cached = json_decode(file_get_contents($tokenFile), true);
            if ($cached && isset($cached['token'], $cached['expires']) && $cached['expires'] > time()) {
                return $cached['token'];
            }
        }

        // Request new token
        $ch = curl_init('https://admindata.atmo-france.org/api/login');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'username' => $config['atmo_username'],
                'password' => $config['atmo_password'],
            ]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) return null;

        $data = json_decode($response, true);
        if (!isset($data['token'])) return null;

        $cache = [
            'token' => $data['token'],
            'expires' => time() + (23 * 3600),
        ];
        @file_put_contents($tokenFile, json_encode($cache));

        return $data['token'];
    }

    // ==========================================
    // RESULTS
    // ==========================================

    /**
     * Get a specific result by ID
     */
    public static function getResult(string $userId, int $resultId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, analysis_period_start, analysis_period_end, correlations_json,
                    suspected_allergens, confidence_score, sample_size, created_at
             FROM diagnostic_results
             WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([$resultId, $userId]);
        $result = $stmt->fetch();

        if (!$result) {
            return ['success' => false, 'error' => 'Résultat non trouvé'];
        }

        $result['correlations'] = json_decode($result['correlations_json'], true);
        $result['suspected_allergens'] = json_decode($result['suspected_allergens'], true);
        $result['confidence_score'] = (float)$result['confidence_score'];
        $result['sample_size'] = (int)$result['sample_size'];
        unset($result['correlations_json']);

        return ['success' => true, 'result' => $result];
    }

    /**
     * Get all results for a user
     */
    public static function getResults(string $userId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, analysis_period_start, analysis_period_end, correlations_json,
                    suspected_allergens, confidence_score, sample_size, created_at
             FROM diagnostic_results
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 20'
        );
        $stmt->execute([$userId]);
        $results = $stmt->fetchAll();

        foreach ($results as &$result) {
            $result['correlations'] = json_decode($result['correlations_json'], true);
            $result['suspected_allergens'] = json_decode($result['suspected_allergens'], true);
            $result['confidence_score'] = (float)$result['confidence_score'];
            $result['sample_size'] = (int)$result['sample_size'];
            unset($result['correlations_json']);
        }

        return ['success' => true, 'count' => count($results), 'results' => $results];
    }

    // ==========================================
    // TIMELINE DATA
    // ==========================================

    /**
     * Get timeline data: symptoms scores + pollen levels aligned by date
     * Reads from daily_entries + symptom_logs (Health tab data)
     */
    public static function getTimeline(string $userId, int $days = 30): array
    {
        // Get health log data
        $healthLogs = self::getHealthLogData($userId, $days);

        if (empty($healthLogs)) {
            return ['success' => true, 'timeline' => [], 'count' => 0];
        }

        // Fetch pollen data for each date
        $atmoConfig = require dirname(__DIR__) . '/config/config.php';
        $timeline = [];

        foreach ($healthLogs as $log) {
            $pollenData = null;
            if ($log['location_insee_code']) {
                $pollenData = self::fetchPollenForDate($atmoConfig, $log['location_insee_code'], $log['entry_date']);
            }

            $pollenLevels = [];
            if ($pollenData) {
                $pollenMap = ['aul' => 'Aulne', 'boul' => 'Bouleau', 'oliv' => 'Olivier', 'gram' => 'Graminées', 'arm' => 'Armoise', 'ambr' => 'Ambroisie'];
                foreach ($pollenData as $p) {
                    $pollenLevels[$pollenMap[$p['code']] ?? $p['code']] = (int)$p['level'];
                }
            }

            $timeline[] = [
                'date' => $log['entry_date'],
                'total_score' => $log['total_score'],
                'category_scores' => $log['category_scores'],
                'pollen_levels' => $pollenLevels,
            ];
        }

        return ['success' => true, 'count' => count($timeline), 'timeline' => $timeline];
    }

    // ==========================================
    // DATA MANAGEMENT (RGPD)
    // ==========================================

    /**
     * Delete all diagnostic data for a user (results only, health log data stays)
     */
    public static function deleteAllData(string $userId): array
    {
        $db = Database::getInstance();

        $db->beginTransaction();
        try {
            $stmt = $db->prepare('DELETE FROM diagnostic_results WHERE user_id = ?');
            $stmt->execute([$userId]);
            $deletedResults = $stmt->rowCount();

            // Deactivate consent
            $stmt = $db->prepare('UPDATE users SET consent_diagnostic = FALSE WHERE id = ?');
            $stmt->execute([$userId]);

            $db->commit();

            return [
                'success' => true,
                'message' => 'Toutes les données diagnostiques ont été supprimées. Vos données de santé (onglet Santé) sont conservées.',
                'deleted_results' => $deletedResults,
            ];
        } catch (Exception $e) {
            $db->rollBack();
            error_log("Diagnostic deleteAllData error: " . $e->getMessage());
            return ['success' => false, 'error' => 'Erreur lors de la suppression'];
        }
    }

    /**
     * Get diagnostic status for a user
     * Counts symptom days from daily_entries + symptom_logs (Health tab data)
     */
    public static function getStatus(string $userId): array
    {
        $db = Database::getInstance();

        // Consent status
        $stmt = $db->prepare('SELECT consent_diagnostic FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        // Count days with symptoms from health log (daily_entries with symptom_logs)
        $stmt = $db->prepare(
            'SELECT COUNT(DISTINCT de.entry_date) as count,
                    MIN(de.entry_date) as first_date,
                    MAX(de.entry_date) as last_date
             FROM daily_entries de
             INNER JOIN symptom_logs sl ON de.id = sl.daily_entry_id
             WHERE de.user_id = ?'
        );
        $stmt->execute([$userId]);
        $logStats = $stmt->fetch();

        // Count results
        $stmt = $db->prepare('SELECT COUNT(*) as count FROM diagnostic_results WHERE user_id = ?');
        $stmt->execute([$userId]);
        $resultStats = $stmt->fetch();

        // Check if enough data for analysis (1+ days with symptoms in last 60 days)
        $stmt = $db->prepare(
            'SELECT COUNT(DISTINCT de.entry_date) as recent_count
             FROM daily_entries de
             INNER JOIN symptom_logs sl ON de.id = sl.daily_entry_id
             WHERE de.user_id = ? AND de.entry_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)'
        );
        $stmt->execute([$userId]);
        $recentStats = $stmt->fetch();
        $recentCount = (int)$recentStats['recent_count'];

        $logCount = (int)$logStats['count'];
        $canAnalyze = $recentCount >= 1;

        return [
            'success' => true,
            'status' => [
                'consent_active' => (bool)($user['consent_diagnostic'] ?? false),
                'log_count' => $logCount,
                'recent_log_count' => $recentCount,
                'first_log_date' => $logStats['first_date'],
                'last_log_date' => $logStats['last_date'],
                'result_count' => (int)$resultStats['count'],
                'can_analyze' => $canAnalyze,
                'days_until_analysis' => $canAnalyze ? 0 : max(0, 1 - $recentCount),
            ],
        ];
    }
}
