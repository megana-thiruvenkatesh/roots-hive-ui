import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AiModels() {
  const [selectedModel, setSelectedModel] = useState('Xenova/Qwen1.5-0.5B-Chat');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/ai_models')
      .then((res) => {
        if (res?.value) {
          setSelectedModel(res.value.selectedModel || 'Xenova/Qwen1.5-0.5B-Chat');
          setTemperature(res.value.temperature ?? 0.7);
          setMaxTokens(res.value.maxTokens || 1000);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/ai_models', {
        selectedModel,
        temperature,
        maxTokens
      });
      setSuccess('AI models settings saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>AI Models</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Select the default foundational models and parameters.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">DEFAULT MODEL</label>
        <select className="input" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ backgroundColor: 'var(--bg-soft)' }}>
          <option value="Llama 3.3 70B">Llama 3.3 70B (Default Cloud)</option>
          <option value="Mistral 24B">Mistral 24B</option>
          <option value="DeepSeek-R1 8B">DeepSeek-R1 8B</option>
          <option value="Xenova/Qwen1.5-0.5B-Chat">Xenova/Qwen1.5-0.5B-Chat (Browser Free)</option>
        </select>
      </div>

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">MODEL TEMPERATURE ({temperature})</label>
        <input
          type="range"
          min="0"
          max="1.5"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--amber)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }} className="muted">
          <span>Concise / Deterministic</span>
          <span>Creative / Dynamic</span>
        </div>
      </div>

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">MAX GENERATION TOKENS</label>
        <input
          type="number"
          className="input"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
        />
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save AI Models Settings
        </button>
      </div>
    </div>
  );
}
