-- Atchoum! Database Schema
-- Run this on your MySQL server to create all required tables

CREATE DATABASE IF NOT EXISTS atchoum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE atchoum;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    consent_diagnostic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Authentication tokens (6-digit codes)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NULL,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    INDEX idx_email_expires (email, expires_at),
    INDEX idx_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limiting (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    action_type ENUM('request_code', 'validate_code') NOT NULL,
    attempts INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL,
    INDEX idx_email_action (email, action_type),
    INDEX idx_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User's saved cities
CREATE TABLE IF NOT EXISTS cities (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    insee_code VARCHAR(10) NOT NULL,
    city_name VARCHAR(255) NOT NULL,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_main (user_id, is_main),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User's alert configurations
CREATE TABLE IF NOT EXISTS alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    city_id BIGINT NOT NULL,
    pollen_type VARCHAR(20) NOT NULL DEFAULT 'global',
    threshold_level TINYINT DEFAULT 3,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_push BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_active (user_id, is_active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key VARCHAR(255),
    auth_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification logs (for tracking sent alerts)
CREATE TABLE IF NOT EXISTS notification_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_id BIGINT NULL,
    user_id CHAR(36) NOT NULL,
    trigger_level TINYINT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_sent (user_id, sent_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- App configuration (for VAPID keys, etc.)
CREATE TABLE IF NOT EXISTS app_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PHASE 2: Suivi Symptômes & Médicaments
-- ============================================================================

-- Catalogue des symptômes prédéfinis
CREATE TABLE IF NOT EXISTS symptoms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category ENUM('respiratoire', 'oculaire', 'cutane', 'general') NOT NULL,
    icon VARCHAR(50) NULL COMMENT 'Emoji ou nom d''icône pour l''UI',
    display_order TINYINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category_active (category, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catalogue des médicaments antihistaminiques
CREATE TABLE IF NOT EXISTS medications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('antihistaminique', 'corticoide', 'decongestionnant', 'autre') NOT NULL DEFAULT 'antihistaminique',
    common_dosage VARCHAR(50) NULL COMMENT 'Ex: 10mg, 5mg/5ml',
    display_order TINYINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type_active (type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Entrées quotidiennes (1 par jour par utilisateur)
CREATE TABLE IF NOT EXISTS daily_entries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    entry_date DATE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, entry_date),
    INDEX idx_user_date (user_id, entry_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logs des symptômes avec sévérité
CREATE TABLE IF NOT EXISTS symptom_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    daily_entry_id BIGINT NOT NULL,
    symptom_id BIGINT NOT NULL,
    severity TINYINT NOT NULL COMMENT 'Échelle 0-10',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_entry_symptom (daily_entry_id, symptom_id),
    INDEX idx_symptom (symptom_id),
    FOREIGN KEY (daily_entry_id) REFERENCES daily_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (symptom_id) REFERENCES symptoms(id) ON DELETE CASCADE,
    CONSTRAINT chk_severity CHECK (severity >= 0 AND severity <= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prises de médicaments
CREATE TABLE IF NOT EXISTS medication_intakes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    medication_id BIGINT NULL COMMENT 'NULL si médicament personnalisé',
    custom_medication_name VARCHAR(100) NULL COMMENT 'Si "Autre" sélectionné',
    intake_datetime DATETIME NOT NULL,
    dosage VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_datetime (user_id, intake_datetime),
    INDEX idx_medication (medication_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Données initiales: Catalogue de symptômes
-- ============================================================================

INSERT INTO symptoms (name, category, icon, display_order) VALUES
-- Respiratoires
('Éternuements', 'respiratoire', '🤧', 1),
('Nez qui coule', 'respiratoire', '💧', 2),
('Congestion nasale', 'respiratoire', '👃', 3),
('Toux', 'respiratoire', '😷', 4),
('Difficultés respiratoires', 'respiratoire', '😮‍💨', 5),
-- Oculaires
('Yeux qui grattent', 'oculaire', '👁️', 10),
('Yeux rouges', 'oculaire', '🔴', 11),
('Larmoiement', 'oculaire', '😢', 12),
('Paupières gonflées', 'oculaire', '🙈', 13),
-- Cutanés
('Démangeaisons cutanées', 'cutane', '🖐️', 20),
('Urticaire', 'cutane', '⚡', 21),
('Eczéma', 'cutane', '🩹', 22),
-- Généraux
('Fatigue', 'general', '😴', 30),
('Maux de tête', 'general', '🤕', 31),
('Troubles du sommeil', 'general', '😵', 32);

-- ============================================================================
-- Données initiales: Catalogue de médicaments
-- ============================================================================

INSERT INTO medications (name, type, common_dosage, display_order) VALUES
-- Antihistaminiques oraux (2ème génération - non sédatifs)
('Cétirizine (Zyrtec)', 'antihistaminique', '10mg', 1),
('Loratadine (Clarityne)', 'antihistaminique', '10mg', 2),
('Desloratadine (Aerius)', 'antihistaminique', '5mg', 3),
('Bilastine (Bilaska)', 'antihistaminique', '20mg', 4),
('Féxofénadine (Telfast)', 'antihistaminique', '180mg', 5),
('Lévocétirizine (Xyzall)', 'antihistaminique', '5mg', 6),
-- Antihistaminiques locaux
('Azélastine spray nasal (Allergodil)', 'antihistaminique', '1 pulvérisation', 10),
('Azélastine collyre', 'antihistaminique', '1 goutte', 11),
-- Corticoïdes nasaux
('Fluticasone spray (Flixonase)', 'corticoide', '2 pulvérisations', 20),
('Mométasone spray (Nasonex)', 'corticoide', '2 pulvérisations', 21),
('Béclométasone spray (Beconase)', 'corticoide', '2 pulvérisations', 22),
-- Décongestionnants
('Pseudoéphédrine (Actifed)', 'decongestionnant', '60mg', 30),
-- Autre
('Autre médicament', 'autre', NULL, 99);

-- Done!
SELECT 'Atchoum database created successfully!' AS status;
