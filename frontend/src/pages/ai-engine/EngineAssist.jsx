import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import HistoricResultCard, {
  ResultMeta,
} from '../../components/HistoricResultCard.jsx';
import HistoricRecordsFindBar, { useHistoricRecordsFilter } from '../../components/HistoricRecordsFindBar.jsx';
import ChatAttachControl, { ChatAttachChips, formatChatAttachments } from '../../components/ChatAttachControl.jsx';
import { analysisLabel } from '../../lib/analysisMethods';

function useDebounced(value, ms = 450) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function formatSeedAnswer(assistAnswer, suggestion, mode) {
  if (!suggestion && assistAnswer) return assistAnswer;
  if (!suggestion) return assistAnswer || '';

  if (mode === 'rca' || mode === 'diagnostic') {
    const whyLines =
      suggestion.whyWhy?.length > 0
        ? suggestion.whyWhy
        : [
            `Problem observed related to ${suggestion.rootCause || 'the defect'}`,
            'Immediate process / part condition deviation',
            'Control or detection gap in the current method',
            'Standard / checkpoint not enforced',
          ];
    return [
      'RCA (via Why-Why analysis)',
      '',
      `Root cause: ${suggestion.rootCause}`,
      '',
      'Why-Why analysis:',
      ...whyLines.map((w, i) => `  Why ${i + 1}: ${w}`),
      '',
      `Corrective Action (CA): ${suggestion.correctiveAction}`,
      '',
      `Preventive Action (PA): ${suggestion.preventiveAction}`,
      suggestion.summary ? `\n${suggestion.summary}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }
  if (mode === 'why-why' || mode === 'analysis') {
    return (
      suggestion.analysisText ||
      [
        `${analysisLabel(suggestion.analysisMethod)} Analysis:`,
        `No ${analysisLabel(suggestion.analysisMethod)} analysis available for this historic case.`,
        '',
        `Derived root cause: ${suggestion.rootCause || '—'}`,
        `Corrective Action (CA): ${suggestion.correctiveAction || '—'}`,
        `Preventive Action (PA): ${suggestion.preventiveAction || '—'}`,
      ].join('\n')
    );
  }
  if (mode === 'ca') {
    return [
      `Corrective Action (CA):\n${suggestion.correctiveAction}`,
      '',
      `Preventive Action (PA):\n${suggestion.preventiveAction}`,
      '',
      `Linked root cause: ${suggestion.rootCause}`,
    ].join('\n');
  }
  return assistAnswer || '';
}

/**
 * Auto historic matches + AI solution chat for AI Engine pages.
 */
export function useEngineAssist({
  type = 'Internal',
  description = '',
  defectCat = '',
  part = '',
  mode = 'diagnostic',
  analysisMethod = 'why-why',
}) {
  const [matches, setMatches] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [chat, setChat] = useState([]);
  const [matching, setMatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [pendingFiles, setPendingFiles] = useState([]);

  const dDesc = useDebounced(description, 450);
  const dCat = useDebounced(defectCat, 450);
  const dPart = useDebounced(part, 450);
  const dType = useDebounced(type, 200);
  const dMethod = useDebounced(analysisMethod, 150);

  const ctxRef = useRef({ type, description, defectCat, part, mode, analysisMethod });
  ctxRef.current = { type, description, defectCat, part, mode, analysisMethod };

  useEffect(() => {
    const q = (dDesc || '').trim();
    const cat = (dCat || '').trim();
    if (q.length < 4 && cat.length < 2) {
      setMatches([]);
      setSuggestion(null);
      setChat([]);
      return;
    }

    let cancelled = false;
    setMatching(true);
    setBusy(true);

    Promise.all([
      api.post('/complaints/similar', {
        type: dType,
        description: dDesc,
        defectCat: dCat,
        part: dPart,
      }),
      api.post('/ai/complaint-assist', {
        type: dType,
        description: dDesc || dCat,
        defectCat: dCat,
        part: dPart,
        mode,
        analysisMethod: dMethod,
      }),
    ])
      .then(([similar, assist]) => {
        if (cancelled) return;
        const sug = assist.suggestion || similar.suggestion || null;
        setMatches(similar.matches || []);
        setSuggestion(sug);
        const seed = assist.answer || formatSeedAnswer(assist.answer, sug, mode);
        setChat(
          seed
            ? [{ id: crypto.randomUUID(), role: 'ai', text: seed, suggestion: sug }]
            : []
        );
        setExpanded({});
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setSuggestion(null);
          setChat([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMatching(false);
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dDesc, dCat, dPart, dType, mode, dMethod]);

  async function sendChat(messageText) {
    const text = formatChatAttachments(pendingFiles, messageText);
    if (!text || busy) return;

    setPendingFiles([]);
    const next = [...chat, { id: crypto.randomUUID(), role: 'user', text }];
    setChat(next);
    setBusy(true);
    try {
      const { type: t, description: d, defectCat: c, part: p, mode: m, analysisMethod: am } = ctxRef.current;
      const data = await api.post('/ai/complaint-assist', {
        type: t,
        description: d || c,
        defectCat: c,
        part: p,
        message: text,
        mode: m,
        analysisMethod: am,
        history: next.map((msg) => ({ role: msg.role, text: msg.text })),
      });
      const reply =
        data.answer || formatSeedAnswer(data.answer, data.suggestion, m) || 'No response.';
      setChat((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text: reply,
          suggestion: data.suggestion,
        },
      ]);
      if (data.suggestion) setSuggestion(data.suggestion);
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'ai', text: `⚠ ${err.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return {
    matches,
    suggestion,
    chat,
    matching,
    busy,
    expanded,
    setExpanded,
    pendingFiles,
    setPendingFiles,
    sendChat,
    ready: (dDesc || '').trim().length >= 4 || (dCat || '').trim().length >= 2,
  };
}

export function EngineHistoricPanel({
  type,
  matches,
  matching,
  ready,
  expanded,
  setExpanded,
  analysisMethod,
}) {
  const filter = useHistoricRecordsFilter(matches);

  return (
    <section className="result-card-section">
      <div className="outside-card-title">
        2. Historic Records
        <span className="muted" style={{ fontWeight: 600, marginLeft: 8 }}>
          ({type})
        </span>
      </div>
      <div className="card nc-card engine-side-card">
        {!ready ? (
          <p className="muted" style={{ margin: 0 }}>
            Fill details to auto-fetch similar historic cases.
          </p>
        ) : matching ? (
          <p className="muted" style={{ margin: 0 }}>
            Searching historic data…
          </p>
        ) : !matches.length ? (
          <div className="empty-panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>No Historic Data</h3>
            <p className="muted" style={{ margin: 0 }}>
              No similar records found in the {type} data source for the details entered.
            </p>
          </div>
        ) : (
          <>
            <HistoricRecordsFindBar filter={filter} totalCount={matches.length} />

            {!filter.shownMatches.length ? (
              <div className="empty-panel" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>No matches with filters</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Try reducing the similarity threshold or clearing the find bar.
                </p>
              </div>
            ) : (
              <div className="hist-stack">
                {filter.shownMatches.map((m, index) => (
                  <HistoricResultCard
                    key={`${m.source}-${m.id}`}
                    item={m}
                    rank={index + 1}
                    expanded={Boolean(expanded[m.id])}
                    onToggle={() => setExpanded((current) => ({
                      ...current,
                      [m.id]: !current[m.id],
                    }))}
                    analysisMethod={analysisMethod}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function EngineAiPanel({
  type,
  ready,
  busy,
  chat = [],
  sendChat,
  pendingFiles = [],
  setPendingFiles,
  analysisMethod,
}) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const latestAiMessage = [...chat].reverse().find((message) => message.role === 'ai');
  const suggestion = latestAiMessage?.suggestion;
  const todayDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, busy]);

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !pendingFiles.length) || busy) return;
    setInput('');
    await sendChat?.(text);
  }

  return (
    <section className="result-card-section">
      <div className="outside-card-title">
        3. AI Suggested Solution
        {ready && latestAiMessage ? <span className="ai-solution-chat-label">Refine in chat</span> : null}
      </div>
      <div className="card nc-card nc-ai-card engine-side-card">
        <div className="result-meta-row">
          <ResultMeta date={todayDate} score={suggestion?.similarityScore} />
        </div>
        <div className="nc-ai-messages">
              {!ready ? (
                <p className="muted" style={{ margin: 'auto', textAlign: 'center' }}>
                  Fill details — AI solution appears here, then chat to refine.
                </p>
              ) : null}
              {chat.map((m) => (
                <div key={m.id} className={`ai-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                  <div className="ai-bubble-text">{m.text}</div>
                </div>
              ))}
              {busy ? <div className="ai-bubble ai thinking">Thinking…</div> : null}
              {ready && !chat.length && !busy ? (
                <div className="empty-panel" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>No AI Suggestion Yet</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    Add more description for a better solution.
                  </p>
                </div>
              ) : null}
              <div ref={endRef} />
        </div>

        <form className="nc-ai-composer" onSubmit={onSubmit}>
              <ChatAttachControl
                files={pendingFiles}
                onChange={setPendingFiles}
                disabled={!ready || busy}
              />
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type here to chat — modify, update, or add to this solution…"
                disabled={!ready || busy}
              />
              <button
                className="btn"
                type="submit"
                disabled={!ready || busy || (!input.trim() && !pendingFiles.length)}
                title="Send"
              >
                ➤
              </button>
        </form>
        <ChatAttachChips
          files={pendingFiles}
          onRemove={(file) =>
            setPendingFiles?.((current) =>
              current.filter((entry) => !(entry.name === file.name && entry.size === file.size))
            )
          }
        />
      </div>
    </section>
  );
}

export function TypeSourceSelect({ value, onChange }) {
  return (
    <div className="field">
      <label>Data source type</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option>Internal</option>
        <option>Supplier</option>
      </select>
    </div>
  );
}
