import { useState, useEffect, useCallback, useRef } from 'react'
import { getPollenData, getPollenForecast, getPollenHistory, POLLEN_LEVELS } from '../services/atmoApi'
import { getCachedPollenData, setCachedPollenData, clearCachedPollenData, getLocalDateString, getMainCity } from '../services/storage'

/**
 * Hook for fetching pollen data for a city
 * Handles:
 * - Local date (not UTC) to avoid midnight-1AM CET bug
 * - Cache bypass on manual refresh
 * - Auto-refresh when tab becomes visible (if date changed or data is stale)
 *
 * @param {string} inseeCode - INSEE code of the city
 * @param {string} date - Optional date (YYYY-MM-DD format)
 */
export function usePollenData(inseeCode, date = null) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const lastFetchDateRef = useRef(null)

    const fetchData = useCallback(async (bypassCache = false) => {
        if (!inseeCode) {
            setData(null)
            setLoading(false)
            return
        }

        // Use local date to avoid UTC bug (midnight-1AM in CET returns yesterday)
        const dateStr = date || getLocalDateString()
        lastFetchDateRef.current = dateStr

        // Check cache first (unless bypassed)
        if (!bypassCache) {
            const cached = getCachedPollenData(inseeCode, dateStr)
            if (cached) {
                setData(cached)
                setLoading(false)
                return
            }
        } else {
            // Clear cache for this city to force fresh fetch
            clearCachedPollenData(inseeCode, dateStr)
        }

        setLoading(true)
        setError(null)

        try {
            const result = await getPollenData(inseeCode, dateStr)
            if (result) {
                setData(result)
                setCachedPollenData(inseeCode, dateStr, result)
            } else {
                setError('Données non disponibles')
            }
        } catch (err) {
            setError(err.message || 'Erreur de chargement')
        } finally {
            setLoading(false)
        }
    }, [inseeCode, date])

    // Initial fetch
    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Auto-refresh: when tab becomes visible, check if date changed
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && inseeCode) {
                const currentDate = date || getLocalDateString()
                if (lastFetchDateRef.current !== currentDate) {
                    // Date has changed (e.g. midnight passed), force refresh
                    fetchData(true)
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [fetchData, inseeCode, date])

    // Manual refresh: always bypass cache
    const refresh = useCallback(() => {
        fetchData(true)
    }, [fetchData])

    return { data, loading, error, refresh }
}

/**
 * Hook for fetching pollen forecast (next 7 days)
 * @param {string} inseeCode - INSEE code of the city
 */
export function usePollenForecast(inseeCode) {
    const [forecast, setForecast] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!inseeCode) {
            setForecast([])
            setLoading(false)
            return
        }

        const fetchForecast = async () => {
            setLoading(true)
            setError(null)

            try {
                const results = await getPollenForecast(inseeCode)
                setForecast(results)
            } catch (err) {
                setError(err.message || 'Erreur de chargement')
            } finally {
                setLoading(false)
            }
        }

        fetchForecast()
    }, [inseeCode])

    return { forecast, loading, error }
}

/**
 * Hook for fetching pollen history (last N days)
 * @param {string} inseeCode - INSEE code of the city
 * @param {number} days - Number of days
 */
export function usePollenHistory(inseeCode, days = 14) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadHistory = useCallback(async () => {
        if (!inseeCode) {
            setHistory([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const result = await getPollenHistory(inseeCode, days)
            if (result && result.success) {
                setHistory(result.history)
            } else {
                setError('Données non disponibles')
            }
        } catch (err) {
            setError(err.message || 'Erreur de chargement')
        } finally {
            setLoading(false)
        }
    }, [inseeCode, days])

    useEffect(() => {
        loadHistory()
    }, [loadHistory])

    return { history, loading, error, refresh: loadHistory }
}

/**
 * Hook for the main city's pollen data
 * Automatically uses the user's main city
 */
export function useMainCityPollen() {
    const [mainCity, setMainCity] = useState(null)

    useEffect(() => {
        const city = getMainCity()
        setMainCity(city)
    }, [])

    const pollenData = usePollenData(mainCity?.inseeCode)

    return {
        city: mainCity,
        ...pollenData,
    }
}

export default {
    usePollenData,
    usePollenForecast,
    useMainCityPollen,
}
