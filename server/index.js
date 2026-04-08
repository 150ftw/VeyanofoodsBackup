// server/index.js — Veyano Foods Backend Entry Point

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const errorHandler = require('./middleware/errorHandler');
const { scheduleBackup } = require('./services/backupService');

// Supabase Integrated

// ── Import Routes ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const ordersRoutes = require('./routes/orders');
const logisticsRoutes = require('./routes/logistics');
const complianceRoutes = require('./routes/compliance');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parser ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Veyano Foods Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    fssai: '20826010000397',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/compliance', complianceRoutes);

// Serve frontend static files (from the root directory)
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve generated invoices (authenticated access only via /api/compliance/invoice/:id)
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found.` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log('✅ Supabase DBMS connected.');

    // Start daily S3 backup scheduler
    scheduleBackup();

    app.listen(PORT, () => {
      console.log(`\n🚀 Veyano Foods Backend running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API Docs: http://localhost:${PORT}/health\n`);
      console.log(`   FSSAI License: 20826010000397`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = app;
