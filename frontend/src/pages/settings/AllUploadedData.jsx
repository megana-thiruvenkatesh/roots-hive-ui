import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { ConnectedSourceCards } from './KnowledgeBase.jsx';

export default function AllUploadedData() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [q, setQ] = useState('');
  const [historic, setHistoric] = useState({ active: false, meta: null, recordCount: 0 });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  function refresh() {
    setLoading(true);
    Promise.all([
      api.get('/kb/sources').then((res) => setSources(res.sources || [])),
      api.get('/uploads/historic-dataset').then((res) => setHistoric(res)).catch(() => null),
    ])
      .catch((err) => setError(err.message || 'Failed to load uploaded data'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const historicFileName = String(historic.meta?.originalName || '').toLowerCase();

  const filtered = sources.filter((item) => {
    // Historic Excel is shown in its own card above — hide duplicate KB entry.
    const itemName = String(item.originalName || item.title || item.name || '').toLowerCase();
    if (historicFileName && itemName === historicFileName) return false;

    const hay = [
      item.title,
      item.name,
      item.provider,
      item.category,
      item.uploadedByName,
      item.uploadedByEmail,
      item.kind,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function deleteDoc(id) {
    await api.del(`/kb/${id}`);
    refresh();
  }

  async function deleteConnector(id) {
    await api.del(`/connectors/${id}`);
    refresh();
  }

  async function onHistoricFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api.upload('/uploads/historic-dataset', form);
      setSuccess(
        `Imported ${data.meta?.recordCount || 0} historic records from ${data.meta?.originalName || file.name}. Each row is one record.`
      );
      refresh();
    } catch (err) {
      setError(err.message || 'Historic dataset upload failed');
    } finally {
      setUploading(false);
    }
  }

  const categories = historic.meta?.defectCategories || [];

  return (
    <div className="kb-page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Uploaded Datasets</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Upload your historic Excel/CSV here (not on Knowledge Base). Each row = one historic record for New Complaint.
          </p>
        </div>
      </div>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Historic Records Dataset</h4>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Columns: ims_refno, item_code, item_name, party_code, problem_statement, lot_qty, defect_qty,
              date_of_issue, defect_category, plus root_cause, why_1…why_5 (or why_why), corrective_action,
              preventive_action, severity, process
            </p>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
              Only one historic Excel is active at a time. Uploading again overwrites the current file (that is what Replace means).
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              hidden
              onChange={onHistoricFile}
            />
            <button
              type="button"
              className="btn"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Importing…' : historic.active ? 'Replace with new Excel' : 'Upload Historic Excel'}
            </button>
          </div>
        </div>

        {historic.active ? (
          <article
            className="kb-source-card"
            style={{ marginTop: 14, maxWidth: 420, border: '1px solid #b7d7c7', background: '#f4faf7' }}
          >
            <div className="kb-source-card-top">
              <div className="kb-source-card-title">
                <span className="kb-source-icon">📊</span>
                <strong title={historic.meta?.originalName}>{historic.meta?.originalName || 'Historic dataset'}</strong>
              </div>
            </div>
            <div className="kb-source-meta">
              <div className="wide">
                <span className="kb-meta-label">Type</span>
                <strong>Historic Excel</strong>
              </div>
              <div>
                <span className="kb-meta-label">Records</span>
                <strong>{historic.recordCount}</strong>
              </div>
              <div>
                <span className="kb-meta-label">Defect categories</span>
                <strong>{categories.length}</strong>
              </div>
              <div>
                <span className="kb-meta-label">Status</span>
                <strong style={{ color: '#176b52' }}>Active</strong>
              </div>
            </div>
            {categories.length ? (
              <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
                Categories: {categories.join(', ')}
              </p>
            ) : null}
          </article>
        ) : (
          <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
            No historic dataset yet. Use the upload button above.
          </p>
        )}
      </section>

      {error ? <div className="kb-banner bad">⚠️ {error}</div> : null}
      {success ? (
        <div
          className="kb-banner"
          style={{
            background: '#e7f4ef',
            color: '#0f513d',
            border: '1px solid #b7d7c7',
            padding: 10,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          {success}
        </div>
      ) : null}

      <div className="search-bar" style={{ marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Search other files by name, uploader, type…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="muted">Loading uploaded data…</div>
      ) : (
        <ConnectedSourceCards
          sources={filtered}
          limit={12}
          showViewAll={false}
          title="Other files (SOPs / connectors — not historic rows)"
          onDeleteDoc={deleteDoc}
          onDeleteConnector={deleteConnector}
        />
      )}
    </div>
  );
}
