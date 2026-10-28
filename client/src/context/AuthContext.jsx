import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('billing_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('billing_token')));

  useEffect(() => {
    const token = localStorage.getItem('billing_token');
    if (!token) { setLoading(false); return; }
    setLoading(true);
    api.get('/auth/me').then(({ data }) => {
      if (!['superadmin', 'admin'].includes(data.data.role)) throw new Error('Akun ini menggunakan aplikasi mobile.');
      setUser(data.data);
      localStorage.setItem('billing_user', JSON.stringify(data.data));
    }).catch(() => {
      localStorage.removeItem('billing_token');
      localStorage.removeItem('billing_user');
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      if (!['superadmin', 'admin'].includes(data.user?.role)) throw new Error('Gunakan aplikasi mobile Pelanggan atau Teknisi untuk akun ini.');
      localStorage.setItem('billing_token', data.token);
      localStorage.setItem('billing_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('billing_token');
    localStorage.removeItem('billing_user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
