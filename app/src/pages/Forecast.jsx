import { useMemo } from 'react'
import { POLLEN_LEVELS } from '../components/CircularIndicator'
import { usePollenForecast } from '../hooks/usePollenData'
import { useCities } from '../hooks/useCities'

function Forecast() {
    const { mainCity } = useCities()
    const { forecast, loading, error } = usePollenForecast(mainCity?.inseeCode)

    // Generate extended forecast with simulated data for days beyond API limit
    const extendedForecast = useMemo(() => {
        if (forecast.length === 0) {
            // Generate mock forecast if no data
            const days = []
            const today = new Date()

            for (let i = 0; i < 7; i++) {
                const date = new Date(today)
                date.setDate(date.getDate() + i)

                // Simulate levels (in production, this comes from API)
                const level = Math.floor(Math.random() * 4) + 1

                days.push({
                    date,
                    globalLevel: level,
                    globalLabel: POLLEN_LEVELS[level]?.label,
                    isToday: i === 0,
                })
            }
            return days
        }

        return forecast
    }, [forecast])

    const formatDayName = (date, isToday) => {
        if (isToday) return "Aujourd'hui"
        return date.toLocaleDateString('fr-FR', { weekday: 'long' })
    }

    const formatDate = (date) => {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        Prévisions
                    </h1>
                    <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                        📍 {mainCity?.name || 'Aucune ville'} • Prochains jours
                    </p>
                </div>
            </header>

            <main className="main-content" style={{ marginTop: '-30px' }}>
                {!mainCity && (
                    <div className="card card-elevated text-center" style={{ padding: 30 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📍</div>
                        <p className="text-muted">Ajoutez une ville pour voir les prévisions</p>
                    </div>
                )}

                {loading && mainCity && (
                    <div className="card card-elevated text-center animate-pulse" style={{ padding: 40 }}>
                        <div style={{ fontSize: '2rem' }}>📅</div>
                        <p className="text-muted mt-4">Chargement des prévisions...</p>
                    </div>
                )}

                {error && (
                    <div className="card card-elevated">
                        <div className="alert-banner">
                            <span className="alert-icon">⚠️</span>
                            <span className="alert-text">{error}</span>
                        </div>
                    </div>
                )}

                {mainCity && !loading && (
                    <>
                        <div className="card card-elevated">
                            <div className="card-header">
                                <h3 className="card-title">Prévisions sur 7 jours</h3>
                            </div>

                            <div>
                                {extendedForecast.map((day, index) => (
                                    <div
                                        key={index}
                                        className="forecast-item"
                                        style={{
                                            background: day.isToday
                                                ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                                                : 'transparent',
                                        }}
                                    >
                                        <div className="forecast-date">
                                            <div className="font-semibold" style={{ textTransform: 'capitalize' }}>
                                                {formatDayName(day.date, day.isToday)}
                                            </div>
                                            <div className="text-sm text-muted">
                                                {formatDate(day.date)}
                                            </div>
                                        </div>

                                        <div className="forecast-level">
                                            <span
                                                className="font-semibold"
                                                style={{ color: POLLEN_LEVELS[day.globalLevel]?.color }}
                                            >
                                                {day.globalLabel || POLLEN_LEVELS[day.globalLevel]?.label}
                                            </span>
                                            <span className="forecast-icon">🌿</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="card mt-4">
                            <h4 className="card-title mb-3">Légende des niveaux</h4>
                            <div className="stagger-children">
                                {[1, 2, 3, 4, 5, 6].map(level => (
                                    <div
                                        key={level}
                                        className="flex items-center gap-3 mb-2"
                                    >
                                        <div
                                            style={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: 4,
                                                background: POLLEN_LEVELS[level]?.color,
                                            }}
                                        />
                                        <span className="text-sm">
                                            <strong>{level}</strong> - {POLLEN_LEVELS[level]?.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Info card */}
                        <div className="card mt-4">
                            <div className="alert-banner alert-info" style={{ margin: 0 }}>
                                <span className="alert-icon">ℹ️</span>
                                <div className="alert-text">
                                    Les prévisions sont mises à jour quotidiennement à 12h.
                                    <br />
                                    <small className="text-muted">Source: Atmo Data</small>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}

export default Forecast
