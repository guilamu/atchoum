import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    isLoggedIn,
    getStoredUser,
    getCurrentUser,
    logout as authLogout,
    requestCode,
    verifyCode
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            if (isLoggedIn()) {
                // Try to get user from storage first (fast)
                const storedUser = getStoredUser();
                if (storedUser) {
                    setUser(storedUser);
                    setIsAuthenticated(true);
                }

                // Then verify with API (async)
                try {
                    const apiUser = await getCurrentUser();
                    if (apiUser) {
                        setUser(apiUser);
                        setIsAuthenticated(true);
                    } else {
                        setUser(null);
                        setIsAuthenticated(false);
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    setUser(null);
                    setIsAuthenticated(false);
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    const login = useCallback(async (email, code) => {
        const result = await verifyCode(email, code);
        if (result.success && result.user) {
            setUser(result.user);
            setIsAuthenticated(true);
        }
        return result;
    }, []);

    const logout = useCallback(() => {
        authLogout();
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    const sendCode = useCallback(async (email) => {
        return requestCode(email);
    }, []);

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        sendCode,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
