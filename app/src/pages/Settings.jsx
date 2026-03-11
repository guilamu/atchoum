import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getSettings, updateSetting, exportAllData, clearAllData } from '../services/storage'
import { isNotificationSupported, getNotificationPermission, subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '../services/notifications'

function Settings() {
    const { user, isAuthenticated, logout } = useAuth()
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [pushSupported, setPushSupported] = useState(false)
    const [pushPermission, setPushPermission] = useState('default')
    const [pushSubscribed, setPushSubscribed] = useState(false)
    const [pushLoading, setPushLoading] = useState(false)

    useEffect(() => {
        const savedSettings = getSettings()
        setSettings(savedSettings)
        setLoading(false)

        // Check notification support and status
        setPushSupported(isNotificationSupported())
        setPushPermission(getNotificationPermission())
        isPushSubscribed().then(setPushSubscribed)
    }, [])

    const handleToggle = (key) => {
        const newValue = !settings[key]
        updateSetting(key, newValue)
        setSettings({ ...settings, [key]: newValue })
    }

    const handleNotificationToggle = async () => {
        if (!pushSupported) {
            alert('Les notifications push ne sont pas supportées par votre navigateur.')
            return
        }

        setPushLoading(true)

        try {
            if (pushSubscribed) {
                // Unsubscribe
                await unsubscribeFromPush()
                setPushSubscribed(false)
                updateSetting('notifications', false)
                setSettings({ ...settings, notifications: false })
            } else {
                // Subscribe
                const subscription = await subscribeToPush()
                if (subscription) {
                    setPushSubscribed(true)
                    setPushPermission('granted')
                    updateSetting('notifications', true)
                    setSettings({ ...settings, notifications: true })
                }
            }
        } catch (error) {
            console.error('Notification toggle error:', error)
            if (error.message.includes('refusée') || error.message.includes('denied')) {
                setPushPermission('denied')
                alert('Permission refusée. Vous pouvez la modifier dans les paramètres de votre navigateur.')
            } else {
                alert('Erreur: ' + error.message)
            }
        } finally {
            setPushLoading(false)
        }
    }

    const handleExportData = () => {
        const data = exportAllData()
        const json = JSON.stringify(data, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `atchoum_export_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleDeleteData = () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer toutes vos données locales ? Cette action est irréversible.')) {
            clearAllData()
            window.location.reload()
        }
    }

    const handleLogout = () => {
        if (confirm('Voulez-vous vous déconnecter ?')) {
            logout()
            window.location.href = '/login'
        }
    }

    if (loading || !settings) {
        return (
            <div className="animate-fade-in">
                <header className="app-header">
                    <div className="header-content">
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Réglages</h1>
                    </div>
                </header>
                <main className="main-content" style={{ marginTop: '-30px' }}>
                    <div className="card card-elevated text-center animate-pulse" style={{ padding: 40 }}>
                        Chargement...
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        Réglages
                    </h1>
                    <p style={{ opacity: 0.9, marginTop: 4, marginBottom: 0 }}>
                        Paramètres de l'application
                    </p>
                </div>
            </header>

            <main className="main-content" style={{ marginTop: '-30px' }}>
                {/* User account section */}
                <div className="card card-elevated">
                    <h3 className="card-title mb-4">👤 Mon compte</h3>

                    {isAuthenticated && user ? (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(253, 187, 45, 0.1), rgba(178, 31, 31, 0.1))',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 16,
                        }}>
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #fdbb2d, #b21f1f)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                }}>
                                    {user.email?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <div className="font-medium">{user.email}</div>
                                    <div className="text-sm text-muted">
                                        Connecté • Données synchronisées
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="alert-banner alert-warning mb-4">
                            <span className="alert-icon">⚠️</span>
                            <div className="alert-text">
                                Vous n'êtes pas connecté. Vos données sont stockées localement.
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-secondary w-full"
                        onClick={handleLogout}
                    >
                        🚪 Se déconnecter
                    </button>
                </div>

                {/* Notifications section */}
                <div className="card mt-4">
                    <h3 className="card-title mb-4">🔔 Notifications</h3>

                    {!pushSupported ? (
                        <p className="text-muted">
                            ⚠️ Les notifications push ne sont pas supportées par votre navigateur.
                        </p>
                    ) : pushPermission === 'denied' ? (
                        <p className="text-muted">
                            🚫 Permission refusée. Pour activer les notifications, modifiez les permissions dans les paramètres de votre navigateur.
                        </p>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">Notifications push</div>
                                <div className="text-sm text-muted">
                                    {pushSubscribed ? 'Activées' : 'Recevoir les alertes pollen'}
                                </div>
                            </div>
                            <button
                                onClick={handleNotificationToggle}
                                disabled={pushLoading}
                                style={{
                                    width: 50,
                                    height: 28,
                                    borderRadius: 14,
                                    border: 'none',
                                    background: pushSubscribed
                                        ? 'linear-gradient(to right, #fdbb2d, #b21f1f)'
                                        : '#e2e8f0',
                                    cursor: pushLoading ? 'wait' : 'pointer',
                                    position: 'relative',
                                    transition: 'background 0.2s ease',
                                    opacity: pushLoading ? 0.6 : 1,
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: 3,
                                        left: pushSubscribed ? 25 : 3,
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: 'white',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        transition: 'left 0.2s ease',
                                    }}
                                />
                            </button>
                        </div>
                    )}

                    <p className="text-sm text-muted mt-3">
                        {pushSubscribed
                            ? '✅ Vous recevrez une notification quand les niveaux de pollen dépassent vos seuils.'
                            : 'Cliquez sur le toggle pour activer les notifications push.'}
                    </p>
                </div>

                {/* Health sections visibility */}
                <div className="card mt-4">
                    <h3 className="card-title mb-4">🩺 Sections santé</h3>

                    <p className="text-sm text-muted mb-4">
                        Choisissez les sections affichées dans l'onglet Santé.
                    </p>

                    <div className="flex flex-col gap-3">
                        {[
                            { key: 'symptoms', label: 'Symptômes du jour', emoji: '🤧' },
                            { key: 'medications', label: 'Médicaments pris', emoji: '💊' },
                            { key: 'statistics', label: 'Statistiques', emoji: '📊' },
                            { key: 'diagnostic', label: 'Diagnostic', emoji: '🔬' },
                        ].map(section => {
                            const enabled = settings.healthSections?.[section.key] !== false;
                            return (
                                <div key={section.key} className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{section.emoji} {section.label}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const current = settings.healthSections || {};
                                            const newSections = { ...current, [section.key]: !enabled };
                                            updateSetting('healthSections', newSections);
                                            setSettings({ ...settings, healthSections: newSections });
                                        }}
                                        style={{
                                            width: 50,
                                            height: 28,
                                            borderRadius: 14,
                                            border: 'none',
                                            background: enabled
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
                                                left: enabled ? 25 : 3,
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                background: 'white',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                transition: 'left 0.2s ease',
                                            }}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Data management section */}
                <div className="card mt-4">
                    <h3 className="card-title mb-4">📦 Mes données</h3>

                    <div className="flex flex-col gap-3">
                        <button
                            className="btn btn-secondary w-full"
                            onClick={handleExportData}
                        >
                            📥 Exporter mes données (JSON)
                        </button>

                        <button
                            className="btn btn-secondary w-full"
                            onClick={handleDeleteData}
                            style={{ color: '#ef4444' }}
                        >
                            🗑️ Supprimer les données locales
                        </button>
                    </div>

                    <p className="text-sm text-muted text-center mt-4">
                        Conformément au RGPD, vous pouvez exporter ou supprimer vos données à tout moment.
                    </p>
                </div>

                {/* About section */}
                <div className="card mt-4">
                    <h3 className="card-title mb-4">ℹ️ À propos</h3>

                    <div className="text-sm text-secondary">
                        <p><strong>Atchoum!</strong> v1.0.0</p>
                        <p>Application open source de suivi des pollens</p>
                        <p className="mt-3">
                            Données fournies par{' '}
                            <a href="https://atmo-france.org" target="_blank" rel="noopener noreferrer">
                                Atmo Data
                            </a>
                        </p>
                        <p>Licence: ODbL 1.0</p>
                    </div>

                    <div className="flex gap-3 mt-4 flex-wrap">
                        <a href="#" className="btn btn-ghost btn-sm">📜 CGU</a>
                        <a href="#" className="btn btn-ghost btn-sm">🔒 Confidentialité</a>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                            💻 GitHub
                        </a>
                    </div>
                </div>

                {/* Spacer for bottom nav */}
                <div style={{ height: 24 }} />
            </main>
        </div>
    )
}

export default Settings
