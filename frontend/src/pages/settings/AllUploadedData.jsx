import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ConnectedSourceCards } from './KnowledgeBase.jsx';

export default function AllUploadedData() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  function refresh() {
    setLoading(true);
    api
      .get('/kb/sources')
      .then((res) => setSources(res.sources || []))
      .catch((err) => setError(err.message || 'Failed to load uploaded data'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = sources.filter((item) => {
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

  return (
    <div className="kb-page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Uploaded Datasets</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Every Knowledge Base document and API connector in one place.
          </p>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Search by name, uploader, type, provider…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error ? <div className="kb-banner bad">⚠️ {error}</div> : null}
      {loading ? (
        <div className="muted">Loading uploaded data…</div>
      ) : (
        <ConnectedSourceCards
          sources={filtered}
          limit={12}
          showViewAll={false}
          title="Uploaded Datasets"
          onDeleteDoc={deleteDoc}
          onDeleteConnector={deleteConnector}
        />
      )}
    </div>
  );
}
