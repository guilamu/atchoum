import { useState, useMemo } from 'react'
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
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { usePollenHistory } from '../hooks/usePollenData'
import { POLLEN_LEVELS } from '../services/atmoApi'

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
)

const POLLEN_COLORS = {
    Aulne: { border: '#8B4513', bg: 'rgba(139,69,19,0.15)' },
    Bouleau: { border: '#228B22', bg: 'rgba(34,139,34,0.15)' },
    Olivier: { border: '#6B8E23', bg: 'rgba(107,142,35,0.15)' },
    Graminées: { border: '#DAA520', bg: 'rgba(218,165,32,0.15)' },
    Armoise: { border: '#2E8B57', bg: 'rgba(46,139,87,0.15)' },
    Ambroisie: { border: '#CD853F', bg: 'rgba(205,133,63,0.15)' },
}

/**
 * Pollen History Chart Section for Dashboard
 */
export default function PollenHistorySection({ inseeCode }) {
    const [days, setDays] = useState(14)
    const [expanded, setExpanded] = useState(false)
    const { history, loading, error } = usePollenHistory(inseeCode, days)

    if (!expanded) {
        return (
            <div className="card mt-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: 'inherit',
                    }}
                >
                    <h3 className="card-title" style={{ margin: 0 }}>
                        📊 Historique des pollens
                    </h3>
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>▼</span>
                </button>
            </div>
        )
    }

    return (
        <div className="card mt-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <button
                onClick={() => setExpanded(false)}
                className="w-full"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: 12,
                    color: 'inherit',
                }}
            >
                <h3 className="card-title" style={{ margin: 0 }}>
                    📊 Historique des pollens
                </h3>
                <span style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>▲</span>
            </button>

            {/* Period selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[
                    { value: 7, label: '7 jours' },
                    { value: 14, label: '14 jours' },
                    { value: 30, label: '30 jours' },
                ].map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setDays(opt.value)}
                        style={{
                            flex: 1,
                            fontSize: '0.8rem',
                            padding: '6px 8px',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontWeight: days === opt.value ? 600 : 400,
                            background: days === opt.value
                                ? 'linear-gradient(135deg, #fdbb2d, #b21f1f)'
                                : '#f1f5f9',
                            color: days === opt.value ? 'white' : 'var(--color-text)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="text-center animate-pulse" style={{ padding: 30 }}>
                    Chargement de l'historique...
                </div>
            )}

            {error && !loading && (
                <div className="text-center text-muted" style={{ padding: 20 }}>
                    ⚠️ {error}
                </div>
            )}

            {!loading && !error && history.length > 0 && (
                <>
                    <PollenHistoryLineChart history={history} />
                    <div style={{ marginTop: 16 }}>
                        <GlobalLevelBars history={history} />
                    </div>
                </>
            )}

            {!loading && !error && history.length === 0 && (
                <div className="text-center text-muted" style={{ padding: 20 }}>
                    Aucune donnée disponible pour cette période.
                </div>
            )}
        </div>
    )
}

/**
 * Multi-line chart showing each pollen type over time
 */
function PollenHistoryLineChart({ history }) {
    const data = useMemo(() => {
        if (!history || history.length === 0) return null

        // Collect all pollen names
        const pollenNames = []
        if (history[0]?.pollens) {
            history[0].pollens.forEach(p => {
                if (!pollenNames.includes(p.name)) pollenNames.push(p.name)
            })
        }

        const labels = history.map(h => {
            const d = new Date(h.date)
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        })

        const datasets = pollenNames.map(name => {
            const colors = POLLEN_COLORS[name] || { border: '#999', bg: 'rgba(153,153,153,0.15)' }
            return {
                label: name,
                data: history.map(h => {
                    const pollen = (h.pollens || []).find(p => p.name === name)
                    return pollen ? pollen.level : 0
                }),
                borderColor: colors.border,
                backgroundColor: colors.bg,
                tension: 0.3,
                pointRadius: history.length <= 14 ? 4 : 2,
                pointHoverRadius: 6,
                borderWidth: 2,
                fill: false,
            }
        })

        return { labels, datasets }
    }, [history])

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
                callbacks: {
                    label: (ctx) => {
                        const level = ctx.raw
                        const levelInfo = POLLEN_LEVELS[level]
                        return `${ctx.dataset.label}: ${levelInfo?.label || level} (${level}/6)`
                    },
                },
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
                min: 0,
                max: 6,
                ticks: {
                    font: { size: 10 },
                    stepSize: 1,
                    callback: (val) => {
                        const labels = ['', 'Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé', 'Extrême']
                        return labels[val] || val
                    },
                },
                grid: {
                    color: 'rgba(0,0,0,0.05)',
                },
            },
        },
    }

    if (!data) return null

    return (
        <div style={{ height: 240 }}>
            <Line data={data} options={options} />
        </div>
    )
}

/**
 * Small horizontal bars showing daily global level
 */
function GlobalLevelBars({ history }) {
    return (
        <div>
            <h4 style={{ fontSize: '0.8rem', marginBottom: 8, color: 'var(--color-text-muted)' }}>
                Niveau global par jour
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {history.slice(-14).map(day => {
                    const level = day.globalLevel || 0
                    const levelInfo = POLLEN_LEVELS[level] || { label: '?', color: '#ddd' }
                    const d = new Date(day.date)
                    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })

                    return (
                        <div
                            key={day.date}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: '0.75rem',
                            }}
                        >
                            <span style={{ width: 72, flexShrink: 0, color: 'var(--color-text-muted)' }}>
                                {label}
                            </span>
                            <div style={{
                                flex: 1,
                                height: 14,
                                borderRadius: 7,
                                background: '#f1f5f9',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${(level / 6) * 100}%`,
                                    height: '100%',
                                    borderRadius: 7,
                                    background: levelInfo.color,
                                    transition: 'width 0.5s ease',
                                    minWidth: level > 0 ? 8 : 0,
                                }} />
                            </div>
                            <span style={{
                                width: 16,
                                textAlign: 'center',
                                fontWeight: 600,
                                color: levelInfo.color,
                            }}>
                                {level}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
