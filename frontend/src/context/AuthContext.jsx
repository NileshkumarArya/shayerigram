import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load — try fetching current user via cookie (no localStorage needed)
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await authAPI.me();
        setUser(data);
      } catch {
        setUser(null); // Cookie missing/expired — that's fine, stay logged out
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Login — backend sets HttpOnly cookie, we just get user data
  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    setUser(data.user);
    return data.user;
  }, []);

  // Register — backend sets HttpOnly cookie + records ToS acceptance
  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData);
    setUser(data.user);
    return data.user;
  }, []);

  // Logout — backend clears cookie server-side
  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch {}
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
