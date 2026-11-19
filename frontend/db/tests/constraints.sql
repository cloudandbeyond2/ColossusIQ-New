-- ════════════════════════════════════════════════════════════════════════════════════════════
--  ColossusIQ — database rule tests. Run on a seeded database:
--    psql -v ON_ERROR_STOP=1 -f db/tests/constraints.sql
--  Each check must be rejected by the database; the script raises if any slips through.
--  Everything runs in a transaction that is rolled back.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';   -- files contain non-ASCII text (en dashes, curly quotes)
BEGIN;

CREATE FUNCTION pg_temp.expect_fail(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok   % → rejected (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL % → was accepted', label;
END $$;

-- stream rules
SELECT pg_temp.expect_fail('engineering programme in a medical college', $q$
  INSERT INTO admissions (college_id, full_name, dob, gender, email, phone, board, hsc_percent, programme_id, quota, category, guardian_name, guardian_phone, status)
  VALUES ((SELECT id FROM colleges WHERE public_id = 'COL-1006'), 'Test Student', '2006-01-01', 'Male', 't1@example.com', '9876543210', 'State Board', 80,
          (SELECT id FROM programmes WHERE name = 'B.E. Mechanical Engineering'), 'Government', 'BC', 'Guardian', '9876543211', 'Applied') $q$);

SELECT pg_temp.expect_fail('entrance score above stream maximum (engineering 200)', $q$
  INSERT INTO admissions (college_id, full_name, dob, gender, email, phone, board, hsc_percent, entrance_score, programme_id, quota, category, guardian_name, guardian_phone, status)
  VALUES ((SELECT id FROM colleges WHERE public_id = 'COL-1001'), 'Test Student', '2006-01-01', 'Male', 't2@example.com', '9876543210', 'State Board', 80, 450,
          (SELECT id FROM programmes WHERE name = 'B.E. Mechanical Engineering'), 'Government', 'BC', 'Guardian', '9876543211', 'Applied') $q$);

SELECT pg_temp.expect_fail('clinical rotation in an engineering college', $q$
  INSERT INTO clinical_rotations (college_id, student_name, reg_no, phase, department, unit, start_date, end_date, supervisor_name, attendance, competencies_signed, status)
  VALUES ((SELECT id FROM colleges WHERE public_id = 'COL-1001'), 'X', 'MB1', 'Phase II', 'General Medicine', 'Unit 1', '2026-09-01', '2026-10-01', 'Dr. Y', 90, 1, 'Ongoing') $q$);

-- identity
SELECT pg_temp.expect_fail('duplicate user email (case-insensitive)', $q$
  INSERT INTO users (university_id, email, full_name, status) VALUES ((SELECT id FROM universities), 'ADMIN@tntu.edu.in', 'Dup', 'Active') $q$);

SELECT pg_temp.expect_fail('college admin without a college', $q$
  INSERT INTO role_assignments (user_id, role) VALUES ((SELECT id FROM users WHERE email = 'hod@ait.edu.in'), 'institution') $q$);

-- field checks
SELECT pg_temp.expect_fail('bad phone number', $q$
  UPDATE staff SET phone = '12345' WHERE email = 'staff1@ait.edu.in' $q$);

SELECT pg_temp.expect_fail('end_date before start_date', $q$
  UPDATE clinical_rotations SET end_date = start_date - 1 WHERE id = (SELECT id FROM clinical_rotations LIMIT 1) $q$);

SELECT pg_temp.expect_fail('bad course code format', $q$
  UPDATE courses SET code = 'dbms' WHERE code = 'CS3492' AND college_id = (SELECT id FROM colleges WHERE public_id = 'COL-1001') $q$);

-- assessment
SELECT pg_temp.expect_fail('fifth quiz option', $q$
  INSERT INTO quiz_questions (quiz_id, position, prompt, options, answer, explanation)
  VALUES ((SELECT id FROM quizzes WHERE purpose = 'department' LIMIT 1), 99, 'Pick one of these options', ARRAY['a','b','c','d','e'], 0, 'x') $q$);

SELECT pg_temp.expect_fail('answer index out of range', $q$
  UPDATE quiz_questions SET answer = 4 WHERE id = (SELECT id FROM quiz_questions LIMIT 1) $q$);

SELECT pg_temp.expect_fail('pass mark outside 30–90', $q$
  UPDATE quizzes SET pass_mark = 95 WHERE id = (SELECT id FROM quizzes LIMIT 1) $q$);

SELECT pg_temp.expect_fail('second active certificate for the same quiz and student (new attempt)', $q$
  WITH c AS (SELECT * FROM certificates LIMIT 1),
  a AS (INSERT INTO quiz_attempts (quiz_id, student_id, college_id, submitted_at, score, total, percentage)
        SELECT quiz_id, student_id, college_id, now(), marks, total, percentage FROM c RETURNING id)
  INSERT INTO certificates (kind, quiz_id, attempt_id, student_id, college_id, student_name, title, course, department_name, marks, total, percentage, grade, grade_label, signature)
  SELECT c.kind, c.quiz_id, a.id, c.student_id, c.college_id, c.student_name, c.title, c.course, c.department_name, c.marks, c.total, c.percentage, c.grade, c.grade_label, c.signature FROM c, a $q$);

SELECT pg_temp.expect_fail('fourth attempt at the same quiz (one at a time)', $q$
  DO $d$ DECLARE a record; BEGIN
    SELECT quiz_id, student_id, college_id INTO a FROM quiz_attempts ORDER BY started_at LIMIT 1;
    FOR i IN 1..3 LOOP
      INSERT INTO quiz_attempts (quiz_id, student_id, college_id) VALUES (a.quiz_id, a.student_id, a.college_id);
    END LOOP;
  END $d$ $q$);

SELECT pg_temp.expect_fail('extra attempts inserted in one statement', $q$
  INSERT INTO quiz_attempts (quiz_id, student_id, college_id)
  SELECT a.quiz_id, a.student_id, a.college_id FROM (SELECT * FROM quiz_attempts ORDER BY started_at LIMIT 1) a, generate_series(1, 3) $q$);

-- append-only
SELECT pg_temp.expect_fail('UPDATE on audit_log', $q$ UPDATE audit_log SET action = 'tampered' $q$);
SELECT pg_temp.expect_fail('DELETE on faculty_activity_events', $q$ DELETE FROM faculty_activity_events $q$);

-- row-level security (as the application role; the migration owner bypasses RLS)
SET LOCAL ROLE ciq_app;
DO $$
DECLARE
  own int; other int; all_rows int; nothing int;
BEGIN
  PERFORM app_set_context((SELECT id FROM colleges WHERE public_id = 'COL-1001'), 'college', NULL);
  SELECT count(*) INTO own FROM admissions;
  SELECT count(*) INTO other FROM admissions a JOIN colleges c ON c.id = a.college_id WHERE c.public_id <> 'COL-1001';
  IF own = 0 OR other <> 0 THEN RAISE EXCEPTION 'FAIL RLS college scope: own=% other=%', own, other; END IF;
  RAISE NOTICE 'ok   RLS college scope sees % admissions, 0 from other colleges', own;

  BEGIN
    INSERT INTO events (college_id, title, type, event_date, venue, organiser, capacity, status)
    VALUES ((SELECT id FROM colleges WHERE public_id = 'COL-1002'), 'Cross-college write', 'Seminar', '2026-12-01', 'Hall', 'X', 10, 'Draft');
    RAISE EXCEPTION 'FAIL RLS allowed a write into another college';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   RLS blocks writes into another college';
  END;

  PERFORM app_set_context(NULL, 'all', NULL);
  SELECT count(*) INTO all_rows FROM admissions;
  IF all_rows <= own THEN RAISE EXCEPTION 'FAIL RLS all scope: %', all_rows; END IF;
  RAISE NOTICE 'ok   RLS all scope sees % admissions', all_rows;

  PERFORM set_config('app.college_id', '', true);
  PERFORM set_config('app.scope', '', true);
  SELECT count(*) INTO nothing FROM admissions;
  IF nothing <> 0 THEN RAISE EXCEPTION 'FAIL RLS without context returned % rows', nothing; END IF;
  RAISE NOTICE 'ok   RLS without context returns nothing';
END $$;
RESET ROLE;

-- placement readiness view stays in range
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM v_placement_readiness WHERE total NOT BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION 'FAIL readiness total out of range';
  END IF;
  RAISE NOTICE 'ok   v_placement_readiness totals within 0–100 (% rows)', (SELECT count(*) FROM v_placement_readiness);
END $$;

ROLLBACK;
