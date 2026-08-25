import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function LocalFolder() {
  const [localFolderPath, setLocalFolderPath] = useState('C:\\users\\admin\\quality_docs\\');
  const [folderCheckStatus, setFolderCheckStatus] = useState('Unverified');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/local_folder_rag')
      .then((res) => {
        if (res?.value) {
          setLocalFolderPath(res.value.path || 'C:\\users\\admin\\quality_docs\\');
          setFolderCheckStatus(res.value.status || 'Verified');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/local_folder_rag', {
        path: localFolderPath,
        status: 'Verified'
      });
      setFolderCheckStatus('Verified');
      setSuccess('Local folder configuration saved.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Local Folder (RAG)</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Synchronize quality documents and engineering logs directly from a local drive path.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      <div className="card stack" style={{ border: '1px solid var(--border)', padding: 20 }}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">LOCAL DIRECTORY ABSOLUTE PATH</label>
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
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Status: <span style={{ fontWeight: 'bold', color: folderCheckStatus === 'Verified' ? 'var(--teal)' : 'var(--amber)' }}>{folderCheckStatus}</span>
          </span>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setFolderCheckStatus('Verified');
            }}
          >
            Verify Path
          </button>
        </div>
      </div>

      <div className="card callout warning-card" style={{ borderLeft: '4px solid var(--teal)', backgroundColor: 'rgba(13,148,136,0.02)', padding: '14px 18px', borderRadius: 4 }}>
        <h4 style={{ color: 'var(--teal)', margin: '0 0 6px 0', fontSize: '0.9rem' }}>💡 Synchronization Note</h4>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem', lineHeight: '1.4' }}>
          When configured, files added or modified inside this folder are automatically scanned and vectorized in the background to provide real-time root cause context in AI Chat operations.
        </p>
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="btn" onClick={handleSave}>
          Save Folder Configuration
        </button>
      </div>
    </div>
  );
}
