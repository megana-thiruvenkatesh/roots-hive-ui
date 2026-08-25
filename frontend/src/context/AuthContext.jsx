import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hive_roots_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('hive_roots_token'))
      .finally(() => setLoading(false));
  }, []);

  async function registerAccount({ name, email, password, company, phone, profileDetails }) {
    return api.post('/auth/register', { name, email, password, company, phone, profileDetails });
  }

  async function startPasswordLogin(email, password) {
    return api.post('/auth/login', { email, password });
  }

  async function acceptSession(token, userData = null) {
    if (!token) throw new Error('Missing login token');
    localStorage.setItem('hive_roots_token', token);
    if (userData) {
      setUser(userData);
      return userData;
    }
    const data = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }

  async function completeMfaLogin(mfaToken, code) {
    const data = await api.post('/auth/mfa/verify', { mfaToken, code });
    localStorage.setItem('hive_roots_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('hive_roots_token');
    setUser(null);
  }

  async function reloadUser() {
    const data = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        reloadUser,
        registerAccount,
        startPasswordLogin,
        completeMfaLogin,
        acceptSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
