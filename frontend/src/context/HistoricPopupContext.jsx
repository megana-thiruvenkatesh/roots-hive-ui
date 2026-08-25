import React, { createContext, useContext, useEffect, useState } from 'react';
import { HistoricAttributeGrid, HistoricRecordFace, ResultMeta } from '../components/HistoricResultCard.jsx';
import { buildHistoricCaseView } from '../lib/historicChunkAttributes.js';
import { renderAnalysisSections } from '../lib/analysisMethods';

const HistoricPopupContext = createContext();

function headerOffset() {
  const header = document.querySelector('.top-header');
  if (header) return Math.round(header.getBoundingClientRect().bottom + 10);
  return 68;
}

function PopupDetails({ item, expandAll }) {
  if (item.kind === 'ai') {
    const analysisSections = item.analysisMethod
      ? renderAnalysisSections(item, item.analysisMethod)
      : item.whyWhy?.length
        ? [{ title: 'Why-Why', empty: false, lines: item.whyWhy.map((why, index) => `Why ${index + 1}: ${why}`) }]
        : [];

    return (
      <div className="historic-popup-body">
        <div className="result-meta-row">
          <ResultMeta
            date={item.recordDate || item.matchDate}
            score={item.similarityScore}
          />
        </div>
        {item.description ? <p><strong>Description:</strong> {item.description}</p> : null}
        {item.rootCause ? <p><strong>Root Cause:</strong> {item.rootCause}</p> : null}
        {analysisSections.map((section) => (
          <div key={section.title} className={section.empty ? 'analysis-empty' : undefined}>
            <strong>{section.title}</strong>
            <ul>
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
        {item.correctiveAction ? <p><strong>Corrective Action:</strong> {item.correctiveAction}</p> : null}
        {item.preventiveAction ? <p><strong>Preventive Action:</strong> {item.preventiveAction}</p> : null}
      </div>
    );
  }

  const view = buildHistoricCaseView(item);
  return (
    <div className="historic-popup-body">
      <div className="hist-card hist-case-card hist-popup-record">
        <HistoricRecordFace view={view} />
      </div>
      <HistoricAttributeGrid item={item} expandAll={expandAll} />
    </div>
  );
}

export function HistoricPopupProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [popupTop, setPopupTop] = useState(68);

  const keyFor = (item) => item.popupKey || `${item.source || item.kind || 'result'}-${item.id}`;

  useEffect(() => {
    function syncTop() {
      setPopupTop(headerOffset());
    }
    syncTop();
    window.addEventListener('resize', syncTop);
    return () => window.removeEventListener('resize', syncTop);
  }, []);

  function openPopup(item) {
    const key = keyFor(item);
    setPopupTop(headerOffset());
    setWindows((current) => {
      const exists = current.some((entry) => entry.key === key);
      const minimizedOthers = current.map((entry) => (
        entry.key === key
          ? { ...entry, item, minimized: false, maximized: false }
          : { ...entry, minimized: true, maximized: false }
      ));
      return exists
        ? minimizedOthers
        : [...minimizedOthers, { key, item, minimized: false, maximized: false }];
    });
    setActiveKey(key);
  }

  function minimize(key) {
    setWindows((current) => current.map((entry) => (
      entry.key === key ? { ...entry, minimized: true, maximized: false } : entry
    )));
    setActiveKey(null);
  }

  function restore(key) {
    setPopupTop(headerOffset());
    setWindows((current) => current.map((entry) => (
      entry.key === key
        ? { ...entry, minimized: false, maximized: false }
        : { ...entry, minimized: true, maximized: false }
    )));
    setActiveKey(key);
  }

  function maximize(key) {
    setPopupTop(headerOffset());
    setWindows((current) => current.map((entry) => (
      entry.key === key
        ? { ...entry, minimized: false, maximized: true }
        : entry
    )));
    setActiveKey(key);
  }

  function restoreSide(key) {
    setPopupTop(headerOffset());
    setWindows((current) => current.map((entry) => (
      entry.key === key ? { ...entry, minimized: false, maximized: false } : entry
    )));
    setActiveKey(key);
  }

  function close(key) {
    setWindows((current) => current.filter((entry) => entry.key !== key));
    setActiveKey((current) => (current === key ? null : current));
  }

  const activeWindow = windows.find((entry) => entry.key === activeKey && !entry.minimized);
  const minimizedWindows = windows.filter((entry) => entry.minimized);
  const maximized = Boolean(activeWindow?.maximized);

  return (
    <HistoricPopupContext.Provider value={{ openPopup, minimize, restore, maximize, restoreSide, close }}>
      {children}
      {activeWindow ? (
        <>
          {maximized ? (
            <button
              type="button"
              className="historic-popup-backdrop"
              aria-label="Close maximized preview"
              onClick={() => restoreSide(activeWindow.key)}
            />
          ) : null}
          <div
            className={`historic-popup-container${maximized ? ' maximized' : ''}`}
            style={
              maximized
                ? undefined
                : {
                    top: popupTop,
                    height: `calc(100vh - ${popupTop + 16}px)`,
                    maxHeight: `calc(100vh - ${popupTop + 16}px)`,
                  }
            }
          >
            <div className="historic-popup-header">
              <span>{activeWindow.item.kind === 'ai' ? 'AI' : 'Historic'} · {activeWindow.item.id}</span>
              <div className="historic-popup-actions">
                {maximized ? (
                  <button type="button" onClick={() => restoreSide(activeWindow.key)} title="Back to side preview">
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path d="M9 9 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 4H4v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 15l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M17 20h3v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <button type="button" onClick={() => maximize(activeWindow.key)} title="Maximize center preview">
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path d="M4 4l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9 4H4v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 20l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M15 20h5v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button type="button" onClick={() => minimize(activeWindow.key)} title="Minimize">—</button>
                <button type="button" onClick={() => close(activeWindow.key)} title="Close">×</button>
              </div>
            </div>
            <PopupDetails item={activeWindow.item} expandAll />
          </div>
        </>
      ) : null}
      {minimizedWindows.length ? (
        <div className="historic-popup-dock">
          {minimizedWindows.map((entry) => (
            <div key={entry.key} className="historic-popup-chip">
              <span className="historic-popup-chip-label">
                {entry.item.kind === 'ai' ? 'AI' : '📂'} {entry.item.id}
              </span>
              <div className="historic-popup-chip-actions">
                <button
                  type="button"
                  className="historic-popup-chip-maximize"
                  title={`Restore ${entry.item.id}`}
                  onClick={() => restore(entry.key)}
                  aria-label={`Restore ${entry.item.id}`}
                >
                  <svg className="historic-popup-maximize-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      d="M9 5h11v11"
                    />
                    <rect
                      x="4"
                      y="8"
                      width="12"
                      height="12"
                      rx="1.2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="historic-popup-chip-close"
                  title={`Close ${entry.item.id}`}
                  onClick={() => close(entry.key)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </HistoricPopupContext.Provider>
  );
}

export function useHistoricPopup() {
  const context = useContext(HistoricPopupContext);
  if (!context) throw new Error('useHistoricPopup must be used within HistoricPopupProvider');
  return context;
}
