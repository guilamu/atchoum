-- ============================================================================
-- PHASE 3: Mode Diagnostique - Corrélation symptômes / pollens
-- ============================================================================

-- Logs quotidiens de symptômes diagnostique (chiffrés AES-256-GCM)
CREATE TABLE IF NOT EXISTS diagnostic_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    log_date DATE NOT NULL,
    symptoms_encrypted TEXT NOT NULL COMMENT 'Symptômes chiffrés AES-256-GCM (base64)',
    total_score INT NOT NULL DEFAULT 0 COMMENT 'Score total non chiffré pour les corrélations',
    location_insee_code VARCHAR(10) NULL COMMENT 'Code INSEE de la ville principale au moment du log',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, log_date),
    INDEX idx_user_date (user_id, log_date),
    INDEX idx_date_insee (log_date, location_insee_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Résultats d'analyses diagnostiques
CREATE TABLE IF NOT EXISTS diagnostic_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    correlations_json JSON NOT NULL COMMENT 'Corrélations par pollen (coefficient, p_value, sample_size)',
    suspected_allergens JSON NOT NULL COMMENT 'Top 3 allergènes suspectés',
    confidence_score DECIMAL(5,1) NOT NULL DEFAULT 0 COMMENT 'Score de confiance 0-100',
    sample_size INT NOT NULL DEFAULT 0 COMMENT 'Nombre de jours analysés',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Phase 3 - Diagnostic tables created successfully!' AS status;
