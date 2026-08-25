import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  COMPLAINT_SEVERITIES,
  COMPLAINT_TYPES,
  DEFAULT_DEFECTS,
} from './complaintFormOptions.js';

const FALLBACK = {
  types: COMPLAINT_TYPES,
  severities: COMPLAINT_SEVERITIES,
  defects: DEFAULT_DEFECTS,
};

export function useComplaintMasters() {
  const [masters, setMasters] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/complaint-masters')
      .then((data) => {
        if (!cancelled && data.masters) setMasters(data.masters);
      })
      .catch(() => {
        if (!cancelled) setMasters(FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { masters, loading };
}
