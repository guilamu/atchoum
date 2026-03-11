import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import CircularIndicator from '../components/CircularIndicator'
import PollenBar from '../components/PollenBar'
import PollenGroupAccordion from '../components/PollenGroupAccordion'
import PollenHistorySection from '../components/PollenHistoryChart'
import { usePollenData } from '../hooks/usePollenData'
import { useCities } from '../hooks/useCities'
import { POLLEN_GROUPS } from '../data/pollenGroups'

function Dashboard() {
    const { mainCity, cities } = useCities()
    const { data, loading, error, refresh } = usePollenData(mainCity?.inseeCode)

    // Calculate active pollens count
    const activePollens = data?.pollens?.filter(p => p.level > 0) || []
    const activeCount = activePollens.length
    const totalCount = data?.pollens?.length || 6

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return new Date().toLocaleDateString('fr-FR')
        return new Date(dateStr).toLocaleDateString('fr-FR')
    }

    // No city configured
    if (!mainCity && !loading) {
        return (
            <div className="animate-fade-in">
                <header className="app-header">
                    <div className="header-content">
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                            🤧 Atchoum!
                        </h1>
                        <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                            Bienvenue !
                        </p>
                    </div>
                </header>

                <main className="main-content" style={{ marginTop: '-30px' }}>
                    <div className="card card-elevated text-center" style={{ padding: 40 }}>
                        <div style={{ fontSize: '4rem', marginBottom: 16 }}>📍</div>
                        <h2>Configurez votre ville</h2>
                        <p className="text-muted">
                            Pour voir les niveaux de pollen, ajoutez d'abord votre ville.
                        </p>
                        <Link to="/cities" className="btn btn-primary btn-lg mt-4">
                            Ajouter ma ville
                        </Link>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            {/* Header with gradient */}
            <header className="app-header">
                <div className="header-content">
                    <div className="flex items-center justify-between mb-4">
                        <Link to="/cities" className="flex items-center gap-2" style={{ color: 'white', textDecoration: 'none' }}>
                            <span style={{ fontSize: '1.5rem' }}>📍</span>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                                {mainCity?.name || 'Chargement...'}
                            </h1>
                            <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>▼</span>
                        </Link>
                        <button
                            className="btn-icon"
                            onClick={refresh}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                            title="Actualiser"
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="main-content" style={{ marginTop: '-60px' }}>
                {/* Loading state */}
                {loading && (
                    <div className="card card-elevated text-center animate-pulse" style={{ padding: 60 }}>
                        <div style={{ fontSize: '3rem' }}>🌿</div>
                        <p className="text-muted mt-4">Chargement des données...</p>
                    </div>
                )}

                {/* Error state */}
                {error && !loading && (
                    <div className="card card-elevated">
                        <div className="alert-banner">
                            <span className="alert-icon">⚠️</span>
                            <div className="alert-text">
                                <strong>Erreur</strong>
                                <div>{error}</div>
                            </div>
                        </div>
                        <button onClick={refresh} className="btn btn-primary w-full mt-4">
                            Réessayer
                        </button>
                    </div>
                )}

                {/* Data loaded */}
                {data && !loading && (
                    <>
                        {/* Main indicator card */}
                        <div className="card card-elevated animate-slide-up">
                            <div className="text-center mb-4">
                                <CircularIndicator
                                    level={data.globalLevel}
                                    maxLevel={6}
                                    size={180}
                                />
                            </div>

                            {/* Alert banner if active */}
                            {data.isAlert && (
                                <div className="alert-banner mt-4">
                                    <span className="alert-icon">⚠️</span>
                                    <div className="alert-text">
                                        <strong>Alerte pollen active</strong>
                                        {data.pollenResp && (
                                            <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
                                                Pollens responsables: {data.pollenResp}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pollen groups accordions */}
                        <div className="mt-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
                            <div className="card-header">
                                <h3 className="card-title">
                                    Pollens par famille
                                </h3>
                            </div>

                            {POLLEN_GROUPS.map((group) => (
                                <PollenGroupAccordion
                                    key={group.id}
                                    group={group}
                                    pollenData={data.pollens}
                                    defaultOpen={true}
                                />
                            ))}
                        </div>

                        {/* Source and update info */}
                        <div className="text-center mt-4 text-sm text-muted">
                            <p style={{ margin: 0 }}>
                                Source: {data.source || 'Atmo Data'} • Mis à jour le {formatDate(data.dateDif)}
                            </p>
                        </div>

                        {/* Pollen history chart */}
                        {mainCity?.inseeCode && (
                            <PollenHistorySection inseeCode={mainCity.inseeCode} />
                        )}
                    </>
                )}

                {/* Quick actions */}
                <div className="flex gap-3 mt-6" style={{ justifyContent: 'center' }}>
                    <Link to="/forecast" className="btn btn-primary">
                        📅 Prévisions
                    </Link>
                    <Link to="/alerts" className="btn btn-secondary">
                        🔔 Mes alertes
                    </Link>
                </div>
            </main>
        </div>
    )
}

export default Dashboard
