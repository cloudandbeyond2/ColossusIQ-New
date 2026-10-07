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
  | "prep:publish";

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
  ],
  recruiter: ["talent:search"],
  admin: [
    "ai:chat",
    "assessment:create",
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

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
