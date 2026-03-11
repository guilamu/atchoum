import { useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

// ==========================================
// MAIN DIAGNOSTIC PAGE
// ==========================================

function DiagnosticPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'results';
    const { status, loading: statusLoading, activate, deactivate, refresh: refreshStatus } = useDiagnosticStatus();

    const setTab = (tab) => {
        setSearchParams({ tab });
    };

    // Loading
    if (statusLoading) {
        return (
            <div className="animate-fade-in">
                <DiagnosticHeader />
                <main className="main-content" style={{ marginTop: '-30px' }}>
                    <div className="card card-elevated text-center animate-pulse" style={{ padding: 40 }}>
                        Chargement...
                    </div>
                </main>
            </div>
        );
    }

    // Consent not given - show activation screen
    if (!status?.consent_active) {
        return <ConsentScreen onActivate={activate} />;
    }

    return (
        <div className="animate-fade-in">
            <DiagnosticHeader />

            <main className="main-content" style={{ marginTop: '-30px' }}>
                {/* Status summary card */}
                <StatusCard status={status} />

                {/* Link to Health page for symptom entry */}
                <Link
                    to="/health"
                    className="card mt-4"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))',
                        border: '1px solid rgba(59,130,246,0.2)',
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>💊</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            Saisir mes symptômes
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Rendez-vous dans l'onglet Santé pour enregistrer vos symptômes quotidiens
                        </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>→</span>
                </Link>

                {/* Tab navigation */}
                <div className="card mt-4" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        display: 'flex',
                        borderBottom: '2px solid #f1f5f9',
                    }}>
                        {[
                            { key: 'results', label: '📊 Résultats', icon: '' },
                            { key: 'timeline', label: '📈 Timeline', icon: '' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setTab(tab.key)}
                                style={{
                                    flex: 1,
                                    padding: '12px 8px',
                                    border: 'none',
                                    background: activeTab === tab.key
                                        ? 'linear-gradient(135deg, rgba(253,187,45,0.1), rgba(178,31,31,0.1))'
                                        : 'transparent',
                                    borderBottom: activeTab === tab.key
                                        ? '3px solid #b21f1f'
                                        : '3px solid transparent',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: activeTab === tab.key ? 600 : 400,
                                    color: activeTab === tab.key ? '#b21f1f' : 'var(--color-text-muted)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: 16 }}>
                        {activeTab === 'results' && <ResultsTab status={status} refreshStatus={refreshStatus} />}
                        {activeTab === 'timeline' && <TimelineTab />}
                    </div>
                </div>

                {/* RGPD actions */}
                <div className="card mt-4">
                    <h3 className="card-title mb-4" style={{ fontSize: '0.9rem' }}>⚙️ Gestion du mode diagnostique</h3>

                    <button
                        className="btn btn-secondary w-full"
                        onClick={async () => {
                            if (confirm('Voulez-vous désactiver le mode diagnostique ? Vos données seront conservées.')) {
                                await deactivate();
                            }
                        }}
                        style={{ marginBottom: 8 }}
                    >
                        ⏸️ Désactiver le mode diagnostique
                    </button>

                    <button
                        className="btn btn-secondary w-full"
                        onClick={async () => {
                            if (confirm('⚠️ Supprimer TOUTES vos données diagnostiques ? Cette action est irréversible.')) {
                                await diagnosticApi.deleteAllData();
                                refreshStatus();
                                alert('Données supprimées.');
                            }
                        }}
                        style={{ color: '#ef4444' }}
                    >
                        🗑️ Supprimer mes données diagnostiques
                    </button>
                </div>

                <div style={{ height: 24 }} />
            </main>
        </div>
    );
}

// ==========================================
// HEADER
// ==========================================

function DiagnosticHeader() {
    return (
        <header className="app-header">
            <div className="header-content">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                            🔬 Diagnostique
                        </h1>
                        <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                            Corrélation symptômes & pollens
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}

// ==========================================
// CONSENT SCREEN (RGPD)
// ==========================================

function ConsentScreen({ onActivate }) {
    const [consents, setConsents] = useState({
        privacy: false,
        analysis: false,
        indicative: false,
        allergist: false,
    });

    const allChecked = Object.values(consents).every(Boolean);

    const handleActivate = async () => {
        const result = await onActivate();
        if (!result.success) {
            alert(result.error || 'Erreur lors de l\'activation');
        }
    };

    return (
        <div className="animate-fade-in">
            <DiagnosticHeader />
            <main className="main-content" style={{ marginTop: '-30px' }}>
                <div className="card card-elevated">
                    <div className="alert-banner alert-warning mb-4">
                        <span className="alert-icon">⚠️</span>
                        <div className="alert-text">
                            <strong>AVERTISSEMENT IMPORTANT</strong>
                            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                                Cette fonctionnalité est un outil d'aide à l'identification,{' '}
                                <strong>PAS un diagnostic médical</strong>. Seul un allergologue peut
                                confirmer une allergie via des tests médicaux appropriés.
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>📋 Comment ça fonctionne</h3>
                        <ul style={{ fontSize: '0.85rem', paddingLeft: 20, lineHeight: 1.8 }}>
                            <li>Saisissez vos symptômes quotidiens dans l'onglet <strong>Santé</strong></li>
                            <li>Le diagnostique analyse la corrélation avec les niveaux de pollens</li>
                            <li>Après 14 jours de données, lancez une analyse automatique</li>
                            <li>Les résultats identifient les pollens les plus corrélés à vos symptômes</li>
                        </ul>

                        <h3 style={{ fontSize: '1rem', marginTop: 16, marginBottom: 12 }}>🔒 Vos droits</h3>
                        <ul style={{ fontSize: '0.85rem', paddingLeft: 20, lineHeight: 1.8 }}>
                            <li>Vos données de santé restent sur votre compte</li>
                            <li>Vous pouvez supprimer les résultats d'analyse à tout moment</li>
                            <li>Aucun partage avec des tiers</li>
                        </ul>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                            { key: 'privacy', label: 'J\'ai lu la politique de confidentialité' },
                            { key: 'analysis', label: 'J\'accepte que mes données de santé soient analysées pour identifier des corrélations' },
                            { key: 'indicative', label: 'Je comprends que les résultats sont indicatifs, pas un diagnostic' },
                            { key: 'allergist', label: 'Je consulterai un allergologue pour confirmer les résultats' },
                        ].map(item => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={consents[item.key]}
                                    onChange={(e) => setConsents({ ...consents, [item.key]: e.target.checked })}
                                    style={{ marginTop: 2, accentColor: '#b21f1f' }}
                                />
                                <span>{item.label}</span>
                            </label>
                        ))}
                    </div>

                    <button
                        className="btn btn-primary w-full mt-4"
                        disabled={!allChecked}
                        onClick={handleActivate}
                        style={{
                            opacity: allChecked ? 1 : 0.5,
                            background: allChecked
                                ? 'linear-gradient(135deg, #fdbb2d, #b21f1f)'
                                : '#e2e8f0',
                        }}
                    >
                        🔬 Activer le mode diagnostique
                    </button>
                </div>
            </main>
        </div>
    );
}

// ==========================================
// STATUS CARD
// ==========================================

function StatusCard({ status }) {
    return (
        <div className="card card-elevated">
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                textAlign: 'center',
            }}>
                <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                        {status.log_count}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        jours saisis
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>
                        {status.result_count}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        analyses
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status.can_analyze ? '#22c55e' : '#f59e0b' }}>
                        {status.can_analyze ? '✓' : `${status.days_until_analysis}j`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {status.can_analyze ? 'Prêt' : 'restants'}
                    </div>
                </div>
            </div>

            {!status.can_analyze && (
                <div className="alert-banner mt-3" style={{ background: 'rgba(245,158,11,0.1)', borderLeft: '3px solid #f59e0b' }}>
                    <span className="alert-icon">📝</span>
                    <div className="alert-text" style={{ fontSize: '0.8rem' }}>
                        Saisissez vos symptômes dans l'<Link to="/health" style={{ color: '#3b82f6', fontWeight: 600 }}>onglet Santé</Link> pendant
                        encore <strong>{status.days_until_analysis} jour(s)</strong> pour
                        pouvoir lancer une analyse de corrélation.
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// RESULTS TAB
// ==========================================

function ResultsTab({ status, refreshStatus }) {
    const { results, currentResult, loading, analyzing, error, runAnalysis, loadResult } = useDiagnosticResults();

    const handleAnalyze = async () => {
        const result = await runAnalysis();
        if (result.success) {
            refreshStatus();
        } else {
            alert(result.error || 'Erreur lors de l\'analyse');
        }
    };

    if (loading) {
        return <div className="text-center animate-pulse" style={{ padding: 20 }}>Chargement...</div>;
    }

    return (
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
                    ⚠️ Saisissez encore {status?.days_until_analysis || '?'} jour(s) de symptômes dans l'<Link to="/health" style={{ color: '#3b82f6' }}>onglet Santé</Link> pour pouvoir analyser.
                </p>
            )}

            {error && (
                <div className="alert-banner alert-warning mb-4">
                    <span className="alert-icon">⚠️</span>
                    <div className="alert-text">{error}</div>
                </div>
            )}

            {/* Current result */}
            {currentResult && (
                <div className="animate-slide-up">
                    {/* Disclaimer */}
                    <div className="alert-banner mb-4" style={{
                        background: 'rgba(245,158,11,0.1)',
                        borderLeft: '3px solid #f59e0b',
                    }}>
                        <span className="alert-icon">⚠️</span>
                        <div className="alert-text" style={{ fontSize: '0.8rem' }}>
                            <strong>Ces résultats sont indicatifs</strong>
                            <div>Consultez un allergologue pour un diagnostic médical fiable.</div>
                        </div>
                    </div>

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
                                Continuez à saisir vos symptômes dans l'<Link to="/health" style={{ color: '#3b82f6' }}>onglet Santé</Link> pour affiner l'analyse.
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
    );
}

/**
 * Allergen card component
 */
function AllergenCard({ name, emoji, rank, coefficient, pValue }) {
    const getStrength = (coeff) => {
        if (coeff >= 0.7) return { label: 'Forte', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
        if (coeff >= 0.5) return { label: 'Modérée', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
        return { label: 'Faible', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
    };

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
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Corrélation: {((coefficient || 0) * 100).toFixed(1)}%
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
// TIMELINE TAB
// ==========================================

function TimelineTab() {
    const [days, setDays] = useState(30);
    const { timeline, loading, error, refresh } = useDiagnosticTimeline(days);

    if (loading) {
        return <div className="text-center animate-pulse" style={{ padding: 20 }}>Chargement...</div>;
    }

    if (error) {
        return (
            <div className="alert-banner alert-warning">
                <span className="alert-icon">⚠️</span>
                <div className="alert-text">{error}</div>
            </div>
        );
    }

    if (timeline.length === 0) {
        return (
            <div className="text-center text-muted" style={{ padding: 40 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📈</div>
                <p>Pas encore de données pour la timeline.</p>
                <p style={{ fontSize: '0.8rem' }}>
                    <Link to="/health" style={{ color: '#3b82f6' }}>Saisissez vos symptômes</Link> dans l'onglet Santé pendant quelques jours.
                </p>
            </div>
        );
    }

    return (
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
                        onClick={() => setDays(opt.value)}
                        className={`btn btn-sm ${days === opt.value ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                            flex: 1,
                            fontSize: '0.8rem',
                            padding: '6px',
                            background: days === opt.value
                                ? 'linear-gradient(135deg, #fdbb2d, #b21f1f)'
                                : 'transparent',
                            color: days === opt.value ? 'white' : 'inherit',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Main timeline chart */}
            <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Symptômes vs Pollens</h4>
                <DiagnosticTimelineChart timeline={timeline} height={280} />
            </div>

            {/* Category breakdown */}
            <div>
                <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Répartition par catégorie</h4>
                <CategoryBreakdownChart timeline={timeline} height={200} />
            </div>
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

export default DiagnosticPage;
