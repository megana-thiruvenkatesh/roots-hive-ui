export const ANALYSIS_METHODS = [
  { id: 'why-why', label: 'Why-Why' },
  { id: 'fishbone', label: 'Fishbone' },
  { id: '6m', label: '6M' },
  { id: 'kepner-tregoe', label: 'Kepner-Tregoe' },
];

export function analysisLabel(method) {
  return ANALYSIS_METHODS.find((item) => item.id === method)?.label || 'Analysis';
}

export function pickAnalysisPayload(item, method) {
  if (!item) return null;
  if (method === 'why-why') return item.whyWhy || [];
  if (method === 'fishbone') return item.fishbone || null;
  if (method === '6m') return item.sixM || null;
  if (method === 'kepner-tregoe') return item.kepnerTregoe || null;
  return null;
}

export function hasAnalysisContent(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(String(value).trim());
}

export function renderAnalysisSections(item, method = 'why-why') {
  const label = analysisLabel(method);
  const payload = pickAnalysisPayload(item, method);
  if (!hasAnalysisContent(payload)) {
    return [{ title: `${label} Analysis`, empty: true, lines: [`No ${label} analysis available for this historic case.`] }];
  }

  if (method === 'why-why') {
    return [{ title: 'Why-Why Analysis', empty: false, lines: payload.map((why, index) => `Why ${index + 1}: ${why}`) }];
  }

  if (method === 'fishbone' || method === '6m') {
    return [{
      title: `${label} Analysis`,
      empty: false,
      lines: Object.entries(payload).map(([key, value]) => `${key}: ${value || '—'}`),
    }];
  }

  if (method === 'kepner-tregoe') {
    return [{
      title: 'Kepner-Tregoe Analysis',
      empty: false,
      lines: [
        `Problem: ${payload.problem || '—'}`,
        `IS: ${payload.is || '—'}`,
        `IS NOT: ${payload.isNot || '—'}`,
        `Distinction: ${payload.distinction || '—'}`,
        `Most Probable: ${payload.mostProbable || '—'}`,
      ],
    }];
  }

  return [{ title: `${label} Analysis`, empty: true, lines: [`No ${label} analysis available for this historic case.`] }];
}
