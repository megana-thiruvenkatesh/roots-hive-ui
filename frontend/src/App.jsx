import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { canAccessPath } from './lib/roles.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AIChat from './pages/AIChat.jsx';
import CapaList from './pages/capa/ComplaintList.jsx';
import CapaDetail from './pages/capa/ComplaintDetail.jsx';
import CapaNew from './pages/capa/NewComplaint.jsx';
import CapaSearch from './pages/capa/Search.jsx';
import SmartDiagnostic from './pages/ai-engine/SmartDiagnostic.jsx';
import RcaPrediction from './pages/ai-engine/RcaPrediction.jsx';
import WhyWhyGenerator from './pages/ai-engine/WhyWhyGenerator.jsx';
import CaRecommendation from './pages/ai-engine/CaRecommendation.jsx';
import AuditLogs from './pages/config/AuditLogs.jsx';
import PolicyConfig from './pages/config/PolicyConfig.jsx';
import Overview from './pages/config/Overview.jsx';
import UserManagement from './pages/config/UserManagement.jsx';
import SettingsLayout from './pages/settings/SettingsLayout.jsx';
import MyProfile from './pages/settings/MyProfile.jsx';
import Appearance from './pages/settings/Appearance.jsx';
import AiModels from './pages/settings/AiModels.jsx';
import ApiSettings from './pages/settings/ApiSettings.jsx';
import KnowledgeBase from './pages/settings/KnowledgeBase.jsx';
import AllUploadedData from './pages/settings/AllUploadedData.jsx';
import LocalFolder from './pages/settings/LocalFolder.jsx';
import Notifications from './pages/Notifications.jsx';

function Protected({ children, roles, path }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text2)' }}>
        Loading session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.roleKey)) return <Navigate to="/dashboard" replace />;
  if (path && !canAccessPath(user.roleKey, path)) return <Navigate to="/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <Register />
          </GuestOnly>
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="chat" element={<AIChat />} />
        <Route path="notifications" element={<Notifications />} />

        <Route path="ai-engine" element={<Navigate to="/ai-engine/smart-diagnostic" replace />} />
        <Route path="ai-engine/smart-diagnostic" element={<SmartDiagnostic />} />
        <Route path="ai-engine/rca-prediction" element={<RcaPrediction />} />
        <Route path="ai-engine/why-why" element={<WhyWhyGenerator />} />
        <Route path="ai-engine/ca-recommendation" element={<CaRecommendation />} />

        <Route path="complaints" element={<CapaList />} />
        <Route path="complaints/new" element={<Protected path="/complaints/new"><CapaNew /></Protected>} />
        <Route path="complaints/new/internal" element={<Navigate to="/complaints/new" replace />} />
        <Route path="complaints/new/supplier" element={<Navigate to="/complaints/new" replace />} />
        <Route path="complaints/search" element={<CapaSearch />} />
        <Route path="complaints/:id" element={<CapaDetail />} />

        <Route path="config" element={<Navigate to="/config/overview" replace />} />
        <Route path="config/overview" element={<Protected path="/config/overview"><Overview /></Protected>} />
        <Route path="config/modules" element={<Navigate to="/config/overview" replace />} />
        <Route path="config/policy" element={<Protected path="/config/policy"><PolicyConfig /></Protected>} />
        <Route path="config/users" element={<Navigate to="/settings/users" replace />} />
        <Route path="config/complaint-masters" element={<Navigate to="/config/overview" replace />} />
        <Route path="config/audit-logs" element={<Navigate to="/settings/audit-logs" replace />} />

        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="behavior" element={<Navigate to="/settings/profile" replace />} />
          <Route path="regional" element={<Navigate to="/settings/profile" replace />} />
          <Route path="models" element={<AiModels />} />
          <Route path="api" element={<ApiSettings />} />
          <Route path="kb" element={<KnowledgeBase />} />
          <Route path="uploaded-data" element={<AllUploadedData />} />
          <Route path="local-folder" element={<LocalFolder />} />
          <Route path="users" element={<Protected path="/settings/users"><UserManagement /></Protected>} />
          <Route path="audit-logs" element={<Protected path="/settings/audit-logs"><AuditLogs /></Protected>} />
        </Route>

        {/* legacy redirects */}
        <Route path="capa" element={<Navigate to="/complaints" replace />} />
        <Route path="capa/new" element={<Navigate to="/complaints/new" replace />} />
        <Route path="capa/search" element={<Navigate to="/complaints/search" replace />} />
        <Route path="capa/:id" element={<CapaDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
