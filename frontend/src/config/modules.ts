import type { Role } from "@/lib/auth/roles";
import type { Stream } from "./streams";

export type TemplateKind =
  | "dashboard"
  | "list"
  | "workflow"
  | "chat"
  | "generator"
  | "scorecard"
  | "calendar"
  | "settings"
  | "gallery"
  | "crud"
  | "bespoke";

export type Phase = "MVP" | "Phase 2" | "Phase 3" | "Phase 4";

export interface ModuleDef {
  slug: string;
  title: string;
  description: string;
  group: string;
  roles: Role[];
  template: TemplateKind;
  icon: IconName;
  phase: Phase;
  /** Agent used by chat/generator templates. */
  agent?: string;
  /** Non-diagnostic / human-oversight notice rendered at the top of the module. */
  notice?: string;
  /** CRUD resource key (see src/config/resources.ts) for template "crud". */
  resource?: string;
  /** Only shown for colleges of these academic streams (omit = every stream). */
  streams?: Stream[];
}

export type IconName =
  | "home" | "bot" | "calendar" | "book" | "chart" | "target" | "graph" | "passport" | "brain"
  | "test" | "exam" | "pen" | "mic" | "trophy" | "bank" | "briefcase" | "file" | "compass"
  | "store" | "gauge" | "chat" | "users" | "languages" | "award" | "lightbulb" | "rocket"
  | "search" | "flask" | "code" | "review" | "party" | "wand" | "flag" | "ball" | "star"
  | "gamepad" | "heart" | "school" | "network" | "clipboard" | "layers" | "shield" | "building"
  | "bell" | "settings" | "plug" | "cpu" | "eye" | "scroll" | "credit" | "toggle" | "alert"
  | "database" | "handshake" | "list" | "coins" | "upload" | "admission" | "staff" | "userlock"
  | "key" | "diploma" | "stethoscope" | "notebook" | "hospital" | "board";

const ALL_STAFF: Role[] = ["faculty", "hod", "institution"];

export const MODULE_GROUPS = [
  "Overview",
  "University",
  "Student Success",
  "Academics",
  "Clinical & Hospital",
  "Assessment",
  "AI Course & Certification",
  "Career",
  "Communication & Skills",
  "Project & Innovation",
  "Campus Life",
  "Faculty",
  "Department",
  "Placement",
  "Incubation",
  "Admissions",
  "College Website",
  "Staff & Users",
  "Institution",
  "Recruiter",
  "Platform",
] as const;

export const MODULES: ModuleDef[] = [
  // ───────────── Student Success ─────────────
  { slug: "mentor", title: "AI Mentor", description: "Your persistent academic & career mentor that knows your progress, goals and weak areas.", group: "Student Success", roles: ["student"], template: "bespoke", icon: "bot", phase: "MVP", agent: "mentor" },
  { slug: "study-planner", title: "AI Study Planner", description: "Tell the planner your deadline — get a day-by-day schedule with revision slots and mock tests.", group: "Student Success", roles: ["student"], template: "bespoke", icon: "calendar", phase: "MVP", agent: "study-planner" },
  { slug: "daily-plan", title: "Daily Routine", description: "Classes, study, projects, exercise and clubs combined into one realistic daily schedule.", group: "Student Success", roles: ["student"], template: "calendar", icon: "calendar", phase: "Phase 3" },
  { slug: "academic-tracker", title: "Academic Tracker", description: "Semester progress, internal marks, attendance and subject-wise performance.", group: "Student Success", roles: ["student"], template: "dashboard", icon: "chart", phase: "MVP" },
  { slug: "skill-graph", title: "Skill Graph", description: "Every skill you are building — learned, in progress, weak, missing or job-ready.", group: "Student Success", roles: ["student"], template: "scorecard", icon: "graph", phase: "Phase 2" },
  { slug: "mission-planner", title: "Mission Planner", description: "Turn \"where do I want to be after graduation?\" into semester, monthly, weekly and daily plans.", group: "Student Success", roles: ["student"], template: "bespoke", icon: "target", phase: "Phase 2" },
  { slug: "study-twin", title: "AI Study Twin", description: "How you learn best — pace, strong and weak subjects, revision behaviour — adapted over time.", group: "Student Success", roles: ["student"], template: "scorecard", icon: "brain", phase: "Phase 2" },
  { slug: "passport", title: "Digital Student Passport", description: "Your verified employability profile: academics, skills, projects, activities and achievements.", group: "Student Success", roles: ["student"], template: "gallery", icon: "passport", phase: "Phase 3" },

  // ───────────── Academics ─────────────
  { slug: "courses", title: "My Courses", description: "Courses published by your department — read each lesson, then take the 30-question final assessment for your certificate.", group: "Academics", roles: ["student"], template: "bespoke", icon: "book", phase: "MVP" },
  { slug: "class-notes", title: "Class Notes", description: "Class summaries, homework, resources and infographic handouts shared by your faculty after each class.", group: "Academics", roles: ["student"], template: "bespoke", icon: "notebook", phase: "MVP" },
  { slug: "course-management", title: "Course Management", description: "Create, edit and retire courses — code, credits, semester and assigned faculty.", group: "Academics", roles: ["faculty", "hod", "institution", "admin"], template: "crud", resource: "courses", icon: "book", phase: "MVP" },
  { slug: "academic-calendar", title: "Academic Calendar", description: "Semester schedule, internal assessments, holidays and exam windows.", group: "Academics", roles: ["student", ...ALL_STAFF], template: "calendar", icon: "calendar", phase: "MVP" },
  { slug: "assignments", title: "Assignments", description: "Create, distribute and track assignments and lab submissions.", group: "Academics", roles: ["student", "faculty"], template: "bespoke", icon: "clipboard", phase: "MVP" },
  { slug: "document-ai", title: "Document AI", description: "Upload PDFs, slides or scanned notes — summarise, extract, generate flashcards and questions.", group: "Academics", roles: ["student", "faculty"], template: "generator", icon: "file", phase: "Phase 2", agent: "document" },

  { slug: "cbcs-electives", title: "CBCS & Electives", description: "Choice-based credit system: core, allied, skill-enhancement and elective choices with credit tracking.", group: "Academics", roles: ["student", "faculty", "hod", "institution"], template: "list", icon: "list", phase: "MVP", streams: ["artsScience", "management"] },

  // ───────────── Clinical & Hospital (medical colleges) ─────────────
  { slug: "clinical-rotations", title: "Clinical Rotations", description: "Schedule clinical postings by phase, department and ward; track attendance and certified competencies.", group: "Clinical & Hospital", roles: ["faculty", "hod", "institution", "admin"], template: "crud", resource: "rotations", icon: "stethoscope", phase: "MVP", streams: ["medical"] },
  { slug: "competency-logbook", title: "Competency Logbook (CBME)", description: "NMC competency-based logbook: K / KH / SH / P levels, faculty certification and pending sign-offs.", group: "Clinical & Hospital", roles: ["student", "faculty", "hod"], template: "list", icon: "notebook", phase: "MVP", streams: ["medical"] },
  { slug: "osce", title: "OSCE & Skills Lab", description: "Objective structured clinical examination stations, skills-lab bookings and checklist scores.", group: "Clinical & Hospital", roles: ["student", "faculty", "hod"], template: "list", icon: "heart", phase: "Phase 2", streams: ["medical"] },
  { slug: "hospital-dashboard", title: "Teaching Hospital", description: "Bed occupancy, OPD / IPD load and clinical material available for teaching.", group: "Clinical & Hospital", roles: ["institution", "hod", "admin"], template: "dashboard", icon: "hospital", phase: "Phase 2", streams: ["medical"] },
  { slug: "nmc-compliance", title: "NMC / Council Compliance", description: "Faculty strength, attendance, infrastructure and CBME requirements against council norms.", group: "Clinical & Hospital", roles: ["institution", "admin"], template: "scorecard", icon: "shield", phase: "MVP", streams: ["medical"] },

  // ───────────── Assessment ─────────────
  { slug: "mock-tests", title: "Mock Tests", description: "Adaptive topic-wise tests with AI evaluation, confidence and teacher-review flags.", group: "Assessment", roles: ["student"], template: "bespoke", icon: "test", phase: "MVP" },
  { slug: "exam-prep", title: "Exam Preparation", description: "Countdown, syllabus coverage, weak-topic remediation and last-minute revision.", group: "Assessment", roles: ["student"], template: "dashboard", icon: "exam", phase: "MVP" },
  { slug: "handwritten", title: "Handwritten Evaluation", description: "Upload an answer sheet — OCR, question mapping, rubric scoring and improvement feedback.", group: "Assessment", roles: ["student", "faculty"], template: "bespoke", icon: "pen", phase: "Phase 2", notice: "AI scores are suggestions with a confidence value. Faculty review and can override every mark; all overrides are audit-logged." },
  { slug: "viva", title: "Viva Simulator", description: "Project, subject and technical viva: an examiner asks, marks each answer and follows up.", group: "Assessment", roles: ["student"], template: "bespoke", icon: "mic", phase: "Phase 2", agent: "viva" },
  { slug: "competitive-exams", title: "Competitive Exams", description: "UPSC, SSC, Banking, Railway, TNPSC, GATE, UGC-NET, CAT and more.", group: "Assessment", roles: ["student"], template: "gallery", icon: "trophy", phase: "Phase 2" },
  { slug: "question-bank", title: "Question Bank", description: "Tagged questions by topic, difficulty, Bloom level and course outcome.", group: "Assessment", roles: ["faculty", "hod", "institution", "admin"], template: "crud", resource: "questions", icon: "database", phase: "MVP" },
  { slug: "evaluation", title: "AI Evaluation Review", description: "Review AI-suggested scores, evidence and missing concepts; approve or override.", group: "Assessment", roles: ["faculty", "hod"], template: "bespoke", icon: "review", phase: "MVP", notice: "Teachers always have the final say. AI output includes confidence and evidence and never publishes marks without approval." },

  // ───────────── AI Course & Certification ─────────────
  { slug: "ai-course-studio", title: "AI Course Studio", description: "Build a department course from a title or your own syllabus: lessons, outcomes and a 30-question final assessment. Then publish it to students.", group: "AI Course & Certification", roles: ["faculty", "hod", "institution"], template: "bespoke", icon: "wand", phase: "MVP", notice: "AI drafts lessons and questions. Review them before publishing; only the HOD or Principal can publish to students." },
  { slug: "quiz-builder", title: "AI Quiz Builder", description: "Generate department MCQs, edit them, set pass mark and time, enable certificates and track results.", group: "AI Course & Certification", roles: ["faculty", "hod"], template: "bespoke", icon: "test", phase: "MVP", notice: "Review every AI-generated question and answer key before publishing. Questions marked \"review\" were built from templates." },
  { slug: "my-quizzes", title: "My Quizzes", description: "Timed department quizzes, marked on the server. Pass to earn a verifiable certificate.", group: "AI Course & Certification", roles: ["student"], template: "bespoke", icon: "exam", phase: "MVP" },
  { slug: "my-certificates", title: "My Certificates", description: "Mark-based certificates (O, A+, A, B, C) with a public verification link for employers.", group: "AI Course & Certification", roles: ["student"], template: "bespoke", icon: "diploma", phase: "MVP" },
  { slug: "issued-certificates", title: "Issued Certificates", description: "Every certificate issued in your college, with grade, marks and verification status.", group: "AI Course & Certification", roles: ["faculty", "hod", "institution", "placement", "admin"], template: "bespoke", icon: "award", phase: "MVP" },

  // ───────────── Career ─────────────
  { slug: "career", title: "Career Planner & Twin", description: "Compare your current profile with your target role and close every gap.", group: "Career", roles: ["student"], template: "scorecard", icon: "compass", phase: "MVP" },
  { slug: "resume", title: "Resume Builder", description: "ATS-oriented resumes and role-specific versions with keyword and structure analysis.", group: "Career", roles: ["student"], template: "bespoke", icon: "file", phase: "MVP" },
  { slug: "job-prep", title: "Job Preparation", description: "Pick a role and company type — get skills, roadmap, coding, aptitude and interview prep.", group: "Career", roles: ["student"], template: "generator", icon: "briefcase", phase: "MVP", agent: "career" },
  { slug: "interview", title: "AI Mock Interview", description: "Technical, HR, behavioural and domain interviews with a readiness scorecard.", group: "Career", roles: ["student"], template: "bespoke", icon: "mic", phase: "MVP" },
  { slug: "opportunities", title: "Opportunity Marketplace", description: "Internships, jobs, hackathons, mentors and workshops matched to your verified profile.", group: "Career", roles: ["student"], template: "gallery", icon: "store", phase: "Phase 4" },
  { slug: "readiness", title: "Career Readiness", description: "Dimension-level readiness — not a single score that decides hiring.", group: "Career", roles: ["student"], template: "scorecard", icon: "gauge", phase: "MVP" },
  { slug: "placement-readiness", title: "Placement Readiness", description: "Your total out of 100 from quiz marks, certificates, aptitude, mock interview and resume — and what is left to become placement ready.", group: "Career", roles: ["student"], template: "bespoke", icon: "target", phase: "MVP" },

  // ───────────── Communication & Skills ─────────────
  { slug: "communication", title: "Communication Lab", description: "Presentation, public speaking, email and workplace conversation practice.", group: "Communication & Skills", roles: ["student"], template: "scorecard", icon: "chat", phase: "Phase 2" },
  { slug: "group-discussion", title: "GD & Debate Simulator", description: "Simulated multi-person discussions with AI participants and feedback.", group: "Communication & Skills", roles: ["student"], template: "chat", icon: "users", phase: "Phase 2", agent: "gd" },
  { slug: "languages", title: "Language Learning", description: "English, Tamil, Hindi, Telugu, Kannada, Malayalam, French, German, Japanese and more.", group: "Communication & Skills", roles: ["student", "faculty"], template: "bespoke", icon: "languages", phase: "Phase 2", agent: "language" },
  { slug: "certifications", title: "Certification Roadmap", description: "Recommended certifications sequenced against your career target.", group: "Communication & Skills", roles: ["student"], template: "workflow", icon: "award", phase: "Phase 2" },

  // ───────────── Project & Innovation ─────────────
  { slug: "projects", title: "Project Hub", description: "Idea → team → architecture → milestones → AI review → faculty review → demo → portfolio.", group: "Project & Innovation", roles: ["student", "faculty"], template: "bespoke", icon: "lightbulb", phase: "MVP" },
  { slug: "project-ideas", title: "Project Idea Generator", description: "Enter department, skills, interests, budget and team size — get feasible project concepts.", group: "Project & Innovation", roles: ["student"], template: "generator", icon: "wand", phase: "MVP", agent: "project" },
  { slug: "team-finder", title: "Team Finder", description: "Discover teammates by skills, department, interests and competition goals.", group: "Project & Innovation", roles: ["student"], template: "list", icon: "users", phase: "Phase 3" },
  { slug: "startup-hub", title: "Startup Idea Hub", description: "Problem discovery, business model, market analysis, pitch and MVP planning.", group: "Project & Innovation", roles: ["student"], template: "workflow", icon: "rocket", phase: "Phase 2" },
  { slug: "research", title: "Research Assistant", description: "Research questions, literature discovery and comparison, planning and academic writing.", group: "Project & Innovation", roles: ["student", "faculty"], template: "bespoke", icon: "flask", phase: "Phase 2", agent: "research" },
  { slug: "hackathons", title: "Hackathon Hub", description: "Upcoming hackathons, teams, problem statements and results.", group: "Project & Innovation", roles: ["student", "incubation"], template: "list", icon: "code", phase: "Phase 3" },
  { slug: "project-review", title: "AI Project Review Board", description: "Architecture, documentation, code quality, tests, innovation and risk review for faculty.", group: "Project & Innovation", roles: ["faculty", "hod"], template: "scorecard", icon: "review", phase: "Phase 2" },

  // ───────────── Campus Life ─────────────
  { slug: "events", title: "Campus Events", description: "College and department events, seminars, workshops, cultural and alumni events.", group: "Campus Life", roles: ["student", ...ALL_STAFF, "admin"], template: "crud", resource: "events", icon: "party", phase: "Phase 3" },
  { slug: "event-generator", title: "AI Event Generator", description: "\"Create a one-day technology event for 500 students\" — agenda, budget, promotion and forms.", group: "Campus Life", roles: ["faculty", "hod", "institution"], template: "bespoke", icon: "wand", phase: "Phase 3", agent: "event" },
  { slug: "clubs", title: "Clubs", description: "Technical, cultural and social clubs, membership and activities.", group: "Campus Life", roles: ["student", "institution"], template: "list", icon: "flag", phase: "Phase 3" },
  { slug: "sports", title: "Sports", description: "Teams, tournaments, registrations and achievements.", group: "Campus Life", roles: ["student", "institution"], template: "list", icon: "ball", phase: "Phase 3" },
  { slug: "experience", title: "Experience Passport", description: "Record volunteering, leadership, competitions and more; faculty verify each entry.", group: "Campus Life", roles: ["student", "faculty", "hod"], template: "bespoke", icon: "star", phase: "Phase 3" },
  { slug: "refresh-zone", title: "Refresh Zone", description: "Short brain breaks with saved scores: subject quiz battles, aptitude and vocabulary rounds, a memory game and guided breathing.", group: "Campus Life", roles: ["student"], template: "bespoke", icon: "gamepad", phase: "Phase 3" },
  { slug: "achievements", title: "XP & Badges", description: "Your XP, level, streak and badges from real quizzes, courses and assignments, plus your class rank.", group: "Campus Life", roles: ["student"], template: "bespoke", icon: "trophy", phase: "Phase 3" },
  { slug: "wellness", title: "Wellness & Habits", description: "Educational content on sleep, hydration, breaks, screen time and healthy routines.", group: "Campus Life", roles: ["student"], template: "calendar", icon: "heart", phase: "Phase 3", notice: "This area is educational and non-diagnostic. If you are struggling, please reach out to your student counsellor or the Student Welfare Office. In an emergency, call 112 (India)." },
  { slug: "campus-assistant", title: "Campus Assistant", description: "Ask anything about your campus — answered from institution-approved sources.", group: "Campus Life", roles: ["student", "faculty"], template: "chat", icon: "school", phase: "Phase 3", agent: "knowledge" },
  { slug: "alumni", title: "Alumni Network", description: "Mentors, speakers, recruiters and project advisors matched to your goals.", group: "Campus Life", roles: ["student", "placement", "incubation"], template: "list", icon: "network", phase: "Phase 3" },

  // ───────────── Faculty ─────────────
  { slug: "copilot", title: "Faculty AI Copilot", description: "Lesson plans, notes, PPT outlines, assignments, rubrics and lab manuals.", group: "Faculty", roles: ["faculty"], template: "generator", icon: "bot", phase: "MVP", agent: "faculty-copilot" },
  { slug: "my-classes", title: "My Classes", description: "Sections, timetable, attendance and class performance.", group: "Faculty", roles: ["faculty"], template: "list", icon: "school", phase: "MVP" },
  { slug: "students", title: "Students", description: "Profiles, performance, skills and support recommendations.", group: "Faculty", roles: ["faculty", "hod", "placement"], template: "list", icon: "users", phase: "MVP" },
  { slug: "question-generator", title: "Question Paper Generator", description: "Generate blueprint-aligned question papers mapped to course outcomes.", group: "Faculty", roles: ["faculty", "hod"], template: "generator", icon: "wand", phase: "MVP", agent: "exam" },
  { slug: "teaching-studio", title: "Teaching Studio", description: "Topic basics, a timed lesson outline, a semester roadmap, an infographic handout, smart-board slides and a class summary to share — for any chapter or topic.", group: "Faculty", roles: ["faculty", "hod"], template: "bespoke", icon: "board", phase: "MVP", notice: "AI drafts the teaching pack from your course content. Review it before class; you decide what students see." },
  { slug: "skill-booster", title: "Faculty Skill Booster", description: "Teaching tasks that complete from what you actually do, short skill tracks, levels and badges.", group: "Faculty", roles: ["faculty", "hod"], template: "bespoke", icon: "award", phase: "MVP" },
  { slug: "class-analytics", title: "Class Performance", description: "Topic-wise mastery, remedial recommendations and at-risk signals for your classes.", group: "Faculty", roles: ["faculty"], template: "dashboard", icon: "chart", phase: "MVP" },

  // ───────────── Department (HOD) ─────────────
  { slug: "department-faculty", title: "Faculty", description: "Faculty load, development progress and AI adoption.", group: "Department", roles: ["hod"], template: "bespoke", icon: "users", phase: "MVP" },
  { slug: "department-academics", title: "Academic Performance", description: "Subject-wise pass rates, averages and failure patterns.", group: "Department", roles: ["hod"], template: "dashboard", icon: "chart", phase: "MVP" },
  { slug: "department-skills", title: "Skill Intelligence", description: "Skill distribution and gaps across batches versus industry demand.", group: "Department", roles: ["hod", "institution"], template: "bespoke", icon: "graph", phase: "Phase 2" },
  { slug: "department-labs", title: "Department Portal", description: "Department-specific labs and modules — coding lab, CAD, circuits, GIS, case studies.", group: "Department", roles: ["hod", "student"], template: "gallery", icon: "layers", phase: "Phase 2" },
  { slug: "early-warning", title: "Student Success & Early Warning", description: "Support recommendations for faculty and counsellors to review — never automatic labels.", group: "Department", roles: ["hod", "faculty", "institution"], template: "bespoke", icon: "alert", phase: "Phase 3", notice: "Signals are suggestions for human review. Students are never automatically labelled, and decisions rest with faculty and counsellors." },

  // ───────────── Placement ─────────────
  { slug: "placement-board", title: "Placement Readiness Board", description: "Every student’s readiness total, gaps and status — filter, shortlist and export for drives.", group: "Placement", roles: ["placement", "hod", "institution", "admin"], template: "bespoke", icon: "target", phase: "MVP" },
  { slug: "drives", title: "Placement Drives", description: "Schedule and manage campus recruitment drives.", group: "Placement", roles: ["placement"], template: "list", icon: "briefcase", phase: "Phase 2" },
  { slug: "jobs", title: "Job Matching", description: "Open roles matched to verified student profiles and eligibility.", group: "Placement", roles: ["placement", "student"], template: "list", icon: "handshake", phase: "Phase 2" },
  { slug: "employers", title: "Employers", description: "Recruiter relationships, history and hiring outcomes.", group: "Placement", roles: ["placement"], template: "list", icon: "building", phase: "Phase 2" },
  { slug: "placement-analytics", title: "Placement Analytics", description: "Readiness, resume completion, mock-interview participation and offers.", group: "Placement", roles: ["placement", "hod", "institution"], template: "dashboard", icon: "chart", phase: "Phase 2" },

  // ───────────── Incubation ─────────────
  { slug: "incubation-pipeline", title: "Incubation Pipeline", description: "Idea → validation → market → business model → MVP → pitch → incubation review.", group: "Incubation", roles: ["incubation"], template: "workflow", icon: "rocket", phase: "Phase 2" },
  { slug: "startups", title: "Startups", description: "Student ventures, stage, mentors and funding readiness.", group: "Incubation", roles: ["incubation"], template: "list", icon: "lightbulb", phase: "Phase 2" },
  { slug: "mentors", title: "Mentor Network", description: "Industry, alumni and startup mentors with assignments.", group: "Incubation", roles: ["incubation"], template: "list", icon: "handshake", phase: "Phase 2" },
  { slug: "funding-readiness", title: "Funding Readiness", description: "Team, traction, product and pitch readiness per venture.", group: "Incubation", roles: ["incubation"], template: "scorecard", icon: "coins", phase: "Phase 3" },

  // ───────────── Admissions ─────────────
  { slug: "admissions", title: "Student Admissions", description: "Enquiry → application → document verification → shortlist → offer → fee → enrolment.", group: "Admissions", roles: ["institution", "admin"], template: "crud", resource: "admissions", icon: "admission", phase: "MVP" },
  { slug: "admission-insights", title: "Admission Insights", description: "Funnel, programme demand, category mix and conversion for the current cycle.", group: "Admissions", roles: ["institution", "admin"], template: "dashboard", icon: "chart", phase: "MVP" },

  // ───────────── College Website ─────────────
  { slug: "college-website", title: "College Website", description: "Edit your public college page — hero image, tagline, about, principal's message, highlights and contact.", group: "College Website", roles: ["institution", "admin"], template: "bespoke", icon: "school", phase: "MVP" },
  { slug: "gallery", title: "Photo Gallery", description: "Upload and publish campus photos shown on the public college website.", group: "College Website", roles: ["institution", "admin"], template: "crud", resource: "gallery", icon: "upload", phase: "MVP" },

  // ───────────── Staff & Users ─────────────
  { slug: "staff", title: "Staff Management", description: "Teaching and non-teaching staff records — department, designation, employment and status.", group: "Staff & Users", roles: ["institution", "admin", "hod"], template: "crud", resource: "staff", icon: "staff", phase: "MVP" },
  { slug: "roles-permissions", title: "Roles & Permissions", description: "What each role can see and do across the platform (RBAC matrix).", group: "Staff & Users", roles: ["institution", "admin"], template: "bespoke", icon: "key", phase: "MVP" },

  // ───────────── Institution ─────────────
  { slug: "departments", title: "Departments", description: "Departments of the college, their heads and contacts, with live student, faculty and placement figures.", group: "Institution", roles: ["institution", "admin"], template: "crud", resource: "departments", icon: "building", phase: "MVP" },
  { slug: "bi-analytics", title: "Analytics & BI", description: "Academic, employability, engagement and faculty KPIs.", group: "Institution", roles: ["institution"], template: "dashboard", icon: "chart", phase: "Phase 3" },
  { slug: "knowledge-base", title: "Institutional Knowledge (RAG)", description: "Syllabus, regulations, handbooks and circulars that ground every AI answer.", group: "Institution", roles: ["institution", "admin"], template: "bespoke", icon: "database", phase: "Phase 3" },
  { slug: "policy-assistant", title: "Policy Assistant", description: "Answers strictly from approved institutional documents, with citations.", group: "Institution", roles: ["institution", "hod", "faculty"], template: "chat", icon: "scroll", phase: "Phase 3", agent: "policy" },
  { slug: "reports", title: "Reports", description: "Student, faculty, department, course, skill, placement and institutional reports.", group: "Institution", roles: ["institution", "hod", "faculty", "placement"], template: "bespoke", icon: "file", phase: "Phase 3" },
  { slug: "naac-readiness", title: "NAAC Accreditation Readiness", description: "Seven NAAC criteria scored against evidence collected across the college.", group: "Institution", roles: ["institution", "admin"], template: "scorecard", icon: "award", phase: "Phase 3", streams: ["artsScience", "engineering", "management"] },
  { slug: "aicte-compliance", title: "AICTE Compliance", description: "Approval conditions, faculty-student ratio, labs and mandatory disclosures.", group: "Institution", roles: ["institution", "admin"], template: "bespoke", icon: "shield", phase: "Phase 3", streams: ["engineering", "management", "polytechnic"] },
  { slug: "branding", title: "Branding & White Label", description: "Logo, colours, subdomain, academic structure and notification templates.", group: "Institution", roles: ["institution"], template: "settings", icon: "settings", phase: "Phase 3" },
  { slug: "notifications-config", title: "Notification Rules", description: "Event + priority + audience + timing + channel rules.", group: "Institution", roles: ["institution", "admin"], template: "settings", icon: "bell", phase: "Phase 3" },
  { slug: "integrations", title: "Integrations", description: "SIS, ERP, LMS, attendance, exam, identity and communication systems.", group: "Institution", roles: ["institution", "admin"], template: "gallery", icon: "plug", phase: "Phase 4" },

  // ───────────── Recruiter ─────────────
  { slug: "talent-search", title: "Talent Search", description: "Search verified student profiles by skills, projects and readiness.", group: "Recruiter", roles: ["recruiter"], template: "list", icon: "search", phase: "Phase 4" },
  { slug: "shortlists", title: "Shortlists", description: "Candidates you have shortlisted, with stage and notes.", group: "Recruiter", roles: ["recruiter"], template: "list", icon: "list", phase: "Phase 4" },
  { slug: "recruiter-interviews", title: "Interview Schedule", description: "Upcoming candidate interviews and panels.", group: "Recruiter", roles: ["recruiter"], template: "calendar", icon: "calendar", phase: "Phase 4" },

  // ───────────── Platform ─────────────
  { slug: "colleges", title: "Colleges", description: "Onboard, configure, suspend and remove colleges; switch module areas on or off per college.", group: "University", roles: ["admin"], template: "crud", resource: "colleges", icon: "building", phase: "MVP" },
  { slug: "users", title: "User Management", description: "Create accounts, assign roles, suspend access and enforce MFA.", group: "Staff & Users", roles: ["admin", "institution"], template: "crud", resource: "users", icon: "userlock", phase: "MVP" },
  { slug: "billing", title: "Subscriptions & Billing", description: "Plans, seats and AI consumption metering.", group: "Platform", roles: ["admin"], template: "list", icon: "credit", phase: "Phase 4" },
  { slug: "ai-governance", title: "AI Governance", description: "Model, prompt and agent registries, safety policies, bias tests and human review.", group: "Platform", roles: ["admin"], template: "dashboard", icon: "shield", phase: "Phase 3" },
  { slug: "ai-observability", title: "AI Observability", description: "Every AI request: tenant, agent, model, prompt version, sources, tokens, latency, cost.", group: "Platform", roles: ["admin"], template: "list", icon: "eye", phase: "Phase 3" },
  { slug: "agent-store", title: "Agent Store", description: "Enable domain agents per institution — GATE, NEET, coding, accounting, law and more.", group: "Platform", roles: ["admin", "institution"], template: "gallery", icon: "cpu", phase: "Phase 4" },
  { slug: "audit-log", title: "Audit Log", description: "Security-relevant actions, score overrides and configuration changes.", group: "Platform", roles: ["admin", "institution"], template: "list", icon: "scroll", phase: "MVP" },
  { slug: "feature-flags", title: "Feature Flags", description: "Roll modules out per tenant and plan.", group: "Platform", roles: ["admin"], template: "settings", icon: "toggle", phase: "Phase 2" },
  { slug: "security-settings", title: "Security Settings", description: "MFA, SSO, session, password, data-retention and AI data policies.", group: "Platform", roles: ["admin", "institution"], template: "settings", icon: "shield", phase: "MVP" },
  { slug: "developer-api", title: "Developer API", description: "API keys, scopes and webhooks for the Student, Course, Assessment, AI and Career APIs.", group: "Platform", roles: ["admin"], template: "list", icon: "code", phase: "Phase 4" },
];

export function modulesForRole(role: Role): ModuleDef[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function findModule(slug: string): ModuleDef | undefined {
  return MODULES.find((m) => m.slug === slug);
}

export function groupedModules(role: Role): Array<{ group: string; items: ModuleDef[] }> {
  const mods = modulesForRole(role);
  return MODULE_GROUPS.map((group) => ({ group, items: mods.filter((m) => m.group === group) })).filter(
    (g) => g.items.length > 0,
  );
}
