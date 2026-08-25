import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const STORAGE_PROVIDERS = [
  'Amazon S3',
  'Cloudflare R2',
  'Backblaze B2',
  'DigitalOcean Spaces',
  'Google Cloud Storage',
  'Azure Blob Storage',
  'Wasabi',
  'Supabase',
  'MinIO (Self-hosted)',
];

const SYSTEM_TYPES = [
  { value: 'erp', label: 'ERP' },
  { value: 'sap', label: 'SAP' },
  { value: 'crm', label: 'CRM' },
];

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCount(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN');
}

function shortId(value) {
  if (!value) return '—';
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 8)}…` : text;
}

export function ConnectedSourceCards({ sources, limit, onDeleteDoc, onDeleteConnector, showViewAll, title = 'Uploaded Datasets' }) {
  const [offset, setOffset] = useState(0);
  const pageSize = limit || 4;
  const page = sources.slice(offset, offset + pageSize);
  const canPrev = offset > 0;
  const canNext = offset + pageSize < sources.length;

  useEffect(() => {
    setOffset(0);
  }, [sources.length]);

  return (
    <section className="kb-sources">
      <div className="kb-sources-head">
        <h3>{title}</h3>
        <div className="kb-sources-actions">
          {showViewAll ? <Link to="/settings/uploaded-data" className="kb-view-all">View All</Link> : null}
          <button type="button" className="kb-pager" disabled={!canPrev} onClick={() => setOffset((v) => Math.max(0, v - pageSize))} aria-label="Previous">
            ‹
          </button>
          <button
            type="button"
            className="kb-pager"
            disabled={!canNext}
            onClick={() => setOffset((v) => Math.min(Math.max(0, sources.length - pageSize), v + pageSize))}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>

      {!page.length ? (
        <p className="muted">No documents or connectors yet.</p>
      ) : (
        <div className="kb-source-grid">
          {page.map((item) => {
            const isConnector = item.kind === 'connector';
            const title = item.title || item.name || 'Untitled';
            const who = item.uploadedByName || item.uploadedByEmail || item.createdByName || item.createdByEmail || 'Unknown';
            const userId = item.uploadedBy || item.createdBy || item.uploadedById || item.createdById || null;
            const when = formatWhen(item.when || item.lastSync || item.createdAt);
            const status = String(item.status || 'ACTIVE').toUpperCase();
            return (
              <article key={`${item.kind}-${item.id}`} className="kb-source-card">
                <div className="kb-source-card-top">
                  <div className="kb-source-card-title">
                    <span className="kb-source-icon">{isConnector ? '⌁' : '📄'}</span>
                    <strong title={title}>{title}</strong>
                  </div>
                  <button
                    type="button"
                    className="kb-icon-btn"
                    title={isConnector ? 'Delete connector' : 'Delete document'}
                    onClick={() => {
                      if (!window.confirm(`Delete "${title}"?`)) return;
                      if (isConnector) onDeleteConnector?.(item.id);
                      else onDeleteDoc?.(item.id);
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="kb-source-meta">
                  <div className="wide">
                    <span className="kb-meta-label">Uploaded by</span>
                    <strong>{who}</strong>
                    <span className="kb-user-id" title={userId || ''}>User ID: {shortId(userId)}</span>
                  </div>
                  <div>
                    <span className="kb-meta-label">Type</span>
                    <strong>{isConnector ? `API · ${item.provider || item.category}` : 'Document'}</strong>
                  </div>
                  <div>
                    <span className="kb-meta-label">Records</span>
                    <strong>{formatCount(item.recordCount)}</strong>
                  </div>
                  <div>
                    <span className="kb-meta-label">Status</span>
                    <span className={`kb-status ${status === 'ACTIVE' ? 'ok' : status === 'ERROR' ? 'bad' : 'mid'}`}>
                      <i /> {status}
                    </span>
                  </div>
                </div>

                <div className="kb-source-card-foot">
                  <span>Last sync: {when}</span>
                  {item.fileUrl ? (
                    <a className="kb-icon-btn" href={item.fileUrl} target="_blank" rel="noreferrer" title="Open / download">↓</a>
                  ) : (
                    <span className="kb-icon-btn muted" title="Connector">⌁</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProviderSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => options.filter((item) => item.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q]
  );

  return (
    <div className="kb-provider-wrap">
      <button type="button" className="input kb-provider-btn" onClick={() => setOpen((v) => !v)}>
        <span>{value}</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="kb-provider-menu">
          <input className="input" placeholder="Search here..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="kb-provider-list">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                className={item === value ? 'active' : ''}
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                  setQ('');
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExpandCard({ title, subtitle, open, onToggle, children }) {
  return (
    <div className={`kb-expand-card${open ? ' open' : ''}`}>
      <button type="button" className="kb-expand-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </span>
        <span className="kb-expand-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="kb-expand-body">{children}</div> : null}
    </div>
  );
}

export default function KnowledgeBase() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [openCard, setOpenCard] = useState(null); // connectors
  const [connectorKind, setConnectorKind] = useState('storage'); // storage | erp | sap | crm
  const [dragOver, setDragOver] = useState(false);
  const [localFolderPath, setLocalFolderPath] = useState('C:\\users\\admin\\quality_docs\\');
  const [folderCheckStatus, setFolderCheckStatus] = useState('Unverified');
  const fileInputRef = useRef(null);

  const [storageForm, setStorageForm] = useState({
    provider: 'Amazon S3',
    bucketName: '',
    region: 'auto',
    accessKeyId: '',
    secretAccessKey: '',
    endpointUrl: '',
  });

  const [systemForm, setSystemForm] = useState({
    category: 'erp',
    provider: '',
    baseUrl: '',
    clientId: '',
    clientSecret: '',
    tenant: '',
  });

  function refreshConnectorsReady() {
    setLoading(true);
    api
      .get('/kb/sources')
      .then(() => setError(''))
      .catch((err) => setError(err.message || 'Failed to load Knowledge Base'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshConnectorsReady();
    api
      .get('/settings/local_folder_rag')
      .then((res) => {
        if (res?.value) {
          setLocalFolderPath(res.value.path || 'C:\\users\\admin\\quality_docs\\');
          setFolderCheckStatus(res.value.status || 'Verified');
        }
      })
      .catch(() => {});
  }, []);

  function toggleCard(key) {
    setOpenCard((current) => (current === key ? null : key));
  }

  async function uploadFile(file) {
    if (!file) return;
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.upload('/uploads/kb', form);
      setSuccess(`Uploaded ${file.name}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Upload failed');
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    await uploadFile(file);
    e.target.value = '';
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    await uploadFile(file);
  }

  async function saveLocalFolder(e) {
    e?.preventDefault?.();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/local_folder_rag', {
        path: localFolderPath,
        status: 'Verified',
      });
      setFolderCheckStatus('Verified');
      setSuccess('Local folder configuration saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save local folder');
    }
  }

  async function saveConnector(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (connectorKind === 'storage') {
        const res = await api.post('/connectors', {
          category: 'storage',
          provider: storageForm.provider,
          name: `${storageForm.provider} · ${storageForm.bucketName || 'bucket'}`,
          config: storageForm,
          test: true,
        });
        setSuccess(res.message || 'Storage connector saved');
      } else {
        const label = SYSTEM_TYPES.find((item) => item.value === connectorKind)?.label || connectorKind.toUpperCase();
        const res = await api.post('/connectors', {
          category: connectorKind,
          provider: systemForm.provider || label,
          name: `${label}${systemForm.provider ? ` · ${systemForm.provider}` : ''}`,
          config: { ...systemForm, category: connectorKind },
          test: true,
        });
        setSuccess(res.message || `${label} connector saved`);
      }
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save connector');
    }
  }

  if (loading) return <div className="muted">Loading Knowledge Base…</div>;

  return (
    <div className="kb-page">
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Knowledge Base</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Upload datasets, connect APIs, or point to a local folder for RAG.
        </p>
      </div>

      {success ? <div className="kb-banner ok">✓ {success}</div> : null}
      {error ? <div className="kb-banner bad">⚠️ {error}</div> : null}

      <div className="kb-top-cards">
      <section className="card kb-upload-panel">
        <div className="kb-upload-panel-head">
          <div>
            <h3>Upload Your Data</h3>
            <p>
              Upload Excel or CSV files to get started. We&apos;ll help you clean, validate and structure your data.
            </p>
          </div>
          <span className="kb-recommended-badge"><i /> Recommended</span>
        </div>

        <div
          className={`kb-dropzone${dragOver ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
        >
          <div className="kb-dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 16.2A4.5 4.5 0 0 0 18 8h-1.3A6 6 0 1 0 5 14.5" />
              <path d="M12 12v8" />
              <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
            </svg>
          </div>
          <p className="kb-dropzone-title">
            Drag and drop Excel or CSV files, or{' '}
            <span className="kb-dropzone-browse">click here to browse</span>
          </p>
          <p className="kb-dropzone-hint">Supported: CSV, XLSX, XLS · Max 10 MB</p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={handleUpload} />
        </div>
      </section>

      <section className="card kb-local-card">
        <div className="kb-local-card-head">
          <div>
            <h3>Local Folder</h3>
            <p className="muted">RAG path for quality documents and engineering logs on disk.</p>
          </div>
          <span className={`kb-status ${folderCheckStatus === 'Verified' ? 'ok' : 'mid'}`}>
            <i /> {folderCheckStatus === 'Verified' ? 'ACTIVE' : 'UNVERIFIED'}
          </span>
        </div>
        <form className="kb-local-form" onSubmit={saveLocalFolder}>
          <label>
            Local directory absolute path
            <input
              type="text"
              className="input"
              value={localFolderPath}
              onChange={(e) => {
                setLocalFolderPath(e.target.value);
                setFolderCheckStatus('Unverified');
              }}
              placeholder="e.g. C:\users\admin\quality_docs\"
            />
          </label>
          <div className="kb-local-actions">
            <button
              type="button"
              className="btn secondary nc-nav-btn"
              onClick={() => setFolderCheckStatus('Verified')}
            >
              Verify Path
            </button>
            <button type="submit" className="btn nc-nav-btn">
              Save Folder
            </button>
          </div>
        </form>
      </section>
      </div>

      <ExpandCard
        title="API Connectors"
        subtitle="Storage, ERP, SAP, CRM — click to expand"
        open={openCard === 'connectors'}
        onToggle={() => toggleCard('connectors')}
      >
        <form onSubmit={saveConnector}>
          <div className="kb-form-grid">
            <label>
              Connector Type
              <select
                className="input"
                value={connectorKind}
                onChange={(e) => {
                  const next = e.target.value;
                  setConnectorKind(next);
                  if (next !== 'storage') {
                    setSystemForm((f) => ({ ...f, category: next }));
                  }
                }}
              >
                <option value="storage">Storage Provider</option>
                {SYSTEM_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            {connectorKind === 'storage' ? (
              <>
                <label>
                  Storage Provider
                  <ProviderSelect
                    value={storageForm.provider}
                    options={STORAGE_PROVIDERS}
                    onChange={(provider) => setStorageForm((f) => ({ ...f, provider }))}
                  />
                </label>
                <label>
                  Bucket Name *
                  <input className="input" required value={storageForm.bucketName} onChange={(e) => setStorageForm((f) => ({ ...f, bucketName: e.target.value }))} />
                </label>
                <label>
                  Region *
                  <input className="input" required value={storageForm.region} onChange={(e) => setStorageForm((f) => ({ ...f, region: e.target.value }))} />
                </label>
                <label>
                  Access Key ID / Client ID *
                  <input className="input" required value={storageForm.accessKeyId} onChange={(e) => setStorageForm((f) => ({ ...f, accessKeyId: e.target.value }))} />
                </label>
                <label>
                  Secret Access Key / Client Secret *
                  <input className="input" type="password" required value={storageForm.secretAccessKey} onChange={(e) => setStorageForm((f) => ({ ...f, secretAccessKey: e.target.value }))} placeholder="Enter Secret Access Key or Client Secret" />
                </label>
                <label>
                  Endpoint URL (Optional)
                  <input className="input" value={storageForm.endpointUrl} onChange={(e) => setStorageForm((f) => ({ ...f, endpointUrl: e.target.value }))} placeholder="https://..." />
                </label>
              </>
            ) : (
              <>
                <label>
                  System / Provider name
                  <input
                    className="input"
                    value={systemForm.provider}
                    onChange={(e) => setSystemForm((f) => ({ ...f, provider: e.target.value }))}
                    placeholder={`e.g. ${connectorKind === 'crm' ? 'Salesforce' : connectorKind === 'sap' ? 'SAP S/4HANA' : 'Oracle ERP'}`}
                  />
                </label>
                <label>
                  Base URL / API URL
                  <input className="input" value={systemForm.baseUrl} onChange={(e) => setSystemForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.example.com" />
                </label>
                <label>
                  Client ID
                  <input className="input" value={systemForm.clientId} onChange={(e) => setSystemForm((f) => ({ ...f, clientId: e.target.value }))} />
                </label>
                <label>
                  Client Secret
                  <input className="input" type="password" value={systemForm.clientSecret} onChange={(e) => setSystemForm((f) => ({ ...f, clientSecret: e.target.value }))} />
                </label>
                <label>
                  Tenant / Realm
                  <input className="input" value={systemForm.tenant} onChange={(e) => setSystemForm((f) => ({ ...f, tenant: e.target.value }))} />
                </label>
              </>
            )}
          </div>
          <div className="kb-panel-actions">
            <button type="button" className="btn secondary" onClick={() => setOpenCard(null)}>Close</button>
            <button type="submit" className="btn">Test & Connect</button>
          </div>
        </form>
      </ExpandCard>

      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        View uploaded files under{' '}
        <Link to="/settings/uploaded-data" className="kb-view-all">Uploaded Datasets</Link>.
      </p>
    </div>
  );
}
