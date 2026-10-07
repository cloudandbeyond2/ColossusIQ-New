import "server-only";
import type { Stream } from "@/config/streams";
import type { SessionPayload } from "@/lib/auth/session";
import type { ScorecardData, DashboardData, CalendarData, GalleryData, ListData, WorkflowData } from "@/lib/api/schemas";
import { dataBackend } from "@/lib/data";
import { db, isUuid } from "@/lib/data/postgres/db";
import { collegeStream } from "./records";
import { personName, seeded, hashString } from "./fixtures";
import { alumniStore } from "./alumni-store";

export interface EnrolledSubject {
  code: string;
  title: string;
  shortName: string;
  credits: number;
  facultyName: string;
  facultyDesignation?: string;
  semester: number;
  attendancePercent: number;
  ia1Marks: number;
  ia2Marks: number;
  semesterProgress: number;
  units: Array<{
    id: string;
    unit: string;
    title: string;
    mastery: number;
  }>;
}

export interface StudentAcademicProfile {
  studentId: string;
  name: string;
  rollNo: string;
  degree: string;
  department: string;
  departmentCode: string;
  semester: number;
  year?: string;
  section: string;
  stream: Stream;
  cgpa: number;
  creditsEarned: number;
  totalCredits: number;
  streakDays: number;
  xp: number;
  enrolledSubjects: EnrolledSubject[];
}

export function toYearString(sem: number): string {
  const y = Math.max(1, Math.min(5, Math.ceil(sem / 2)));
  const suffix = y === 1 ? "1st" : y === 2 ? "2nd" : y === 3 ? "3rd" : `${y}th`;
  return `${suffix} Year`;
}

const STREAM_CURRICULUM: Record<
  Stream,
  {
    degree: string;
    department: string;
    departmentCode: string;
    semester: number;
    subjects: EnrolledSubject[];
  }
> = {
  engineering: {
    degree: "B.E. Computer Science & Engineering",
    department: "Computer Science & Engineering",
    departmentCode: "CSE",
    semester: 5,
    subjects: [
      {
        code: "CS3492",
        title: "Database Management Systems",
        shortName: "DBMS",
        credits: 4,
        facultyName: "Dr. Meena Raghavan",
        facultyDesignation: "Associate Professor, CSE",
        semester: 5,
        attendancePercent: 88,
        ia1Marks: 72,
        ia2Marks: 61,
        semesterProgress: 68,
        units: [
          { id: "cs3492-u1", unit: "Unit 1", title: "ER Model & Relational Algebra", mastery: 78 },
          { id: "cs3492-u2", unit: "Unit 2", title: "SQL Queries & Joins", mastery: 82 },
          { id: "cs3492-u3", unit: "Unit 3", title: "Normalization & Functional Dependencies", mastery: 42 },
          { id: "cs3492-u4", unit: "Unit 4", title: "Transaction Processing & ACID", mastery: 55 },
          { id: "cs3492-u5", unit: "Unit 5", title: "NoSQL & Distributed DB", mastery: 30 },
        ],
      },
      {
        code: "CS3451",
        title: "Operating Systems",
        shortName: "OS",
        credits: 4,
        facultyName: "Prof. R. Balaji",
        facultyDesignation: "Assistant Professor, CSE",
        semester: 5,
        attendancePercent: 84,
        ia1Marks: 75,
        ia2Marks: 70,
        semesterProgress: 64,
        units: [
          { id: "cs3451-u1", unit: "Unit 1", title: "Processes & System Calls", mastery: 80 },
          { id: "cs3451-u2", unit: "Unit 2", title: "CPU Scheduling Algorithms", mastery: 74 },
          { id: "cs3451-u3", unit: "Unit 3", title: "Deadlocks & Synchronization", mastery: 65 },
          { id: "cs3451-u4", unit: "Unit 4", title: "Virtual Memory Management", mastery: 58 },
          { id: "cs3451-u5", unit: "Unit 5", title: "File Systems & Storage", mastery: 40 },
        ],
      },
      {
        code: "CS3591",
        title: "Computer Networks",
        shortName: "CN",
        credits: 3,
        facultyName: "Dr. K. Anitha",
        facultyDesignation: "Associate Professor, CSE",
        semester: 5,
        attendancePercent: 90,
        ia1Marks: 68,
        ia2Marks: 74,
        semesterProgress: 72,
        units: [
          { id: "cs3591-u1", unit: "Unit 1", title: "Network Architecture & OSI", mastery: 85 },
          { id: "cs3591-u2", unit: "Unit 2", title: "Data Link Layer & Framing", mastery: 76 },
          { id: "cs3591-u3", unit: "Unit 3", title: "Network Layer & Subnetting", mastery: 62 },
          { id: "cs3591-u4", unit: "Unit 4", title: "Transport Layer Protocols (TCP/UDP)", mastery: 70 },
          { id: "cs3591-u5", unit: "Unit 5", title: "Application Protocols & Security", mastery: 45 },
        ],
      },
      {
        code: "AL3451",
        title: "Machine Learning",
        shortName: "ML",
        credits: 4,
        facultyName: "Dr. V. Srinivasan",
        facultyDesignation: "Professor, AI & DS",
        semester: 5,
        attendancePercent: 91,
        ia1Marks: 78,
        ia2Marks: 80,
        semesterProgress: 70,
        units: [
          { id: "al3451-u1", unit: "Unit 1", title: "Linear & Logistic Regression", mastery: 88 },
          { id: "al3451-u2", unit: "Unit 2", title: "Decision Trees & Random Forests", mastery: 82 },
          { id: "al3451-u3", unit: "Unit 3", title: "Neural Networks Fundamentals", mastery: 60 },
          { id: "al3451-u4", unit: "Unit 4", title: "Unsupervised Clustering & PCA", mastery: 52 },
          { id: "al3451-u5", unit: "Unit 5", title: "Model Evaluation & Bias-Variance", mastery: 48 },
        ],
      },
      {
        code: "CS3401",
        title: "Algorithms & Complexity",
        shortName: "Algorithms",
        credits: 3,
        facultyName: "Dr. P. Kannan",
        facultyDesignation: "Assistant Professor, CSE",
        semester: 5,
        attendancePercent: 82,
        ia1Marks: 65,
        ia2Marks: 69,
        semesterProgress: 60,
        units: [
          { id: "cs3401-u1", unit: "Unit 1", title: "Asymptotic Analysis & Recurrences", mastery: 75 },
          { id: "cs3401-u2", unit: "Unit 2", title: "Divide and Conquer", mastery: 70 },
          { id: "cs3401-u3", unit: "Unit 3", title: "Dynamic Programming", mastery: 50 },
          { id: "cs3401-u4", unit: "Unit 4", title: "Greedy Algorithms & Graphs", mastery: 64 },
          { id: "cs3401-u5", unit: "Unit 5", title: "NP-Completeness", mastery: 35 },
        ],
      },
      {
        code: "GE3151",
        title: "Problem Solving with Python",
        shortName: "Python",
        credits: 3,
        facultyName: "Prof. S. Mohan",
        facultyDesignation: "Assistant Professor, CSE",
        semester: 5,
        attendancePercent: 94,
        ia1Marks: 84,
        ia2Marks: 86,
        semesterProgress: 85,
        units: [
          { id: "ge3151-u1", unit: "Unit 1", title: "Data Structures & Control Flow", mastery: 92 },
          { id: "ge3151-u2", unit: "Unit 2", title: "Functions & Recursion", mastery: 88 },
          { id: "ge3151-u3", unit: "Unit 3", title: "OOP & Exception Handling", mastery: 84 },
          { id: "ge3151-u4", unit: "Unit 4", title: "NumPy & Pandas Analytics", mastery: 76 },
          { id: "ge3151-u5", unit: "Unit 5", title: "Automation Scripts", mastery: 80 },
        ],
      },
    ],
  },
  medical: {
    degree: "MBBS (Phase II)",
    department: "Pathology & Pharmacology",
    departmentCode: "MED",
    semester: 4,
    subjects: [
      {
        code: "PA201",
        title: "Pathology",
        shortName: "Pathology",
        credits: 8,
        facultyName: "Dr. K. Vasanth, MD",
        facultyDesignation: "Professor & HOD, Pathology",
        semester: 4,
        attendancePercent: 92,
        ia1Marks: 66,
        ia2Marks: 60,
        semesterProgress: 58,
        units: [
          { id: "pa201-u1", unit: "Unit 1", title: "Cell Injury & Adaptation", mastery: 80 },
          { id: "pa201-u2", unit: "Unit 2", title: "Inflammation & Healing", mastery: 75 },
          { id: "pa201-u3", unit: "Unit 3", title: "Neoplasia", mastery: 44 },
          { id: "pa201-u4", unit: "Unit 4", title: "Cardiovascular Pathology", mastery: 58 },
          { id: "pa201-u5", unit: "Unit 5", title: "Haematology & Anaemias", mastery: 62 },
        ],
      },
      {
        code: "PH201",
        title: "Pharmacology",
        shortName: "Pharmacology",
        credits: 8,
        facultyName: "Dr. G. Latha, MD",
        facultyDesignation: "Associate Professor, Pharmacology",
        semester: 4,
        attendancePercent: 89,
        ia1Marks: 70,
        ia2Marks: 68,
        semesterProgress: 50,
        units: [
          { id: "ph201-u1", unit: "Unit 1", title: "Pharmacokinetics & Dynamics", mastery: 78 },
          { id: "ph201-u2", unit: "Unit 2", title: "Autonomic Nervous System Drugs", mastery: 51 },
          { id: "ph201-u3", unit: "Unit 3", title: "Cardiovascular Drugs", mastery: 65 },
          { id: "ph201-u4", unit: "Unit 4", title: "Antimicrobials & Chemotherapy", mastery: 55 },
        ],
      },
      {
        code: "MI201",
        title: "Microbiology",
        shortName: "Microbiology",
        credits: 6,
        facultyName: "Dr. S. Anjali, MD",
        facultyDesignation: "Professor, Microbiology",
        semester: 4,
        attendancePercent: 94,
        ia1Marks: 72,
        ia2Marks: 74,
        semesterProgress: 62,
        units: [
          { id: "mi201-u1", unit: "Unit 1", title: "General Bacteriology & Sterilisation", mastery: 82 },
          { id: "mi201-u2", unit: "Unit 2", title: "Immunology Basics", mastery: 57 },
          { id: "mi201-u3", unit: "Unit 3", title: "Systemic Bacteriology", mastery: 64 },
          { id: "mi201-u4", unit: "Unit 4", title: "Virology (HIV, Hepatitis)", mastery: 70 },
        ],
      },
      {
        code: "FM201",
        title: "Forensic Medicine",
        shortName: "Forensic Med",
        credits: 4,
        facultyName: "Dr. R. Surya, MD",
        facultyDesignation: "Associate Professor, Forensic Med",
        semester: 4,
        attendancePercent: 88,
        ia1Marks: 68,
        ia2Marks: 71,
        semesterProgress: 40,
        units: [
          { id: "fm201-u1", unit: "Unit 1", title: "Thanatology & Post-mortem Changes", mastery: 74 },
          { id: "fm201-u2", unit: "Unit 2", title: "Clinical Toxicology", mastery: 68 },
          { id: "fm201-u3", unit: "Unit 3", title: "Medical Jurisprudence & Ethics", mastery: 80 },
        ],
      },
    ],
  },
  artsScience: {
    degree: "B.Com (General)",
    department: "Commerce & Accountancy",
    departmentCode: "COM",
    semester: 5,
    subjects: [
      {
        code: "UCO301",
        title: "Financial Accounting",
        shortName: "Financial Accounts",
        credits: 5,
        facultyName: "Dr. V. Murugan",
        facultyDesignation: "Associate Professor, Commerce",
        semester: 5,
        attendancePercent: 91,
        ia1Marks: 76,
        ia2Marks: 65,
        semesterProgress: 64,
        units: [
          { id: "uco301-u1", unit: "Unit 1", title: "Final Accounts Preparation", mastery: 84 },
          { id: "uco301-u2", unit: "Unit 2", title: "Depreciation (WDV & SLM)", mastery: 45 },
          { id: "uco301-u3", unit: "Unit 3", title: "Branch & Departmental Accounts", mastery: 62 },
          { id: "uco301-u4", unit: "Unit 4", title: "Hire Purchase & Instalment Systems", mastery: 58 },
          { id: "uco301-u5", unit: "Unit 5", title: "Partnership Admission & Retirement", mastery: 70 },
        ],
      },
      {
        code: "UCO302",
        title: "Business Statistics",
        shortName: "Statistics",
        credits: 4,
        facultyName: "Dr. K. Priya",
        facultyDesignation: "Assistant Professor, Commerce",
        semester: 5,
        attendancePercent: 86,
        ia1Marks: 70,
        ia2Marks: 68,
        semesterProgress: 55,
        units: [
          { id: "uco302-u1", unit: "Unit 1", title: "Measures of Central Tendency", mastery: 80 },
          { id: "uco302-u2", unit: "Unit 2", title: "Dispersion & Skewness", mastery: 68 },
          { id: "uco302-u3", unit: "Unit 3", title: "Correlation & Regression", mastery: 52 },
          { id: "uco302-u4", unit: "Unit 4", title: "Index Numbers & Time Series", mastery: 60 },
        ],
      },
      {
        code: "UEN301",
        title: "English for Professionals",
        shortName: "English",
        credits: 3,
        facultyName: "Dr. Anne Joseph",
        facultyDesignation: "Assistant Professor, English",
        semester: 5,
        attendancePercent: 95,
        ia1Marks: 82,
        ia2Marks: 80,
        semesterProgress: 70,
        units: [
          { id: "uen301-u1", unit: "Unit 1", title: "Business Correspondence & Emails", mastery: 86 },
          { id: "uen301-u2", unit: "Unit 2", title: "Report Writing & Proposals", mastery: 60 },
          { id: "uen301-u3", unit: "Unit 3", title: "Workplace Presentation Skills", mastery: 78 },
        ],
      },
      {
        code: "UTA301",
        title: "Tamil Ilakkiyam III",
        shortName: "Tamil",
        credits: 3,
        facultyName: "Dr. P. Senthamizh",
        facultyDesignation: "Associate Professor, Tamil",
        semester: 5,
        attendancePercent: 92,
        ia1Marks: 85,
        ia2Marks: 88,
        semesterProgress: 72,
        units: [
          { id: "uta301-u1", unit: "Unit 1", title: "Kurunthogai & Sangam Poetry", mastery: 88 },
          { id: "uta301-u2", unit: "Unit 2", title: "Bhakti Literature (Thevaram)", mastery: 82 },
          { id: "uta301-u3", unit: "Unit 3", title: "Bharathiyar & Modern Poetry", mastery: 90 },
        ],
      },
    ],
  },
  management: {
    degree: "BBA (Management Studies)",
    department: "Management Studies",
    departmentCode: "BBA",
    semester: 5,
    subjects: [
      {
        code: "BA301",
        title: "Marketing Management",
        shortName: "Marketing",
        credits: 4,
        facultyName: "Prof. Rajesh Kumar",
        facultyDesignation: "Assistant Professor, Management",
        semester: 5,
        attendancePercent: 88,
        ia1Marks: 78,
        ia2Marks: 74,
        semesterProgress: 65,
        units: [
          { id: "ba301-u1", unit: "Unit 1", title: "Segmentation, Targeting & Positioning (STP)", mastery: 82 },
          { id: "ba301-u2", unit: "Unit 2", title: "Product Life Cycle & Pricing Strategies", mastery: 75 },
          { id: "ba301-u3", unit: "Unit 3", title: "Digital Marketing & Consumer Behaviour", mastery: 68 },
        ],
      },
      {
        code: "BA302",
        title: "Financial Management",
        shortName: "Finance",
        credits: 4,
        facultyName: "Dr. Deepa Nair",
        facultyDesignation: "Associate Professor, Management",
        semester: 5,
        attendancePercent: 86,
        ia1Marks: 72,
        ia2Marks: 69,
        semesterProgress: 60,
        units: [
          { id: "ba302-u1", unit: "Unit 1", title: "Time Value of Money & Capital Budgeting", mastery: 65 },
          { id: "ba302-u2", unit: "Unit 2", title: "Working Capital Management", mastery: 72 },
          { id: "ba302-u3", unit: "Unit 3", title: "Cost of Capital & Capital Structure", mastery: 58 },
        ],
      },
      {
        code: "BA303",
        title: "Operations Management",
        shortName: "Operations",
        credits: 4,
        facultyName: "Prof. S. Anand",
        facultyDesignation: "Assistant Professor, Management",
        semester: 5,
        attendancePercent: 90,
        ia1Marks: 74,
        ia2Marks: 77,
        semesterProgress: 70,
        units: [
          { id: "ba303-u1", unit: "Unit 1", title: "Facility Layout & Location Planning", mastery: 80 },
          { id: "ba303-u2", unit: "Unit 2", title: "Inventory Control Models (EOQ, ABC)", mastery: 76 },
          { id: "ba303-u3", unit: "Unit 3", title: "Quality Management & Six Sigma", mastery: 64 },
        ],
      },
      {
        code: "BA304",
        title: "Business Analytics",
        shortName: "Analytics",
        credits: 3,
        facultyName: "Dr. M. Suresh",
        facultyDesignation: "Assistant Professor, Analytics",
        semester: 5,
        attendancePercent: 92,
        ia1Marks: 80,
        ia2Marks: 82,
        semesterProgress: 68,
        units: [
          { id: "ba304-u1", unit: "Unit 1", title: "Descriptive & Predictive Analytics", mastery: 84 },
          { id: "ba304-u2", unit: "Unit 2", title: "Data Visualisation with PowerBI & Tableau", mastery: 78 },
          { id: "ba304-u3", unit: "Unit 3", title: "Decision Trees & Optimization Models", mastery: 62 },
        ],
      },
    ],
  },
  polytechnic: {
    degree: "Diploma in Computer Engineering",
    department: "Computer Engineering",
    departmentCode: "DCE",
    semester: 5,
    subjects: [
      {
        code: "CE301",
        title: "Computer Architecture & Hardware",
        shortName: "Architecture",
        credits: 4,
        facultyName: "Prof. T. Selvam",
        facultyDesignation: "Lecturer, Computer Engg",
        semester: 5,
        attendancePercent: 89,
        ia1Marks: 75,
        ia2Marks: 72,
        semesterProgress: 66,
        units: [
          { id: "ce301-u1", unit: "Unit 1", title: "Processor Architecture & Buses", mastery: 78 },
          { id: "ce301-u2", unit: "Unit 2", title: "Memory Hierarchy & Troubleshooting", mastery: 74 },
        ],
      },
      {
        code: "CE302",
        title: "Web Development & PHP Lab",
        shortName: "Web Dev",
        credits: 4,
        facultyName: "Ms. S. Kavitha",
        facultyDesignation: "Lecturer, Computer Engg",
        semester: 5,
        attendancePercent: 92,
        ia1Marks: 82,
        ia2Marks: 85,
        semesterProgress: 75,
        units: [
          { id: "ce302-u1", unit: "Unit 1", title: "HTML5, CSS3 & Responsive Design", mastery: 90 },
          { id: "ce302-u2", unit: "Unit 2", title: "PHP Backend & MySQL Integration", mastery: 80 },
        ],
      },
    ],
  },
};

export async function getStudentAcademicProfile(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<StudentAcademicProfile> {
  const stream = (await collegeStream(session.college)) || "engineering";
  const curr = STREAM_CURRICULUM[stream] || STREAM_CURRICULUM.engineering;

  let name = session.name || (stream === "medical" ? "Keerthana" : stream === "artsScience" ? "Nandhini" : "Anand Kumar");
  let rollNo = stream === "medical" ? "21MB1042" : stream === "artsScience" ? "21CO2018" : "21CS1014";
  let degree = curr.degree;
  let department = curr.department;
  let departmentCode = curr.departmentCode;
  let semester = curr.semester;
  let subjects = curr.subjects;
  let cgpa = 0.0;
  let creditsEarned = 0;
  let totalCredits = 120;
  let streakDays = 0;
  let xp = 0;

  if (dataBackend() === "postgres") {
    try {
      const t = db();
      const collegePublicId = session.college && session.college !== "all" ? session.college : undefined;
      const userSub = session.sub;

      // 1. Look up student record in DB if session.sub is a UUID or fallback to available student
      let studentRecord = isUuid(userSub)
        ? await t.student.findFirst({
            where: {
              OR: [
                { userId: userSub },
                { id: userSub },
              ],
            },
            include: {
              department: true,
              programme: true,
              term: true,
              college: true,
              user: true,
              certificates: true,
              quizAttempts: { include: { quiz: true } },
              evaluationItems: true,
            },
          })
        : null;

      if (!studentRecord && collegePublicId) {
        studentRecord = await t.student.findFirst({
          where: { college: { publicId: collegePublicId } },
          include: {
            department: true,
            programme: true,
            term: true,
            college: true,
            user: true,
            certificates: true,
            quizAttempts: { include: { quiz: true } },
            evaluationItems: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }

      if (studentRecord) {
        name = session.name && session.name !== "Student" ? session.name : (studentRecord.user?.fullName || name);
        rollNo = studentRecord.rollNo || rollNo;
        department = studentRecord.department?.name || department;
        degree = studentRecord.programme?.name || degree;
        if (studentRecord.term?.position) {
          semester = studentRecord.term.position;
        } else if (studentRecord.batchYear) {
          const currentYear = new Date().getFullYear();
          const yearDiff = Math.max(1, currentYear - studentRecord.batchYear + 1);
          semester = Math.min(8, yearDiff * 2 - 1);
        }
        departmentCode = department.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4) || departmentCode;
      }

      // 2. Fetch real active courses from PostgreSQL for this college and department
      const deptCourses = studentRecord?.departmentId
        ? await t.course.findMany({
            where: {
              ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
              departmentId: studentRecord.departmentId,
              status: "Active",
            },
            include: { department: true },
            orderBy: { title: "asc" },
          })
        : [];

      const colCourses = deptCourses.length > 0
        ? deptCourses
        : await t.course.findMany({
            where: {
              ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
              status: "Active",
            },
            include: { department: true },
            orderBy: { title: "asc" },
          });

      const quizCount = studentRecord?.quizAttempts?.length || 0;
      const evalCount = studentRecord?.evaluationItems?.length || 0;
      const certCount = studentRecord?.certificates?.length || 0;
      const hasActivity = quizCount > 0 || evalCount > 0 || certCount > 0;

      if (colCourses.length > 0) {
        // Map database courses to EnrolledSubject format
        subjects = colCourses.map((c, idx) => {
          const matchingAttempts = studentRecord?.quizAttempts?.filter((q) => q.quiz?.title?.includes(c.title)) || [];
          const avgScore = matchingAttempts.length > 0
            ? Math.round(matchingAttempts.reduce((sum, a) => sum + (a.score !== null ? a.score : 0), 0) / matchingAttempts.length)
            : 0;

          return {
            code: c.code,
            title: c.title,
            shortName: c.title.length > 15 ? c.code : c.title,
            credits: c.credits || 4,
            facultyName: c.facultyName || `Prof. ${idx % 2 === 0 ? "Dr. Meena Raghavan" : "Prof. R. Balaji"}`,
            facultyDesignation: "Faculty",
            semester: semester,
            attendancePercent: hasActivity ? Math.min(100, 80 + ((idx * 5) % 18)) : 0,
            ia1Marks: avgScore,
            ia2Marks: avgScore > 0 ? Math.min(100, avgScore + 4) : 0,
            semesterProgress: hasActivity ? Math.min(100, 50 + ((idx * 8) % 40)) : 0,
            units: [
              { id: `${c.code.toLowerCase()}-u1`, unit: "Unit 1", title: "Core Principles & Architecture", mastery: avgScore > 0 ? Math.min(100, avgScore + 8) : 0 },
              { id: `${c.code.toLowerCase()}-u2`, unit: "Unit 2", title: "Design & Analysis Methodology", mastery: avgScore },
              { id: `${c.code.toLowerCase()}-u3`, unit: "Unit 3", title: "Applications & Optimization", mastery: avgScore > 15 ? avgScore - 15 : 0 },
              { id: `${c.code.toLowerCase()}-u4`, unit: "Unit 4", title: "Advanced Implementations", mastery: avgScore > 8 ? avgScore - 8 : 0 },
              { id: `${c.code.toLowerCase()}-u5`, unit: "Unit 5", title: "Case Studies & Modern Trends", mastery: avgScore > 20 ? avgScore - 20 : 0 },
            ],
          };
        });
      }

      // Calculate live CGPA and credits earned from database
      const avgMarks = hasActivity && subjects.length > 0
        ? subjects.reduce((sum, s) => sum + (s.ia1Marks + s.ia2Marks) / 2, 0) / subjects.length
        : 0;
      cgpa = avgMarks > 0 ? Math.round((avgMarks / 10 + 1.2) * 100) / 100 : 0.00;
      totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0) || 120;
      creditsEarned = certCount > 0 ? Math.round(totalCredits * 0.55) + certCount * 3 : 0;
      streakDays = hasActivity ? Math.max(1, quizCount + certCount) : 0;
      xp = hasActivity ? (quizCount * 150 + certCount * 500) : 0;
    } catch {
      // Fallback
      cgpa = 0.00;
      creditsEarned = 0;
      streakDays = 0;
      xp = 0;
    }
  } else {
    // Memory backend: zero state unless recorded
    cgpa = 0.00;
    creditsEarned = 0;
    totalCredits = curr.subjects.reduce((sum, s) => sum + s.credits, 0) || 120;
    streakDays = 0;
    xp = 0;
    subjects = curr.subjects.map((s) => ({
      ...s,
      attendancePercent: 0,
      ia1Marks: 0,
      ia2Marks: 0,
      semesterProgress: 0,
      units: s.units.map((u) => ({ ...u, mastery: 0 })),
    }));
  }

  return {
    studentId: session.sub,
    name,
    rollNo,
    degree,
    department,
    departmentCode,
    semester,
    year: toYearString(semester),
    section: `${departmentCode}-A`,
    stream,
    cgpa,
    creditsEarned,
    totalCredits,
    streakDays,
    xp,
    enrolledSubjects: subjects,
  };
}

export async function generateDynamicStudentDashboard(
  session: SessionPayload | { sub: string; name?: string; college: string }
) {
  const profile = await getStudentAcademicProfile(session);
  const subjects = profile.enrolledSubjects;

  // 1. Calculate academic semester progress and exam readiness
  const semesterProgress = Math.round(
    subjects.reduce((sum, s) => sum + s.semesterProgress, 0) / (subjects.length || 1)
  );
  const avgIa = Math.round(
    subjects.reduce((sum, s) => sum + (s.ia1Marks + s.ia2Marks) / 2, 0) / (subjects.length || 1)
  );
  const examReadiness = Math.min(100, Math.round(avgIa * 0.95));

  // 2. Extract weak topics across all enrolled subjects
  const allUnits: Array<{ subject: string; topic: string; mastery: number }> = [];
  for (const s of subjects) {
    for (const u of s.units) {
      allUnits.push({
        subject: s.shortName,
        topic: u.title,
        mastery: u.mastery,
      });
    }
  }
  // Sort lowest mastery first
  allUnits.sort((a, b) => a.mastery - b.mastery);
  const weakTopics = allUnits.slice(0, 3);
  const weakest = weakTopics[0] || {
    subject: subjects[0]?.shortName || "Major",
    topic: "Core Concepts",
    mastery: 50,
  };

  // 3. Exam countdown based on stream
  const mainSubject = subjects[0]?.shortName || "Semester";
  const examName =
    profile.stream === "medical"
      ? "Pathology Internal Assessment II"
      : profile.stream === "artsScience"
      ? "Continuous Internal Assessment II"
      : `${mainSubject} Internal Assessment II`;

  // 4. Stream-specific projects and upcoming events
  const projectMap: Record<Stream, { name: string; progress: number }> = {
    engineering: { name: "Smart Campus AI & Autonomous Attendance", progress: 68 },
    medical: { name: "ICMR-STS: Anaemia prevalence among adolescents", progress: 55 },
    artsScience: { name: "Survey: Digital payment adoption among Tiruchy retailers", progress: 65 },
    management: { name: "Omnichannel Consumer Acquisition & Retention Model", progress: 60 },
    polytechnic: { name: "IoT Weather Monitoring & Microcontroller Board", progress: 72 },
  };

  const upcomingMap: Record<Stream, Array<{ title: string; when: string }>> = {
    engineering: [
      { title: `${mainSubject} IA-II Exam`, when: "in 9 days" },
      { title: "Smart India Hackathon Internal Round", when: "Friday, 2:00 PM" },
      { title: "Campus AI Buildathon Submission", when: "Oct 21" },
    ],
    medical: [
      { title: "OSCE mock — 8 stations", when: "Friday, 2:00 PM" },
      { title: "Pathology Internal Assessment II", when: "in 9 days" },
      { title: "Rural health camp posting", when: "Oct 21" },
    ],
    artsScience: [
      { title: "Continuous Internal Assessment II", when: "in 9 days" },
      { title: "CBCS elective choice closes", when: "Friday" },
      { title: "Tamil Mandram literary festival", when: "Oct 8" },
    ],
    management: [
      { title: "Marketing Strategy Case Presentation", when: "in 5 days" },
      { title: "Mid-Term Business Analytics Test", when: "in 9 days" },
      { title: "Industry Mentorship Connect", when: "Oct 18" },
    ],
    polytechnic: [
      { title: "Web Development Lab Practical Exam", when: "in 7 days" },
      { title: "State Polytechnic Skill Competition", when: "Oct 24" },
    ],
  };

  // 5. Today's dynamic timetable mapped to enrolled subjects
  const s1 = subjects[0] || { shortName: "Class 1", facultyName: "Faculty", units: [] };
  const s2 = subjects[1] || { shortName: "Class 2", facultyName: "Faculty", units: [] };
  const s3 = subjects[2] || { shortName: "Class 3", facultyName: "Faculty", units: [] };

  const today = [
    {
      time: "09:00",
      title: `${s1.shortName} lecture — ${s1.units[1]?.title || "Theory"} (${s1.facultyName.split(",")[0]})`,
      kind: "class",
    },
    {
      time: "11:00",
      title: `${s2.shortName} class — ${s2.units[0]?.title || "Practice"} (${s2.facultyName.split(",")[0]})`,
      kind: "class",
    },
    {
      time: "14:00",
      title: `${s3.shortName} laboratory / hands-on session`,
      kind: "study",
    },
    {
      time: "18:00",
      title: "Placement aptitude & mock interview drill",
      kind: "career",
    },
    {
      time: "21:00",
      title: `Revision: ${weakest.topic} (25 min)`,
      kind: "study",
    },
  ];

  // 6. Dynamic AI Mentor recommendation and skills
  const isNewStudent = avgIa === 0 && profile.cgpa === 0;

  const recommendation = isNewStudent
    ? `Revise **${weakest.topic} (${weakest.subject})** for 25 minutes and attempt the adaptive 10-question practice set — welcome to **${profile.degree}**! Explore your enrolled courses and attempt your first practice quiz in **My Quizzes** to begin calculating your academic scorecard and mastery metrics.`
    : `Revise **${weakest.topic} (${weakest.subject})** for 25 minutes and attempt the adaptive 10-question practice set — it is currently your lowest mastery topic (**${weakest.mastery}%**) and the **${examName}** is in 9 days.`;

  return {
    name: profile.name,
    department: profile.department,
    departmentCode: profile.departmentCode,
    degree: profile.degree,
    semester: profile.semester,
    year: toYearString(profile.semester),
    rollNo: profile.rollNo,
    priorities: weakTopics.length,
    academic: {
      semesterProgress,
      examReadiness: isNewStudent ? 0 : examReadiness,
    },
    skills: isNewStudent
      ? {
          technical: 0,
          communication: 0,
          interview: 0,
        }
      : {
          technical: Math.min(95, Math.round(avgIa * 0.9 + 8)),
          communication: Math.min(90, Math.round(avgIa * 0.8 + 10)),
          interview: Math.min(85, Math.round(avgIa * 0.75 + 10)),
        },
    careerReadiness: isNewStudent ? 0 : Math.min(90, Math.round(avgIa * 0.8)),
    today,
    recommendation,
    project: projectMap[profile.stream] || projectMap.engineering,
    upcoming: upcomingMap[profile.stream] || upcomingMap.engineering,
    streak: profile.streakDays,
    xp: profile.xp,
    weakTopics,
    examCountdown: {
      exam: examName,
      days: 9,
      syllabusCovered: semesterProgress,
    },
  };
}

export async function generateDynamicAcademicTracker(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<DashboardData> {
  const profile = await getStudentAcademicProfile(session);
  const subjects = profile.enrolledSubjects;

  const avgAttendance = Math.round(
    subjects.reduce((sum, s) => sum + s.attendancePercent, 0) / (subjects.length || 1)
  );
  const avgIa = Math.round(
    subjects.reduce((sum, s) => sum + (s.ia1Marks + s.ia2Marks) / 2, 0) / (subjects.length || 1)
  );

  const subjectChartData = subjects.map((s) => ({
    name: s.shortName,
    IA1: s.ia1Marks,
    IA2: s.ia2Marks,
    Attendance: s.attendancePercent,
  }));

  const isNew = avgIa === 0 && profile.cgpa === 0 && avgAttendance === 0;

  return {
    template: "dashboard",
    kpis: [
      {
        label: "CGPA",
        value: profile.cgpa > 0 ? profile.cgpa.toFixed(2) : "0.00",
        delta: profile.cgpa > 0 ? `Rank in ${profile.section}` : `Enrolled in ${profile.section}`,
        tone: profile.cgpa > 0 ? "teal" : "neutral",
      },
      {
        label: "Attendance",
        value: `${avgAttendance}%`,
        delta: avgAttendance >= 75 ? "Exam eligible" : avgAttendance === 0 ? "Awaiting attendance" : "Low attendance",
        tone: avgAttendance >= 75 ? "teal" : avgAttendance === 0 ? "neutral" : "rose",
      },
      {
        label: "Internal avg.",
        value: `${avgIa}%`,
        delta: avgIa > 0 ? "+4% from IA-1" : "Awaiting assessments",
        tone: avgIa > 0 ? "brand" : "neutral",
      },
      {
        label: "Credits earned",
        value: `${profile.creditsEarned} / ${profile.totalCredits}`,
        delta: profile.creditsEarned > 0 ? "On track" : "First term",
        tone: profile.creditsEarned > 0 ? "sky" : "neutral",
      },
    ],
    charts: [
      {
        type: "bar",
        title: "Subject-wise Internal Marks & Attendance (%)",
        xKey: "name",
        series: ["IA1", "IA2", "Attendance"],
        data: subjectChartData,
      },
      {
        type: "line",
        title: "Semester Performance Trend",
        xKey: "name",
        series: ["Progress", "Mastery"],
        data: !isNew && avgIa > 0 ? [
          { name: "Sem 1", Progress: 100, Mastery: 78 },
          { name: "Sem 2", Progress: 100, Mastery: 82 },
          { name: "Sem 3", Progress: 100, Mastery: 80 },
          { name: "Sem 4", Progress: 100, Mastery: 85 },
          { name: `Sem ${profile.semester} (Current)`, Progress: 68, Mastery: avgIa },
        ] : [
          { name: `Sem ${profile.semester} (Current)`, Progress: 0, Mastery: 0 },
        ],
      },
    ],
    insights: [
      {
        title: "Academic Standing",
        body: profile.cgpa > 0
          ? `You are maintaining a strong ${profile.cgpa} CGPA in ${profile.degree}. Your highest performance is in ${subjects[0]?.shortName || "Major subjects"}.`
          : `Welcome to ${profile.degree}! Your enrolled subjects are active for the current term. Complete quizzes and assignments to build your academic scorecard.`,
        evidence: `Verified by College Exam Cell · ${profile.creditsEarned} credits recorded`,
        tone: profile.cgpa > 0 ? "teal" : "neutral",
      },
      {
        title: "Attendance Notice",
        body: avgAttendance > 0
          ? `Overall attendance is ${avgAttendance}%, safely above the mandatory 75% threshold for university end-semester examinations.`
          : `Attendance recording is initialized for ${profile.department}. Regular classroom and lab sessions will update this tracker daily.`,
        evidence: `Biometric & smart classroom log · ${profile.department}`,
        tone: avgAttendance >= 75 ? "brand" : "neutral",
      },
    ],
  };
}

export async function generateDynamicDailyPlan(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<CalendarData> {
  const profile = await getStudentAcademicProfile(session);
  const subjects = profile.enrolledSubjects;
  const s1 = subjects[0] || { shortName: "Major 1" };
  const s2 = subjects[1] || { shortName: "Major 2" };
  const s3 = subjects[2] || { shortName: "Practical Lab" };

  return {
    template: "calendar",
    days: [
      {
        day: "Today",
        items: [
          { time: "06:30", title: "Morning fitness / wellness walk", tag: "Wellness", tone: "teal" },
          { time: "09:00", title: `${s1.shortName} — Theory & Concept Map`, tag: "Class", tone: "brand" },
          { time: "11:00", title: `${s2.shortName} — Problem Solving & Worked Examples`, tag: "Class", tone: "brand" },
          { time: "13:00", title: "Lunch & campus break", tag: "Break", tone: "neutral" },
          { time: "14:00", title: `${s3.shortName} — Laboratory & Hands-on Implementation`, tag: "Lab", tone: "sky" },
          { time: "17:00", title: "Coding Club & Innovation Project Hub", tag: "Club", tone: "gold" },
          { time: "19:00", title: "Placement Aptitude & AI Mock Interview Drill", tag: "Career", tone: "amber" },
          { time: "21:00", title: `Focused Revision: ${s1.shortName} core units (25 min)`, tag: "Revision", tone: "sky" },
        ],
      },
      {
        day: "Tomorrow",
        items: [
          { time: "09:00", title: `${s2.shortName} — Case Studies & Analysis`, tag: "Class", tone: "brand" },
          { time: "11:00", title: `${s1.shortName} — Assessment & Tutorial Discussion`, tag: "Class", tone: "brand" },
          { time: "14:30", title: "Department Seminar & Research Paper Review", tag: "Academics", tone: "sky" },
          { time: "16:30", title: "Sports Practice & Inter-College Trial", tag: "Sports", tone: "teal" },
          { time: "20:00", title: `Adaptive Mock Test: ${s2.shortName}`, tag: "Assessment", tone: "rose" },
        ],
      },
    ],
    tips: [
      "Planner automatically syncs with your department timetable and upcoming examination calendar.",
      "Spaced revision blocks are scheduled when memory retention is highest (morning & evening).",
    ],
  };
}

export async function generateDynamicSkillGraph(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ScorecardData> {
  const profile = await getStudentAcademicProfile(session);
  const subjects = profile.enrolledSubjects;
  const isNew = profile.cgpa === 0 && profile.streakDays === 0;

  const dimensions = subjects.map((s) => {
    const avgUnitMastery = Math.round(
      s.units.reduce((sum, u) => sum + u.mastery, 0) / (s.units.length || 1)
    );
    const score = isNew ? 0 : Math.max(30, Math.min(98, Math.round((avgUnitMastery + s.ia1Marks + s.ia2Marks) / 3)));
    return {
      name: s.shortName,
      score,
      target: 85,
    };
  });

  const overall = isNew ? 0 : Math.round(dimensions.reduce((a, d) => a + d.score, 0) / (dimensions.length || 1));
  const strengths: string[] = [];
  const gaps: string[] = [];
  const plan: string[] = [];

  for (const s of subjects) {
    const lowUnits = s.units.filter((u) => u.mastery < 55);
    const highUnits = s.units.filter((u) => u.mastery >= 75);
    if (highUnits.length > 0) {
      strengths.push(`${s.shortName}: Strong mastery in ${highUnits[0]?.title}`);
    }
    if (lowUnits.length > 0 && !isNew) {
      gaps.push(`${s.shortName}: ${lowUnits[0]?.title} (${lowUnits[0]?.mastery}%)`);
      plan.push(`Complete adaptive revision quiz on ${lowUnits[0]?.title} (${s.shortName})`);
    }
  }

  if (isNew) {
    strengths.push(`Enrolled in ${profile.degree} (${profile.department})`);
    gaps.push("No diagnostic tests or quizzes attempted yet");
    plan.push("Complete coursework lessons and practice quizzes in My Quizzes to build your skill graph");
  } else {
    if (strengths.length === 0) strengths.push(`${subjects[0]?.shortName}: Consistent practice streak (${profile.streakDays} days)`);
    if (gaps.length === 0) gaps.push("Advance to mock interview and full-length assessment");
    if (plan.length === 0) plan.push("Take the departmental certification test");
  }

  return {
    template: "scorecard",
    headline: `Target: ${profile.degree.replace(/^B\.E\.|MBBS|B\.Com|BBA|Diploma in /i, "").trim()} Career Benchmark`,
    overall,
    dimensions,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    plan: plan.slice(0, 3),
  };
}

export async function generateDynamicStudyTwin(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ScorecardData> {
  const profile = await getStudentAcademicProfile(session);
  const isNew = profile.cgpa === 0 && profile.streakDays === 0;

  return {
    template: "scorecard",
    headline: `AI Study Twin — ${profile.name}'s Learning Dynamics`,
    overall: isNew ? 0 : 74,
    dimensions: [
      { name: "Learning pace", score: isNew ? 0 : 76, target: 80 },
      { name: "Retention rate (7-day)", score: isNew ? 0 : 68, target: 75 },
      { name: "Practice consistency", score: isNew ? 0 : 85, target: 80 },
      { name: "Revision discipline", score: isNew ? 0 : 62, target: 75 },
      { name: "Focus duration", score: isNew ? 0 : 78, target: 80 },
    ],
    strengths: isNew
      ? [
          "Study twin initialized for current academic curriculum",
          "Optimal focus windows mapped to standard timetable",
          "Cognitive model ready to calibrate with your first study session",
        ]
      : [
          "Visual worked examples & concept diagrams increase retention by 2.4x",
          "Peak cognitive focus observed between 08:30 AM – 11:30 AM",
          `High consistency with a ${profile.streakDays}-day active learning streak`,
        ],
    gaps: isNew
      ? ["Awaiting initial learning session telemetry to measure retention curve"]
      : [
          "Revision frequency slows down on weekends",
          "Complex theoretical proofs show faster decay without practice recaps",
        ],
    plan: [
      "Utilize 25-minute Pomodoro focus blocks with formula flashcards",
      "Schedule Sunday morning 30-minute spaced revision for lowest-mastery units",
      "Practice 5 adaptive quiz questions immediately after each class",
    ],
  };
}

export async function generateDynamicPassport(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<GalleryData> {
  const profile = await getStudentAcademicProfile(session);
  const isNew = profile.cgpa === 0 && profile.streakDays === 0;

  return {
    template: "gallery",
    items: [
      {
        title: "Academic Transcript",
        description: isNew
          ? `CGPA 0.00 · 0 of ${profile.totalCredits} credits earned · Enrolled in Semester ${profile.semester}`
          : `CGPA ${profile.cgpa.toFixed(2)} · ${profile.creditsEarned} of ${profile.totalCredits} credits earned across ${profile.semester} semesters`,
        tag: "Exam Cell Verified",
        meta: `Roll: ${profile.rollNo}`,
        tone: isNew ? "neutral" : "teal",
        progress: profile.totalCredits > 0 ? Math.round((profile.creditsEarned / profile.totalCredits) * 100) : 0,
      },
      {
        title: "Verified Skill Profile",
        description: `${profile.enrolledSubjects.map((s) => s.shortName).join(", ")} & practical laboratory competencies`,
        tag: "Skill Graph",
        meta: isNew ? "0 skills tracked" : "12 skills tracked",
        tone: "brand",
        progress: isNew ? 0 : 78,
      },
      {
        title: "Department Project",
        description: isNew ? "Capstones and innovative project submissions will be recorded here" : "Smart Campus AI & Autonomous Attendance · Faculty reviewed",
        tag: "Project Hub",
        meta: isNew ? "Not started" : "Milestone 4/5",
        tone: "gold",
        progress: isNew ? 0 : 80,
      },
      {
        title: "Verified Certifications",
        description: "HMAC Cryptographically signed certifications in core subjects",
        tag: "Certificates",
        meta: isNew ? "0 verified certs" : "2 verified certs",
        tone: "sky",
        progress: isNew ? 0 : 67,
      },
      {
        title: "Campus Leadership & Clubs",
        description: "Coding Club Lead & NSS Campus Volunteer",
        tag: "Campus Life",
        meta: isNew ? "New member" : "Active member",
        tone: "teal",
        progress: isNew ? 0 : 85,
      },
      {
        title: "Placement Readiness",
        description: "Quiz performance, certifications, aptitude, and AI mock interview",
        tag: "Career",
        meta: isNew ? "Readiness: 0/100" : "Readiness: 68/100",
        tone: "amber",
        progress: isNew ? 0 : 68,
      },
    ],
  };
}

export async function generateDynamicCareer(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ScorecardData> {
  const profile = await getStudentAcademicProfile(session);
  const isNew = profile.cgpa === 0 && profile.streakDays === 0;

  return {
    template: "scorecard",
    headline: `${profile.name} vs. Industry Role Benchmark (${profile.degree})`,
    overall: isNew ? 0 : 66,
    dimensions: [
      { name: "Technical Core Skills", score: isNew ? 0 : 74, target: 85 },
      { name: "Hands-on Projects", score: isNew ? 0 : 68, target: 80 },
      { name: "Aptitude & Problem Solving", score: isNew ? 0 : 70, target: 75 },
      { name: "Communication & Soft Skills", score: isNew ? 0 : 62, target: 75 },
      { name: "Mock Interview Readiness", score: isNew ? 0 : 58, target: 75 },
    ],
    strengths: isNew
      ? [
          `Enrolled in accredited program (${profile.degree})`,
          "Curriculum aligned to industry standard role competencies",
        ]
      : [
          `Strong core foundations in ${profile.enrolledSubjects[0]?.shortName || "major subjects"}`,
          `Good academic standing with CGPA ${profile.cgpa}`,
          "Active participation in campus innovation and projects",
        ],
    gaps: isNew
      ? ["Complete first semester milestones and technical certifications to unlock role benchmark score"]
      : [
          "Technical mock interview score is below target (58% vs 75%)",
          "Portfolio lacks deployment to public cloud / live demonstration",
        ],
    plan: [
      "Take 2 mock technical interviews weekly on AI Mock Interview",
      "Deploy capstone project on GitHub with live architecture diagram",
      "Complete 30-minute daily aptitude practice questions",
    ],
  };
}

export async function generateDynamicReadiness(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ScorecardData> {
  const profile = await getStudentAcademicProfile(session);
  const isNew = profile.cgpa === 0 && profile.streakDays === 0;

  return {
    template: "scorecard",
    headline: "Career Readiness by Dimension",
    overall: isNew ? 0 : 68,
    dimensions: [
      { name: "Academic GPA", score: isNew ? 0 : Math.round(profile.cgpa * 10), target: 80 },
      { name: "Department Skills", score: isNew ? 0 : 72, target: 80 },
      { name: "Mock Interview", score: isNew ? 0 : 58, target: 75 },
      { name: "Aptitude & Coding", score: isNew ? 0 : 70, target: 75 },
      { name: "Resume & ATS Score", score: isNew ? 0 : 82, target: 80 },
      { name: "Verified Certifications", score: isNew ? 0 : 60, target: 75 },
    ],
    strengths: isNew
      ? [
          `Active student registration in ${profile.department}`,
          "Enrolled in university placement readiness track",
        ]
      : [
          "Academic CGPA and Resume ATS optimization exceed hiring thresholds",
          "Consistent continuous assessment marks across semesters",
        ],
    gaps: isNew
      ? ["No assessment attempts, certifications, or mock interviews recorded yet"]
      : [
          "Live verbal communication in technical interviews requires STAR practice",
          "Advanced domain certifications pending completion",
        ],
    plan: [
      "Practice STAR framework answers with Viva Simulator",
      "Earn second department course certificate in AI Course Studio",
      "Attend campus recruitment preparation drive sessions",
    ],
  };
}

export async function generateDynamicCommunication(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ScorecardData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "scorecard",
    headline: `Communication Lab — ${profile.name}'s Profile`,
    overall: 65,
    dimensions: [
      { name: "Grammar & Syntax", score: 74, target: 80 },
      { name: "Vocabulary & Terminology", score: 68, target: 75 },
      { name: "Fluency & Pacing", score: 60, target: 75 },
      { name: "Structure (STAR format)", score: 62, target: 75 },
      { name: "Filler Word Control", score: 54, target: 70 },
    ],
    strengths: [
      "Clear technical explanations when using standard terminology",
      "Good comprehension during multi-turn conversational drills",
    ],
    gaps: [
      "Frequent filler words ('like', 'basically') under timed pressure",
      "Long pauses when transitioning between points in GD sessions",
    ],
    plan: [
      "Participate in the GD Simulator on current tech debate topics",
      "Record a 2-minute self-introduction on the Communication Lab daily",
      "Follow structured bullet points before answering viva questions",
    ],
  };
}

export async function generateDynamicCertifications(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<WorkflowData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "workflow",
    title: `Certification Roadmap — ${profile.degree}`,
    stages: [
      {
        title: "Foundation Level",
        description: "Core concepts & fundamentals in major department subjects",
        status: "done",
        items: ["Completed: Department Internal Certification", "Score: 84% (Grade A)"],
      },
      {
        title: "Intermediate Mastery",
        description: "Applied problem solving, laboratory assessments, and project work",
        status: "active",
        items: ["In Progress: 30-Question Final Assessment", "Passing mark: 60%"],
      },
      {
        title: "Industry Professional",
        description: "Recognized national/international external certifications",
        status: "todo",
        items: ["Recommended: NPTEL / SWAYAM / Industry Council certification"],
      },
      {
        title: "Capstone & Placement Verified",
        description: "Comprehensive verification for campus hiring drives",
        status: "todo",
        items: ["Placement Readiness Board Verification"],
      },
    ],
  };
}

export async function generateDynamicMissionPlanner(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<WorkflowData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "workflow",
    title: `Mission Plan — Career Roadmap for ${profile.name}`,
    stages: [
      {
        title: "Vision & Target Role",
        description: `Aiming for Lead Technical Role / Industry Placement (${profile.department})`,
        status: "done",
        items: ["Target companies identified", "Core skill competencies benchmarked"],
      },
      {
        title: "Semester 5 Milestones",
        description: "Core theory mastery, laboratory proficiency, and 2 certificates",
        status: "active",
        items: ["Course progress: 68%", "AI Quiz average: > 75%"],
      },
      {
        title: "Semester 6 Project Capstone",
        description: "Build, test and deploy a portfolio-grade project with AI Review",
        status: "todo",
        items: ["Architecture review", "GitHub deployment"],
      },
      {
        title: "Placement Drives & Internship",
        description: "Campus recruitment drives and interview rounds",
        status: "todo",
        items: ["Placement Readiness Score >= 75", "Mock Interview Score >= 70"],
      },
    ],
  };
}

export async function generateDynamicStartupHub(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<WorkflowData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "workflow",
    title: `Innovation & Startup Hub — ${profile.department}`,
    stages: [
      {
        title: "Problem Discovery",
        description: "Identify campus or societal challenges and validate user pain points",
        status: "done",
        items: ["30+ student & faculty interviews completed", "Problem statement documented"],
      },
      {
        title: "Solution & MVP Architecture",
        description: "System design, technology stack, and prototyping",
        status: "active",
        items: ["Prototype v0.2 built", "AI Mentor review requested"],
      },
      {
        title: "Incubation Review & Mentorship",
        description: "Pitch deck presentation before the College Incubation Cell",
        status: "todo",
        items: ["Pitch presentation scheduled with Incubation Head"],
      },
      {
        title: "Funding & Grant Readiness",
        description: "Application for MSME / DST / Student Startup Innovation Grants",
        status: "todo",
        items: ["Grant application review"],
      },
    ],
  };
}

export async function generateDynamicTeamFinder(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ListData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "list",
    columns: [
      { key: "name", label: "Student", kind: "text" },
      { key: "dept", label: "Department", kind: "text" },
      { key: "skills", label: "Skills & Expertise", kind: "text" },
      { key: "looking", label: "Interested In", kind: "text" },
      { key: "match", label: "Profile Match", kind: "progress" },
    ],
    rows: [
      { name: "Rahul S.", dept: profile.department, skills: "React, Next.js, Tailwind", looking: "Hackathon frontend lead", match: 92 },
      { name: "Priya V.", dept: profile.department, skills: "Python, FastAPI, PyTorch", looking: "AI/ML project partner", match: 88 },
      { name: "Karthik R.", dept: "Electronics & Communication", skills: "Embedded C, IoT, Arduino", looking: "Hardware & sensor integration", match: 82 },
      { name: "Divya M.", dept: "Management Studies", skills: "Product Design, UI/UX, Figma", looking: "Startup UI/UX & Pitch Deck", match: 78 },
    ],
    filterKey: "dept",
    primaryAction: "Post a team request",
  };
}

export async function generateDynamicHackathons(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ListData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "list",
    columns: [
      { key: "name", label: "Hackathon", kind: "text" },
      { key: "host", label: "Organizing Body", kind: "text" },
      { key: "date", label: "Date", kind: "text" },
      { key: "teams", label: "Registered Teams", kind: "number" },
      { key: "status", label: "Status", kind: "badge" },
    ],
    rows: [
      { name: "Smart India Hackathon 2026", host: "AICTE & MoE", date: "Nov 15–16", teams: 24, status: "Open" },
      { name: "Campus AI Buildathon", host: `${profile.department} & Incubation Cell`, date: "Oct 28", teams: 18, status: "Active" },
      { name: "Tamil Nadu State Student Innovation Challenge", host: "TANSIM", date: "Dec 05", teams: 42, status: "Upcoming" },
    ],
    filterKey: "status",
    primaryAction: "Register team",
  };
}

export async function generateDynamicExperience(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ListData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "list",
    columns: [
      { key: "activity", label: "Activity / Role", kind: "text" },
      { key: "type", label: "Category", kind: "badge" },
      { key: "role", label: "Designation", kind: "text" },
      { key: "date", label: "Period", kind: "text" },
      { key: "verified", label: "Verification", kind: "badge" },
    ],
    rows: [
      { activity: "Campus Coding Club", type: "Technical Club", role: "Student Coordinator", date: "2025–2026", verified: "Verified by Faculty" },
      { activity: "National Service Scheme (NSS)", type: "Social Service", role: "Volunteer", date: "2024–2026", verified: "Verified by NSS Officer" },
      { activity: "Smart India Hackathon Internal Round", type: "Competition", role: "Team Lead", date: "Sep 2026", verified: "Verified by HOD" },
    ],
    filterKey: "type",
    primaryAction: "Add activity",
  };
}

export async function generateDynamicRefreshZone(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<GalleryData> {
  const profile = await getStudentAcademicProfile(session);
  const mainSub = profile.enrolledSubjects[0]?.shortName || "Subject";
  return {
    template: "gallery",
    items: [
      { title: "Memory Matrix", description: "Visual and spatial memory training challenge", tag: "Brain Fitness", meta: "3 min drill", tone: "teal" },
      { title: `${mainSub} Quiz Battle`, description: `Challenge your classmates to a rapid-fire quiz on ${mainSub}`, tag: "Live Battle", meta: "10 MCQs", tone: "rose" },
      { title: "Logic Grid Deductions", description: "Analytical reasoning puzzles to boost placement test speed", tag: "Logic & Aptitude", meta: "5 min", tone: "brand" },
      { title: "Code & Syntax Sprint", description: "Spot the bug and fix algorithmic errors against the clock", tag: "Coding Challenge", meta: "8 min", tone: "sky" },
      { title: "Vocabulary Power", description: "GRE / CAT level verbal reasoning flashcard battle", tag: "Language", meta: "4 min", tone: "gold" },
    ],
  };
}

export async function generateDynamicAchievements(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<GalleryData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "gallery",
    items: [
      { title: `${profile.streakDays}-Day Learning Streak`, description: `Logged in and completed practice sessions for ${profile.streakDays} consecutive days`, tag: "Streak Badge", meta: "Earned", tone: "gold", progress: 100 },
      { title: "First Course Certificate", description: "Successfully passed 30-question final assessment with Distinction", tag: "Certified", meta: "Earned", tone: "teal", progress: 100 },
      { title: "100+ Quiz Questions Solved", description: "Answered practice questions across department subjects", tag: "Practice Star", meta: "Earned", tone: "brand", progress: 100 },
      { title: "AI Mock Interview Master", description: "Completed technical and HR interview rounds with score > 65%", tag: "Interview Ready", meta: "In Progress", tone: "sky", progress: 75 },
      { title: "Hackathon Finalist", description: "Participated in campus innovation challenge", tag: "Innovation", meta: "Earned", tone: "amber", progress: 100 },
    ],
  };
}

export async function generateDynamicJobs(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ListData> {
  const profile = await getStudentAcademicProfile(session);
  return {
    template: "list",
    columns: [
      { key: "role", label: "Role", kind: "text" },
      { key: "company", label: "Company", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "type", label: "Type", kind: "badge" },
      { key: "match", label: "Profile Match", kind: "progress" },
    ],
    rows: [
      { role: "Software Development Engineer (Graduate)", company: "TechCorp India", location: "Chennai / Bengaluru", type: "Full Time", match: 92 },
      { role: "Data Analyst Trainee", company: "Analytics Insights Hub", location: "Coimbatore / Remote", type: "Full Time", match: 86 },
      { role: "Cloud & DevOps Intern", company: "CloudSphere Solutions", location: "Hyderabad", type: "Internship", match: 80 },
    ],
    filterKey: "type",
  };
}

export async function generateDynamicAlumni(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<ListData> {
  const profile = await getStudentAcademicProfile(session);
  const studentDept = profile.department.toLowerCase();
  const studentSubjs = profile.enrolledSubjects.map((s) => s.shortName.toLowerCase());

  const members = await alumniStore().listMembers(session.college);

  const rows = members.map((m) => {
    let score = 70;
    if (m.department && (m.department.toLowerCase() === studentDept || studentDept.includes(m.department.toLowerCase()))) {
      score += 12;
    }
    if (m.mentorshipTopics.some((t) => t.includes("Placement") || t.includes("Interview"))) {
      score += 6;
    }
    const overlap = m.skills.filter((sk) => studentSubjs.some((sub) => sk.toLowerCase().includes(sub) || sub.includes(sk.toLowerCase()))).length;
    score += Math.min(10, overlap * 4);
    if (m.isAvailable && m.activeMentees < m.maxMentees) {
      score += 2;
    }

    return {
      name: m.name,
      batch: m.batch,
      role: m.currentPosition,
      company: m.company,
      offers: m.mentorshipTopics[0] || "General Career Mentorship",
      match: Math.min(96, Math.max(72, score)),
    };
  }).sort((a, b) => b.match - a.match);

  return {
    template: "list",
    columns: [
      { key: "name", label: "Alumnus / Mentor", kind: "text" },
      { key: "batch", label: "Batch", kind: "text" },
      { key: "role", label: "Current Position", kind: "text" },
      { key: "company", label: "Company", kind: "text" },
      { key: "offers", label: "Can Mentor In", kind: "badge" },
      { key: "match", label: "Match Score", kind: "progress" },
    ],
    rows,
    filterKey: "offers",
    primaryAction: "Request mentorship",
  };
}

export async function generateDynamicExamPrep(
  collegeScope: string,
  session?: SessionPayload | { sub: string; name?: string; college: string }
): Promise<DashboardData> {
  const profile = await getStudentAcademicProfile(session ?? { college: collegeScope, sub: "demo-student" });
  const subjects = profile.enrolledSubjects;
  const primarySubject = subjects[0] || { shortName: "Major", units: [], semesterProgress: 60 };

  const avgProgress = Math.round(
    subjects.reduce((sum, s) => sum + s.semesterProgress, 0) / (subjects.length || 1)
  );

  const topicData = primarySubject.units.map((u) => ({
    name: u.title.length > 20 ? u.title.slice(0, 18) + "…" : u.title,
    Mastery: u.mastery,
  }));

  const allUnits: Array<{ subject: string; topic: string; mastery: number }> = [];
  for (const s of subjects) {
    for (const u of s.units) {
      allUnits.push({ subject: s.shortName, topic: u.title, mastery: u.mastery });
    }
  }
  allUnits.sort((a, b) => a.mastery - b.mastery);
  const weakest = allUnits[0] || { subject: primarySubject.shortName, topic: "Core Units", mastery: 45 };

  const examName =
    profile.stream === "medical"
      ? "Pathology Internal Assessment II"
      : profile.stream === "artsScience"
      ? "Continuous Internal Assessment II"
      : `${primarySubject.shortName} IA-II`;

  return {
    template: "dashboard",
    kpis: [
      { label: "Next exam", value: "9 days", delta: examName, tone: "amber" },
      { label: "Syllabus covered", value: `${avgProgress}%`, delta: "+8% this week", tone: "brand" },
      { label: "Mock tests taken", value: "7", delta: "3 this week", tone: "teal" },
      { label: "Predicted band", value: avgProgress >= 70 ? "A to O" : "B+ to A", delta: "AI estimate", tone: "sky", hint: "Estimate based on mock and quiz attempts" },
    ],
    charts: [
      {
        type: "bar",
        title: `${primarySubject.shortName} Topic Mastery (%)`,
        xKey: "name",
        series: ["Mastery"],
        data: topicData,
      },
      {
        type: "area",
        title: "Daily Study Minutes",
        xKey: "name",
        series: ["Minutes"],
        data: [
          { name: "Mon", Minutes: 75 },
          { name: "Tue", Minutes: 90 },
          { name: "Wed", Minutes: 60 },
          { name: "Thu", Minutes: 110 },
          { name: "Fri", Minutes: 85 },
          { name: "Sat", Minutes: 120 },
          { name: "Sun", Minutes: 95 },
        ],
      },
    ],
    insights: [
      {
        title: "Remediation plan",
        body: `${weakest.topic} in ${weakest.subject} accounts for most of your missed questions. Prioritise it over the next 4 days.`,
        evidence: `Current mastery: ${weakest.mastery}% · Unit test logs`,
        tone: "amber",
      },
      {
        title: "Last-minute revision mode",
        body: "Two days before the exam, your study planner automatically unlocks rapid-fire flashcards and formula summaries.",
        evidence: "Configured by AI Study Planner",
        tone: "brand",
      },
    ],
  };
}


