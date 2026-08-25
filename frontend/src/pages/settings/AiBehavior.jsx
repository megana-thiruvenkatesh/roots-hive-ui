import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AiBehavior() {
  const [responseLength, setResponseLength] = useState('Balanced');
  const [responseTone, setResponseTone] = useState('Professional');
  const [responseLanguage, setResponseLanguage] = useState('English (India)');
  const [suggestedQuestions, setSuggestedQuestions] = useState(true);
  const [thinkingIndicator, setThinkingIndicator] = useState(true);
  const [enterToSend, setEnterToSend] = useState(true);
  const [showFallbackGuidance, setShowFallbackGuidance] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/ai_behavior')
      .then((res) => {
        if (res?.value) {
          setResponseLength(res.value.responseLength || 'Balanced');
          setResponseTone(res.value.responseTone || 'Professional');
          setResponseLanguage(res.value.responseLanguage || 'English (India)');
          setSuggestedQuestions(res.value.suggestedQuestions !== false);
          setThinkingIndicator(res.value.thinkingIndicator !== false);
          setEnterToSend(res.value.enterToSend !== false);
          setShowFallbackGuidance(res.value.showFallbackGuidance !== false);
          setCustomPrompt(res.value.customPrompt || '');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/ai_behavior', {
        responseLength,
        responseTone,
        responseLanguage,
        suggestedQuestions,
        thinkingIndicator,
        enterToSend,
        showFallbackGuidance,
        customPrompt
      });
      setSuccess('AI behavior parameters saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>AI Behaviour</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Control how HIVE AI formulates and presents answers.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      {/* Response Length Radio */}
      <div>
        <label className="label">Response Length</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[
            { id: 'Concise', label: 'Concise', desc: 'Short, direct answers — best for quick lookups.' },
            { id: 'Balanced', label: 'Balanced', desc: 'Standard detail with key context and data tables.' },
            { id: 'Detailed', label: 'Detailed', desc: 'Full analysis with recommendations and next steps.' }
          ].map((opt) => (
            <label
              key={opt.id}
              className="card"
              style={{
                padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer',
                border: responseLength === opt.id ? '1px solid var(--amber)' : '1px solid var(--border)',
                backgroundColor: responseLength === opt.id ? 'rgba(245,158,11,0.01)' : 'transparent'
              }}
            >
              <input
                type="radio"
                name="responseLength"
                checked={responseLength === opt.id}
                onChange={() => setResponseLength(opt.id)}
              />
              <div>
                <strong>{opt.label}</strong>
                <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Response Tone */}
      <div>
        <label className="label">Response Tone</label>
        <div className="chip-row" style={{ marginTop: 6, display: 'inline-flex', backgroundColor: 'var(--bg-soft)', padding: 3, borderRadius: 8 }}>
          {['Formal', 'Professional', 'Casual'].map((tone) => (
            <button
              key={tone}
              type="button"
              className={`chip ${responseTone === tone ? 'active' : ''}`}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', background: responseTone === tone ? 'var(--bg-card)' : 'transparent',
                color: responseTone === tone ? 'var(--text)' : 'var(--text3)', fontWeight: responseTone === tone ? 'bold' : 'normal', cursor: 'pointer'
              }}
              onClick={() => setResponseTone(tone)}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      {/* Response Language */}
      <div className="field" style={{ maxWidth: 300 }}>
        <label className="label">Response Language</label>
        <select
          className="input"
          style={{ backgroundColor: 'var(--bg-soft)' }}
          value={responseLanguage}
          onChange={(e) => setResponseLanguage(e.target.value)}
        >
          <option value="English (India)">English (India)</option>
          <option value="English (US)">English (US)</option>
          <option value="Hindi">Hindi (हिंदी)</option>
          <option value="German">German (Deutsch)</option>
        </select>
      </div>

      {/* UI Switches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <strong>Suggested Questions</strong>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Show query suggestions when chat is empty</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={suggestedQuestions} onChange={(e) => setSuggestedQuestions(e.target.checked)} />
            <span />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <strong>Thinking Indicator</strong>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Show animated dots while AI is processing</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={thinkingIndicator} onChange={(e) => setThinkingIndicator(e.target.checked)} />
            <span />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <strong>Enter to Send</strong>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Press Enter to send (Shift + Enter for new line)</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={enterToSend} onChange={(e) => setEnterToSend(e.target.checked)} />
            <span />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <div>
            <strong>Show Fallback Guidance</strong>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Show help tips when query has no KB match</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showFallbackGuidance} onChange={(e) => setShowFallbackGuidance(e.target.checked)} />
            <span />
          </label>
        </div>

      </div>

      {/* Custom Prompt */}
      <div className="field" style={{ marginTop: 10 }}>
        <label className="label">ℹ Custom AI System Prompt</label>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2, marginBottom: 8 }}>
          Prepend a custom instruction to every AI query. Useful for adding plant-specific context or preferred units.
        </p>
        <textarea
          className="input"
          style={{ minHeight: 80 }}
          placeholder="e.g. Always report temperatures in °C. Prioritise Line 2 data. Use metric units."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save AI Behaviour
        </button>
      </div>
    </div>
  );
}
