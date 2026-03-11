-- ============================================================================
-- Atchoum! Migration 002: Health Log (Symptoms & Medications)
-- Run with: mysql -u root -p atchoum < 002_health_log.sql
-- ============================================================================

USE atchoum;

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
    FOREIGN KEY (symptom_id) REFERENCES symptoms(id) ON DELETE CASCADE
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

INSERT IGNORE INTO symptoms (name, category, icon, display_order) VALUES
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

INSERT IGNORE INTO medications (name, type, common_dosage, display_order) VALUES
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
SELECT 'Migration 002_health_log completed!' AS status;
