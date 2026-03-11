<?php

/**
 * HealthLog - Symptom and Medication Tracking
 * 
 * Handles daily health entries, symptom logging, and medication intake tracking.
 */

class HealthLog
{
    /**
     * Get all active symptoms from catalog
     */
    public static function getSymptoms(): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT id, name, category, icon, display_order 
             FROM symptoms 
             WHERE is_active = 1 
             ORDER BY display_order, name'
        );
        $stmt->execute();

        $symptoms = $stmt->fetchAll();

        // Group by category
        $grouped = [
            'respiratoire' => [],
            'oculaire' => [],
            'cutane' => [],
            'general' => [],
        ];

        foreach ($symptoms as $symptom) {
            $category = $symptom['category'];
            unset($symptom['category']);
            $grouped[$category][] = $symptom;
        }

        return [
            'success' => true,
            'symptoms' => $symptoms,
            'grouped' => $grouped,
        ];
    }

    /**
     * Get all active medications from catalog
     */
    public static function getMedications(): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT id, name, type, common_dosage, display_order 
             FROM medications 
             WHERE is_active = 1 
             ORDER BY display_order, name'
        );
        $stmt->execute();

        $medications = $stmt->fetchAll();

        // Group by type
        $grouped = [
            'antihistaminique' => [],
            'corticoide' => [],
            'decongestionnant' => [],
            'autre' => [],
        ];

        foreach ($medications as $med) {
            $type = $med['type'];
            unset($med['type']);
            $grouped[$type][] = $med;
        }

        return [
            'success' => true,
            'medications' => $medications,
            'grouped' => $grouped,
        ];
    }

    /**
     * Get or create daily entry for a user and date
     */
    public static function getOrCreateDailyEntry(string $userId, string $date): array
    {
        $db = Database::getInstance();

        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return ['success' => false, 'error' => 'Format de date invalide (YYYY-MM-DD)'];
        }

        // Check if entry exists
        $stmt = $db->prepare(
            'SELECT id, entry_date, notes, created_at, updated_at 
             FROM daily_entries 
             WHERE user_id = ? AND entry_date = ?'
        );
        $stmt->execute([$userId, $date]);
        $entry = $stmt->fetch();

        if ($entry) {
            // Get symptoms for this entry
            $stmt = $db->prepare(
                'SELECT sl.id, sl.symptom_id, sl.severity, sl.notes, s.name, s.category, s.icon
                 FROM symptom_logs sl
                 JOIN symptoms s ON sl.symptom_id = s.id
                 WHERE sl.daily_entry_id = ?
                 ORDER BY s.display_order'
            );
            $stmt->execute([$entry['id']]);
            $entry['symptoms'] = $stmt->fetchAll();

            return ['success' => true, 'entry' => $entry, 'isNew' => false];
        }

        // Create new entry
        $stmt = $db->prepare(
            'INSERT INTO daily_entries (user_id, entry_date) VALUES (?, ?)'
        );
        $stmt->execute([$userId, $date]);

        return [
            'success' => true,
            'entry' => [
                'id' => $db->lastInsertId(),
                'entry_date' => $date,
                'notes' => null,
                'symptoms' => [],
            ],
            'isNew' => true,
        ];
    }

    /**
     * Save daily entry with symptoms
     */
    public static function saveDailyEntry(string $userId, array $data): array
    {
        $db = Database::getInstance();
        $date = $data['date'] ?? date('Y-m-d');
        $notes = $data['notes'] ?? null;
        $symptoms = $data['symptoms'] ?? [];

        // Validate date
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return ['success' => false, 'error' => 'Format de date invalide'];
        }

        // Don't allow future dates
        if ($date > date('Y-m-d')) {
            return ['success' => false, 'error' => 'Impossible de saisir pour une date future'];
        }

        // Get or create entry
        $stmt = $db->prepare(
            'SELECT id FROM daily_entries WHERE user_id = ? AND entry_date = ?'
        );
        $stmt->execute([$userId, $date]);
        $entry = $stmt->fetch();

        if ($entry) {
            $entryId = $entry['id'];
            // Update notes
            $stmt = $db->prepare(
                'UPDATE daily_entries SET notes = ?, updated_at = NOW() WHERE id = ?'
            );
            $stmt->execute([$notes, $entryId]);
        } else {
            // Create new
            $stmt = $db->prepare(
                'INSERT INTO daily_entries (user_id, entry_date, notes) VALUES (?, ?, ?)'
            );
            $stmt->execute([$userId, $date, $notes]);
            $entryId = $db->lastInsertId();
        }

        // Clear existing symptoms
        $stmt = $db->prepare('DELETE FROM symptom_logs WHERE daily_entry_id = ?');
        $stmt->execute([$entryId]);

        // Insert new symptoms
        $insertedSymptoms = [];
        foreach ($symptoms as $symptom) {
            if (!isset($symptom['symptom_id']) || !isset($symptom['severity'])) {
                continue;
            }

            $severity = max(0, min(10, (int)$symptom['severity']));
            if ($severity === 0) {
                continue; // Don't save severity 0
            }

            $stmt = $db->prepare(
                'INSERT INTO symptom_logs (daily_entry_id, symptom_id, severity, notes) 
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([
                $entryId,
                $symptom['symptom_id'],
                $severity,
                $symptom['notes'] ?? null,
            ]);

            $insertedSymptoms[] = [
                'id' => $db->lastInsertId(),
                'symptom_id' => $symptom['symptom_id'],
                'severity' => $severity,
            ];
        }

        return [
            'success' => true,
            'entry' => [
                'id' => $entryId,
                'date' => $date,
                'notes' => $notes,
                'symptoms_count' => count($insertedSymptoms),
            ],
        ];
    }

    /**
     * Get daily entries for a date range
     */
    public static function getDailyEntries(string $userId, ?string $startDate = null, ?string $endDate = null): array
    {
        $db = Database::getInstance();

        // Default to last 30 days
        if (!$startDate) {
            $startDate = date('Y-m-d', strtotime('-30 days'));
        }
        if (!$endDate) {
            $endDate = date('Y-m-d');
        }

        // Get entries
        $stmt = $db->prepare(
            'SELECT de.id, de.entry_date, de.notes, de.created_at, de.updated_at
             FROM daily_entries de
             WHERE de.user_id = ? AND de.entry_date BETWEEN ? AND ?
             ORDER BY de.entry_date DESC'
        );
        $stmt->execute([$userId, $startDate, $endDate]);
        $entries = $stmt->fetchAll();

        // Get symptoms for each entry
        foreach ($entries as &$entry) {
            $stmt = $db->prepare(
                'SELECT sl.symptom_id, sl.severity, sl.notes, s.name, s.category, s.icon
                 FROM symptom_logs sl
                 JOIN symptoms s ON sl.symptom_id = s.id
                 WHERE sl.daily_entry_id = ?
                 ORDER BY sl.severity DESC'
            );
            $stmt->execute([$entry['id']]);
            $entry['symptoms'] = $stmt->fetchAll();
        }

        return [
            'success' => true,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'count' => count($entries),
            'entries' => $entries,
        ];
    }

    /**
     * Record a medication intake
     */
    public static function addMedicationIntake(string $userId, array $data): array
    {
        $db = Database::getInstance();

        $medicationId = $data['medication_id'] ?? null;
        $customName = $data['custom_medication_name'] ?? null;
        $intakeDatetime = $data['intake_datetime'] ?? date('Y-m-d H:i:s');
        $dosage = $data['dosage'] ?? null;
        $notes = $data['notes'] ?? null;

        // Validate: need either medication_id or custom_name
        if (!$medicationId && !$customName) {
            return ['success' => false, 'error' => 'medication_id ou custom_medication_name requis'];
        }

        // Validate medication_id exists
        if ($medicationId) {
            $stmt = $db->prepare('SELECT id, name FROM medications WHERE id = ? AND is_active = 1');
            $stmt->execute([$medicationId]);
            $med = $stmt->fetch();
            if (!$med) {
                return ['success' => false, 'error' => 'Médicament non trouvé'];
            }
        }

        // Don't allow future intake
        $intakeTs = strtotime($intakeDatetime);
        if ($intakeTs > time()) {
            return ['success' => false, 'error' => 'Impossible d\'enregistrer une prise future'];
        }

        // Insert
        $stmt = $db->prepare(
            'INSERT INTO medication_intakes 
             (user_id, medication_id, custom_medication_name, intake_datetime, dosage, notes)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $medicationId,
            $customName,
            date('Y-m-d H:i:s', $intakeTs),
            $dosage,
            $notes,
        ]);

        return [
            'success' => true,
            'intake' => [
                'id' => $db->lastInsertId(),
                'medication_id' => $medicationId,
                'custom_medication_name' => $customName,
                'intake_datetime' => date('Y-m-d H:i:s', $intakeTs),
                'dosage' => $dosage,
            ],
        ];
    }

    /**
     * Get medication intakes for a date or date range
     */
    public static function getMedicationIntakes(string $userId, ?string $date = null, ?string $startDate = null, ?string $endDate = null): array
    {
        $db = Database::getInstance();

        if ($date) {
            // Single date
            $stmt = $db->prepare(
                'SELECT mi.id, mi.medication_id, mi.custom_medication_name, mi.intake_datetime, mi.dosage, mi.notes,
                        m.name as medication_name, m.type as medication_type, m.common_dosage
                 FROM medication_intakes mi
                 LEFT JOIN medications m ON mi.medication_id = m.id
                 WHERE mi.user_id = ? AND DATE(mi.intake_datetime) = ?
                 ORDER BY mi.intake_datetime DESC'
            );
            $stmt->execute([$userId, $date]);
        } else {
            // Date range (default last 30 days)
            if (!$startDate) {
                $startDate = date('Y-m-d', strtotime('-30 days'));
            }
            if (!$endDate) {
                $endDate = date('Y-m-d');
            }

            $stmt = $db->prepare(
                'SELECT mi.id, mi.medication_id, mi.custom_medication_name, mi.intake_datetime, mi.dosage, mi.notes,
                        m.name as medication_name, m.type as medication_type, m.common_dosage
                 FROM medication_intakes mi
                 LEFT JOIN medications m ON mi.medication_id = m.id
                 WHERE mi.user_id = ? AND DATE(mi.intake_datetime) BETWEEN ? AND ?
                 ORDER BY mi.intake_datetime DESC'
            );
            $stmt->execute([$userId, $startDate, $endDate]);
        }

        $intakes = $stmt->fetchAll();

        // Set display name for each intake
        foreach ($intakes as &$intake) {
            $intake['display_name'] = $intake['medication_name'] ?? $intake['custom_medication_name'] ?? 'Inconnu';
        }

        return [
            'success' => true,
            'count' => count($intakes),
            'intakes' => $intakes,
        ];
    }

    /**
     * Delete a medication intake
     */
    public static function deleteMedicationIntake(string $userId, int $intakeId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'DELETE FROM medication_intakes WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([$intakeId, $userId]);

        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'error' => 'Prise non trouvée'];
        }

        return ['success' => true];
    }

    /**
     * Get health summary for a date range (for charts/analytics)
     */
    public static function getHealthSummary(string $userId, ?string $startDate = null, ?string $endDate = null): array
    {
        $db = Database::getInstance();

        // Default to last 14 days
        if (!$startDate) {
            $startDate = date('Y-m-d', strtotime('-14 days'));
        }
        if (!$endDate) {
            $endDate = date('Y-m-d');
        }

        // Get daily average severity
        $stmt = $db->prepare(
            'SELECT de.entry_date, 
                    AVG(sl.severity) as avg_severity,
                    MAX(sl.severity) as max_severity,
                    COUNT(sl.id) as symptom_count
             FROM daily_entries de
             LEFT JOIN symptom_logs sl ON de.id = sl.daily_entry_id
             WHERE de.user_id = ? AND de.entry_date BETWEEN ? AND ?
             GROUP BY de.entry_date
             ORDER BY de.entry_date'
        );
        $stmt->execute([$userId, $startDate, $endDate]);
        $dailyStats = $stmt->fetchAll();

        // Get medication counts per day
        $stmt = $db->prepare(
            'SELECT DATE(intake_datetime) as intake_date, COUNT(*) as intake_count
             FROM medication_intakes
             WHERE user_id = ? AND DATE(intake_datetime) BETWEEN ? AND ?
             GROUP BY DATE(intake_datetime)
             ORDER BY intake_date'
        );
        $stmt->execute([$userId, $startDate, $endDate]);
        $medicationStats = $stmt->fetchAll();

        // Index medication stats by date
        $medByDate = [];
        foreach ($medicationStats as $stat) {
            $medByDate[$stat['intake_date']] = (int)$stat['intake_count'];
        }

        // Build combined timeline
        $timeline = [];
        foreach ($dailyStats as $day) {
            $timeline[] = [
                'date' => $day['entry_date'],
                'avg_severity' => round((float)$day['avg_severity'], 1),
                'max_severity' => (int)$day['max_severity'],
                'symptom_count' => (int)$day['symptom_count'],
                'medication_count' => $medByDate[$day['entry_date']] ?? 0,
            ];
        }

        // Get most frequent symptoms
        $stmt = $db->prepare(
            'SELECT s.name, s.icon, COUNT(*) as occurrence, AVG(sl.severity) as avg_severity
             FROM symptom_logs sl
             JOIN symptoms s ON sl.symptom_id = s.id
             JOIN daily_entries de ON sl.daily_entry_id = de.id
             WHERE de.user_id = ? AND de.entry_date BETWEEN ? AND ?
             GROUP BY sl.symptom_id
             ORDER BY occurrence DESC
             LIMIT 5'
        );
        $stmt->execute([$userId, $startDate, $endDate]);
        $topSymptoms = $stmt->fetchAll();

        return [
            'success' => true,
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
            ],
            'timeline' => $timeline,
            'top_symptoms' => $topSymptoms,
        ];
    }
}
