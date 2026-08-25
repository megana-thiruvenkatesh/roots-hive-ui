import React, { useMemo, useState } from 'react';
import { applyHistoricRecordsFilters } from '../lib/historicRecordsFilter.js';
import DateRangePicker from './DateRangePicker.jsx';

export function useHistoricRecordsFilter(matches = []) {
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState('default');
  const [minSimilarity, setMinSimilarity] = useState('');

  const filteredMatches = useMemo(() => {
    return applyHistoricRecordsFilters(matches, {
      keyword: query,
      minSimilarity,
      dateMode: 'range',
      fromDate,
      toDate,
    });
  }, [matches, query, minSimilarity, fromDate, toDate]);

  function applyDateRange({ fromDate: nextFrom, toDate: nextTo, presetId }) {
    setFromDate(nextFrom || '');
    setToDate(nextTo || '');
    setDatePreset(presetId || '');
  }

  function clearFilters() {
    setQuery('');
    setFromDate('');
    setToDate('');
    setDatePreset('default');
    setMinSimilarity('');
  }

  const hasFilters = Boolean(query.trim() || minSimilarity || fromDate || toDate);

  return {
    query,
    setQuery,
    fromDate,
    toDate,
    datePreset,
    applyDateRange,
    minSimilarity,
    setMinSimilarity,
    filteredMatches,
    shownMatches: filteredMatches,
    hasFilters,
    clearFilters,
  };
}

export default function HistoricRecordsFindBar({ filter, totalCount }) {
  const shownCount = filter.shownMatches.length;
  const resultLabel =
    shownCount === totalCount
      ? `${shownCount} record${shownCount === 1 ? '' : 's'}`
      : `${shownCount} of ${totalCount} record${totalCount === 1 ? '' : 's'}`;

  return (
    <div className="hist-find-wrap">
      <div className="hist-find-bar">
        <div className="hist-find-row">
          <div className="hist-find-search">
            <span className="hist-find-in-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              className="hist-find-input"
              value={filter.query}
              onChange={(e) => filter.setQuery(e.target.value)}
              placeholder="Search ID, product, defect, root cause…"
              aria-label="Global search"
            />
          </div>

          <div className="hist-find-sim-wrap">
            <input
              type="number"
              className="hist-find-sim"
              value={filter.minSimilarity}
              onChange={(e) => filter.setMinSimilarity(e.target.value)}
              placeholder="≥%"
              min={0}
              max={100}
              step={1}
              title="Minimum similarity %"
              aria-label="Minimum similarity percent"
            />
          </div>

          <DateRangePicker
            fromDate={filter.fromDate}
            toDate={filter.toDate}
            onApply={filter.applyDateRange}
          />

          <button
            type="button"
            className="hist-find-clear"
            onClick={filter.clearFilters}
            title="Clear"
            aria-label="Clear all filters"
          >
            ×
          </button>
        </div>
      </div>

      <div className="hist-find-meta">
        <span>{resultLabel}</span>
        {filter.minSimilarity ? (
          <>
            <span className="hist-find-meta-sep">·</span>
            <span>similarity ≥ {filter.minSimilarity}%</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
