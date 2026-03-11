import { useState, useEffect, useCallback } from 'react'
import { searchCities, getCityByInseeCode, getCurrentLocationCity } from '../services/geoApi'
import { useAuth } from '../contexts/AuthContext'
import { getCities as apiGetCities, addCity as apiAddCity, deleteCity as apiDeleteCity, setMainCity as apiSetMainCity } from '../services/authService'
import {
    getCities as localGetCities,
    addCity as localAddCity,
    removeCity as localRemoveCity,
    setMainCity as localSetMainCity,
    saveCities as localSaveCities,
} from '../services/storage'

/**
 * Hook for city search with debouncing
 */
export function useCitySearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        const timeoutId = setTimeout(async () => {
            try {
                const cities = await searchCities(query, 8)
                setResults(cities)
            } catch (err) {
                setError(err.message)
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [query])

    const clear = useCallback(() => {
        setQuery('')
        setResults([])
    }, [])

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        clear,
    }
}

/**
 * Hook for managing user's cities
 * Uses API when authenticated, localStorage when not
 */
export function useCities() {
    const { isAuthenticated } = useAuth()
    const [cities, setCitiesState] = useState([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    // Load cities on mount or auth change
    useEffect(() => {
        const loadCities = async () => {
            setLoading(true)

            if (isAuthenticated) {
                try {
                    const apiCities = await apiGetCities()
                    // Transform API format to app format
                    const formattedCities = apiCities.map(c => ({
                        id: c.id,
                        inseeCode: c.insee_code,
                        name: c.city_name,
                        isMain: c.is_main,
                        postalCode: '', // Not stored in API
                    }))
                    setCitiesState(formattedCities)
                    // Also update localStorage as cache
                    localSaveCities(formattedCities)
                } catch (err) {
                    console.error('Failed to load cities from API:', err)
                    // Fallback to localStorage
                    setCitiesState(localGetCities())
                }
            } else {
                setCitiesState(localGetCities())
            }

            setLoading(false)
        }

        loadCities()
    }, [isAuthenticated])

    const addCity = useCallback(async (city) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                const result = await apiAddCity(city.inseeCode, city.name)
                if (result.success && result.city) {
                    const newCity = {
                        id: result.city.id,
                        inseeCode: result.city.insee_code,
                        name: result.city.city_name,
                        isMain: result.city.is_main,
                        postalCode: city.postalCode || '',
                    }
                    const updatedCities = [...cities, newCity]
                    setCitiesState(updatedCities)
                    localSaveCities(updatedCities)
                    return updatedCities
                }
            } else {
                const updatedCities = localAddCity(city)
                setCitiesState(updatedCities)
                return updatedCities
            }
        } catch (err) {
            console.error('Failed to add city:', err)
            // Fallback to local
            const updatedCities = localAddCity(city)
            setCitiesState(updatedCities)
            return updatedCities
        } finally {
            setSyncing(false)
        }

        return cities
    }, [isAuthenticated, cities])

    const removeCity = useCallback(async (cityId) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                await apiDeleteCity(cityId)
            }

            const updatedCities = cities.filter(c => c.id !== cityId)

            // If we removed the main city, set first as main
            if (updatedCities.length > 0 && !updatedCities.some(c => c.isMain)) {
                updatedCities[0].isMain = true
                if (isAuthenticated) {
                    await apiSetMainCity(updatedCities[0].id)
                }
            }

            setCitiesState(updatedCities)
            localSaveCities(updatedCities)
            return updatedCities
        } catch (err) {
            console.error('Failed to remove city:', err)
            const updatedCities = localRemoveCity(cityId)
            setCitiesState(updatedCities)
            return updatedCities
        } finally {
            setSyncing(false)
        }
    }, [isAuthenticated, cities])

    const setMainCity = useCallback(async (cityId) => {
        setSyncing(true)

        try {
            if (isAuthenticated) {
                await apiSetMainCity(cityId)
            }

            const updatedCities = cities.map(c => ({
                ...c,
                isMain: c.id === cityId,
            }))

            setCitiesState(updatedCities)
            localSaveCities(updatedCities)
            return updatedCities
        } catch (err) {
            console.error('Failed to set main city:', err)
            const updatedCities = localSetMainCity(cityId)
            setCitiesState(updatedCities)
            return updatedCities
        } finally {
            setSyncing(false)
        }
    }, [isAuthenticated, cities])

    const mainCity = cities.find(c => c.isMain) || cities[0] || null
    const otherCities = cities.filter(c => !c.isMain)

    return {
        cities,
        mainCity,
        otherCities,
        loading,
        syncing,
        addCity,
        removeCity,
        setMainCity,
    }
}

/**
 * Hook for detecting user's current location
 */
export function useCurrentLocation() {
    const [city, setCity] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const detect = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const detected = await getCurrentLocationCity()
            if (detected) {
                setCity(detected)
            } else {
                setError('Impossible de détecter votre position')
            }
        } catch (err) {
            setError(err.message || 'Erreur de géolocalisation')
        } finally {
            setLoading(false)
        }
    }, [])

    return { city, loading, error, detect }
}

export default {
    useCitySearch,
    useCities,
    useCurrentLocation,
}
