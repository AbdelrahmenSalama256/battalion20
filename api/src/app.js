const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { initSocket } = require('./socket');
const db = require('./config/db');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);
app.set('io', io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/specialties', require('./routes/specialties'));
app.use('/api/soldiers', require('./routes/soldiers'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/distinctions', require('./routes/distinctions'));
app.use('/api/punishments', require('./routes/punishments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ranks', require('./routes/ranks'));
app.use('/api/weapons', require('./routes/weapons'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/push', require('./routes/push'));
app.use('/api/leaves', require('./routes/leaves'));

// Admin seed endpoint
const { auth, commanderOnly } = require('./middleware/auth');
app.post('/api/admin/seed', auth, commanderOnly, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    const seedPath = path.join(__dirname, '..', 'seed.js');
    execSync(`node "${seedPath}"`, { timeout: 30000, cwd: path.dirname(seedPath) });
    res.json({ message: 'تم تحديث البيانات بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

// Run migrations on startup
async function runMigrations() {
  try {
    const fs = require('fs');
    const path = require('path');
    const db = require('./config/db');

    // Create migrations tracking table
    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const applied = await db.query('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await db.query(sql);
        await db.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Migration ${file} applied`);
      } catch (e) {
        console.error(`⚠️ Migration ${file} error:`, e.message);
      }
    }
  } catch (e) {
    console.error('Migration setup error:', e.message);
  }
}

const PORT = process.env.PORT || 3001;

if (require.main === module || process.env.VERCEL !== '1') {
  runMigrations().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = { app, server };
