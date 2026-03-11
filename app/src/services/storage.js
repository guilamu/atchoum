/**
 * Local Storage Service
 * Handles persistent storage for user data, cities, and alerts
 */

const STORAGE_KEYS = {
    USER: 'atchoum_user',
    CITIES: 'atchoum_cities',
    ALERTS: 'atchoum_alerts',
    SETTINGS: 'atchoum_settings',
    POLLEN_CACHE: 'atchoum_pollen_cache',
}

// ==================== User Data ====================

export function getUser() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.USER)
        return data ? JSON.parse(data) : null
    } catch {
        return null
    }
}

export function setUser(user) {
    if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    } else {
        localStorage.removeItem(STORAGE_KEYS.USER)
    }
}

export function clearUser() {
    localStorage.removeItem(STORAGE_KEYS.USER)
}

// ==================== Cities ====================

export function getCities() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.CITIES)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

export function saveCities(cities) {
    localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(cities))
}

export function addCity(city) {
    const cities = getCities()

    // Check if already exists
    if (cities.some(c => c.inseeCode === city.inseeCode)) {
        return cities
    }

    // Set as main if first city
    const isMain = cities.length === 0
    const newCity = {
        ...city,
        id: Date.now(),
        isMain,
        addedAt: new Date().toISOString(),
    }

    const updatedCities = [...cities, newCity]
    saveCities(updatedCities)
    return updatedCities
}

export function removeCity(cityId) {
    const cities = getCities()
    const updatedCities = cities.filter(c => c.id !== cityId)

    // If we removed the main city, set the first remaining as main
    if (updatedCities.length > 0 && !updatedCities.some(c => c.isMain)) {
        updatedCities[0].isMain = true
    }

    saveCities(updatedCities)
    return updatedCities
}

export function setMainCity(cityId) {
    const cities = getCities()
    const updatedCities = cities.map(c => ({
        ...c,
        isMain: c.id === cityId,
    }))
    saveCities(updatedCities)
    return updatedCities
}

export function getMainCity() {
    const cities = getCities()
    return cities.find(c => c.isMain) || cities[0] || null
}

// ==================== Alerts ====================

export function getAlerts() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.ALERTS)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

export function saveAlerts(alerts) {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts))
}

export function addAlert(alert) {
    const alerts = getAlerts()
    const newAlert = {
        ...alert,
        id: Date.now(),
        isActive: true,
        createdAt: new Date().toISOString(),
    }
    const updatedAlerts = [...alerts, newAlert]
    saveAlerts(updatedAlerts)
    return updatedAlerts
}

export function updateAlert(alertId, updates) {
    const alerts = getAlerts()
    const updatedAlerts = alerts.map(a =>
        a.id === alertId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    )
    saveAlerts(updatedAlerts)
    return updatedAlerts
}

export function removeAlert(alertId) {
    const alerts = getAlerts()
    const updatedAlerts = alerts.filter(a => a.id !== alertId)
    saveAlerts(updatedAlerts)
    return updatedAlerts
}

export function toggleAlert(alertId) {
    const alerts = getAlerts()
    const updatedAlerts = alerts.map(a =>
        a.id === alertId ? { ...a, isActive: !a.isActive } : a
    )
    saveAlerts(updatedAlerts)
    return updatedAlerts
}

// ==================== Settings ====================

const DEFAULT_SETTINGS = {
    notifications: true,
    theme: 'auto',
    language: 'fr',
    healthSections: {
        symptoms: true,
        medications: true,
        statistics: true,
        diagnostic: true,
    },
}

export function getSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
        return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS
    } catch {
        return DEFAULT_SETTINGS
    }
}

export function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

export function updateSetting(key, value) {
    const settings = getSettings()
    settings[key] = value
    saveSettings(settings)
    return settings
}

// ==================== Pollen Cache ====================

const CACHE_DURATION = 12 * 60 * 60 * 1000 // 12 hours

/**
 * Get today's date in local timezone (YYYY-MM-DD)
 * Avoids the UTC bug where toISOString() returns yesterday's date
 * between midnight and 1-2 AM in CET/CEST
 */
export function getLocalDateString() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function getCachedPollenData(inseeCode, date) {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.POLLEN_CACHE)
        const cache = data ? JSON.parse(data) : {}
        const key = `${inseeCode}_${date}`
        const entry = cache[key]

        if (entry && Date.now() - entry.cachedAt < CACHE_DURATION) {
            return entry.data
        }

        return null
    } catch {
        return null
    }
}

/**
 * Clear cached pollen data for a specific city/date or all cache
 * @param {string} inseeCode - Optional: clear only this city
 * @param {string} date - Optional: clear only this date
 */
export function clearCachedPollenData(inseeCode = null, date = null) {
    try {
        if (!inseeCode) {
            localStorage.removeItem(STORAGE_KEYS.POLLEN_CACHE)
            return
        }
        const data = localStorage.getItem(STORAGE_KEYS.POLLEN_CACHE)
        const cache = data ? JSON.parse(data) : {}
        if (date) {
            delete cache[`${inseeCode}_${date}`]
        } else {
            // Clear all entries for this city
            for (const k in cache) {
                if (k.startsWith(`${inseeCode}_`)) {
                    delete cache[k]
                }
            }
        }
        localStorage.setItem(STORAGE_KEYS.POLLEN_CACHE, JSON.stringify(cache))
    } catch {
        // Ignore storage errors
    }
}

export function setCachedPollenData(inseeCode, date, pollenData) {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.POLLEN_CACHE)
        const cache = data ? JSON.parse(data) : {}
        const key = `${inseeCode}_${date}`

        cache[key] = {
            data: pollenData,
            cachedAt: Date.now(),
        }

        // Clean old entries
        const now = Date.now()
        for (const k in cache) {
            if (now - cache[k].cachedAt > CACHE_DURATION * 2) {
                delete cache[k]
            }
        }

        localStorage.setItem(STORAGE_KEYS.POLLEN_CACHE, JSON.stringify(cache))
    } catch {
        // Ignore storage errors
    }
}

// ==================== Export All Data ====================

export function exportAllData() {
    return {
        user: getUser(),
        cities: getCities(),
        alerts: getAlerts(),
        settings: getSettings(),
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
    }
}

export function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
    })
}

export default {
    // User
    getUser,
    setUser,
    clearUser,

    // Cities
    getCities,
    saveCities,
    addCity,
    removeCity,
    setMainCity,
    getMainCity,

    // Alerts
    getAlerts,
    saveAlerts,
    addAlert,
    updateAlert,
    removeAlert,
    toggleAlert,

    // Settings
    getSettings,
    saveSettings,
    updateSetting,

    // Cache
    getLocalDateString,
    getCachedPollenData,
    setCachedPollenData,
    clearCachedPollenData,

    // Utilities
    exportAllData,
    clearAllData,
}
