import "server-only";
import type { Stream } from "@/config/streams";
import type { SessionPayload } from "@/lib/auth/session";
import { collegeStream } from "./records";
import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";

export interface AllocatedClassSection {
  id: string;
  courseCode: string;
  courseTitle: string;
  shortName: string;
  section: string;
  studentsCount: number;
  attendancePercent: number;
  averageScore: number;
  nextClass: string;
  room: string;
  hoursPerWeek: number;
  units: Array<{
    id: string;
    unit: string;
    title: string;
    classMastery: number;
  }>;
}

export interface ClassTimetableSlot {
  id: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  period: number;
  time: string;
  courseCode: string;
  courseTitle: string;
  shortName: string;
  section: string;
  sectionId: string;
  room: string;
  isLab?: boolean;
  topic?: string;
}

export interface StudentRosterItem {
  id: string;
  name: string;
  rollNo: string;
  section: string;
  attendancePercent: number;
  classesAttended: number;
  totalClasses: number;
  averageScore: number;
  status: "Present" | "Absent" | "Late" | "OD";
  riskSignal: "Normal" | "Attendance Warning" | "Low Mastery" | "Top Performer";
  email?: string;
  phone?: string;
}

export interface AttendanceSessionRecord {
  id: string;
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  date: string;
  timeSlot: string;
  period: number;
  topicTaught: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  odCount: number;
  attendancePercent: number;
  absentRolls: string[];
  records: Array<{
    studentId: string;
    rollNo: string;
    name: string;
    status: "Present" | "Absent" | "Late" | "OD";
    remark?: string;
  }>;
  createdAt: string;
}

export interface FacultyAllocationProfile {
  facultyId: string;
  name: string;
  designation: string;
  department: string;
  departmentCode: string;
  stream: Stream;
  totalTeachingLoad: number;
  totalStudents: number;
  averageAttendance: number;
  assignedSections: AllocatedClassSection[];
  timetable?: ClassTimetableSlot[];
  recentAttendance?: AttendanceSessionRecord[];
}

const STREAM_FACULTY_ALLOCATIONS: Record<
  Stream,
  {
    facultyName: string;
    designation: string;
    department: string;
    departmentCode: string;
    sections: AllocatedClassSection[];
  }
> = {
  engineering: {
    facultyName: "Dr. Meena Raghavan",
    designation: "Associate Professor",
    department: "Computer Science & Engineering",
    departmentCode: "CSE",
    sections: [
      {
        id: "sec-cse-a-dbms",
        courseCode: "CS3492",
        courseTitle: "Database Management Systems",
        shortName: "DBMS",
        section: "CSE-A · Sem 5",
        studentsCount: 64,
        attendancePercent: 88,
        averageScore: 68,
        nextClass: "Today 09:00",
        room: "LH-204",
        hoursPerWeek: 4,
        units: [
          { id: "cs3492-u1", unit: "Unit 1", title: "ER Model & Relational Algebra", classMastery: 78 },
          { id: "cs3492-u2", unit: "Unit 2", title: "SQL Queries & Joins", classMastery: 82 },
          { id: "cs3492-u3", unit: "Unit 3", title: "Normalization & Functional Dependencies", classMastery: 46 },
          { id: "cs3492-u4", unit: "Unit 4", title: "Transaction Processing & ACID", classMastery: 58 },
          { id: "cs3492-u5", unit: "Unit 5", title: "NoSQL & Distributed Databases", classMastery: 36 },
        ],
      },
      {
        id: "sec-cse-b-dbms",
        courseCode: "CS3492",
        courseTitle: "Database Management Systems",
        shortName: "DBMS",
        section: "CSE-B · Sem 5",
        studentsCount: 62,
        attendancePercent: 84,
        averageScore: 64,
        nextClass: "Today 14:00",
        room: "LH-206",
        hoursPerWeek: 4,
        units: [
          { id: "cs3492-u1", unit: "Unit 1", title: "ER Model & Relational Algebra", classMastery: 74 },
          { id: "cs3492-u2", unit: "Unit 2", title: "SQL Queries & Joins", classMastery: 78 },
          { id: "cs3492-u3", unit: "Unit 3", title: "Normalization & Functional Dependencies", classMastery: 42 },
          { id: "cs3492-u4", unit: "Unit 4", title: "Transaction Processing & ACID", classMastery: 54 },
          { id: "cs3492-u5", unit: "Unit 5", title: "NoSQL & Distributed Databases", classMastery: 32 },
        ],
      },
      {
        id: "sec-aids-dbms-lab",
        courseCode: "CS3492L",
        courseTitle: "DBMS Laboratory & SQL Studio",
        shortName: "DBMS Lab",
        section: "AI&DS · Sem 5",
        studentsCount: 58,
        attendancePercent: 91,
        averageScore: 74,
        nextClass: "Tomorrow 10:00",
        room: "Computing Lab 3",
        hoursPerWeek: 3,
        units: [
          { id: "cs3492l-u1", unit: "Unit 1", title: "DDL & DML Implementation", classMastery: 88 },
          { id: "cs3492l-u2", unit: "Unit 2", title: "Nested Queries & Views", classMastery: 80 },
          { id: "cs3492l-u3", unit: "Unit 3", title: "PL/SQL Procedures & Triggers", classMastery: 62 },
        ],
      },
      {
        id: "sec-cse-a-adv-db",
        courseCode: "CS3551",
        courseTitle: "Advanced Database Architectures",
        shortName: "Adv. Databases",
        section: "CSE-A · Sem 7",
        studentsCount: 60,
        attendancePercent: 79,
        averageScore: 71,
        nextClass: "Thu 11:00",
        room: "LH-301",
        hoursPerWeek: 3,
        units: [
          { id: "cs3551-u1", unit: "Unit 1", title: "Distributed Query Processing", classMastery: 76 },
          { id: "cs3551-u2", unit: "Unit 2", title: "Columnar & Graph Databases", classMastery: 70 },
          { id: "cs3551-u3", unit: "Unit 3", title: "CAP Theorem & Partitioning", classMastery: 65 },
        ],
      },
    ],
  },
  medical: {
    facultyName: "Dr. K. Vasanth, MD",
    designation: "Professor & HOD",
    department: "Pathology",
    departmentCode: "MED",
    sections: [
      {
        id: "sec-mbbs-p2-a-path",
        courseCode: "PA201",
        courseTitle: "General & Systemic Pathology",
        shortName: "Pathology",
        section: "MBBS Phase II · Batch A",
        studentsCount: 75,
        attendancePercent: 92,
        averageScore: 72,
        nextClass: "Today 08:30",
        room: "Pathology Lecture Hall",
        hoursPerWeek: 5,
        units: [
          { id: "pa201-u1", unit: "Unit 1", title: "Cell Injury & Adaptation", classMastery: 82 },
          { id: "pa201-u2", unit: "Unit 2", title: "Inflammation & Healing", classMastery: 76 },
          { id: "pa201-u3", unit: "Unit 3", title: "Neoplasia (PA 7.1–7.5)", classMastery: 48 },
          { id: "pa201-u4", unit: "Unit 4", title: "Cardiovascular Pathology", classMastery: 62 },
        ],
      },
      {
        id: "sec-mbbs-p2-b-path",
        courseCode: "PA201",
        courseTitle: "General & Systemic Pathology",
        shortName: "Pathology",
        section: "MBBS Phase II · Batch B",
        studentsCount: 75,
        attendancePercent: 89,
        averageScore: 70,
        nextClass: "Today 11:00",
        room: "Pathology Lecture Hall",
        hoursPerWeek: 5,
        units: [
          { id: "pa201-u1", unit: "Unit 1", title: "Cell Injury & Adaptation", classMastery: 78 },
          { id: "pa201-u2", unit: "Unit 2", title: "Inflammation & Healing", classMastery: 72 },
          { id: "pa201-u3", unit: "Unit 3", title: "Neoplasia (PA 7.1–7.5)", classMastery: 44 },
          { id: "pa201-u4", unit: "Unit 4", title: "Cardiovascular Pathology", classMastery: 58 },
        ],
      },
      {
        id: "sec-mbbs-path-histo-lab",
        courseCode: "PA201L",
        courseTitle: "Histopathology & Haematology Practical",
        shortName: "Histo Lab",
        section: "Skills Lab · Unit 1",
        studentsCount: 40,
        attendancePercent: 95,
        averageScore: 78,
        nextClass: "Tomorrow 14:00",
        room: "Central Skills Lab",
        hoursPerWeek: 4,
        units: [
          { id: "pa201l-u1", unit: "Unit 1", title: "Slide Examination & Gram Stain", classMastery: 86 },
          { id: "pa201l-u2", unit: "Unit 2", title: "Peripheral Blood Smear", classMastery: 75 },
        ],
      },
    ],
  },
  artsScience: {
    facultyName: "Dr. V. Murugan",
    designation: "Associate Professor",
    department: "Commerce & Accountancy",
    departmentCode: "COM",
    sections: [
      {
        id: "sec-bcom-a-fa",
        courseCode: "UCO301",
        courseTitle: "Financial Accounting",
        shortName: "Financial Accounts",
        section: "B.Com-A · Sem 5",
        studentsCount: 60,
        attendancePercent: 91,
        averageScore: 74,
        nextClass: "Today 09:30",
        room: "Commerce Hall 1",
        hoursPerWeek: 5,
        units: [
          { id: "uco301-u1", unit: "Unit 1", title: "Final Accounts Preparation", classMastery: 84 },
          { id: "uco301-u2", unit: "Unit 2", title: "Depreciation (WDV & SLM)", classMastery: 48 },
          { id: "uco301-u3", unit: "Unit 3", title: "Branch & Departmental Accounts", classMastery: 65 },
        ],
      },
      {
        id: "sec-bcom-b-fa",
        courseCode: "UCO301",
        courseTitle: "Financial Accounting",
        shortName: "Financial Accounts",
        section: "B.Com-B · Sem 5",
        studentsCount: 58,
        attendancePercent: 87,
        averageScore: 69,
        nextClass: "Today 11:30",
        room: "Commerce Hall 2",
        hoursPerWeek: 5,
        units: [
          { id: "uco301-u1", unit: "Unit 1", title: "Final Accounts Preparation", classMastery: 80 },
          { id: "uco301-u2", unit: "Unit 2", title: "Depreciation (WDV & SLM)", classMastery: 42 },
          { id: "uco301-u3", unit: "Unit 3", title: "Branch & Departmental Accounts", classMastery: 60 },
        ],
      },
      {
        id: "sec-bcom-a-ca",
        courseCode: "UCO303",
        courseTitle: "Corporate Accounting & Auditing",
        shortName: "Corporate Accounts",
        section: "B.Com-A · Sem 3",
        studentsCount: 62,
        attendancePercent: 89,
        averageScore: 71,
        nextClass: "Tomorrow 10:00",
        room: "Commerce Hall 1",
        hoursPerWeek: 4,
        units: [
          { id: "uco303-u1", unit: "Unit 1", title: "Issue of Shares & Debentures", classMastery: 78 },
          { id: "uco303-u2", unit: "Unit 2", title: "Redemption of Preference Shares", classMastery: 70 },
        ],
      },
    ],
  },
  management: {
    facultyName: "Prof. Rajesh Kumar",
    designation: "Assistant Professor",
    department: "Management Studies",
    departmentCode: "BBA",
    sections: [
      {
        id: "sec-bba-a-mkt",
        courseCode: "BA301",
        courseTitle: "Marketing Management",
        shortName: "Marketing",
        section: "BBA-A · Sem 5",
        studentsCount: 55,
        attendancePercent: 88,
        averageScore: 76,
        nextClass: "Today 10:00",
        room: "Management Hall 101",
        hoursPerWeek: 4,
        units: [
          { id: "ba301-u1", unit: "Unit 1", title: "STP & Market Segmentation", classMastery: 82 },
          { id: "ba301-u2", unit: "Unit 2", title: "Product Life Cycle & Pricing", classMastery: 75 },
        ],
      },
      {
        id: "sec-bba-b-mkt",
        courseCode: "BA301",
        courseTitle: "Marketing Management",
        shortName: "Marketing",
        section: "BBA-B · Sem 5",
        studentsCount: 52,
        attendancePercent: 85,
        averageScore: 72,
        nextClass: "Today 14:00",
        room: "Management Hall 102",
        hoursPerWeek: 4,
        units: [
          { id: "ba301-u1", unit: "Unit 1", title: "STP & Market Segmentation", classMastery: 78 },
          { id: "ba301-u2", unit: "Unit 2", title: "Product Life Cycle & Pricing", classMastery: 70 },
        ],
      },
    ],
  },
  polytechnic: {
    facultyName: "Prof. T. Selvam",
    designation: "Lecturer",
    department: "Computer Engineering",
    departmentCode: "DCE",
    sections: [
      {
        id: "sec-dce-a-arch",
        courseCode: "CE301",
        courseTitle: "Computer Architecture & Maintenance",
        shortName: "Architecture",
        section: "DCE-A · Sem 5",
        studentsCount: 50,
        attendancePercent: 89,
        averageScore: 72,
        nextClass: "Today 09:00",
        room: "Polytechnic Lab 1",
        hoursPerWeek: 4,
        units: [
          { id: "ce301-u1", unit: "Unit 1", title: "Processor Architecture & Buses", classMastery: 78 },
          { id: "ce301-u2", unit: "Unit 2", title: "Memory & Storage Troubleshooting", classMastery: 66 },
        ],
      },
      {
        id: "sec-dce-a-web-lab",
        courseCode: "CE302",
        courseTitle: "Web Development & PHP Laboratory",
        shortName: "Web Lab",
        section: "DCE-A · Sem 5",
        studentsCount: 48,
        attendancePercent: 92,
        averageScore: 78,
        nextClass: "Today 13:30",
        room: "Software Lab 2",
        hoursPerWeek: 4,
        units: [
          { id: "ce302-u1", unit: "Unit 1", title: "HTML5 & CSS Grid Layouts", classMastery: 88 },
          { id: "ce302-u2", unit: "Unit 2", title: "PHP MySQL Database Integration", classMastery: 72 },
        ],
      },
    ],
  },
};

// ── Weekly Timetable Data ──────────────────────────────────────
const TIMETABLE_SLOTS_CACHE: Record<string, ClassTimetableSlot[]> = {};

function getDefaultTimetableForStream(_stream: Stream, allocSections: AllocatedClassSection[]): ClassTimetableSlot[] {
  const s1 = allocSections[0];
  if (!s1) return [];

  const s2 = allocSections[1] || s1;
  const s3 = allocSections[2] || s1;

  return [
    { id: "tt-1", day: "Monday", period: 1, time: "09:00 - 10:00", courseCode: s1.courseCode, courseTitle: s1.courseTitle, shortName: s1.shortName, section: s1.section, sectionId: s1.id, room: s1.room, topic: `${s1.units[0]?.title || "Fundamental Concepts"}` },
    { id: "tt-2", day: "Monday", period: 3, time: "11:15 - 12:15", courseCode: s2.courseCode, courseTitle: s2.courseTitle, shortName: s2.shortName, section: s2.section, sectionId: s2.id, room: s2.room, topic: `${s2.units[0]?.title || "Architecture & Core Methods"}` },
    { id: "tt-3", day: "Monday", period: 5, time: "14:15 - 15:15", courseCode: s3.courseCode, courseTitle: s3.courseTitle, shortName: s3.shortName, section: s3.section, sectionId: s3.id, room: s3.room, topic: `${s3.units[0]?.title || "Practical Case Studies"}` },
    { id: "tt-4", day: "Tuesday", period: 2, time: "10:00 - 11:00", courseCode: s1.courseCode, courseTitle: s1.courseTitle, shortName: s1.shortName, section: s1.section, sectionId: s1.id, room: s1.room, topic: `${s1.units[1]?.title || "Problem Solving & Analysis"}` },
    { id: "tt-5", day: "Tuesday", period: 4, time: "13:15 - 15:15", courseCode: s3.courseCode, courseTitle: s3.courseTitle, shortName: s3.shortName, section: s3.section, sectionId: s3.id, room: s3.room, isLab: true, topic: `${s3.shortName} Practical Studio Session` },
    { id: "tt-6", day: "Wednesday", period: 1, time: "09:00 - 10:00", courseCode: s2.courseCode, courseTitle: s2.courseTitle, shortName: s2.shortName, section: s2.section, sectionId: s2.id, room: s2.room, topic: `${s2.units[1]?.title || "Advanced Methods & Algorithms"}` },
    { id: "tt-7", day: "Wednesday", period: 3, time: "11:15 - 12:15", courseCode: s1.courseCode, courseTitle: s1.courseTitle, shortName: s1.shortName, section: s1.section, sectionId: s1.id, room: s1.room, topic: `${s1.units[2]?.title || "Design Principles & Applications"}` },
    { id: "tt-8", day: "Thursday", period: 2, time: "10:00 - 11:00", courseCode: s2.courseCode, courseTitle: s2.courseTitle, shortName: s2.shortName, section: s2.section, sectionId: s2.id, room: s2.room, topic: `${s2.units[2]?.title || "Industry Applications & Review"}` },
    { id: "tt-9", day: "Thursday", period: 4, time: "13:15 - 14:15", courseCode: s1.courseCode, courseTitle: s1.courseTitle, shortName: s1.shortName, section: s1.section, sectionId: s1.id, room: s1.room, topic: `${s1.units[2]?.title || "Formulations & Decomposition"}` },
    { id: "tt-10", day: "Friday", period: 1, time: "09:00 - 10:00", courseCode: s2.courseCode, courseTitle: s2.courseTitle, shortName: s2.shortName, section: s2.section, sectionId: s2.id, room: s2.room, topic: `${s2.units[3]?.title || "Integrations & Evaluation"}` },
    { id: "tt-11", day: "Friday", period: 3, time: "11:15 - 12:15", courseCode: s1.courseCode, courseTitle: s1.courseTitle, shortName: s1.shortName, section: s1.section, sectionId: s1.id, room: s1.room, topic: `${s1.units[3]?.title || "Transaction & System Modeling"}` },
    { id: "tt-12", day: "Friday", period: 4, time: "13:15 - 15:15", courseCode: s3.courseCode, courseTitle: s3.courseTitle, shortName: s3.shortName, section: s3.section, sectionId: s3.id, room: s3.room, isLab: true, topic: `${s3.shortName} Laboratory Execution` },
  ];
}

// ── Attendance Session Records Store ──────────────────────────
let attendanceHistoryStore: AttendanceSessionRecord[] = [
  {
    id: "att-rec-101",
    sectionId: "sec-CSE101",
    courseCode: "CSE101",
    courseTitle: "Database Management Systems",
    section: "CSE-A · Term 4",
    date: "2026-10-06",
    timeSlot: "09:00 - 10:00",
    period: 1,
    topicTaught: "Relational Algebra, SQL DDL & Functional Dependencies",
    totalStudents: 30,
    presentCount: 28,
    absentCount: 2,
    lateCount: 1,
    odCount: 0,
    attendancePercent: 93.3,
    absentRolls: ["110124002", "27549861"],
    records: [],
    createdAt: "2026-10-06T09:55:00Z",
  },
  {
    id: "att-rec-102",
    sectionId: "sec-AID102",
    courseCode: "AID102",
    courseTitle: "AI Ethics, Bias, and Governance",
    section: "AI&DS-A · Term 1",
    date: "2026-10-06",
    timeSlot: "11:15 - 12:15",
    period: 3,
    topicTaught: "Algorithmic Fairness, Demographic Parity & Equal Opportunity",
    totalStudents: 30,
    presentCount: 29,
    absentCount: 1,
    lateCount: 0,
    odCount: 1,
    attendancePercent: 96.7,
    absentRolls: ["110124003"],
    records: [],
    createdAt: "2026-10-06T12:10:00Z",
  },
  {
    id: "att-rec-103",
    sectionId: "sec-CSE106",
    courseCode: "CSE106",
    courseTitle: "Web Technologies",
    section: "CSE-A · Term 1",
    date: "2026-10-05",
    timeSlot: "13:15 - 14:15",
    period: 4,
    topicTaught: "Client-Server Architecture, REST APIs & Responsive Layouts",
    totalStudents: 30,
    presentCount: 27,
    absentCount: 3,
    lateCount: 2,
    odCount: 0,
    attendancePercent: 90.0,
    absentRolls: ["110124001", "110124003"],
    records: [],
    createdAt: "2026-10-05T14:10:00Z",
  },
];

// ── Realistic Student Names Roster ─────────────────────────────
const INDIAN_STUDENT_NAMES = [
  "Aaditya Raj", "Abinaya S", "Adarsh Nair", "Aishwarya R", "Akash V",
  "Anandhakumar K", "Ananya Iyer", "Anitha M", "Arun Prasath", "Balamurugan P",
  "Charumathi S", "Deepak Roshan", "Devika Nair", "Dinesh Karthik", "Divya Bharathi",
  "Gokulnath R", "Hariharan M", "Harini Priya", "Hemant Kumar", "Ilanchezhian M",
  "Janani S", "Jeeva Anand", "Karthikeyan P", "Kavya Subramanian", "Kiruthika N",
  "Lokesh Kumar", "Madhavan R", "Manish Kumar", "Meenakshi S", "Mithun S",
  "Mohamed Farooq", "Mridula R", "Mukesh K", "Nandhini P", "Naveen Prasath",
  "Nithya Shree", "Pavithra M", "Poornima R", "Pradeep Chandran", "Praveen Raj",
  "Priyadharshini K", "Raghavan S", "Rahul Rajesh", "Rakshitha V", "Ramesh Babu",
  "Rithika Sri", "Rohit Verma", "Sachin V", "Sai Prasanth", "Sandhya R",
  "Sanjay Kumar", "Saravanan M", "Sathish Kumar", "Shalini Devi", "Shankar Ganesh",
  "Shivani M", "Siddharth Menon", "Siva Sankaran", "Sneha Latha", "Sowmiya R",
  "Sri Hari", "Subhashree K", "Sudharsan M", "Sujith Kumar", "Swetha B",
  "Tarun Adithya", "Udhaya Kumar", "Varun Teja", "Vigneshwaran K", "Yashwanth R"
];

export async function getSectionRoster(sectionId: string, collegeId?: string): Promise<StudentRosterItem[]> {
  if (dataBackend() === "postgres") {
    try {
      const t = db();
      const collegePublicId = collegeId && collegeId !== "all" ? collegeId : undefined;
      const studentRows = await t.student.findMany({
        where: {
          status: "Active",
          ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        },
        include: {
          user: true,
          department: true,
          college: true,
        },
        orderBy: { rollNo: "asc" },
      });

      if (studentRows.length > 0) {
        return studentRows.map((s, idx) => {
          let notes: Record<string, any> = {};
          try {
            if (s.user?.notes) notes = JSON.parse(s.user.notes);
          } catch {}

          const deptCode = s.department?.name?.includes("Computer")
            ? "CSE"
            : s.department?.name?.includes("Artificial") || s.department?.name?.includes("Data")
            ? "AI&DS"
            : s.department?.name?.slice(0, 4).toUpperCase() || "GEN";

          const section = notes.section || `${deptCode}-A`;
          const baseCgpa = 7.2 + ((idx * 7) % 25) / 10;
          const avgScore = notes.averageScore !== undefined ? notes.averageScore : Math.round(baseCgpa * 9.5);
          const attPct = notes.attendancePercent !== undefined ? notes.attendancePercent : Math.min(98, Math.max(68, 92 - ((idx * 9) % 28)));
          const totalClasses = 32;
          const attended = Math.round((attPct / 100) * totalClasses);

          let signal: StudentRosterItem["riskSignal"] = "Normal";
          if (attPct < 75) signal = "Attendance Warning";
          else if (avgScore < 50) signal = "Low Mastery";
          else if (avgScore >= 85 && attPct >= 90) signal = "Top Performer";

          return {
            id: s.id,
            name: s.user?.fullName || `Student ${s.rollNo}`,
            rollNo: s.rollNo,
            section,
            attendancePercent: attPct,
            classesAttended: attended,
            totalClasses,
            averageScore: avgScore,
            status: attPct < 75 ? (idx % 2 === 0 ? "Absent" : "Present") : "Present",
            riskSignal: signal,
            email: s.user?.email,
            phone: s.college?.phone,
          };
        });
      }
    } catch (err) {
      console.warn("[getSectionRoster] Postgres error, falling back:", err);
    }
  }

  // Fallback to in-memory fixtures
  let count = 60;
  let prefix = "22CS";
  let sectionName = "CSE-A";

  for (const streamKey of Object.keys(STREAM_FACULTY_ALLOCATIONS) as Stream[]) {
    const found = STREAM_FACULTY_ALLOCATIONS[streamKey]?.sections.find((s) => s.id === sectionId);
    if (found) {
      count = found.studentsCount || 60;
      sectionName = found.section;
      if (found.courseCode.startsWith("CE")) prefix = "22CE";
      else if (found.courseCode.startsWith("PA")) prefix = "23MB";
      else if (found.courseCode.startsWith("UC")) prefix = "23CO";
      else if (found.section.includes("AI")) prefix = "22AD";
      else prefix = "22CS";
      break;
    }
  }

  const roster: StudentRosterItem[] = [];
  for (let i = 0; i < count; i++) {
    const num = (i + 1).toString().padStart(3, "0");
    const name = INDIAN_STUDENT_NAMES[i % INDIAN_STUDENT_NAMES.length] + (i >= INDIAN_STUDENT_NAMES.length ? ` ${Math.floor(i / INDIAN_STUDENT_NAMES.length) + 1}` : "");
    const totalClasses = 32;
    const baseVariance = (i * 17) % 36;
    const attPct = Math.min(98, Math.max(64, 98 - baseVariance));
    const attended = Math.round((attPct / 100) * totalClasses);
    const avgScore = Math.min(98, Math.max(45, 50 + ((i * 13) % 48)));
    
    let signal: StudentRosterItem["riskSignal"] = "Normal";
    if (attPct < 75) signal = "Attendance Warning";
    else if (avgScore < 50) signal = "Low Mastery";
    else if (avgScore >= 88 && attPct >= 90) signal = "Top Performer";

    roster.push({
      id: `std-${sectionId}-${num}`,
      name,
      rollNo: `${prefix}${num}`,
      section: sectionName,
      attendancePercent: attPct,
      classesAttended: attended,
      totalClasses,
      averageScore: avgScore,
      status: attPct < 75 ? (i % 3 === 0 ? "Absent" : "Present") : "Present",
      riskSignal: signal,
      email: `${name.toLowerCase().replace(/[^a-z]/g, "")}.${prefix.toLowerCase()}${num}@campus.edu`,
      phone: `+91 98${((i * 123456) % 90000000 + 10000000).toString().slice(0, 8)}`,
    });
  }
  return roster;
}

export function getAttendanceHistory(sectionId?: string): AttendanceSessionRecord[] {
  if (sectionId && sectionId !== "all") {
    return attendanceHistoryStore.filter((s) => s.sectionId === sectionId);
  }
  return [...attendanceHistoryStore];
}

export function saveAttendanceSession(record: Omit<AttendanceSessionRecord, "id" | "createdAt">): AttendanceSessionRecord {
  const newId = `att-rec-${Date.now()}`;
  const fullRecord: AttendanceSessionRecord = {
    ...record,
    id: newId,
    createdAt: new Date().toISOString(),
  };

  // Prepend to history store
  attendanceHistoryStore = [fullRecord, ...attendanceHistoryStore];

  // Update section average attendance dynamically in allocation table
  for (const streamKey of Object.keys(STREAM_FACULTY_ALLOCATIONS) as Stream[]) {
    const sec = STREAM_FACULTY_ALLOCATIONS[streamKey]?.sections.find((s) => s.id === record.sectionId);
    if (sec) {
      sec.attendancePercent = Math.round((sec.attendancePercent * 4 + record.attendancePercent) / 5);
      break;
    }
  }

  return fullRecord;
}

export function scheduleExtraClass(slot: Omit<ClassTimetableSlot, "id">, stream: Stream = "engineering"): ClassTimetableSlot {
  const newSlot: ClassTimetableSlot = {
    ...slot,
    id: `tt-extra-${Date.now()}`,
  };

  if (!TIMETABLE_SLOTS_CACHE[stream]) {
    const alloc = STREAM_FACULTY_ALLOCATIONS[stream] || STREAM_FACULTY_ALLOCATIONS.engineering;
    TIMETABLE_SLOTS_CACHE[stream] = getDefaultTimetableForStream(stream, alloc.sections);
  }

  TIMETABLE_SLOTS_CACHE[stream].push(newSlot);
  return newSlot;
}

export async function getFacultyAllocationProfile(
  session: SessionPayload | { sub: string; name?: string; college: string }
): Promise<FacultyAllocationProfile> {
  if (dataBackend() === "postgres") {
    try {
      const t = db();
      const collegeScope = session.college;

      const college = await t.college.findFirst({
        where: {
          OR: [
            { publicId: collegeScope },
            { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collegeScope) ? collegeScope : undefined },
            { name: collegeScope },
          ].filter(Boolean) as any,
        },
      });

      if (college) {
        const allCollegeCourses = await t.course.findMany({
          where: {
            collegeId: college.id,
          },
          include: {
            department: true,
            term: true,
          },
          orderBy: { code: "asc" },
        });

        const allCollegeStudents = await t.student.findMany({
          where: {
            collegeId: college.id,
            status: "Active",
          },
          include: {
            user: true,
            department: true,
          },
          orderBy: { rollNo: "asc" },
        });

        const facultyNameSearch = session.name || "Meena Raghavan";
        let facCourses = allCollegeCourses.filter((c) =>
          c.facultyName && (
            c.facultyName.toLowerCase().includes(facultyNameSearch.toLowerCase()) ||
            facultyNameSearch.toLowerCase().includes(c.facultyName.toLowerCase()) ||
            (facultyNameSearch.includes("Meena") && c.facultyName.includes("Meena"))
          )
        );

        if (facCourses.length === 0) {
          facCourses = allCollegeCourses.filter((c) => c.status === "Active");
        }
        if (facCourses.length === 0) {
          facCourses = allCollegeCourses;
        }

        if (facCourses.length > 0) {
          const streamName = (await collegeStream(session.college)) || "engineering";

          const sections: AllocatedClassSection[] = facCourses.map((c, idx) => {
            const deptStudents = allCollegeStudents.filter((s) => s.departmentId === c.departmentId);
            const studentCount = deptStudents.length > 0 ? deptStudents.length : allCollegeStudents.length;
            const deptCode = c.department.name.includes("Computer")
              ? "CSE"
              : c.department.name.includes("Artificial") || c.department.name.includes("Data")
              ? "AI&DS"
              : c.department.name.includes("Mechanical")
              ? "MECH"
              : c.department.name.slice(0, 4).toUpperCase();

            const sectionLabel = `${deptCode}-A · Term ${c.term?.name || "1"}`;
            const hoursPerWeek = c.credits || 4;

            return {
              id: `sec-${c.id}`,
              courseCode: c.code,
              courseTitle: c.title,
              shortName: c.code,
              section: sectionLabel,
              studentsCount: studentCount,
              attendancePercent: Math.min(94, Math.max(78, 86 + ((idx * 5) % 9))),
              averageScore: Math.min(92, Math.max(65, 70 + ((idx * 6) % 15))),
              nextClass: idx === 0 ? "Today 09:00" : idx === 1 ? "Today 11:15" : "Tomorrow 10:00",
              room: `LH-${202 + idx * 2}`,
              hoursPerWeek,
              units: [
                { id: `u-${c.id}-1`, unit: "Unit 1", title: `${c.title} Fundamentals & Principles`, classMastery: 82 },
                { id: `u-${c.id}-2`, unit: "Unit 2", title: "Methods, Architectures & Operations", classMastery: 76 },
                { id: `u-${c.id}-3`, unit: "Unit 3", title: "Advanced Analysis & Core Theorems", classMastery: 52 },
                { id: `u-${c.id}-4`, unit: "Unit 4", title: "Industry Applications & Optimization", classMastery: 68 },
                { id: `u-${c.id}-5`, unit: "Unit 5", title: "Emerging Frameworks & System Design", classMastery: 44 },
              ],
            };
          });

          const totalTeachingLoad = sections.reduce((sum, s) => sum + s.hoursPerWeek, 0);
          const totalStudents = sections.reduce((sum, s) => sum + s.studentsCount, 0);
          const averageAttendance = Math.round(
            sections.reduce((sum, s) => sum + s.attendancePercent, 0) / sections.length
          );

          const timetable: ClassTimetableSlot[] = [];
          const times = [
            { p: 1, t: "09:00 - 10:00" },
            { p: 2, t: "10:00 - 11:00" },
            { p: 3, t: "11:15 - 12:15" },
            { p: 4, t: "13:15 - 14:15" },
            { p: 5, t: "14:15 - 15:15" },
          ];

          const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
          daysList.forEach((day, dayIdx) => {
            sections.forEach((sec, secIdx) => {
              const timeSlot = times[(dayIdx + secIdx) % times.length]!;
              timetable.push({
                id: `tt-${sec.id}-${day}`,
                day,
                period: timeSlot.p,
                time: timeSlot.t,
                courseCode: sec.courseCode,
                courseTitle: sec.courseTitle,
                shortName: sec.shortName,
                section: sec.section,
                sectionId: sec.id,
                room: sec.room,
                topic: `${sec.courseTitle} Lecture Session`,
              });
            });
          });

          return {
            facultyId: session.sub,
            name: session.name || facCourses[0]?.facultyName || "Faculty",
            designation: "Associate Professor",
            department: facCourses[0]?.department?.name || "Computer Science & Engineering",
            departmentCode: facCourses[0]?.department?.name?.includes("Computer") ? "CSE" : "DEPT",
            stream: streamName,
            totalTeachingLoad,
            totalStudents,
            averageAttendance,
            assignedSections: sections,
            timetable,
            recentAttendance: attendanceHistoryStore,
          };
        }
      }
    } catch (err) {
      console.warn("[faculty-allocation] Postgres query error, falling back to stream fixtures:", err);
    }
  }

  // Fallback to in-memory fixtures
  const stream = (await collegeStream(session.college)) || "engineering";
  const alloc = STREAM_FACULTY_ALLOCATIONS[stream] || STREAM_FACULTY_ALLOCATIONS.engineering;

  const totalTeachingLoad = alloc.sections.reduce((sum, s) => sum + s.hoursPerWeek, 0);
  const totalStudents = alloc.sections.reduce((sum, s) => sum + s.studentsCount, 0);
  const averageAttendance = Math.round(
    alloc.sections.reduce((sum, s) => sum + s.attendancePercent, 0) / (alloc.sections.length || 1)
  );

  if (!TIMETABLE_SLOTS_CACHE[stream]) {
    TIMETABLE_SLOTS_CACHE[stream] = getDefaultTimetableForStream(stream, alloc.sections);
  }

  return {
    facultyId: session.sub,
    name: session.name || alloc.facultyName,
    designation: alloc.designation,
    department: alloc.department,
    departmentCode: alloc.departmentCode,
    stream,
    totalTeachingLoad,
    totalStudents,
    averageAttendance,
    assignedSections: alloc.sections,
    timetable: TIMETABLE_SLOTS_CACHE[stream],
    recentAttendance: attendanceHistoryStore.slice(0, 10),
  };
}
