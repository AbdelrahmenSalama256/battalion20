-- ================================================
-- BATTALION 20 - COMPLETE DATABASE SCHEMA
-- تشغيل مرة واحدة في Supabase SQL Editor
-- ================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- 1. BASE TABLES (Ranks, Weapons, Specialties)
-- ================================================

CREATE TABLE IF NOT EXISTS rank_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  color VARCHAR(7) DEFAULT '#c9a84c',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES rank_types(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  sort_order SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weapons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#2d6a4f',
  icon VARCHAR(10) DEFAULT '⚔️',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weapon_id UUID REFERENCES weapons(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- ================================================
-- 2. USERS
-- ================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('commander','officer','nco')) DEFAULT 'officer',
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '{}',
  avatar_url TEXT,
  rank_id UUID REFERENCES ranks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 3. SOLDIERS
-- ================================================

CREATE TABLE IF NOT EXISTS soldiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  military_id VARCHAR(60),
  military_number VARCHAR(60),
  rank_id UUID REFERENCES ranks(id) ON DELETE SET NULL,
  weapon_id UUID REFERENCES weapons(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
  specific_specialty VARCHAR(200),
  status VARCHAR(50) DEFAULT 'نشط',
  status_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_leave_end DATE,
  enlistment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 4. SECTIONS (Fixed 5)
-- ================================================

CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  sort_order INT DEFAULT 0
);

INSERT INTO sections (key, name, icon, sort_order) VALUES
  ('specialties', 'التخصصات', '🎯', 1),
  ('general', 'العام', '📋', 2),
  ('fitness', 'اللياقة', '💪', 3),
  ('shooting', 'الرماية', '🔫', 4),
  ('discipline', 'الانضباط', '🎖️', 5)
ON CONFLICT (key) DO NOTHING;

-- ================================================
-- 5. EVALUATIONS, DISTINCTIONS, PUNISHMENTS
-- ================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  section_key VARCHAR(50) NOT NULL,
  specialty_id UUID REFERENCES specialties(id),
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) DEFAULT 100,
  notes TEXT,
  evaluated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evaluations_soldier ON evaluations(soldier_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_section ON evaluations(section_key);

CREATE TABLE IF NOT EXISTS distinctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  section_key VARCHAR(50) NOT NULL,
  specialty_id UUID REFERENCES specialties(id),
  reason TEXT NOT NULL,
  color VARCHAR(20) DEFAULT 'gold',
  given_by UUID REFERENCES users(id),
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_distinctions_soldier ON distinctions(soldier_id);

CREATE TABLE IF NOT EXISTS punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  section_key VARCHAR(50) NOT NULL,
  specialty_id UUID REFERENCES specialties(id),
  reason TEXT NOT NULL,
  color VARCHAR(20) DEFAULT 'red',
  given_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_punishments_soldier ON punishments(soldier_id);

CREATE TABLE IF NOT EXISTS distinction_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distinction_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (distinction_id, user_id)
);

-- ================================================
-- 6. EXAMS (New system)
-- ================================================

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  section_key VARCHAR(50),
  focus_points TEXT[] DEFAULT '{}',
  max_score NUMERIC(5,2) DEFAULT 100,
  weapon_id UUID REFERENCES weapons(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 7. NOTIFICATIONS
-- ================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  message TEXT,
  type VARCHAR(50) DEFAULT 'evaluation',
  evaluator_id UUID,
  evaluator_name VARCHAR(120),
  evaluated_id UUID,
  evaluated_name VARCHAR(150),
  fitness_score NUMERIC(6,2),
  specialty_score NUMERIC(6,2),
  discipline_score NUMERIC(6,2),
  total_score NUMERIC(6,2),
  related_result_id UUID,
  target_role VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ================================================
-- 8. PUSH SUBSCRIPTIONS
-- ================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ================================================
-- 9. LEAVES (Personnel Office)
-- ================================================

CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(50) DEFAULT 'regular',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  return_confirmed BOOLEAN DEFAULT FALSE,
  return_confirmed_by UUID REFERENCES users(id),
  return_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaves_soldier_id ON leaves(soldier_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_end_date ON leaves(end_date);

-- ================================================
-- 10. ANNOUNCEMENTS (Recreated if needed)
-- ================================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 11. OLD TABLES (Deprecated - kept for data)
-- ================================================

ALTER TABLE IF EXISTS results RENAME TO results_deprecated;
ALTER TABLE IF EXISTS exams RENAME TO exams_deprecated;
ALTER TABLE IF EXISTS exam_items RENAME TO exam_items_deprecated;
ALTER TABLE IF EXISTS fitness_exercises RENAME TO fitness_exercises_deprecated;
ALTER TABLE IF EXISTS fitness_results RENAME TO fitness_results_deprecated;
ALTER TABLE IF EXISTS result_item_scores RENAME TO result_item_scores_deprecated;
ALTER TABLE IF EXISTS announcements RENAME TO announcements_deprecated;

-- ================================================
-- SEED DATA
-- ================================================

INSERT INTO users (name, username, password_hash, role)
SELECT 'القائد','commander','$2a$10$.0G9qD/IV4fNuVv9firbVuN7yIq3XZ3IOX5NvDaby4LiWaLaJzLpi','commander'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='commander');

INSERT INTO rank_types (name,color) VALUES
  ('عسكري','#5a6845'),('صف ضابط','#8a6d1f'),('ضابط','#c9a84c')
ON CONFLICT DO NOTHING;

INSERT INTO ranks (type_id, name, sort_order)
SELECT id, r.name, r.ord FROM rank_types rt
CROSS JOIN (VALUES
  ('عسكري','جندي',1),('عسكري','جندي أول',2),('عسكري','عريف',3),
  ('صف ضابط','وكيل رقيب',4),('صف ضابط','رقيب',5),('صف ضابط','رقيب أول',6),
  ('صف ضابط','مساعد',7),('صف ضابط','مساعد أول',8),
  ('ضابط','ملازم',9),('ضابط','ملازم أول',10),('ضابط','نقيب',11),
  ('ضابط','رائد',12),('ضابط','مقدم',13),('ضابط','عقيد',14)
) AS r(type_name, name, ord)
WHERE rt.name = r.type_name
AND NOT EXISTS (SELECT 1 FROM ranks);
