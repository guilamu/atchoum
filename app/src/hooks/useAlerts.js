import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAlerts as apiGetAlerts, addAlert as apiAddAlert, updateAlert as apiUpdateAlert, deleteAlert as apiDeleteAlert } from '../services/authService'
import {
    getAlerts as localGetAlerts,
    addAlert as localAddAlert,
    updateAlert as localUpdateAlert,
    removeAlert as localRemoveAlert,
    toggleAlert as localToggleAlert,
    saveAlerts as localSaveAlerts,
} from '../services/storage'

/**
 * Hook for managing pollen alerts
 * Uses API when authenticated, localStorage when not
 */
export function useAlerts() {
    const { isAuthenticated } = useAuth()
    const [alerts, setAlertsState] = useState([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    // Load alerts on mount or auth change
    useEffect(() => {
        const loadAlerts = async () => {
            setLoading(true)

            if (isAuthenticated) {
                try {
                    const apiAlerts = await apiGetAlerts()
                    // Transform API format to app format
                    const formattedAlerts = apiAlerts.map(a => ({
                        id: a.id,
                        cityId: a.city_id,
                        cityName: a.city_name || '',
                        pollenType: a.pollen_type || 'global',
                        thresholdLevel: a.threshold_level || 3,
                        notifyEmail: a.notify_email !== false,
                        notifyPush: a.notify_push !== false,
                        isActive: a.is_active !== false,
                    }))
                    setAlertsState(formattedAlerts)
                    // Also update localStorage as cache
                    localSaveAlerts(formattedAlerts)
                } catch (err) {
                    console.error('Failed to load alerts from API:', err)
                    // Fallback to localStorage
                    setAlertsState(localGetAlerts())
                }
            } else {
                setAlertsState(localGetAlerts())
            }

            setLoading(false)
        }

        loadAlerts()
    }, [isAuthenticated])

    const addAlert = useCallback(async (alert) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                const result = await apiAddAlert({
                    city_id: alert.cityId,
                    pollen_type: alert.pollenType || 'global',
                    threshold_level: alert.thresholdLevel || 3,
                    notify_email: alert.notifyEmail !== false,
                    notify_push: alert.notifyPush !== false,
                })

                if (result.success && result.alert) {
                    const newAlert = {
                        id: result.alert.id,
                        cityId: result.alert.city_id,
                        cityName: alert.cityName || '',
                        pollenType: result.alert.pollen_type,
                        thresholdLevel: result.alert.threshold_level,
                        notifyEmail: result.alert.notify_email !== false,
                        notifyPush: result.alert.notify_push !== false,
                        isActive: result.alert.is_active !== false,
                    }
                    const updatedAlerts = [...alerts, newAlert]
                    setAlertsState(updatedAlerts)
                    localSaveAlerts(updatedAlerts)
                    return updatedAlerts
                }
            } else {
                const updatedAlerts = localAddAlert(alert)
                setAlertsState(updatedAlerts)
                return updatedAlerts
            }
        } catch (err) {
            console.error('Failed to add alert:', err)
            // Fallback to local
            const updatedAlerts = localAddAlert(alert)
            setAlertsState(updatedAlerts)
            return updatedAlerts
        } finally {
            setSyncing(false)
        }

        return alerts
    }, [isAuthenticated, alerts])

    const updateAlert = useCallback(async (alertId, updates) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                await apiUpdateAlert(alertId, {
                    pollen_type: updates.pollenType,
                    threshold_level: updates.thresholdLevel,
                    notify_email: updates.notifyEmail,
                    notify_push: updates.notifyPush,
                    is_active: updates.isActive,
                })
            }

            const updatedAlerts = alerts.map(a =>
                a.id === alertId ? { ...a, ...updates } : a
            )

            setAlertsState(updatedAlerts)
            localSaveAlerts(updatedAlerts)
            return updatedAlerts
        } catch (err) {
            console.error('Failed to update alert:', err)
            const updatedAlerts = localUpdateAlert(alertId, updates)
            setAlertsState(updatedAlerts)
            return updatedAlerts
        } finally {
            setSyncing(false)
        }
    }, [isAuthenticated, alerts])

    const removeAlert = useCallback(async (alertId) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                await apiDeleteAlert(alertId)
            }

            const updatedAlerts = alerts.filter(a => a.id !== alertId)
            setAlertsState(updatedAlerts)
            localSaveAlerts(updatedAlerts)
            return updatedAlerts
        } catch (err) {
            console.error('Failed to remove alert:', err)
            const updatedAlerts = localRemoveAlert(alertId)
            setAlertsState(updatedAlerts)
            return updatedAlerts
        } finally {
            setSyncing(false)
        }
    }, [isAuthenticated, alerts])

    const toggleAlert = useCallback(async (alertId) => {
        const alert = alerts.find(a => a.id === alertId)
        if (alert) {
            return updateAlert(alertId, { isActive: !alert.isActive })
        }
        return alerts
    }, [alerts, updateAlert])

    const activeAlerts = alerts.filter(a => a.isActive)
    const inactiveAlerts = alerts.filter(a => !a.isActive)

    return {
        alerts,
        activeAlerts,
        inactiveAlerts,
        loading,
        syncing,
        addAlert,
        updateAlert,
        removeAlert,
        toggleAlert,
    }
}

export default {
    useAlerts,
}
