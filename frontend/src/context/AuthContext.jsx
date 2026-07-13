import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, setLoggingOut } from '../services/api';

const AuthContext = createContext(null);
const normalizeUser = (data) => data?.user || data || null;

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── App init — fetch current user via cookie (no localStorage needed) ──
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data } = await authAPI.me();
        if (active) setUser(normalizeUser(data));
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  // ── Login — backend sets HttpOnly cookie, we just receive user data ──
  const login = useCallback(async (identifier, password) => {
    setLoggingOut(false);
    const { data } = await authAPI.login({ identifier, password });
    if (data?.requiresTwoFactor) {
      return { requiresTwoFactor: true, tempToken: data.tempToken };
    }
    try {
      const { data: meData } = await authAPI.me();
      const currentUser = normalizeUser(meData);
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      throw new Error(
        'Login successful, but your browser is blocking cookies. Please allow cookies or try normal Chrome.'
      );
    }
  }, []);

  const verifyTwoFactor = useCallback(async (tempToken, code) => {
    setLoggingOut(false);
    await authAPI.verifyTwoFactor({ tempToken, code });
    try {
      const { data } = await authAPI.me();
      const currentUser = normalizeUser(data);
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      throw new Error('Verified, but your browser is blocking cookies.');
    }
  }, []);

 // ── Register — backend sets cookie + records ToS acceptance ──
  const register = useCallback(async (formData) => {
    setLoggingOut(false);
    const { data } = await authAPI.register(formData);
    const createdUser = normalizeUser(data);
    setUser(createdUser);
    return createdUser;
  }, []);

  // ── Logout — disable refresh interceptor, clear cookie, reset state ──
  // setLoggingOut(true) is required: otherwise pending 401 requests trigger refresh
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
      // Remove the guard shortly after — redirect/unmount will be done by then
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, verifyTwoFactor }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};