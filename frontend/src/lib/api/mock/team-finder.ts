import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  AddTeammateInput,
  CreateTeamRequestInput,
  TeamCandidate,
  TeamFinderOverview,
  TeamRequestItem,
} from "../team-finder-schemas";
import { listProjects } from "./projects";
import { studentStateStore } from "./student-state-store";
import { sharedState } from "./global-state";
import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";
import { ProjectDbRow } from "@/lib/data/postgres/projects";
import { getStudentAcademicProfile } from "./student-profile";
import { getStudentsList } from "./students-store";
import { collegeStream } from "./records";
import { resolveUserDepartment } from "@/lib/auth/department";

const DEFAULT_CANDIDATES: TeamCandidate[] = [
  {
    id: "cand-1",
    name: "Rahul S.",
    dept: "Computer Science & Engineering",
    skills: ["React", "Next.js", "Tailwind CSS", "TypeScript"],
    looking: "Hackathon frontend lead",
    match: 94,
    bio: "Passionate about building responsive UI/UX and client-side web applications.",
    cgpa: "8.9",
  },
  {
    id: "cand-2",
    name: "Priya V.",
    dept: "Computer Science & Engineering",
    skills: ["Python", "FastAPI", "PyTorch", "Docker"],
    looking: "AI/ML project partner",
    match: 91,
    bio: "Focusing on computer vision and edge deployment of deep learning models.",
    cgpa: "9.2",
  },
  {
    id: "cand-3",
    name: "Karthik R.",
    dept: "Electronics & Communication",
    skills: ["Embedded C", "IoT", "Arduino", "ESP32", "ROS"],
    looking: "Hardware & sensor integration",
    match: 86,
    bio: "Drone avionics and sensor telemetry prototyping specialist.",
    cgpa: "8.5",
  },
  {
    id: "cand-4",
    name: "Divya M.",
    dept: "Management Studies",
    skills: ["Product Design", "UI/UX", "Figma", "User Research"],
    looking: "Startup UI/UX & Pitch Deck",
    match: 82,
    bio: "Experienced in user journey mapping, design systems, and business models.",
    cgpa: "8.7",
  },
  {
    id: "cand-5",
    name: "Siddharth N.",
    dept: "Information Technology",
    skills: ["PostgreSQL", "Go", "Kubernetes", "gRPC"],
    looking: "High throughput backend systems",
    match: 88,
    bio: "Distributed databases and resilient cloud backend architectures.",
    cgpa: "9.0",
  },
  {
    id: "cand-6",
    name: "Ananya K.",
    dept: "Artificial Intelligence & Data Science",
    skills: ["YOLOv8", "OpenCV", "TensorFlow", "Scikit-Learn"],
    looking: "Computer vision and robotics research",
    match: 92,
    bio: "Autonomous object detection and real-time aerial image classification.",
    cgpa: "9.3",
  },
];

const sharedRequests = sharedState<TeamRequestItem[]>("campus.team_requests", () => [
  {
    id: "req-init-1",
    projectId: "PRJ-1001",
    projectTitle: "Autonomous Drone-Based Crop Health Scanner",
    roleNeeded: "Drone Telemetry & Sensor Engineer",
    skillsRequired: ["Embedded C", "ESP32", "Telemetry"],
    slots: 1,
    department: "Electronics & Communication",
    description: "Looking for a hardware specialist to configure multispectral camera telemetry with onboard GPS.",
    createdBy: "Lead Student",
    createdAt: new Date().toISOString(),
    applicantsCount: 2,
  },
]);

function getCandidateSkills(dept: string, isMedical: boolean): { skills: string[]; looking: string; bio: string } {
  const d = dept.toLowerCase();
  if (isMedical || d.includes("anatomy") || d.includes("surgery") || d.includes("medicine") || d.includes("physiology") || d.includes("pathology")) {
    if (d.includes("anatomy")) {
      return {
        skills: ["Cadaver Dissection", "Histology", "Embryology", "Neuroanatomy"],
        looking: "Clinical research collaborator",
        bio: "Specializing in anatomical variants, histology tissue prep, and medical illustration.",
      };
    }
    if (d.includes("surgery")) {
      return {
        skills: ["Surgical Suture Techniques", "Pre-op Assessment", "Wound Care", "Sterile Techniques"],
        looking: "Surgical case study co-author",
        bio: "Interested in minimally invasive surgery protocols and clinical trauma care.",
      };
    }
    if (d.includes("pathology")) {
      return {
        skills: ["Histopathology", "Blood Film Analysis", "Biopsy Staining", "Cytology"],
        looking: "Diagnostic research partner",
        bio: "Focused on automated hematology, tissue biopsy staining, and diagnostic accuracy.",
      };
    }
    if (d.includes("community")) {
      return {
        skills: ["Epidemiology", "Public Health Survey", "Biostatistics", "Field Screening"],
        looking: "Community health study lead",
        bio: "Rural community health screening, epidemiology data modeling, and disease prevention.",
      };
    }
    return {
      skills: ["Clinical Examination", "ECG Analysis", "Patient History", "Medical Ethics"],
      looking: "ICMR STS project partner",
      bio: "Interested in evidence-based medicine, patient screening, and clinical trials.",
    };
  }

  // Engineering / Technology
  if (d.includes("computer") || d.includes("information")) {
    return {
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      looking: "Fullstack hackathon lead",
      bio: "Web applications, responsive UI/UX, and cloud database architectures.",
    };
  }
  if (d.includes("ai") || d.includes("data")) {
    return {
      skills: ["Python", "PyTorch", "OpenCV", "Scikit-Learn"],
      looking: "AI/ML project partner",
      bio: "Computer vision, predictive diagnostics, and NLP models.",
    };
  }
  if (d.includes("electronic")) {
    return {
      skills: ["Embedded C", "IoT", "ESP32", "Sensor Telemetry"],
      looking: "Hardware & sensor integration",
      bio: "Embedded systems, biomedical telemetry, and IoT sensor circuits.",
    };
  }
  return {
    skills: ["Project Management", "Data Analysis", "Research Writing", "Documentation"],
    looking: "Capstone project partner",
    bio: "Focused on interdisciplinary project design and experimental research.",
  };
}

export async function getTeamFinderOverview(
  session: SessionPayload
): Promise<TeamFinderOverview> {
  const college = session.college || "COL-1006";
  const stream = (await collegeStream(college)) || "engineering";
  const isMedical = stream === "medical" || college === "COL-1006" || college === "COL-1007";

  let myDepartment = isMedical ? "Anatomy" : "Computer Science & Engineering";
  try {
    const userDept = await resolveUserDepartment(session);
    if (userDept && userDept !== "Administration") {
      myDepartment = userDept;
    } else if (session.role === "student") {
      const profile = await getStudentAcademicProfile(session);
      if (profile?.department && profile.department !== "Pathology & Pharmacology") {
        myDepartment = profile.department;
      }
    }
  } catch {}

  const projects = await listProjects(session);
  const myProjects = projects.map((p) => ({
    id: p.id,
    title: p.title,
    domain: p.domain,
    team: p.team,
  }));

  // Fetch campus requests from persistent store or shared state
  let requests = sharedRequests;
  try {
    const saved = await studentStateStore().get(session.sub, "team_requests");
    if (Array.isArray(saved) && saved.length > 0) {
      requests = saved as TeamRequestItem[];
    }
  } catch {}

  let candidates: TeamCandidate[] = [];
  try {
    const students = await getStudentsList({ collegeId: session.college });
    if (students && students.length > 0) {
      const isStudent = session.role === "student";
      const selfName = isStudent ? (session.name || "").toLowerCase().trim() : "";
      candidates = students
        .filter((s) => !selfName || s.name.toLowerCase().trim() !== selfName)
        .map((s, idx) => {
          const profile = getCandidateSkills(s.department || "General", isMedical);
          return {
            id: s.id || `cand-${idx + 1}`,
            name: s.name,
            dept: s.department || (isMedical ? "Anatomy" : "Computer Science & Engineering"),
            skills: profile.skills,
            looking: profile.looking,
            match: Math.min(98, Math.max(78, 95 - ((idx * 3) % 17))),
            bio: profile.bio,
            cgpa: String(s.cgpa || "8.5"),
          };
        });
    }
  } catch {}

  if (candidates.length === 0) {
    candidates = DEFAULT_CANDIDATES;
  }

  return {
    myDepartment,
    stream,
    isMedical,
    role: session.role || "student",
    candidates,
    requests,
    myProjects,
  };
}

export async function createTeamRequest(
  session: SessionPayload,
  input: CreateTeamRequestInput
): Promise<TeamRequestItem> {
  const newItem: TeamRequestItem = {
    id: `req-${Date.now()}`,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    roleNeeded: input.roleNeeded,
    skillsRequired: input.skillsRequired,
    slots: input.slots,
    department: input.department,
    description: input.description,
    createdBy: session.name || "Student",
    createdAt: new Date().toISOString(),
    applicantsCount: 0,
  };

  sharedRequests.unshift(newItem);

  try {
    const existing = (await studentStateStore().get(session.sub, "team_requests")) as TeamRequestItem[] | undefined;
    const updated = [newItem, ...(Array.isArray(existing) ? existing : [])];
    await studentStateStore().save(session.college, session.sub, "team_requests", updated);
  } catch {}

  return newItem;
}

export async function inviteStudentToProject(
  session: SessionPayload,
  input: AddTeammateInput
): Promise<{ ok: boolean; team: string[] }> {
  const candidateName = input.studentName.trim();
  if (!candidateName) return { ok: false, team: [] };

  if (dataBackend() === "postgres") {
    try {
      // Find the project in PostgreSQL
      const row = await db().$queryRaw<ProjectDbRow[]>`
        SELECT * FROM "Project" WHERE id = ${input.projectId}
      `;
      if (row && row.length > 0) {
        const prj = row[0]!;
        let teamArr: string[] = [];
        try {
          teamArr = typeof prj.team === "string" ? JSON.parse(prj.team) : prj.team || [];
        } catch {
          teamArr = [];
        }

        if (!teamArr.some((m) => m.toLowerCase() === candidateName.toLowerCase())) {
          teamArr.push(candidateName);
          const updatedJson = JSON.stringify(teamArr);
          await db().$executeRaw`
            UPDATE "Project" SET team = ${updatedJson}::jsonb, "updatedAt" = NOW() WHERE id = ${input.projectId}
          `;
        }
        return { ok: true, team: teamArr };
      }
    } catch (e) {
      console.error("Failed to add teammate to postgres project", e);
    }
  }

  // Memory fallback
  try {
    const prjs = await listProjects(session);
    const target = prjs.find((p) => p.id === input.projectId);
    if (target) {
      if (!target.team.includes(candidateName)) {
        target.team.push(candidateName);
      }
      return { ok: true, team: target.team };
    }
  } catch {}

  return { ok: true, team: [candidateName] };
}

export async function applyToTeamRequest(
  _session: SessionPayload,
  requestId: string
): Promise<{ ok: boolean; applicantsCount: number }> {
  const req = sharedRequests.find((r) => r.id === requestId);
  if (req) {
    req.applicantsCount += 1;
    return { ok: true, applicantsCount: req.applicantsCount };
  }
  return { ok: true, applicantsCount: 1 };
}
