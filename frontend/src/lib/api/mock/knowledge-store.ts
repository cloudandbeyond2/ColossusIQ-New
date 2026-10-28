import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import { dataBackend } from "@/lib/data";
import type { KbDocType, KbStatus } from "@/lib/api/knowledge-schemas";
import { postgresKnowledge } from "@/lib/data/postgres/knowledge";
import { sharedState } from "./global-state";

/* Storage for the Knowledge Base: an in-memory store for the demo backend and PostgreSQL (see data/postgres/knowledge.ts). */

export interface KbDocRow {
  /** Public id, e.g. KB-1001. */
  id: string;
  /** College public id, e.g. COL-1001. */
  collegeId: string;
  title: string;
  type: KbDocType;
  owner: string;
  scope: string;
  description: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  status: KbStatus;
  embedModel: string | null;
  chunkCount: number;
  embeddedCount: number;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewDoc {
  title: string;
  type: KbDocType;
  owner: string;
  scope: string;
  description: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  status: KbStatus;
  embedModel: string | null;
  uploadedBy: string;
  approvedBy: string | null;
}
export interface NewChunk {
  section: string;
  content: string;
  tokens: number;
  page: number | null;
  embedding: number[] | null;
}
export interface KbChunkRow {
  id: string;
  index: number;
  section: string;
  content: string;
  tokens: number;
  page: number | null;
  embedded: boolean;
}
/** A passage of an approved document, with what is needed to rank it and cite it. */
export interface SearchChunk {
  docId: string;
  docTitle: string;
  section: string;
  content: string;
  page: number | null;
  embedding: number[] | null;
}
export interface DocPatch {
  title?: string;
  type?: KbDocType;
  owner?: string;
  scope?: string;
  description?: string;
  status?: KbStatus;
  approvedBy?: string | null;
}

export interface KbStore {
  list(scope: string): Promise<KbDocRow[]>;
  get(scope: string, id: string): Promise<KbDocRow | undefined>;
  findByTitle(scope: string, title: string): Promise<KbDocRow | undefined>;
  create(collegeId: string, doc: NewDoc, chunks: NewChunk[]): Promise<KbDocRow>;
  update(scope: string, id: string, patch: DocPatch): Promise<KbDocRow | undefined>;
  remove(scope: string, id: string): Promise<boolean>;
  chunks(scope: string, id: string, limit: number): Promise<KbChunkRow[]>;
  /** The text of every passage in order (for re-embedding). */
  chunkTexts(scope: string, id: string): Promise<{ title: string; items: Array<{ section: string; content: string }> } | undefined>;
  /** Replaces every passage's embedding; undefined when the document changed or has a different passage count. */
  setEmbeddings(scope: string, id: string, vectors: number[][], model: string): Promise<KbDocRow | undefined>;
  searchable(scope: string): Promise<SearchChunk[]>;
}

/* ───────────────────────────── memory ─────────────────────────── */

interface MemChunk extends NewChunk {
  id: string;
}
interface MemDoc {
  row: KbDocRow;
  chunks: MemChunk[];
}
const mem = sharedState("knowledge.docs", () => ({ seq: 1004, docs: new Map<string, MemDoc>() }));
const visible = (scope: string, d: MemDoc) => scope === ALL_COLLEGES || d.row.collegeId === scope || d.row.collegeId === ALL_COLLEGES;
const clone = (r: KbDocRow): KbDocRow => ({ ...r });

function ensureKbSeed() {
  if (mem.docs.size > 0) return;
  const now = "2026-08-15T09:00:00.000Z";

  const seed = (
    id: string,
    collegeId: string,
    title: string,
    type: KbDocType,
    owner: string,
    scope: string,
    description: string,
    fileName: string,
    chunksData: Array<{ section: string; content: string }>
  ) => {
    const chunks: MemChunk[] = chunksData.map((c, i) => ({
      id: `${id}-c${i + 1}`,
      section: c.section,
      content: c.content,
      tokens: Math.max(1, Math.ceil(c.content.length / 4)),
      page: i + 1,
      embedding: null,
    }));

    const row: KbDocRow = {
      id,
      collegeId,
      title,
      type,
      owner,
      scope,
      description,
      fileName,
      mime: "application/pdf",
      sizeBytes: chunksData.reduce((s, c) => s + c.content.length, 0) * 2,
      status: "Approved",
      embedModel: null,
      chunkCount: chunks.length,
      embeddedCount: 0,
      uploadedBy: "IQAC Director",
      approvedBy: "Principal (Dr. Lakshmi Sundaram)",
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    mem.docs.set(id, { row, chunks });
  };

  // KB-1001: Faculty Handbook & Service Regulations
  seed(
    "KB-1001",
    "COL-1001",
    "Anna Institute of Technology - Faculty Handbook & Service Regulations 2026",
    "Handbook",
    "Registrar",
    "Faculty & staff",
    "Official guidelines on teaching workload, casual leave, on-duty permissions, research seed funding, and evaluation duties.",
    "ait-faculty-handbook-2026.pdf",
    [
      {
        section: "Leave Policy & Casual Leave (§4.1)",
        content: "Faculty members at Anna Institute of Technology are entitled to 12 days of Casual Leave (CL) per calendar year, up to a maximum of 3 consecutive days with prior HOD recommendation. Medical leave of 10 days is admissible upon submission of a registered medical practitioner's certificate. Maternity leave of 26 weeks is granted in accordance with statutory government guidelines.",
      },
      {
        section: "On-Duty (OD) Leave & Conference Permissions (§4.3)",
        content: "On-Duty (OD) leave up to 15 working days per academic year is granted to teaching staff for university examination valuation, external Ph.D. viva examination, presenting peer-reviewed research papers at Scopus/IEEE indexed conferences, and attending approved AICTE/FDP workshops. Faculty must apply on the Faculty ERP portal at least 3 days in advance with invitation documents endorsed by HOD and approved by Principal.",
      },
      {
        section: "Teaching Workload & Course Files (§2.2)",
        content: "Direct teaching workload per week adheres to AICTE guidelines: Assistant Professors teach 16 hours/week; Associate Professors teach 14 hours/week; Professors teach 12 hours/week. Each faculty member is assigned 20 undergraduate mentees. Digital course files containing syllabus coverage logs, Bloom's taxonomy question banks, and remedial class attendance must be maintained on the portal.",
      },
      {
        section: "Internal Assessment (IA) Marks Entry Deadlines (§3.2)",
        content: "Internal Assessment tests (IA-1 and IA-2) must follow Bloom's taxonomy levels and Course Outcome (CO) mapping vetted by the Department Academic Audit Committee. Question papers must be submitted 7 days prior. Evaluated marks and attendance must be uploaded to the Faculty Portal within 5 working days of exam completion.",
      },
      {
        section: "Faculty Seed Grants & Research Incentives (§5.1)",
        content: "The Dean of Research awards competitive Institutional Seed Grants up to ₹2,00,000 per project for multidisciplinary technical investigations. Faculty members receive cash incentives of ₹15,000 for SCI/Scopus Q1 journal articles, ₹10,000 for Scopus Q2 publications, and full reimbursement for Indian patent filing expenses.",
      },
      {
        section: "Campus Facilities for Faculty (§6.1)",
        content: "The Faculty Lounge and dining room is situated in Block C, 1st Floor, open 8:30 AM to 5:30 PM. Reserved faculty parking is allocated in Zone P-2 near Admin Quad. Complimentary campus Wi-Fi (SSID: AIT-Faculty-Secure) and staff bus transportation on routes 1 to 8 are provided.",
      },
    ]
  );

  // KB-1002: Student Academic Regulations & Policies
  seed(
    "KB-1002",
    "COL-1001",
    "Anna Institute of Technology - Student Regulations & Academic Policies 2026",
    "Regulation",
    "Controller of Examinations",
    "Students",
    "Mandatory attendance criteria, internal assessment distribution, end-semester exam registration, and scholarship rules.",
    "ait-student-regulations-2026.pdf",
    [
      {
        section: "Attendance & Condonation Rules (§9.1)",
        content: "A minimum of 75% attendance per semester is mandatory to appear for end-semester university examinations. Condonation for attendance between 65% and 74% may be granted by the Principal on genuine medical grounds (hospitalisation/surgery) upon payment of the condonation fee. Students with below 65% attendance are detained and must repeat the semester.",
      },
      {
        section: "Internal Assessment Distribution (§2.1)",
        content: "Internal assessment carries 40 marks: Best of two IA tests scaled to 20 marks, 10 marks for assignments/quizzes, and 10 marks for attendance and classroom participation. End-semester exams carry 60 marks (scaled from 100 marks).",
      },
      {
        section: "End-Semester Examination Applications & Hall Tickets (§11.4)",
        content: "Exam registrations open 2 weeks prior to exam commencement via the Student Portal. Students must verify course codes and arrears before paying the examination fee online. Hall tickets are generated 3 days before exam start.",
      },
      {
        section: "Training & Placement Guidelines (§4.2)",
        content: "The Training & Placement Office is situated in Block A, Ground Floor, Room A-012 (open 9:30 AM – 5:00 PM). Eligible students must register with zero standing arrears and a minimum CGPA of 6.5 for Tier-1 recruitment drives.",
      },
      {
        section: "Scholarships & Financial Aid (§7.1)",
        content: "National Scholarship Portal (NSP), Post-Matric SC/ST/SCC, First Graduate, and Pragati (for female students) applications are processed at Admin Block A, Room A-102. Contact: scholarship@annatech.ac.in.",
      },
    ]
  );

  // KB-1003: Campus Facilities, Health & Emergency Directory
  seed(
    "KB-1003",
    "COL-1001",
    "Anna Institute of Technology - Campus Facilities, Health & Emergency Directory 2026",
    "Guideline",
    "Principal's Office",
    "Institution-wide",
    "Comprehensive directory of administrative offices, library hours, emergency medical centre, hostels, and sports complex.",
    "ait-campus-directory-2026.pdf",
    [
      {
        section: "Administrative Offices Directory (§1.1)",
        content: "Principal's Office: Admin Block A, 1st Floor, Room A-100 (visiting hours 3:00 PM – 5:00 PM). Controller of Examinations (COE): Block B, 1st Floor, Room B-101. Registrar's Office: Block A, Room A-008. Dean Academic Affairs: Block A, Room A-105.",
      },
      {
        section: "Central Library & Digital Resources (§2.1)",
        content: "Located in Block B (2nd & 3rd Floors). Working hours: 8:00 AM to 8:00 PM on all working days, and 9:00 AM to 1:00 PM on Saturdays. Access to IEEE Xplore, ScienceDirect, and DELNET is available on campus and off-campus via RemoteXs.",
      },
      {
        section: "Campus Health Centre & 24/7 Ambulance (§3.1)",
        content: "Located in Block A, Ground Floor, Room A-005. Resident Medical Officer on duty 9:00 AM – 6:00 PM; emergency nursing staff available 24/7. Campus Ambulance emergency helpline: Ext 108 or +91-44-2235-0108.",
      },
      {
        section: "Food Courts & Cafeterias (§4.1)",
        content: "Main Food Court (Block C Ground Floor, 7:30 AM – 7:30 PM); Central Canteen near North Lawn (8:00 AM – 8:30 PM); Nescafe Coffee Kiosk near Central Library; Juice & Snacks Counter adjacent to Block D Sports Complex.",
      },
      {
        section: "Hostels & Residential Code (§5.2)",
        content: "Boys' Hostels (H1 Kaveri, H2 Amaravathi, H3 Vaigai) and Girls' Hostels (H4 Bhavani, H5 Noyyal, H6 Thamirabarani). Hostel curfew is strictly 8:30 PM on weekdays and 9:00 PM on weekends. Chief Warden Office: Block H1 Ground Floor.",
      },
      {
        section: "Anti-Ragging Helpline & Grievance Cell (§7.1)",
        content: "Anna Institute of Technology maintains zero-tolerance towards ragging. 24/7 Anti-Ragging Helpline: 1800-180-5522. Campus Grievance Redressal Committee Head: Dean of Student Affairs, Block A Room A-101.",
      },
      {
        section: "Transportation & College Buses (§9.1)",
        content: "32 bus routes operate across Chennai metropolitan areas and suburbs. Morning buses arrive by 8:30 AM; evening buses depart at 4:30 PM and 5:30 PM. Transport Office: Admin Block A, Counter 3.",
      },
    ]
  );

  // KB-1004: Research, Labs & Facility Booking
  seed(
    "KB-1004",
    "COL-1001",
    "Anna Institute of Technology - Research, Labs & Innovation Policy 2026",
    "Policy",
    "IQAC",
    "Institution-wide",
    "Booking procedures for auditorium, seminar halls, departmental laboratories, and technology business incubator.",
    "ait-research-lab-policy-2026.pdf",
    [
      {
        section: "Auditorium & Seminar Hall Booking (§1.3)",
        content: "APJ Abdul Kalam Auditorium (1,200 capacity) and Mini Seminar Halls (Block B-301, C-201, 150 capacity each) can be reserved by faculty and student societies via the Facilities Portal or at Estate Office Room A-104 with at least 5 days prior notice.",
      },
      {
        section: "Lab Equipment Maintenance & Safety Protocols (§2.4)",
        content: "All department laboratories adhere to ISO 9001:2015 safety protocols. Breakages or equipment maintenance requests must be logged via the Lab Management Portal; emergency repairs are handled by Estate Office Ext 204.",
      },
      {
        section: "Student Innovation & Incubation Centre (§3.1)",
        content: "The Technology Business Incubator (TBI) is located in Block C, 3rd Floor. Offers pre-incubation grants up to ₹50,000, cloud credits, patent filing support, and mentorship for student and faculty startups.",
      },
    ]
  );
}

const memoryKnowledge: KbStore = {
  async list(scope) {
    ensureKbSeed();
    return [...mem.docs.values()].filter((d) => visible(scope, d)).map((d) => clone(d.row)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async get(scope, id) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    return d && visible(scope, d) ? clone(d.row) : undefined;
  },
  async findByTitle(scope, title) {
    ensureKbSeed();
    const t = title.trim().toLowerCase();
    const d = [...mem.docs.values()].find((x) => visible(scope, x) && x.row.status !== "Archived" && x.row.title.toLowerCase() === t);
    return d ? clone(d.row) : undefined;
  },
  async create(collegeId, doc, chunks) {
    ensureKbSeed();
    const id = `KB-${++mem.seq}`;
    const now = new Date().toISOString();
    const row: KbDocRow = {
      ...doc,
      id,
      collegeId,
      chunkCount: chunks.length,
      embeddedCount: chunks.filter((c) => c.embedding).length,
      approvedAt: doc.status === "Approved" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    mem.docs.set(id, { row, chunks: chunks.map((c, i) => ({ ...c, id: `${id}-c${i + 1}` })) });
    return clone(row);
  },
  async update(scope, id, patch) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    if (!d || !visible(scope, d)) return undefined;
    const approving = patch.status === "Approved" && d.row.status !== "Approved";
    d.row = {
      ...d.row,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      approvedAt: approving ? new Date().toISOString() : d.row.approvedAt,
      updatedAt: new Date().toISOString(),
    };
    return clone(d.row);
  },
  async remove(scope, id) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    if (!d || !visible(scope, d)) return false;
    mem.docs.delete(id);
    return true;
  },
  async chunks(scope, id, limit) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    if (!d || !visible(scope, d)) return [];
    return d.chunks.slice(0, limit).map((c, i) => ({ id: c.id, index: i + 1, section: c.section, content: c.content, tokens: c.tokens, page: c.page, embedded: Boolean(c.embedding) }));
  },
  async chunkTexts(scope, id) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    return d && visible(scope, d) ? { title: d.row.title, items: d.chunks.map((c) => ({ section: c.section, content: c.content })) } : undefined;
  },
  async setEmbeddings(scope, id, vectors, model) {
    ensureKbSeed();
    const d = mem.docs.get(id);
    if (!d || !visible(scope, d) || d.chunks.length !== vectors.length) return undefined;
    d.chunks.forEach((c, i) => (c.embedding = vectors[i]!));
    d.row = { ...d.row, embedModel: model, embeddedCount: vectors.length, updatedAt: new Date().toISOString() };
    return clone(d.row);
  },
  async searchable(scope) {
    ensureKbSeed();
    const out: SearchChunk[] = [];
    for (const d of mem.docs.values()) {
      if (!visible(scope, d) || d.row.status !== "Approved") continue;
      for (const c of d.chunks) out.push({ docId: d.row.id, docTitle: d.row.title, section: c.section, content: c.content, page: c.page, embedding: c.embedding });
    }
    return out;
  },
};

export function kbStore(): KbStore {
  return dataBackend() === "postgres" ? postgresKnowledge : memoryKnowledge;
}
