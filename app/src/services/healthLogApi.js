/**
 * Health Log API Service
 * Handles symptom and medication tracking API calls
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
// SYMPTOMS
// ==========================================

/**
 * Get all symptoms from catalog
 */
export async function getSymptoms() {
    return apiCall('/symptoms');
}

// ==========================================
// MEDICATIONS
// ==========================================

/**
 * Get all medications from catalog
 */
export async function getMedications() {
    return apiCall('/medications');
}

// ==========================================
// DAILY ENTRIES
// ==========================================

/**
 * Get daily entry for a specific date
 * @param {string} date - YYYY-MM-DD format
 */
export async function getDailyEntry(date) {
    return apiCall(`/daily-entries/${date}`);
}

/**
 * Get daily entries for a date range
 * @param {string} startDate - YYYY-MM-DD format
 * @param {string} endDate - YYYY-MM-DD format
 */
export async function getDailyEntries(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiCall(`/daily-entries?${params.toString()}`);
}

/**
 * Save daily entry with symptoms
 * @param {Object} data - { date, notes, symptoms: [{ symptom_id, severity, notes }] }
 */
export async function saveDailyEntry(data) {
    return apiCall('/daily-entries', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ==========================================
// MEDICATION INTAKES
// ==========================================

/**
 * Get medication intakes for a date
 * @param {string} date - YYYY-MM-DD format (optional)
 * @param {string} startDate - YYYY-MM-DD format (optional)
 * @param {string} endDate - YYYY-MM-DD format (optional)
 */
export async function getMedicationIntakes(date = null, startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiCall(`/medication-intakes?${params.toString()}`);
}

/**
 * Record a medication intake
 * @param {Object} data - { medication_id, custom_medication_name, intake_datetime, dosage, notes }
 */
export async function addMedicationIntake(data) {
    return apiCall('/medication-intakes', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Delete a medication intake
 * @param {number} intakeId
 */
export async function deleteMedicationIntake(intakeId) {
    return apiCall(`/medication-intakes/${intakeId}`, {
        method: 'DELETE',
    });
}

// ==========================================
// HEALTH SUMMARY
// ==========================================

/**
 * Get health summary for charts
 * @param {string} startDate - YYYY-MM-DD format (optional, default 14 days ago)
 * @param {string} endDate - YYYY-MM-DD format (optional, default today)
 */
export async function getHealthSummary(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiCall(`/health-summary?${params.toString()}`);
}
