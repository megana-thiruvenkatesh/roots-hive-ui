import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppAlerts } from '../context/AppAlertsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

function initialsOf(name) {
  return String(name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';
}

function statusBadge(n) {
  const badge = n.meta?.badge || n.meta?.resolution;
  if (badge === 'SUBMITTED' || n.meta?.resolution === 'SUBMITTED') return 'Submitted';
  if (badge === 'APPROVED' || n.meta?.resolution === 'APPROVED') return 'Approved';
  if (badge === 'REJECTED' || n.meta?.resolution === 'REJECTED') return 'Rejected';
  if (n.type === 'approval_request' || n.type === 'approval_sent') return 'Pending';
  return 'Update';
}

export default function TopHeader() {
  const { user, logout } = useAuth();
  const { unread, refreshUnread } = useAppAlerts();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const wrapRef = useRef(null);

  const initials = initialsOf(user?.name);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function openNotifications() {
    setProfileOpen(false);
    const next = !notifOpen;
    setNotifOpen(next);
    if (!next) return;
    setLoadingNotifs(true);
    try {
      const data = await refreshUnread();
      setItems(data.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoadingNotifs(false);
    }
  }

  function openProfile() {
    setNotifOpen(false);
    setProfileOpen((v) => !v);
  }

  function goApproval(n) {
    setNotifOpen(false);
    const cid = n.complaintId || n.meta?.complaintId;
    if (cid) navigate(`/complaints/${cid}`);
    else navigate('/notifications');
  }

  function sendFeedback() {
    setProfileOpen(false);
    const email = 'feedback@hive.ai';
    const subject = encodeURIComponent('Hive Roots feedback');
    const body = encodeURIComponent(
      `From: ${user?.name || ''} <${user?.email || ''}>\n\nFeedback:\n`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  return (
    <header className="top-header" ref={wrapRef}>
      <div className="top-header-spacer" />
      <div className="top-header-actions">
        <button
          type="button"
          className="top-icon-btn"
          onClick={() => {
            setNotifOpen(false);
            setProfileOpen(false);
            toggleTheme();
          }}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </button>

        <div className="top-header-menu">
          <button
            type="button"
            className={`top-icon-btn${notifOpen ? ' open' : ''}`}
            onClick={openNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 19a2 2 0 0 0 4 0" />
            </svg>
            {unread > 0 ? <span className="top-icon-badge">{unread > 99 ? '99+' : unread}</span> : null}
          </button>

          {notifOpen ? (
            <div className="top-dropdown top-notif-dropdown" role="dialog" aria-label="Notifications">
              <div className="top-dropdown-head">
                <strong>Notifications</strong>
                <div className="top-dropdown-head-actions">
                  <Link to="/notifications" className="top-link-btn" onClick={() => setNotifOpen(false)}>
                    View all
                  </Link>
                </div>
              </div>
              <div className="top-notif-list">
                {loadingNotifs ? <p className="muted top-empty">Loading…</p> : null}
                {!loadingNotifs && !items.length ? (
                  <p className="muted top-empty">No notifications yet.</p>
                ) : null}
                {!loadingNotifs
                  ? items.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`top-notif-item${!n.readAt ? ' unread' : ''}`}
                        onClick={() => goApproval(n)}
                      >
                        <div className="top-notif-item-main">
                          <strong>{n.title || 'Approval update'}</strong>
                          <span className="muted">{n.body || statusBadge(n)}</span>
                        </div>
                        <span className="top-notif-pill">{statusBadge(n)}</span>
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="top-header-menu">
          <button
            type="button"
            className={`top-avatar-btn${profileOpen ? ' open' : ''}`}
            onClick={openProfile}
            aria-label="Profile menu"
            title={user?.name || 'Profile'}
          >
            {initials}
          </button>

          {profileOpen ? (
            <div className="top-dropdown top-profile-dropdown" role="menu">
              <div className="top-profile-meta">
                <strong>{user?.name || 'User'}</strong>
                <span>{user?.email || '—'}</span>
              </div>
              <div className="top-profile-sep" />
              <Link
                to="/settings/profile"
                className="top-profile-item"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </Link>
              <button type="button" className="top-profile-item" role="menuitem" onClick={sendFeedback}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                  <path d="M12 8v6" />
                  <path d="M9 11h6" />
                </svg>
                Send feedback
              </button>
              <button
                type="button"
                className="top-profile-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
