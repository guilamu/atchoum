import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHealthLog, useHealthSummary } from '../hooks/useHealthLog';
import {
    SymptomsTimelineChart,
    SymptomsVsMedicationsChart,
    TopSymptomsChart,
    SeverityGauge,
} from '../components/HealthCharts';
import {
    useDiagnosticStatus,
    useDiagnosticResults,
    useDiagnosticTimeline,
} from '../hooks/useDiagnostic';
import {
    CorrelationChart,
    DiagnosticTimelineChart,
    CategoryBreakdownChart,
    ConfidenceGauge,
} from '../components/DiagnosticCharts';
import * as diagnosticApi from '../services/diagnosticApi';
import { getSettings } from '../services/storage';

// Symptom category config (LivePollen style)
const CATEGORY_CONFIG = {
    respiratoire: { label: 'Respiratoires', emoji: '👃', color: 'cat-respiratoire' },
    oculaire: { label: 'Oculaires', emoji: '👁️', color: 'cat-oculaire' },
    cutane: { label: 'Cutanés', emoji: '🖐️', color: 'cat-cutane' },
    general: { label: 'Généraux', emoji: '😴', color: 'cat-general' },
};

// Medication type labels
const MEDICATION_TYPE_LABELS = {
    antihistaminique: 'Antihistaminiques',
    corticoide: 'Corticoïdes',
    decongestionnant: 'Décongestionnants',
    autre: 'Autres',
};

// Severity badge helper
function getSeverityBadge(value) {
    if (value === 0) return { label: 'aucun', className: 'sev-none' };
    if (value <= 3) return { label: 'faible', className: 'sev-low' };
    if (value <= 6) return { label: 'modéré', className: 'sev-moderate' };
    if (value <= 8) return { label: 'fort', className: 'sev-high' };
    return { label: 'très fort', className: 'sev-extreme' };
}

// Severity color for slider thumb
function getSeverityColor(value) {
    if (value === 0) return '#CCCCCC';
    if (value <= 3) return '#2AAFA5';
    if (value <= 6) return '#F5A623';
    if (value <= 8) return '#E87A2E';
    return '#E74C3C';
}

function HealthLog() {
    const { isAuthenticated } = useAuth();
    const {
        symptoms,
        symptomsGrouped,
        medications,
        medicationsGrouped,
        selectedDate,
        dailyEntry,
        medicationIntakes,
        loadingCatalogs,
        loadingEntry,
        saving,
        error,
        isToday,
        changeDate,
        previousDay,
        nextDay,
        saveDailyEntry,
        addMedicationIntake,
        deleteMedicationIntake,
    } = useHealthLog();

    const [symptomValues, setSymptomValues] = useState({});
    const [notes, setNotes] = useState('');
    const [showMedicationModal, setShowMedicationModal] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Accordion state – all closed by default
    const [openSections, setOpenSections] = useState({
        symptoms: false,
        medications: false,
        statistics: false,
        diagnostic: false,
    });

    // Read settings for section visibility
    const [sectionVisibility, setSectionVisibility] = useState({
        symptoms: true,
        medications: true,
        statistics: true,
        diagnostic: true,
    });

    useEffect(() => {
        const settings = getSettings();
        if (settings.healthSections) {
            setSectionVisibility(settings.healthSections);
        }
    }, []);

    const toggleSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Initialize symptom values from daily entry
    useMemo(() => {
        if (dailyEntry?.symptoms) {
            const values = {};
            dailyEntry.symptoms.forEach(s => {
                values[s.symptom_id] = s.severity;
            });
            setSymptomValues(values);
            setNotes(dailyEntry.notes || '');
        } else {
            setSymptomValues({});
            setNotes('');
        }
    }, [dailyEntry]);

    const formatDateDisplay = (dateStr) => {
        const date = new Date(dateStr);
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        return date.toLocaleDateString('fr-FR', options);
    };

    const handleSymptomChange = (symptomId, value) => {
        setSymptomValues(prev => ({
            ...prev,
            [symptomId]: parseInt(value),
        }));
    };

    // Auto-activate diagnostic on save
    const { status: diagStatus, activate: diagActivate, refresh: refreshDiagStatus } = useDiagnosticStatus();

    const handleSave = async () => {
        const symptomsToSave = Object.entries(symptomValues)
            .filter(([_, severity]) => severity > 0)
            .map(([symptom_id, severity]) => ({
                symptom_id: parseInt(symptom_id),
                severity,
            }));

        const result = await saveDailyEntry({
            notes,
            symptoms: symptomsToSave,
        });

        if (result.success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);

            // Auto-activate diagnostic if not already active
            if (symptomsToSave.length > 0 && diagStatus && !diagStatus.consent_active) {
                try {
                    await diagActivate();
                    refreshDiagStatus();
                } catch (e) {
                    // Silently ignore activation errors
                }
            }
        }
    };

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div className="health-log-page animate-fade-in">
                <header className="app-header">
                    <div className="header-content">
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                            🩺 Journal de santé
                        </h1>
                    </div>
                </header>

                <main className="main-content" style={{ marginTop: '-30px' }}>
                    <div className="hl-section hl-login-card">
                        <div className="hl-login-icon">🔒</div>
                        <h2>Connexion requise</h2>
                        <p className="text-muted">
                            Connectez-vous pour accéder au suivi de vos symptômes et médicaments.
                        </p>
                        <Link to="/settings" className="btn btn-primary btn-lg">
                            Se connecter
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="health-log-page animate-fade-in">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        🩺 Journal de santé
                    </h1>
                    <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                        Suivi des symptômes et médicaments
                    </p>
                </div>
            </header>

            <main className="main-content" style={{ marginTop: '-30px' }}>
                {/* Date Navigation */}
                <div className="hl-date-nav">
                    <button className="nav-arrow" onClick={previousDay}>◀</button>
                    <div className="hl-date-center">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => changeDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                        />
                        <div className="hl-date-label">
                            {isToday ? "Aujourd'hui" : formatDateDisplay(selectedDate)}
                        </div>
                    </div>
                    <button className="nav-arrow" onClick={nextDay} disabled={isToday}>▶</button>
                </div>

                {/* Loading */}
                {(loadingCatalogs || loadingEntry) && (
                    <div className="hl-section hl-loading">
                        <div className="hl-loading-icon animate-pulse">⏳</div>
                        <p className="text-muted">Chargement...</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="hl-error">⚠️ {error}</div>
                )}

                {/* Content */}
                {!loadingCatalogs && !loadingEntry && (
                    <>
                        {/* ===== SYMPTOMS SECTION (Accordion) ===== */}
                        {sectionVisibility.symptoms !== false && (
                            <div className={`hl-section ${openSections.symptoms ? '' : 'collapsed'}`}>
                                <div className="hl-section-header" onClick={() => toggleSection('symptoms')}>
                                    <h2 className="hl-section-title">
                                        <span className="hl-section-icon orange">🤧</span>
                                        Symptômes du jour
                                    </h2>
                                    <span className={`hl-section-chevron ${openSections.symptoms ? 'open' : ''}`}>▼</span>
                                </div>
                                <div className="hl-section-body">
                                    {Object.entries(CATEGORY_CONFIG).map(([category, { label, emoji, color }]) => (
                                        <div key={category} className="hl-category">
                                            <h3 className={`hl-category-title ${color}`}>
                                                <span className="cat-dot" />
                                                {emoji} {label}
                                            </h3>
                                            {symptomsGrouped[category]?.map(symptom => {
                                                const val = symptomValues[symptom.id] || 0;
                                                const badge = getSeverityBadge(val);
                                                const thumbColor = getSeverityColor(val);
                                                return (
                                                    <div key={symptom.id} className="hl-symptom-row">
                                                        <div className="hl-symptom-info">
                                                            <span className="hl-symptom-icon">{symptom.icon}</span>
                                                            <span className="hl-symptom-name">{symptom.name}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="10"
                                                            value={val}
                                                            onChange={(e) => handleSymptomChange(symptom.id, e.target.value)}
                                                            className="hl-symptom-slider"
                                                            style={{ accentColor: thumbColor }}
                                                        />
                                                        <span className={`severity-badge ${badge.className}`}>
                                                            {badge.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}

                                    {/* Notes */}
                                    <div style={{ marginTop: 16 }}>
                                        <label className="hl-field-label">📝 Notes (optionnel)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Ex: Temps venteux, promenade en forêt..."
                                            rows={3}
                                            className="hl-notes"
                                        />
                                    </div>

                                    {/* Save button */}
                                    <button
                                        className={`hl-save-btn ${saveSuccess ? 'success' : ''}`}
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? '⏳ Enregistrement...' : saveSuccess ? '✅ Enregistré !' : '💾 Enregistrer mes symptômes'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ===== MEDICATIONS SECTION (Accordion) ===== */}
                        {sectionVisibility.medications !== false && (
                            <div className={`hl-section ${openSections.medications ? '' : 'collapsed'}`}>
                                <div className="hl-section-header" onClick={() => toggleSection('medications')}>
                                    <h2 className="hl-section-title">
                                        <span className="hl-section-icon teal">💊</span>
                                        Médicaments pris
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        {openSections.medications && (
                                            <button
                                                className="hl-add-btn"
                                                onClick={(e) => { e.stopPropagation(); setShowMedicationModal(true); }}
                                            >
                                                + Ajouter
                                            </button>
                                        )}
                                        <span className={`hl-section-chevron ${openSections.medications ? 'open' : ''}`}>▼</span>
                                    </div>
                                </div>
                                <div className="hl-section-body">
                                    {medicationIntakes.length === 0 ? (
                                        <div className="hl-empty">
                                            <div className="hl-empty-icon">💊</div>
                                            Aucun médicament enregistré ce jour
                                        </div>
                                    ) : (
                                        medicationIntakes.map(intake => (
                                            <div key={intake.id} className="hl-med-item">
                                                <div className="hl-med-info">
                                                    <div className="hl-med-pill">💊</div>
                                                    <div>
                                                        <div className="hl-med-name">{intake.display_name}</div>
                                                        <div className="hl-med-detail">
                                                            {new Date(intake.intake_datetime).toLocaleTimeString('fr-FR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                            {intake.dosage && ` · ${intake.dosage}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    className="hl-med-delete"
                                                    onClick={() => deleteMedicationIntake(intake.id)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ===== STATISTICS SECTION (Accordion) ===== */}
                        {sectionVisibility.statistics !== false && (
                            <HealthStatsSection
                                isOpen={openSections.statistics}
                                onToggle={() => toggleSection('statistics')}
                            />
                        )}

                        {/* ===== DIAGNOSTIC SECTION (Accordion) ===== */}
                        {sectionVisibility.diagnostic !== false && (
                            <DiagnosticSection
                                isOpen={openSections.diagnostic}
                                onToggle={() => toggleSection('diagnostic')}
                            />
                        )}
                    </>
                )}
            </main>

            {/* Medication Modal */}
            {showMedicationModal && (
                <MedicationModal
                    medications={medications}
                    medicationsGrouped={medicationsGrouped}
                    onAdd={addMedicationIntake}
                    onClose={() => setShowMedicationModal(false)}
                />
            )}
        </div>
    );
}

/**
 * Modal for adding medication intake — LivePollen style with pill chips
 */
function MedicationModal({ medications, medicationsGrouped, onAdd, onClose }) {
    const [selectedMedication, setSelectedMedication] = useState(null);
    const [customName, setCustomName] = useState('');
    const [dosage, setDosage] = useState('');
    const [time, setTime] = useState(
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedMedication && !customName) {
            return;
        }

        setSaving(true);
        setError(null);

        // Build datetime from selected time, using proper Date for UTC conversion
        const [hours, minutes] = time.split(':');
        const dt = new Date();
        dt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        const datetime = dt.toISOString();

        try {
            const result = await onAdd({
                medicationId: selectedMedication?.id || null,
                customName: selectedMedication ? null : customName,
                intakeDatetime: datetime,
                dosage: dosage || selectedMedication?.common_dosage || null,
            });

            setSaving(false);

            if (result.success) {
                onClose();
            } else {
                setError(result.error || 'Erreur lors de l\'enregistrement');
            }
        } catch (err) {
            console.error('Medication save error:', err);
            setError(err.message || 'Erreur réseau');
            setSaving(false);
        }
    };

    const isOther = selectedMedication?.name?.toLowerCase().includes('autre');

    const handleSelectMedication = (med) => {
        if (selectedMedication?.id === med.id) {
            setSelectedMedication(null);
            setDosage('');
        } else {
            setSelectedMedication(med);
            if (med.common_dosage) {
                setDosage(med.common_dosage);
            }
        }
    };

    return (
        <div className="hl-modal-overlay" onClick={onClose}>
            <div className="hl-modal-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="hl-modal-header">
                    <h2 className="hl-modal-title">
                        <span className="hl-section-icon teal">💊</span>
                        Ajouter une prise
                    </h2>
                    <button className="hl-modal-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Medication chips grouped by type */}
                    {Object.entries(MEDICATION_TYPE_LABELS).map(([type, label]) => {
                        const meds = medicationsGrouped[type];
                        if (!meds || meds.length === 0) return null;
                        return (
                            <div key={type}>
                                <div className="hl-med-group-label">{label}</div>
                                <div className="hl-med-grid">
                                    {meds.map(med => (
                                        <button
                                            key={med.id}
                                            type="button"
                                            className={`hl-med-chip ${selectedMedication?.id == med.id ? 'selected' : ''}`}
                                            onClick={() => handleSelectMedication(
                                                medications.find(m => m.id == med.id) || med
                                            )}
                                        >
                                            {med.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Custom name if "Autre" selected */}
                    {isOther && (
                        <div className="hl-field">
                            <label className="hl-field-label">Nom du médicament</label>
                            <input
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="Ex: Aerius, Xyzall..."
                                required
                                className="hl-field-input"
                            />
                        </div>
                    )}

                    {/* Dosage */}
                    <div className="hl-field">
                        <label className="hl-field-label">Dosage (optionnel)</label>
                        <input
                            type="text"
                            value={dosage}
                            onChange={(e) => setDosage(e.target.value)}
                            placeholder="Ex: 10mg, 2 comprimés..."
                            className="hl-field-input"
                        />
                    </div>

                    {/* Time */}
                    <div className="hl-field">
                        <label className="hl-field-label">Heure de prise</label>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="hl-field-input"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="hl-error" style={{ marginTop: 16 }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="hl-modal-submit"
                        disabled={saving || (!selectedMedication && !customName)}
                    >
                        {saving ? '⏳ Enregistrement...' : '✅ Enregistrer'}
                    </button>
                </form>
            </div>
        </div>
    );
}

/**
 * Health Statistics Section with Charts — LivePollen styling (Accordion)
 */
function HealthStatsSection({ isOpen, onToggle }) {
    const [period, setPeriod] = useState('14');
    const { summary, loading, error } = useHealthSummary(
        new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    const avgSeverity = useMemo(() => {
        if (!summary?.timeline || summary.timeline.length === 0) return 0;
        const total = summary.timeline.reduce((sum, d) => sum + (d.avg_severity || 0), 0);
        return total / summary.timeline.length;
    }, [summary]);

    return (
        <div className={`hl-section ${isOpen ? '' : 'collapsed'}`}>
            <div className="hl-section-header" onClick={onToggle}>
                <h2 className="hl-section-title">
                    <span className="hl-section-icon blue">📊</span>
                    Statistiques
                </h2>
                <div className="flex items-center gap-2">
                    {isOpen && (
                        <select
                            value={period}
                            onChange={(e) => { e.stopPropagation(); setPeriod(e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="hl-period-select"
                        >
                            <option value="7">7 jours</option>
                            <option value="14">14 jours</option>
                            <option value="30">30 jours</option>
                        </select>
                    )}
                    <span className={`hl-section-chevron ${isOpen ? 'open' : ''}`}>▼</span>
                </div>
            </div>
            <div className="hl-section-body">
                {loading && (
                    <div className="hl-loading">
                        <div className="hl-loading-icon animate-pulse">⏳</div>
                        <p className="text-muted">Chargement...</p>
                    </div>
                )}

                {error && (
                    <div className="hl-error">⚠️ {error}</div>
                )}

                {!loading && !error && summary && (
                    <>
                        {/* Summary mini-cards */}
                        <div className="hl-stats-grid">
                            <div className="hl-stat-card orange">
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                                    <SeverityGauge value={avgSeverity} size={70} />
                                </div>
                                <div className="hl-stat-label">Sévérité moyenne</div>
                            </div>
                            <div className="hl-stat-card teal">
                                <div className="hl-stat-value" style={{ color: '#2AAFA5' }}>
                                    {summary.timeline?.length || 0}
                                </div>
                                <div className="hl-stat-label">Jours enregistrés</div>
                            </div>
                        </div>

                        {/* Timeline chart */}
                        <div style={{ marginBottom: 24 }}>
                            <h3 className="hl-chart-title">📈 Évolution de la sévérité</h3>
                            <SymptomsTimelineChart timeline={summary.timeline} height={200} />
                        </div>

                        {/* Symptoms vs Medications chart */}
                        <div style={{ marginBottom: 24 }}>
                            <h3 className="hl-chart-title">💊 Symptômes vs Médicaments</h3>
                            <SymptomsVsMedicationsChart timeline={summary.timeline} height={180} />
                        </div>

                        {/* Top symptoms */}
                        {summary.top_symptoms && summary.top_symptoms.length > 0 && (
                            <div>
                                <h3 className="hl-chart-title">🔥 Symptômes les plus fréquents</h3>
                                <TopSymptomsChart topSymptoms={summary.top_symptoms} height={150} />
                            </div>
                        )}
                    </>
                )}

                {!loading && !error && (!summary?.timeline || summary.timeline.length === 0) && (
                    <div className="hl-empty">
                        <div className="hl-empty-icon">📊</div>
                        Commencez à enregistrer vos symptômes pour voir les statistiques
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Diagnostic Section — embedded in Health tab as an accordion
 * Available from first symptom, results refine with more data.
 */
function DiagnosticSection({ isOpen, onToggle }) {
    const { status, loading: statusLoading, refresh: refreshStatus } = useDiagnosticStatus();
    const { results, currentResult, loading: resultsLoading, analyzing, error: resultsError, runAnalysis, loadResult } = useDiagnosticResults();
    const [timelineDays, setTimelineDays] = useState(30);
    const { timeline, loading: timelineLoading, error: timelineError } = useDiagnosticTimeline(timelineDays);
    const [activeSubTab, setActiveSubTab] = useState('results');

    const handleAnalyze = async () => {
        const result = await runAnalysis();
        if (result.success) {
            refreshStatus();
        } else {
            alert(result.error || 'Erreur lors de l\'analyse');
        }
    };

    return (
        <div className={`hl-section ${isOpen ? '' : 'collapsed'}`}>
            <div className="hl-section-header" onClick={onToggle}>
                <h2 className="hl-section-title">
                    <span className="hl-section-icon purple">🔬</span>
                    Diagnostic
                </h2>
                <span className={`hl-section-chevron ${isOpen ? 'open' : ''}`}>▼</span>
            </div>
            <div className="hl-section-body">
                {statusLoading && (
                    <div className="hl-loading">
                        <div className="hl-loading-icon animate-pulse">⏳</div>
                        <p className="text-muted">Chargement...</p>
                    </div>
                )}

                {!statusLoading && (
                    <>
                        {/* Disclaimer */}
                        <div className="alert-banner mb-4" style={{
                            background: 'rgba(245,158,11,0.1)',
                            borderLeft: '3px solid #f59e0b',
                        }}>
                            <span className="alert-icon">⚠️</span>
                            <div className="alert-text" style={{ fontSize: '0.8rem' }}>
                                <strong>Résultats indicatifs</strong> — Consultez un allergologue pour un diagnostic médical fiable.
                            </div>
                        </div>

                        {/* Status summary */}
                        {status && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                gap: 12,
                                textAlign: 'center',
                                marginBottom: 16,
                            }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                                        {status.log_count || 0}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        jours saisis
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>
                                        {status.result_count || 0}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        analyses
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status?.can_analyze ? '#22c55e' : '#f59e0b' }}>
                                        {status?.can_analyze ? '✓' : `${status?.days_until_analysis || '?'}j`}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        {status?.can_analyze ? 'Prêt' : 'restants'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sub-tab navigation */}
                        <div style={{
                            display: 'flex',
                            borderBottom: '2px solid #f1f5f9',
                            marginBottom: 16,
                        }}>
                            {[
                                { key: 'results', label: '📊 Résultats' },
                                { key: 'timeline', label: '📈 Timeline' },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveSubTab(tab.key)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 8px',
                                        border: 'none',
                                        background: activeSubTab === tab.key
                                            ? 'linear-gradient(135deg, rgba(253,187,45,0.1), rgba(178,31,31,0.1))'
                                            : 'transparent',
                                        borderBottom: activeSubTab === tab.key
                                            ? '3px solid #b21f1f'
                                            : '3px solid transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: activeSubTab === tab.key ? 600 : 400,
                                        color: activeSubTab === tab.key ? '#b21f1f' : 'var(--color-text-muted)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Results sub-tab */}
                        {activeSubTab === 'results' && (
                            <div>
                                {/* Run analysis button */}
                                <button
                                    className="btn btn-primary w-full mb-4"
                                    onClick={handleAnalyze}
                                    disabled={analyzing || !status?.can_analyze}
                                    style={{
                                        background: status?.can_analyze
                                            ? 'linear-gradient(135deg, #667eea, #764ba2)'
                                            : '#e2e8f0',
                                        opacity: analyzing ? 0.7 : 1,
                                    }}
                                >
                                    {analyzing ? '⏳ Analyse en cours...' : '🧪 Lancer une analyse'}
                                </button>

                                {!status?.can_analyze && (
                                    <p className="text-sm text-muted text-center mb-4">
                                        ⚠️ Saisissez encore {status?.days_until_analysis || '?'} jour(s) de symptômes pour pouvoir analyser.
                                    </p>
                                )}

                                {resultsError && (
                                    <div className="alert-banner alert-warning mb-4">
                                        <span className="alert-icon">⚠️</span>
                                        <div className="alert-text">{resultsError}</div>
                                    </div>
                                )}

                                {/* Current result */}
                                {currentResult && (
                                    <div className="animate-slide-up">
                                        {/* Confidence gauge */}
                                        <div style={{ marginBottom: 20 }}>
                                            <ConfidenceGauge score={currentResult.confidence_score} size={140} />
                                        </div>

                                        {/* Analysis period info */}
                                        <div className="text-sm text-muted text-center mb-4">
                                            Période: {formatDate(currentResult.period_start || currentResult.analysis_period_start)} → {formatDate(currentResult.period_end || currentResult.analysis_period_end)}
                                            &nbsp;• {currentResult.sample_size} jours analysés
                                        </div>

                                        {/* Suspected allergens */}
                                        {currentResult.suspected_allergens && currentResult.suspected_allergens.length > 0 && (
                                            <div style={{ marginBottom: 20 }}>
                                                <h4 style={{ fontSize: '0.9rem', marginBottom: 12 }}>🎯 Allergènes suspectés</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {currentResult.suspected_allergens.map((allergen, idx) => {
                                                        const corr = currentResult.correlations?.[allergen];
                                                        return (
                                                            <AllergenCard
                                                                key={allergen}
                                                                name={corr?.label || allergen}
                                                                emoji={corr?.emoji || '🌿'}
                                                                rank={idx + 1}
                                                                coefficient={corr?.coefficient}
                                                                pValue={corr?.p_value}
                                                                method={corr?.method}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {currentResult.suspected_allergens?.length === 0 && (
                                            <div className="text-center text-muted mb-4" style={{ padding: 20 }}>
                                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🤷</div>
                                                <p>Aucun allergène suspect détecté avec les données actuelles.</p>
                                                <p style={{ fontSize: '0.8rem' }}>
                                                    Continuez à saisir vos symptômes pour affiner l'analyse.
                                                </p>
                                            </div>
                                        )}

                                        {/* Correlation chart */}
                                        {currentResult.correlations && Object.keys(currentResult.correlations).length > 0 && (
                                            <div style={{ marginBottom: 20 }}>
                                                <h4 style={{ fontSize: '0.9rem', marginBottom: 12 }}>📊 Détails des corrélations</h4>
                                                <CorrelationChart correlations={currentResult.correlations} height={200} />
                                            </div>
                                        )}

                                        {/* Next steps */}
                                        <div style={{
                                            background: 'rgba(34,197,94,0.1)',
                                            borderRadius: 12,
                                            padding: 16,
                                            marginTop: 16,
                                        }}>
                                            <h4 style={{ fontSize: '0.9rem', marginBottom: 8 }}>🩺 Prochaines étapes</h4>
                                            <ol style={{ fontSize: '0.8rem', paddingLeft: 18, lineHeight: 2 }}>
                                                <li>Prenez rendez-vous avec un allergologue</li>
                                                <li>Montrez-lui ces résultats lors de la consultation</li>
                                                <li>Discutez de tests allergiques (Prick test, IgE spécifiques)</li>
                                                <li>Suivez les recommandations médicales</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}

                                {/* Results history */}
                                {results.length > 1 && (
                                    <div style={{ marginTop: 20 }}>
                                        <h4 style={{ fontSize: '0.9rem', marginBottom: 12 }}>📋 Historique des analyses</h4>
                                        {results.map(result => (
                                            <button
                                                key={result.id}
                                                onClick={() => loadResult(result.id)}
                                                className="w-full"
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '10px 12px',
                                                    marginBottom: 6,
                                                    border: currentResult?.id === result.id ? '2px solid #b21f1f' : '1px solid #e2e8f0',
                                                    borderRadius: 8,
                                                    background: currentResult?.id === result.id ? 'rgba(178,31,31,0.05)' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                                        {formatDate(result.analysis_period_start)} → {formatDate(result.analysis_period_end)}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                        {result.sample_size} jours • {(result.suspected_allergens || []).length} allergène(s) suspecté(s)
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    color: result.confidence_score >= 70 ? '#22c55e' : result.confidence_score >= 40 ? '#f59e0b' : '#ef4444',
                                                }}>
                                                    {result.confidence_score.toFixed(0)}%
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timeline sub-tab */}
                        {activeSubTab === 'timeline' && (
                            <div>
                                {/* Period selector */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                    {[
                                        { value: 14, label: '2 sem.' },
                                        { value: 30, label: '1 mois' },
                                        { value: 60, label: '2 mois' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setTimelineDays(opt.value)}
                                            className={`btn btn-sm ${timelineDays === opt.value ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{
                                                flex: 1,
                                                fontSize: '0.8rem',
                                                padding: '6px',
                                                background: timelineDays === opt.value
                                                    ? 'linear-gradient(135deg, #fdbb2d, #b21f1f)'
                                                    : 'transparent',
                                                color: timelineDays === opt.value ? 'white' : 'inherit',
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {timelineLoading && (
                                    <div className="text-center animate-pulse" style={{ padding: 20 }}>Chargement...</div>
                                )}

                                {timelineError && (
                                    <div className="alert-banner alert-warning">
                                        <span className="alert-icon">⚠️</span>
                                        <div className="alert-text">{timelineError}</div>
                                    </div>
                                )}

                                {!timelineLoading && !timelineError && timeline.length === 0 && (
                                    <div className="text-center text-muted" style={{ padding: 40 }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📈</div>
                                        <p>Pas encore de données pour la timeline.</p>
                                        <p style={{ fontSize: '0.8rem' }}>
                                            Saisissez vos symptômes pendant quelques jours.
                                        </p>
                                    </div>
                                )}

                                {!timelineLoading && !timelineError && timeline.length > 0 && (
                                    <>
                                        <div style={{ marginBottom: 20 }}>
                                            <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Symptômes vs Pollens</h4>
                                            <DiagnosticTimelineChart timeline={timeline} height={280} />
                                        </div>

                                        <div>
                                            <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Répartition par catégorie</h4>
                                            <CategoryBreakdownChart timeline={timeline} height={200} />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Data management */}
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                            <button
                                className="btn btn-secondary w-full"
                                onClick={async () => {
                                    if (confirm('⚠️ Supprimer TOUTES vos données diagnostiques ? Cette action est irréversible.')) {
                                        await diagnosticApi.deleteAllData();
                                        refreshStatus();
                                        alert('Données supprimées.');
                                    }
                                }}
                                style={{ color: '#ef4444', fontSize: '0.85rem' }}
                            >
                                🗑️ Supprimer mes données diagnostiques
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Allergen card component
 */
function AllergenCard({ name, emoji, rank, coefficient, pValue, method }) {
    const getStrength = (coeff) => {
        if (coeff >= 0.7) return { label: 'Forte', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
        if (coeff >= 0.5) return { label: 'Modérée', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
        return { label: 'Faible', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
    };

    const isExposure = method === 'exposure';
    const strength = getStrength(coefficient || 0);
    const medals = ['🥇', '🥈', '🥉'];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            background: strength.bg,
            borderRadius: 10,
            border: `1px solid ${strength.color}33`,
        }}>
            <span style={{ fontSize: '1.5rem' }}>{medals[rank - 1] || '•'}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {emoji} {name}
                    {isExposure && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: 6 }}>📊 hypothèse</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {isExposure ? 'Exposition' : 'Corrélation'}: {((coefficient || 0) * 100).toFixed(1)}%
                    {pValue != null && (
                        <span> • p={pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}</span>
                    )}
                </div>
            </div>
            <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: strength.color,
                background: `${strength.color}15`,
                padding: '2px 8px',
                borderRadius: 12,
            }}>
                {strength.label}
            </span>
        </div>
    );
}

// ==========================================
// UTILS
// ==========================================

function formatDate(dateStr) {
    if (!dateStr) return '?';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default HealthLog;
