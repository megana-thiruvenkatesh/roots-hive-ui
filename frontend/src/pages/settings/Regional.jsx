import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function Regional() {
  const [timezone, setTimezone] = useState('Asia/Kolkata (GMT+05:30)');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [unit, setUnit] = useState('Celsius');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/regional_settings')
      .then((res) => {
        if (res?.value) {
          setTimezone(res.value.timezone || 'Asia/Kolkata (GMT+05:30)');
          setDateFormat(res.value.dateFormat || 'DD/MM/YYYY');
          setUnit(res.value.unit || 'Celsius');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/regional_settings', {
        timezone,
        dateFormat,
        unit
      });
      setSuccess('Regional & locale settings saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Regional & Locale</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Configure local parameters, date formats, and measurement units.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">TIMEZONE</label>
        <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ backgroundColor: 'var(--bg-soft)' }}>
          <option value="Asia/Kolkata (GMT+05:30)">Asia/Kolkata (GMT+05:30)</option>
          <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
          <option value="America/New_York (GMT-05:00)">America/New_York (GMT-05:00)</option>
          <option value="Europe/London (GMT+00:00)">Europe/London (GMT+00:00)</option>
        </select>
      </div>

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">DATE FORMAT</label>
        <select className="input" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} style={{ backgroundColor: 'var(--bg-soft)' }}>
          <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 11/08/2026)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/11/2026)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-11)</option>
        </select>
      </div>

      <div className="field" style={{ maxWidth: 350 }}>
        <label className="label">MEASUREMENT / TEMPERATURE UNIT</label>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ backgroundColor: 'var(--bg-soft)' }}>
          <option value="Celsius">Celsius (°C)</option>
          <option value="Fahrenheit">Fahrenheit (°F)</option>
        </select>
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save Regional Settings
        </button>
      </div>
    </div>
  );
}
