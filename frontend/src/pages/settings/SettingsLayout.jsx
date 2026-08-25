import React from 'react';
import { Outlet } from 'react-router-dom';

export default function SettingsLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header Panel */}
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <p style={{ margin: '4px 0 0 0' }}>Personalise your HIVE AI experience</p>
        </div>
        <div>
          <button type="button" className="btn" style={{ opacity: 0.85 }} onClick={() => {
            // Find and click the active tab's save button dynamically
            const saveBtn = document.querySelector('main.card button.btn');
            if (saveBtn) saveBtn.click();
          }}>
            Save All
          </button>
        </div>
      </div>

      {/* Main Settings Page Container */}
      <main className="card" style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
