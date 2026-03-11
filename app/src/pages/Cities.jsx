import { useState } from 'react'
import { useCities, useCitySearch, useCurrentLocation } from '../hooks/useCities'
import { useAlerts } from '../hooks/useAlerts'
import { POLLEN_LEVELS } from '../components/CircularIndicator'

const POLLEN_TYPES = [
    { value: 'global', label: 'Tous les pollens' },
    { value: 'aulne', label: 'Aulne' },
    { value: 'bouleau', label: 'Bouleau' },
    { value: 'olivier', label: 'Olivier' },
    { value: 'graminees', label: 'Graminées' },
    { value: 'armoise', label: 'Armoise' },
    { value: 'ambroisie', label: 'Ambroisie' },
]

function Cities() {
    const { cities, mainCity, otherCities, loading, addCity, removeCity, setMainCity } = useCities()
    const { query, setQuery, results, loading: searching, clear } = useCitySearch()
    const { city: detectedCity, loading: detecting, detect } = useCurrentLocation()
    const { alerts, addAlert, updateAlert, removeAlert, toggleAlert } = useAlerts()
    const [showAddModal, setShowAddModal] = useState(false)

    // Alert state
    const [showAlertModal, setShowAlertModal] = useState(false)
    const [editingAlert, setEditingAlert] = useState(null)
    const [newAlert, setNewAlert] = useState({
        cityId: '',
        pollenType: 'global',
        thresholdLevel: 4,
        notifyEmail: true,
        notifyPush: true,
    })

    const handleAddCity = async (city) => {
        await addCity(city)
        clear()
        setShowAddModal(false)
    }

    const handleSetMain = (cityId) => {
        setMainCity(cityId)
    }

    const handleDelete = (cityId) => {
        if (cities.find(c => c.id === cityId)?.isMain && cities.length > 1) {
            alert('Définissez d\'abord une autre ville comme principale')
            return
        }
        removeCity(cityId)
    }

    const handleDetectLocation = async () => {
        await detect()
        if (detectedCity) {
            handleAddCity(detectedCity)
        }
    }

    // Alert handlers
    const handleAddAlert = () => {
        const city = cities.find(c => c.id === parseInt(newAlert.cityId))
        if (!city) {
            alert('Veuillez sélectionner une ville')
            return
        }

        addAlert({
            cityId: city.id,
            cityName: city.name,
            inseeCode: city.inseeCode,
            pollenType: newAlert.pollenType,
            thresholdLevel: newAlert.thresholdLevel,
            notifyEmail: newAlert.notifyEmail,
            notifyPush: newAlert.notifyPush,
        })

        setShowAlertModal(false)
        setNewAlert({ cityId: '', pollenType: 'global', thresholdLevel: 4, notifyEmail: true, notifyPush: true })
    }

    const getPollenTypeLabel = (type) => {
        return POLLEN_TYPES.find(p => p.value === type)?.label || type
    }

    const getThresholdColor = (level) => {
        return POLLEN_LEVELS[level]?.color || '#999'
    }

    const openEditModal = (a) => {
        setEditingAlert({
            id: a.id,
            pollenType: a.pollenType || 'global',
            thresholdLevel: a.thresholdLevel || 3,
            notifyEmail: a.notifyEmail !== false,
            notifyPush: a.notifyPush !== false,
            cityName: a.cityName,
        })
    }

    const handleUpdateAlert = () => {
        if (!editingAlert) return
        updateAlert(editingAlert.id, {
            pollenType: editingAlert.pollenType,
            thresholdLevel: editingAlert.thresholdLevel,
            notifyEmail: editingAlert.notifyEmail,
            notifyPush: editingAlert.notifyPush,
        })
        setEditingAlert(null)
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        Mes villes
                    </h1>
                    <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                        {cities.length} ville{cities.length !== 1 ? 's' : ''} configurée{cities.length !== 1 ? 's' : ''}
                        {alerts.length > 0 && ` • ${alerts.length} alerte${alerts.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
            </header>

            <main className="main-content" style={{ marginTop: '-30px' }}>
                {/* Main city section */}
                {mainCity ? (
                    <div className="card card-elevated">
                        <div className="flex items-center gap-2 mb-3">
                            <span>📍</span>
                            <span className="text-sm font-medium text-secondary">Ma ville principale</span>
                        </div>

                        <div className="city-item city-main">
                            <div>
                                <div className="city-name">{mainCity.name}</div>
                                <div className="text-sm text-muted">
                                    {mainCity.postalCode && `${mainCity.postalCode} • `}
                                    {mainCity.department?.name || `Code INSEE: ${mainCity.inseeCode}`}
                                </div>
                            </div>
                            <div className="city-actions">
                                <button
                                    className="btn btn-icon btn-ghost"
                                    title="Options"
                                >
                                    ⋮
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card card-elevated text-center" style={{ padding: 30 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📍</div>
                        <p className="text-muted">Aucune ville configurée</p>
                        <button
                            className="btn btn-primary mt-3"
                            onClick={() => setShowAddModal(true)}
                        >
                            Ajouter ma première ville
                        </button>
                    </div>
                )}

                {/* Other cities section */}
                {otherCities.length > 0 && (
                    <div className="mt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span>🏙️</span>
                            <span className="text-sm font-medium text-secondary">Autres villes</span>
                        </div>

                        <div className="stagger-children">
                            {otherCities.map(city => (
                                <div key={city.id} className="city-item">
                                    <div>
                                        <div className="city-name">{city.name}</div>
                                        <div className="text-sm text-muted">
                                            {city.postalCode && `${city.postalCode} • `}
                                            {city.department?.name || `Code INSEE: ${city.inseeCode}`}
                                        </div>
                                    </div>
                                    <div className="city-actions">
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => handleSetMain(city.id)}
                                            title="Définir comme principale"
                                        >
                                            ⭐
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => handleDelete(city.id)}
                                            title="Supprimer"
                                            style={{ color: '#ef4444' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add city button */}
                <div className="text-center mt-6">
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => setShowAddModal(true)}
                    >
                        <span>📍</span> Ajouter une ville
                    </button>
                </div>

                {/* ===== ALERTS SECTION ===== */}
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span>🔔</span>
                        <span className="text-sm font-medium text-secondary">Mes alertes</span>
                    </div>

                    <div className="card card-elevated mb-4">
                        <div className="alert-banner alert-info" style={{ margin: 0 }}>
                            <span className="alert-icon">💡</span>
                            <div className="alert-text">
                                Recevez une notification quand le niveau de pollen dépasse votre seuil
                            </div>
                        </div>
                    </div>

                    {/* No cities warning */}
                    {cities.length === 0 && (
                        <div className="card text-center" style={{ padding: 30 }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📍</div>
                            <p className="text-muted">Ajoutez d'abord une ville pour créer des alertes</p>
                        </div>
                    )}

                    {/* Alerts list */}
                    {alerts.length > 0 && (
                        <div className="stagger-children">
                            {alerts.map(a => (
                                <div
                                    key={a.id}
                                    className="card mb-3"
                                    style={{ opacity: a.isActive ? 1 : 0.6 }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-lg">{a.cityName}</div>
                                            <div className="text-sm text-secondary mt-1">
                                                {getPollenTypeLabel(a.pollenType)}
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-sm">
                                                <span style={{
                                                    color: getThresholdColor(a.thresholdLevel),
                                                    fontWeight: 500
                                                }}>
                                                    Seuil: {a.thresholdLevel}/6
                                                </span>
                                                <span className="text-muted">•</span>
                                                <span className="text-muted">
                                                    {a.notifyEmail && '✉️'}
                                                    {a.notifyPush && '🔔'}
                                                    {!a.notifyEmail && !a.notifyPush && 'Aucune notification'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                onClick={() => toggleAlert(a.id)}
                                                style={{
                                                    width: 50,
                                                    height: 28,
                                                    borderRadius: 14,
                                                    border: 'none',
                                                    background: a.isActive
                                                        ? 'linear-gradient(to right, #fdbb2d, #b21f1f)'
                                                        : '#e2e8f0',
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    transition: 'background 0.2s ease',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        top: 3,
                                                        left: a.isActive ? 25 : 3,
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: '50%',
                                                        background: 'white',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                        transition: 'left 0.2s ease',
                                                    }}
                                                />
                                            </button>
                                            <span style={{
                                                fontSize: '1.25rem',
                                                opacity: a.isActive ? 1 : 0.4
                                            }}>
                                                {a.isActive ? '🔔' : '🔕'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => openEditModal(a)}
                                            style={{ color: '#3b82f6' }}
                                        >
                                            ✏️ Modifier
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => removeAlert(a.id)}
                                            style={{ color: '#ef4444' }}
                                        >
                                            🗑️ Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {alerts.length === 0 && cities.length > 0 && (
                        <div className="card text-center" style={{ padding: 40 }}>
                            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔔</div>
                            <h3>Aucune alerte configurée</h3>
                            <p className="text-muted">
                                Créez votre première alerte pour être notifié des pics de pollen
                            </p>
                        </div>
                    )}

                    {/* Add alert button */}
                    {cities.length > 0 && (
                        <div className="text-center mt-6">
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={() => setShowAlertModal(true)}
                            >
                                <span>🔔</span> Ajouter une alerte
                            </button>
                        </div>
                    )}
                </div>

                {/* Add city modal */}
                {showAddModal && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: 16,
                        }}
                        onClick={() => setShowAddModal(false)}
                    >
                        <div
                            className="card animate-slide-up"
                            style={{ width: '100%', maxWidth: 400, maxHeight: '80vh', overflow: 'auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="card-title mb-4">Ajouter une ville</h3>

                            {/* Geolocation button */}
                            <button
                                className="btn btn-secondary w-full mb-4"
                                onClick={handleDetectLocation}
                                disabled={detecting}
                            >
                                {detecting ? (
                                    <><span className="animate-pulse">📍</span> Détection en cours...</>
                                ) : (
                                    <>📍 Utiliser ma position</>
                                )}
                            </button>

                            <div className="text-center text-sm text-muted mb-4">— ou —</div>

                            {/* Search input */}
                            <div className="input-group">
                                <label className="input-label">Rechercher par nom ou code postal</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ex: Paris, 75001..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Search results */}
                            {searching && (
                                <div className="text-center text-sm text-muted animate-pulse">
                                    Recherche...
                                </div>
                            )}

                            {results.length > 0 && (
                                <div className="mt-4" style={{ maxHeight: 250, overflow: 'auto' }}>
                                    {results.map(city => (
                                        <div
                                            key={city.inseeCode}
                                            className="city-item"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleAddCity(city)}
                                        >
                                            <div>
                                                <div className="city-name">{city.name}</div>
                                                <div className="text-sm text-muted">
                                                    {city.postalCode} • {city.department?.name || ''}
                                                </div>
                                            </div>
                                            <span style={{ color: 'var(--gradient-mid)' }}>+</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {query.length >= 2 && results.length === 0 && !searching && (
                                <p className="text-sm text-muted text-center mt-4">
                                    Aucune ville trouvée
                                </p>
                            )}

                            <div className="flex gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        clear()
                                        setShowAddModal(false)
                                    }}
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add alert modal */}
                {showAlertModal && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: 16,
                        }}
                        onClick={() => setShowAlertModal(false)}
                    >
                        <div
                            className="card animate-slide-up"
                            style={{ width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="card-title mb-4">Nouvelle alerte</h3>

                            <div className="input-group">
                                <label className="input-label">Ville</label>
                                <select
                                    className="input"
                                    value={newAlert.cityId}
                                    onChange={e => setNewAlert({ ...newAlert, cityId: e.target.value })}
                                >
                                    <option value="">Sélectionner une ville</option>
                                    {cities.map(city => (
                                        <option key={city.id} value={city.id}>{city.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Type de pollen</label>
                                <select
                                    className="input"
                                    value={newAlert.pollenType}
                                    onChange={e => setNewAlert({ ...newAlert, pollenType: e.target.value })}
                                >
                                    {POLLEN_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">
                                    Seuil d'alerte: <strong style={{ color: getThresholdColor(newAlert.thresholdLevel) }}>
                                        {newAlert.thresholdLevel}/6 - {POLLEN_LEVELS[newAlert.thresholdLevel]?.label}
                                    </strong>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="6"
                                    value={newAlert.thresholdLevel}
                                    onChange={e => setNewAlert({ ...newAlert, thresholdLevel: parseInt(e.target.value) })}
                                    className="w-full"
                                    style={{ accentColor: getThresholdColor(newAlert.thresholdLevel) }}
                                />
                                <div className="flex justify-between text-sm text-muted mt-1">
                                    <span>1 - Très faible</span>
                                    <span>6 - Extrême</span>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Type de notifications</label>
                                <div className="flex flex-col gap-3 mt-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newAlert.notifyEmail}
                                            onChange={e => setNewAlert({ ...newAlert, notifyEmail: e.target.checked })}
                                            style={{ width: 20, height: 20, accentColor: '#b21f1f' }}
                                        />
                                        <span>✉️ Email</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newAlert.notifyPush}
                                            onChange={e => setNewAlert({ ...newAlert, notifyPush: e.target.checked })}
                                            style={{ width: 20, height: 20, accentColor: '#b21f1f' }}
                                        />
                                        <span>🔔 Notification push</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowAlertModal(false)}
                                >
                                    Annuler
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleAddAlert}
                                    disabled={!newAlert.cityId}
                                >
                                    Créer l'alerte
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit alert modal */}
                {editingAlert && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: 16,
                        }}
                        onClick={() => setEditingAlert(null)}
                    >
                        <div
                            className="card animate-slide-up"
                            style={{ width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="card-title mb-4">Modifier l'alerte</h3>
                            <p className="text-muted mb-4">📍 {editingAlert.cityName}</p>

                            <div className="input-group">
                                <label className="input-label">Type de pollen</label>
                                <select
                                    className="input"
                                    value={editingAlert.pollenType}
                                    onChange={e => setEditingAlert({ ...editingAlert, pollenType: e.target.value })}
                                >
                                    {POLLEN_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">
                                    Seuil d'alerte: <strong style={{ color: getThresholdColor(editingAlert.thresholdLevel) }}>
                                        {editingAlert.thresholdLevel}/6 - {POLLEN_LEVELS[editingAlert.thresholdLevel]?.label}
                                    </strong>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="6"
                                    value={editingAlert.thresholdLevel}
                                    onChange={e => setEditingAlert({ ...editingAlert, thresholdLevel: parseInt(e.target.value) })}
                                    className="w-full"
                                    style={{ accentColor: getThresholdColor(editingAlert.thresholdLevel) }}
                                />
                                <div className="flex justify-between text-sm text-muted mt-1">
                                    <span>1 - Très faible</span>
                                    <span>6 - Extrême</span>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Type de notifications</label>
                                <div className="flex flex-col gap-3 mt-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingAlert.notifyEmail}
                                            onChange={e => setEditingAlert({ ...editingAlert, notifyEmail: e.target.checked })}
                                            style={{ width: 20, height: 20, accentColor: '#b21f1f' }}
                                        />
                                        <span>✉️ Email</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingAlert.notifyPush}
                                            onChange={e => setEditingAlert({ ...editingAlert, notifyPush: e.target.checked })}
                                            style={{ width: 20, height: 20, accentColor: '#b21f1f' }}
                                        />
                                        <span>🔔 Notification push</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setEditingAlert(null)}
                                >
                                    Annuler
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpdateAlert}
                                >
                                    Enregistrer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default Cities
