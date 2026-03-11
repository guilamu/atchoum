import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as diagnosticApi from '../services/diagnosticApi';

/**
 * Hook for diagnostic mode status and consent
 */
export function useDiagnosticStatus() {
    const { isAuthenticated } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadStatus = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await diagnosticApi.getStatus();
            if (result.success) {
                setStatus(result.status);
            }
        } catch (err) {
            console.error('Failed to load diagnostic status:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    const activate = useCallback(async () => {
        try {
            const result = await diagnosticApi.activateConsent();
            if (result.success) {
                await loadStatus();
            }
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    }, [loadStatus]);

    const deactivate = useCallback(async () => {
        try {
            const result = await diagnosticApi.deactivateConsent();
            if (result.success) {
                await loadStatus();
            }
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    }, [loadStatus]);

    return { status, loading, error, activate, deactivate, refresh: loadStatus };
}

/**
 * Hook for diagnostic analysis results
 */
export function useDiagnosticResults() {
    const { isAuthenticated } = useAuth();
    const [results, setResults] = useState([]);
    const [currentResult, setCurrentResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);

    // Load results list
    const loadResults = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await diagnosticApi.getResults();
            if (result.success) {
                setResults(result.results);
                // Auto-select latest
                if (result.results.length > 0 && !currentResult) {
                    setCurrentResult(result.results[0]);
                }
            }
        } catch (err) {
            console.error('Failed to load results:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, currentResult]);

    useEffect(() => {
        loadResults();
    }, [loadResults]);

    // Load specific result
    const loadResult = useCallback(async (resultId) => {
        if (!isAuthenticated) return;

        setLoading(true);
        try {
            const result = await diagnosticApi.getResult(resultId);
            if (result.success) {
                setCurrentResult(result.result);
            }
        } catch (err) {
            console.error('Failed to load result:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Run analysis
    const runAnalysis = useCallback(async () => {
        if (!isAuthenticated) return { success: false, error: 'Non connecté' };

        setAnalyzing(true);
        setError(null);

        try {
            const result = await diagnosticApi.runAnalysis();
            if (result.success) {
                setCurrentResult(result.result);
                await loadResults();
            }
            return result;
        } catch (err) {
            console.error('Analysis failed:', err);
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setAnalyzing(false);
        }
    }, [isAuthenticated, loadResults]);

    return {
        results, currentResult, loading, analyzing, error,
        loadResults, loadResult, runAnalysis,
    };
}

/**
 * Hook for diagnostic timeline
 */
export function useDiagnosticTimeline(days = 30) {
    const { isAuthenticated } = useAuth();
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadTimeline = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await diagnosticApi.getTimeline(days);
            if (result.success) {
                setTimeline(result.timeline);
            }
        } catch (err) {
            console.error('Failed to load timeline:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, days]);

    useEffect(() => {
        loadTimeline();
    }, [loadTimeline]);

    return { timeline, loading, error, refresh: loadTimeline };
}
