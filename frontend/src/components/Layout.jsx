import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppAlerts } from '../context/AppAlertsContext.jsx';
import { HistoricPopupProvider } from '../context/HistoricPopupContext.jsx';
import { ROLES, canAccessNav, canAccessPath, canAccessSystemSettings } from '../lib/roles.js';
import TopHeader from './TopHeader.jsx';

function Icon({ children }) {
  return (
    <svg
      className="rail-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  chat: (
    <Icon>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </Icon>
  ),
  'ai-engine': (
    <Icon>
      <path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z" />
    </Icon>
  ),
  complaints: (
    <Icon>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </Icon>
  ),
  config: (
    <Icon>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
};

const NAV = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard' },
  { key: 'chat', to: '/chat', label: 'AI Chat' },
  {
    key: 'ai-engine',
    label: 'AI Engine',
    hidden: true,
    to: '/ai-engine/smart-diagnostic',
    children: [
      { to: '/ai-engine/smart-diagnostic', label: 'Smart Diagnostic' },
      { to: '/ai-engine/rca-prediction', label: 'RCA Prediction' },
      { to: '/ai-engine/why-why', label: 'Analysis' },
      { to: '/ai-engine/ca-recommendation', label: 'CAPA' },
    ],
  },
  {
    key: 'complaints',
    label: 'AI-IIMS',
    to: '/complaints',
    children: [
      { to: '/complaints/new', label: 'New Complaint', roles: [ROLES.ADMIN, ROLES.QUALITY_HEAD, ROLES.QUALITY_MANAGER, ROLES.QUALITY_EMPLOYEE] },
      { to: '/complaints', label: 'All Complaints', end: true },
      { to: '/complaints/search', label: 'Search History' },
      { to: '/notifications', label: 'Approval', badge: 'unread' },
    ],
  },
  {
    key: 'config',
    label: 'Configuration',
    to: '/config/overview',
    children: [
      { to: '/config/overview', label: 'Overview', roles: [ROLES.ADMIN] },
      { to: '/config/modules', label: 'Modules', roles: [ROLES.ADMIN] },
      { to: '/config/policy', label: 'Policy Config', roles: [ROLES.ADMIN] },
      { to: '/config/users', label: 'User Mgmt', roles: [ROLES.ADMIN] },
      { to: '/config/complaint-masters', label: 'Complaint Masters', roles: [ROLES.ADMIN] },
      { to: '/config/audit-logs', label: 'Audit Logs', roles: [ROLES.ADMIN, ROLES.QUALITY_HEAD] },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    to: '/settings/profile',
    children: [
      {
        label: 'Personal',
        children: [
          { to: '/settings/profile', label: 'My Profile' },
          { to: '/settings/appearance', label: 'Appearance' },
          { to: '/settings/behavior', label: 'AI Behavior' },
          { to: '/settings/regional', label: 'Regional & Locale' },
        ],
      },
      {
        label: 'Systems',
        children: [
          { to: '/settings/models', label: 'AI Models', adminOnly: true },
          { to: '/settings/api', label: 'API Settings', adminOnly: true },
          { to: '/settings/kb', label: 'Knowledge Base' },
          { to: '/settings/uploaded-data', label: 'Uploaded Datasets' },
        ],
      },
    ],
  },
];

function activeModule(pathname) {
  if (pathname.startsWith('/ai-engine')) return 'ai-engine';
  if (
    pathname.startsWith('/complaints') ||
    pathname.startsWith('/capa') ||
    pathname.startsWith('/notifications')
  ) {
    return 'complaints';
  }
  if (pathname.startsWith('/config')) return 'config';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/chat')) return 'chat';
  return 'dashboard';
}

function filterNav(items, roleKey) {
  return items
    .filter((item) => {
      if (item.hidden) return false;
      if (item.adminOnly && !canAccessSystemSettings(roleKey)) return false;
      if (item.roles && !item.roles.includes(roleKey)) return false;
      if (item.key && !canAccessNav(roleKey, item.key)) return false;
      if (item.to && !canAccessPath(roleKey, item.to) && !item.children) return false;
      return true;
    })
    .map((item) => {
      if (!item.children) return item;
      const children = filterNav(item.children, roleKey);
      if (!children.length) return null;
      const firstLink = children.find((child) => child.to) || children[0]?.children?.[0];
      return {
        ...item,
        children,
        to: item.key === 'config' ? (firstLink?.to || item.to) : item.to,
      };
    })
    .filter(Boolean);
}

function NestedLinks({ items, depth = 0, unread = 0 }) {
  return items.map((item) => {
    if (item.children) {
      return (
        <div key={item.label} className={`rail-nest-group depth-${depth}`}>
          <div className="rail-nest-label">{item.label}</div>
          <NestedLinks items={item.children} depth={depth + 1} unread={unread} />
        </div>
      );
    }
    const showUnread = item.badge === 'unread' && unread > 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `rail-sublink depth-${depth} ${isActive ? 'active' : ''}`
        }
      >
        <span>{item.label}</span>
        {showUnread ? (
          <span className="rail-unread-badge" title={`${unread} unread`}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </NavLink>
    );
  });
}

export default function Layout() {
  const { user } = useAuth();
  const { unread } = useAppAlerts();
  const location = useLocation();
  const navigate = useNavigate();
  const moduleKey = activeModule(location.pathname);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const leaveTimer = useRef(null);
  const expanded = pinnedOpen || hovering;
  const collapsed = !expanded;

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const [openKey, setOpenKey] = useState(() =>
    ['ai-engine', 'complaints', 'config', 'settings'].includes(moduleKey) ? moduleKey : null
  );

  useEffect(() => {
    if (['ai-engine', 'complaints', 'config', 'settings'].includes(moduleKey)) {
      setOpenKey(moduleKey);
    }
  }, [moduleKey]);

  function onParentClick(item) {
    if (!item.children) {
      navigate(item.to);
      setOpenKey(null);
      return;
    }

    if (openKey === item.key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(item.key);
    navigate(item.to);
  }

  const navItems = filterNav(NAV, user?.roleKey);

  return (
    <div className={`shell ${collapsed ? 'rail-is-collapsed' : 'rail-is-expanded'}`}>
      <aside
        className={`rail ${collapsed ? 'collapsed' : ''}`}
        onMouseEnter={() => {
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          setHovering(true);
        }}
        onMouseLeave={() => {
          leaveTimer.current = setTimeout(() => setHovering(false), 140);
        }}
      >
        <div className="rail-header">
          <div className="rail-brand-row">
            <div
              className="rail-brand-mark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src="/logo.png"
                alt="Hive AI Logo"
                style={{ width: 26, height: 26, objectFit: 'contain' }}
              />
            </div>
            {!collapsed && (
              <div className="rail-brand-text">
                <strong style={{ fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Hive AI</strong>
              </div>
            )}
          </div>
          <button
            type="button"
            className="rail-collapse"
            onClick={() => setPinnedOpen((v) => !v)}
            title={pinnedOpen ? 'Auto-minimize sidebar' : 'Keep sidebar open'}
          >
            {pinnedOpen ? '‹' : '›'}
          </button>
        </div>

        <nav className="rail-nav">
          {navItems.map((item) => {
            const hasKids = Boolean(item.children?.length);
            const isOpen = openKey === item.key;
            const isActive = moduleKey === item.key;

            return (
              <div key={item.key} className={`rail-block ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className={`rail-item ${isActive ? 'active' : ''}`}
                  onClick={() => onParentClick(item)}
                  title={item.label}
                >
                  <span className="rail-item-main">
                    {ICONS[item.key]}
                    {!collapsed && <span className="rail-label">{item.label}</span>}
                    {item.key === 'complaints' && unread > 0 ? (
                      <span className="rail-unread-badge" title={`${unread} unread`}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : null}
                  </span>
                  {!collapsed && hasKids ? (
                    <span className="rail-caret">{isOpen ? '▾' : '▸'}</span>
                  ) : null}
                </button>

                {!collapsed && hasKids && isOpen ? (
                  <div className="rail-submenu">
                    <NestedLinks items={item.children} unread={unread} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <TopHeader />
        <main className="main-area">
          <HistoricPopupProvider key={location.pathname}>
            <Outlet />
          </HistoricPopupProvider>
        </main>
      </div>
    </div>
  );
}
