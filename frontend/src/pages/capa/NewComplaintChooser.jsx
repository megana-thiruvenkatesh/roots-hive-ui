import React from 'react';
import { Link } from 'react-router-dom';

export default function NewComplaintChooser() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>New Complaint</h1>
          <p>Choose complaint type to continue. Forms are the same for now.</p>
        </div>
      </div>
      <div className="chooser-grid">
        <Link to="/complaints/new/internal" className="card chooser-card">
          <h3>Internal Complaint</h3>
          <p className="muted">For in-house / process / line quality issues.</p>
          <span className="chooser-go">Open form →</span>
        </Link>
        <Link to="/complaints/new/supplier" className="card chooser-card">
          <h3>Supplier Complaint</h3>
          <p className="muted">8D multi-step wizard (Issue → Closure). Saves on each Next.</p>
          <span className="chooser-go">Start wizard →</span>
        </Link>
      </div>
    </div>
  );
}
