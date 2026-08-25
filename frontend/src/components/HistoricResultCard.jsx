import React, { useRef, useState } from 'react';
import { useHistoricPopup } from '../context/HistoricPopupContext.jsx';
import HistoricImageGallery from './HistoricImageGallery.jsx';
import { buildHistoricCaseView } from '../lib/historicChunkAttributes.js';

function formatResultDate(date) {
  if (!date) return 'Date unavailable';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function similarityTone(score) {
  if (score == null) return '';
  if (score < 50) return 'low';
  if (score === 50) return 'mid';
  return 'high';
}

function DiagonalExpandIcon({ open }) {
  /* Expand = arrows out (NE / SW); Collapse = arrows in */
  return (
    <svg className="hist-expand-icon" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <>
          <path d="M19 5 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 5h5v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 19 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 19H5v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M14 10 19 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15.5 5H19v3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 14 5 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8.5 19H5v-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function SectionArrowIcon({ open }) {
  return (
    <svg className="hist-section-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? 'M6 14l6-6 6 6' : 'M8 6l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResultMeta({ date, score }) {
  const tone = similarityTone(score);
  return (
    <div className="result-meta">
      <span className="result-meta-date">{formatResultDate(date)}</span>
      {score != null ? (
        <span className={`result-meta-score ${tone}`}>{score}% Similarity</span>
      ) : null}
    </div>
  );
}

export function useResultInteraction(item, toggleExpanded) {
  const { openPopup } = useHistoricPopup();
  const clickTimer = useRef(null);

  function onClick(event) {
    if (event.target.closest('input, textarea, select, label, a, button')) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => toggleExpanded(), 220);
  }

  function onDoubleClick(event) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    event.preventDefault();
    openPopup(item);
  }

  return { onClick, onDoubleClick };
}

function ExpandableSection({ title, date, showDate, wide, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className={`hist-section-card${wide ? ' full' : ''}${open ? ' open' : ''}`}>
      <button
        type="button"
        className="hist-section-head"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-expanded={open}
      >
        <span className="hist-section-title">{title}</span>
        {showDate && date ? <span className="hist-section-date">{date}</span> : null}
        <span className="hist-section-toggle" aria-hidden="true">
          <SectionArrowIcon open={open} />
        </span>
      </button>
      {open ? <div className="hist-section-body">{children}</div> : null}
    </article>
  );
}

function SectionBody({ section }) {
  return (
    <>
      {section.table?.rows?.length ? (
        <div className="hist-mini-table-wrap">
          <table className="hist-mini-table">
            <thead>
              <tr>
                {section.table.columns.map((col) => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, index) => (
                <tr key={`${section.key}-${index}`}>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.lines?.length ? (
        <ol className="hist-section-list">
          {section.lines.map((line) => <li key={line}>{line}</li>)}
        </ol>
      ) : null}
      {section.text && section.text !== '—' ? <p className="hist-section-text">{section.text}</p> : null}
      {section.confirmed && section.confirmed !== '—' ? (
        <p className="hist-section-confirmed">
          <span>Confirmed root cause</span>
          {section.confirmed}
        </p>
      ) : null}
      {section.fields?.map((field) => (
        <p key={field.label} className="hist-section-confirmed">
          <span>{field.label}</span>
          {field.value}
        </p>
      ))}
      {section.remarks && section.remarks !== '—' ? (
        <p className="hist-section-confirmed">
          <span>Remarks</span>
          {section.remarks}
        </p>
      ) : null}
      {section.owner ? (
        <p className="hist-section-meta">Owner · target {section.owner}</p>
      ) : null}
      {section.verification && section.verification !== '—' ? (
        <p className="hist-section-meta">Verification {section.verification}</p>
      ) : null}
    </>
  );
}

export function HistoricAttributeGrid({ item, expandAll = false }) {
  const view = buildHistoricCaseView(item);
  return (
    <div className="hist-expanded-content">
      <div className="hist-section-grid">
        {view.sections.map((section) => (
          <ExpandableSection
            key={`${section.key}-${expandAll ? 'open' : 'shut'}`}
            title={section.title}
            date={section.date}
            showDate={section.showDate}
            wide={section.wide}
            defaultOpen={expandAll}
          >
            <SectionBody section={section} />
          </ExpandableSection>
        ))}
      </div>
      <HistoricImageGallery item={item} />
    </div>
  );
}

export function HistoricRecordFace({ view, rank, expanded, onToggle, selected, onSelectReference, item, showSelect = true }) {
  return (
    <>
      <div className="hist-case-top">
        <div className="hist-case-idrow">
          {rank != null ? <span className="hist-rank">#{rank}</span> : null}
          <strong className="hist-case-id">{view.id}</strong>
          <span className="hist-type-badge">{view.sourceType}</span>
          {view.issueDate && view.issueDate !== '—' ? (
            <span className="hist-date-badge">{view.issueDate}</span>
          ) : null}
        </div>
        <div className="hist-case-end">
          <div className="hist-confidence">
            <strong>{view.overall}%</strong>
            <span className="hist-confidence-caption">overall match</span>
            <span className={`hist-match-label ${view.matchTone}`}>{view.matchLabel}</span>
          </div>
          {onToggle ? (
            <button
              type="button"
              className="hist-expand-arrow"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              title={expanded ? 'Collapse' : 'Expand'}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <DiagonalExpandIcon open={expanded} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="hist-case-bar" />
      <p className="hist-case-problem">{view.problem}</p>
      <div className="hist-meta-grid">
        {view.metadata.map((entry) => (
          <div key={entry.label} className="hist-meta-item">
            <span>{entry.label}</span>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
      {view.signals.length ? (
        <>
          <p className="hist-signals-title">Why this case was retrieved</p>
          <div className="hist-signals">
            {view.signals.map((signal) => (
              <span key={signal} className="hist-signal">✓ {signal}</span>
            ))}
          </div>
        </>
      ) : null}
      <div className="hist-score-breakdown">
        <div className="hist-score-line">
          <span>Problem similarity</span>
          <span className="hist-score-track"><span style={{ width: `${view.problemSim}%` }} /></span>
          <b>{view.problemSim}%</b>
        </div>
        <div className="hist-score-line">
          <span>Context match</span>
          <span className="hist-score-track"><span style={{ width: `${view.contextSim}%` }} /></span>
          <b>{view.contextSim}%</b>
        </div>
      </div>
      {showSelect && onSelectReference ? (
        <div className="hist-case-actions">
          <button
            type="button"
            className={`hist-select-ref${selected ? ' selected' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectReference(item);
            }}
          >
            {selected ? 'Selected as reference' : 'Select as reference'}
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function HistoricResultCard({ item, expanded, onToggle, analysisMethod, rank, selected, onSelectReference }) {
  const { openPopup } = useHistoricPopup();
  const clickTimer = useRef(null);
  const popupItem = { ...item, analysisMethod };
  const view = buildHistoricCaseView(item);

  function handleClick(event) {
    if (event.target.closest('.hist-section-head, .hist-section-body, .hist-expand-arrow, .hist-select-ref, button, a, input, textarea, select')) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(onToggle, 220);
  }

  function handleDoubleClick(event) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    event.preventDefault();
    openPopup(popupItem);
  }

  return (
    <article
      className={`hist-card hist-case-card ${expanded ? 'open' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click to expand; double-click for side preview"
    >
      <HistoricRecordFace
        view={view}
        rank={rank}
        expanded={expanded}
        onToggle={onToggle}
        item={item}
        selected={selected}
        onSelectReference={onSelectReference}
        showSelect={!expanded}
      />
      {expanded ? (
        <div className="hist-body" onClick={(event) => event.stopPropagation()}>
          <HistoricAttributeGrid item={item} expandAll />
        </div>
      ) : null}
      {expanded && onSelectReference ? (
        <div className="hist-case-actions hist-case-actions-bottom">
          <button
            type="button"
            className={`hist-select-ref${selected ? ' selected' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectReference(item);
            }}
          >
            {selected ? 'Selected as reference' : 'Select as reference'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
