BEGIN;
CREATE TABLE IF NOT EXISTS assessment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 email text NOT NULL CHECK(length(email)<=200 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
 company text NOT NULL CHECK(length(trim(company)) BETWEEN 1 AND 200),
 role text CHECK(length(role)<=200),
 constraint_area text NOT NULL CHECK(constraint_area IN ('value','pilot','risk','people','cost')),
 workflow text NOT NULL CHECK(workflow IN ('transfers','support','procurement','compliance','other','unsure')),
 cost_today text CHECK(length(cost_today)<=2000),
 has_owner boolean NOT NULL DEFAULT false,
 send_questions boolean NOT NULL DEFAULT false,
 source text CHECK(length(source)<=500),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','scheduled','closed'))
);
CREATE TABLE IF NOT EXISTS assessment_crm_sync (
 request_id uuid PRIMARY KEY REFERENCES assessment_requests(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 synced_at timestamptz,
 company_id uuid,person_id uuid,opportunity_id uuid,note_id uuid,
 last_error text
);
CREATE INDEX IF NOT EXISTS assessment_crm_sync_pending ON assessment_crm_sync(next_attempt_at) WHERE synced_at IS NULL;
-- Website activity sync (crm/VISITOR-TRACKING.md). Re-running is safe. Existing rows get
-- web_next_check_at = now(), so leads stored before this change are looked up once too.
-- NULL web_next_check_at means no further lookups for that request.
ALTER TABLE assessment_crm_sync
 ADD COLUMN IF NOT EXISTS web_next_check_at timestamptz DEFAULT now(),
 ADD COLUMN IF NOT EXISTS web_fingerprint text,
 ADD COLUMN IF NOT EXISTS web_note_id uuid,
 ADD COLUMN IF NOT EXISTS web_last_error text;
CREATE INDEX IF NOT EXISTS assessment_crm_sync_web_due ON assessment_crm_sync(web_next_check_at) WHERE web_next_check_at IS NOT NULL;
INSERT INTO directus_collections(collection,icon,note)
VALUES ('assessment_requests','contact_page','Private website assessment submissions'),('assessment_crm_sync','sync','Private server-side CRM sync state')
ON CONFLICT(collection) DO NOTHING;
-- Public receives no collection privileges. Only the validated /assessment/requests
-- endpoint accepts submissions; listing, updating and deleting remain private.
COMMIT;
