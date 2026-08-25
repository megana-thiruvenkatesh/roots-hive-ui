import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function ApiSettings() {
  const [apiEnabled, setApiEnabled] = useState(true);
  const [apiProvider, setApiProvider] = useState('builtin');
  const [apiModelText, setApiModelText] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/api_settings')
      .then((res) => {
        if (res?.value) {
          setApiEnabled(res.value.enabled !== false);
          setApiProvider(res.value.provider || 'builtin');
          setApiModelText(res.value.model || '');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/api_settings', {
        enabled: apiEnabled,
        provider: apiProvider,
        model: apiModelText
      });
      setSuccess('AI API key configurations saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>API Settings</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Choose AI provider/model. API keys stay securely in backend `.env` only.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      <div className="card stack" style={{ border: '1px solid var(--border)', padding: 20 }}>
        <label className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <strong>Enable AI Assist</strong>
          <input
            type="checkbox"
            checked={apiEnabled}
            onChange={(e) => setApiEnabled(e.target.checked)}
          />
        </label>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">Provider</label>
          <select
            className="input"
            style={{ backgroundColor: 'var(--bg-soft)' }}
            value={apiProvider}
            onChange={(e) => setApiProvider(e.target.value)}
          >
            <option value="builtin">Built-in Free AI (browser demo)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="groq">Groq</option>
            <option value="gemini">Google Gemini</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Custom Model Identifier</label>
          <input
            className="input"
            value={apiModelText}
            onChange={(e) => setApiModelText(e.target.value)}
            placeholder="e.g. claude-3-5-sonnet-20241022"
          />
        </div>
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save API Settings
        </button>
      </div>
    </div>
  );
}
