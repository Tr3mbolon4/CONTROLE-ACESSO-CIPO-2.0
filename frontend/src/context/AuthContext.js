import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = not authenticated
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const checkAuth = useCallback(async () => {
    try {
      // Use the api instance which has the refresh interceptor
      const { data } = await api.get('/auth/me');
      setUser(data);
      return true;
    } catch (error) {
      setUser(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Periodically refresh the token to keep session alive
  useEffect(() => {
    if (user) {
      // Refresh token every 7 hours (token lasts 8h)
      refreshTimerRef.current = setInterval(async () => {
        try {
          await api.post('/auth/refresh');
        } catch (e) {
          // If refresh fails, check auth status
          checkAuth();
        }
      }, 7 * 60 * 60 * 1000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [user, checkAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(false);
  };

  const refreshToken = async () => {
    try {
      await api.post('/auth/refresh');
      return true;
    } catch (e) {
      setUser(false);
      return false;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    checkAuth,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPortaria: user?.role === 'portaria' || user?.role === 'admin',
    isGestor: user?.role === 'gestor' || user?.role === 'admin',
    isDSL: user?.role === 'dsl' || user?.role === 'admin',
    isDiretoria: user?.role === 'diretoria' || user?.role === 'admin',
    canSchedule: user?.role === 'gestor' || user?.role === 'dsl' || user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
