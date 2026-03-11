/**
 * Authentication Service
 * Handles API calls for passwordless authentication
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Request a login code to be sent to email
 */
export async function requestCode(email) {
    const response = await fetch(`${API_URL}/auth/request-code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi du code');
    }

    return data;
}

/**
 * Verify code and get JWT token
 */
export async function verifyCode(email, code) {
    const response = await fetch(`${API_URL}/auth/verify-code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Code invalide');
    }

    // Store token
    if (data.token) {
        localStorage.setItem('atchoum_token', data.token);
        localStorage.setItem('atchoum_user', JSON.stringify(data.user));
    }

    return data;
}

/**
 * Get current user from API
 */
export async function getCurrentUser() {
    const token = getToken();

    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            // Token invalid, clear it
            logout();
            return null;
        }

        const data = await response.json();
        return data.user;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

/**
 * Get stored token
 */
export function getToken() {
    return localStorage.getItem('atchoum_token');
}

/**
 * Get stored user
 */
export function getStoredUser() {
    const userJson = localStorage.getItem('atchoum_user');
    return userJson ? JSON.parse(userJson) : null;
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
    return !!getToken();
}

/**
 * Logout user
 */
export function logout() {
    localStorage.removeItem('atchoum_token');
    localStorage.removeItem('atchoum_user');
}

/**
 * Make authenticated API request
 */
export async function authFetch(url, options = {}) {
    const token = getToken();

    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        logout();
        window.location.href = '/login';
        throw new Error('Session expirée');
    }

    return response;
}

// ==========================================
// Cities API
// ==========================================

export async function getCities() {
    const response = await authFetch('/cities');
    const data = await response.json();
    return data.cities || [];
}

export async function addCity(inseeCode, cityName) {
    const response = await authFetch('/cities', {
        method: 'POST',
        body: { insee_code: inseeCode, city_name: cityName },
    });
    return response.json();
}

export async function deleteCity(cityId) {
    const response = await authFetch(`/cities/${cityId}`, {
        method: 'DELETE',
    });
    return response.json();
}

export async function setMainCity(cityId) {
    const response = await authFetch(`/cities/${cityId}/main`, {
        method: 'PUT',
    });
    return response.json();
}

// ==========================================
// Alerts API
// ==========================================

export async function getAlerts() {
    const response = await authFetch('/alerts');
    const data = await response.json();
    return data.alerts || [];
}

export async function addAlert(alertData) {
    const response = await authFetch('/alerts', {
        method: 'POST',
        body: alertData,
    });
    return response.json();
}

export async function updateAlert(alertId, alertData) {
    const response = await authFetch(`/alerts/${alertId}`, {
        method: 'PUT',
        body: alertData,
    });
    return response.json();
}

export async function deleteAlert(alertId) {
    const response = await authFetch(`/alerts/${alertId}`, {
        method: 'DELETE',
    });
    return response.json();
}
