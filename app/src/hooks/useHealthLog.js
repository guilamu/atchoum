import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as healthLogApi from '../services/healthLogApi';

/**
 * Hook for managing health log data (symptoms and medications)
 */
export function useHealthLog() {
    const { isAuthenticated } = useAuth();
    
    // Catalogs (loaded once)
    const [symptoms, setSymptoms] = useState([]);
    const [symptomsGrouped, setSymptomsGrouped] = useState({});
    const [medications, setMedications] = useState([]);
    const [medicationsGrouped, setMedicationsGrouped] = useState({});
    
    // Current day data
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyEntry, setDailyEntry] = useState(null);
    const [medicationIntakes, setMedicationIntakes] = useState([]);
    
    // Loading states
    const [loadingCatalogs, setLoadingCatalogs] = useState(true);
    const [loadingEntry, setLoadingEntry] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Load catalogs on mount
    useEffect(() => {
        if (!isAuthenticated) {
            setLoadingCatalogs(false);
            return;
        }

        const loadCatalogs = async () => {
            setLoadingCatalogs(true);
            setError(null);

            try {
                const [symptomsRes, medsRes] = await Promise.all([
                    healthLogApi.getSymptoms(),
                    healthLogApi.getMedications(),
                ]);

                if (symptomsRes.success) {
                    setSymptoms(symptomsRes.symptoms);
                    setSymptomsGrouped(symptomsRes.grouped);
                }

                if (medsRes.success) {
                    setMedications(medsRes.medications);
                    setMedicationsGrouped(medsRes.grouped);
                }
            } catch (err) {
                console.error('Failed to load catalogs:', err);
                setError('Impossible de charger les données');
            } finally {
                setLoadingCatalogs(false);
            }
        };

        loadCatalogs();
    }, [isAuthenticated]);

    // Load daily entry when date changes
    useEffect(() => {
        if (!isAuthenticated || !selectedDate) {
            return;
        }

        const loadDailyData = async () => {
            setLoadingEntry(true);
            setError(null);

            try {
                const [entryRes, intakesRes] = await Promise.all([
                    healthLogApi.getDailyEntry(selectedDate),
                    healthLogApi.getMedicationIntakes(selectedDate),
                ]);

                if (entryRes.success) {
                    setDailyEntry(entryRes.entry);
                }

                if (intakesRes.success) {
                    setMedicationIntakes(intakesRes.intakes);
                }
            } catch (err) {
                console.error('Failed to load daily data:', err);
                setError('Impossible de charger les données du jour');
            } finally {
                setLoadingEntry(false);
            }
        };

        loadDailyData();
    }, [isAuthenticated, selectedDate]);

    /**
     * Save daily entry with symptoms
     */
    const saveDailyEntry = useCallback(async (data) => {
        if (!isAuthenticated) return { success: false, error: 'Non connecté' };

        setSaving(true);
        setError(null);

        try {
            const result = await healthLogApi.saveDailyEntry({
                date: selectedDate,
                notes: data.notes,
                symptoms: data.symptoms,
            });

            if (result.success) {
                // Reload entry to get updated data
                const entryRes = await healthLogApi.getDailyEntry(selectedDate);
                if (entryRes.success) {
                    setDailyEntry(entryRes.entry);
                }
            }

            return result;
        } catch (err) {
            console.error('Failed to save entry:', err);
            setError('Erreur lors de la sauvegarde');
            return { success: false, error: err.message };
        } finally {
            setSaving(false);
        }
    }, [isAuthenticated, selectedDate]);

    /**
     * Add medication intake
     */
    const addMedicationIntake = useCallback(async (data) => {
        if (!isAuthenticated) return { success: false, error: 'Non connecté' };

        setSaving(true);
        setError(null);

        try {
            const result = await healthLogApi.addMedicationIntake({
                medication_id: data.medicationId,
                custom_medication_name: data.customName,
                intake_datetime: data.intakeDatetime || new Date().toISOString(),
                dosage: data.dosage,
                notes: data.notes,
            });

            if (result.success) {
                // Reload intakes
                const intakesRes = await healthLogApi.getMedicationIntakes(selectedDate);
                if (intakesRes.success) {
                    setMedicationIntakes(intakesRes.intakes);
                }
            }

            return result;
        } catch (err) {
            console.error('Failed to add medication intake:', err);
            setError('Erreur lors de l\'enregistrement');
            return { success: false, error: err.message };
        } finally {
            setSaving(false);
        }
    }, [isAuthenticated, selectedDate]);

    /**
     * Delete medication intake
     */
    const deleteMedicationIntake = useCallback(async (intakeId) => {
        if (!isAuthenticated) return { success: false, error: 'Non connecté' };

        try {
            const result = await healthLogApi.deleteMedicationIntake(intakeId);

            if (result.success) {
                setMedicationIntakes(prev => prev.filter(i => i.id !== intakeId));
            }

            return result;
        } catch (err) {
            console.error('Failed to delete intake:', err);
            return { success: false, error: err.message };
        }
    }, [isAuthenticated]);

    /**
     * Change selected date
     */
    const changeDate = useCallback((date) => {
        // Don't allow future dates
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            date = today;
        }
        setSelectedDate(date);
    }, []);

    /**
     * Go to previous day
     */
    const previousDay = useCallback(() => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() - 1);
        setSelectedDate(current.toISOString().split('T')[0]);
    }, [selectedDate]);

    /**
     * Go to next day (max today)
     */
    const nextDay = useCallback(() => {
        const current = new Date(selectedDate);
        const today = new Date();
        current.setDate(current.getDate() + 1);
        
        if (current <= today) {
            setSelectedDate(current.toISOString().split('T')[0]);
        }
    }, [selectedDate]);

    /**
     * Check if selected date is today
     */
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return {
        // Catalogs
        symptoms,
        symptomsGrouped,
        medications,
        medicationsGrouped,
        
        // Current data
        selectedDate,
        dailyEntry,
        medicationIntakes,
        
        // State
        loadingCatalogs,
        loadingEntry,
        saving,
        error,
        isToday,
        
        // Actions
        changeDate,
        previousDay,
        nextDay,
        saveDailyEntry,
        addMedicationIntake,
        deleteMedicationIntake,
    };
}

/**
 * Hook for health summary data (for charts)
 */
export function useHealthSummary(startDate = null, endDate = null) {
    const { isAuthenticated } = useAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        const loadSummary = async () => {
            setLoading(true);
            setError(null);

            try {
                const result = await healthLogApi.getHealthSummary(startDate, endDate);
                if (result.success) {
                    setSummary(result);
                }
            } catch (err) {
                console.error('Failed to load health summary:', err);
                setError('Impossible de charger le résumé');
            } finally {
                setLoading(false);
            }
        };

        loadSummary();
    }, [isAuthenticated, startDate, endDate]);

    return { summary, loading, error };
}
