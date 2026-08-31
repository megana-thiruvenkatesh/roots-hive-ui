import React, { useMemo, useState } from 'react';
import { applyHistoricRecordsFilters } from '../lib/historicRecordsFilter.js';
import DateRangePicker from './DateRangePicker.jsx';

export function resolveResultsLimit(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(20, Math.floor(n));
}

/** @deprecated use resolveResultsLimit */
export function clampResultsToShow(value) {
  return resolveResultsLimit(value) ?? 20;
}

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

function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M4.2 10a5.8 5.8 0 0 1 9.9-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12.5 4.5H16V8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 10a5.8 5.8 0 0 1-9.9 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M7.5 15.5H4V12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HistoricRecordsFindBar({
  filter,
  totalCount,
  filteredCount,
  resultsToShow,
  onResultsToShowChange,
}) {
  const matchedCount = filteredCount ?? filter.filteredMatches?.length ?? filter.shownMatches.length;
  const showLimit = resolveResultsLimit(resultsToShow);
  const showingCount = showLimit == null ? matchedCount : Math.min(showLimit, matchedCount);
  const showInputValue =
    resultsToShow === '' || resultsToShow == null ? '' : String(resultsToShow);

  function handleReset() {
    filter.clearFilters();
    onResultsToShowChange?.('');
  }

  return (
    <div className="hist-find-wrap">
      <div className="hist-find-bar">
        <div className="hist-find-row">
          <div className="hist-find-search">
            <span className="hist-find-in-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              className="hist-find-input"
              value={filter.query}
              onChange={(e) => filter.setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search historic records"
            />
          </div>

          <div className="hist-find-filters">
            {onResultsToShowChange ? (
              <div className="hist-find-cell hist-find-show">
                <span className="hist-find-lbl">Show</span>
                <input
                  type="number"
                  className="hist-find-num-input"
                  value={showInputValue}
                  onChange={(e) => onResultsToShowChange(e.target.value)}
                  min={1}
                  max={20}
                  step={1}
                  placeholder="All"
                  title={
                    showLimit == null
                      ? `Showing all ${matchedCount} matched record${matchedCount === 1 ? '' : 's'}`
                      : `Showing ${showingCount} of ${matchedCount} matched record${matchedCount === 1 ? '' : 's'}`
                  }
                  aria-label="Limit number of results to show"
                />
              </div>
            ) : (
              <div className="hist-find-cell hist-find-count-only">
                <span className="hist-find-hint">
                  {showingCount} of {matchedCount}
                </span>
              </div>
            )}

            <div className="hist-find-cell hist-find-sim">
              <span className="hist-find-lbl">Score</span>
              <span className="hist-find-op">≥</span>
              <input
                type="number"
                className="hist-find-num-input"
                value={filter.minSimilarity}
                onChange={(e) => filter.setMinSimilarity(e.target.value)}
                placeholder="—"
                min={0}
                max={100}
                step={1}
                title="Minimum similarity score (%)"
                aria-label="Minimum similarity score percent"
              />
              <span className="hist-find-unit">%</span>
            </div>

            <div className="hist-find-cell hist-find-date">
              <span className="hist-find-lbl">Date</span>
              <DateRangePicker
                fromDate={filter.fromDate}
                toDate={filter.toDate}
                onApply={filter.applyDateRange}
              />
            </div>

            <div className="hist-find-cell hist-find-reset-cell">
              <button
                type="button"
                className="hist-find-reset"
                onClick={handleReset}
                title="Reset all filters"
                aria-label="Reset all filters"
              >
                <ResetIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
