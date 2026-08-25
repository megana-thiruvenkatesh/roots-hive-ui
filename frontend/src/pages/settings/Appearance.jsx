import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function Appearance() {
  const { theme, toggleTheme } = useTheme();
  
  const [accentColor, setAccentColor] = useState('#E8A020');
  const [density, setDensity] = useState('Comfortable');
  const [fontSize, setFontSize] = useState('Medium');
  const [bubbleStyle, setBubbleStyle] = useState('Standard');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/appearance')
      .then((res) => {
        if (res?.value) {
          setAccentColor(res.value.accentColor || '#E8A020');
          setDensity(res.value.density || 'Comfortable');
          setFontSize(res.value.fontSize || 'Medium');
          setBubbleStyle(res.value.bubbleStyle || 'Standard');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/appearance', {
        accentColor,
        density,
        fontSize,
        bubbleStyle
      });
      setSuccess('Appearance settings saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Appearance & Layout</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Adjust the visual style of HIVE AI to suit your workspace.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      {/* Color Theme Selector */}
      <div>
        <label className="label" style={{ marginBottom: 10 }}>Color Theme</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          
          <div
            className={`card ${theme === 'dark' ? 'active-border' : ''}`}
            style={{
              padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'pointer', border: theme === 'dark' ? '2px solid var(--amber)' : '1px solid var(--border)',
              backgroundColor: theme === 'dark' ? 'rgba(14,165,233,0.02)' : 'transparent'
            }}
            onClick={() => theme !== 'dark' && toggleTheme()}
          >
            <span style={{ fontSize: '1.75rem' }}>🌙</span>
            <strong>Dark Theme</strong>
            {theme === 'dark' && <span className="badge" style={{ backgroundColor: 'var(--amber)', color: '#fff' }}>ACTIVE</span>}
          </div>

          <div
            className={`card ${theme === 'light' ? 'active-border' : ''}`}
            style={{
              padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'pointer', border: theme === 'light' ? '2px solid var(--amber)' : '1px solid var(--border)',
              backgroundColor: theme === 'light' ? 'rgba(14,165,233,0.02)' : 'transparent'
            }}
            onClick={() => theme !== 'light' && toggleTheme()}
          >
            <span style={{ fontSize: '1.75rem' }}>☀️</span>
            <strong>Light Theme</strong>
            {theme === 'light' && <span className="badge" style={{ backgroundColor: 'var(--amber)', color: '#fff' }}>ACTIVE</span>}
          </div>

        </div>
      </div>

      {/* Accent Color Dot Row */}
      <div>
        <label className="label">Accent Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {['#E8A020', '#0d9488', '#2563eb', '#db2777', '#16a34a', '#7c3aed', '#ea580c'].map((color) => (
            <button
              key={color}
              type="button"
              style={{
                width: 32, height: 32, borderRadius: '50%', backgroundColor: color, border: accentColor === color ? '3px solid #fff' : 'none',
                cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
              onClick={() => setAccentColor(color)}
            />
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>Custom</span>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            />
            <input
              type="text"
              className="input"
              style={{ width: 85, padding: '4px 8px', fontSize: '0.8rem' }}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Layout Density */}
      <div>
        <label className="label">Layout Density</label>
        <div className="chip-row" style={{ marginTop: 6, display: 'inline-flex', backgroundColor: 'var(--bg-soft)', padding: 3, borderRadius: 8 }}>
          {['Compact', 'Comfortable', 'Spacious'].map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${density === d ? 'active' : ''}`}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', background: density === d ? 'var(--bg-card)' : 'transparent',
                color: density === d ? 'var(--text)' : 'var(--text3)', fontWeight: density === d ? 'bold' : 'normal', cursor: 'pointer'
              }}
              onClick={() => setDensity(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Font Size */}
      <div>
        <label className="label">Chat Font Size</label>
        <div className="chip-row" style={{ marginTop: 6, display: 'inline-flex', backgroundColor: 'var(--bg-soft)', padding: 3, borderRadius: 8 }}>
          {['Small', 'Medium', 'Large'].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${fontSize === s ? 'active' : ''}`}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', background: fontSize === s ? 'var(--bg-card)' : 'transparent',
                color: fontSize === s ? 'var(--text)' : 'var(--text3)', fontWeight: fontSize === s ? 'bold' : 'normal', cursor: 'pointer'
              }}
              onClick={() => setFontSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Message Bubble Style */}
      <div>
        <label className="label">Message Bubble Style</label>
        <div className="chip-row" style={{ marginTop: 6, display: 'inline-flex', backgroundColor: 'var(--bg-soft)', padding: 3, borderRadius: 8 }}>
          {['Standard', 'Rounded', 'Classic'].map((b) => (
            <button
              key={b}
              type="button"
              className={`chip ${bubbleStyle === b ? 'active' : ''}`}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', background: bubbleStyle === b ? 'var(--bg-card)' : 'transparent',
                color: bubbleStyle === b ? 'var(--text)' : 'var(--text3)', fontWeight: bubbleStyle === b ? 'bold' : 'normal', cursor: 'pointer'
              }}
              onClick={() => setBubbleStyle(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
