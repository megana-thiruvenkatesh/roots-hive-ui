import React, { createContext, useContext, useState } from 'react';
import { HistoricAttributeGrid, HistoricRecordFace, ResultMeta } from '../components/HistoricResultCard.jsx';
import { buildHistoricCaseView } from '../lib/historicChunkAttributes.js';
import { renderAnalysisSections } from '../lib/analysisMethods';

const HistoricPopupContext = createContext();

function PopupDetails({ item }) {
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
      <HistoricAttributeGrid item={item} />
    </div>
  );
}

export function HistoricPopupProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [popupTop, setPopupTop] = useState(98);

  const keyFor = (item) => item.popupKey || `${item.source || item.kind || 'result'}-${item.id}`;

  function openPopup(item) {
    const key = keyFor(item);
    const cardRow = document.querySelector('.engine-assist-row, .new-complaint-row');
    if (cardRow) setPopupTop(Math.max(12, Math.round(cardRow.getBoundingClientRect().top + 28)));
    setWindows((current) => {
      const exists = current.some((entry) => entry.key === key);
      const minimizedOthers = current.map((entry) => (
        entry.key === key
          ? { ...entry, item, minimized: false }
          : { ...entry, minimized: true }
      ));
      return exists
        ? minimizedOthers
        : [...minimizedOthers, { key, item, minimized: false }];
    });
    setActiveKey(key);
  }

  function minimize(key) {
    setWindows((current) => current.map((entry) => (
      entry.key === key ? { ...entry, minimized: true } : entry
    )));
    setActiveKey(null);
  }

  function restore(key) {
    setWindows((current) => current.map((entry) => (
      entry.key === key
        ? { ...entry, minimized: false }
        : { ...entry, minimized: true }
    )));
    setActiveKey(key);
  }

  function close(key) {
    setWindows((current) => current.filter((entry) => entry.key !== key));
    setActiveKey((current) => (current === key ? null : current));
  }

  const activeWindow = windows.find((entry) => entry.key === activeKey && !entry.minimized);
  const minimizedWindows = windows.filter((entry) => entry.minimized);

  return (
    <HistoricPopupContext.Provider value={{ openPopup, minimize, restore, close }}>
      {children}
      {activeWindow ? (
        <div
          className="historic-popup-container"
          style={{
            top: popupTop,
            height: `calc(100vh - ${popupTop + 28}px)`,
            maxHeight: `calc(100vh - ${popupTop + 28}px)`,
          }}
        >
          <div className="historic-popup-header">
            <span>{activeWindow.item.kind === 'ai' ? 'AI' : 'Historic'} · {activeWindow.item.id}</span>
            <div className="historic-popup-actions">
              <button type="button" onClick={() => minimize(activeWindow.key)} title="Minimize">—</button>
              <button type="button" onClick={() => close(activeWindow.key)} title="Close">×</button>
            </div>
          </div>
          <PopupDetails item={activeWindow.item} />
        </div>
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
                  title={`Maximize ${entry.item.id}`}
                  onClick={() => restore(entry.key)}
                  aria-label={`Maximize ${entry.item.id}`}
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
