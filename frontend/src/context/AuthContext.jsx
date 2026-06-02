import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, setLoggingOut } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── App init — cookie se current user fetch karo (no localStorage needed) ──
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await authAPI.me();
        setUser(data);
      } catch {
        setUser(null); // Cookie missing/expired — logged out rehna theek hai
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Login — backend HttpOnly cookie set karta hai, hum sirf user data lete hain ──
  const login = useCallback(async (identifier, password) => {
    await authAPI.login({ identifier, password });
    try {
      const { data } = await authAPI.me();
      setUser(data);
      return data;
    } catch {
      setUser(null);
      throw new Error(
        'Login successful, but your browser is blocking cookies. Please allow cookies or try normal Chrome.'
      );
    }
  }, []);

  // ── Register — backend cookie set karta hai + ToS acceptance record hoti hai ──
  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData);
    setUser(data.user);
    return data.user;
  }, []);

  // ── Logout — refresh interceptor band karo, cookie clear karo, state reset karo ──
  // setLoggingOut(true) zaroori hai: warna pending 401 requests refresh trigger
  // kar ke user ko wapas login kar deti hain (race condition)
  // finally me setUser(null) guarantee karta hai ke server fail ho tab bhi logout ho
  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await authAPI.logout();
    } catch {
      // Server/cookie clear fail ho to bhi frontend ko logged-out rakho
    } finally {
      setUser(null);
      sessionStorage.clear();
      // Thodi der baad guard hatao — redirect/unmount ho chuka hoga tab tak
      setTimeout(() => {
        setLoggingOut(false);
      }, 800);
    }
  }, []);

  // ── User update — profile edit ke baad local state sync karta hai ──
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