import { api } from '../api/client';

export function logAudit({ module, action, status = 'ALLOWED', detail = '', meta = {} }) {
  api.post('/audit-logs', { module, action, status, detail, meta }).catch(() => {});
}
