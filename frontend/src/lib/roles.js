export const ROLES = {
  ADMIN: 'ADMIN',
  QUALITY_HEAD: 'QUALITY_HEAD',
  QUALITY_MANAGER: 'QUALITY_MANAGER',
  QUALITY_EMPLOYEE: 'QUALITY_EMPLOYEE',
  QUALITY_SUPPORT: 'QUALITY_SUPPORT',
};

export function canAccessNav(roleKey, itemKey) {
  if (itemKey === 'config') return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
  return true;
}

export function canAccessPath(roleKey, path) {
  if (path.startsWith('/config')) {
    if (roleKey === ROLES.ADMIN) return true;
    return false;
  }
  if (path.startsWith('/settings/users')) {
    return roleKey === ROLES.ADMIN;
  }
  if (path.startsWith('/settings/audit-logs')) {
    return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
  }
  if (path === '/complaints/new') {
    return [ROLES.ADMIN, ROLES.QUALITY_HEAD, ROLES.QUALITY_MANAGER, ROLES.QUALITY_EMPLOYEE].includes(roleKey);
  }
  return true;
}

export function canCloseCapa(roleKey) {
  return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
}

export function canDeleteCapa(roleKey) {
  return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
}

export function canManageUsers(roleKey) {
  return roleKey === ROLES.ADMIN;
}

export function canAccessSystemSettings(roleKey) {
  return roleKey === ROLES.ADMIN;
}
