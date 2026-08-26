const pool = require('../db/pool');

const SETTINGS_KEY = 'role_access';

const ACTION_LABELS = {
  read: 'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  import: 'Import',
  export: 'Export',
  view: 'View',
  edit: 'Edit',
  select_reference: 'Select Reference',
  generate: 'Generate',
  apply: 'Apply',
};

/** HIVE module catalog — button-level actions per page/card */
const PERMISSION_CATALOG = [
  {
    category: 'GENERAL',
    modules: [
      { id: 'dashboard', label: 'Dashboard', actions: ['read'] },
      { id: 'ai_chat', label: 'AI Chat', actions: ['read', 'create'] },
    ],
  },
  {
    category: 'AI-IIMS',
    modules: [
      { id: 'complaints_list', label: 'All Complaints', actions: ['read', 'create', 'update', 'delete'] },
      { id: 'complaints_new', label: 'New Complaint', actions: ['read', 'create', 'update'] },
      { id: 'nc_details_card', label: 'New Complaint — Details Card', actions: ['view', 'edit'] },
      { id: 'nc_historic_card', label: 'New Complaint — Historic Records', actions: ['view', 'select_reference'] },
      { id: 'nc_ai_card', label: 'New Complaint — AI Suggested Solution', actions: ['view', 'generate', 'apply'] },
      { id: 'complaints_search', label: 'Search History', actions: ['read'] },
      { id: 'approvals', label: 'Approval', actions: ['read', 'update'] },
    ],
  },
  {
    category: 'CONFIGURATION',
    modules: [
      { id: 'config_overview', label: 'Overview', actions: ['read'] },
      { id: 'config_modules', label: 'Modules', actions: ['read', 'update'] },
      { id: 'config_policy', label: 'Policy Config', actions: ['read', 'update'] },
      { id: 'complaint_masters', label: 'Complaint Masters', actions: ['read', 'create', 'update', 'delete', 'import', 'export'] },
    ],
  },
  {
    category: 'SETTINGS',
    modules: [
      { id: 'settings_profile', label: 'My Profile', actions: ['read', 'update'] },
      { id: 'settings_appearance', label: 'Appearance', actions: ['read', 'update'] },
      { id: 'settings_models', label: 'AI Models', actions: ['read', 'update'] },
      { id: 'settings_api', label: 'API Settings', actions: ['read', 'update'] },
      { id: 'settings_kb', label: 'Knowledge Base', actions: ['read', 'create', 'update', 'delete'] },
      { id: 'settings_datasets', label: 'Uploaded Datasets', actions: ['read', 'delete', 'export'] },
      { id: 'settings_users', label: 'User Settings', actions: ['read', 'create', 'update', 'delete'] },
      { id: 'settings_audit', label: 'Audit Logs', actions: ['read', 'export'] },
    ],
  },
];

const SYSTEM_ROLES = [
  {
    key: 'ADMIN',
    label: 'Admin',
    description: 'Administrator with full privileges across HIVE Roots.',
    locked: true,
    is_admin: true,
    system: true,
  },
  {
    key: 'QUALITY_HEAD',
    label: 'Quality Head',
    description: 'Approve and close CAPA, oversee quality workflow, and view audit logs.',
    locked: false,
    is_admin: false,
    system: true,
  },
  {
    key: 'QUALITY_MANAGER',
    label: 'Quality Manager',
    description: 'Manage complaints, assign work, and drive RCA / CAPA completion.',
    locked: false,
    is_admin: false,
    system: true,
  },
  {
    key: 'QUALITY_EMPLOYEE',
    label: 'Quality Worker',
    description: 'Create and update complaints, use historic retrieval and AI suggestions.',
    locked: false,
    is_admin: false,
    system: true,
  },
  {
    key: 'QUALITY_SUPPORT',
    label: 'Quality Support',
    description: 'Support access for quality operations with limited complaint actions.',
    locked: false,
    is_admin: false,
    system: true,
  },
];

function allModuleIds() {
  return PERMISSION_CATALOG.flatMap((c) => c.modules.map((m) => m.id));
}

function fullAccessMap() {
  const map = {};
  for (const cat of PERMISSION_CATALOG) {
    for (const mod of cat.modules) {
      const actions = {};
      for (const a of mod.actions) actions[a] = true;
      map[mod.id] = { enabled: true, actions };
    }
  }
  return map;
}

function emptyAccessMap() {
  const map = {};
  for (const cat of PERMISSION_CATALOG) {
    for (const mod of cat.modules) {
      const actions = {};
      for (const a of mod.actions) actions[a] = false;
      map[mod.id] = { enabled: false, actions };
    }
  }
  return map;
}

function setActions(map, moduleId, actionList, value) {
  if (!map[moduleId]) return;
  map[moduleId].enabled = value || Object.values(map[moduleId].actions).some(Boolean);
  for (const a of actionList) {
    if (map[moduleId].actions[a] !== undefined) map[moduleId].actions[a] = value;
  }
  if (value) map[moduleId].enabled = true;
}

function defaultPermissionsForRole(roleKey) {
  if (roleKey === 'ADMIN') return fullAccessMap();

  const map = emptyAccessMap();

  const grant = (id, actions) => {
    if (!map[id]) return;
    map[id].enabled = true;
    for (const a of actions) {
      if (map[id].actions[a] !== undefined) map[id].actions[a] = true;
    }
  };

  if (roleKey === 'QUALITY_HEAD') {
    grant('dashboard', ['read']);
    grant('ai_chat', ['read', 'create']);
    grant('complaints_list', ['read', 'create', 'update', 'delete']);
    grant('complaints_new', ['read', 'create', 'update']);
    grant('nc_details_card', ['view', 'edit']);
    grant('nc_historic_card', ['view', 'select_reference']);
    grant('nc_ai_card', ['view', 'generate', 'apply']);
    grant('complaints_search', ['read']);
    grant('approvals', ['read', 'update']);
    grant('config_overview', ['read']);
    grant('config_policy', ['read']);
    grant('complaint_masters', ['read', 'export']);
    grant('settings_profile', ['read', 'update']);
    grant('settings_appearance', ['read', 'update']);
    grant('settings_kb', ['read']);
    grant('settings_audit', ['read', 'export']);
  } else if (roleKey === 'QUALITY_MANAGER') {
    grant('dashboard', ['read']);
    grant('ai_chat', ['read', 'create']);
    grant('complaints_list', ['read', 'create', 'update']);
    grant('complaints_new', ['read', 'create', 'update']);
    grant('nc_details_card', ['view', 'edit']);
    grant('nc_historic_card', ['view', 'select_reference']);
    grant('nc_ai_card', ['view', 'generate', 'apply']);
    grant('complaints_search', ['read']);
    grant('approvals', ['read', 'update']);
    grant('settings_profile', ['read', 'update']);
    grant('settings_appearance', ['read', 'update']);
    grant('settings_kb', ['read']);
  } else if (roleKey === 'QUALITY_EMPLOYEE') {
    grant('dashboard', ['read']);
    grant('ai_chat', ['read', 'create']);
    grant('complaints_list', ['read', 'create', 'update']);
    grant('complaints_new', ['read', 'create', 'update']);
    grant('nc_details_card', ['view', 'edit']);
    grant('nc_historic_card', ['view', 'select_reference']);
    grant('nc_ai_card', ['view', 'generate', 'apply']);
    grant('complaints_search', ['read']);
    grant('approvals', ['read']);
    grant('settings_profile', ['read', 'update']);
    grant('settings_appearance', ['read', 'update']);
  } else if (roleKey === 'QUALITY_SUPPORT') {
    grant('dashboard', ['read']);
    grant('ai_chat', ['read']);
    grant('complaints_list', ['read']);
    grant('complaints_search', ['read']);
    grant('nc_historic_card', ['view']);
    grant('nc_ai_card', ['view']);
    grant('settings_profile', ['read', 'update']);
  } else {
    // custom roles start with worker-like defaults
    grant('dashboard', ['read']);
    grant('complaints_list', ['read']);
    grant('complaints_new', ['read', 'create']);
    grant('nc_details_card', ['view', 'edit']);
    grant('nc_historic_card', ['view']);
    grant('nc_ai_card', ['view']);
    grant('settings_profile', ['read', 'update']);
  }

  return map;
}

function normalizeModulePerm(modDef, stored) {
  const actions = {};
  for (const a of modDef.actions) {
    actions[a] = Boolean(stored?.actions?.[a]);
  }
  const anyOn = Object.values(actions).some(Boolean);
  return {
    enabled: stored?.enabled === false ? false : stored?.enabled === true || anyOn,
    actions,
  };
}

function normalizePermissions(roleKey, storedPerms) {
  const base = roleKey === 'ADMIN' ? fullAccessMap() : emptyAccessMap();
  if (roleKey === 'ADMIN') return fullAccessMap();
  if (!storedPerms || typeof storedPerms !== 'object') {
    return defaultPermissionsForRole(roleKey);
  }
  for (const cat of PERMISSION_CATALOG) {
    for (const mod of cat.modules) {
      base[mod.id] = normalizeModulePerm(mod, storedPerms[mod.id]);
      if (!base[mod.id].enabled) {
        for (const a of Object.keys(base[mod.id].actions)) base[mod.id].actions[a] = false;
      }
    }
  }
  return base;
}

function countStats(perms) {
  let modulesTotal = 0;
  let modulesEnabled = 0;
  let permsTotal = 0;
  let permsGranted = 0;
  for (const cat of PERMISSION_CATALOG) {
    for (const mod of cat.modules) {
      modulesTotal += 1;
      const p = perms[mod.id];
      const enabled = Boolean(p?.enabled && Object.values(p.actions || {}).some(Boolean));
      if (enabled) modulesEnabled += 1;
      for (const a of mod.actions) {
        permsTotal += 1;
        if (p?.enabled && p.actions?.[a]) permsGranted += 1;
      }
    }
  }
  return { modulesTotal, modulesEnabled, permsTotal, permsGranted };
}

function flattenGranted(perms) {
  const list = [];
  for (const cat of PERMISSION_CATALOG) {
    for (const mod of cat.modules) {
      const p = perms[mod.id];
      if (!p?.enabled) continue;
      for (const a of mod.actions) {
        if (p.actions?.[a]) list.push(`${mod.id}.${a}`);
      }
    }
  }
  return list;
}

async function loadStore() {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [SETTINGS_KEY]);
  const value = rows[0]?.value || {};
  const roles = Array.isArray(value.roles) && value.roles.length
    ? value.roles
    : SYSTEM_ROLES.map((r) => ({ ...r }));
  // ensure system roles exist
  const byKey = new Map(roles.map((r) => [r.key, r]));
  for (const sys of SYSTEM_ROLES) {
    if (!byKey.has(sys.key)) {
      roles.unshift({ ...sys });
      byKey.set(sys.key, sys);
    } else {
      const cur = byKey.get(sys.key);
      if (sys.locked) {
        cur.locked = true;
        cur.system = true;
        cur.is_admin = true;
      }
      if (sys.system) cur.system = true;
    }
  }
  const permissions = { ...(value.permissions || {}) };
  for (const role of roles) {
    permissions[role.key] = normalizePermissions(role.key, permissions[role.key]);
  }
  return { roles, permissions };
}

async function saveStore(store) {
  // force admin full + locked
  const admin = store.roles.find((r) => r.key === 'ADMIN');
  if (admin) {
    admin.locked = true;
    admin.system = true;
    admin.is_admin = true;
  }
  store.permissions.ADMIN = fullAccessMap();

  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(store)]
  );
  return store;
}

function hasPermission(perms, moduleId, action) {
  if (!perms) return false;
  const m = perms[moduleId];
  if (!m?.enabled) return false;
  if (!action) return Object.values(m.actions || {}).some(Boolean);
  return Boolean(m.actions?.[action]);
}

function slugRoleKey(label) {
  const base = String(label || 'custom_role')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return base || `CUSTOM_${Date.now()}`;
}

module.exports = {
  ACTION_LABELS,
  PERMISSION_CATALOG,
  SYSTEM_ROLES,
  allModuleIds,
  fullAccessMap,
  defaultPermissionsForRole,
  normalizePermissions,
  countStats,
  flattenGranted,
  loadStore,
  saveStore,
  hasPermission,
  slugRoleKey,
};
