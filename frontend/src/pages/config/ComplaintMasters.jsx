import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TEMPLATE = `Type,Severity,Defect
Internal,Critical,Leakage
Internal,Major,Porosity
Supplier,Major,Crack
Supplier,Minor,Surface Finish`;

export default function ComplaintMasters() {
  const [masters, setMasters] = useState({ types: [], severities: [], defects: [] });
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/complaint-masters');
      setMasters(data.masters || { types: [], severities: [], defects: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function importText(text) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.post('/complaint-masters/import', { text });
      setMasters(data.masters);
      setSuccess('Master data imported successfully.');
      setPasteText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importText(text);
    e.target.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'complaint-masters-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Complaint Masters</h1>
          <p>Manage Type, Severity, and Defect dropdown values. Import from Excel via CSV.</p>
        </div>
      </div>

      {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
      {success ? <p style={{ color: 'var(--teal)', fontWeight: 700 }}>{success}</p> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Import from Excel</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          In Excel: prepare 3 columns — <strong>Type</strong>, <strong>Severity</strong>, <strong>Defect</strong>.
          Then use <strong>File → Save As → CSV</strong> and upload here. You can also copy rows from Excel and paste below.
        </p>
        <div className="action-row">
          <button type="button" className="btn secondary" onClick={downloadTemplate}>
            Download template
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Upload CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={onFileChange} disabled={saving} />
          </label>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            importText(pasteText);
          }}
          style={{ marginTop: 12 }}
        >
          <div className="field">
            <label>Paste from Excel</label>
            <textarea
              className="input"
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste copied Excel rows here (tab-separated is OK)"
            />
          </div>
          <button className="btn" type="submit" disabled={saving || !pasteText.trim()}>
            {saving ? 'Importing…' : 'Import pasted data'}
          </button>
        </form>
      </div>

      <div className="form-grid-3">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Type ({masters.types?.length || 0})</h3>
          {loading ? <p className="muted">Loading…</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(masters.types || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Severity ({masters.severities?.length || 0})</h3>
          {loading ? <p className="muted">Loading…</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(masters.severities || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Defect ({masters.defects?.length || 0})</h3>
          {loading ? <p className="muted">Loading…</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(masters.defects || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
