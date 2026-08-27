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
      {/* Clipboard */}
      <rect x="4.5" y="5" width="11.5" height="15" rx="1.6" />
      <path d="M8.2 5V3.8h4.1V5" />
      {/* Checklist rows */}
      <circle cx="7.4" cy="9.2" r="1.1" />
      <path d="M6.9 9.2l0.7 0.7 1.2-1.3" />
      <path d="M9.8 8.7h4.2M9.8 9.8h3.2" />
      <circle cx="7.4" cy="12.8" r="1.1" />
      <path d="M6.9 12.8l0.7 0.7 1.2-1.3" />
      <path d="M9.8 12.3h4.2M9.8 13.4h3.2" />
      <circle cx="7.4" cy="16.4" r="1.1" />
      <path d="M6.9 16.4l0.7 0.7 1.2-1.3" />
      <path d="M9.8 15.9h4.2M9.8 17h3.2" />
      {/* Gear with alert */}
      <circle cx="17.2" cy="16.8" r="3.2" />
      <path d="M17.2 12.8v1.1M17.2 19.7v1.1M13.8 14.6l.8.8M19.8 18.2l.8.8M12.8 16.8h1.1M20.5 16.8h1.1M13.8 19l.8-.8M19.8 15.4l.8-.8" />
      <path d="M17.2 15v2.2" />
      <circle cx="17.2" cy="18.4" r="0.55" fill="currentColor" stroke="none" />
    </Icon>
  ),
  config: (
    <Icon>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 12h2" />
      <path d="M10 12h10" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 17h10" />
      <path d="M18 17h2" />
      <circle cx="16" cy="17" r="2" />
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
      { to: '/config/complaint-masters', label: 'Complaint Masters', roles: [ROLES.ADMIN] },
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
        ],
      },
      {
        label: 'Administration',
        children: [
          { to: '/settings/users', label: 'User Settings', roles: [ROLES.ADMIN] },
          { to: '/settings/audit-logs', label: 'Audit Logs', roles: [ROLES.ADMIN, ROLES.QUALITY_HEAD] },
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

  // Hover expands; leave collapses. Pin (›/‹) keeps it open.
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
          leaveTimer.current = setTimeout(() => setHovering(false), 160);
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
            {!collapsed ? (
              <div className="rail-brand-text">
                <strong style={{ fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Hive AI</strong>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="rail-collapse"
            onClick={(e) => {
              e.stopPropagation();
              setPinnedOpen((v) => !v);
            }}
            title={pinnedOpen ? 'Unpin — auto-minimize when mouse leaves' : 'Pin sidebar open'}
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
                    {!collapsed ? <span className="rail-label">{item.label}</span> : null}
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
