import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("publishitt_token"));
  const [loading, setLoading] = useState(true); // true while we verify token on boot

  // Set axios auth header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("publishitt_token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("publishitt_token");
    }
  }, [token]);

  // On mount, verify existing token and load user profile
  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API}/auth/me`);
        setUser(res.data);
      } catch {
        // Token invalid / expired — clear it
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const register = useCallback(async (email, password, displayName) => {
    const res = await axios.post(`${API}/auth/register`, {
      email,
      password,
      display_name: displayName,
    });
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    // Clear onboarding state tied to the session
    localStorage.removeItem("thad_onboarding_complete");
    localStorage.removeItem("thad_user_name");
    localStorage.removeItem("thad_tour_complete");
  }, []);

  // Optimistically merge updates into the user object — used after a
  // PATCH /auth/me/preferences call so UI reflects the change immediately.
  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
