import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

const MODULES_LIST = [
  {
    key: 'messaging',
    name: 'Messaging',
    desc: 'Internal team messaging, channels and direct messages between users.'
  },
  {
    key: 'aiChat',
    name: 'AI Chat',
    desc: 'AI-powered assistant for manufacturing queries, knowledge base lookup and API integration.'
  },
  {
    key: 'settings',
    name: 'Settings',
    desc: 'User-accessible settings including API keys, KB uploads, DB config, and appearance.'
  },
  {
    key: 'kbUpload',
    name: 'KB Upload',
    desc: 'Allow users to upload documents to the knowledge base from the Settings panel.'
  },
  {
    key: 'databaseIntegration',
    name: 'Database Integration',
    desc: 'Live database connection and natural language query features.'
  },
  {
    key: 'externalAiApis',
    name: 'External AI APIs',
    desc: 'Allow outbound AI service queries and credential synchronization.'
  }
];

export default function Modules() {
  const [config, setConfig] = useState({
    messaging: true,
    aiChat: true,
    settings: true,
    kbUpload: true,
    databaseIntegration: true,
    externalAiApis: true
  });
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    api
      .get('/settings/modules_config')
      .then((res) => {
        if (res?.value && Object.keys(res.value).length > 0) {
          setConfig(res.value);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  async function toggleModule(key) {
    const nextConfig = { ...config, [key]: !config[key] };
    setConfig(nextConfig);
    setSavedMessage('');
    try {
      await api.put('/settings/modules_config', nextConfig);
      setSavedMessage('Changes saved successfully.');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (e) {
      console.error(e);
      // rollback
      setConfig(config);
    }
  }

  if (loading) {
    return <div className="muted" style={{ padding: 24 }}>Loading module configuration…</div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Module Management</h1>
          <p>Enable or disable platform modules for all users. Changes take effect immediately.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {MODULES_LIST.map((m) => (
          <div key={m.key} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'bold' }}>{m.name}</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>{m.desc}</p>
            </div>
            <div>
              <label className="toggle" style={{ transform: 'scale(1.15)', transformOrigin: 'top right' }}>
                <input
                  type="checkbox"
                  checked={!!config[m.key]}
                  onChange={() => toggleModule(m.key)}
                />
                <span />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="card callout warning-card" style={{ borderLeft: '4px solid var(--amber)', backgroundColor: 'rgba(245,158,11,0.02)', padding: '16px 20px', borderRadius: '4px' }}>
        <h4 style={{ color: 'var(--amber)', margin: '0 0 6px 0', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ⚠️ Admin Note
        </h4>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
          Module changes are live and affect all logged-in users immediately. Disabling essential modules like <strong>AI Chat</strong> or <strong>Settings</strong> will temporarily restrict access to user features for all staff.
        </p>
      </div>

      {savedMessage && (
        <div style={{ marginTop: 12, color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>
          ✓ {savedMessage}
        </div>
      )}
    </div>
  );
}
