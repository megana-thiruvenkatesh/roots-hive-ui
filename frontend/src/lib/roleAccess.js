/** Client helpers for button-level role access */

export function can(user, moduleId, action) {
  if (!user) return false;
  if (user.roleKey === 'ADMIN' || user.isAdmin) return true;
  const mod = user.permissions?.[moduleId];
  if (!mod?.enabled) return false;
  if (!action) return Object.values(mod.actions || {}).some(Boolean);
  return Boolean(mod.actions?.[action]);
}

export function moduleEnabled(user, moduleId) {
  return can(user, moduleId);
}

export function clonePermissions(perms) {
  return JSON.parse(JSON.stringify(perms || {}));
}

export function countPermissionStats(catalog, perms) {
  let modulesTotal = 0;
  let modulesEnabled = 0;
  let permsTotal = 0;
  let permsGranted = 0;
  for (const cat of catalog || []) {
    for (const mod of cat.modules || []) {
      modulesTotal += 1;
      const p = perms?.[mod.id];
      const on = Boolean(p?.enabled && Object.values(p.actions || {}).some(Boolean));
      if (on) modulesEnabled += 1;
      for (const a of mod.actions || []) {
        permsTotal += 1;
        if (p?.enabled && p.actions?.[a]) permsGranted += 1;
      }
    }
  }
  return { modulesTotal, modulesEnabled, permsTotal, permsGranted };
}

export function actionLabel(labels, action) {
  return labels?.[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
