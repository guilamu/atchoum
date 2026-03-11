/**
 * Diagnostic API Service
 * Handles all diagnostic mode API calls (Phase 3)
 * 
 * NOTE: Symptom data comes from the Health tab (daily_entries + symptom_logs).
 * This service only handles consent, analysis, results and timeline.
 */

import { getToken } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Helper function for authenticated API calls
 */
async function apiCall(endpoint, options = {}) {
    const token = getToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Erreur API');
    }

    return data;
}

// ==========================================
// STATUS & CONSENT
// ==========================================

/**
 * Get diagnostic mode status
 */
export async function getStatus() {
    return apiCall('/diagnostic/status');
}

/**
 * Activate diagnostic mode consent
 */
export async function activateConsent() {
    return apiCall('/diagnostic/consent', {
        method: 'POST',
        body: JSON.stringify({ activate: true }),
    });
}

/**
 * Deactivate diagnostic mode consent
 */
export async function deactivateConsent() {
    return apiCall('/diagnostic/consent', {
        method: 'POST',
        body: JSON.stringify({ activate: false }),
    });
}

// ==========================================
// ANALYSIS
// ==========================================

/**
 * Run diagnostic analysis (Pearson correlation)
 */
export async function runAnalysis() {
    return apiCall('/diagnostic/analyze', {
        method: 'POST',
    });
}

/**
 * Get all analysis results
 */
export async function getResults() {
    return apiCall('/diagnostic/results');
}

/**
 * Get a specific analysis result
 * @param {number} resultId
 */
export async function getResult(resultId) {
    return apiCall(`/diagnostic/results/${resultId}`);
}

// ==========================================
// TIMELINE
// ==========================================

/**
 * Get timeline data (symptoms + pollen aligned by date)
 * @param {number} days - number of days
 */
export async function getTimeline(days = 30) {
    return apiCall(`/diagnostic/timeline?days=${days}`);
}

// ==========================================
// DATA MANAGEMENT (RGPD)
// ==========================================

/**
 * Delete all diagnostic data (results only, health data stays)
 */
export async function deleteAllData() {
    return apiCall('/diagnostic/data', {
        method: 'DELETE',
    });
}
