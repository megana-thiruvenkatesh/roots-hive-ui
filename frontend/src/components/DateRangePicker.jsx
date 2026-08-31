import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromISO(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function formatDisplayDate(value) {
  const date = fromISO(value);
  if (!date) return '';
  return `${pad(date.getDate())}-${SHORT[date.getMonth()]}-${date.getFullYear()}`;
}

function monthCells(viewDate) {
  const first = startOfMonth(viewDate);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const prevDays = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0).getDate();
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    const day = prevDays - startWeekday + i + 1;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, day);
    cells.push({ date, iso: toISO(date), outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    cells.push({ date, iso: toISO(date), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - (startWeekday + daysInMonth) + 1;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, extra);
    cells.push({ date, iso: toISO(date), outside: true });
  }
  return cells;
}

function yearOptions(centerYear = new Date().getFullYear()) {
  const years = [];
  for (let year = centerYear - 20; year <= centerYear + 5; year += 1) years.push(year);
  return years;
}

function CalendarMonth({ viewDate, selected, inRangeStart, inRangeEnd, onSelect, onPrev, onNext, onMonthYearChange }) {
  const cells = useMemo(() => monthCells(viewDate), [viewDate]);
  const years = useMemo(() => yearOptions(viewDate.getFullYear()), [viewDate]);

  return (
    <div className="drp-cal">
      <div className="drp-cal-head">
        <button type="button" className="drp-nav" onClick={onPrev} aria-label="Previous month">‹</button>
        <div className="drp-month-year">
          <select
            className="drp-month-select"
            value={viewDate.getMonth()}
            onChange={(e) => onMonthYearChange(viewDate.getFullYear(), Number(e.target.value))}
            aria-label="Select month"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="drp-year-select"
            value={viewDate.getFullYear()}
            onChange={(e) => onMonthYearChange(Number(e.target.value), viewDate.getMonth())}
            aria-label="Select year"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="drp-nav" onClick={onNext} aria-label="Next month">›</button>
      </div>
      <div className="drp-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="drp-grid">
        {cells.map((cell) => {
          const selectedDay = cell.iso === selected;
          const inRange = inRangeStart && inRangeEnd && cell.iso >= inRangeStart && cell.iso <= inRangeEnd;
          return (
            <button
              key={`${cell.iso}${cell.outside ? '-o' : ''}`}
              type="button"
              className={`drp-day${cell.outside ? ' outside' : ''}${selectedDay ? ' selected' : ''}${inRange && !selectedDay ? ' in-range' : ''}`}
              onClick={() => onSelect(cell.iso)}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ fromDate, toDate, onApply }) {
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(fromDate || '');
  const [draftTo, setDraftTo] = useState(toDate || '');
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(fromISO(fromDate) || new Date()));
  const [rightMonth, setRightMonth] = useState(() => addMonths(startOfMonth(fromISO(toDate) || new Date()), 0));
  const [popStyle, setPopStyle] = useState({});

  const active = Boolean(fromDate || toDate);

  useEffect(() => {
    if (!open) return undefined;
    setDraftFrom(fromDate || '');
    setDraftTo(toDate || '');
    const from = fromISO(fromDate) || new Date();
    const to = fromISO(toDate) || from;
    setLeftMonth(startOfMonth(from));
    const nextRight = startOfMonth(to);
    setRightMonth(
      nextRight.getTime() === startOfMonth(from).getTime() ? addMonths(startOfMonth(from), 1) : nextRight
    );

    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(640, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
      setPopStyle({
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 80,
      });
    }

    function onDocClick(event) {
      if (wrapRef.current?.contains(event.target) || popRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, fromDate, toDate]);

  function apply() {
    if (!draftFrom && !draftTo) return;
    const from = draftFrom || draftTo;
    const to = draftTo || draftFrom;
    onApply({
      fromDate: from <= to ? from : to,
      toDate: from <= to ? to : from,
      presetId: 'custom',
    });
    setOpen(false);
  }

  return (
    <div className="drp-icon-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`drp-icon-btn${active ? ' active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        title="Select date range"
        aria-label="Select date range"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <rect x="2" y="3.2" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 6.8h12" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.2 2v3.2M10.8 2v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div className="drp-pop drp-pop-stack" style={popStyle} ref={popRef}>
              <div className="drp-cals">
                <div>
                  <div className="drp-field-row">
                    <span>From</span>
                    <strong>{formatDisplayDate(draftFrom) || '—'}</strong>
                  </div>
                  <CalendarMonth
                    viewDate={leftMonth}
                    selected={draftFrom}
                    inRangeStart={draftFrom}
                    inRangeEnd={draftTo}
                    onSelect={setDraftFrom}
                    onPrev={() => setLeftMonth((current) => addMonths(current, -1))}
                    onNext={() => setLeftMonth((current) => addMonths(current, 1))}
                    onMonthYearChange={(year, month) => setLeftMonth(new Date(year, month, 1))}
                  />
                </div>
                <div>
                  <div className="drp-field-row">
                    <span>To</span>
                    <strong>{formatDisplayDate(draftTo) || '—'}</strong>
                  </div>
                  <CalendarMonth
                    viewDate={rightMonth}
                    selected={draftTo}
                    inRangeStart={draftFrom}
                    inRangeEnd={draftTo}
                    onSelect={setDraftTo}
                    onPrev={() => setRightMonth((current) => addMonths(current, -1))}
                    onNext={() => setRightMonth((current) => addMonths(current, 1))}
                    onMonthYearChange={(year, month) => setRightMonth(new Date(year, month, 1))}
                  />
                </div>
              </div>
              <div className="drp-actions">
                <button type="button" className="btn secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn" onClick={apply} disabled={!draftFrom && !draftTo}>
                  Apply
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
