import { getHistoricChunk, chunkSearchText } from './historicChunkAttributes.js';

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDateToMs(dateLike) {
  if (!dateLike) return null;
  const t = new Date(dateLike).getTime();
  return Number.isNaN(t) ? null : t;
}

function issueDateMs(item) {
  const chunk = getHistoricChunk(item);
  return (
    parseDateToMs(chunk?.detail?.IMS_DATEOFISSUE) ||
    parseDateToMs(item?.recordDate) ||
    null
  );
}

function issueDateParts(item) {
  const ms = issueDateMs(item);
  if (ms == null) return null;
  const d = new Date(ms);
  return {
    ms,
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

function matchesDateFilter(item, dateFilter = {}) {
  const { dateMode = 'range', fromDate, toDate, monthValue, yearValue, exactDate } = dateFilter;
  const parts = issueDateParts(item);

  if (dateMode === 'range') {
    const fromTs = fromDate ? parseDateToMs(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? parseDateToMs(`${toDate}T23:59:59.999`) : null;
    if (fromTs == null && toTs == null) return true;
    if (!parts) return false;
    if (fromTs != null && parts.ms < fromTs) return false;
    if (toTs != null && parts.ms > toTs) return false;
    return true;
  }

  if (dateMode === 'month') {
    if (!String(monthValue || '').trim()) return true;
    if (!parts) return false;
    const m = String(monthValue).match(/^(\d{4})-(\d{1,2})$/);
    if (!m) return false;
    return parts.year === Number(m[1]) && parts.month === Number(m[2]);
  }

  if (dateMode === 'year') {
    const year = toNumberOrNull(yearValue);
    if (year == null) return true;
    if (!parts) return false;
    return parts.year === year;
  }

  if (dateMode === 'day') {
    if (!String(exactDate || '').trim()) return true;
    if (!parts) return false;
    const m = String(exactDate).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return false;
    return parts.year === Number(m[1]) && parts.month === Number(m[2]) && parts.day === Number(m[3]);
  }

  return true;
}

function buildHaystack(item) {
  const chunk = getHistoricChunk(item);
  const base = [
    item?.id,
    item?.sourceType,
    item?.symptom,
    item?.description,
    item?.rootCause,
    item?.correctiveAction,
    item?.preventiveAction,
    item?.customer,
    item?.part,
    chunk?.detail?.IMS_ITEMNAME,
    chunk?.detail?.IMS_ITEMCODE,
  ]
    .filter(Boolean)
    .join(' | ');

  return `${base} | ${chunkSearchText(item)}`.toLowerCase();
}

/**
 * Real-time historic record filters.
 * Any filled field applies immediately (AND).
 */
export function applyHistoricRecordsFilters(matches = [], filters = {}) {
  const { keyword, minSimilarity } = filters;
  const minSim = toNumberOrNull(minSimilarity);
  const keywordTokens = String(keyword || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!matches.length) return [];

  return matches.filter((m) => {
    if (!matchesDateFilter(m, filters)) return false;

    if (minSim != null) {
      const sim = toNumberOrNull(m?.similarityScore);
      if (sim == null || sim < minSim) return false;
    }

    if (keywordTokens.length) {
      const haystack = buildHaystack(m);
      if (!keywordTokens.some((t) => haystack.includes(t))) return false;
    }

    return true;
  });
}
