CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE IF EXISTS users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'director', 'karyawan'));

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id VARCHAR(100) UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'manager', 'director', 'karyawan')),
  unit VARCHAR(150),
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  unit VARCHAR(150) NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'Aktif',
  description TEXT,
  change_summary TEXT,
  revision_note TEXT,
  effective_date DATE,
  review_date DATE,
  file_name VARCHAR(255),
  file_path TEXT,
  file_type VARCHAR(150),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, version)
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'Aktif';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision_note TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_date DATE;

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  stage_number SMALLINT NOT NULL DEFAULT 1,
  stage_name VARCHAR(100) NOT NULL DEFAULT 'GCG & Internal Audit',
  approver_role VARCHAR(30) NOT NULL DEFAULT 'admin',
  decision VARCHAR(30) NOT NULL,
  comment TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  stage_number SMALLINT NOT NULL CHECK (stage_number BETWEEN 1 AND 3),
  stage_name VARCHAR(100) NOT NULL,
  required_role VARCHAR(30) NOT NULL CHECK (required_role IN ('admin', 'manager', 'director')),
  approver_user_id UUID REFERENCES users(id),
  decision VARCHAR(30) NOT NULL DEFAULT 'Menunggu',
  comment TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  required_count SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (document_id, stage_number)
);

ALTER TABLE IF EXISTS approvals ADD COLUMN IF NOT EXISTS stage_number SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS approvals ADD COLUMN IF NOT EXISTS stage_name VARCHAR(100) NOT NULL DEFAULT 'GCG & Internal Audit';
ALTER TABLE IF EXISTS approvals ADD COLUMN IF NOT EXISTS approver_role VARCHAR(30) NOT NULL DEFAULT 'admin';
ALTER TABLE IF EXISTS document_approval_steps ADD COLUMN IF NOT EXISTS required_count SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS document_approval_steps ADD COLUMN IF NOT EXISTS approver_user_id UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  process VARCHAR(255),
  owner_unit VARCHAR(150) NOT NULL,
  requirement_reference TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES evaluation_items(id),
  period VARCHAR(50) NOT NULL,
  result VARCHAR(30) NOT NULL DEFAULT 'Belum Dinilai',
  notes TEXT,
  evaluator_id UUID REFERENCES users(id),
  state VARCHAR(30) NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES evaluations(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_unit VARCHAR(150) NOT NULL,
  risk_level VARCHAR(30) NOT NULL DEFAULT 'Sedang',
  state VARCHAR(40) NOT NULL DEFAULT 'Terbuka',
  due_date DATE,
  assignee_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee_id UUID REFERENCES users(id),
  state VARCHAR(40) NOT NULL DEFAULT 'Terbuka',
  due_date DATE,
  submitted_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verification_note TEXT
);

ALTER TABLE corrective_actions
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);

ALTER TABLE evaluation_items
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_code ON documents(code);
CREATE INDEX IF NOT EXISTS idx_approvals_document_id ON approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_pending ON document_approval_steps(decision, stage_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_period ON evaluations(period);
CREATE INDEX IF NOT EXISTS idx_findings_state ON findings(state);

INSERT INTO document_approval_steps (document_id, stage_number, stage_name, required_role)
SELECT id, 1, 'GCG & Internal Audit', 'admin' FROM documents
ON CONFLICT (document_id, stage_number) DO NOTHING;
INSERT INTO document_approval_steps (document_id, stage_number, stage_name, required_role, required_count)
SELECT id, 2, 'Pemeriksaan Manager Divisi', 'manager', 1 FROM documents
ON CONFLICT (document_id, stage_number) DO NOTHING;
INSERT INTO document_approval_steps (document_id, stage_number, stage_name, required_role)
SELECT id, 3, 'Pengesahan Direktur', 'director' FROM documents
ON CONFLICT (document_id, stage_number) DO NOTHING;

UPDATE document_approval_steps
SET required_count = 1,
    approver_user_id = COALESCE(approver_user_id, (SELECT id FROM users WHERE email = 'manager.finance@comtelindo.co.id'))
WHERE stage_number = 2;
