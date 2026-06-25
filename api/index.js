require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const serverless = require("serverless-http");

const isProd = process.env.NODE_ENV === "production";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    ? process.env.DATABASE_URL.split("?")[0]
    : undefined,
  ...(isProd ? { ssl: { rejectUnauthorized: false } } : {}),
  max: 5,
});
const db = { query: (text, params) => pool.query(text, params), pool };

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

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/.netlify/functions/api"))
    req.url = "/api" + req.url.substring("/.netlify/functions/api".length);
  next();
});

app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);
app.get("/api", (req, res) =>
  res.json({ ok: true, name: "Battalion 20 API", version: "3.0.0" }),
);

// AUTH
const er = express.Router();
er.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "يرجى إدخال البيانات" });
    const { rows } = await db.query(
      "SELECT u.id,u.name,u.username,u.password_hash,u.role,u.is_active,u.created_at,u.rank_id,u.permissions,u.avatar_url,r.name rank_name,r.sort_order rank_order FROM users u LEFT JOIN ranks r ON r.id=u.rank_id::uuid WHERE u.username=$1 AND u.is_active=true",
      [username],
    );
    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    )
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
      "SELECT s.*,r.name rank_name,r.sort_order rank_order,rt.name rank_type,rt.color rank_color,w.name weapon_name,w.icon weapon_icon,sp.name specialty_name FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN rank_types rt ON rt.id=r.type_id LEFT JOIN weapons w ON w.id=s.weapon_id LEFT JOIN specialties sp ON sp.id=s.specialty_id WHERE 1=1";
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
    let sql = "SELECT COUNT(*) total_soldiers,ROUND(AVG(score),1) avg_score,COUNT(*) total_evals,MAX(score) max_score FROM evaluations WHERE section_key=$1";
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
    const { rows: soldiers } = await pool.query("SELECT s.id,s.name,s.status,r.name rank_name,ROUND(AVG(res.total_score),1) avg_score,COUNT(res.id) eval_count,s.created_at assigned_at FROM soldiers s LEFT JOIN ranks r ON r.id=s.rank_id LEFT JOIN results res ON res.soldier_id=s.id WHERE s.specialty_id=$1 GROUP BY s.id,r.name ORDER BY s.name", [req.params.id]);
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
          "SELECT * FROM ranks WHERE type_id=$1 ORDER BY sort_order",
          [typeId],
        )
      : await db.query("SELECT * FROM ranks ORDER BY sort_order");
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
app.use("/api/ranks", rk);

// EXAMS
const ex = express.Router();
ex.get("/", auth, async (req, res) => {
  try {
    const { type, weaponId } = req.query;
    const { rows } = await db.query(
      "SELECT e.*,w.name weapon_name,w.icon weapon_icon,sp.name specialty_name,COUNT(DISTINCT ei.id)::int item_count,COUNT(DISTINCT r.id)::int result_count,ROUND(AVG(r.total_score),1) avg_score FROM exams e LEFT JOIN weapons w ON w.id=e.weapon_id LEFT JOIN specialties sp ON sp.id=e.specialty_id LEFT JOIN exam_items ei ON ei.exam_id=e.id LEFT JOIN results r ON r.exam_id=e.id WHERE($1::text IS NULL OR e.type=$1::text)AND($2::uuid IS NULL OR e.weapon_id=$2::uuid) GROUP BY e.id,w.name,w.icon,sp.name ORDER BY e.created_at DESC",
      [type || null, weaponId || null],
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
      "SELECT e.*,w.name weapon_name,w.icon weapon_icon,w.color weapon_color,sp.name specialty_name FROM exams e LEFT JOIN weapons w ON w.id=e.weapon_id LEFT JOIN specialties sp ON sp.id=e.specialty_id WHERE e.id=$1",
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
    const { title, sectionKey, type, weaponId, specialtyId, focusPoints, items, notes, maxScore } = req.body;
    if (!title) return res.status(400).json({ error: "يرجى إدخال البيانات" });
    const examType = sectionKey || type || "general";
    const { rows } = await db.query(
      "INSERT INTO exams(title,type,weapon_id,specialty_id,focus_points,max_score,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [title, examType, weaponId || null, specialtyId || null, focusPoints || null, maxScore || 100, notes || null, req.user.id],
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
    const { title, sectionKey, type, weaponId, specialtyId, focusPoints, notes, maxScore } = req.body;
    const examType = sectionKey || type || "general";
    const { rows } = await db.query(
      "UPDATE exams SET title=$1,type=$2,weapon_id=$3,specialty_id=$4,focus_points=$5,max_score=$6,notes=$7 WHERE id=$8 RETURNING *",
      [title, examType, weaponId || null, specialtyId || null, focusPoints || null, maxScore || 100, notes || null, req.params.id],
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
      "INSERT INTO announcements(title,body,priority,created_by)VALUES($1,$2,$3,$4)RETURNING *",
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
    const { rows } = await db.query("UPDATE announcements SET title=$1,body=$2,priority=$3 WHERE id=$4 RETURNING *", [title, text, priority, req.params.id]);
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
    await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
    await pool.query("INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth)VALUES($1,$2,$3,$4)", [req.user.id, endpoint, keys.p256dh, keys.auth]);
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
    let sql = "SELECT l.*,s.name soldier_name,s.military_number FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE 1=1";
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
    const total = await pool.query("SELECT COUNT(*) FROM soldiers WHERE is_active=TRUE");
    const onLeave = await pool.query("SELECT COUNT(*) FROM soldiers WHERE status='إجازة' AND is_active=TRUE");
    const needingLeave = await pool.query("SELECT COUNT(*) FROM soldiers s WHERE s.is_active=TRUE AND (s.status IS DISTINCT FROM 'إجازة') AND CURRENT_DATE-COALESCE((SELECT MAX(l.end_date) FROM leaves l WHERE l.soldier_id=s.id AND l.status='active'),s.last_leave_end,s.enlistment_date,s.created_at::date)>21");
    const returningToday = await pool.query("SELECT COUNT(*) FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' AND l.end_date=CURRENT_DATE AND l.return_confirmed=FALSE");
    const statusDist = await pool.query("SELECT status,COUNT(*)::int as count FROM soldiers WHERE is_active=TRUE GROUP BY status");
    const monthlyStats = await pool.query("SELECT TO_CHAR(start_date,'YYYY-MM') as month,COUNT(*) as leaves_count FROM leaves WHERE start_date>=CURRENT_DATE-INTERVAL'12 months' GROUP BY TO_CHAR(start_date,'YYYY-MM') ORDER BY month");
    const upcomingReturns = await pool.query("SELECT l.*,s.name soldier_name,s.military_number,(l.end_date-CURRENT_DATE) as days_remaining FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' AND l.return_confirmed=FALSE AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 ORDER BY l.end_date ASC");
    res.json({
      total: parseInt(total.rows[0].count), onLeave: parseInt(onLeave.rows[0].count),
      needingLeave: parseInt(needingLeave.rows[0].count), returningToday: parseInt(returningToday.rows[0].count),
      statusDistribution: statusDist.rows, monthlyStats: monthlyStats.rows, upcomingReturns: upcomingReturns.rows,
      activeLeaves: 0, overdueReturn: 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/active", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT l.*,s.name soldier_name,s.military_number,(l.end_date-CURRENT_DATE) as remaining_days FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' ORDER BY l.end_date ASC");
    res.json({ leaves: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/overdue-return", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT l.*,s.name soldier_name,s.military_number,(CURRENT_DATE-l.end_date) as overdue_days FROM leaves l JOIN soldiers s ON l.soldier_id=s.id WHERE l.status='active' AND l.end_date<CURRENT_DATE AND l.return_confirmed=FALSE ORDER BY l.end_date ASC");
    res.json({ leaves: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.get("/needing-leave", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM (SELECT s.id,s.name,s.military_number,s.status as soldier_status,r.name as rank_name,COALESCE((SELECT MAX(l.end_date) FROM leaves l WHERE l.soldier_id=s.id AND l.status='active'),s.last_leave_end,s.enlistment_date,s.created_at::date) as last_leave,CURRENT_DATE-COALESCE((SELECT MAX(l.end_date) FROM leaves l WHERE l.soldier_id=s.id AND l.status='active'),s.last_leave_end,s.enlistment_date,s.created_at::date) as days_since_leave FROM soldiers s LEFT JOIN ranks r ON s.rank_id=r.id WHERE s.is_active=TRUE AND (s.status IS DISTINCT FROM 'إجازة')) sub WHERE days_since_leave>21 ORDER BY days_since_leave DESC");
    res.json({ soldiers: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.post("/", auth, async (req, res) => {
  try {
    const { soldier_id, start_date, end_date, notes } = req.body;
    if (!soldier_id || !start_date || !end_date) return res.status(400).json({ error: "missing fields" });
    const { rows } = await pool.query("INSERT INTO leaves(soldier_id,start_date,end_date,notes,confirmed_by)VALUES($1,$2,$3,$4,$5)RETURNING *", [soldier_id, start_date, end_date, notes||null, req.user.id]);
    await pool.query("UPDATE soldiers SET status='إجازة',last_leave_end=$1 WHERE id=$2", [end_date, soldier_id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.patch("/:id/confirm-return", auth, async (req, res) => {
  try {
    const leave = await pool.query("SELECT * FROM leaves WHERE id=$1", [req.params.id]);
    if (!leave.rows.length) return res.status(404).json({ error: "غير موجود" });
    const { rows } = await pool.query("UPDATE leaves SET return_confirmed=TRUE,return_confirmed_by=$1,return_confirmed_at=NOW(),status='completed' WHERE id=$2 RETURNING *", [req.user.id, req.params.id]);
    await pool.query("UPDATE soldiers SET status='نشط' WHERE id=$1", [leave.rows[0].soldier_id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
lv.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const leave = await pool.query("SELECT * FROM leaves WHERE id=$1", [req.params.id]);
    if (!leave.rows.length) return res.status(404).json({ error: "غير موجود" });
    const { rows } = await pool.query("UPDATE leaves SET status='cancelled' WHERE id=$1 RETURNING *", [req.params.id]);
    await pool.query("UPDATE soldiers SET status='نشط' WHERE id=$1 AND status='إجازة'", [leave.rows[0].soldier_id]);
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
app.use("/api/users", us);

// ADMIN (seed data)
app.post("/api/admin/seed", auth, commanderOnly, async (req, res) => {
  try {
    await db.query(
      "INSERT INTO weapons(name,icon)VALUES('المشاة','🔫'),('المدرعات','🛡️'),('المدفعية','💣'),('الإشارة','📡'),('المهندسين','🔧') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO rank_types(name,color)VALUES('ضباط','#C9A84C'),('صف ضباط','#9CAF88'),('جنود','#2D6A4F') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "WITH rt AS (SELECT id FROM rank_types WHERE name='ضباط' LIMIT 1), srt AS (SELECT id FROM rank_types WHERE name='صف ضباط' LIMIT 1), jrt AS (SELECT id FROM rank_types WHERE name='جنود' LIMIT 1) INSERT INTO ranks(name,type_id,sort_order) SELECT * FROM (VALUES('جندي',(SELECT id FROM jrt),1),('جندي أول',(SELECT id FROM jrt),2),('عريف',(SELECT id FROM srt),3),('وكيل رقيب',(SELECT id FROM srt),4),('رقيب',(SELECT id FROM srt),5),('رقيب أول',(SELECT id FROM srt),6),('مساعد',(SELECT id FROM srt),7),('مساعد أول',(SELECT id FROM srt),8),('ملازم',(SELECT id FROM rt),9),('ملازم أول',(SELECT id FROM rt),10),('نقيب',(SELECT id FROM rt),11),('رائد',(SELECT id FROM rt),12),('مقدم',(SELECT id FROM rt),13),('عقيد',(SELECT id FROM rt),14)) AS v WHERE NOT EXISTS(SELECT 1 FROM ranks)",
    );
    await db.query(
      "INSERT INTO specialties(name,weapon_id)SELECT 'قناص',(SELECT id FROM weapons WHERE name='المشاة' LIMIT 1) WHERE EXISTS(SELECT 1 FROM weapons)",
    );
    await db.query(
      "INSERT INTO soldiers(name,military_id,rank_id,weapon_id,specialty_id)SELECT 'جندي تجريبي','12345',(SELECT id FROM ranks WHERE name='جندي' LIMIT 1),(SELECT id FROM weapons WHERE name='المشاة' LIMIT 1),(SELECT id FROM specialties LIMIT 1) WHERE EXISTS(SELECT 1 FROM weapons)",
    );
    await db.query(
      "INSERT INTO exams(type,title,weapon_id)SELECT 'لياقة','اختبار تجريبي',(SELECT id FROM weapons LIMIT 1) WHERE EXISTS(SELECT 1 FROM weapons)",
    );
    await db.query(
      "INSERT INTO announcements(title,body,priority,created_by)SELECT 'مرحباً','المنصة جاهزة للعمل','info',(SELECT id FROM users WHERE role='commander' LIMIT 1)",
    );
    res.json({ message: "✅ تم إضافة بيانات تجريبية" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled:", err);
  res.status(500).json({ error: "حدث خطأ غير متوقع" });
});

if (process.env.VERCEL === '1') {
  runMigrations().catch(e => console.error("Migration:", e.message));
  module.exports = serverless(app);
} else {
  let cachedHandler;
  exports.handler = async (event, context) => {
    if (!cachedHandler) {
      try {
        await runMigrations();
      } catch (e) {
        console.error("Migration:", e.message);
      }
      cachedHandler = serverless(app);
    }
    return cachedHandler(event, context);
  };
}
