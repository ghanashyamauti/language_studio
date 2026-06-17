import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const login = async (role, username, password) => {
    try {
      const res = await api.post('/auth/login', { role, username, password });
      const { access_token, ...userInfo } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.detail || 'Invalid credentials' };
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  const clearPasswordFlag = () => {
    if (user && user.extra) {
      const newUser = { ...user, extra: { ...user.extra, must_change_password: false } };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, clearPasswordFlag }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
