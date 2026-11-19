# ColossusIQ — entity-relationship diagrams

Source of truth: [`db/migrations/0001_init.sql`](../../db/migrations/0001_init.sql). Column-level detail is in the
[data dictionary](data-dictionary.md). The diagrams are split by domain; each shows keys and the columns that matter for
relationships. `colleges`, `users` and `students` appear in several diagrams as the shared anchors.

Legend: `||--o{` one-to-many · `||--o|` one-to-zero-or-one · `}o--||` many-to-one.

## 1. Overview

```mermaid
erDiagram
  universities ||--o{ colleges : "affiliates"
  universities ||--o{ users : "accounts"
  streams ||--o{ college_types : "classifies"
  college_types ||--o{ colleges : "type of"
  colleges ||--o{ role_assignments : "grants"
  users ||--o{ role_assignments : "holds"
  colleges ||--o{ students : "enrols"
  colleges ||--o{ staff : "employs"
  colleges ||--o{ admissions : "receives"
  colleges ||--o{ courses : "offers"
  colleges ||--o{ learning_courses : "publishes"
  colleges ||--o{ quizzes : "runs"
  colleges ||--o{ events : "hosts"
  colleges ||--o| college_websites : "public site"
  users ||--o| students : "is"
  users ||--o| staff : "is"
  admissions ||--o| students : "becomes"
  students ||--o{ quiz_attempts : "takes"
  students ||--o{ certificates : "earns"
  students ||--o{ lesson_progress : "completes"
```

## 2. Tenancy, lookups and identity

```mermaid
erDiagram
  universities {
    uuid id PK
    text slug UK
    text name
  }
  streams {
    text key PK "engineering, medical, artsScience, management, polytechnic"
    text term_label
    int entrance_max
  }
  college_types {
    text name PK
    text stream_key FK
  }
  departments {
    int id PK
    text stream_key FK
    text name
  }
  programmes {
    int id PK
    text stream_key FK
    text name
  }
  terms {
    int id PK
    text stream_key FK
    text name
    smallint position
  }
  designations {
    int id PK
    text stream_key FK "NULL = common to all streams"
    text name
  }
  colleges {
    uuid id PK
    text public_id UK "COL-1001"
    uuid university_id FK
    text type FK
    char code
    college_plan plan
    college_status status
  }
  college_modules {
    uuid college_id PK, FK
    module_group module PK
  }
  users {
    uuid id PK
    text public_id UK "USR-…"
    uuid university_id FK
    citext email UK
    user_status status
  }
  role_assignments {
    uuid id PK
    uuid user_id FK
    app_role role
    uuid college_id FK "NULL only for admin / recruiter"
    int department_id FK "HOD / faculty scope"
  }
  user_credentials {
    uuid user_id PK, FK
    text password_hash "argon2id"
  }
  user_mfa {
    uuid user_id PK, FK
    bytea totp_secret_encrypted
  }
  user_sessions {
    uuid id PK
    uuid user_id FK
    app_role role
    uuid college_id FK
    timestamptz revoked_at
  }

  universities ||--o{ colleges : ""
  universities ||--o{ users : ""
  streams ||--o{ college_types : ""
  streams ||--o{ departments : ""
  streams ||--o{ programmes : ""
  streams ||--o{ terms : ""
  streams ||--o{ designations : ""
  college_types ||--o{ colleges : ""
  colleges ||--o{ college_modules : ""
  users ||--o{ role_assignments : "holds"
  users ||--o{ role_assignments : "granted_by"
  colleges ||--o{ role_assignments : ""
  departments ||--o{ role_assignments : ""
  users ||--o| user_credentials : ""
  users ||--o| user_mfa : ""
  users ||--o{ user_sessions : ""
  colleges ||--o{ user_sessions : ""
```

## 3. People and admissions

```mermaid
erDiagram
  admissions {
    uuid id PK
    text public_id UK "ADM-26-1001"
    uuid college_id FK
    int programme_id FK
    numeric entrance_score "≤ stream entrance_max"
    admission_status status
  }
  admission_documents {
    uuid admission_id PK, FK
    admission_document document PK
  }
  admission_status_history {
    bigint id PK
    uuid admission_id FK
    admission_status from_status
    admission_status to_status
    uuid changed_by FK
  }
  students {
    uuid id PK
    uuid user_id FK, UK
    uuid college_id FK
    uuid admission_id FK, UK
    text roll_no "unique per college"
    int department_id FK
    int programme_id FK
    int term_id FK
  }
  staff {
    uuid id PK
    text public_id UK "EMP-…"
    uuid college_id FK
    uuid user_id FK, UK "optional platform account"
    citext email UK
    int department_id FK
    int designation_id FK
  }
  colleges {
    uuid id PK
  }
  users {
    uuid id PK
  }
  programmes {
    int id PK
  }
  departments {
    int id PK
  }
  designations {
    int id PK
  }

  colleges ||--o{ admissions : ""
  programmes ||--o{ admissions : ""
  admissions ||--o{ admission_documents : ""
  admissions ||--o{ admission_status_history : "trigger-logged"
  users ||--o{ admission_status_history : ""
  admissions ||--o| students : "enrolled as"
  users ||--o| students : ""
  colleges ||--o{ students : ""
  departments ||--o{ students : ""
  colleges ||--o{ staff : ""
  users ||--o| staff : ""
  departments ||--o{ staff : ""
  designations ||--o{ staff : ""
```

## 4. Campus records and media

```mermaid
erDiagram
  courses {
    uuid id PK
    text public_id UK "CRS-…"
    uuid college_id FK
    text code "unique per college, e.g. CS3492"
    int department_id FK
    int term_id FK
    uuid faculty_staff_id FK
  }
  events {
    uuid id PK
    text public_id UK "EVT-…"
    uuid college_id FK
    event_status status
  }
  event_registrations {
    uuid event_id PK, FK
    uuid student_id PK, FK
  }
  clinical_rotations {
    uuid id PK
    text public_id UK "ROT-… (medical colleges only)"
    uuid college_id FK
    uuid student_id FK
    uuid supervisor_staff_id FK
    date start_date
    date end_date
  }
  gallery_items {
    uuid id PK
    text public_id UK "GAL-…"
    uuid college_id FK
    uuid image_media_id FK "or image_builtin"
  }
  college_websites {
    uuid college_id PK, FK
    uuid hero_media_id FK "or hero_builtin"
  }
  media_assets {
    uuid id PK
    text public_id UK "MED-…"
    uuid college_id FK "NULL = university-wide"
    media_type content_type
    int byte_size "≤ 2 MB"
    uuid uploaded_by FK
  }
  colleges {
    uuid id PK
  }
  students {
    uuid id PK
  }
  staff {
    uuid id PK
  }

  colleges ||--o{ courses : ""
  staff ||--o{ courses : "teaches"
  colleges ||--o{ events : ""
  events ||--o{ event_registrations : ""
  students ||--o{ event_registrations : ""
  colleges ||--o{ clinical_rotations : ""
  students ||--o{ clinical_rotations : ""
  staff ||--o{ clinical_rotations : "supervises"
  colleges ||--o{ gallery_items : ""
  media_assets ||--o{ gallery_items : ""
  colleges ||--o| college_websites : ""
  media_assets ||--o{ college_websites : "hero"
  colleges ||--o{ media_assets : ""
```

## 5. Learning — AI Course Studio and My Courses

```mermaid
erDiagram
  learning_courses {
    uuid id PK
    text public_id UK "LC-…"
    uuid college_id FK
    int department_id FK
    int term_id FK
    uuid course_record_id FK, UK "→ courses"
    publish_status status
    uuid created_by FK
  }
  course_outcomes {
    uuid course_id PK, FK
    text code PK "CO1…"
    bloom_level bloom
  }
  course_units {
    uuid id PK
    uuid course_id FK
    smallint position "deferrable unique"
    text part
  }
  lessons {
    uuid id PK
    uuid unit_id FK
    uuid course_id FK
    text code "L1… unique per course"
    lesson_layout layout
    jsonb key_points
    jsonb terms
    jsonb practice
  }
  lesson_images {
    uuid lesson_id PK, FK
    smallint position PK
    uuid image_media_id FK "or image_builtin"
  }
  lesson_videos {
    uuid lesson_id PK, FK
    smallint position PK
    video_kind kind
    text youtube_id
  }
  lesson_progress {
    uuid student_id PK, FK
    uuid lesson_id PK, FK
    timestamptz completed_at
  }
  courses {
    uuid id PK
  }
  students {
    uuid id PK
  }
  media_assets {
    uuid id PK
  }

  courses ||--o| learning_courses : "published as"
  learning_courses ||--o{ course_outcomes : ""
  learning_courses ||--o{ course_units : ""
  course_units ||--o{ lessons : ""
  learning_courses ||--o{ lessons : ""
  lessons ||--o{ lesson_images : ""
  media_assets ||--o{ lesson_images : ""
  lessons ||--o{ lesson_videos : ""
  lessons ||--o{ lesson_progress : ""
  students ||--o{ lesson_progress : ""
```

## 6. Assessment and certificates

```mermaid
erDiagram
  quizzes {
    uuid id PK
    text public_id UK "QZ-…"
    uuid college_id FK
    quiz_purpose purpose "department | placement_aptitude | course_final"
    uuid learning_course_id FK, UK "final assessment only"
    int department_id FK
    smallint pass_mark "30–90"
  }
  quiz_questions {
    uuid id PK
    uuid quiz_id FK
    smallint position "deferrable unique"
    text_array options "exactly 4"
    smallint answer "0–3"
  }
  quiz_attempts {
    uuid id PK
    uuid quiz_id FK
    uuid student_id FK
    smallint attempt_no "1–3, unique per quiz+student"
    numeric percentage
  }
  quiz_attempt_answers {
    uuid attempt_id PK, FK
    uuid question_id PK, FK
    smallint chosen
    boolean correct
  }
  certificates {
    uuid id PK
    text public_id UK "CIQ-2026-XXXXXXXX"
    uuid quiz_id FK
    uuid attempt_id FK, UK
    uuid student_id FK
    certificate_grade grade
    text signature "HMAC-SHA256, base64url"
    uuid superseded_by_id FK "one active per quiz+student"
  }
  learning_courses {
    uuid id PK
  }
  students {
    uuid id PK
  }

  learning_courses ||--o| quizzes : "final assessment"
  quizzes ||--o{ quiz_questions : ""
  quizzes ||--o{ quiz_attempts : ""
  students ||--o{ quiz_attempts : ""
  quiz_attempts ||--o{ quiz_attempt_answers : ""
  quiz_questions ||--o{ quiz_attempt_answers : ""
  quiz_attempts ||--o| certificates : "issues"
  students ||--o{ certificates : ""
  certificates ||--o{ certificates : "superseded by"
```

## 7. Teaching tools

```mermaid
erDiagram
  lesson_outlines {
    uuid id PK
    text public_id UK "LO-…"
    uuid college_id FK
    uuid author_id FK
    jsonb blocks
  }
  class_summaries {
    uuid id PK
    text public_id UK "CS-…"
    uuid college_id FK
    uuid author_id FK
    int department_id FK "audience"
    jsonb points
    jsonb infographic "optional snapshot"
    timestamptz withdrawn_at
  }
  class_summary_reads {
    uuid summary_id PK, FK
    uuid student_id PK, FK
    timestamptz read_at
  }
  booster_step_completions {
    uuid user_id PK, FK
    text track PK
    text step PK
  }
  faculty_activity_events {
    bigint id PK
    uuid user_id FK
    faculty_event_kind kind "append-only"
  }
  users {
    uuid id PK
  }
  students {
    uuid id PK
  }
  departments {
    int id PK
  }

  users ||--o{ lesson_outlines : "authors"
  users ||--o{ class_summaries : "shares"
  departments ||--o{ class_summaries : ""
  class_summaries ||--o{ class_summary_reads : ""
  students ||--o{ class_summary_reads : ""
  users ||--o{ booster_step_completions : ""
  users ||--o{ faculty_activity_events : ""
```

## 8. Evaluation, career and platform

```mermaid
erDiagram
  evaluation_items {
    uuid id PK
    uuid college_id FK
    uuid student_id FK
    uuid assigned_to FK
    jsonb ai_result
    evaluation_status status
    uuid reviewed_by FK
  }
  evaluation_overrides {
    bigint id PK
    uuid item_id FK
    uuid overridden_by FK
    numeric final_score
    text reason "append-only"
  }
  interview_sessions {
    uuid id PK
    uuid student_id FK
    interview_mode mode
    smallint overall_score
    jsonb scorecard
  }
  resume_analyses {
    uuid id PK
    uuid student_id FK
    smallint ats_score
    jsonb result
  }
  notifications {
    uuid id PK
    uuid user_id FK
    ui_tone tone
    timestamptz read_at
  }
  audit_log {
    bigint id PK
    uuid college_id FK
    uuid actor_user_id FK
    text action "append-only"
  }
  students {
    uuid id PK
  }
  users {
    uuid id PK
  }

  students ||--o{ evaluation_items : ""
  users ||--o{ evaluation_items : "assigned / reviewed"
  evaluation_items ||--o{ evaluation_overrides : ""
  students ||--o{ interview_sessions : ""
  students ||--o{ resume_analyses : ""
  users ||--o{ notifications : ""
  users ||--o{ audit_log : ""
```

The view **`v_placement_readiness`** (one row per student) combines `quiz_attempts`, `certificates`,
`interview_sessions` and `resume_analyses`; see the data dictionary for its formula.
