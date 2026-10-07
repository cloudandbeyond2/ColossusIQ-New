import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  AlumniMemberItem,
  CreateAlumniBody,
  MentorshipRequestItem,
  UpdateMentorshipRequestBody,
} from "@/lib/api/alumni-schemas";
import { postgresAlumni } from "@/lib/data/postgres/alumni";
import { sharedState } from "./global-state";

export interface AlumniStore {
  listMembers(scope: string): Promise<AlumniMemberItem[]>;
  getMember(id: string): Promise<AlumniMemberItem | undefined>;
  createMember(collegeId: string, data: CreateAlumniBody): Promise<AlumniMemberItem>;
  listRequests(scope: string, studentId?: string): Promise<MentorshipRequestItem[]>;
  createRequest(data: Omit<MentorshipRequestItem, "id" | "createdAt" | "updatedAt">): Promise<MentorshipRequestItem>;
  updateRequest(id: string, data: UpdateMentorshipRequestBody): Promise<MentorshipRequestItem | undefined>;
  deleteRequest(id: string): Promise<boolean>;
}

const INITIAL_SEEDED_ALUMNI: Array<Omit<AlumniMemberItem, "id" | "collegeId" | "createdAt" | "updatedAt" | "matchScore">> = [
  {
    name: "Karthik Sharma",
    batch: "Batch 2021",
    currentPosition: "System Analyst",
    company: "Microsoft",
    location: "Bengaluru, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Placement Prep", "Mock Interviews & System Design"],
    skills: ["Azure", "System Design", "Distributed Systems", "C#", "SQL"],
    linkedinUrl: "https://linkedin.com/in/karthik-sharma",
    email: "karthik.sharma@alumni.colossusiq.edu",
    bio: "System Analyst at Microsoft Azure Core Systems. Former campus placement coordinator. Happy to help junior students with resume reviews and technical interview preparation.",
    isAvailable: true,
    activeMentees: 2,
    maxMentees: 5,
  },
  {
    name: "Anand Kumar",
    batch: "Batch 2019",
    currentPosition: "Tech Lead",
    company: "Microsoft",
    location: "Hyderabad, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Mock Interviews & System Design", "Placement Prep"],
    skills: ["System Architecture", "Microservices", "Java", "Kubernetes", "Leadership"],
    linkedinUrl: "https://linkedin.com/in/anand-kumar",
    email: "anand.kumar@alumni.colossusiq.edu",
    bio: "Engineering Lead with 5+ years experience building cloud services. Passionate about guiding final-year students through system design rounds.",
    isAvailable: true,
    activeMentees: 1,
    maxMentees: 4,
  },
  {
    name: "Nikhil Sharma",
    batch: "Batch 2021",
    currentPosition: "Data Scientist",
    company: "Amazon",
    location: "Bengaluru, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Resume Review & Startups", "ML & Analytics Career Guidance"],
    skills: ["Python", "Machine Learning", "PyTorch", "AWS S3", "Data Pipelines"],
    linkedinUrl: "https://linkedin.com/in/nikhil-sharma",
    email: "nikhil.sharma@alumni.colossusiq.edu",
    bio: "Data Scientist at Amazon AWS AI Labs. Published researcher and former hackathon mentor. Available for ML career guidance and portfolio reviews.",
    isAvailable: true,
    activeMentees: 3,
    maxMentees: 5,
  },
  {
    name: "Fathima Nair",
    batch: "Batch 2021",
    currentPosition: "Product Manager",
    company: "Amazon",
    location: "Chennai, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["ML & Analytics Career Guidance", "Resume Review & Startups"],
    skills: ["Product Strategy", "Agile", "User Research", "Data Analytics", "Roadmapping"],
    linkedinUrl: "https://linkedin.com/in/fathima-nair",
    email: "fathima.nair@alumni.colossusiq.edu",
    bio: "Technical Product Manager at Amazon Consumer. Transitions from software engineering to PM roles, case studies, and startup incubator advice.",
    isAvailable: true,
    activeMentees: 1,
    maxMentees: 3,
  },
  {
    name: "Revathi Srinivasan",
    batch: "Batch 2019",
    currentPosition: "Tech Lead",
    company: "IBM",
    location: "Bengaluru, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Placement Prep", "Core Engineering & Higher Studies"],
    skills: ["Hybrid Cloud", "RedHat OpenShift", "Enterprise Security", "Java", "Docker"],
    linkedinUrl: "https://linkedin.com/in/revathi-srinivasan",
    email: "revathi.s@alumni.colossusiq.edu",
    bio: "Senior Technical Staff Member & Tech Lead at IBM Cloud. Proud alumna supporting women in tech and core computing careers.",
    isAvailable: true,
    activeMentees: 2,
    maxMentees: 4,
  },
  {
    name: "Rohan Iyer",
    batch: "Batch 2022",
    currentPosition: "Data Scientist",
    company: "Google",
    location: "Bengaluru / Singapore",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["ML & Analytics Career Guidance", "Mock Interviews & System Design"],
    skills: ["Deep Learning", "TensorFlow", "Generative AI", "Algorithms", "Python"],
    linkedinUrl: "https://linkedin.com/in/rohan-iyer",
    email: "rohan.iyer@alumni.colossusiq.edu",
    bio: "Machine Learning Engineer at Google Research. Mentoring passionate engineers on AI research papers, coding interviews, and open-source contributions.",
    isAvailable: true,
    activeMentees: 2,
    maxMentees: 4,
  },
  {
    name: "Pooja Hegde",
    batch: "Batch 2020",
    currentPosition: "Senior Frontend Engineer",
    company: "Zoho Corporation",
    location: "Chennai, India",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Placement Prep", "Resume Review & Startups"],
    skills: ["React", "TypeScript", "Browser Architecture", "Web Performance", "UI/UX"],
    linkedinUrl: "https://linkedin.com/in/pooja-hegde",
    email: "pooja.h@alumni.colossusiq.edu",
    bio: "Frontend Specialist building flagship Zoho Office applications. Happy to conduct live mock coding drills and give frontend career roadmaps.",
    isAvailable: true,
    activeMentees: 1,
    maxMentees: 5,
  },
  {
    name: "Suresh Balakrishnan",
    batch: "Batch 2018",
    currentPosition: "Founder & CTO",
    company: "FinFlow Technologies",
    location: "Coimbatore / Remote",
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    mentorshipTopics: ["Resume Review & Startups", "Core Engineering & Higher Studies"],
    skills: ["Startup Growth", "FinTech", "System Architecture", "Fundraising", "Go"],
    linkedinUrl: "https://linkedin.com/in/suresh-bala",
    email: "suresh@finflow.io",
    bio: "Alumnus founder of YC-backed fintech startup. Active angel investor and incubation advisor for campus entrepreneurship cells.",
    isAvailable: true,
    activeMentees: 2,
    maxMentees: 3,
  },
];

const memMembers = sharedState("alumni.members", () => new Map<string, AlumniMemberItem>());
const memRequests = sharedState("alumni.requests", () => new Map<string, MentorshipRequestItem>());

function ensureMemSeed(collegeId: string) {
  const existing = [...memMembers.values()].filter((m) => m.collegeId === collegeId);
  if (existing.length === 0) {
    const now = new Date().toISOString();
    for (const a of INITIAL_SEEDED_ALUMNI) {
      const id = randomUUID();
      memMembers.set(id, {
        ...a,
        id,
        collegeId,
        matchScore: 85,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

const memoryAlumni: AlumniStore = {
  async listMembers(scope) {
    ensureMemSeed(scope);
    return [...memMembers.values()].filter((m) => scope === "all" || m.collegeId === scope);
  },
  async getMember(id) {
    return memMembers.get(id);
  },
  async createMember(collegeId, data) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const item: AlumniMemberItem = {
      id,
      collegeId,
      name: data.name,
      batch: data.batch,
      currentPosition: data.currentPosition,
      company: data.company,
      location: data.location || "",
      degree: data.degree || "B.E. Computer Science & Engineering",
      department: data.department || "Computer Science & Engineering",
      mentorshipTopics: data.mentorshipTopics || [],
      skills: data.skills || [],
      linkedinUrl: data.linkedinUrl || "",
      email: data.email || "",
      bio: data.bio || "",
      isAvailable: data.isAvailable ?? true,
      activeMentees: 0,
      maxMentees: data.maxMentees || 5,
      matchScore: 85,
      createdAt: now,
      updatedAt: now,
    };
    memMembers.set(id, item);
    return item;
  },
  async listRequests(scope, studentId) {
    let list = [...memRequests.values()].filter((r) => scope === "all" || r.collegeId === scope);
    if (studentId) {
      list = list.filter((r) => r.studentId === studentId);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createRequest(data) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const item: MentorshipRequestItem = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    memRequests.set(id, item);

    // Increment mentor's active mentees
    const mentor = memMembers.get(data.alumniId);
    if (mentor) {
      mentor.activeMentees += 1;
    }

    return item;
  },
  async updateRequest(id, data) {
    const r = memRequests.get(id);
    if (!r) return undefined;
    if (data.status) r.status = data.status;
    if (data.responseNote !== undefined) r.responseNote = data.responseNote;
    if (data.meetingLink !== undefined) r.meetingLink = data.meetingLink;
    if (data.scheduledAt !== undefined) r.scheduledAt = data.scheduledAt;
    r.updatedAt = new Date().toISOString();
    return r;
  },
  async deleteRequest(id) {
    return memRequests.delete(id);
  },
};

export function alumniStore(): AlumniStore {
  return dataBackend() === "postgres" ? postgresAlumni : memoryAlumni;
}
