-- ================================================
-- BATTALION 20 - ADD-ONLY (آمن على بياناتك)
-- ================================================

-- 1. أعمدة ناقصة في users
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_id UUID REFERENCES ranks(id) ON DELETE SET NULL;

-- 2. أعمدة ناقصة في soldiers
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS military_number VARCHAR(60);
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS specific_specialty VARCHAR(200);
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'نشط';
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS status_notes TEXT;
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS last_leave_end DATE;
ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS enlistment_date DATE;

-- 3. أعمدة ناقصة في specialties
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE specialties ALTER COLUMN weapon_id DROP NOT NULL;

-- 4. أعمدة ناقصة في results
ALTER TABLE results ADD COLUMN IF NOT EXISTS fitness_score NUMERIC(6,2);
ALTER TABLE results ADD COLUMN IF NOT EXISTS specialty_score NUMERIC(6,2);
ALTER TABLE results ADD COLUMN IF NOT EXISTS discipline_score NUMERIC(6,2);
ALTER TABLE results ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS flag VARCHAR(20) DEFAULT 'normal';

-- 5. أعمدة ناقصة في ranks
ALTER TABLE ranks ADD COLUMN IF NOT EXISTS level SMALLINT;
UPDATE ranks SET level = sort_order WHERE level IS NULL;
ALTER TABLE ranks ALTER COLUMN level SET NOT NULL;

-- 6. أعمدة ناقصة في notifications (الجدول موجود من قبل)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_result_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_role VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- 7. أعمدة ناقصة في exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS section_key VARCHAR(50);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS focus_points TEXT[] DEFAULT '{}';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_score NUMERIC(5,2) DEFAULT 100;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 8. أعمدة ناقصة في announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 9. جدول sections
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

-- 10. جدول evaluations
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

-- 11. جدول distinctions
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

-- 12. جدول punishments
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

-- 13. جدول distinction_confirmations
CREATE TABLE IF NOT EXISTS distinction_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distinction_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (distinction_id, user_id)
);

-- 14. جدول push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- 15. جدول leaves
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  leave_type VARCHAR(50) DEFAULT 'regular', notes TEXT,
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
