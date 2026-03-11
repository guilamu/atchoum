/**
 * Géo API Gouv Service
 * Handles city search and autocomplete using the French government API
 * 
 * API Documentation: https://geo.api.gouv.fr/
 */

const GEO_API_BASE = 'https://geo.api.gouv.fr'

/**
 * Search communes by name or postal code
 * @param {string} query - Search query (city name or postal code)
 * @param {number} limit - Maximum number of results (default 10)
 * @returns {Promise<Array>} Array of matching communes
 */
export async function searchCities(query, limit = 10) {
    if (!query || query.length < 2) {
        return []
    }

    // Determine if query is a postal code (5 digits)
    const isPostalCode = /^\d{5}$/.test(query)
    const isPartialPostalCode = /^\d{2,4}$/.test(query)

    let url
    if (isPostalCode) {
        // Search by postal code
        url = `${GEO_API_BASE}/communes?codePostal=${query}&fields=nom,code,codesPostaux,population,departement,region&limit=${limit}`
    } else if (isPartialPostalCode) {
        // Partial postal code - search by department prefix
        url = `${GEO_API_BASE}/communes?codeDepartement=${query.slice(0, 2)}&fields=nom,code,codesPostaux,population,departement,region&limit=${limit}`
    } else {
        // Search by name
        url = `${GEO_API_BASE}/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,population,departement,region&boost=population&limit=${limit}`
    }

    try {
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        return data.map(formatCommuneResult)
    } catch (error) {
        console.error('Error searching cities:', error)
        return []
    }
}

/**
 * Get commune details by INSEE code
 * @param {string} inseeCode - The INSEE code (5 digits)
 * @returns {Promise<Object|null>} Commune data or null
 */
export async function getCityByInseeCode(inseeCode) {
    if (!inseeCode || inseeCode.length !== 5) {
        return null
    }

    try {
        const response = await fetch(
            `${GEO_API_BASE}/communes/${inseeCode}?fields=nom,code,codesPostaux,population,departement,region,centre`
        )

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        return formatCommuneResult(data)
    } catch (error) {
        console.error('Error fetching city:', error)
        return null
    }
}

/**
 * Get nearby communes by coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of nearby communes
 */
export async function getNearbyCities(lat, lon, limit = 5) {
    try {
        const response = await fetch(
            `${GEO_API_BASE}/communes?lat=${lat}&lon=${lon}&fields=nom,code,codesPostaux,population,departement,region&limit=${limit}`
        )

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        return data.map(formatCommuneResult)
    } catch (error) {
        console.error('Error fetching nearby cities:', error)
        return []
    }
}

/**
 * Use browser geolocation to find the user's current city
 * @returns {Promise<Object|null>} Current city or null
 */
export function getCurrentLocationCity() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported')
            resolve(null)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                const cities = await getNearbyCities(latitude, longitude, 1)
                resolve(cities[0] || null)
            },
            (error) => {
                console.warn('Geolocation error:', error.message)
                resolve(null)
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
            }
        )
    })
}

/**
 * Format commune data from API response to app format
 */
function formatCommuneResult(commune) {
    return {
        inseeCode: commune.code,
        name: commune.nom,
        postalCodes: commune.codesPostaux || [],
        postalCode: commune.codesPostaux?.[0] || '',
        population: commune.population || 0,
        department: commune.departement
            ? { code: commune.departement.code, name: commune.departement.nom }
            : null,
        region: commune.region
            ? { code: commune.region.code, name: commune.region.nom }
            : null,
        coordinates: commune.centre
            ? { lat: commune.centre.coordinates[1], lon: commune.centre.coordinates[0] }
            : null,

        // Display helpers
        displayName: commune.nom,
        displayLocation: commune.departement
            ? `${commune.nom} (${commune.departement.code})`
            : commune.nom,
        displayFull: commune.departement && commune.codesPostaux?.[0]
            ? `${commune.nom} - ${commune.codesPostaux[0]} (${commune.departement.nom})`
            : commune.nom,
    }
}

/**
 * Debounced search (for autocomplete)
 */
let searchTimeout = null
export function searchCitiesDebounced(query, callback, delay = 300) {
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }

    if (!query || query.length < 2) {
        callback([])
        return
    }

    searchTimeout = setTimeout(async () => {
        const results = await searchCities(query)
        callback(results)
    }, delay)
}

export default {
    searchCities,
    searchCitiesDebounced,
    getCityByInseeCode,
    getNearbyCities,
    getCurrentLocationCity,
}
