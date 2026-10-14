import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { sharedState } from "./global-state";
import {
  CbcsCategory,
  CbcsCategorySummary,
  CbcsCourse,
  CbcsKpis,
  CbcsOverview,
  CbcsStudentChoice,
  CreateCbcsCourseInput,
  EnrollStudentElectiveInput,
  UpdateCbcsSeatsInput,
  UpdateCbcsWindowInput,
} from "@/lib/api/cbcs-schemas";
import type { ListData } from "@/lib/api/schemas";
import { collegeStream, getCollege } from "./records";

const ARTS_SCIENCE_COURSES: CbcsCourse[] = [
  {
    id: "cbcs-as-1",
    code: "SEC201",
    title: "Data Analytics with Excel & PowerBI",
    offeringDepartment: "Computer Science",
    semester: 4,
    category: "Skill Enhancement Course (SEC)",
    credits: 2,
    seatsTotal: 60,
    seatsFilled: 60,
    instructor: "Dr. K. Anand, M.Sc., Ph.D.",
    schedule: "Tue & Thu, 02:00 PM – 03:30 PM (CS Lab 2)",
    syllabusSummary: "Advanced data models, DAX formulas, interactive KPI dashboards, pivot tables, and statistical forecasting.",
    status: "Full",
  },
  {
    id: "cbcs-as-2",
    code: "GE202",
    title: "Digital Marketing & Content Strategy",
    offeringDepartment: "Commerce",
    semester: 4,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 60,
    seatsFilled: 58,
    instructor: "Prof. S. Divya, MBA, M.Phil.",
    schedule: "Mon & Wed, 10:00 AM – 11:30 AM (Room 204)",
    syllabusSummary: "Search engine optimization (SEO), social media branding, Google Ads campaign metrics, and content calendars.",
    status: "Open",
  },
  {
    id: "cbcs-as-3",
    code: "AECC101",
    title: "Environmental Studies & Sustainable Green Audit",
    offeringDepartment: "Chemistry & Environmental Science",
    semester: 2,
    category: "Ability Enhancement (AECC)",
    credits: 2,
    seatsTotal: 400,
    seatsFilled: 400,
    instructor: "Dr. M. Sangeetha, Ph.D.",
    schedule: "Friday, 09:00 AM – 11:00 AM (Main Auditorium)",
    syllabusSummary: "Ecosystem dynamics, biodiversity conservation, pollution control, e-waste guidelines, and campus climate footprints.",
    status: "Full",
  },
  {
    id: "cbcs-as-4",
    code: "DSE301",
    title: "Tamil Folklore, Ethno-arts & Heritage",
    offeringDepartment: "Tamil Literature",
    semester: 6,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 40,
    seatsFilled: 12,
    instructor: "Dr. R. Selvamani, Ph.D.",
    schedule: "Mon, Wed & Fri, 01:00 PM – 02:00 PM (Language Block)",
    syllabusSummary: "Oral traditions, folk ballads, performative temple arts, archaeological artifacts, and ethno-musicology.",
    status: "Open",
  },
  {
    id: "cbcs-as-5",
    code: "DSE302",
    title: "Green Chemistry & Sustainable Organic Synthesis",
    offeringDepartment: "Chemistry",
    semester: 6,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 40,
    seatsFilled: 34,
    instructor: "Dr. V. Ramanathan, Ph.D.",
    schedule: "Tue & Thu, 11:30 AM – 01:00 PM (Science Block)",
    syllabusSummary: "12 Principles of Green Chemistry, atom economy, supercritical solvents, microwave-assisted reactions, and biocatalysts.",
    status: "Open",
  },
  {
    id: "cbcs-as-6",
    code: "VAC103",
    title: "Yoga, Ergonomics & Mental Well-being",
    offeringDepartment: "Physical Education & Wellness",
    semester: 2,
    category: "Value-Added Course (VAC)",
    credits: 2,
    seatsTotal: 120,
    seatsFilled: 98,
    instructor: "Mr. P. Murugesan, M.P.Ed., NIS",
    schedule: "Tue & Thu, 06:30 AM – 07:30 AM (Indoor Gymnasium)",
    syllabusSummary: "Asanas, pranayama, stress relaxation mechanisms, workplace posture ergonomics, and mindful lifestyle habits.",
    status: "Open",
  },
  {
    id: "cbcs-as-7",
    code: "SEC203",
    title: "Python for Exploratory Data Science",
    offeringDepartment: "Mathematics & Statistics",
    semester: 4,
    category: "Skill Enhancement Course (SEC)",
    credits: 3,
    seatsTotal: 60,
    seatsFilled: 60,
    instructor: "Dr. N. Rajesh, Ph.D.",
    schedule: "Wed & Fri, 02:00 PM – 03:30 PM (Lab 4)",
    syllabusSummary: "NumPy matrix computation, Pandas dataframes, Seaborn visualizations, and statistical hypothesis testing.",
    status: "Full",
  },
  {
    id: "cbcs-as-8",
    code: "GE204",
    title: "Journalism, Podcasting & Media Ethics",
    offeringDepartment: "English & Communication",
    semester: 4,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 50,
    seatsFilled: 46,
    instructor: "Prof. Ananya Roy, M.A., NET",
    schedule: "Mon & Thu, 03:00 PM – 04:30 PM (Media Studio)",
    syllabusSummary: "News gathering, podcast audio editing in Audacity, investigative interview techniques, and broadcast defamation laws.",
    status: "Open",
  },
];

const MANAGEMENT_COURSES: CbcsCourse[] = [
  {
    id: "cbcs-mgmt-1",
    code: "DSE401",
    title: "FinTech Fundamentals & Blockchain Applications",
    offeringDepartment: "Finance",
    semester: 4,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 60,
    seatsFilled: 44,
    instructor: "Prof. S. Harini, Ph.D.",
    schedule: "Mon & Wed, 09:30 AM – 11:00 AM (Seminar Hall 1)",
    syllabusSummary: "Digital payment gateways, UPI architecture, decentralized ledgers, smart contracts, and algorithmic risk management.",
    status: "Open",
  },
  {
    id: "cbcs-mgmt-2",
    code: "DSE402",
    title: "Digital Marketing, SEO & Growth Hacking",
    offeringDepartment: "Marketing",
    semester: 4,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 60,
    seatsFilled: 60,
    instructor: "Prof. K. Arvind, MBA",
    schedule: "Tue & Thu, 10:00 AM – 11:30 AM (Room 302)",
    syllabusSummary: "CAC and LTV funnel optimization, viral loops, influencer partnerships, and attribution modelling.",
    status: "Full",
  },
  {
    id: "cbcs-mgmt-3",
    code: "SEC301",
    title: "Advanced Negotiation & Conflict Resolution",
    offeringDepartment: "Human Resources",
    semester: 3,
    category: "Skill Enhancement Course (SEC)",
    credits: 2,
    seatsTotal: 40,
    seatsFilled: 26,
    instructor: "Dr. P. Nandhini, Ph.D.",
    schedule: "Friday, 02:00 PM – 04:00 PM (Executive Boardroom)",
    syllabusSummary: "Harvard principled negotiation framework, BATNA analysis, psychological anchoring, and collective bargaining simulations.",
    status: "Open",
  },
  {
    id: "cbcs-mgmt-4",
    code: "SEC302",
    title: "Business Analytics with Tableau & Python",
    offeringDepartment: "Operations & Analytics",
    semester: 3,
    category: "Skill Enhancement Course (SEC)",
    credits: 3,
    seatsTotal: 60,
    seatsFilled: 55,
    instructor: "Dr. R. Vignesh, Ph.D.",
    schedule: "Mon & Thu, 02:00 PM – 03:30 PM (Analytics Lab)",
    syllabusSummary: "Executive dashboarding, customer churn predictive models, inventory EOQ sensitivity, and cluster segmentation.",
    status: "Open",
  },
  {
    id: "cbcs-mgmt-5",
    code: "GE201",
    title: "Supply Chain Logistics & Global E-Commerce",
    offeringDepartment: "Supply Chain",
    semester: 2,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 50,
    seatsFilled: 38,
    instructor: "Prof. M. Karthikeyan, MBA",
    schedule: "Tue & Fri, 11:30 AM – 01:00 PM (Room 105)",
    syllabusSummary: "Cross-docking, reverse logistics, Amazon FBA fulfillment, container shipping economics, and customs compliance.",
    status: "Open",
  },
  {
    id: "cbcs-mgmt-6",
    code: "AECC102",
    title: "Corporate Governance, Business Ethics & CSR",
    offeringDepartment: "General Management",
    semester: 2,
    category: "Ability Enhancement (AECC)",
    credits: 2,
    seatsTotal: 120,
    seatsFilled: 110,
    instructor: "Dr. S. Meenakshisundaram, Ph.D.",
    schedule: "Wednesday, 01:30 PM – 03:30 PM (Auditorium)",
    syllabusSummary: "Companies Act 2013 §135 mandates, board independence, insider trading prohibitions, and ESG sustainability reporting.",
    status: "Open",
  },
  {
    id: "cbcs-mgmt-7",
    code: "VAC201",
    title: "Executive Presence & Mindful Leadership",
    offeringDepartment: "Organizational Behaviour",
    semester: 4,
    category: "Value-Added Course (VAC)",
    credits: 2,
    seatsTotal: 40,
    seatsFilled: 40,
    instructor: "Dr. Jayashree Raman, Ph.D.",
    schedule: "Saturday, 10:00 AM – 12:00 PM (Conference Hall)",
    syllabusSummary: "Emotional intelligence in high-stakes decisions, active listening, executive vocal modulation, and burnout resilience.",
    status: "Full",
  },
];

const SEED_STUDENT_CHOICES: CbcsStudentChoice[] = [
  {
    id: "reg-1",
    studentName: "Kavitha Sundaram",
    regNo: "22CS1042",
    department: "Computer Science",
    semester: 4,
    courseId: "cbcs-as-1",
    courseCode: "SEC201",
    courseTitle: "Data Analytics with Excel & PowerBI",
    category: "Skill Enhancement Course (SEC)",
    credits: 2,
    registeredAt: "2026-10-10 10:15",
    status: "Confirmed",
  },
  {
    id: "reg-2",
    studentName: "Dinesh Kumar",
    regNo: "22CO1019",
    department: "Commerce",
    semester: 4,
    courseId: "cbcs-as-2",
    courseCode: "GE202",
    courseTitle: "Digital Marketing & Content Strategy",
    category: "Generic Elective (GE)",
    credits: 3,
    registeredAt: "2026-10-10 11:30",
    status: "Confirmed",
  },
  {
    id: "reg-3",
    studentName: "Sanjay Narayanan",
    regNo: "22EN1008",
    department: "English",
    semester: 4,
    courseId: "cbcs-as-8",
    courseCode: "GE204",
    courseTitle: "Journalism, Podcasting & Media Ethics",
    category: "Generic Elective (GE)",
    credits: 3,
    registeredAt: "2026-10-11 09:20",
    status: "Confirmed",
  },
  {
    id: "reg-4",
    studentName: "Priyanka Balaji",
    regNo: "22CH1027",
    department: "Chemistry",
    semester: 6,
    courseId: "cbcs-as-5",
    courseCode: "DSE302",
    courseTitle: "Green Chemistry & Sustainable Organic Synthesis",
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    registeredAt: "2026-10-11 14:05",
    status: "Confirmed",
  },
  {
    id: "reg-5",
    studentName: "Gokul Prasad",
    regNo: "22MA1014",
    department: "Mathematics",
    semester: 4,
    courseId: "cbcs-as-7",
    courseCode: "SEC203",
    courseTitle: "Python for Exploratory Data Science",
    category: "Skill Enhancement Course (SEC)",
    credits: 3,
    registeredAt: "2026-10-12 08:45",
    status: "Confirmed",
  },
];

interface CbcsStoreState {
  courses: CbcsCourse[];
  registrations: CbcsStudentChoice[];
  windowOpen: boolean;
  deadline: string;
}

function getCbcsStore(collegeScope: string, stream: string): CbcsStoreState {
  const isMgmt = stream === "management" || collegeScope === "COL-1004";
  const initialCourses = isMgmt ? MANAGEMENT_COURSES : ARTS_SCIENCE_COURSES;

  const courses = sharedState(`cbcs.courses.${collegeScope}`, () => initialCourses.map((c) => ({ ...c })));
  const registrations = sharedState(`cbcs.registrations.${collegeScope}`, () => [...SEED_STUDENT_CHOICES]);
  const windowState = sharedState(`cbcs.window.${collegeScope}`, () => ({
    open: true,
    deadline: "2026-10-24 17:00 IST",
  }));

  return {
    courses,
    registrations,
    get windowOpen() {
      return windowState.open;
    },
    set windowOpen(v: boolean) {
      windowState.open = v;
    },
    get deadline() {
      return windowState.deadline;
    },
    set deadline(v: string) {
      windowState.deadline = v;
    },
  };
}

export async function getCbcsOverview(session: SessionPayload): Promise<CbcsOverview> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const college = await getCollege(collegeId);
  const stream = (await collegeStream(collegeId)) || (college?.type === "Management" ? "management" : "artsScience");

  const store = getCbcsStore(collegeId, stream);

  const totalCourses = store.courses.length;
  const totalCapacity = store.courses.reduce((sum, c) => sum + c.seatsTotal, 0);
  const totalEnrolled = store.courses.reduce((sum, c) => sum + c.seatsFilled, 0);
  const seatUtilizationPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 1000) / 10 : 0;
  const fullCoursesCount = store.courses.filter((c) => c.status === "Full" || c.seatsFilled >= c.seatsTotal).length;
  const totalCreditsOffered = store.courses.reduce((sum, c) => sum + c.credits, 0);

  const kpis: CbcsKpis = {
    totalCourses,
    totalCapacity,
    totalEnrolled,
    seatUtilizationPercent,
    fullCoursesCount,
    registrationWindowOpen: store.windowOpen,
    registrationDeadline: store.deadline,
    totalCreditsOffered,
  };

  const categories: CbcsCategory[] = [
    "Discipline-Specific Elective (DSE)",
    "Generic Elective (GE)",
    "Skill Enhancement Course (SEC)",
    "Ability Enhancement (AECC)",
    "Value-Added Course (VAC)",
  ];

  const categorySummaries: CbcsCategorySummary[] = categories.map((cat) => {
    const list = store.courses.filter((c) => c.category === cat);
    const count = list.length;
    const capacity = list.reduce((s, c) => s + c.seatsTotal, 0);
    const enrolled = list.reduce((s, c) => s + c.seatsFilled, 0);
    const utilization = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
    return {
      category: cat,
      count,
      capacity,
      enrolled,
      utilization,
    };
  });

  return {
    collegeId,
    collegeName: college ? String(college.name) : "Kaveri College of Arts & Science",
    stream,
    kpis,
    courses: store.courses,
    studentRegistrations: store.registrations,
    categorySummaries,
  };
}

export async function createCbcsCourse(
  session: SessionPayload,
  input: CreateCbcsCourseInput,
): Promise<CbcsCourse> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const stream = (await collegeStream(collegeId)) || "artsScience";
  const store = getCbcsStore(collegeId, stream);

  const newCourse: CbcsCourse = {
    id: `cbcs-new-${Date.now()}`,
    code: input.code.toUpperCase(),
    title: input.title,
    offeringDepartment: input.offeringDepartment,
    semester: input.semester,
    category: input.category,
    credits: input.credits,
    seatsTotal: input.seatsTotal,
    seatsFilled: 0,
    instructor: input.instructor,
    schedule: input.schedule,
    syllabusSummary: input.syllabusSummary,
    status: "Open",
  };

  store.courses.unshift(newCourse);

  await getStore().audit.add({
    actor: session.name,
    action: `Added CBCS Elective Course: ${newCourse.code} - ${newCourse.title}`,
    target: "cbcs-electives",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return newCourse;
}

export async function updateCbcsSeats(
  session: SessionPayload,
  input: UpdateCbcsSeatsInput,
): Promise<{ ok: boolean; course: CbcsCourse }> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const stream = (await collegeStream(collegeId)) || "artsScience";
  const store = getCbcsStore(collegeId, stream);

  const found = store.courses.find((c) => c.id === input.courseId);
  if (!found) throw new Error("CBCS course not found.");

  found.seatsTotal = input.seatsTotal;
  if (found.seatsFilled >= found.seatsTotal) {
    found.status = "Full";
  } else if (found.status === "Full") {
    found.status = "Open";
  }

  await getStore().audit.add({
    actor: session.name,
    action: `Updated Seat Capacity for ${found.code} to ${found.seatsTotal}`,
    target: "cbcs-electives",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true, course: found };
}

export async function enrollStudentElective(
  session: SessionPayload,
  input: EnrollStudentElectiveInput,
): Promise<{ ok: boolean; registration: CbcsStudentChoice }> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const stream = (await collegeStream(collegeId)) || "artsScience";
  const store = getCbcsStore(collegeId, stream);

  const course = store.courses.find((c) => c.id === input.courseId);
  if (!course) throw new Error("CBCS course not found.");

  if (course.seatsFilled >= course.seatsTotal) {
    throw new Error("This elective course has reached maximum seat capacity.");
  }

  course.seatsFilled += 1;
  if (course.seatsFilled >= course.seatsTotal) {
    course.status = "Full";
  }

  const studentName = input.studentName || session.name || "Student";
  const regNo = input.regNo || "22UG" + Math.floor(1000 + Math.random() * 9000);
  const dept = input.department || "Undergraduate";
  const sem = input.semester || course.semester;

  const now = new Date();
  const regItem: CbcsStudentChoice = {
    id: `reg-${Date.now()}`,
    studentName,
    regNo,
    department: dept,
    semester: sem,
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    category: course.category,
    credits: course.credits,
    registeredAt: `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
    status: "Confirmed",
  };

  store.registrations.unshift(regItem);

  await getStore().audit.add({
    actor: session.name,
    action: `Enrolled student ${studentName} in ${course.code}`,
    target: "cbcs-electives",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true, registration: regItem };
}

export async function dropStudentElective(
  session: SessionPayload,
  registrationId: string,
): Promise<{ ok: boolean }> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const stream = (await collegeStream(collegeId)) || "artsScience";
  const store = getCbcsStore(collegeId, stream);

  const idx = store.registrations.findIndex((r) => r.id === registrationId);
  if (idx === -1) throw new Error("Registration record not found.");

  const removed = store.registrations.splice(idx, 1)[0];
  if (removed) {
    const course = store.courses.find((c) => c.id === removed.courseId);
    if (course && course.seatsFilled > 0) {
      course.seatsFilled -= 1;
      if (course.status === "Full") course.status = "Open";
    }
  }

  await getStore().audit.add({
    actor: session.name,
    action: `Dropped elective registration for ${removed?.studentName} in ${removed?.courseCode}`,
    target: "cbcs-electives",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true };
}

export async function updateCbcsWindow(
  session: SessionPayload,
  input: UpdateCbcsWindowInput,
): Promise<{ ok: boolean; registrationWindowOpen: boolean; registrationDeadline: string }> {
  const collegeId = session.college && session.college !== "all" ? session.college : "COL-1002";
  const stream = (await collegeStream(collegeId)) || "artsScience";
  const store = getCbcsStore(collegeId, stream);

  store.windowOpen = input.registrationWindowOpen;
  store.deadline = input.registrationDeadline;

  await getStore().audit.add({
    actor: session.name,
    action: `Updated CBCS registration window: ${input.registrationWindowOpen ? "OPEN" : "CLOSED"}, deadline: ${input.registrationDeadline}`,
    target: "cbcs-electives",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true, registrationWindowOpen: store.windowOpen, registrationDeadline: store.deadline };
}

/** Dynamic ListData builder for backwards-compatible generic list template */
export async function dynamicCbcsElectivesData(
  collegeScope = "all",
  stream?: string | null,
): Promise<ListData> {
  const mockSession: SessionPayload = {
    college: collegeScope === "all" ? (stream === "management" ? "COL-1004" : "COL-1002") : collegeScope,
    sub: "inst-demo",
    role: "institution",
    name: "Dean Academics",
    tenant: "TNTU",
    mfa: true,
    exp: 0,
  };

  const overview = await getCbcsOverview(mockSession);

  return {
    template: "list",
    columns: [
      { key: "code", label: "Course Code", kind: "text" },
      { key: "title", label: "Elective Course", kind: "text" },
      { key: "category", label: "CBCS Category", kind: "badge" },
      { key: "credits", label: "Credits", kind: "number" },
      { key: "seatsTotal", label: "Capacity", kind: "number" },
      { key: "seatsFilled", label: "Filled", kind: "number" },
      { key: "status", label: "Status", kind: "badge" },
    ],
    rows: overview.courses.map((c) => ({
      code: c.code,
      title: c.title,
      category: c.category,
      credits: c.credits,
      seatsTotal: c.seatsTotal,
      seatsFilled: c.seatsFilled,
      status: c.status,
    })),
    filterKey: "category",
    primaryAction: "Choose electives",
  };
}
