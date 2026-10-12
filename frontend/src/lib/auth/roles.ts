export const ROLES = [
  "student",
  "faculty",
  "hod",
  "placement",
  "incubation",
  "institution",
  "recruiter",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_META: Record<Role, { label: string; persona: string; description: string }> = {
  student: {
    label: "Student",
    persona: "Anand Kumar · B.E. CSE, Semester 5",
    description: "AI mentor, learning, exams, projects and career readiness.",
  },
  faculty: {
    label: "Faculty",
    persona: "Dr. Meena Raghavan · Asst. Professor, CSE",
    description: "Teaching copilot, assessments, evaluation and skill development.",
  },
  hod: {
    label: "Head of Department",
    persona: "Dr. S. Venkatesh · HOD, Computer Science",
    description: "Department intelligence, faculty, academics and placement readiness.",
  },
  placement: {
    label: "Placement Officer",
    persona: "Ms. Priya Nair · Training & Placement Officer",
    description: "Drives, eligibility, job matching and placement analytics.",
  },
  incubation: {
    label: "Incubation Head",
    persona: "Mr. Arjun Iyer · Innovation & Incubation Cell",
    description: "Ideas, startups, hackathons, mentors and funding readiness.",
  },
  institution: {
    label: "College Principal",
    persona: "Dr. Lakshmi Sundaram · Principal",
    description: "College command center, admissions, staff, users, analytics and early warning.",
  },
  recruiter: {
    label: "Recruiter",
    persona: "Rahul Mehta · Talent Acquisition, TechNova",
    description: "Verified talent search, shortlisting and assessments.",
  },
  admin: {
    label: "University Super Admin",
    persona: "Dr. R. Chandrasekar · University Super Admin",
    description: "All colleges: onboarding, suspension, module control, cross-college analytics, AI governance and audit.",
  },
};

/** Fine-grained permissions (UI defence-in-depth only — the API must enforce the same rules). */
export type Permission =
  | "ai:chat"
  | "assessment:attempt"
  | "assessment:create"
  | "assessment:override-score"
  | "student:read-own"
  | "student:read-any"
  | "department:manage"
  | "placement:manage"
  | "incubation:manage"
  | "institution:analytics"
  | "talent:search"
  | "tenant:manage"
  | "ai:governance"
  | "audit:read"
  | "billing:manage"
  | "admissions:manage"
  | "staff:manage"
  | "users:manage"
  | "courses:manage"
  | "events:manage"
  | "colleges:manage"
  | "clinical:manage"
  | "website:manage"
  | "knowledge:manage"
  | "prep:publish"
  | "certificates:authorize";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  student: ["ai:chat", "assessment:attempt", "student:read-own"],
  faculty: ["ai:chat", "assessment:create", "assessment:override-score", "student:read-any", "events:manage", "clinical:manage", "prep:publish"],
  hod: ["ai:chat", "assessment:create", "assessment:override-score", "student:read-any", "department:manage", "courses:manage", "events:manage", "clinical:manage", "prep:publish"],
  placement: ["ai:chat", "student:read-any", "placement:manage"],
  incubation: ["ai:chat", "student:read-any", "incubation:manage"],
  institution: [
    "ai:chat",
    "assessment:create",
    "student:read-any",
    "institution:analytics",
    "department:manage",
    "audit:read",
    "admissions:manage",
    "staff:manage",
    "users:manage",
    "courses:manage",
    "events:manage",
    "clinical:manage",
    "website:manage",
    "knowledge:manage",
    "prep:publish",
    "certificates:authorize",
  ],
  recruiter: ["talent:search"],
  admin: [
    "ai:chat",
    "assessment:create",
    "assessment:override-score",
    "tenant:manage",
    "ai:governance",
    "audit:read",
    "billing:manage",
    "institution:analytics",
    "admissions:manage",
    "staff:manage",
    "users:manage",
    "courses:manage",
    "events:manage",
    "colleges:manage",
    "clinical:manage",
    "website:manage",
    "student:read-any",
    "department:manage",
    "knowledge:manage",
    "prep:publish",
  ],
};

export const PERMISSION_GROUPS = ["Learning & assessment", "Administration", "Outcomes", "Platform & governance"] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

/**
 * Every permission with its plain-English label and the group it is shown under. Typed as a full Record, so adding a
 * permission above without describing it here fails the type check and it can never be missing from Roles & Permissions.
 */
export const PERMISSION_CATALOG: Record<Permission, { label: string; group: PermissionGroup }> = {
  "ai:chat": { label: "Use AI mentor / copilots", group: "Learning & assessment" },
  "assessment:attempt": { label: "Attempt tests", group: "Learning & assessment" },
  "assessment:create": { label: "Create assessments", group: "Learning & assessment" },
  "assessment:override-score": { label: "Approve / override AI marks", group: "Learning & assessment" },
  "student:read-own": { label: "View own student record", group: "Learning & assessment" },
  "student:read-any": { label: "View student records", group: "Learning & assessment" },
  "prep:publish": { label: "Publish exam-prep content", group: "Learning & assessment" },
  "admissions:manage": { label: "Manage admissions", group: "Administration" },
  "staff:manage": { label: "Manage staff", group: "Administration" },
  "users:manage": { label: "Manage users & roles", group: "Administration" },
  "courses:manage": { label: "Manage courses", group: "Administration" },
  "events:manage": { label: "Manage events", group: "Administration" },
  "department:manage": { label: "Manage departments", group: "Administration" },
  "clinical:manage": { label: "Manage clinical postings", group: "Administration" },
  "website:manage": { label: "Manage college website", group: "Administration" },
  "knowledge:manage": { label: "Manage knowledge base", group: "Administration" },
  "certificates:authorize": { label: "Authorize certificates", group: "Administration" },
  "placement:manage": { label: "Manage placements", group: "Outcomes" },
  "incubation:manage": { label: "Manage incubation", group: "Outcomes" },
  "talent:search": { label: "Search verified talent", group: "Outcomes" },
  "institution:analytics": { label: "Institution analytics", group: "Outcomes" },
  "colleges:manage": { label: "Manage colleges", group: "Platform & governance" },
  "tenant:manage": { label: "Manage tenants", group: "Platform & governance" },
  "ai:governance": { label: "AI governance", group: "Platform & governance" },
  "audit:read": { label: "Read audit log", group: "Platform & governance" },
  "billing:manage": { label: "Manage billing", group: "Platform & governance" },
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
