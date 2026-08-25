const ROLES = {
  ADMIN: 'ADMIN',
  QUALITY_HEAD: 'QUALITY_HEAD',
  QUALITY_MANAGER: 'QUALITY_MANAGER',
  QUALITY_EMPLOYEE: 'QUALITY_EMPLOYEE',
  QUALITY_SUPPORT: 'QUALITY_SUPPORT',
};

function canCloseCapa(roleKey) {
  return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
}

function canDeleteCapa(roleKey) {
  return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
}

function canManageUsers(roleKey) {
  return roleKey === ROLES.ADMIN;
}

function canAccessConfig(roleKey) {
  return roleKey === ROLES.ADMIN || roleKey === ROLES.QUALITY_HEAD;
}

module.exports = {
  ROLES,
  canCloseCapa,
  canDeleteCapa,
  canManageUsers,
  canAccessConfig,
};
