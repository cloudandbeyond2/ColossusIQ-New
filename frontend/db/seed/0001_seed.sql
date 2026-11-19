-- ════════════════════════════════════════════════════════════════════════════════════════════
--  ColossusIQ — demo seed data (matches the in-app demo: TNTU with 7 colleges)
--  Run after db/migrations/0001_init.sql as the migration owner (bypasses RLS).
--  Passwords: no credentials are seeded. Create them through the app (argon2id) or use SSO.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';   -- files contain non-ASCII text (en dashes, curly quotes)
BEGIN;

-- ── University ────────────────────────────────────────────────────────────────────────────
INSERT INTO universities (slug, name, short_name) VALUES ('tntu', 'Tamil Nadu Technical University', 'TNTU');

-- ── Streams and lookups (src/config/streams.ts) ───────────────────────────────────────────
INSERT INTO streams (key, label, regulator, term_label, entrance_label, entrance_max) VALUES
  ('engineering', 'Engineering & Technology', 'AICTE · Anna University regulations', 'Semester', 'TNEA counselling cut-off (out of 200)', 200),
  ('medical', 'Medical & Health Sciences', 'NMC · DCI · INC · PCI (CBME curriculum)', 'Phase', 'NEET score (out of 720)', 720),
  ('artsScience', 'Arts & Science', 'UGC · CBCS · NAAC', 'Semester', 'Qualifying exam merit score (out of 100)', 100),
  ('management', 'Management', 'AICTE · NBA', 'Trimester', 'TANCET / CAT percentile (out of 100)', 100),
  ('polytechnic', 'Polytechnic (Diploma)', 'DOTE · AICTE', 'Semester', '10th marks merit score (out of 100)', 100);

INSERT INTO college_types (name, stream_key) VALUES
  ('Engineering', 'engineering'), ('Medical College & Hospital', 'medical'), ('Dental College', 'medical'),
  ('Nursing & Allied Health Sciences', 'medical'), ('Arts & Science', 'artsScience'), ('Management', 'management'), ('Polytechnic', 'polytechnic');

INSERT INTO departments (stream_key, name)
SELECT 'engineering', unnest(ARRAY['Computer Science & Engineering','Information Technology','Artificial Intelligence & Data Science','Electronics & Communication','Electrical & Electronics','Mechanical Engineering','Civil Engineering','Science & Humanities','Administration'])
UNION ALL SELECT 'medical', unnest(ARRAY['Anatomy','Physiology','Biochemistry','Pathology','Pharmacology','Microbiology','Forensic Medicine','Community Medicine','General Medicine','General Surgery','Obstetrics & Gynaecology','Paediatrics','Orthopaedics','Nursing','Physiotherapy','Pharmacy','Hospital Administration'])
UNION ALL SELECT 'artsScience', unnest(ARRAY['Tamil','English','History','Economics','Commerce','Mathematics','Physics','Chemistry','Botany','Zoology','Computer Science','Business Administration','Administration'])
UNION ALL SELECT 'management', unnest(ARRAY['Marketing','Finance','Human Resources','Operations','Business Analytics','Administration'])
UNION ALL SELECT 'polytechnic', unnest(ARRAY['Mechanical Engineering','Electrical & Electronics','Civil Engineering','Computer Engineering','Administration']);

INSERT INTO programmes (stream_key, name)
SELECT 'engineering', unnest(ARRAY['B.E. Computer Science & Engineering','B.Tech Information Technology','B.Tech AI & Data Science','B.E. Electronics & Communication','B.E. Electrical & Electronics','B.E. Mechanical Engineering','B.E. Civil Engineering','M.E. Computer Science'])
UNION ALL SELECT 'medical', unnest(ARRAY['MBBS','BDS','B.Sc Nursing','Bachelor of Physiotherapy (BPT)','B.Pharm','B.Sc Medical Laboratory Technology','MD General Medicine','MS General Surgery'])
UNION ALL SELECT 'artsScience', unnest(ARRAY['B.A. Tamil','B.A. English','B.A. Economics','B.Sc. Mathematics','B.Sc. Physics','B.Sc. Chemistry','B.Sc. Computer Science','B.Com','BCA','BBA','M.A. English','M.Sc. Chemistry','M.Com'])
UNION ALL SELECT 'management', unnest(ARRAY['MBA','MBA Business Analytics','BBA','PGDM'])
UNION ALL SELECT 'polytechnic', unnest(ARRAY['Diploma in Mechanical Engineering','Diploma in Electrical & Electronics','Diploma in Civil Engineering','Diploma in Computer Engineering']);

INSERT INTO terms (stream_key, name, position)
SELECT 'engineering', t, n FROM unnest(ARRAY['1','2','3','4','5','6','7','8']) WITH ORDINALITY AS x(t, n)
UNION ALL SELECT 'medical', t, n FROM unnest(ARRAY['Phase I','Phase II','Phase III Part 1','Phase III Part 2','Internship (CRMI)','Year 1','Year 2','Year 3','Year 4']) WITH ORDINALITY AS x(t, n)
UNION ALL SELECT 'artsScience', t, n FROM unnest(ARRAY['1','2','3','4','5','6']) WITH ORDINALITY AS x(t, n)
UNION ALL SELECT 'management', t, n FROM unnest(ARRAY['1','2','3','4','5','6']) WITH ORDINALITY AS x(t, n)
UNION ALL SELECT 'polytechnic', t, n FROM unnest(ARRAY['1','2','3','4','5','6']) WITH ORDINALITY AS x(t, n);

INSERT INTO designations (stream_key, name)
SELECT 'engineering', unnest(ARRAY['Professor','Associate Professor','Assistant Professor','Lab Instructor'])
UNION ALL SELECT 'medical', unnest(ARRAY['Professor','Associate Professor','Assistant Professor','Senior Resident','Junior Resident','Tutor / Demonstrator','Nursing Tutor','Staff Nurse'])
UNION ALL SELECT 'artsScience', unnest(ARRAY['Professor','Associate Professor','Assistant Professor','Guest Lecturer'])
UNION ALL SELECT 'management', unnest(ARRAY['Professor','Associate Professor','Assistant Professor','Industry Fellow'])
UNION ALL SELECT 'polytechnic', unnest(ARRAY['Head of Section','Lecturer','Lab Instructor','Workshop Instructor'])
UNION ALL SELECT NULL, unnest(ARRAY['Librarian','Administrative Officer','Accountant','Technician','Office Assistant']);

-- ── Colleges (src/lib/api/mock/records.ts COLLEGE_SEEDS) ──────────────────────────────────
INSERT INTO colleges (public_id, university_id, name, code, type, city, established, student_capacity, principal, email, phone, plan, status, admissions_open)
SELECT v.pid, (SELECT id FROM universities WHERE slug = 'tntu'), v.name, v.code, v.type, v.city, v.est, v.cap, v.principal, v.email, v.phone, v.plan::college_plan, v.status::college_status, v.status = 'Active'
FROM (VALUES
  ('COL-1001', 'Anna Institute of Technology', '1101', 'Engineering', 'Chennai', 2001, 6600, 'Dr. Lakshmi Sundaram', 'office@ait.edu.in', '9840012345', 'University Enterprise', 'Active'),
  ('COL-1002', 'Kaveri College of Arts & Science', '2204', 'Arts & Science', 'Tiruchirappalli', 1987, 3200, 'Dr. M. Revathi', 'office@kaveri.ac.in', '9443012345', 'Campus Pro', 'Active'),
  ('COL-1003', 'Kongu College of Engineering', '1318', 'Engineering', 'Erode', 1994, 5400, 'Dr. K. Palanisamy', 'office@kongu.edu.in', '9894012345', 'Campus Pro', 'Active'),
  ('COL-1004', 'Coimbatore School of Management', '3402', 'Management', 'Coimbatore', 2008, 1200, 'Prof. S. Harini', 'office@csm.edu.in', '9790012345', 'Campus Starter', 'Active'),
  ('COL-1005', 'Vaigai Polytechnic College', '4507', 'Polytechnic', 'Madurai', 2015, 900, 'Mr. A. Selvam', 'office@vaigaipoly.ac.in', '9626012345', 'Campus Starter', 'Onboarding'),
  ('COL-1006', 'Madurai Medical College & Hospital', '5101', 'Medical College & Hospital', 'Madurai', 1954, 1500, 'Dr. R. Meenakshi, MD', 'office@mmch.ac.in', '9486012345', 'University Enterprise', 'Active'),
  ('COL-1007', 'Chennai Institute of Nursing & Allied Health Sciences', '5230', 'Nursing & Allied Health Sciences', 'Chennai', 1999, 800, 'Prof. J. Stella, M.Sc (N)', 'office@cinahs.ac.in', '9551012345', 'Campus Pro', 'Active')
) AS v(pid, name, code, type, city, est, cap, principal, email, phone, plan, status);
SELECT setval('seq_college_public', 1007);

INSERT INTO college_modules (college_id, module)
SELECT c.id, m::module_group
FROM colleges c
JOIN (VALUES
  ('COL-1001', ARRAY['Career','Communication & Skills','Project & Innovation','Campus Life','Placement','Incubation','Admissions','Recruiter']),
  ('COL-1002', ARRAY['Career','Communication & Skills','Campus Life','Placement','Admissions']),
  ('COL-1003', ARRAY['Career','Communication & Skills','Project & Innovation','Campus Life','Placement','Incubation','Admissions','Recruiter']),
  ('COL-1004', ARRAY['Career','Communication & Skills','Placement','Incubation','Admissions']),
  ('COL-1005', ARRAY['Career','Campus Life','Admissions']),
  ('COL-1006', ARRAY['Career','Communication & Skills','Project & Innovation','Campus Life','Admissions']),
  ('COL-1007', ARRAY['Career','Communication & Skills','Campus Life','Admissions'])
) AS v(pid, mods) ON v.pid = c.public_id
CROSS JOIN LATERAL unnest(v.mods) AS m;

INSERT INTO college_websites (college_id, tagline, hero_builtin, announcement, about, principal_message, highlights, address, phone, email, office_hours)
SELECT c.id,
  CASE college_stream(c.id) WHEN 'medical' THEN 'Healing hands, thinking minds.' WHEN 'artsScience' THEN 'Where ideas find their voice.' WHEN 'management' THEN 'Leaders for a changing economy.' ELSE 'Engineering the future, responsibly.' END,
  CASE college_stream(c.id) WHEN 'medical' THEN '/campus/hospital.svg' WHEN 'artsScience' THEN '/campus/library.svg' ELSE '/campus/campus.svg' END,
  'Admissions for 2026–27 are open.',
  c.name || ' is an affiliated college of Tamil Nadu Technical University, located in ' || c.city || '.',
  'Welcome to ' || c.name || '. We are proud of our students and faculty.',
  E'NAAC accredited\nIndustry partnerships\nActive placement cell',
  c.city || ', Tamil Nadu', c.phone, c.email, 'Mon–Sat, 9:00 am – 5:00 pm'
FROM colleges c;

-- ── University-wide users ─────────────────────────────────────────────────────────────────
INSERT INTO users (university_id, email, full_name, status, mfa_required)
SELECT u.id, v.email, v.name, 'Active', true
FROM universities u, (VALUES ('admin@tntu.edu.in', 'University Super Admin'), ('talent@techcorp.example', 'Priya Recruiter')) AS v(email, name);
INSERT INTO role_assignments (user_id, role) SELECT id, 'admin' FROM users WHERE email = 'admin@tntu.edu.in';
INSERT INTO role_assignments (user_id, role) SELECT id, 'recruiter' FROM users WHERE email = 'talent@techcorp.example';

-- ── Per-college people, courses, events, gallery ──────────────────────────────────────────
DO $$
DECLARE
  c record;
  s text;
  dom text;
  dept_id int;
  dept2_id int;
  prog_id int;
  term_id int;
  desig_id int;
  u_id uuid;
  adm_id uuid;
  staff_id uuid;
  i int;
  maxscore numeric;
BEGIN
  FOR c IN SELECT * FROM colleges ORDER BY public_id LOOP
    s := college_stream(c.id);
    dom := split_part(c.email::text, '@', 2);
    SELECT id INTO dept_id FROM departments WHERE stream_key = s AND name <> 'Administration' ORDER BY id LIMIT 1;
    SELECT id INTO dept2_id FROM departments WHERE stream_key = s AND name <> 'Administration' ORDER BY id OFFSET 1 LIMIT 1;
    SELECT id INTO prog_id FROM programmes WHERE stream_key = s ORDER BY id LIMIT 1;
    SELECT id INTO term_id FROM terms WHERE stream_key = s ORDER BY position OFFSET 2 LIMIT 1;
    SELECT id INTO desig_id FROM designations WHERE stream_key = s ORDER BY id OFFSET 2 LIMIT 1;
    SELECT entrance_max INTO maxscore FROM streams WHERE key = s;

    -- staff with platform accounts: principal, HOD, faculty, placement officer
    FOR i IN 1..4 LOOP
      INSERT INTO users (university_id, email, full_name, status)
      VALUES (c.university_id,
              (ARRAY['principal','hod','faculty','placement'])[i] || '@' || dom,
              (ARRAY[c.principal, 'Dr. S. Venkatesh', 'Dr. Meena Raghavan', 'Mr. R. Karthikeyan'])[i],
              'Active')
      RETURNING id INTO u_id;
      INSERT INTO role_assignments (user_id, role, college_id, department_id)
      VALUES (u_id, (ARRAY['institution','hod','faculty','placement'])[i]::app_role, c.id, CASE WHEN i IN (2,3) THEN dept_id END);
      INSERT INTO staff (college_id, user_id, full_name, email, phone, qualification, department_id, designation_id, staff_type, employment, joining_date, experience_years)
      VALUES (c.id, u_id,
              (ARRAY[c.principal, 'Dr. S. Venkatesh', 'Dr. Meena Raghavan', 'Mr. R. Karthikeyan'])[i],
              'staff' || i || '@' || dom, '98' || lpad((c.code::int * 10 + i)::text, 8, '0'),
              'Ph.D', dept_id,
              CASE WHEN i = 4 THEN (SELECT id FROM designations WHERE stream_key IS NULL AND name = 'Administrative Officer') ELSE desig_id END,
              CASE WHEN i = 4 THEN 'Administrative' ELSE 'Teaching' END::staff_type, 'Permanent', DATE '2012-06-01' + i * 400, 8 + i)
      RETURNING id INTO staff_id;
    END LOOP;

    -- Default students removed: real student records are created dynamically via user POST operations / CSV import.

    -- courses (Course Management records)
    INSERT INTO courses (college_id, code, title, department_id, term_id, credits, course_type, faculty_name, status)
    VALUES
      (c.id, CASE s WHEN 'engineering' THEN 'CS3492' WHEN 'medical' THEN 'PA201' WHEN 'artsScience' THEN 'UCO301' WHEN 'management' THEN 'MB101' ELSE 'DME201' END,
       CASE s WHEN 'engineering' THEN 'Database Management Systems' WHEN 'medical' THEN 'Pathology' WHEN 'artsScience' THEN 'Financial Accounting' WHEN 'management' THEN 'Managerial Economics' ELSE 'Engineering Drawing' END,
       dept_id, term_id, 4, 'Theory', 'Dr. Meena Raghavan', 'Active'),
      (c.id, CASE s WHEN 'engineering' THEN 'CS3451' WHEN 'medical' THEN 'PH201' WHEN 'artsScience' THEN 'UCS301' WHEN 'management' THEN 'MB205' ELSE 'DEE301' END,
       CASE s WHEN 'engineering' THEN 'Operating Systems' WHEN 'medical' THEN 'Pharmacology' WHEN 'artsScience' THEN 'Data Structures (BCA)' WHEN 'management' THEN 'Marketing Management' ELSE 'Electrical Machines I' END,
       dept2_id, term_id, 3, 'Theory + Lab', 'Dr. S. Venkatesh', 'Draft');

    -- events
    INSERT INTO events (college_id, title, type, event_date, start_time, venue, organiser, capacity, registration_open, status, description)
    VALUES
      (c.id, 'Orientation Day 2026', 'Seminar', DATE '2026-10-12', '10:00', 'Main Auditorium', 'Principal''s Office', 800, true, 'Published', 'Welcome programme for new students.'),
      (c.id, 'Annual Sports Meet', 'Sports', DATE '2026-11-20', '08:30', 'College Ground', 'Physical Education Dept', 1200, true, 'Draft', NULL);

    -- gallery
    INSERT INTO gallery_items (college_id, image_builtin, title, category, caption, featured, status)
    VALUES
      (c.id, '/campus/campus.svg', 'Main building', 'Campus', 'Our campus at sunrise.', true, 'Published'),
      (c.id, CASE WHEN s = 'medical' THEN '/campus/hospital.svg' ELSE '/campus/lab.svg' END, CASE WHEN s = 'medical' THEN 'Teaching hospital' ELSE 'Laboratories' END,
       CASE WHEN s = 'medical' THEN 'Hospital & Clinical' ELSE 'Labs & Library' END::gallery_category, NULL, false, 'Draft');

    -- clinical rotations (medical colleges only)
    IF s = 'medical' AND c.status = 'Active' THEN
      INSERT INTO clinical_rotations (college_id, student_id, student_name, reg_no, phase, department, unit, start_date, end_date, supervisor_name, attendance, competencies_signed, status)
      SELECT c.id, st.id, u.full_name, 'MB' || st.roll_no, 'Phase II', 'General Medicine', 'Unit 2', DATE '2026-09-01', DATE '2026-10-15', 'Dr. R. Prakash, MD', 92, 14, 'Ongoing'
      FROM students st JOIN users u ON u.id = st.user_id WHERE st.college_id = c.id ORDER BY st.roll_no LIMIT 2;
    END IF;
  END LOOP;
END $$;

-- ── Sample AI Course Studio course: DBMS in COL-1001, with final assessment ───────────────
DO $$
DECLARE
  col uuid := (SELECT id FROM colleges WHERE public_id = 'COL-1001');
  cse int := (SELECT id FROM departments WHERE stream_key = 'engineering' AND name = 'Computer Science & Engineering');
  hod uuid := (SELECT id FROM users WHERE email = 'hod@ait.edu.in');
  lc uuid;
  u0 uuid; u1 uuid; u2 uuid;
  qz uuid;
  apt uuid;
  dq uuid;
  st uuid;
  att uuid;
  pct numeric;
BEGIN
  INSERT INTO learning_courses (college_id, department_id, term_id, code, title, level, credits, faculty_name, source, summary, status, created_by, created_by_name, published_at, course_record_id)
  VALUES (col, cse, (SELECT id FROM terms WHERE stream_key = 'engineering' AND name = '4'), 'CSE101', 'Database Management Systems', 'Intermediate (UG Year 2–3)', 4,
          'Dr. Meena Raghavan', 'title',
          'Database Management Systems for Computer Science & Engineering students: lessons in chapters, a 30-question final assessment and a mark-based certificate.',
          'Published', hod, 'Dr. S. Venkatesh', now() - interval '12 days',
          (SELECT id FROM courses WHERE college_id = col AND code = 'CS3492'))
  RETURNING id INTO lc;

  INSERT INTO course_outcomes (course_id, code, bloom, text) VALUES
    (lc, 'CO1', 'Understand', 'Explain introduction to database systems and ER modelling in Database Management Systems.'),
    (lc, 'CO2', 'Apply', 'Apply normalization (1NF–BCNF) in Database Management Systems.');

  INSERT INTO course_units (course_id, position, title) VALUES (lc, 0, 'Getting started') RETURNING id INTO u0;
  INSERT INTO course_units (course_id, position, title, part) VALUES (lc, 1, 'Normalization (1NF–BCNF)', 'Part III · Database design') RETURNING id INTO u1;
  INSERT INTO course_units (course_id, position, title) VALUES (lc, 2, 'Course revision') RETURNING id INTO u2;

  INSERT INTO lessons (unit_id, course_id, code, position, title, minutes, layout, body, objectives, key_points) VALUES
    (u0, lc, 'L1', 0, 'Welcome to Database Management Systems', 10, 'overview',
     E'## About this course\nEach chapter moves from key concepts to a worked example to practice.',
     '["See how the course is organised"]', '["The final assessment unlocks after every lesson is complete."]');
  INSERT INTO lessons (unit_id, course_id, code, position, title, minutes, layout, body, objectives, key_points, terms, links) VALUES
    (u1, lc, 'L2', 0, 'Normalization (1NF–BCNF) — key concepts', 20, 'concepts',
     E'## Introduction\nNormalization splits tables step by step through the normal forms to remove redundancy and update anomalies.',
     '["State the key points of Normalization (1NF–BCNF)"]',
     '["2NF removes partial dependencies of non-key attributes on part of a composite key.","3NF removes transitive dependencies of non-key attributes.","In BCNF every determinant of a non-trivial dependency is a superkey."]',
     '[{"term":"Partial dependency","meaning":"A non-key attribute that depends on only part of a composite key."},{"term":"Transitive dependency","meaning":"A non-key attribute that depends on another non-key attribute."},{"term":"Update anomaly","meaning":"An inconsistency caused by having to change the same fact in many rows."}]',
     '[{"label":"NPTEL lectures: Normalization","url":"https://www.youtube.com/results?search_query=NPTEL+Normalization"}]');
  INSERT INTO lessons (unit_id, course_id, code, position, title, minutes, layout, body, key_points) VALUES
    (u1, lc, 'L3', 1, 'Normalization (1NF–BCNF) — worked example', 20, 'example',
     E'## Worked example\nENROL(roll_no, course_code, student_name, course_title, grade) is decomposed into STUDENT, COURSE and ENROL.',
     '["Decomposing without checking that the join is lossless.","Assuming 3NF always equals BCNF."]');
  INSERT INTO lessons (unit_id, course_id, code, position, title, minutes, layout, body, key_points, practice) VALUES
    (u1, lc, 'L4', 2, 'Normalization (1NF–BCNF) — practice & recap', 15, 'practice',
     E'## Recap\nMake sure you can explain every item in the checklist without looking back.',
     '["2NF removes partial dependencies of non-key attributes on part of a composite key.","3NF removes transitive dependencies of non-key attributes."]',
     '[{"q":"What must hold for a table to be in 1NF?","a":"Every attribute value is atomic."}]');
  INSERT INTO lessons (unit_id, course_id, code, position, title, minutes, layout, body, key_points) VALUES
    (u2, lc, 'L5', 0, 'Revision — Database Management Systems at a glance', 20, 'revision',
     E'## How to revise\nRead each chapter card and say its points aloud.', '["Revise chapter by chapter before the final assessment."]');
  INSERT INTO lesson_images (lesson_id, position, image_builtin, caption)
  SELECT id, 0, '/campus/lab.svg', 'Fig 1 — decomposition of ENROL' FROM lessons WHERE course_id = lc AND code = 'L3';
  INSERT INTO lesson_videos (lesson_id, position, title, url, kind, youtube_id)
  SELECT id, 0, 'Normalization explained', 'https://www.youtube.com/watch?v=GFQaEYEc8_8', 'youtube', 'GFQaEYEc8_8' FROM lessons WHERE course_id = lc AND code = 'L2';

  -- final assessment
  INSERT INTO quizzes (college_id, purpose, learning_course_id, department_id, title, subject, pass_mark, duration_min, status, created_by, created_by_name)
  VALUES (col, 'course_final', lc, cse, 'Database Management Systems — final assessment', 'Database Management Systems', 50, 45, 'Published', hod, 'Dr. S. Venkatesh')
  RETURNING id INTO qz;
  INSERT INTO quiz_questions (quiz_id, position, prompt, options, answer, explanation) VALUES
    (qz, 0, 'Which key term of this course means: “A non-key attribute that depends on only part of a composite key.”', ARRAY['Update anomaly','Partial dependency','Transitive dependency','Superkey'], 1, 'Covered in Normalization (1NF–BCNF).'),
    (qz, 1, 'Which key term of this course means: “A non-key attribute that depends on another non-key attribute.”', ARRAY['Transitive dependency','Partial dependency','Candidate key','Determinant'], 0, 'Covered in Normalization (1NF–BCNF).'),
    (qz, 2, 'Which normal form requires every determinant to be a superkey?', ARRAY['1NF','2NF','3NF','BCNF'], 3, 'BCNF.'),
    (qz, 3, 'A relation with only atomic values is at least in…', ARRAY['1NF','2NF','3NF','BCNF'], 0, '1NF requires atomic values.');

  -- department quiz and placement aptitude quiz
  INSERT INTO quizzes (college_id, purpose, department_id, title, subject, pass_mark, duration_min, status, created_by_name)
  VALUES (col, 'department', cse, 'Computer Science & Engineering — Unit test 1', 'Data structures', 50, 15, 'Published', 'AI Quiz Builder · reviewed by faculty')
  RETURNING id INTO dq;
  INSERT INTO quiz_questions (quiz_id, position, prompt, options, answer, explanation) VALUES
    (dq, 0, 'Which data structure uses LIFO order?', ARRAY['Queue','Stack','Heap','Linked list'], 1, 'A stack is Last In, First Out.'),
    (dq, 1, 'Worst-case time of binary search on n sorted items is…', ARRAY['O(n)','O(log n)','O(n log n)','O(1)'], 1, 'Each step halves the range.'),
    (dq, 2, 'SQL injection is best prevented by…', ARRAY['Hiding errors','Parameterised queries','Using POST','Client-side checks'], 1, 'Keep data separate from code.');
  INSERT INTO quizzes (college_id, purpose, title, subject, pass_mark, duration_min, status, created_by_name)
  VALUES (col, 'placement_aptitude', 'Placement aptitude — quantitative', 'Aptitude', 60, 10, 'Published', 'Placement Cell')
  RETURNING id INTO apt;
  INSERT INTO quiz_questions (quiz_id, position, prompt, options, answer, explanation) VALUES
    (apt, 0, 'A train covers 120 km in 2 hours. Its speed is…', ARRAY['50 km/h','60 km/h','70 km/h','80 km/h'], 1, '120 ÷ 2 = 60.'),
    (apt, 1, '20% of 250 is…', ARRAY['25','40','50','60'], 2, '0.2 × 250 = 50.'),
    (apt, 2, 'The next number in 2, 6, 12, 20, … is', ARRAY['28','30','32','26'], 1, 'Differences 4, 6, 8, 10.');

  -- a class summary with infographic
  INSERT INTO class_summaries (college_id, author_id, author_name, department_id, course_title, topic, title, class_date, points, homework, next_class, resources, infographic)
  VALUES (col, (SELECT id FROM users WHERE email = 'faculty@ait.edu.in'), 'Dr. Meena Raghavan', cse, 'Database Management Systems', 'Normalization (1NF–BCNF)',
          'Class summary — Normalization', CURRENT_DATE - 1,
          '["2NF removes partial dependencies.","3NF removes transitive dependencies."]', 'Normalise the ENROL table to 3NF.', 'Transactions & ACID',
          '[{"label":"NPTEL lecture","url":"https://www.youtube.com/watch?v=GFQaEYEc8_8"}]',
          '{"what":"Normalization splits tables to remove redundancy.","keyPoints":["2NF removes partial dependencies."],"terms":[],"mistakes":[],"illustration":"layers","question":null}');

  INSERT INTO faculty_activity_events (user_id, college_id, kind)
  SELECT id, col, k::faculty_event_kind FROM users, unnest(ARRAY['smartboard_session','summary_shared','infographic_shared']) AS k WHERE email = 'faculty@ait.edu.in';
  INSERT INTO booster_step_completions (user_id, track, step) SELECT id, 'active-learning', 'a1' FROM users WHERE email = 'faculty@ait.edu.in';
  INSERT INTO audit_log (college_id, actor_user_id, actor_name, action, target_type, target_id)
  VALUES (col, hod, 'Dr. S. Venkatesh', 'Course published to students', 'learning_course', (SELECT public_id FROM learning_courses WHERE id = lc));
END $$;

-- ── Departments each college runs (migration 0002) ─────────────────────────────────────────
INSERT INTO college_departments (college_id, department_id, head_name, established, email)
SELECT c.id, d.id,
       (SELECT u.full_name FROM role_assignments ra JOIN users u ON u.id = ra.user_id
         WHERE ra.college_id = c.id AND ra.role = 'hod' AND ra.department_id = d.id ORDER BY ra.created_at LIMIT 1),
       c.established,
       CASE WHEN d.id = (SELECT min(d2.id) FROM departments d2 WHERE d2.stream_key = d.stream_key) THEN 'hod@' || split_part(c.email::text, '@', 2) END
FROM colleges c
JOIN college_types ct ON ct.name = c.type
JOIN departments d ON d.stream_key = ct.stream_key AND d.name NOT LIKE '%Administration'
ON CONFLICT (college_id, department_id) DO NOTHING;

COMMIT;
