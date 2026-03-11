/**
 * Atmo Data API Service
 * Handles pollen data fetching via local PHP backend proxy
 * 
 * The backend proxy handles JWT authentication and CORS
 * API Documentation: https://admindata.atmo-france.org/api/doc/v2
 */

// Backend proxy URL (PHP server)
const API_PROXY_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Direct API (for future backend-less deployment with serverless)
const ATMO_API_BASE = 'https://admindata.atmo-france.org/api'

// Pollen types mapping (French name -> API suffix)
export const POLLEN_TYPES = {
    aulne: { code: 'aul', label: 'Aulne', season: 'Janvier - Juin' },
    bouleau: { code: 'boul', label: 'Bouleau', season: 'Mars - Juin' },
    olivier: { code: 'oliv', label: 'Olivier', season: 'Avril - Juin' },
    graminees: { code: 'gram', label: 'Graminées', season: 'Mars - Août' },
    armoise: { code: 'arm', label: 'Armoise', season: 'Juin - Octobre' },
    ambroisie: { code: 'ambr', label: 'Ambroisie', season: 'Juin - Octobre' },
}

// Pollen level colors and labels (from Atmo Data)
export const POLLEN_LEVELS = {
    0: { label: 'Indisponible', color: '#DDDDDD' },
    1: { label: 'Très faible', color: '#50F0E6' },
    2: { label: 'Faible', color: '#50CCAA' },
    3: { label: 'Modéré', color: '#F0E641' },
    4: { label: 'Élevé', color: '#FF5050' },
    5: { label: 'Très élevé', color: '#960032' },
    6: { label: 'Extrêmement élevé', color: '#872181' },
}

// Track if backend is available
let backendAvailable = null

/**
 * Get today's date in local timezone (YYYY-MM-DD)
 * Avoids UTC bug where toISOString().split('T')[0] returns yesterday between midnight and 1-2AM CET/CEST
 */
function getLocalDate() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Check if backend proxy is available
 */
async function checkBackendAvailable() {
    if (backendAvailable !== null) {
        return backendAvailable
    }

    try {
        const response = await fetch(`${API_PROXY_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        })
        backendAvailable = response.ok
    } catch {
        backendAvailable = false
    }

    if (!backendAvailable) {
        console.warn('Backend proxy not available, using mock data')
    }

    return backendAvailable
}

/**
 * Fetch pollen data for a specific commune
 * @param {string} inseeCode - INSEE code of the commune (5 digits)
 * @param {string} date - Optional date in YYYY-MM-DD format (defaults to today)
 * @returns {Promise<Object>} Pollen data or null
 */
export async function getPollenData(inseeCode, date = null) {
    // Use local date helper to avoid UTC date bug (midnight-1AM in CET returns yesterday)
    const queryDate = date || getLocalDate()

    // Try backend proxy first
    const useBackend = await checkBackendAvailable()

    if (useBackend) {
        try {
            const response = await fetch(
                `${API_PROXY_URL}/pollen?code_zone=${inseeCode}&date=${queryDate}`
            )

            if (response.ok) {
                const data = await response.json()
                if (data && !data.error) {
                    return data
                }
            }
        } catch (error) {
            console.warn('Backend request failed:', error.message)
        }
    }

    // Fallback to mock data
    return getMockPollenData(inseeCode, queryDate)
}

/**
 * Fetch pollen forecast (J+1, J+2)
 * @param {string} inseeCode - INSEE code of the commune
 * @returns {Promise<Array>} Array of forecast data for next days
 */
export async function getPollenForecast(inseeCode) {
    const useBackend = await checkBackendAvailable()

    if (useBackend) {
        try {
            const response = await fetch(
                `${API_PROXY_URL}/pollen/forecast?code_zone=${inseeCode}`
            )

            if (response.ok) {
                const data = await response.json()
                if (Array.isArray(data) && data.length > 0) {
                    // Add Date objects
                    return data.map(day => ({
                        ...day,
                        date: new Date(day.date || day.dateEch),
                    }))
                }
            }
        } catch (error) {
            console.warn('Backend forecast request failed:', error.message)
        }
    }

    // Fallback: generate mock forecast
    return getMockForecast(inseeCode)
}

/**
 * Mock pollen data for development/offline use
 */
function getMockPollenData(inseeCode, date) {
    const today = new Date()
    const queryDate = date ? new Date(date) : today

    // Simulate seasonal variation
    const month = queryDate.getMonth()
    const isSpring = month >= 2 && month <= 5 // March to June
    const isSummer = month >= 5 && month <= 8 // June to September

    // Generate realistic mock levels based on season
    const getSeasonalLevel = (pollenType) => {
        if (pollenType === 'gram' && (isSpring || isSummer)) return Math.floor(Math.random() * 3) + 3
        if (pollenType === 'boul' && isSpring) return Math.floor(Math.random() * 3) + 2
        if (pollenType === 'aul' && month >= 0 && month <= 5) return Math.floor(Math.random() * 2) + 1
        if ((pollenType === 'arm' || pollenType === 'ambr') && isSummer) return Math.floor(Math.random() * 3) + 2
        return Math.floor(Math.random() * 2)
    }

    const pollens = [
        { name: 'Aulne', code: 'aul', level: getSeasonalLevel('aul'), concentration: 0 },
        { name: 'Bouleau', code: 'boul', level: getSeasonalLevel('boul'), concentration: 0 },
        { name: 'Olivier', code: 'oliv', level: getSeasonalLevel('oliv'), concentration: 0 },
        { name: 'Graminées', code: 'gram', level: getSeasonalLevel('gram'), concentration: 0 },
        { name: 'Armoise', code: 'arm', level: getSeasonalLevel('arm'), concentration: 0 },
        { name: 'Ambroisie', code: 'ambr', level: getSeasonalLevel('ambr'), concentration: 0 },
    ]

    const globalLevel = Math.max(...pollens.map(p => p.level))
    const responsiblePollens = pollens
        .filter(p => p.level === globalLevel && p.level > 0)
        .map(p => p.name)
        .join(', ')

    return {
        inseeCode: inseeCode,
        cityName: '', // Will be resolved from city data
        date: queryDate.toISOString().split('T')[0],
        dateEch: queryDate.toISOString(),
        dateDif: today.toISOString(),
        source: 'Données simulées (démarrer le backend pour données réelles)',

        globalLevel,
        globalLabel: POLLEN_LEVELS[globalLevel]?.label || 'Indisponible',
        globalColor: POLLEN_LEVELS[globalLevel]?.color || '#DDDDDD',

        isAlert: globalLevel >= 4,
        pollenResp: responsiblePollens,

        pollens,
    }
}

/**
 * Mock forecast for development
 */
function getMockForecast(inseeCode) {
    const forecast = []
    const today = new Date()

    for (let i = 0; i <= 6; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        const data = getMockPollenData(inseeCode, dateStr)
        forecast.push({
            ...data,
            date: date,
            isToday: i === 0,
            isTomorrow: i === 1,
        })
    }

    return forecast
}

/**
 * Fetch pollen history for the last N days
 * @param {string} inseeCode - INSEE code of the commune
 * @param {number} days - Number of days of history (max 30)
 * @returns {Promise<Object>} { success, history: [{date, globalLevel, pollens}] }
 */
export async function getPollenHistory(inseeCode, days = 14) {
    const useBackend = await checkBackendAvailable()

    if (useBackend) {
        try {
            const response = await fetch(
                `${API_PROXY_URL}/pollen/history?code_zone=${inseeCode}&days=${days}`
            )

            if (response.ok) {
                const data = await response.json()
                if (data && data.success) {
                    return data
                }
            }
        } catch (error) {
            console.warn('Backend history request failed:', error.message)
        }
    }

    // Fallback: generate mock history
    const history = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const mock = getMockPollenData(inseeCode, dateStr)
        history.push({
            date: dateStr,
            globalLevel: mock.globalLevel,
            pollens: mock.pollens,
        })
    }
    return { success: true, inseeCode, days, count: history.length, history }
}

/**
 * Force reset backend availability check
 */
export function resetBackendCheck() {
    backendAvailable = null
}

export default {
    getPollenData,
    getPollenForecast,
    resetBackendCheck,
    POLLEN_TYPES,
    POLLEN_LEVELS,
}
