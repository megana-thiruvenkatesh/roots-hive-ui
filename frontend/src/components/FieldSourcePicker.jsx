import React, { useMemo, useState } from 'react';

/**
 * Pick RCA / Why-Why / CA / PA from AI suggestion or historic case (search by id/name).
 * onChange(value, meta?) where meta = { source: 'ai'|'historic'|'manual', historic? }
 */
export default function FieldSourcePicker({
  label,
  value,
  onChange,
  multiline = false,
  historicMatches = [],
  aiSuggestion = null,
  fieldKey, // rootCause | whyWhy | correctiveAction | preventiveAction
}) {
  const [mode, setMode] = useState(null); // ai | historic | null
  const [query, setQuery] = useState('');

  const aiValue = useMemo(() => {
    if (!aiSuggestion) return '';
    if (fieldKey === 'whyWhy') {
      const list = aiSuggestion.whyWhy || [];
      return Array.isArray(list) ? list.join('\n') : String(list || '');
    }
    return String(aiSuggestion[fieldKey] || '');
  }, [aiSuggestion, fieldKey]);

  const historicOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (historicMatches || [])
      .map((item) => {
        const id = String(item.id || '');
        const name = String(item.symptom || item.part || item.description || '').slice(0, 80);
        let fill = '';
        if (fieldKey === 'rootCause') fill = item.rootCause || item.chunk?.rca?.IMS_WHY || '';
        else if (fieldKey === 'whyWhy') {
          const why = item.whyWhy || [
            item.chunk?.rca?.IMS_WHY1,
            item.chunk?.rca?.IMS_WHY2,
            item.chunk?.rca?.IMS_WHY3,
            item.chunk?.rca?.IMS_WHY4,
          ].filter(Boolean);
          fill = Array.isArray(why) ? why.join('\n') : String(why || '');
        } else if (fieldKey === 'correctiveAction') {
          fill = item.correctiveAction || item.chunk?.ca?.IMS_CORRECTIVEACTION || '';
        } else if (fieldKey === 'preventiveAction') {
          fill = item.preventiveAction || item.chunk?.pa?.IMS_ONSITEVERIFICATION || '';
        }
        return { id, name, fill, item, label: `${id}${name ? ` · ${name}` : ''}` };
      })
      .filter((entry) => entry.fill)
      .filter((entry) => {
        if (!q) return true;
        return entry.id.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [historicMatches, query, fieldKey]);

  function applyAi() {
    if (!aiValue) return;
    onChange(aiValue, { source: 'ai' });
    setMode(null);
  }

  function applyHistoric(option) {
    onChange(option.fill, {
      source: 'historic',
      historic: {
        id: option.item.id,
        symptom: option.item.symptom || '',
        description: option.item.description || '',
        rootCause: option.item.rootCause || option.item.chunk?.rca?.IMS_WHY || '',
        whyWhy: option.item.whyWhy || [],
        correctiveAction: option.item.correctiveAction || option.item.chunk?.ca?.IMS_CORRECTIVEACTION || '',
        preventiveAction: option.item.preventiveAction || option.item.chunk?.pa?.IMS_ONSITEVERIFICATION || '',
        recordDate: option.item.recordDate || option.item.chunk?.detail?.IMS_DATEOFISSUE || null,
        sourceType: option.item.sourceType || option.item.source || null,
        similarityScore: option.item.similarityScore ?? null,
        chunk: option.item.chunk || null,
      },
    });
    setMode(null);
    setQuery('');
  }

  const InputTag = multiline ? 'textarea' : 'input';

  return (
    <div className="field nc-source-field">
      <div className="nc-source-field-head">
        <label>{label}</label>
        <div className="nc-source-toggles">
          <button
            type="button"
            className={`btn secondary nc-mini-btn${mode === 'historic' ? ' active' : ''}`}
            onClick={() => setMode(mode === 'historic' ? null : 'historic')}
          >
            Historic Record
          </button>
          <button
            type="button"
            className={`btn secondary nc-mini-btn${mode === 'ai' ? ' active' : ''}`}
            onClick={() => setMode(mode === 'ai' ? null : 'ai')}
          >
            AI Suggested
          </button>
        </div>
      </div>

      <InputTag
        className="input"
        rows={multiline ? 4 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value, { source: 'manual' })}
        required
        placeholder={`Enter ${label.toLowerCase()} or pick Historic / AI`}
      />

      {mode === 'historic' ? (
        <div className="nc-source-panel">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type historic case ID / name to search…"
            autoFocus
          />
          {!historicOptions.length ? (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              {query.trim() ? 'No historic case matches that ID/name.' : 'Type a historic case ID or name.'}
            </p>
          ) : (
            <div className="nc-source-list">
              {historicOptions.map((option) => (
                <button key={option.id} type="button" className="nc-source-option" onClick={() => applyHistoric(option)}>
                  <strong>{option.id}</strong>
                  <span>{option.name || 'Historic case'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {mode === 'ai' ? (
        <div className="nc-source-panel">
          {!aiValue ? (
            <p className="muted" style={{ margin: 0 }}>No AI suggestion yet. Add description on step 1 to generate one.</p>
          ) : (
            <>
              <pre className="nc-source-preview">{aiValue}</pre>
              <button type="button" className="btn nc-use-ai-btn" onClick={applyAi}>
                Use AI Suggested {label}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
