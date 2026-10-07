# CollossusIQ.ai — Frontend

AI-native Higher-Education OS frontend, built from the requirement documents `COLLOSSUSIQ.docx` and `COLLOSSUSIQ2.docx`.

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4 · TanStack Query · Zod · Recharts · lucide-react
- **Theme:** "Scholar Indigo" — deep indigo → violet gradients, academic gold and teal on warm paper neutrals; **Poppins** typeface; **Flaticon UIcons** (self-hosted, credited in the footer as the free licence requires); full light/dark mode.
- **Scope:** public marketing site, secure sign-in with MFA, and **8 role portals** (Student, Faculty, HOD, Placement, Incubation, Institution leadership, Recruiter, Platform admin) covering every module in the documents, plus **Student Admissions**, **Staff Management**, **User Management**, **Roles & Permissions** and a public **online application** page at `/apply`.

## One university, many colleges

The app runs as a single university (`src/config/tenancy.ts`) with any number of colleges.

| Who | Scope | Can do |
|---|---|---|
| **University Super Admin** (`admin`) | "All colleges" or any one college (switcher in the top bar) | University dashboard; add / configure / suspend / delete colleges; switch module areas on or off per college; manage admissions, staff, users, courses and events in every college |
| Principal, HOD, faculty, students, … | Exactly one college, chosen at sign-in | Everything their role allows — only for their own college |

- **Isolation:** admissions, staff, users, courses and events belong to a college (`collegeId`). The API filters every list to the caller's college, and records from another college return 404. The college of a new record comes from the session, never from the browser (only the Super Admin at "All colleges" scope picks one). Records cannot be moved between colleges by editing.
- **Suspension:** setting a college to *Suspended* signs its users out on their next request and blocks new sign-ins. Colleges still *Onboarding* cannot sign in yet. A college can only be deleted once it has no records.
- **Module control:** each college has a list of enabled areas (Career, Campus Life, Placement, Incubation, Admissions, …). Disabled areas disappear from menus, their pages return 404 and their APIs return 403.
- **Public applications** (`/apply`) ask which college the applicant is applying to, and only list colleges that are accepting applications.

Demo sign-in: pick **Super Admin** for university level, or any other role plus a college.

### Streams: engineering, medical, arts & science (and management, polytechnic)

Each college's **type** maps to an academic stream (`src/config/streams.ts`), which decides its departments, programmes, terms, entrance exam and regulator:

| Stream | College types | Programmes (examples) | Terms | Entrance | Regulator |
|---|---|---|---|---|---|
| Engineering | Engineering | B.E. / B.Tech / M.E. | Semesters 1–8 | TNEA cut-off /200 | AICTE |
| Medical & Health Sciences | Medical College & Hospital, Dental College, Nursing & Allied Health | MBBS, BDS, B.Sc Nursing, BPT, B.Pharm, MD/MS | Phase I – III, Internship (CRMI) | NEET /720 | NMC · DCI · INC · PCI |
| Arts & Science | Arts & Science | B.A., B.Sc., B.Com, BCA, BBA, M.A., M.Sc., M.Com | Semesters 1–6 | Merit /100 | UGC · CBCS · NAAC |

- Forms show only the stream's programmes, departments, designations and terms, and relabel the entrance score (e.g. *NEET score (out of 720)*). The API enforces the same rules, so a medical college cannot record a B.E. programme and an engineering cut-off cannot exceed 200.
- Stream-only modules: **Clinical Rotations** (add / edit / delete), **Competency Logbook (CBME)**, **OSCE & Skills Lab**, **Teaching Hospital** and **NMC Compliance** for medical colleges; **CBCS & Electives** for arts & science; **NAAC readiness** and **AICTE compliance** where they apply. They are hidden (404 / 403) in other streams.
- Students, principals, HODs and faculty see stream-appropriate subjects, courses and dashboards (Pathology and logbooks for MBBS; Accounts and CBCS electives for B.Com; DBMS for B.E.).
- Seed colleges: 2 engineering, 1 arts & science, 1 medical college & hospital, 1 nursing & allied health institute, 1 management, 1 polytechnic (onboarding).

## College websites & college login

| Page | Who | What |
|---|---|---|
| `/colleges` | Public | Directory of active colleges, grouped by stream |
| `/colleges/[id]` | Public | College landing page: hero image, announcement, stats, about, principal's message, highlights, programmes, departments, upcoming events, photo gallery (with lightbox), contact, Apply button |
| `/colleges/[id]/login` | Students & staff | College-branded sign-in: the college is fixed, only college roles are offered, and signing out returns here |

Principals (and the Super Admin inside a college) manage the content in **College Website** (tagline, hero image, about, highlights, contact, show/hide events and gallery) and **Photo Gallery** (add / edit / delete, publish or draft). Events come from the college's published **Campus Events**.

Images: upload PNG / JPEG / WebP up to 2 MB, or pick from the bundled campus illustrations in `public/campus/`. Uploads are signature-checked on the server, stored under random ids, and served with `nosniff` and a sandboxing CSP; SVG uploads and external image URLs are rejected. Onboarding or suspended colleges have no public page.

## AI courses, quizzes, certificates and placement readiness

| Module | Who | What |
|---|---|---|
| **AI Course Studio** | Faculty (drafts), HOD / Principal (publish) | Four steps: **1 Course details** (department, title, term, credits, faculty; lessons built from the *course title* or a *pasted syllabus*) → **2 Lessons** (edit, add or delete units and lessons, with a student preview) → **3 Final assessment** (30 questions generated from the lessons; edit, add or regenerate) → **4 Publish** to students (also adds the course to Course Management). |
| **My Courses** | Students | Published department courses only, and read-only. Lessons open one after another; "Mark complete & next" unlocks the next lesson. After the last lesson, the 30-question final assessment unlocks, and passing it issues a course certificate. |
| **AI Quiz Builder** | Faculty, HOD | Generate department MCQs from a curated bank (plus template questions flagged **review**), edit every question, answer and explanation, then set the pass mark, time limit and certificate option. It won't publish while any question is still flagged. Also shows attempts, average and pass rate for each quiz. |
| **My Quizzes** | Students | Timed quiz player. Marking happens on the server (the answer key never reaches the browser). 3 attempts per quiz; the best mark counts. |
| **My Certificates / Issued Certificates** | Students / staff | Certificates graded by mark: **O** ≥ 90, **A+** ≥ 80, **A** ≥ 70, **B** ≥ 60, **C** ≥ pass mark (below it: RA, no certificate). Each one is HMAC-signed and has a public, printable verification page at `/verify/CIQ-YYYY-XXXXXXXX`. |
| **Placement Readiness** | Students | Total out of 100 = quiz average 35 % + certificates 20 % (4 = full marks) + aptitude 15 % + mock interview 15 % + resume 15 %, with a checklist of what is still missing. |
| **Placement Readiness Board** | Placement officer, HOD, Principal, Super Admin | Every student's total, gaps and status, with filters and a CSV shortlist export. |

**Course content.** Every course opens with a *Getting started* chapter (course map, how it works) and ends with a *Course revision* chapter (every chapter's key points on one board).

For titles that match the curated library — DBMS, Data Structures, Operating Systems, Python, General Pathology, Fundamentals of Nursing, Financial Accounting and Financial Management — each topic becomes a chapter with three lessons:
- **Key concepts** — introduction, a concept map of the key points, and key-term cards.
- **Worked example** — a real calculation, table or code walk-through, plus a "Watch out" panel of common mistakes.
- **Practice & recap** — a recap checklist and practice questions with model answers.

That gives around 30 lessons per course (the DBMS course has 12 chapters and 32 lessons). Each chapter gets a generated banner image, and lessons carry suggested YouTube, NPTEL and Wikipedia searches under **Watch & read**.

Faculty can pin specific videos to any lesson and upload images or diagrams (PNG, JPEG or WebP up to 2 MB) with captions. YouTube videos play inside the lesson through youtube-nocookie.com, the only site the security policy allows to be embedded. NPTEL, SWAYAM and Khan Academy links open in a new tab, and any other link is rejected by the server.

The 30 final-assessment questions come from the key terms ("which term means…") and key points ("which chapter teaches…") that students read. Pasted syllabi are parsed Anna-University style ("Unit I: …", topics separated by "–" or ";", text books ignored); their lessons are generic drafts for faculty to enrich. Questions the generator cannot ground in the course are marked **review**. A course cannot be published until they are reviewed. The server enforces the lesson order and the final-assessment lock.

**Placement ready** = total ≥ 70 **and** quiz average ≥ 60 % **and** ≥ 2 certificates **and** mock interview ≥ 50. "Almost ready" means a total ≥ 55; anything lower is "Needs work".

Safeguards:
- Quizzes are scoped to a college.
- Departments must belong to the college's stream.
- Quiz options are shuffled on the server.
- A quiz that has attempts can be closed but not deleted, so marks stay verifiable.
- Verification is rate-limited and reveals only certificate facts.
- A tampered record fails its signature check.
- Roll numbers on the board are masked.
- CSV cells that start with `= + - @` are neutralised so they can't run as spreadsheet formulas.

## Add / edit / delete (CRUD) pages

Modules with template `crud` get four pages automatically, driven by `src/config/resources.ts`:

| Route | Page |
|---|---|
| `/[role]/[module]` | List with search, status filter chips, pagination and row actions |
| `/[role]/[module]/new` | Sectioned add form with live validation |
| `/[role]/[module]/[id]` | Detail view (admissions add a stage timeline and a "Move to next stage" button) |
| `/[role]/[module]/[id]/edit` | Edit form with an unsaved-changes guard and version-conflict detection |

Resources: `admissions`, `staff`, `users`, `courses`, `events`. One Zod schema validates in the browser and on the server; unknown fields are rejected; only roles with the resource's manage permission can write; view-only roles see contact details masked; deleting staff or users requires typing the record ID. To add a resource, define it in `resources.ts`, seed it in `src/lib/api/mock/records.ts`, and add a registry entry with `template: "crud"`.

## Quick start

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET and MFA_ENCRYPTION_KEY to 32+ random characters
npm run dev                  # http://localhost:3000
```

The full guide (PostgreSQL, migrations, production checklist, the Super Admin's first-run checklist and every
integration: cloud storage, email, WhatsApp, SMS, payments, SSO, online classes, ERP webhook) is in
[docs/SETUP.md](docs/SETUP.md). Every environment variable is documented in [.env.example](.env.example).

Sign in with any email and a password of 8+ characters, choose a portal, then enter the demo MFA code **246810**.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (Next + `eslint-plugin-security`, `react/no-danger`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (security helpers, sessions, mock API authorisation, registry coverage) |
| `npm run audit` | `npm audit --omit=dev` |

## Mock vs live API

All data flows through one client, `src/lib/api/client.ts`, against the REST contract in the requirements (`/api/v1/...`).

- `NEXT_PUBLIC_API_MODE=mock` (default): requests are served by `src/app/api/v1/[...path]/route.ts`, a mock backend with realistic sample data that enforces authentication, role checks, CSRF, origin checks, body limits, validation and rate limits.
- `NEXT_PUBLIC_API_MODE=live` + `NEXT_PUBLIC_API_BASE_URL=https://api.example.edu`: the same pages call your real backend and the mock is disabled. The backend's origin is added to the CSP `connect-src` automatically.

Every response is validated with the Zod schemas in `src/lib/api/schemas.ts`, which double as the API contract for backend developers.

## How the modules are organised

`src/config/modules.ts` is the **module registry** — the single source of truth for every module (slug, group, roles, phase, template, agent). Navigation, routing, search, the marketing "Platform" page and the mock API are all driven by it.

- `/[role]` — role home (student command center, or the role dashboards).
- `/[role]/[module]` — renders either a **bespoke screen** (`src/components/portal/bespoke/*`: AI Mentor, Study Planner, Courses, Mock Tests, Handwritten Evaluation, Evaluation Review, Resume Builder, Mock Interview, Project Hub) or one of nine **templates** (`src/components/modules/templates.tsx`: dashboard, list/detail, workflow, scorecard, calendar, settings, gallery, chat, generator).

To add a module: add an entry to the registry, then add its data under `src/lib/api/mock/module-data.ts` (or serve it from your backend). A unit test fails if any templated module lacks data.

```
src/
  app/                  routes: (marketing), login, [role], api/v1 (mock backend)
  components/           ui primitives, shell, charts, templates, portal screens, auth
  config/               module registry, AI agent catalogue
  lib/api/              client, schemas, mock backend (fixtures, AI stubs, router)
  lib/auth/             roles & permissions, signed sessions, server guards
  lib/security/         redirect guard, sanitisers, upload validation, throttling
  lib/i18n/             English, Tamil, Hindi UI strings
  proxy.ts              per-request CSP nonce + auth/role gate (Next 16 "proxy")
tests/                  Vitest suites
```

## Security

See [SECURITY.md](SECURITY.md) for the controls in place and what the real backend must enforce.

## Known limits of this build

- AI responses in mock mode are deterministic stand-ins, not model calls.
- Several action buttons in list modules ("Add course", "Invite user", …) show a notice instead of opening forms until a live backend exists.
- Mock state (interview sessions, evaluation overrides, audit trail) is in memory and resets when the server restarts.
- Translations cover the shell and home screens; module content is English.
