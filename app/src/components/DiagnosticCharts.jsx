import { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Pollen colors (consistent with dashboard)
const POLLEN_COLORS = {
    'Aulne': '#8B4513',
    'Bouleau': '#228B22',
    'Olivier': '#6B8E23',
    'Graminées': '#DAA520',
    'Armoise': '#2E8B57',
    'Ambroisie': '#CD853F',
};

/**
 * Correlation bar chart - horizontal bars showing correlation coefficients
 */
export function CorrelationChart({ correlations, height = 250 }) {
    const data = useMemo(() => {
        if (!correlations || Object.keys(correlations).length === 0) return null;

        const entries = Object.values(correlations).sort(
            (a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)
        );

        return {
            labels: entries.map(c => `${c.emoji || ''} ${c.label}`),
            datasets: [
                {
                    label: 'Corrélation',
                    data: entries.map(c => c.coefficient),
                    backgroundColor: entries.map(c =>
                        c.coefficient > 0.5 ? 'rgba(220, 38, 38, 0.7)' :
                        c.coefficient > 0.3 ? 'rgba(245, 158, 11, 0.7)' :
                        c.coefficient > 0 ? 'rgba(34, 197, 94, 0.7)' :
                        'rgba(107, 114, 128, 0.5)'
                    ),
                    borderColor: entries.map(c =>
                        c.coefficient > 0.5 ? '#DC2626' :
                        c.coefficient > 0.3 ? '#F59E0B' :
                        c.coefficient > 0 ? '#22C55E' :
                        '#6B7280'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };
    }, [correlations]);

    const options = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const corr = Object.values(correlations)[ctx.dataIndex];
                        return [
                            `Corrélation: ${(ctx.raw * 100).toFixed(1)}%`,
                            `p-value: ${corr?.p_value ?? 'N/A'}`,
                            `Échantillon: ${corr?.sample_size ?? 'N/A'} jours`,
                        ];
                    },
                },
            },
        },
        scales: {
            x: {
                min: -1,
                max: 1,
                ticks: {
                    callback: (val) => `${(val * 100).toFixed(0)}%`,
                    font: { size: 11 },
                },
                grid: {
                    color: 'rgba(0,0,0,0.05)',
                },
            },
            y: {
                ticks: {
                    font: { size: 12 },
                },
                grid: { display: false },
            },
        },
    };

    if (!data) {
        return (
            <div className="text-center text-muted" style={{ padding: 20 }}>
                Aucune corrélation significative détectée
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <Bar data={data} options={options} />
        </div>
    );
}

/**
 * Timeline chart showing symptom scores and pollen levels over time
 */
export function DiagnosticTimelineChart({ timeline, height = 300 }) {
    const data = useMemo(() => {
        if (!timeline || timeline.length === 0) return null;

        // Collect all pollen types that appear
        const pollenTypes = new Set();
        timeline.forEach(t => {
            Object.keys(t.pollen_levels || {}).forEach(k => pollenTypes.add(k));
        });

        const datasets = [
            {
                label: 'Score symptômes',
                data: timeline.map(t => t.total_score),
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                yAxisID: 'y',
                order: 0,
            },
        ];

        // Add pollen datasets
        [...pollenTypes].forEach(pollenName => {
            datasets.push({
                label: pollenName,
                data: timeline.map(t => (t.pollen_levels || {})[pollenName] || 0),
                borderColor: POLLEN_COLORS[pollenName] || '#999',
                backgroundColor: 'transparent',
                borderDash: [4, 4],
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
                yAxisID: 'y1',
                order: 1,
            });
        });

        return {
            labels: timeline.map(t => {
                const date = new Date(t.date);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }),
            datasets,
        };
    }, [timeline]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 8,
                    font: { size: 10 },
                },
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            x: {
                ticks: {
                    font: { size: 10 },
                    maxRotation: 45,
                },
                grid: { display: false },
            },
            y: {
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Score symptômes',
                    font: { size: 11 },
                },
                ticks: { font: { size: 10 } },
                grid: { color: 'rgba(0,0,0,0.05)' },
            },
            y1: {
                type: 'linear',
                position: 'right',
                title: {
                    display: true,
                    text: 'Niveau pollen',
                    font: { size: 11 },
                },
                min: 0,
                max: 6,
                ticks: { font: { size: 10 }, stepSize: 1 },
                grid: { drawOnChartArea: false },
            },
        },
    };

    if (!data) {
        return (
            <div className="text-center text-muted" style={{ padding: 20 }}>
                Pas encore de données de timeline
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <Line data={data} options={options} />
        </div>
    );
}

/**
 * Category breakdown bar chart
 */
export function CategoryBreakdownChart({ timeline, height = 200 }) {
    const data = useMemo(() => {
        if (!timeline || timeline.length === 0) return null;

        const categoryLabels = {
            respiratoire: '🫁 Respiratoire',
            oculaire: '👁️ Oculaire',
            cutane: '🤚 Cutané',
            general: '😴 Général',
        };

        const categories = Object.keys(categoryLabels);
        const categoryColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];

        return {
            labels: timeline.map(t => {
                const date = new Date(t.date);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }),
            datasets: categories.map((cat, idx) => ({
                label: categoryLabels[cat],
                data: timeline.map(t => (t.category_scores || {})[cat] || 0),
                backgroundColor: categoryColors[idx] + '99',
                borderColor: categoryColors[idx],
                borderWidth: 1,
                borderRadius: 2,
            })),
        };
    }, [timeline]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 8, font: { size: 10 } },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { font: { size: 10 }, maxRotation: 45 },
                grid: { display: false },
            },
            y: {
                stacked: true,
                ticks: { font: { size: 10 } },
                grid: { color: 'rgba(0,0,0,0.05)' },
            },
        },
    };

    if (!data) return null;

    return (
        <div style={{ height }}>
            <Bar data={data} options={options} />
        </div>
    );
}

/**
 * Confidence score gauge (reuses CircularIndicator style)
 */
export function ConfidenceGauge({ score, size = 150 }) {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const normalizedScore = Math.min(100, Math.max(0, score));
    const progress = (normalizedScore / 100) * circumference;

    const getColor = (s) => {
        if (s >= 70) return '#22C55E';
        if (s >= 40) return '#F59E0B';
        return '#EF4444';
    };

    const getLabel = (s) => {
        if (s >= 70) return 'Élevé';
        if (s >= 40) return 'Modéré';
        if (s > 0) return 'Faible';
        return 'Insuffisant';
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="10"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={getColor(normalizedScore)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                />
                {/* Score text */}
                <text
                    x={size / 2}
                    y={size / 2 - 8}
                    textAnchor="middle"
                    fontSize="28"
                    fontWeight="700"
                    fill="var(--color-text)"
                >
                    {normalizedScore.toFixed(0)}%
                </text>
                <text
                    x={size / 2}
                    y={size / 2 + 16}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--color-text-muted)"
                >
                    {getLabel(normalizedScore)}
                </text>
            </svg>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Score de confiance
            </div>
        </div>
    );
}

/**
 * History heatmap - shows logged days with intensity
 */
export function LogHeatmap({ history, days = 60 }) {
    const cells = useMemo(() => {
        const logsByDate = {};
        (history || []).forEach(h => {
            logsByDate[h.log_date] = h.total_score;
        });

        const result = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const score = logsByDate[dateStr];

            result.push({
                date: dateStr,
                score: score ?? null,
                hasLog: score !== undefined && score !== null,
                dayLabel: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
                dateLabel: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
            });
        }

        return result;
    }, [history, days]);

    const getColor = (score) => {
        if (score === null) return '#f1f5f9';
        if (score === 0) return '#bbf7d0';
        if (score <= 15) return '#86efac';
        if (score <= 30) return '#fde68a';
        if (score <= 50) return '#fdba74';
        return '#fca5a5';
    };

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            padding: '8px 0',
        }}>
            {cells.map(cell => (
                <div
                    key={cell.date}
                    title={`${cell.dateLabel}: ${cell.hasLog ? `Score ${cell.score}` : 'Pas de saisie'}`}
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2,
                        background: getColor(cell.score),
                        border: cell.date === new Date().toISOString().split('T')[0]
                            ? '2px solid #3b82f6'
                            : '1px solid rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                    }}
                />
            ))}
            <div style={{
                display: 'flex',
                gap: 8,
                width: '100%',
                marginTop: 4,
                fontSize: '0.65rem',
                color: 'var(--color-text-muted)',
            }}>
                <span>◻ Pas de saisie</span>
                <span style={{ color: '#22c55e' }}>■ Faible</span>
                <span style={{ color: '#f59e0b' }}>■ Modéré</span>
                <span style={{ color: '#ef4444' }}>■ Fort</span>
            </div>
        </div>
    );
}
