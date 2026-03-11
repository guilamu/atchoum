import { useState } from 'react'
import { POLLEN_LEVELS } from '../components/CircularIndicator'
import { useAlerts } from '../hooks/useAlerts'
import { useCities } from '../hooks/useCities'

const POLLEN_TYPES = [
    { value: 'global', label: 'Tous les pollens' },
    { value: 'aulne', label: 'Aulne' },
    { value: 'bouleau', label: 'Bouleau' },
    { value: 'olivier', label: 'Olivier' },
    { value: 'graminees', label: 'Graminées' },
    { value: 'armoise', label: 'Armoise' },
    { value: 'ambroisie', label: 'Ambroisie' },
]

function Alerts() {
    const { alerts, loading, addAlert, updateAlert, removeAlert, toggleAlert } = useAlerts()
    const { cities } = useCities()
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingAlert, setEditingAlert] = useState(null)

    // New alert form state
    const [newAlert, setNewAlert] = useState({
        cityId: '',
        pollenType: 'global',
        thresholdLevel: 4,
        notifyEmail: true,
        notifyPush: true,
    })

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

        setShowAddModal(false)
        setNewAlert({ cityId: '', pollenType: 'global', thresholdLevel: 4, notifyEmail: true, notifyPush: true })
    }

    const getPollenTypeLabel = (type) => {
        return POLLEN_TYPES.find(p => p.value === type)?.label || type
    }

    const getThresholdColor = (level) => {
        return POLLEN_LEVELS[level]?.color || '#999'
    }

    const openEditModal = (alert) => {
        setEditingAlert({
            id: alert.id,
            pollenType: alert.pollenType || 'global',
            thresholdLevel: alert.thresholdLevel || 3,
            notifyEmail: alert.notifyEmail !== false,
            notifyPush: alert.notifyPush !== false,
            cityName: alert.cityName,
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
                        Mes alertes
                    </h1>
                    <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                        {alerts.length} alerte{alerts.length !== 1 ? 's' : ''} configurée{alerts.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </header>

            <main className="main-content" style={{ marginTop: '-30px' }}>
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
                        {alerts.map(alert => (
                            <div
                                key={alert.id}
                                className="card mb-3"
                                style={{ opacity: alert.isActive ? 1 : 0.6 }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-lg">{alert.cityName}</div>
                                        <div className="text-sm text-secondary mt-1">
                                            {getPollenTypeLabel(alert.pollenType)}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-sm">
                                            <span style={{
                                                color: getThresholdColor(alert.thresholdLevel),
                                                fontWeight: 500
                                            }}>
                                                Seuil: {alert.thresholdLevel}/6
                                            </span>
                                            <span className="text-muted">•</span>
                                            <span className="text-muted">
                                                {alert.notifyEmail && '✉️'}
                                                {alert.notifyPush && '🔔'}
                                                {!alert.notifyEmail && !alert.notifyPush && 'Aucune notification'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-2">
                                        {/* Toggle switch */}
                                        <button
                                            onClick={() => toggleAlert(alert.id)}
                                            style={{
                                                width: 50,
                                                height: 28,
                                                borderRadius: 14,
                                                border: 'none',
                                                background: alert.isActive
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
                                                    left: alert.isActive ? 25 : 3,
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                    transition: 'left 0.2s ease',
                                                }}
                                            />
                                        </button>

                                        {/* Bell icon */}
                                        <span style={{
                                            fontSize: '1.25rem',
                                            opacity: alert.isActive ? 1 : 0.4
                                        }}>
                                            {alert.isActive ? '🔔' : '🔕'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => openEditModal(alert)}
                                        style={{ color: '#3b82f6' }}
                                    >
                                        ✏️ Modifier
                                    </button>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => removeAlert(alert.id)}
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
                            onClick={() => setShowAddModal(true)}
                        >
                            <span>🔔</span> Ajouter une alerte
                        </button>
                    </div>
                )}

                {/* Add alert modal */}
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
                                    onClick={() => setShowAddModal(false)}
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

export default Alerts
