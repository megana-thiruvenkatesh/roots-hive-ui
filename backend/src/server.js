require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const complaintsRoutes = require('./routes/complaints');
const conversationsRoutes = require('./routes/conversations');
const aiRoutes = require('./routes/ai');
const kbRoutes = require('./routes/kb');
const settingsRoutes = require('./routes/settings');
const uploadsRoutes = require('./routes/uploads');
const usersRoutes = require('./routes/users');
const configRoutes = require('./routes/config');
const auditLogsRoutes = require('./routes/auditLogs');
const complaintMastersRoutes = require('./routes/complaintMasters');
const historicMediaRoutes = require('./routes/historicMedia');
const connectorsRoutes = require('./routes/connectors');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return cb(null, true);
      }
      return cb(null, allowedOrigins[0]);
    },
  })
);
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'hive-roots' }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/config', configRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/complaint-masters', complaintMastersRoutes);
app.use('/api/historic-media', historicMediaRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`HIVE Roots backend listening on http://localhost:${PORT}`));
