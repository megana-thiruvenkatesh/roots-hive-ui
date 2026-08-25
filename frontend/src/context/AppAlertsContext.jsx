import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext.jsx';

const AppAlertsContext = createContext(null);
const MAX_TOASTS = 4;

export function AppAlertsProvider({ children }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [unread, setUnread] = useState(0);
  const snapRef = useRef(new Map()); // id -> fingerprint
  const primedRef = useRef(false);
  const timersRef = useRef(new Map());
  const recentManualRef = useRef([]); // { message, at }

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((message, tone = 'info', ttl = 4200, options = {}) => {
    const text = String(message || '').trim();
    if (!text) return null;

    const fromPoll = Boolean(options.fromPoll);
    if (!fromPoll) {
      const now = Date.now();
      recentManualRef.current = [
        ...recentManualRef.current.filter((entry) => now - entry.at < 6000),
        { message: text, at: now },
      ].slice(-8);
    }

    const toastId = crypto.randomUUID();
    setToasts((current) => {
      const deduped = current.filter((toast) => toast.message !== text);
      const next = [...deduped, { id: toastId, message: text, tone }];
      return next.slice(-MAX_TOASTS);
    });

    const existing = timersRef.current.get(toastId);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => dismissToast(toastId), ttl);
    timersRef.current.set(toastId, timer);

    return toastId;
  }, [dismissToast]);

  const fingerprint = useCallback((item) => {
    const logLen = Array.isArray(item.meta?.log) ? item.meta.log.length : 0;
    return [
      item.updatedAt || item.createdAt || '',
      item.meta?.resolution || '',
      item.meta?.lastEvent || '',
      item.title || '',
      item.readAt ? '1' : '0',
      String(logLen),
    ].join('|');
  }, []);

  const toastTone = useCallback((item) => {
    const resolution = item.meta?.resolution;
    if (resolution === 'APPROVED' || item.type === 'approval_approved') return 'success';
    if (resolution === 'REJECTED' || item.type === 'approval_rejected') return 'error';
    return 'info';
  }, []);

  const wasRecentlyManual = useCallback((message) => {
    const now = Date.now();
    const text = String(message || '').trim().toLowerCase();
    // Any manual toast in the last ~3s suppresses poll duplicates (different wording).
    if (recentManualRef.current.some((entry) => now - entry.at < 3000)) return true;
    return recentManualRef.current.some(
      (entry) => now - entry.at < 5500 && entry.message.toLowerCase() === text
    );
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return { unread: 0, notifications: [] };
    }
    try {
      const data = await api.get('/notifications');
      const list = data.notifications || [];
      const count = data.unread ?? list.filter((item) => !item.readAt).length;
      setUnread(count);

      if (!primedRef.current) {
        list.forEach((item) => snapRef.current.set(item.id, fingerprint(item)));
        primedRef.current = true;
      } else {
        list.forEach((item) => {
          const next = fingerprint(item);
          const prev = snapRef.current.get(item.id);
          snapRef.current.set(item.id, next);
          const title = item.title || 'Approval update';
          if (prev === undefined) {
            if (!wasRecentlyManual(title)) {
              pushToast(title, toastTone(item), 5200, { fromPoll: true });
            }
          } else if (prev !== next && !item.readAt) {
            if (!wasRecentlyManual(title)) {
              pushToast(title, toastTone(item), 5200, { fromPoll: true });
            }
          }
        });
      }
      return { unread: count, notifications: list };
    } catch {
      return { unread: 0, notifications: [] };
    }
  }, [user, pushToast, fingerprint, toastTone, wasRecentlyManual]);

  useEffect(() => {
    primedRef.current = false;
    snapRef.current = new Map();
    if (!user) {
      setUnread(0);
      return undefined;
    }
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 8000);
    return () => window.clearInterval(timer);
  }, [user, refreshUnread]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const value = useMemo(
    () => ({
      toasts,
      unread,
      pushToast,
      dismissToast,
      refreshUnread,
    }),
    [toasts, unread, pushToast, dismissToast, refreshUnread]
  );

  return (
    <AppAlertsContext.Provider value={value}>
      {children}
      <div className="app-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`app-toast ${toast.tone}`} role="status">
            <span className="app-toast-msg">{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </AppAlertsContext.Provider>
  );
}

export function useAppAlerts() {
  const ctx = useContext(AppAlertsContext);
  if (!ctx) {
    return {
      toasts: [],
      unread: 0,
      pushToast: () => {},
      dismissToast: () => {},
      refreshUnread: async () => ({ unread: 0, notifications: [] }),
    };
  }
  return ctx;
}
