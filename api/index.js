if (typeof process.env.VERCEL === "undefined") require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const path = require("path");
const multer = require("multer");
const { WorkbookImportEngine } = require("./workbook-parser");
const { parseTestResults } = require("./test-results-parser");
const { classifyMatches } = require("./name-matcher");

const DB_URL = process.env.DATABASE_URL ? process.env.DATABASE_URL.split("?")[0] : undefined;
const isLocal = DB_URL && DB_URL.includes("localhost");
function retryQuery(fn, retries = 3, delay = 500) {
  return fn().catch(async (err) => {
    if (retries > 0 && (err.message?.includes("EMAXCONNSESSION") || err.code === "ECONNRESET")) {
      await new Promise(r => setTimeout(r, delay));
      return retryQuery(fn, retries - 1, delay * 2);
    }
    throw err;
  });
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});

// Wrap pool.query with retry for transient pool exhaustion
const origQuery = pool.query.bind(pool);
pool.query = (text, params) => retryQuery(() => origQuery(text, params), 5, 300);

// Wrap pool.connect with retry for transient pool exhaustion
const origConnect = pool.connect.bind(pool);
pool.connect = () => retryQuery(() => origConnect(), 5, 300);

pool.on("error", (err) => {
  console.error("POOL ERROR:", err?.message || err);
});
const db = { query: (text, params) => pool.query(text, params), pool };

// Run migrations immediately on module load (Vercel cold start).
// All statements use IF NOT EXISTS so safe to run multiple times.
const migrationsReady = runMigrations().catch(e => console.error("Migration error:", e.message));

async function runMigrations() {
  await pool.query("SELECT 1");
  console.log("DB connected");
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS specific_specialty VARCHAR(200)",
  );
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS distinction_badge VARCHAR(10)",
  );
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS distinction_citation TEXT",
  );
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS distinguished_by UUID REFERENCES users(id) ON DELETE SET NULL",
  );
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS distinguished_at TIMESTAMPTZ",
  );
  await pool.query(
    "ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS promoted BOOLEAN DEFAULT FALSE",
  );
  await pool.query(
    "ALTER TABLE results ADD COLUMN IF NOT EXISTS fitness_score NUMERIC(6,2)",
  );
  await pool.query(
    "ALTER TABLE results ADD COLUMN IF NOT EXISTS specialty_score NUMERIC(6,2)",
  );
  await pool.query(
    "ALTER TABLE results ADD COLUMN IF NOT EXISTS discipline_score NUMERIC(6,2)",
  );
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_id UUID");
  try {
    await pool.query(
      "ALTER TABLE users ADD CONSTRAINT fk_user_rank FOREIGN KEY(rank_id) REFERENCES ranks(id) ON DELETE SET NULL",
    );
  } catch (e) {}
  await pool.query(
    "CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) DEFAULT 'evaluation', message TEXT, evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL, evaluator_name VARCHAR(120), evaluator_rank VARCHAR(80), evaluator_weapon VARCHAR(100), evaluated_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, evaluated_name VARCHAR(150), evaluated_rank VARCHAR(80), evaluated_specialty VARCHAR(100), fitness_score NUMERIC(6,2), specialty_score NUMERIC(6,2), discipline_score NUMERIC(6,2), total_score NUMERIC(6,2), is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
  );
  // 006: Push subscriptions
  await pool.query(
    "CREATE TABLE IF NOT EXISTS push_subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())",
  );
  try {
    await pool.query("CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)");
  } catch (e) {}
  // 007: Leaves & Personnel
  await pool.query(
    "CREATE TABLE IF NOT EXISTS leaves (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, start_date DATE NOT NULL, end_date DATE NOT NULL, leave_type VARCHAR(50) DEFAULT 'regular', notes TEXT, status VARCHAR(20) DEFAULT 'active', confirmed_by UUID REFERENCES users(id), confirmed_at TIMESTAMPTZ DEFAULT NOW(), return_confirmed BOOLEAN DEFAULT FALSE, return_confirmed_by UUID REFERENCES users(id), return_confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())",
  );
  try {
    await pool.query("CREATE INDEX IF NOT EXISTS idx_leaves_soldier_id ON leaves(soldier_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_leaves_end_date ON leaves(end_date)");
  } catch (e) {}
  await pool.query("ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS last_leave_end DATE");
  await pool.query("ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS enlistment_date DATE");
  await pool.query("ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS temp_id VARCHAR(50)");
  try { await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_soldiers_temp_id ON soldiers(temp_id) WHERE temp_id IS NOT NULL"); } catch(e){}
  await pool.query("ALTER TABLE exams ADD COLUMN IF NOT EXISTS focus_points TEXT[] DEFAULT '{}'");
  await pool.query("ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_score NUMERIC(5,2) DEFAULT 100");
  await pool.query("ALTER TABLE exams ADD COLUMN IF NOT EXISTS notes TEXT");
  await pool.query("ALTER TABLE exams ADD COLUMN IF NOT EXISTS section_key VARCHAR(50)");
  await pool.query("CREATE TABLE IF NOT EXISTS sections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key VARCHAR(50) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, icon VARCHAR(10), sort_order INT DEFAULT 0)");
  try { await pool.query("INSERT INTO sections (key,name,icon,sort_order) VALUES ('specialties','التخصصات','🎯',1),('general','العام','📋',2),('fitness','اللياقة','💪',3),('shooting','الرماية','🔫',4),('discipline','الانضباط','🎖️',5) ON CONFLICT (key) DO NOTHING"); } catch (e) {}
  await pool.query("CREATE TABLE IF NOT EXISTS evaluations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, section_key VARCHAR(50) NOT NULL, specialty_id UUID REFERENCES specialties(id), score NUMERIC(5,2) NOT NULL, max_score NUMERIC(5,2) DEFAULT 100, notes TEXT, evaluated_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS distinctions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, section_key VARCHAR(50) NOT NULL, specialty_id UUID REFERENCES specialties(id), reason TEXT NOT NULL, color VARCHAR(20) DEFAULT 'gold', given_by UUID REFERENCES users(id), is_confirmed BOOLEAN DEFAULT FALSE, confirmation_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS punishments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, section_key VARCHAR(50) NOT NULL, specialty_id UUID REFERENCES specialties(id), reason TEXT NOT NULL, color VARCHAR(20) DEFAULT 'red', given_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS distinction_confirmations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), distinction_id UUID NOT NULL, user_id UUID REFERENCES users(id), confirmed_at TIMESTAMPTZ DEFAULT NOW())");
  try { await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_distinction_confirmations_unique ON distinction_confirmations(distinction_id, user_id)"); } catch (e) {}
  await pool.query("CREATE TABLE IF NOT EXISTS announcements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title VARCHAR(200) NOT NULL, content TEXT, priority VARCHAR(20) DEFAULT 'info', created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS exam_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exam_id UUID REFERENCES exams(id) ON DELETE CASCADE, text TEXT NOT NULL, max_score NUMERIC(5,2) DEFAULT 10, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())");
  try { await pool.query("CREATE INDEX IF NOT EXISTS idx_exam_items_exam_id ON exam_items(exam_id)"); } catch (e) {}
  await pool.query("CREATE TABLE IF NOT EXISTS result_item_scores (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), result_id UUID REFERENCES results(id) ON DELETE CASCADE, item_id UUID REFERENCES exam_items(id) ON DELETE SET NULL, score NUMERIC(5,2), max_score NUMERIC(5,2), created_at TIMESTAMPTZ DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS fitness_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, exercise_id UUID, score_value NUMERIC(5,2), score_percent NUMERIC(5,2), created_at TIMESTAMPTZ DEFAULT NOW())");
  // 010: Workbook-driven assessment system
  await pool.query("CREATE TABLE IF NOT EXISTS assessment_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, session_type VARCHAR(50) NOT NULL, assessment_date DATE NOT NULL, worksheet_name VARCHAR(200), workbook_filename VARCHAR(500), imported_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())");
  try { await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_session_unique ON assessment_sessions(soldier_id, session_type, assessment_date)"); } catch (e) {}
  try { await pool.query("CREATE INDEX IF NOT EXISTS idx_assessment_sessions_type ON assessment_sessions(session_type)"); } catch (e) {}
  try { await pool.query("CREATE INDEX IF NOT EXISTS idx_assessment_sessions_date ON assessment_sessions(assessment_date)"); } catch (e) {}
  await pool.query("CREATE TABLE IF NOT EXISTS assessment_values (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE, field_key VARCHAR(100) NOT NULL, numeric_value NUMERIC(10,2), text_value TEXT, created_at TIMESTAMPTZ DEFAULT NOW())");
  try { await pool.query("CREATE INDEX IF NOT EXISTS idx_assessment_values_session ON assessment_values(session_id)"); } catch (e) {}
  await pool.query("CREATE TABLE IF NOT EXISTS import_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), filename VARCHAR(500), imported_by UUID REFERENCES users(id), imported_by_name VARCHAR(150), worksheets_detected INT DEFAULT 0, sessions_detected INT DEFAULT 0, sessions_inserted INT DEFAULT 0, sessions_updated INT DEFAULT 0, employees_detected INT DEFAULT 0, date_groups_detected INT DEFAULT 0, validation_errors INT DEFAULT 0, processing_time_ms INT DEFAULT 0, status VARCHAR(20) DEFAULT 'success', error_details JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())");
  console.log("Migrations done");
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer "))
    return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });
  try {
    req.user = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "انتهت صلاحية الجلسة" });
  }
}
function commanderOnly(req, res, next) {
  if (req.user.role !== "commander")
    return res.status(403).json({ error: "متاحة فقط للقائد" });
  next();
}
function cn(v) {
  return v != null && !isNaN(v) ? Number(v) : null;
}
async function canEvaluate(userId, soldierId) {
  const u = await db.query(
    "SELECT rank_id, permissions FROM users WHERE id=$1",
    [userId],
  );
  const s = await db.query("SELECT rank_id FROM soldiers WHERE id=$1", [
    soldierId,
  ]);
  if (
    !u.rows.length ||
    !s.rows.length ||
    !u.rows[0].rank_id ||
    !s.rows[0].rank_id
  )
    return false;
  const userPermissions = u.rows[0].permissions || {};
  if (
    Array.isArray(userPermissions.pages) &&
    userPermissions.pages.includes("evaluation")
  )
    return true;
  const ur = await db.query("SELECT sort_order FROM ranks WHERE id=$1", [
    u.rows[0].rank_id,
  ]);
  const sr = await db.query("SELECT sort_order FROM ranks WHERE id=$1", [
    s.rows[0].rank_id,
  ]);
  if (!ur.rows.length || !sr.rows.length) return false;
  return ur.rows[0].sort_order > sr.rows[0].sort_order;
}

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err?.message || err);
});
const app = express();
app.use(helmet());
app.use(
  cors({
    origin: function(origin, cb) {
      if (!origin) return cb(null, true);
      const allowed = [
        process.env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "https://battalion20-v2.vercel.app",
        "https://battalion20-api.vercel.app",
      ];
      if (allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) {
        cb(null, true);
      } else {
        cb(null, true);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/.netlify/functions/api"))
    req.url = "/api" + req.url.substring("/.netlify/functions/api".length);
  if (!req.path.startsWith("/api")) req.url = "/api" + req.url;
  next();
});
// Wait for migrations before processing any request (Vercel cold start)
app.use(async (req, res, next) => {
  try { await migrationsReady; } catch (e) { /* non-fatal */ }
  next();
});

// Multer config for workbook uploads (in-memory, 20MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.originalname.endsWith(".xlsx")) {
      cb(null, true);
    } else {
      cb(new Error("يجب رفع ملف .xlsx فقط"), false);
    }
  },
});

app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);
app.get("/api/health/db", async (req, res) => {
  try {
    const r = await db.query("SELECT 1 as ok");
    res.json({ db: "connected", ok: r.rows[0].ok });
  } catch (e) {
    res.status(503).json({ db: "error", message: e.message });
  }
});
app.get("/api", (req, res) =>
  res.json({ ok: true, name: "Battalion 20 API", version: "3.0.0" }),
);

// PUBLIC: one-time setup — creates tables + admin user
let setupDone = false;
app.all("/api/admin/setup", async (req, res) => {
  try {
    // All statements use IF NOT EXISTS / ON CONFLICT DO NOTHING, so safe to re-run

    // Create core tables first
    const coreTables = [
      "CREATE TABLE IF NOT EXISTS rank_types (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) UNIQUE NOT NULL, color VARCHAR(20))",
      "CREATE TABLE IF NOT EXISTS ranks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, type_id UUID REFERENCES rank_types(id), sort_order INT DEFAULT 0)",
      "CREATE TABLE IF NOT EXISTS weapons (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) UNIQUE NOT NULL, icon VARCHAR(10), color VARCHAR(20))",
      "CREATE TABLE IF NOT EXISTS specialties (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(200) NOT NULL, weapon_id UUID REFERENCES weapons(id) ON DELETE SET NULL, description TEXT)",
      "CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(150) NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(50) DEFAULT 'viewer', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), rank_id UUID, permissions JSONB DEFAULT '{}', avatar_url TEXT)",
      "CREATE TABLE IF NOT EXISTS soldiers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(200) NOT NULL, military_id VARCHAR(50) UNIQUE, rank_id UUID REFERENCES ranks(id), weapon_id UUID REFERENCES weapons(id), specialty_id UUID REFERENCES specialties(id), notes TEXT, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE TABLE IF NOT EXISTS exams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title VARCHAR(200) NOT NULL, type VARCHAR(50), weapon_id UUID REFERENCES weapons(id), specialty_id UUID REFERENCES specialties(id), created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE TABLE IF NOT EXISTS results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exam_id UUID REFERENCES exams(id), soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE, result_type VARCHAR(50) DEFAULT 'exam', total_score NUMERIC(6,2), fitness_score NUMERIC(6,2), specialty_score NUMERIC(6,2), discipline_score NUMERIC(6,2), notes TEXT, exam_date DATE, entered_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE TABLE IF NOT EXISTS fitness_exercises (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(200) NOT NULL, unit VARCHAR(50), higher_is_better BOOLEAN DEFAULT TRUE, pass_mark NUMERIC(5,2) DEFAULT 60)",
      "CREATE TABLE IF NOT EXISTS announcements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title VARCHAR(200) NOT NULL, content TEXT, priority VARCHAR(20) DEFAULT 'info', created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())",
    ];
    for (const sql of coreTables) {
      try { await pool.query(sql); } catch (e) { console.log("Table skip:", e.message); }
    }

    // Run secondary migrations (ALTER TABLE, extra tables)
    await runMigrations();

    // Create admin user
    const { rows: existing } = await db.query("SELECT id FROM users WHERE username='commander'");
    if (!existing.length) {
      const hash = await bcrypt.hash("1234", 10);
      await db.query(
        "INSERT INTO users(name,username,password_hash,role,is_active) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        ["القائد", "commander", hash, "commander", true]
      );
    }
    setupDone = true;
    res.json({ message: "✅ Setup complete — admin user: commander / 1234" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AUTH
const er = express.Router();
er.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "يرجى إدخال البيانات" });
    let rows;
    try {
      const result = await db.query(
        "SELECT u.id,u.name,u.username,u.password_hash,u.role,u.is_active,u.created_at,u.rank_id,u.permissions,u.avatar_url,r.name rank_name,r.sort_order rank_order FROM users u LEFT JOIN ranks r ON r.id=u.rank_id WHERE u.username=$1 AND u.is_active=true",
        [username],
      );
      rows = result.rows;
    } catch (dbErr) {
      return res.status(500).json({ error: `DB: ${dbErr.message}` });
    }
    if (!rows || !rows.length)
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    let passwordOk;
    try {
      passwordOk = await bcrypt.compare(password, rows[0].password_hash);
    } catch (bcryptErr) {
      return res.status(500).json({ error: `BCRYPT: ${bcryptErr.message}` });
    }
    if (!passwordOk)
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    const u = rows[0];
    const token = jwt.sign(
      {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        rankId: u.rank_id,
        rankOrder: u.rank_order,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({
      token,
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        rankId: u.rank_id,
        rankOrder: u.rank_order,
        rankName: u.rank_name,
        permissions: u.permissions || {},
        avatar_url: u.avatar_url,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
er.get("/me", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT u.id,u.name,u.username,u.role,u.permissions,u.avatar_url,r.name rank_name,r.sort_order rank_order FROM users u LEFT JOIN ranks r ON r.id=u.rank_id WHERE u.id=$1",
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
er.patch("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ error: "يرجى إدخال البيانات" });
    const { rows } = await db.query(
      "SELECT password_hash FROM users WHERE id=$1",
      [req.user.id],
    );
    if (
      !rows.length ||
      !(await bcrypt.compare(oldPassword, rows[0].password_hash))
    )
      return res.status(400).json({ error: "كلمة المرور القديمة غير صحيحة" });
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      await bcrypt.hash(newPassword, 10),
      req.user.id,
    ]);
    res.json({ message: "تم التغيير بنجاح" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
er.patch("/profile", auth, async (req, res) => {
  try {
    const { name, username, avatarUrl } = req.body;
    if (username && username !== req.user.username) {
      const { rows: exist } = await db.query(
        "SELECT id FROM users WHERE username=$1 AND id!=$2",
        [username, req.user.id],
      );
      if (exist.length)
        return res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
    }
    const fields = [];
    const vals = [];
    let i = 1;
    if (name) {
      fields.push(`name=$${i++}`);
      vals.push(name);
    }
    if (username) {
      fields.push(`username=$${i++}`);
      vals.push(username);
    }
    if (avatarUrl !== undefined) {
      fields.push(`avatar_url=$${i++}`);
      vals.push(avatarUrl);
    }
    if (!fields.length)
      return res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    vals.push(req.user.id);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(",")} WHERE id=$${i} RETURNING id,name,username,role,avatar_url,permissions`,
      vals,
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/auth", er);

// SECTIONS
const sc = express.Router();
sc.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM sections ORDER BY sort_order");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/sections", sc);

// SOLDIERS
const sl = express.Router();
sl.get("/", auth, async (req, res) => {
  try {
    const { search, weaponId, specialtyId } = req.query;
    let sql =
      "SELECT s.*,r.name rank_name,r.sort_order rank_order,rt.name rank_type,rt.color rank_color,w.name weapon_name,w.icon weapon_icon,sp.name specialty_name,(SELECT COUNT(*) FROM distinctions d WHERE d.soldier_id=s.id) as distinction_count,(SELECT COUNT(*) FROM punishments p WHERE p.soldier_id=s.id) as punishment_count,(SELECT ROUND(AVG(score),1) FROM evaluations WHERE soldier_id=s.id) as avg_score FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN rank_types rt ON rt.id=r.type_id LEFT JOIN weapons w ON w.id=s.weapon_id LEFT JOIN specialties sp ON sp.id=s.specialty_id WHERE 1=1";
    const p = [];
    let i = 1;
    if (search) {
      sql += ` AND (s.name ILIKE $${i} OR s.military_id ILIKE $${i})`;
      p.push(`%${search}%`);
      i++;
    }
    if (weaponId) {
      sql += ` AND s.weapon_id=$${i}`;
      p.push(weaponId);
      i++;
    }
    if (specialtyId) {
      sql += ` AND s.specialty_id=$${i}`;
      p.push(specialtyId);
      i++;
    }
    sql += " ORDER BY r.sort_order DESC NULLS LAST, s.name";
    const { rows } = await db.query(sql, p);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT s.*,r.name rank_name,r.sort_order rank_order,rt.name rank_type,rt.color rank_color,w.name weapon_name,w.icon weapon_icon,sp.name specialty_name,u.name distinguished_by_name FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN rank_types rt ON rt.id=r.type_id LEFT JOIN weapons w ON w.id=s.weapon_id LEFT JOIN specialties sp ON sp.id=s.specialty_id LEFT JOIN users u ON u.id=s.distinguished_by WHERE s.id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    const [evals, dists, puns, stats, sps] = await Promise.all([
      pool.query("SELECT e.*,u.name evaluated_by_name FROM evaluations e LEFT JOIN users u ON u.id=e.evaluated_by WHERE e.soldier_id=$1 ORDER BY e.created_at DESC", [req.params.id]),
      pool.query("SELECT d.*,u.name given_by_name FROM distinctions d LEFT JOIN users u ON u.id=d.given_by WHERE d.soldier_id=$1 ORDER BY d.created_at DESC", [req.params.id]),
      pool.query("SELECT p.*,u.name given_by_name FROM punishments p LEFT JOIN users u ON u.id=p.given_by WHERE p.soldier_id=$1 ORDER BY p.created_at DESC", [req.params.id]),
      pool.query("SELECT section_key,ROUND(AVG(score),1) avg_score,COUNT(*) eval_count,MAX(score) max_score,MIN(score) min_score FROM evaluations WHERE soldier_id=$1 GROUP BY section_key", [req.params.id]),
      pool.query("SELECT sp.id,sp.name,sp.description FROM specialties sp WHERE sp.id=$1", [rows[0]?.specialty_id || null]),
    ]);
    res.json({ ...rows[0], evaluations: evals.rows, distinctions: dists.rows, punishments: puns.rows, sectionStats: stats.rows, specialties: sps.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      militaryId,
      rankId,
      weaponId,
      specialtyId,
      specificSpecialty,
      notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query(
      "INSERT INTO soldiers(name,military_id,rank_id,weapon_id,specialty_id,specific_specialty,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        name,
        militaryId || null,
        rankId || null,
        weaponId || null,
        specialtyId || null,
        specificSpecialty || null,
        notes || null,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.put("/:id", auth, async (req, res) => {
  try {
    const {
      name,
      militaryId,
      rankId,
      weaponId,
      specialtyId,
      specificSpecialty,
      notes,
    } = req.body;
    const { rows } = await db.query(
      "UPDATE soldiers SET name=$1,military_id=$2,rank_id=$3,weapon_id=$4,specialty_id=$5,specific_specialty=$6,notes=$7 WHERE id=$8 RETURNING *",
      [
        name,
        militaryId || null,
        rankId || null,
        weaponId || null,
        specialtyId || null,
        specificSpecialty || null,
        notes || null,
        req.params.id,
      ],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM soldiers WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rowCount } = await db.query("DELETE FROM soldiers WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
sl.post("/:id/distinguish", auth, async (req, res) => {
  try {
    const { badge, citation } = req.body;
    if (!badge)
      return res.status(400).json({ error: "يرجى اختيار نوع الوسام" });
    if (!(await canEvaluate(req.user.id, req.params.id)))
      return res.status(403).json({ error: "لا يمكنك تمييز هذا الفرد" });
    const { rows } = await db.query(
      "UPDATE soldiers SET distinction_badge=$1,distinction_citation=$2,distinguished_by=$3,distinguished_at=NOW() WHERE id=$4 RETURNING *",
      [badge, citation || null, req.user.id, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.delete("/:id/distinguish", auth, async (req, res) => {
  try {
    if (!(await canEvaluate(req.user.id, req.params.id)))
      return res.status(403).json({ error: "لا يمكنك إزالة التمييز" });
    const { rows } = await db.query(
      "UPDATE soldiers SET distinction_badge=NULL,distinction_citation=NULL,distinguished_by=NULL,distinguished_at=NULL WHERE id=$1 RETURNING *",
      [req.params.id],
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sl.post("/:id/evaluate", auth, async (req, res) => {
  try {
    const { fitnessScore, specialtyScore, disciplineScore, notes } = req.body;
    if (
      !(await canEvaluate(req.user.id, req.params.id)) &&
      req.user.role !== "commander"
    )
      return res.status(403).json({ error: "لا يمكنك تقييم هذا الفرد" });
    const fs = cn(fitnessScore),
      ss = cn(specialtyScore),
      ds = cn(disciplineScore);
    const total = [fs, ss, ds].every((s) => s != null)
      ? Math.round(((fs + ss + ds) / 3) * 100) / 100
      : null;
    const result = await db.query(
      "INSERT INTO results(soldier_id,result_type,total_score,fitness_score,specialty_score,discipline_score,notes,exam_date,entered_by) VALUES($1,'evaluation',$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        req.params.id,
        total,
        fs,
        ss,
        ds,
        notes || null,
        new Date().toISOString().split("T")[0],
        req.user.id,
      ],
    );
    if (req.user.role !== "commander") {
      const s = await db.query(
        "SELECT s.name sname,r.name srank,sp.name sspec,w.name sweapon FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN specialties sp ON sp.id=s.specialty_id LEFT JOIN weapons w ON w.id=s.weapon_id WHERE s.id=$1",
        [req.params.id],
      );
      if (s.rows.length) {
        const sr = s.rows[0];
        let msg = `${req.user.name} (${req.user.role}) قام بتقييم ${sr.sname}`;
        await db.query(
          "INSERT INTO notifications(type,message,evaluator_id,evaluator_name,evaluator_rank,evaluator_weapon,evaluated_id,evaluated_name,evaluated_rank,evaluated_specialty,fitness_score,specialty_score,discipline_score,total_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
          [
            "evaluation",
            msg,
            req.user.id,
            req.user.name,
            req.user.role,
            "",
            req.params.id,
            sr.sname,
            sr.srank || "",
            sr.sspec || "",
            fs,
            ss,
            ds,
            total,
          ],
        );
        await pushAllUsers(`تقييم جديد: ${sr.sname}`, msg);
      }
    }
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/soldiers", sl);

// EVALUATIONS
const ev = express.Router();
ev.get("/", auth, async (req, res) => {
  try {
    const { section_key, soldier_id, page, limit } = req.query;
    let sql = "SELECT e.*,u.name evaluated_by_name,sp.name specialty_name FROM evaluations e LEFT JOIN users u ON u.id=e.evaluated_by LEFT JOIN specialties sp ON sp.id=e.specialty_id WHERE 1=1";
    const p = []; let i = 1;
    if (section_key) { sql += ` AND e.section_key=$${i}`; p.push(section_key); i++; }
    if (soldier_id) { sql += ` AND e.soldier_id=$${i}`; p.push(soldier_id); i++; }
    sql += " ORDER BY e.created_at DESC";
    if (page && limit) { const off = (parseInt(page)-1)*parseInt(limit); sql += ` LIMIT $${i} OFFSET $${i+1}`; p.push(parseInt(limit), off); }
    const { rows } = await pool.query(sql, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
ev.get("/soldier/:soldierId", auth, async (req, res) => {
  try {
    const { section_key, specialty_id } = req.query;
    let sql = "SELECT e.*,u.name evaluated_by_name,sp.name specialty_name FROM evaluations e LEFT JOIN users u ON u.id=e.evaluated_by LEFT JOIN specialties sp ON sp.id=e.specialty_id WHERE e.soldier_id=$1";
    const p = [req.params.soldierId]; let i = 2;
    if (section_key) { sql += ` AND e.section_key=$${i}`; p.push(section_key); i++; }
    if (specialty_id) { sql += ` AND e.specialty_id=$${i}`; p.push(specialty_id); i++; }
    sql += " ORDER BY e.created_at DESC";
    const { rows } = await pool.query(sql, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
ev.get("/stats/:sectionKey", auth, async (req, res) => {
  try {
    const { specialtyId } = req.query;
    let sql = "SELECT COUNT(DISTINCT soldier_id) total_soldiers,ROUND(AVG(score),1) avg_score,COUNT(*) total_evals,MAX(score) max_score FROM evaluations WHERE section_key=$1";
    const p = [req.params.sectionKey];
    if (specialtyId) { sql += " AND specialty_id=$2"; p.push(specialtyId); }
    const { rows } = await pool.query(sql, p);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
ev.post("/", auth, async (req, res) => {
  try {
    const { soldier_id, section_key, specialty_id, score, max_score, notes } = req.body;
    if (!soldier_id || !section_key || score==null) return res.status(400).json({ error: "missing fields" });
    const { rows } = await pool.query("INSERT INTO evaluations(soldier_id,section_key,specialty_id,score,max_score,notes,evaluated_by)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING *", [soldier_id, section_key, specialty_id||null, score, max_score||100, notes||null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
ev.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rowCount } = await db.query("DELETE FROM evaluations WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/evaluations", ev);

// DISTINCTIONS
const di = express.Router();
di.get("/soldier/:soldierId", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT d.*,u.name given_by_name FROM distinctions d LEFT JOIN users u ON u.id=d.given_by WHERE d.soldier_id=$1 ORDER BY d.created_at DESC", [req.params.soldierId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
di.post("/", auth, async (req, res) => {
  try {
    const { soldier_id, section_key, specialty_id, reason, color } = req.body;
    if (!soldier_id || !reason) return res.status(400).json({ error: "missing fields" });
    const { rows } = await pool.query("INSERT INTO distinctions(soldier_id,section_key,specialty_id,reason,color,given_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *", [soldier_id, section_key||'general', specialty_id||null, reason, color||'gold', req.user.id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
di.post("/:id/confirm", auth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query("SELECT * FROM distinction_confirmations WHERE distinction_id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    if (existing.length) return res.json({ message: "تم التأكيد مسبقاً" });
    await pool.query("INSERT INTO distinction_confirmations(distinction_id,user_id)VALUES($1,$2)", [req.params.id, req.user.id]);
    const { rows: cnt } = await pool.query("SELECT COUNT(*)::int count FROM distinction_confirmations WHERE distinction_id=$1", [req.params.id]);
    const confirmed = cnt[0].count >= 2;
    await pool.query("UPDATE distinctions SET confirmation_count=$1,is_confirmed=$2 WHERE id=$3", [cnt[0].count, confirmed, req.params.id]);
    res.json({ count: cnt[0].count, is_confirmed: confirmed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
di.get("/:id/confirmations", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT dc.*,u.name user_name FROM distinction_confirmations dc LEFT JOIN users u ON u.id=dc.user_id WHERE dc.distinction_id=$1", [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
di.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM distinction_confirmations WHERE distinction_id=$1", [req.params.id]);
    const { rowCount } = await pool.query("DELETE FROM distinctions WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
di.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "لا توجد معرفات" });
    await pool.query("DELETE FROM distinction_confirmations WHERE distinction_id = ANY($1)", [ids]);
    const { rowCount } = await pool.query("DELETE FROM distinctions WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/distinctions", di);

// PUNISHMENTS
const pu = express.Router();
pu.get("/soldier/:soldierId", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT p.*,u.name given_by_name FROM punishments p LEFT JOIN users u ON u.id=p.given_by WHERE p.soldier_id=$1 ORDER BY p.created_at DESC", [req.params.soldierId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
pu.post("/", auth, async (req, res) => {
  try {
    const { soldier_id, section_key, specialty_id, reason, color } = req.body;
    if (!soldier_id || !reason) return res.status(400).json({ error: "missing fields" });
    const { rows } = await pool.query("INSERT INTO punishments(soldier_id,section_key,specialty_id,reason,color,given_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *", [soldier_id, section_key||'general', specialty_id||null, reason, color||'red', req.user.id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
pu.delete("/:id", auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM punishments WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
pu.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rowCount } = await pool.query("DELETE FROM punishments WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/punishments", pu);

// WEAPONS & SPECIALTIES & RANKS
const wp = express.Router();
wp.get("/", auth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM weapons ORDER BY name");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
wp.post("/", auth, commanderOnly, async (req, res) => {
  try {
    if (!req.body.name)
      return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query(
      "INSERT INTO weapons(name,icon)VALUES($1,$2)RETURNING *",
      [req.body.name, req.body.icon || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
wp.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM weapons WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
wp.put("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { name, icon } = req.body;
    const { rows } = await db.query("UPDATE weapons SET name=COALESCE($1,name),icon=COALESCE($2,icon) WHERE id=$3 RETURNING *", [name || null, icon || null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/weapons", wp);
const sp = express.Router();
sp.get("/", auth, async (req, res) => {
  try {
    const { weaponId } = req.query;
    const sql = "SELECT sp.*,(SELECT COUNT(*) FROM soldiers s WHERE s.specialty_id=sp.id)::int as soldier_count FROM specialties sp" + (weaponId ? " WHERE sp.weapon_id=$1" : "") + " ORDER BY sp.name";
    const params = weaponId ? [weaponId] : [];
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sp.post("/", auth, commanderOnly, async (req, res) => {
  try {
    if (!req.body.name)
      return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query(
      "INSERT INTO specialties(name,weapon_id)VALUES($1,$2)RETURNING *",
      [req.body.name, req.body.weaponId || null],
    );
    const spec = rows[0];
    const { rows: count } = await pool.query("SELECT COUNT(*)::int as soldier_count FROM soldiers WHERE specialty_id=$1", [spec.id]);
    res.status(201).json({ ...spec, soldier_count: count[0].soldier_count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
sp.get("/:id", auth, async (req, res) => {
  try {
    const { rows: spec } = await db.query("SELECT sp.*,(SELECT COUNT(*) FROM soldiers s WHERE s.specialty_id=sp.id)::int as soldier_count FROM specialties sp WHERE sp.id=$1", [req.params.id]);
    if (!spec.length) return res.status(404).json({ error: "غير موجود" });
    const { rows: soldiers } = await pool.query("SELECT s.id,s.name,s.status,r.name rank_name,ROUND(AVG(res.total_score),1) avg_score,COUNT(res.id)::int eval_count,s.created_at assigned_at FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN results res ON res.soldier_id=s.id WHERE s.specialty_id=$1 GROUP BY s.id,r.name ORDER BY s.name", [req.params.id]);
    const totalSoldiers = soldiers.length;
    const avgScore = soldiers.length ? soldiers.reduce((a,b)=>a+(Number(b.avg_score)||0),0)/soldiers.length : 0;
    res.json({ ...spec[0], soldiers, stats: { total_soldiers: totalSoldiers, total_evals: soldiers.reduce((a,b)=>a+(b.eval_count||0),0), avg_score: avgScore ? Math.round(avgScore*10)/10 : null } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
sp.put("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { name, weaponId, description } = req.body;
    const { rows } = await pool.query("UPDATE specialties SET name=$1,weapon_id=$2,description=$3 WHERE id=$4 RETURNING *", [name, weaponId||null, description||null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
sp.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM specialties WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/specialties", sp);
const rk = express.Router();
rk.get("/", auth, async (req, res) => {
  try {
    const { typeId } = req.query;
    const { rows } = typeId
      ? await db.query(
          "SELECT r.*,rt.name as type_name,rt.color as type_color FROM ranks r LEFT JOIN rank_types rt ON rt.id=r.type_id WHERE r.type_id=$1 ORDER BY r.sort_order",
          [typeId],
        )
      : await db.query("SELECT r.*,rt.name as type_name,rt.color as type_color FROM ranks r LEFT JOIN rank_types rt ON rt.id=r.type_id ORDER BY r.sort_order");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rk.get("/types", auth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM rank_types ORDER BY name");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rk.post("/", auth, commanderOnly, async (req, res) => {
  try {
    const { name, typeId, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query("INSERT INTO ranks(name,type_id,sort_order) VALUES($1,$2,$3) RETURNING *", [name, typeId || null, sortOrder || 0]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
rk.put("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { name, typeId, sortOrder } = req.body;
    const { rows } = await db.query("UPDATE ranks SET name=COALESCE($1,name),type_id=COALESCE($2,type_id),sort_order=COALESCE($3,sort_order) WHERE id=$4 RETURNING *", [name || null, typeId || null, sortOrder != null ? sortOrder : null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
rk.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM ranks WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
rk.post("/types", auth, commanderOnly, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query("INSERT INTO rank_types(name,color) VALUES($1,$2) RETURNING *", [name, color || null]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
rk.put("/types/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows } = await db.query("UPDATE rank_types SET name=COALESCE($1,name),color=COALESCE($2,color) WHERE id=$3 RETURNING *", [name || null, color || null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
rk.delete("/types/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM rank_types WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/ranks", rk);

// EXAMS
const ex = express.Router();
ex.get("/", auth, async (req, res) => {
  try {
    const { sectionKey, specialtyId } = req.query;
    const { rows } = await db.query(
      "SELECT e.*,sp.name specialty_name,COUNT(DISTINCT ei.id)::int item_count,COUNT(DISTINCT r.id)::int result_count,ROUND(AVG(r.total_score),1) avg_score FROM exams e LEFT JOIN specialties sp ON sp.id=e.specialty_id LEFT JOIN exam_items ei ON ei.exam_id=e.id LEFT JOIN results r ON r.exam_id=e.id WHERE($1::text IS NULL OR e.section_key=$1::text)AND($2::uuid IS NULL OR e.specialty_id=$2::uuid) GROUP BY e.id,sp.name ORDER BY e.created_at DESC",
      [sectionKey || null, specialtyId || null],
    );
    res.json(
      rows.map((r) => ({
        ...r,
        avg_score: r.avg_score != null ? Number(r.avg_score) : null,
      })),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ex.get("/:id", auth, async (req, res) => {
  try {
    const exam = await db.query(
      "SELECT e.*,sp.name specialty_name FROM exams e LEFT JOIN specialties sp ON sp.id=e.specialty_id WHERE e.id=$1",
      [req.params.id],
    );
    if (!exam.rows.length) return res.status(404).json({ error: "غير موجود" });
    const items = await db.query(
      "SELECT * FROM exam_items WHERE exam_id=$1 ORDER BY sort_order",
      [req.params.id],
    );
    res.json({ ...exam.rows[0], items: items.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ex.post("/", auth, async (req, res) => {
  try {
    const { title, sectionKey, specialtyId, focusPoints, items, notes, maxScore } = req.body;
    if (!title) return res.status(400).json({ error: "يرجى إدخال البيانات" });
    const examSectionKey = sectionKey || "general";
    const { rows } = await db.query(
      "INSERT INTO exams(title,section_key,specialty_id,focus_points,max_score,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [title, examSectionKey, specialtyId || null, focusPoints || null, maxScore || 100, notes || null, req.user.id],
    );
    if (items?.length) for (const item of items)
      await db.query("INSERT INTO exam_items(exam_id,text,max_score,sort_order) VALUES($1,$2,$3,$4)", [rows[0].id, item.text, item.maxScore || 10, item.sortOrder || 0]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ex.put("/:id", auth, async (req, res) => {
  try {
    const { title, sectionKey, specialtyId, focusPoints, notes, maxScore } = req.body;
    const examSectionKey = sectionKey || "general";
    const { rows } = await db.query(
      "UPDATE exams SET title=$1,section_key=$2,specialty_id=$3,focus_points=$4,max_score=$5,notes=$6 WHERE id=$7 RETURNING *",
      [title, examSectionKey, specialtyId || null, focusPoints || null, maxScore || 100, notes || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ex.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    await db.query("DELETE FROM exam_items WHERE exam_id=$1", [req.params.id]);
    const { rowCount } = await db.query("DELETE FROM exams WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ex.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "لا توجد معرفات" });
    await db.query("DELETE FROM exam_items WHERE exam_id = ANY($1)", [ids]);
    const { rowCount } = await db.query("DELETE FROM exams WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/exams", ex);

// RESULTS with three scores + notifications
const rs = express.Router();
rs.get("/", auth, async (req, res) => {
  try {
    const { type, weaponId, soldierId, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows } = await db.query(
      "SELECT r.*,s.name soldier_name,s.military_id,e.title exam_title,e.type exam_type,u.name entered_by_name,COUNT(*)OVER()as total_count FROM results r JOIN soldiers s ON s.id=r.soldier_id LEFT JOIN exams e ON e.id=r.exam_id LEFT JOIN users u ON u.id=r.entered_by WHERE($1::text IS NULL OR r.result_type=$1::text)AND($2::uuid IS NULL OR s.weapon_id=$2::uuid)AND($3::uuid IS NULL OR r.soldier_id=$3::uuid) ORDER BY r.created_at DESC LIMIT $4 OFFSET $5",
      [
        type || null,
        weaponId || null,
        soldierId || null,
        parseInt(limit),
        offset,
      ],
    );
    const total = rows.length ? parseInt(rows[0].total_count) : 0;
    res.json({
      results: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rs.get("/stats", auth, async (req, res) => {
  try {
    const counts = await db.query(
      "SELECT (SELECT COUNT(*)FROM soldiers)total_soldiers,(SELECT COUNT(*)FROM results)total_results,COALESCE(ROUND((SELECT AVG(total_score)FROM results),1),0)avg_score,COALESCE(ROUND((SELECT COUNT(*)FROM results WHERE total_score>=50)*100.0/NULLIF((SELECT COUNT(*)FROM results),0),1),0)pass_rate,COALESCE(ROUND((SELECT AVG(fitness_score)FROM results),1),0)avg_fitness,COALESCE(ROUND((SELECT AVG(specialty_score)FROM results),1),0)avg_specialty,COALESCE(ROUND((SELECT AVG(discipline_score)FROM results),1),0)avg_discipline",
    );
    const byWeapon = await db.query(
      "SELECT w.name weapon_name,w.icon weapon_icon,COUNT(r.id)::int count,ROUND(AVG(r.total_score),1)avg,COALESCE(ROUND(COUNT(CASE WHEN r.total_score>=50 THEN 1 END)*100.0/NULLIF(COUNT(r.id),0),1),0)pass_rate FROM weapons w LEFT JOIN soldiers s ON s.weapon_id=w.id LEFT JOIN results r ON r.soldier_id=s.id GROUP BY w.id,w.name,w.icon ORDER BY count DESC",
    );
    const distribution = await db.query(
      "SELECT COUNT(CASE WHEN total_score>=90 THEN 1 END)::int excellent,COUNT(CASE WHEN total_score>=75 AND total_score<90 THEN 1 END)::int very_good,COUNT(CASE WHEN total_score>=65 AND total_score<75 THEN 1 END)::int good,COUNT(CASE WHEN total_score>=50 AND total_score<65 THEN 1 END)::int acceptable,COUNT(CASE WHEN total_score<50 THEN 1 END)::int fail FROM results",
    );
    const recent = await db.query(
      "SELECT r.*,s.name soldier_name,s.military_id,s.distinction_badge,e.title exam_title FROM results r JOIN soldiers s ON s.id=r.soldier_id LEFT JOIN exams e ON e.id=r.exam_id ORDER BY r.created_at DESC LIMIT 8",
    );
    const c = counts.rows[0],
      d = distribution.rows[0];
    res.json({
      totalSoldiers: Number(c.total_soldiers),
      totalResults: Number(c.total_results),
      avgScore: Number(c.avg_score),
      passRate: Number(c.pass_rate),
      avgFitness: Number(c.avg_fitness),
      avgSpecialty: Number(c.avg_specialty),
      avgDiscipline: Number(c.avg_discipline),
      byWeapon: byWeapon.rows.map((r) => ({
        ...r,
        count: Number(r.count),
        avg: Number(r.avg),
        pass_rate: Number(r.pass_rate),
      })),
      distribution: {
        excellent: Number(d.excellent),
        veryGood: Number(d.very_good),
        good: Number(d.good),
        acceptable: Number(d.acceptable),
        fail: Number(d.fail),
      },
      recentResults: recent.rows.map((r) => ({
        ...r,
        total_score: cn(r.total_score),
        fitness_score: cn(r.fitness_score),
        specialty_score: cn(r.specialty_score),
        discipline_score: cn(r.discipline_score),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rs.get("/:id", auth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT r.*,s.name soldier_name,s.military_id,s.distinction_badge,e.title exam_title,e.type exam_type,u.name entered_by_name FROM results r JOIN soldiers s ON s.id=r.soldier_id LEFT JOIN exams e ON e.id=r.exam_id LEFT JOIN users u ON u.id=r.entered_by WHERE r.id=$1",
      [req.params.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "غير موجود" });
    const scores = await db.query(
      "SELECT ris.*,ei.text item_text,ei.max_score FROM result_item_scores ris LEFT JOIN exam_items ei ON ei.id=ris.item_id WHERE ris.result_id=$1",
      [req.params.id],
    );
    res.json({ ...result.rows[0], scores: scores.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rs.post("/", auth, async (req, res) => {
  try {
    const {
      examId,
      soldierId,
      fitnessScore,
      specialtyScore,
      disciplineScore,
      totalScore,
      notes,
      resultType,
      examDate,
    } = req.body;
    if (!examId || !soldierId)
      return res.status(400).json({ error: "يرجى إدخال البيانات المطلوبة" });
    if (
      !(await canEvaluate(req.user.id, soldierId)) &&
      req.user.role !== "commander"
    )
      return res.status(403).json({ error: "لا يمكنك تقييم هذا الفرد" });
    const fs = cn(fitnessScore),
      ss = cn(specialtyScore),
      ds = cn(disciplineScore);
    const total =
      totalScore != null
        ? cn(totalScore)
        : [fs, ss, ds].every((s) => s != null)
          ? Math.round(((fs + ss + ds) / 3) * 100) / 100
          : null;
    const result = await db.query(
      "INSERT INTO results(exam_id,soldier_id,result_type,total_score,fitness_score,specialty_score,discipline_score,notes,exam_date,entered_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [
        examId,
        soldierId,
        resultType || "exam",
        total,
        fs,
        ss,
        ds,
        notes || null,
        examDate || new Date().toISOString().split("T")[0],
        req.user.id,
      ],
    );
    // Create notification for commander if evaluated by lower rank
    if (req.user.role !== "commander") {
      const s = await db.query(
        "SELECT s.name sname,r.name srank,sp.name sspec,w.name sweapon FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN specialties sp ON sp.id=s.specialty_id LEFT JOIN weapons w ON w.id=s.weapon_id WHERE s.id=$1",
        [soldierId],
      );
      if (s.rows.length) {
        const sr = s.rows[0];
        let msg = `${req.user.name} (${req.user.role}) قام بتقييم ${sr.sname}`;
        await db.query(
          "INSERT INTO notifications(type,message,evaluator_id,evaluator_name,evaluator_rank,evaluator_weapon,evaluated_id,evaluated_name,evaluated_rank,evaluated_specialty,fitness_score,specialty_score,discipline_score,total_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
          [
            "evaluation",
            msg,
            req.user.id,
            req.user.name,
            req.user.role,
            "",
            soldierId,
            sr.sname,
            sr.srank || "",
            sr.sspec || "",
            fs,
            ss,
            ds,
            total,
          ],
        );
        await pushAllUsers(`تقييم`, msg);
      }
    }
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
rs.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM results WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/results", rs);

// FITNESS
const ft = express.Router();
ft.get("/exercises", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM fitness_exercises ORDER BY name",
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ft.post("/exercises", auth, commanderOnly, async (req, res) => {
  try {
    if (!req.body.name)
      return res.status(400).json({ error: "يرجى إدخال الاسم" });
    const { rows } = await db.query(
      "INSERT INTO fitness_exercises(name,unit,higher_is_better,pass_mark)VALUES($1,$2,$3,$4)RETURNING *",
      [
        req.body.name,
        req.body.unit || null,
        req.body.higherIsBetter !== false,
        req.body.passMark || 60,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ft.put("/exercises/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      "UPDATE fitness_exercises SET name=$1,unit=$2,higher_is_better=$3,pass_mark=$4 WHERE id=$5 RETURNING *",
      [
        req.body.name,
        req.body.unit,
        req.body.higherIsBetter,
        req.body.passMark,
        req.params.id,
      ],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ft.delete("/exercises/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM fitness_exercises WHERE id=$1",
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
ft.post("/results", auth, async (req, res) => {
  try {
    const { soldierId, results, notes, examDate } = req.body;
    if (!soldierId || !results?.length)
      return res.status(400).json({ error: "يرجى إدخال البيانات" });
    if (
      !(await canEvaluate(req.user.id, soldierId)) &&
      req.user.role !== "commander"
    )
      return res.status(403).json({ error: "لا يمكنك تقييم هذا الفرد" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fitEx = await db.query(
        "SELECT id,pass_mark FROM fitness_exercises ORDER BY id",
      );
      let totalPct = 0;
      for (const ex of fitEx.rows) {
        const r = results.find((x) => x.exerciseId === ex.id);
        if (r) {
          const val = parseFloat(r.value) || 0;
          const pct =
            ex.pass_mark > 0 ? Math.min(100, (val / ex.pass_mark) * 100) : 0;
          totalPct += pct;
          await client.query(
            "INSERT INTO fitness_results(soldier_id,exercise_id,score_value,score_percent)VALUES($1,$2,$3,$4)",
            [soldierId, ex.id, val, Math.round(pct * 100) / 100],
          );
        }
      }
      const avg =
        fitEx.rows.length > 0
          ? Math.round((totalPct / fitEx.rows.length) * 100) / 100
          : 0;
      await client.query(
        "INSERT INTO results(exam_id,soldier_id,result_type,total_score,fitness_score,notes,exam_date,entered_by)VALUES(NULL,$1,$2,$3,$4,$5,$6,$7)",
        [
          soldierId,
          "fitness",
          avg,
          avg,
          notes || null,
          examDate || new Date().toISOString().split("T")[0],
          req.user.id,
        ],
      );
      await client.query("COMMIT");
      // Notify commander if non-commander evaluated
      if (req.user.role !== "commander") {
        const s = await db.query(
          "SELECT s.name sname,r.name srank,sp.name sspec FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN specialties sp ON sp.id=s.specialty_id WHERE s.id=$1",
          [soldierId],
        );
        if (s.rows.length) {
          const sr = s.rows[0];
          await db.query(
            "INSERT INTO notifications(type,message,evaluator_id,evaluator_name,evaluated_id,evaluated_name,fitness_score,total_score)VALUES('evaluation',$1,$2,$3,$4,$5,$6,$7)",
            [
              `${req.user.name} قام بتقييم لياقة ${sr.sname}`,
              req.user.id,
              req.user.name,
              soldierId,
              sr.sname,
              avg,
              avg,
            ],
          );
          await pushAllUsers(`تقييم لياقة`, `${req.user.name} قام بتقييم لياقة ${sr.sname}`);
        }
      }
      res.status(201).json({ message: "تم الحفظ", totalScore: avg });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/fitness", ft);

// ANNOUNCEMENTS
const an = express.Router();
an.get("/", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT a.*,u.name created_by_name FROM announcements a LEFT JOIN users u ON u.id=a.created_by ORDER BY a.created_at DESC",
    );
    res.json(rows.map(r => ({ ...r, content: r.body })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
an.post("/", auth, async (req, res) => {
  try {
    const { title, body, content, priority: rawPriority } = req.body;
    if (!title) return res.status(400).json({ error: "يرجى إدخال العنوان" });
    const allowedPriority = ['urgent','info','normal'];
    const priority = allowedPriority.includes(rawPriority) ? rawPriority : 'normal';
    const text = body || content || null;
    const { rows } = await db.query(
      "INSERT INTO announcements(title,content,priority,created_by)VALUES($1,$2,$3,$4)RETURNING *",
      [title, text, priority, req.user.id],
    );
    await db.query("INSERT INTO notifications(type,message,evaluator_name)VALUES('announcement',$1,$2)", [`إعلان جديد: ${title}`, req.user.name]);
    await pushAllUsers(`إعلان جديد: ${title}`, text || title);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
an.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT a.*,u.name created_by_name FROM announcements a LEFT JOIN users u ON u.id=a.created_by WHERE a.id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
an.put("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { title, body, content, priority: rawPriority } = req.body;
    if (!title) return res.status(400).json({ error: "يرجى إدخال العنوان" });
    const allowedPriority = ['urgent','info','normal'];
    const priority = allowedPriority.includes(rawPriority) ? rawPriority : 'normal';
    const text = body || content || null;
    const { rows } = await db.query("UPDATE announcements SET title=$1,content=$2,priority=$3 WHERE id=$4 RETURNING *", [title, text, priority, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
an.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM announcements WHERE id=$1",
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
an.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rowCount } = await db.query("DELETE FROM announcements WHERE id = ANY($1)", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/announcements", an);

// PUSH HELPERS
const webpush = require("web-push");
const vapidPublic = process.env.VAPID_PUBLIC_KEY || "BKTs62IfCdNH1Mpshq_JN3jV5A4Uy9s9rkGyYEWpS_JrxBCw77OvGbRgmaimlb9-PP4sv1j7ftw-JHVozz-0jm4";
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "dvU5B9e73mP2w4yGKEIImz2WU89D_Js0d5uGNG5xfck";
webpush.setVapidDetails("mailto:admin@battalion20.com", vapidPublic, vapidPrivate);
async function sendPushToUser(userId, title, body) {
  try {
    const { rows } = await pool.query("SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=$1", [userId]);
    for (const sub of rows) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title, body }));
      } catch (e) { if (e.statusCode === 410) await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [sub.endpoint]); }
    }
  } catch (e) { console.error("sendPushToUser error:", e.message); }
}
async function pushAllUsers(title, body) {
  try {
    const { rows: users } = await pool.query("SELECT id FROM users WHERE is_active=TRUE");
    for (const u of users) { await sendPushToUser(u.id, title, body); }
  } catch (e) { console.error("pushAllUsers error:", e.message); }
}
// PUSH SUBSCRIPTIONS
const ps = express.Router();
ps.post("/subscribe", auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Missing data" });
    await pool.query(
      "INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth)VALUES($1,$2,$3,$4) ON CONFLICT(endpoint)DO UPDATE SET p256dh=$3,auth=$4,updated_at=NOW()",
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ message: "ok" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
ps.post("/unsubscribe", auth, async (req, res) => {
  try {
    if (req.body.endpoint) await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [req.body.endpoint]);
    res.json({ message: "ok" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/push", ps);

// LEAVES
const lv = express.Router();
lv.get("/", auth, async (req, res) => {
  try {
    const { soldier_id, status } = req.query;
    let sql = "SELECT l.*,s.name soldier_name,s.military_id FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE 1=1";
    const params = []; let i = 1;
    if (soldier_id) { sql += ` AND l.soldier_id=$${i}`; params.push(soldier_id); i++; }
    if (status) { sql += ` AND l.status=$${i}`; params.push(status); i++; }
    sql += " ORDER BY l.created_at DESC";
    const { rows } = await pool.query(sql, params);
    res.json({ leaves: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/dashboard", auth, async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*) FROM soldiers");
    const onLeave = await pool.query("SELECT COUNT(*) FROM soldiers WHERE status='leave'");
    const returningToday = await pool.query(
      `SELECT s.id,s.name,s.military_id,r.name as rank_name,l.end_date,l.id as leave_id
       FROM leaves l JOIN soldiers s ON l.soldier_id=s.id LEFT JOIN ranks r ON s.rank_id=r.id
       WHERE l.status='active' AND l.end_date<=CURRENT_DATE AND l.return_confirmed=FALSE ORDER BY l.end_date ASC`
    );
    const statusDist = await pool.query("SELECT status,COUNT(*)::int as count FROM soldiers GROUP BY status");
    const monthlyStats = await pool.query("SELECT TO_CHAR(start_date,'YYYY-MM') as month,COUNT(*) as leaves_count FROM leaves WHERE start_date>=CURRENT_DATE-INTERVAL'12 months' GROUP BY TO_CHAR(start_date,'YYYY-MM') ORDER BY month");
    const upcomingReturns = await pool.query(
      `SELECT l.*,s.name soldier_name,s.military_id,r.name as rank_name,(l.end_date-CURRENT_DATE) as days_remaining
       FROM leaves l JOIN soldiers s ON l.soldier_id=s.id LEFT JOIN ranks r ON s.rank_id=r.id
       WHERE l.status='active' AND l.return_confirmed=FALSE AND l.end_date>CURRENT_DATE ORDER BY l.end_date ASC`
    );
    const needWarning = await pool.query(
      `SELECT * FROM (
        SELECT s.id,s.name,s.military_id,r.name as rank_name,
          COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date) as last_leave,
          (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))::int as days_since,
          CASE
            WHEN (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))::int > 28 THEN 'danger'
            WHEN (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))::int >= 21 THEN 'overdue'
            ELSE 'warning'
          END as leave_status
         FROM soldiers s LEFT JOIN ranks r ON s.rank_id=r.id
         WHERE s.status NOT IN ('leave','mission')
      ) sub WHERE days_since>=19
      ORDER BY days_since DESC`
    ).catch(() => ({ rows: [] }));
    const overdueReturn = await pool.query(
      `SELECT l.*,s.name soldier_name,s.military_id,r.name as rank_name,
        (CURRENT_DATE - l.end_date) as overdue_days
       FROM leaves l JOIN soldiers s ON l.soldier_id=s.id LEFT JOIN ranks r ON s.rank_id=r.id
       WHERE l.status='active' AND l.end_date<CURRENT_DATE AND l.return_confirmed=FALSE
       ORDER BY l.end_date ASC`
    );
    res.json({
      total: parseInt(total.rows[0].count), onLeave: parseInt(onLeave.rows[0].count),
      returningToday: returningToday.rows, returningTodayCount: returningToday.rows.length,
      statusDistribution: statusDist.rows, monthlyStats: monthlyStats.rows, upcomingReturns: upcomingReturns.rows,
      needWarning: needWarning.rows, overdueReturn: overdueReturn.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/active", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT l.*,s.name soldier_name,s.military_id,(l.end_date-CURRENT_DATE) as remaining_days FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' ORDER BY l.end_date ASC");
    res.json({ leaves: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/overdue-return", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT l.*,s.name soldier_name,s.military_id,(CURRENT_DATE-l.end_date) as overdue_days FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' AND l.end_date<CURRENT_DATE AND l.return_confirmed=FALSE ORDER BY l.end_date ASC");
    res.json({ leaves: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/needing-leave", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id,s.name,s.military_id,s.status as soldier_status,r.name as rank_name,
        w.name as weapon_name,w.icon as weapon_icon,
        COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date) as last_leave,
        (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date)) as days_since_leave,
        CASE
          WHEN (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))>28 THEN 'danger'
          WHEN (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))>=21 THEN 'overdue'
          WHEN (CURRENT_DATE - COALESCE(s.last_leave_end,s.enlistment_date,s.created_at::date))>=19 THEN 'warning'
          ELSE 'ok'
        END as leave_status
       FROM soldiers s LEFT JOIN ranks r ON s.rank_id=r.id LEFT JOIN weapons w ON s.weapon_id=w.id
       WHERE s.status NOT IN ('leave','mission')
       ORDER BY days_since_leave DESC`
    );
    res.json({ soldiers: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.post("/", auth, async (req, res) => {
  try {
    const { soldier_id, start_date, end_date, notes } = req.body;
    if (!soldier_id || !start_date || !end_date) return res.status(400).json({ error: "missing fields" });
    const { rows } = await pool.query("INSERT INTO leaves(soldier_id,start_date,end_date,notes,confirmed_by)VALUES($1,$2,$3,$4,$5)RETURNING *", [soldier_id, start_date, end_date, notes||null, req.user.id]);
    await pool.query("UPDATE soldiers SET status='leave',last_leave_end=$1 WHERE id=$2", [end_date, soldier_id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.patch("/:id/confirm-return", auth, async (req, res) => {
  try {
    const leave = await pool.query("SELECT * FROM leaves WHERE id=$1", [req.params.id]);
    if (!leave.rows.length) return res.status(404).json({ error: "غير موجود" });
    const { rows } = await pool.query("UPDATE leaves SET return_confirmed=TRUE,return_confirmed_by=$1,return_confirmed_at=NOW(),status='completed' WHERE id=$2 RETURNING *", [req.user.id, req.params.id]);
    const today = new Date().toISOString().slice(0, 10);
    await pool.query("UPDATE soldiers SET status='active', last_leave_end=$1 WHERE id=$2", [today, leave.rows[0].soldier_id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const leave = await pool.query("SELECT * FROM leaves WHERE id=$1", [req.params.id]);
    if (!leave.rows.length) return res.status(404).json({ error: "غير موجود" });
    const { rows } = await pool.query("UPDATE leaves SET status='cancelled' WHERE id=$1 RETURNING *", [req.params.id]);
    await pool.query("UPDATE soldiers SET status='active' WHERE id=$1 AND status='leave'", [leave.rows[0].soldier_id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/leaves", lv);

// NOTIFICATIONS
const nt = express.Router();
nt.get("/", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50",
    );
    res.json({ notifications: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
nt.patch("/:id/read", auth, async (req, res) => {
  try {
    await db.query("UPDATE notifications SET is_read=true WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ message: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
nt.patch("/read-all", auth, async (req, res) => {
  try {
    await db.query("UPDATE notifications SET is_read=true WHERE is_read=false");
    res.json({ message: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
nt.get("/unread-count", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT COUNT(*)::int count FROM notifications WHERE is_read=false",
    );
    res.json({ count: rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.use("/api/notifications", nt);

// USERS
const us = express.Router();
us.get("/", auth, commanderOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT u.id,u.name,u.username,u.role,u.is_active,u.created_at,r.name rank_name,u.permissions FROM users u LEFT JOIN ranks r ON r.id::text=u.rank_id::text ORDER BY u.created_at",
    );
    res.json(rows);
  } catch (e) {
    try {
      const { rows } = await db.query(
        "SELECT id,name,username,role,is_active,created_at FROM users ORDER BY created_at",
      );
      res.json(rows);
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});
us.post("/", auth, commanderOnly, async (req, res) => {
  try {
    const { name, username, password, role, rankId, permissions } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ error: "يرجى إدخال البيانات" });
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users(name,username,password_hash,role,rank_id,permissions)VALUES($1,$2,$3,$4,$5,$6)",
      [
        name,
        username,
        hash,
        role || "officer",
        rankId || null,
        permissions ? JSON.stringify(permissions) : "{}",
      ],
    );
    res.status(201).json({ message: "تم الإنشاء" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
us.patch("/:id", auth, async (req, res) => {
  try {
    const { name, rankId } = req.body;
    if (req.user.id !== req.params.id && req.user.role !== 'commander')
      return res.status(403).json({ error: "غير مصرح" });
    const sets = []; const vals = []; let i = 1;
    if (name) { sets.push(`name=$${i}`); vals.push(name); i++; }
    if (rankId) { sets.push(`rank_id=$${i}`); vals.push(rankId); i++; }
    if (!sets.length) return res.status(400).json({ error: "لا توجد بيانات" });
    vals.push(req.params.id);
    const { rows } = await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id,name,username,role,rank_id,permissions,is_active`, vals);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

us.patch("/:id/password", auth, commanderOnly, async (req, res) => {
  try {
    if (!req.body.password)
      return res.status(400).json({ error: "يرجى إدخال كلمة المرور" });
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      await bcrypt.hash(req.body.password, 10),
      req.params.id,
    ]);
    res.json({ message: "تم التغيير" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
us.patch("/:id/toggle", auth, commanderOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      "UPDATE users SET is_active=NOT is_active WHERE id=$1 RETURNING is_active",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json({
      isActive: rows[0].is_active,
      message: rows[0].is_active ? "تم التفعيل" : "تم التعطيل",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
us.patch("/:id/permissions", auth, commanderOnly, async (req, res) => {
  try {
    const { permissions } = req.body;
    await db.query("UPDATE users SET permissions=$1 WHERE id=$2", [
      JSON.stringify(permissions || {}),
      req.params.id,
    ]);
    res.json({ message: "تم التحديث" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
us.delete("/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM users WHERE id=$1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "غير موجود" });
    res.json({ message: "تم الحذف" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
us.post("/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rowCount } = await db.query("DELETE FROM users WHERE id = ANY($1) AND role != 'commander'", [ids]);
    res.json({ deleted: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.use("/api/users", us);

// ADMIN (seed data)
app.post("/api/admin/seed", auth, commanderOnly, async (req, res) => {
  const results = {};
  const safe = async (label, fn) => { try { await fn(); results[label] = 'ok'; } catch (e) { results[label] = e.message; } };
  try {
    await safe('weapons', () => db.query("INSERT INTO weapons(name,icon)VALUES('المشاة','🔫'),('المدرعات','🛡️'),('المدفعية','💣'),('الإشارة','📡'),('المهندسين','🔧') ON CONFLICT DO NOTHING"));
    await safe('rank_types', () => db.query("INSERT INTO rank_types(name,color)VALUES('ضباط','#C9A84C'),('صف ضباط','#9CAF88'),('جنود','#2D6A4F') ON CONFLICT DO NOTHING"));
    await safe('ranks', () => db.query("WITH rt AS (SELECT id FROM rank_types WHERE name='ضباط' LIMIT 1), srt AS (SELECT id FROM rank_types WHERE name='صف ضباط' LIMIT 1), jrt AS (SELECT id FROM rank_types WHERE name='جنود' LIMIT 1) INSERT INTO ranks(name,type_id,sort_order) SELECT * FROM (VALUES('جندي',(SELECT id FROM jrt),1),('جندي أول',(SELECT id FROM jrt),2),('عريف',(SELECT id FROM srt),3),('وكيل رقيب',(SELECT id FROM srt),4),('رقيب',(SELECT id FROM srt),5),('رقيب أول',(SELECT id FROM srt),6),('مساعد',(SELECT id FROM srt),7),('مساعد أول',(SELECT id FROM srt),8),('ملازم',(SELECT id FROM rt),9),('ملازم أول',(SELECT id FROM rt),10),('نقيب',(SELECT id FROM rt),11),('رائد',(SELECT id from rt),12),('مقدم',(SELECT id from rt),13),('عقيد',(SELECT id from rt),14),('عميد',(SELECT id from rt),15),('فريق',(SELECT id from rt),16),('فريق أول',(SELECT id from rt),17)) AS v ON CONFLICT(name) DO NOTHING"));
    await safe('specialties', () => db.query("INSERT INTO specialties(name,weapon_id)SELECT 'قناص',(SELECT id FROM weapons WHERE name='المشاة' LIMIT 1) WHERE EXISTS(SELECT 1 FROM weapons) ON CONFLICT DO NOTHING"));
    await safe('soldiers', () => db.query("INSERT INTO soldiers(name,military_id,rank_id,weapon_id,specialty_id)SELECT 'جندي تجريبي','12345',(SELECT id FROM ranks WHERE name='جندي' LIMIT 1),(SELECT id FROM weapons WHERE name='المشاة' LIMIT 1),(SELECT id FROM specialties LIMIT 1) WHERE EXISTS(SELECT 1 FROM weapons) AND NOT EXISTS(SELECT 1 FROM soldiers WHERE military_id='12345')"));
    await safe('exams', () => db.query("INSERT INTO exams(section_key,title)SELECT 'fitness','اختبار تجريبي' WHERE EXISTS(SELECT 1 FROM weapons) AND NOT EXISTS(SELECT 1 FROM exams)"));
    await safe('announcements', () => db.query("INSERT INTO announcements(title,content,priority,created_by)SELECT 'مرحباً','المنصة جاهزة للعمل','info',(SELECT id FROM users WHERE role='commander' LIMIT 1) WHERE NOT EXISTS(SELECT 1 FROM announcements)"));
    res.json({ message: "✅ تم إضافة بيانات تجريبية", results });
  } catch (e) {
    res.status(500).json({ error: e.message, results });
  }
});

// ---- Cipher endpoints (commander only) ----
const DIGIT_SYMBOLS = ['⊡', '─', '═', '▬', '●', '■', '▲', '▼', '◆', '◀'];

app.get("/api/cipher/map", auth, commanderOnly, async (req, res) => {
  res.json({ mapping: DIGIT_SYMBOLS.map((symbol, digit) => ({ symbol, digit })) });
});

// Hardcoded decoder "AI" — decodes cipher symbols back to numbers
// Only works for commander/admin; rate-limited by auth middleware
app.post("/api/cipher/decode", auth, commanderOnly, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.length > 5000) {
      return res.status(400).json({ error: "نص غير صالح أو طويل جداً" });
    }

    // Build reverse map from symbols to digits
    const reverseMap = {};
    DIGIT_SYMBOLS.forEach((sym, digit) => { reverseMap[sym] = digit; });

    // Get all symbol characters from the map
    const symbolChars = DIGIT_SYMBOLS.join("");
    const symbolSet = new Set(DIGIT_SYMBOLS);

    // Decode: replace each cipher symbol with its digit
    // Also detect runs of consecutive symbols and decode them as numbers
    let decoded = "";
    let currentRun = "";

    for (const ch of text) {
      if (symbolSet.has(ch)) {
        currentRun += ch;
        decoded += reverseMap[ch];
      } else {
        if (currentRun.length > 0) {
          currentRun = "";
        }
        decoded += ch;
      }
    }

    res.json({
      original: text,
      decoded,
      // Also provide a highlighted version showing the mapping
      explanation: `تم فك تشفير النص. تم استبدال الرموز (${
        DIGIT_SYMBOLS.join("، ")
      }) بالأرقام المقابلة (${DIGIT_SYMBOLS.map((_, i) => i).join("، ")}).`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const ARABIC_FONT = process.env.ARABIC_FONT || "C:/Windows/Fonts/arial.ttf";

app.get("/api/cipher/download", auth, commanderOnly, async (req, res) => {
  try {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: "دليل فك التشفير - كتيبة 20", Author: "قائد كتيبة 20" }
    });

    let buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdf = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="decoder-battalion20.pdf"');
      res.send(pdf);
    });

    // Register Arabic-supporting font
    doc.registerFont("Arabic", ARABIC_FONT);

    // Title
    doc.font("Arabic").fontSize(22).fillColor("#d4a843");
    doc.text("دليل فك التشفير", { align: "right" });
    doc.fontSize(11).fillColor("#999");
    doc.text("كتيبة 20 — وثيقة سرية للقائد فقط", { align: "right" });
    doc.moveDown(1.5);

    // Table header
    const tableTop = doc.y;
    const colW = 100;
    const rowH = 28;
    const tableX = doc.page.width - 50 - colW * 4;

    // Draw table borders
    doc.fontSize(12).fillColor("#d4a843");
    const headers = ["الرمز", "الرقم", "الرمز", "الرقم"];
    headers.forEach((h, i) => {
      doc.rect(tableX + i * colW, tableTop, colW, rowH).fill("#d4a84320");
      doc.fillColor("#d4a843");
      doc.text(h, tableX + i * colW + colW / 2, tableTop + 8, { align: "center", width: colW });
    });

    // Table rows
    doc.fontSize(14).fillColor("#e8e0d0");
    const rows = [0, 2, 4, 6, 8];
    rows.forEach((i, ri) => {
      const y = tableTop + rowH + ri * rowH;
      // Row background
      doc.rect(tableX, y, colW * 4, rowH).fill(ri % 2 === 0 ? "#ffffff08" : "#ffffff00");
      // Symbols
      [
        { sym: DIGIT_SYMBOLS[i], num: i },
        { sym: DIGIT_SYMBOLS[i + 1], num: i + 1 },
      ].forEach((item, ci) => {
        const x = tableX + ci * (colW * 2);
        doc.fillColor("#e8e0d0").fontSize(22);
        doc.text(item.sym, x + colW / 2, y + 2, { align: "center", width: colW });
        doc.fillColor("#aaa").fontSize(14);
        doc.text(`= ${item.num}`, x + colW + colW / 2, y + 6, { align: "center", width: colW });
      });
      // Separator line
      doc.strokeColor("#ffffff10").lineWidth(0.5).moveTo(tableX, y + rowH).lineTo(tableX + colW * 4, y + rowH).stroke();
    });

    doc.moveDown(2);

    // Usage instructions
    doc.fontSize(13).fillColor("#d4a843");
    doc.text("طريقة الاستخدام:", { align: "right" });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#ccc");
    doc.text(
      "كل رقم في النظام (درجات، إحصائيات، أعداد) يتم تحويله باستبدال كل رقم بالرمز المقابل له في الجدول أعلاه.",
      { align: "right" }
    );
    doc.moveDown(0.5);

    // Examples
    const examples = [
      { label: "الدرجة 85 تظهر كـ", encoded: `${DIGIT_SYMBOLS[8]}${DIGIT_SYMBOLS[5]}`, detail: "(8→⊡، 5→■)" },
      { label: "الدرجة 100 تظهر كـ", encoded: `${DIGIT_SYMBOLS[1]}${DIGIT_SYMBOLS[0]}${DIGIT_SYMBOLS[0]}`, detail: "" },
      { label: "الدرجة 50 تظهر كـ", encoded: `${DIGIT_SYMBOLS[5]}${DIGIT_SYMBOLS[0]}`, detail: "" },
    ];
    examples.forEach((ex) => {
      doc.fontSize(12).fillColor("#e8e0d0");
      doc.text(`${ex.label} `, { continued: true, align: "right" });
      doc.fontSize(16).fillColor("#d4a843");
      doc.text(ex.encoded, { align: "right" });
      doc.moveDown(0.3);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).fillColor("rgba(232,224,208,0.3)");
    doc.text(
      `تم الإنشاء في ${new Date().toLocaleDateString("ar-EG")} — للقائد فقط`,
      { align: "center" }
    );

    doc.end();
  } catch (e) {
    // Fallback: return simple text PDF
    console.error("PDF generation error:", e);
    // Generate minimal PDF manually
    let pdf = Buffer.from(
      `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n` +
      `4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
      `5 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Error) Tj ET\nendstream\nendobj\nxref\n0 6\n` +
      `0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n` +
      `0000000344 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n418\n%%EOF\n`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="decoder-battalion20.pdf"');
    res.send(pdf);
  }
});

// ---- Excel Bulk Upload ----
app.post("/api/soldiers/bulk-upload", auth, commanderOnly, async (req, res) => {
  try {
    const { soldiers } = req.body;
    if (!soldiers || !soldiers.length) return res.status(400).json({ error: "لا توجد بيانات" });

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of soldiers) {
      try {
        const name = row.name || row.الاسم;
        const militaryId = row.military_id || row.الرقم_العسكري || row["الرقم العسكري"];
        const specialtyName = row.specialty || row.التخصص;
        const weaponName = row.weapon || row.السلاح;
        const rankName = row.rank || row.الرتبة;
        const status = row.status || row.الحالة;

        if (!name || !militaryId) { results.skipped++; continue; }

        // Find or create weapon
        let weaponId = null;
        if (weaponName) {
          let w = await db.query("SELECT id FROM weapons WHERE name=$1", [weaponName]);
          if (!w.rows.length) {
            w = await db.query("INSERT INTO weapons(name) VALUES($1) RETURNING id", [weaponName]);
          }
          weaponId = w.rows[0].id;
        }

        // Find or create specialty
        let specialtyId = null;
        if (specialtyName) {
          let sp = await db.query("SELECT id FROM specialties WHERE name=$1", [specialtyName]);
          if (!sp.rows.length) {
            sp = await db.query("INSERT INTO specialties(name,weapon_id) VALUES($1,$2) RETURNING id", [specialtyName, weaponId]);
          }
          specialtyId = sp.rows[0].id;
        }

        // Find rank by name or use lowest
        let rankId = null;
        if (rankName) {
          const r = await db.query("SELECT id FROM ranks WHERE name=$1", [rankName]);
          if (r.rows.length) rankId = r.rows[0].id;
        }
        if (!rankId) {
          const { rows: ranks } = await db.query("SELECT id FROM ranks ORDER BY sort_order LIMIT 1");
          rankId = ranks.length ? ranks[0].id : null;
        }

        // Validate status
        const validStatuses = ['active','leave','mission','other'];
        const finalStatus = status && validStatuses.includes(status.toLowerCase()) ? status.toLowerCase() : null;

        // Check if soldier already exists
        const exist = await db.query("SELECT id FROM soldiers WHERE military_id=$1", [militaryId]);
        if (exist.rows.length) {
          await db.query("UPDATE soldiers SET name=$1,weapon_id=$2,specialty_id=$3,rank_id=$4,status=COALESCE($5,status) WHERE id=$6",
            [name, weaponId, specialtyId, rankId, finalStatus, exist.rows[0].id]);
          results.created++;
        } else {
          await db.query("INSERT INTO soldiers(name,military_id,rank_id,weapon_id,specialty_id,status) VALUES($1,$2,$3,$4,$5,$6)",
            [name, militaryId, rankId, weaponId, specialtyId, finalStatus || 'active']);
          results.created++;
        }
      } catch (e) {
        results.errors.push({ row: row.name || row.الاسم, error: e.message });
      }
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- CLEAR ALL DATA (commander only) ----
app.post("/api/admin/clear-all", auth, commanderOnly, async (req, res) => {
  try {
    await db.query("DELETE FROM result_item_scores WHERE result_id IN (SELECT id FROM results)").catch(() => {});
    await db.query("DELETE FROM fitness_results");
    await db.query("DELETE FROM distinction_confirmations").catch(() => {});
    await db.query("DELETE FROM distinctions");
    await db.query("DELETE FROM punishments");
    await db.query("DELETE FROM results");
    await db.query("DELETE FROM soldiers");
    await db.query("DELETE FROM exam_items").catch(() => {});
    await db.query("DELETE FROM exams");
    await db.query("DELETE FROM announcements");
    await db.query("DELETE FROM specialties");
    await db.query("DELETE FROM weapons");
    await db.query("DELETE FROM ranks");
    await db.query("DELETE FROM rank_types");
    await db.query("DELETE FROM fitness_exercises");
    await db.query("DELETE FROM notifications");
    res.json({ message: "✅ تم حذف جميع البيانات" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- FULL UPLOAD: multi-sheet Excel → entire dashboard ----
app.post("/api/admin/full-upload", auth, commanderOnly, async (req, res) => {
  try {
    const { personnel, evaluations, fitness, remarks } = req.body;
    if (!personnel || !personnel.length) return res.status(400).json({ error: "لا توجد بيانات أفراد" });

    const log = { weapons: 0, ranks: 0, specialties: 0, soldiers: 0, evaluations: 0, fitness: 0, distinctions: 0, punishments: 0, errors: [] };

    // 1) Clear existing data (order matters for FK constraints)
    await db.query("DELETE FROM result_item_scores WHERE result_id IN (SELECT id FROM results WHERE result_type='evaluation')");
    await db.query("DELETE FROM fitness_results");
    await db.query("DELETE FROM distinctions");
    await db.query("DELETE FROM punishment_confirmations").catch(() => {});
    await db.query("DELETE FROM punishments");
    await db.query("DELETE FROM results WHERE result_type='evaluation'");
    await db.query("DELETE FROM soldiers");

    // 2) Seed default fitness exercises
    const fitnessDefs = [
      { name: 'تمرين الجري', unit: 'ثانية', higher_is_better: false, pass_mark: 12 },
      { name: 'تمرين الضغط', unit: 'عدد', higher_is_better: true, pass_mark: 30 },
      { name: 'تمرين البطن', unit: 'عدد', higher_is_better: true, pass_mark: 30 },
      { name: 'تمرين المعدية', unit: 'عدد', higher_is_better: true, pass_mark: 6 },
    ];
    const exerciseMap = {};
    for (const ex of fitnessDefs) {
      let r = await db.query("SELECT id FROM fitness_exercises WHERE name=$1", [ex.name]);
      if (!r.rows.length) {
        r = await db.query("INSERT INTO fitness_exercises(name,unit,higher_is_better,pass_mark) VALUES($1,$2,$3,$4) RETURNING id", [ex.name, ex.unit, ex.higher_is_better, ex.pass_mark]);
      }
      exerciseMap[ex.name] = r.rows[0].id;
    }

    // 3) Build lookup maps from Sheet 1
    const weaponNames = [...new Set(personnel.map(r => r.السلاح || r.Sلاح).filter(Boolean))];
    const specialtyNames = [...new Set(personnel.map(r => r.التخصص).filter(Boolean))];
    const rankNames = [...new Set(personnel.map(r => r.الرتبة).filter(Boolean))];

    // Create weapons
    const weaponMap = {};
    for (const name of weaponNames) {
      let r = await db.query("SELECT id FROM weapons WHERE name=$1", [name]);
      if (!r.rows.length) {
        r = await db.query("INSERT INTO weapons(name) VALUES($1) RETURNING id", [name]);
        log.weapons++;
      }
      weaponMap[name] = r.rows[0].id;
    }

    // Create specialties linked to weapons
    const specialtyMap = {};
    for (const row of personnel) {
      const specName = row.التخصص;
      const weapName = row.السلاح;
      if (!specName || specialtyMap[specName]) continue;
      const wid = weaponMap[weapName] || null;
      let r = await db.query("SELECT id FROM specialties WHERE name=$1", [specName]);
      if (!r.rows.length) {
        r = await db.query("INSERT INTO specialties(name,weapon_id) VALUES($1,$2) RETURNING id", [specName, wid]);
        log.specialties++;
      }
      specialtyMap[specName] = r.rows[0].id;
    }

    // Ranks
    const RANK_HIERARCHY = [
      { name: 'جندي', type: 'جنود', sort: 1 },
      { name: 'جندي أول', type: 'جنود', sort: 2 },
      { name: 'عريف', type: 'صف ضباط', sort: 3 },
      { name: 'وكيل رقيب', type: 'صف ضباط', sort: 4 },
      { name: 'رقيب', type: 'صف ضباط', sort: 5 },
      { name: 'رقيب أول', type: 'صف ضباط', sort: 6 },
      { name: 'مساعد', type: 'صف ضباط', sort: 7 },
      { name: 'مساعد أول', type: 'صف ضباط', sort: 8 },
      { name: 'ملازم', type: 'ضباط', sort: 9 },
      { name: 'ملازم أول', type: 'ضباط', sort: 10 },
      { name: 'نقيب', type: 'ضباط', sort: 11 },
      { name: 'رائد', type: 'ضباط', sort: 12 },
      { name: 'مقدم', type: 'ضباط', sort: 13 },
      { name: 'عقيد', type: 'ضباط', sort: 14 },
      { name: 'عميد', type: 'ضباط', sort: 15 },
      { name: 'فريق', type: 'ضباط', sort: 16 },
      { name: 'فريق أول', type: 'ضباط', sort: 17 },
    ];
    const rankTypeMap = {};
    for (const rt of RANK_HIERARCHY) {
      if (!rankTypeMap[rt.type]) {
        let rr = await db.query("SELECT id FROM rank_types WHERE name=$1", [rt.type]);
        if (!rr.rows.length) {
          rr = await db.query("INSERT INTO rank_types(name) VALUES($1) RETURNING id", [rt.type]);
          log.ranks++;
        }
        rankTypeMap[rt.type] = rr.rows[0].id;
      }
    }
    const rankMap = {};
    for (const name of rankNames) {
      let r = await db.query("SELECT id FROM ranks WHERE name=$1", [name]);
      if (r.rows.length) {
        rankMap[name] = r.rows[0].id;
      } else {
        const info = RANK_HIERARCHY.find(h => h.name === name);
        const typeId = info ? rankTypeMap[info.type] : null;
        const sortOrder = info ? info.sort : 0;
        r = await db.query("INSERT INTO ranks(name,type_id,sort_order) VALUES($1,$2,$3) RETURNING id", [name, typeId, sortOrder]);
        rankMap[name] = r.rows[0].id;
        log.ranks++;
      }
    }

    // 4) Insert soldiers
    const milIdMap = {};
    const sampleRow = personnel[0] ? Object.keys(personnel[0]) : [];
    log.excelColumns = sampleRow;
    for (const row of personnel) {
      try {
        const name = row.الاسم;
        const militaryId = String(row["الرقم العسكري"]).trim();
        if (!name || !militaryId) continue;

        const rankId = rankMap[row.الرتبة] || null;
        const weaponId = weaponMap[row.السلاح] || null;
        const specialtyId = specialtyMap[row.التخصص] || null;
        const statusRaw = (row.الحالة || 'active').toLowerCase().trim();
        const statusMap = { 'نشط': 'active', 'active': 'active', 'إجازة': 'leave', 'leave': 'leave', 'مأمورية': 'mission', 'mission': 'mission', 'أخرى': 'other', 'other': 'other' };
        const status = statusMap[statusRaw] || 'active';
        const notes = row.ملاحظات || null;
        let enlistDate = row["تاريخ الالتحاق"] || null;
        if (enlistDate && typeof enlistDate === 'number') {
          const d = new Date((enlistDate - 25569) * 86400 * 1000);
          enlistDate = d.toISOString().slice(0, 10);
        }
        if (enlistDate && typeof enlistDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(enlistDate) === false) {
          const parsed = new Date(enlistDate);
          if (!isNaN(parsed.getTime())) enlistDate = parsed.toISOString().slice(0, 10);
          else enlistDate = null;
        }

        let lastLeaveEnd = null;
        for (const key of Object.keys(row)) {
          if (key.includes('العود') || key.includes('last_leave') || key.includes('LAST')) {
            lastLeaveEnd = row[key];
            break;
          }
        }
        if (lastLeaveEnd && typeof lastLeaveEnd === 'number') {
          const d = new Date((lastLeaveEnd - 25569) * 86400 * 1000);
          lastLeaveEnd = d.toISOString().slice(0, 10);
        }
        if (lastLeaveEnd && typeof lastLeaveEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastLeaveEnd) === false) {
          const parsed = new Date(lastLeaveEnd);
          if (!isNaN(parsed.getTime())) lastLeaveEnd = parsed.toISOString().slice(0, 10);
          else lastLeaveEnd = null;
        }

        const r = await db.query(
          "INSERT INTO soldiers(name,military_id,rank_id,weapon_id,specialty_id,status,notes,enlistment_date,last_leave_end) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,military_id",
          [name, militaryId, rankId, weaponId, specialtyId, status, notes, enlistDate, lastLeaveEnd]
        );
        milIdMap[militaryId] = r.rows[0].id;
        log.soldiers++;
      } catch (e) {
        log.errors.push({ sheet: 'الأفراد', row: row.الاسم, error: e.message });
      }
    }

    // 5) Insert evaluations (Sheet 2)
    const sectionKeys = ['general', 'fitness', 'shooting', 'specialties', 'discipline'];
    const evalCols = ['التقييم العام', 'اللياقة البدنية', 'الرماية', 'التخصص', 'الانضباط'];
    if (evaluations && evaluations.length) {
      for (const row of evaluations) {
        try {
          const militaryId = String(row["الرقم العسكري"]).trim();
          const soldierId = milIdMap[militaryId];
          if (!soldierId) { log.errors.push({ sheet: 'التقييمات', row: militaryId, error: 'جندي غير موجود' }); continue; }

          const evalDate = row["تاريخ التقييم"] || new Date().toISOString().slice(0, 10);
          const notes = row.ملاحظات || null;
          const scores = evalCols.map(c => parseFloat(row[c]) || 0);
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

          const r = await db.query(
            "INSERT INTO results(exam_id,soldier_id,result_type,total_score,fitness_score,specialty_score,discipline_score,notes,exam_date,entered_by) VALUES(NULL,$1,'evaluation',$2,$3,$4,$5,$6,$7,$8) RETURNING id",
            [soldierId, avg, scores[1], scores[3], scores[4], notes, evalDate, req.user.id]
          );

          // Also insert per-section evaluations for the sections page
          for (let i = 0; i < sectionKeys.length; i++) {
            if (scores[i] > 0) {
              await db.query(
                "INSERT INTO evaluations(soldier_id,section_key,score,max_score,notes,evaluated_by) VALUES($1,$2,$3,100,$4,$5)",
                [soldierId, sectionKeys[i], scores[i], notes, req.user.id]
              );
            }
          }
          log.evaluations++;
        } catch (e) {
          log.errors.push({ sheet: 'التقييمات', row: row["الرقم العسكري"], error: e.message });
        }
      }
    }

    // 6) Insert fitness results (Sheet 3)
    if (fitness && fitness.length) {
      for (const row of fitness) {
        try {
          const militaryId = String(row["الرقم العسكري"]).trim();
          const soldierId = milIdMap[militaryId];
          if (!soldierId) continue;

          for (const ex of fitnessDefs) {
            const rawValue = parseFloat(row[ex.name]);
            if (isNaN(rawValue)) continue;
            const percent = ex.higher_is_better
              ? Math.min(100, (rawValue / ex.pass_mark) * 100)
              : Math.min(100, (ex.pass_mark / rawValue) * 100);
            await db.query(
              "INSERT INTO fitness_results(soldier_id,exercise_id,score_value,score_percent) VALUES($1,$2,$3,$4)",
              [soldierId, exerciseMap[ex.name], rawValue, Math.round(percent * 100) / 100]
            );
            log.fitness++;
          }
        } catch (e) {
          log.errors.push({ sheet: 'اللياقة', row: row["الرقم العسكري"], error: e.message });
        }
      }
    }

    // 7) Insert remarks - distinctions & punishments (Sheet 4)
    if (remarks && remarks.length) {
      for (const row of remarks) {
        try {
          const militaryId = String(row["الرقم العسكري"]).trim();
          const soldierId = milIdMap[militaryId];
          if (!soldierId) continue;

          const type = (row.النوع || '').toLowerCase();
          const section = (row.القسم || 'general').toLowerCase();
          const reason = row.السبب || '';
          if (!reason) continue;

          if (type === 'distinction') {
            await db.query(
              "INSERT INTO distinctions(soldier_id,section_key,reason,color,given_by,is_confirmed,confirmation_count) VALUES($1,$2,$3,'gold',$4,TRUE,2)",
              [soldierId, section, reason, req.user.id]
            );
            log.distinctions++;
          } else if (type === 'punishment') {
            await db.query(
              "INSERT INTO punishments(soldier_id,section_key,reason,color,given_by) VALUES($1,$2,$3,'red',$4)",
              [soldierId, section, reason, req.user.id]
            );
            log.punishments++;
          }
        } catch (e) {
          log.errors.push({ sheet: 'الملاحظات', row: row["الرقم العسكري"], error: e.message });
        }
      }
    }

    res.json({ message: "✅ تم رفع جميع البيانات بنجاح", ...log });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- LEAVE RETURN: mark soldier returned from leave ----
app.patch("/api/soldiers/:id/confirm-return", auth, commanderOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      "UPDATE soldiers SET status='active', last_leave_end=$1 WHERE id=$2 RETURNING id,name,military_id,status,last_leave_end",
      [today, id]
    );
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    await db.query(
      "UPDATE leaves SET return_confirmed=TRUE,return_confirmed_by=$1,return_confirmed_at=NOW(),status='completed' WHERE soldier_id=$2 AND status IN ('active','leave')",
      [req.user.id, id]
    ).catch(() => {});
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// WORKBOOK IMPORT ENGINE — Server-side Excel parsing + import
// ============================================================

app.post("/api/admin/import-workbook", auth, commanderOnly, upload.single("workbook"), async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: "يجب رفع ملف Excel (.xlsx)" });
    }

    const filename = req.file.originalname || "unknown.xlsx";
    const buffer = req.file.buffer;

    // Step 1: Parse workbook
    const engine = new WorkbookImportEngine();
    const parseResult = await engine.parse(buffer, filename);

    // Check for validation errors
    const criticalErrors = parseResult.errors.filter((e) => e.category === "VALIDATION");
    if (criticalErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "أخطاء في هيكل الملف",
        errors: parseResult.errors,
        processingTime: Date.now() - startTime,
      });
    }

    // Step2: Map to database
    const log = {
      weapons: 0, ranks: 0, specialties: 0,
      soldiersInserted: 0, soldiersUpdated: 0,
      sessionsInserted: 0, sessionsUpdated: 0,
      employeesDetected: 0, dateGroupsDetected: 0,
      worksheetsDetected: parseResult.analysis.worksheets.length,
      errors: [], warnings: parseResult.validation.warnings || [],
    };

    // Collect unique employees across all worksheets
    const employeeMap = {}; // serial -> { name, rank, soldierId }
    const allSessions = parseResult.sessions;

    for (const session of allSessions) {
      log.employeesDetected++;
      const serial = session.employeeSerial;
      if (serial && !employeeMap[serial]) {
        employeeMap[serial] = {
          name: session.employeeName,
          rank: session.employeeRank,
          soldierId: null,
        };
      }
      log.dateGroupsDetected++;
    }

    // Transaction: map employees → soldiers, insert sessions
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ensure soldiers exist for each employee
      for (const [serial, emp] of Object.entries(employeeMap)) {
        if (!serial || !emp.name) continue;

        // Check if soldier exists by military_id
        let existing = await client.query(
          "SELECT id FROM soldiers WHERE military_id = $1",
          [serial]
        );

        if (existing.rows.length > 0) {
          emp.soldierId = existing.rows[0].id;
          log.soldiersUpdated++;
        } else {
          // Find or create rank
          let rankId = null;
          if (emp.rank) {
            let r = await client.query("SELECT id FROM ranks WHERE name = $1", [emp.rank]);
            if (r.rows.length === 0) {
              r = await client.query("INSERT INTO ranks(name, sort_order) VALUES($1, 0) RETURNING id", [emp.rank]);
              log.ranks++;
            }
            rankId = r.rows[0].id;
          }

          const r = await client.query(
            "INSERT INTO soldiers(name, military_id, rank_id, status) VALUES($1, $2, $3, 'active') RETURNING id",
            [emp.name, serial, rankId]
          );
          emp.soldierId = r.rows[0].id;
          log.soldiersInserted++;
        }
      }

      // Insert assessment sessions (upsert by soldier_id + type + date)
      for (const session of allSessions) {
        const serial = session.employeeSerial;
        const emp = employeeMap[serial];
        if (!emp || !emp.soldierId) {
          log.errors.push({
            category: "DATABASE",
            description: `لم يتم العثور على الجندي بالرقم ${serial}`,
            employee: session.employeeName,
          });
          continue;
        }

        // Parse date
        let assessmentDate = null;
        if (session.date) {
          const dateStr = String(session.date).trim();
          // Try Excel serial date
          const serialNum = Number(dateStr);
          if (!isNaN(serialNum) && serialNum > 30000 && serialNum < 60000) {
            const d = new Date((serialNum - 25569) * 86400 * 1000);
            assessmentDate = d.toISOString().slice(0, 10);
          } else {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              assessmentDate = parsed.toISOString().slice(0, 10);
            }
          }
        }

        if (!assessmentDate) {
          log.errors.push({
            category: "DATA",
            description: `تاريخ غير صالح "${session.date}" للموظف ${session.employeeName}`,
          });
          continue;
        }

        // Upsert session
        let sessResult = await client.query(
          "SELECT id FROM assessment_sessions WHERE soldier_id=$1 AND session_type=$2 AND assessment_date=$3",
          [emp.soldierId, session.type, assessmentDate]
        );

        let sessionId;
        if (sessResult.rows.length > 0) {
          sessionId = sessResult.rows[0].id;
          // Update existing session
          await client.query(
            "UPDATE assessment_sessions SET worksheet_name=$1, workbook_filename=$2, imported_by=$3, updated_at=NOW() WHERE id=$4",
            [session.worksheetName, filename, req.user.id, sessionId]
          );
          // Clear old values
          await client.query("DELETE FROM assessment_values WHERE session_id=$1", [sessionId]);
          log.sessionsUpdated++;
        } else {
          sessResult = await client.query(
            "INSERT INTO assessment_sessions(soldier_id, session_type, assessment_date, worksheet_name, workbook_filename, imported_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
            [emp.soldierId, session.type, assessmentDate, session.worksheetName, filename, req.user.id]
          );
          sessionId = sessResult.rows[0].id;
          log.sessionsInserted++;
        }

        // Insert field values
        for (const [key, value] of Object.entries(session.fields)) {
          if (key.startsWith("_")) continue; // Skip internal fields
          if (value === null || value === undefined) continue;

          if (typeof value === "number") {
            await client.query(
              "INSERT INTO assessment_values(session_id, field_key, numeric_value) VALUES($1, $2, $3)",
              [sessionId, key, value]
            );
          } else {
            await client.query(
              "INSERT INTO assessment_values(session_id, field_key, text_value) VALUES($1, $2, $3)",
              [sessionId, key, String(value)]
            );
          }
        }
      }

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }

    // Write import log
    const processingTime = Date.now() - startTime;
    try {
      await pool.query(
        "INSERT INTO import_logs(filename, imported_by, imported_by_name, worksheets_detected, sessions_detected, sessions_inserted, sessions_updated, employees_detected, date_groups_detected, validation_errors, processing_time_ms, status, error_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          filename, req.user.id, req.user.name || "commander",
          log.worksheetsDetected, allSessions.length,
          log.sessionsInserted, log.sessionsUpdated,
          Object.keys(employeeMap).length, log.dateGroupsDetected,
          log.errors.length, processingTime, "success",
          JSON.stringify(log.errors),
        ]
      );
    } catch (e) { /* log errors are non-fatal */ }

    res.json({
      success: true,
      message: `✅ تم استيراد ${log.sessionsInserted} جلسة تقييم لـ ${Object.keys(employeeMap).length} فرد`,
      employeesDetected: Object.keys(employeeMap).length,
      employeesInserted: log.soldiersInserted,
      employeesUpdated: log.soldiersUpdated,
      sessionsInserted: log.sessionsInserted,
      sessionsUpdated: log.sessionsUpdated,
      dateGroupsDetected: log.dateGroupsDetected,
      worksheetsDetected: log.worksheetsDetected,
      ranks: log.ranks,
      validationErrors: log.errors.length,
      errors: log.errors,
      warnings: log.warnings,
      processingTime,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message,
      processingTime: Date.now() - startTime,
    });
  }
});

// ---- ASSESSMENT SESSIONS: list with filters ----
app.get("/api/assessments", auth, async (req, res) => {
  try {
    const { type, soldier_id, date_from, date_to, page = 1, limit = 50 } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (type) { where.push(`s.session_type = $${idx++}`); params.push(type); }
    if (soldier_id) { where.push(`s.soldier_id = $${idx++}`); params.push(soldier_id); }
    if (date_from) { where.push(`s.assessment_date >= $${idx++}`); params.push(date_from); }
    if (date_to) { where.push(`s.assessment_date <= $${idx++}`); params.push(date_to); }

    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(`SELECT COUNT(*) FROM assessment_sessions s ${w}`, params);
    const total = parseInt(countResult.rows[0].count);

    const { rows: sessions } = await pool.query(
      `SELECT s.*, sol.name as soldier_name, sol.military_id as soldier_military_id,
              r.name as soldier_rank_name, r.sort_order as soldier_rank_order
       FROM assessment_sessions s
       LEFT JOIN soldiers sol ON s.soldier_id = sol.id
       LEFT JOIN ranks r ON sol.rank_id = r.id
       ${w}
       ORDER BY s.assessment_date DESC, sol.name
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    // Fetch values for each session
    for (const session of sessions) {
      const { rows: values } = await pool.query(
        "SELECT field_key, numeric_value, text_value FROM assessment_values WHERE session_id = $1",
        [session.id]
      );
      session.values = {};
      for (const v of values) {
        session.values[v.field_key] = v.numeric_value !== null ? v.numeric_value : v.text_value;
      }
    }

    res.json({ sessions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- ASSESSMENT STATS: dashboard statistics ----
app.get("/api/assessments/stats", auth, async (req, res) => {
  try {
    const { type } = req.query;
    const typeFilter = type ? `WHERE s.session_type = $1` : "";
    const typeParams = type ? [type] : [];

    const [totalRes, byTypeRes, recentRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(DISTINCT soldier_id) as employees, COUNT(DISTINCT assessment_date) as dates FROM assessment_sessions s ${typeFilter}`, typeParams),
      pool.query(`SELECT session_type, COUNT(*) as count, COUNT(DISTINCT soldier_id) as employees FROM assessment_sessions GROUP BY session_type ORDER BY count DESC`),
      pool.query(`SELECT s.*, sol.name as soldier_name, sol.military_id as soldier_military_id
                  FROM assessment_sessions s LEFT JOIN soldiers sol ON s.soldier_id = sol.id
                  ${typeFilter}
                  ORDER BY s.created_at DESC LIMIT 10`, typeParams),
    ]);

    res.json({
      total: parseInt(totalRes.rows[0].total),
      employees: parseInt(totalRes.rows[0].employees),
      dates: parseInt(totalRes.rows[0].dates),
      byType: byTypeRes.rows.map(r => ({ type: r.session_type, count: parseInt(r.count), employees: parseInt(r.employees) })),
      recent: recentRes.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- ASSESSMENT BY SOLDIER: all sessions for one soldier ----
app.get("/api/assessments/soldier/:soldierId", auth, async (req, res) => {
  try {
    const { soldierId } = req.params;
    const { type } = req.query;
    let where = ["s.soldier_id = $1"];
    let params = [soldierId];
    let idx = 2;
    if (type) { where.push(`s.session_type = $${idx++}`); params.push(type); }

    const { rows: sessions } = await pool.query(
      `SELECT s.* FROM assessment_sessions s WHERE ${where.join(" AND ")} ORDER BY s.session_type, s.assessment_date DESC`,
      params
    );

    for (const session of sessions) {
      const { rows: values } = await pool.query(
        "SELECT field_key, numeric_value, text_value FROM assessment_values WHERE session_id = $1",
        [session.id]
      );
      session.values = {};
      for (const v of values) {
        session.values[v.field_key] = v.numeric_value !== null ? v.numeric_value : v.text_value;
      }
    }

    res.json({ sessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- ASSESSMENT DELETE ----
app.delete("/api/assessments/:id", auth, commanderOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("DELETE FROM assessment_sessions WHERE id=$1 RETURNING id", [id]);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- ASSESSMENT BULK DELETE ----
app.post("/api/assessments/bulk-delete", auth, commanderOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: "لا توجد معرفات" });
    const { rows } = await pool.query("DELETE FROM assessment_sessions WHERE id = ANY($1::uuid[]) RETURNING id", [ids]);
    res.json({ deleted: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- IMPORT LOGS ----
app.get("/api/import-logs", auth, commanderOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM import_logs ORDER BY created_at DESC LIMIT 50"
    );
    res.json({ logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// TEST RESULTS IMPORT — Parse file + temp_id + intra-run dedup + fuzzy flagging
// ============================================================

/**
 * POST /api/admin/import-test-results
 * Step 1 (review): Parse file, match against DB + intra-run temp_ids, flag fuzzy duplicates.
 * Returns review data — does NOT save anything.  Saving happens in confirm-test-results.
 *
 * Match priority:
 *   1. Exact normalized name match against existing DB soldiers
 *   2. Exact normalized name match against temp_ids created in THIS run (intra-run merge)
 *   3. Fuzzy ≥90% against temp_ids in this run → flagged for manual review
 *   4. Create new temp_id record
 */
app.post("/api/admin/import-test-results", auth, commanderOnly, upload.single("workbook"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "يجب رفع ملف Excel (.xlsx)" });
    }

    const parseResult = await parseTestResults(req.file.buffer);

    if (parseResult.totalCount === 0) {
      return res.status(400).json({
        success: false,
        error: "لم يتم استخراج أي نتائج من الملف",
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      });
    }

    const { normalizeArabic } = require("./name-matcher");
    const stringSimilarity = require("string-similarity");
    const crypto = require("crypto");

    // Fetch all existing soldiers (including temp_id)
    const { rows: soldiers } = await pool.query(
      "SELECT s.id, s.name, s.military_id, s.temp_id, r.name as rank_name FROM soldiers s LEFT JOIN ranks r ON s.rank_id = r.id"
    );

    // Build normalized name → soldier(s) lookup for existing DB
    const normMap = new Map();
    for (const s of soldiers) {
      const key = normalizeArabic(s.name);
      if (!key) continue;
      if (!normMap.has(key)) normMap.set(key, []);
      normMap.get(key).push(s);
    }

    // Track temp_ids created during this import run
    const runTempIds = new Map(); // normName → { temp_id, name }

    const results = [];
    const stats = { matchedExisting: 0, intraRunMerged: 0, fuzzyFlagged: 0, newTempIds: 0, noMatch: 0 };

    for (const r of parseResult.results) {
      const normName = normalizeArabic(r.name);
      if (!normName) {
        results.push({ ...r, match_status: "no_match", reason: "اسم فارغ" });
        stats.noMatch++;
        continue;
      }

      // 1. Exact match against existing DB soldiers
      const dbMatches = normMap.get(normName) || [];
      if (dbMatches.length === 1) {
        const soldier = dbMatches[0];
        results.push({
          ...r,
          match_status: "existing",
          soldier_id: soldier.id,
          soldier_name: soldier.name,
          soldier_military_id: soldier.military_id,
          soldier_temp_id: soldier.temp_id,
          detected_specialty: r.detected_specialty || null,
          detected_color_hex: r.detected_color_hex || null,
        });
        stats.matchedExisting++;
        continue;
      }
      if (dbMatches.length > 1) {
        results.push({
          ...r,
          match_status: "ambiguous",
          reason: `يوجد ${dbMatches.length} أسماء مطابقة: ${dbMatches.map(m => m.name).join(", ")}`,
          detected_specialty: r.detected_specialty || null,
          detected_color_hex: r.detected_color_hex || null,
        });
        stats.noMatch++;
        continue;
      }

      // 2. Exact match against temp_ids created in THIS run
      if (runTempIds.has(normName)) {
        const existing = runTempIds.get(normName);
        results.push({
          ...r,
          match_status: "intra_run_merge",
          temp_id: existing.temp_id,
          detected_specialty: r.detected_specialty || null,
          detected_color_hex: r.detected_color_hex || null,
        });
        stats.intraRunMerged++;
        continue;
      }

      // 3. Fuzzy match ≥90% against temp_ids in this run
      const runNames = [...runTempIds.keys()];
      if (runNames.length > 0) {
        const bestMatch = stringSimilarity.findBestMatch(normName, runNames);
        const bestRating = bestMatch.bestMatch.rating;
        if (bestRating >= 0.90) {
          const bestRunName = bestMatch.bestMatch.target;
          const matched = runTempIds.get(bestRunName);
          results.push({
            ...r,
            match_status: "fuzzy_flagged",
            fuzzy_candidate: {
              name: matched.name,
              temp_id: matched.temp_id,
              similarity: Math.round(bestRating * 1000) / 10,
            },
            detected_specialty: r.detected_specialty || null,
            detected_color_hex: r.detected_color_hex || null,
          });
          stats.fuzzyFlagged++;
          continue;
        }
      }

      // 4. Create new temp_id
      const tempId = "TMP-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      runTempIds.set(normName, { temp_id: tempId, name: r.name });
      results.push({
        ...r,
        match_status: "new",
        temp_id: tempId,
        detected_specialty: r.detected_specialty || null,
        detected_color_hex: r.detected_color_hex || null,
      });
      stats.newTempIds++;
    }

    res.json({
      success: true,
      summary: {
        totalParsed: parseResult.totalCount,
        matchedExisting: stats.matchedExisting,
        intraRunMerged: stats.intraRunMerged,
        fuzzyFlagged: stats.fuzzyFlagged,
        newTempIds: stats.newTempIds,
        noMatch: stats.noMatch,
        sheetsDetected: parseResult.sheets.length,
      },
      results,
      sheets: parseResult.sheets,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
    });
  } catch (e) {
    console.error("import-test-results error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/admin/confirm-test-results
 * Step 2: Receive confirmed review data and save to DB.
 *
 * Body: { results: [...], merges?: [...], specialty_confirmations?: [...] }
 *
 * Each result has:
 *   - match_status: "existing" | "new" | "intra_run_merge" | "fuzzy_flagged" (merged)
 *   - soldier_id: for existing matches
 *   - temp_id: for new / intra_run_merge
 *   - name, rank_from_file, test_date, test_type, score_details
 *   - detected_specialty: from color extraction (optional)
 *
 * merges: array of { source_name, target_temp_id } — user confirmed fuzzy merge
 * specialty_confirmations: array of { soldier_id | temp_id, specialty } — user accepted/edited
 */
app.post("/api/admin/confirm-test-results", auth, commanderOnly, async (req, res) => {
  try {
    const { results, merges, specialty_confirmations } = req.body;
    if (!results || !results.length) {
      return res.status(400).json({ error: "لا توجد نتائج للحفظ" });
    }

    const crypto = require("crypto");

    // Build merge map: source_name → target_temp_id
    const mergeMap = new Map();
    if (merges && merges.length) {
      for (const m of merges) {
        if (m.source_name && m.target_temp_id) {
          mergeMap.set(normalizeArabic(m.source_name), m.target_temp_id);
        }
      }
    }

    // Build specialty map
    const specialtyMap = new Map();
    if (specialty_confirmations && specialty_confirmations.length) {
      for (const sc of specialty_confirmations) {
        const key = sc.soldier_id || sc.temp_id;
        if (key && sc.specialty) specialtyMap.set(key, sc.specialty);
      }
    }

    const { normalizeArabic } = require("./name-matcher");

    // Collect unique temp_ids that need new soldier records
    const tempIdSoldiers = new Map(); // temp_id → { name, rank_from_file, detected_specialty }
    for (const r of results) {
      if (r.match_status === "new" && r.temp_id) {
        if (!tempIdSoldiers.has(r.temp_id)) {
          tempIdSoldiers.set(r.temp_id, {
            name: r.name,
            rank_from_file: r.rank_from_file,
            detected_specialty: r.detected_specialty,
          });
        }
      }
      // Handle fuzzy_flagged that user chose to merge
      if (r.match_status === "fuzzy_flagged" && r.temp_id) {
        if (!tempIdSoldiers.has(r.temp_id)) {
          tempIdSoldiers.set(r.temp_id, {
            name: r.name,
            rank_from_file: r.rank_from_file,
            detected_specialty: r.detected_specialty,
          });
        }
      }
    }

    let sessionsInserted = 0;
    let sessionsUpdated = 0;
    let valuesInserted = 0;
    let soldiersCreated = 0;
    const errors = [];
    const createdSoldiers = []; // { temp_id, soldier_id, name }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create temp_id soldier records
      for (const [tempId, info] of tempIdSoldiers) {
        try {
          // Resolve rank_id from rank name
          let rankId = null;
          if (info.rank_from_file) {
            const rankRes = await client.query("SELECT id FROM ranks WHERE name = $1 LIMIT 1", [info.rank_from_file]);
            if (rankRes.rows.length > 0) rankId = rankRes.rows[0].id;
          }

          const specialty = specialtyMap.get(tempId) || info.detected_specialty || null;
          const insRes = await client.query(
            "INSERT INTO soldiers(name, temp_id, rank_id, specific_specialty) VALUES($1, $2, $3, $4) RETURNING id, temp_id, name",
            [info.name, tempId, rankId, specialty]
          );
          createdSoldiers.push({ temp_id: tempId, soldier_id: insRes.rows[0].id, name: info.name });
          soldiersCreated++;
        } catch (e) {
          errors.push({ temp_id: tempId, error: e.message });
        }
      }

      // Build temp_id → soldier_id lookup (both newly created and pre-existing)
      const tempIdToSoldierId = new Map();
      for (const cs of createdSoldiers) {
        tempIdToSoldierId.set(cs.temp_id, cs.soldier_id);
      }
      // Also look up existing soldiers that already have temp_ids
      const allTempIds = [...tempIdSoldiers.keys()];
      if (allTempIds.length > 0) {
        const existingRes = await client.query(
          "SELECT id, temp_id FROM soldiers WHERE temp_id = ANY($1::text[])",
          [allTempIds]
        );
        for (const row of existingRes.rows) {
          if (!tempIdToSoldierId.has(row.temp_id)) {
            tempIdToSoldierId.set(row.temp_id, row.id);
          }
        }
      }

      // Apply specialty confirmations to existing soldiers
      for (const sc of (specialty_confirmations || [])) {
        if (sc.soldier_id && sc.specialty) {
          try {
            await client.query("UPDATE soldiers SET specific_specialty = $1 WHERE id = $2", [sc.specialty, sc.soldier_id]);
          } catch (e) { /* non-fatal */ }
        }
      }

      // Save assessment sessions + values
      for (const result of results) {
        try {
          // Resolve soldier_id
          let soldierId = result.soldier_id || null;
          if (!soldierId && result.temp_id) {
            soldierId = tempIdToSoldierId.get(result.temp_id);
          }

          // Handle merge: fuzzy_flagged results that user confirmed to merge
          if (result.match_status === "fuzzy_flagged" && result.fuzzy_candidate) {
            const fuzzyNorm = normalizeArabic(result.fuzzy_candidate.name);
            const targetTempId = mergeMap.get(fuzzyNorm) || result.fuzzy_candidate.temp_id;
            soldierId = tempIdToSoldierId.get(targetTempId) || soldierId;
          }

          if (!soldierId || !result.test_date || !result.test_type || !result.score_details) {
            errors.push({ name: result.name, error: "بيانات ناقصة — لا يمكن الحفظ" });
            continue;
          }

          // Upsert session (unique on soldier_id + type + date)
          let sessResult = await client.query(
            "SELECT id FROM assessment_sessions WHERE soldier_id=$1 AND session_type=$2 AND assessment_date=$3",
            [soldierId, result.test_type, result.test_date]
          );

          let sessionId;
          if (sessResult.rows.length > 0) {
            sessionId = sessResult.rows[0].id;
            await client.query(
              "UPDATE assessment_sessions SET worksheet_name=$1, workbook_filename=$2, imported_by=$3, updated_at=NOW() WHERE id=$4",
              [`${result.test_type}_results`, "test-results-import", req.user.id, sessionId]
            );
            await client.query("DELETE FROM assessment_values WHERE session_id=$1", [sessionId]);
            sessionsUpdated++;
          } else {
            sessResult = await client.query(
              "INSERT INTO assessment_sessions(soldier_id, session_type, assessment_date, worksheet_name, workbook_filename, imported_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
              [soldierId, result.test_type, result.test_date, `${result.test_type}_results`, "test-results-import", req.user.id]
            );
            sessionId = sessResult.rows[0].id;
            sessionsInserted++;
          }

          for (const [key, value] of Object.entries(result.score_details)) {
            if (value === null || value === undefined) continue;
            if (typeof value === "number") {
              await client.query(
                "INSERT INTO assessment_values(session_id, field_key, numeric_value) VALUES($1, $2, $3)",
                [sessionId, key, value]
              );
            } else {
              await client.query(
                "INSERT INTO assessment_values(session_id, field_key, text_value) VALUES($1, $2, $3)",
                [sessionId, key, String(value)]
              );
            }
            valuesInserted++;
          }
        } catch (e) {
          errors.push({ name: result.name, error: e.message });
        }
      }

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }

    // Log
    try {
      await pool.query(
        "INSERT INTO import_logs(filename, imported_by, imported_by_name, worksheets_detected, sessions_detected, sessions_inserted, sessions_updated, employees_detected, date_groups_detected, validation_errors, processing_time_ms, status, error_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          "test-results-import", req.user.id, req.user.name || "commander",
          0, results.length, sessionsInserted, sessionsUpdated,
          soldiersCreated, 0, errors.length, 0, "success",
          JSON.stringify(errors.slice(0, 50)),
        ]
      );
    } catch (e) { /* non-fatal */ }

    res.json({
      success: true,
      message: `تم حفظ ${sessionsInserted} جلسة جديدة وتحديث ${sessionsUpdated} جلسة موجودة وإنشاء ${soldiersCreated} فرد جديد`,
      soldiersCreated,
      createdSoldiers,
      sessionsInserted,
      sessionsUpdated,
      valuesInserted,
      errors,
    });
  } catch (e) {
    console.error("confirm-test-results error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled:", err?.message || err);
  res.status(500).json({ error: err?.message || "حدث خطأ غير متوقع" });
});

module.exports = app;
if (typeof process.env.VERCEL === "undefined") {
  const port = process.env.PORT || 3001;
  app.listen(port, async () => {
    console.log(`API running on http://localhost:${port}`);
  });
}
