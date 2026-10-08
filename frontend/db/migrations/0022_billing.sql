-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0022 — Student app fees, payments and the academic-year lock
--  billing_settings  one row for the University: academic year, due date, grace days, fee per plan, lock switches.
--  college_billing   per college and year: the college's own fee (overrides its plan) and whether the University
--                    has cleared the college's staff for the year.
--  student_dues      per student and year: the fee and whether it is Due, Paid or Waived.
--  fee_payments      every online (Razorpay, PayU, CCAvenue, PayPal) and offline payment attempt.
--  fee_reminders     fee reminders sent through the portal by the Principal (or the Super Admin) to one student, or
--                    to every student of the college whose fee is still due (user_sub NULL).
--  Inside a college, the application can only open a due, start a payment or record a gateway order on it: only
--  the University scope ("All colleges", used by the Super Admin and by verified gateway returns) can mark a payment
--  paid, approve an offline payment, waive a fee or clear a college.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS billing_settings (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  academic_year  text NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
  year_start     date NOT NULL,
  due_date       date NOT NULL CHECK (due_date >= year_start),
  grace_days     integer NOT NULL DEFAULT 15 CHECK (grace_days BETWEEN 0 AND 120),
  reminder_days  integer NOT NULL DEFAULT 15 CHECK (reminder_days BETWEEN 0 AND 90),
  currency       text NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','USD')),
  auto_lock      boolean NOT NULL DEFAULT false,
  lock_staff     boolean NOT NULL DEFAULT false,
  fees           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fees) = 'object'),
  updated_by     text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS college_billing (
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  academic_year  text NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
  fee_override   numeric(12,2) CHECK (fee_override IS NULL OR fee_override >= 0),
  cleared        boolean NOT NULL DEFAULT false,
  cleared_by     text NOT NULL DEFAULT '' CHECK (length(cleared_by) <= 120),
  cleared_at     timestamptz,
  PRIMARY KEY (college_id, academic_year)
);

CREATE TABLE IF NOT EXISTS student_dues (
  user_sub       text NOT NULL CHECK (length(user_sub) <= 120),
  academic_year  text NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_name   text NOT NULL DEFAULT '' CHECK (length(student_name) <= 120),
  amount         numeric(12,2) NOT NULL CHECK (amount >= 0),
  status         text NOT NULL DEFAULT 'Due' CHECK (status IN ('Due','Paid','Waived')),
  method         text NOT NULL DEFAULT '' CHECK (method IN ('','online','offline','waiver')),
  cleared_by     text NOT NULL DEFAULT '' CHECK (length(cleared_by) <= 120),
  cleared_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_sub, academic_year)
);
CREATE INDEX IF NOT EXISTS student_dues_college_idx ON student_dues (college_id, academic_year);

CREATE TABLE IF NOT EXISTS fee_payments (
  id                  text PRIMARY KEY CHECK (id ~ '^PAY-[a-f0-9]{20}$'),
  receipt_no          text NOT NULL DEFAULT '' CHECK (length(receipt_no) <= 40),
  user_sub            text NOT NULL CHECK (length(user_sub) <= 120),
  student_name        text NOT NULL DEFAULT '' CHECK (length(student_name) <= 120),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  academic_year       text NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL CHECK (currency IN ('INR','USD')),
  gateway             text NOT NULL CHECK (gateway IN ('razorpay','payu','ccavenue','paypal','offline')),
  gateway_order_id    text NOT NULL DEFAULT '' CHECK (length(gateway_order_id) <= 80),
  gateway_payment_id  text NOT NULL DEFAULT '' CHECK (length(gateway_payment_id) <= 80),
  status              text NOT NULL CHECK (status IN ('Created','Pending verification','Paid','Failed','Rejected')),
  offline_mode        text NOT NULL DEFAULT '' CHECK (length(offline_mode) <= 40),
  offline_ref         text NOT NULL DEFAULT '' CHECK (length(offline_ref) <= 120),
  proof_media_id      text NOT NULL DEFAULT '' CHECK (length(proof_media_id) <= 40),
  reviewed_by         text NOT NULL DEFAULT '' CHECK (length(reviewed_by) <= 120),
  review_note         text NOT NULL DEFAULT '' CHECK (length(review_note) <= 300),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_payments_user_idx ON fee_payments (user_sub, academic_year);
CREATE INDEX IF NOT EXISTS fee_payments_college_idx ON fee_payments (college_id, academic_year, status);
CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_gateway_order_idx ON fee_payments (gateway, gateway_order_id) WHERE gateway_order_id <> '';

CREATE TABLE IF NOT EXISTS fee_reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  academic_year  text NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
  user_sub       text CHECK (user_sub IS NULL OR length(user_sub) <= 120),
  message        text NOT NULL CHECK (length(message) BETWEEN 5 AND 500),
  sent_by        text NOT NULL CHECK (length(sent_by) <= 120),
  sent_role      text NOT NULL CHECK (length(sent_role) <= 20),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_reminders_college_idx ON fee_reminders (college_id, academic_year, created_at DESC);

ALTER TABLE fee_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_reminders FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY college_isolation ON fee_reminders USING (app_scope_all() OR college_id = app_college()) WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE college_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE college_billing FORCE ROW LEVEL SECURITY;
ALTER TABLE student_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_dues FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments FORCE ROW LEVEL SECURITY;

-- Everyone reads the University's billing settings (due date, lock); only "All colleges" changes them.
DO $$ BEGIN
  CREATE POLICY read_all ON billing_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin ON billing_settings FOR ALL USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_read ON college_billing FOR SELECT USING (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin ON college_billing FOR ALL USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_read ON student_dues FOR SELECT USING (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY college_open_due ON student_dues FOR INSERT WITH CHECK (college_id = app_college() AND (status = 'Due' OR amount = 0));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin ON student_dues FOR ALL USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_read ON fee_payments FOR SELECT USING (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY college_start ON fee_payments FOR INSERT WITH CHECK (college_id = app_college() AND status IN ('Created','Pending verification'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY college_order ON fee_payments FOR UPDATE
    USING (college_id = app_college() AND status = 'Created')
    WITH CHECK (college_id = app_college() AND status IN ('Created','Failed'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin ON fee_payments FOR ALL USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON billing_settings, college_billing, student_dues, fee_payments TO ciq_app;
GRANT SELECT, INSERT ON fee_reminders TO ciq_app;

-- Integrations & Setup: one row per payment gateway.
ALTER TABLE platform_integrations DROP CONSTRAINT IF EXISTS platform_integrations_id_check;
ALTER TABLE platform_integrations ADD CONSTRAINT platform_integrations_id_check
  CHECK (id IN ('storage','email','whatsapp','sms','payments','payments-payu','payments-ccavenue','payments-paypal','sso','meetings','webhook'));

COMMIT;
