import "server-only";
import { CLINICAL_DEPARTMENTS, type RecordValue, type ResourceRecord } from "@/config/resources";
import { STREAM_DEFS, streamOfType, type Stream } from "@/config/streams";
import { TOGGLEABLE_GROUPS } from "@/config/tenancy";
import { personName, seeded } from "@/lib/api/mock/fixtures";

/* Demo seed rows for the in-memory store (the PostgreSQL store is seeded by db/seed/*.sql). */

export function stamp(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

const pick = <T,>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)] as T;
const phone = (r: () => number) => `9${String(Math.floor(100000000 + r() * 899999999))}`;
const emailFor = (name: string, domain: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@${domain}`;
const ALL_GROUPS = [...TOGGLEABLE_GROUPS];

/* ── colleges ───────────────────────────────────── */
// Order matters: ids are assigned COL-1001, COL-1002, … in this order.
export const COLLEGE_SEEDS: Array<[string, string, string, string, number, number, string, string, string, string[], string]> = [
  ["Anna Institute of Technology", "1101", "Engineering", "Chennai", 2001, 6600, "Dr. Lakshmi Sundaram", "University Enterprise", "Active", ALL_GROUPS, "ait.edu.in"],
  ["Kaveri College of Arts & Science", "2204", "Arts & Science", "Tiruchirappalli", 1987, 3200, "Dr. M. Revathi", "Campus Pro", "Active", ["Career", "Communication & Skills", "Campus Life", "Placement", "Admissions"], "kaveri.ac.in"],
  ["Kongu College of Engineering", "1318", "Engineering", "Erode", 1994, 5400, "Dr. K. Palanisamy", "Campus Pro", "Active", ALL_GROUPS, "kongu.edu.in"],
  ["Coimbatore School of Management", "3402", "Management", "Coimbatore", 2008, 1200, "Prof. S. Harini", "Campus Starter", "Active", ["Career", "Communication & Skills", "Placement", "Incubation", "Admissions"], "csm.edu.in"],
  ["Vaigai Polytechnic College", "4507", "Polytechnic", "Madurai", 2015, 900, "Mr. A. Selvam", "Campus Starter", "Onboarding", ["Career", "Campus Life", "Admissions"], "vaigaipoly.ac.in"],
  ["Madurai Medical College & Hospital", "5101", "Medical College & Hospital", "Madurai", 1954, 1500, "Dr. R. Meenakshi, MD", "University Enterprise", "Active", ["Career", "Communication & Skills", "Project & Innovation", "Campus Life", "Admissions"], "mmch.ac.in"],
  ["Chennai Institute of Nursing & Allied Health Sciences", "5230", "Nursing & Allied Health Sciences", "Chennai", 1999, 800, "Prof. J. Stella, M.Sc (N)", "Campus Pro", "Active", ["Career", "Communication & Skills", "Campus Life", "Admissions"], "cinahs.ac.in"],
  ["Apex Institute of Science & Technology", "2418", "Engineering", "Coimbatore", 2012, 2400, "SARAVANAN-PRIN", "Campus Pro", "Active", ALL_GROUPS, "aist.edu.in"],
];

export function collegeRows(): Array<Record<string, RecordValue>> {
  const r = seeded(424242);
  return COLLEGE_SEEDS.map(([name, code, type, city, established, studentCapacity, principal, plan, status, modules, domain]) => ({
    name,
    code,
    type,
    city,
    established,
    studentCapacity,
    principal,
    email: `office@${domain}`,
    phone: phone(r),
    plan,
    status,
    modules,
    admissionsOpen: status === "Active",
  }));
}

/* ── per-stream seed content ────────────────────── */
const COURSES_BY_STREAM: Record<Stream, Array<[string, string, string, string, number, string, string]>> = {
  engineering: [
    ["CS3492", "Database Management Systems", "Computer Science & Engineering", "4", 4, "Theory", "Dr. Meena Raghavan"],
    ["CS3451", "Operating Systems", "Computer Science & Engineering", "4", 3, "Theory", "Prof. R. Balaji"],
    ["CS3591", "Computer Networks", "Computer Science & Engineering", "5", 4, "Theory", "Dr. K. Anitha"],
    ["AL3451", "Machine Learning", "Artificial Intelligence & Data Science", "4", 3, "Theory", "Dr. V. Srinivasan"],
    ["EC3351", "Control Systems", "Electronics & Communication", "3", 4, "Theory", "Dr. S. Priya"],
    ["ME3491", "Theory of Machines", "Mechanical Engineering", "4", 4, "Theory + Lab", "Prof. N. Kumar"],
  ],
  medical: [
    ["AN101", "Human Anatomy", "Anatomy", "Phase I", 6, "Theory + Lab", "Dr. P. Kalaivani, MS"],
    ["PY101", "Human Physiology", "Physiology", "Phase I", 5, "Theory + Lab", "Dr. S. Ramesh, MD"],
    ["BC101", "Biochemistry", "Biochemistry", "Phase I", 4, "Theory + Lab", "Dr. A. Farida, MD"],
    ["PA201", "Pathology", "Pathology", "Phase II", 5, "Theory + Lab", "Dr. K. Vasanth, MD"],
    ["PH201", "Pharmacology", "Pharmacology", "Phase II", 4, "Theory", "Dr. G. Latha, MD"],
    ["CM301", "Community Medicine", "Community Medicine", "Phase III Part 1", 4, "Clinical posting", "Dr. T. Arul, MD"],
    ["GM401", "General Medicine", "General Medicine", "Phase III Part 2", 6, "Clinical posting", "Dr. R. Prakash, MD"],
    ["NU101", "Fundamentals of Nursing", "Nursing", "Year 1", 5, "Practical / skills lab", "Prof. J. Stella"],
  ],
  artsScience: [
    ["UTA101", "Tamil Ilakkiyam I", "Tamil", "1", 3, "Theory", "Dr. P. Senthamizh"],
    ["UEN101", "English Communication I", "English", "1", 3, "Theory", "Dr. Anne Joseph"],
    ["UCO301", "Financial Accounting", "Commerce", "3", 4, "Theory", "Dr. V. Murugan"],
    ["UCH401", "Organic Chemistry II", "Chemistry", "4", 4, "Theory + Lab", "Dr. S. Kavitha"],
    ["UCS301", "Data Structures (BCA)", "Computer Science", "3", 4, "Theory + Lab", "Prof. R. Dinesh"],
    ["UEC501", "Indian Economic Development", "Economics", "5", 3, "Elective", "Dr. N. Bharathi"],
  ],
  management: [
    ["MB101", "Managerial Economics", "Finance", "1", 3, "Theory", "Prof. S. Harini"],
    ["MB205", "Marketing Management", "Marketing", "2", 3, "Theory", "Dr. K. Arvind"],
    ["MB310", "Business Analytics with Python", "Business Analytics", "3", 4, "Theory + Lab", "Dr. P. Nandhini"],
  ],
  polytechnic: [
    ["DME201", "Engineering Drawing", "Mechanical Engineering", "2", 4, "Practical / skills lab", "Mr. K. Ganesh"],
    ["DEE301", "Electrical Machines I", "Electrical & Electronics", "3", 4, "Theory + Lab", "Mrs. R. Uma"],
  ],
};

const EVENTS_BY_STREAM: Record<Stream, Array<[string, string, string, string, number]>> = {
  engineering: [
    ["Techno Fest 2026", "Cultural", "2026-10-10", "Main Auditorium", 1500],
    ["Smart India Hackathon — internal", "Hackathon", "2026-10-06", "Innovation Lab", 300],
    ["Workshop: GenAI for Engineers", "Workshop", "2026-10-04", "Seminar Hall 2", 180],
  ],
  medical: [
    ["CME: Sepsis management update", "Seminar", "2026-10-09", "Lecture Theatre 1", 250],
    ["Voluntary Blood Donation Camp", "Social service", "2026-10-14", "Blood Bank", 300],
    ["Rural health camp — Melur PHC", "Social service", "2026-10-21", "Melur Primary Health Centre", 60],
  ],
  artsScience: [
    ["Tamil Mandram literary festival", "Cultural", "2026-10-08", "Open-air Theatre", 800],
    ["National seminar: Green Chemistry", "Seminar", "2026-10-16", "Seminar Hall", 200],
    ["Commerce quiz & business plan contest", "Workshop", "2026-10-11", "Commerce Block", 150],
  ],
  management: [["Leadership talk series", "Seminar", "2026-10-12", "Auditorium", 250]],
  polytechnic: [["Skill India workshop: CNC basics", "Workshop", "2026-10-18", "Workshop Block", 90]],
};

const ADMISSIONS_PER_COLLEGE: Record<string, number> = { "COL-1001": 8, "COL-1002": 5, "COL-1003": 4, "COL-1004": 3, "COL-1005": 0, "COL-1006": 6, "COL-1007": 4 };
const ADMISSION_STATUSES_SEED = ["Enquiry", "Applied", "Documents verified", "Shortlisted", "Offer sent", "Fee paid", "Enrolled", "Rejected"] as const;
const DOCS = ["10th mark sheet", "12th mark sheet", "Transfer certificate", "Community certificate", "Passport photo", "Counselling allotment order"];

export function scopedRows(key: string, college: ResourceRecord, seedBase: number): Array<Record<string, RecordValue>> {
  const stream = streamOfType(college.type);
  const def = STREAM_DEFS[stream];
  const domain = String(college.email).split("@")[1] ?? "college.edu.in";
  const r = seeded(seedBase * 7919 + key.length);
  const n = (base: number) => (college.status === "Onboarding" ? 0 : base);

  switch (key) {
    case "admissions":
      return Array.from({ length: ADMISSIONS_PER_COLLEGE[college.id] ?? 3 }, (_, i) => {
        const name = personName(seedBase * 11 + i + 40);
        const status = pick(ADMISSION_STATUSES_SEED, r);
        const idx = ADMISSION_STATUSES_SEED.indexOf(status);
        const max = def.entrance.max;
        return {
          fullName: name,
          dob: `200${6 + Math.floor(r() * 3)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
          gender: pick(["Female", "Male"], r),
          email: emailFor(name, "gmail.com"),
          phone: phone(r),
          city: pick(["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Vellore", "Tirunelveli", "Erode"], r),
          state: pick(["Tamil Nadu", "Tamil Nadu", "Tamil Nadu", "Kerala", "Karnataka"], r),
          board: pick(["State Board", "State Board", "CBSE", "ICSE"], r),
          hscPercent: Math.round((stream === "medical" ? 85 : 65) + r() * (stream === "medical" ? 14 : 33)),
          entranceScore: Math.round(max * (0.55 + r() * 0.4)),
          program: pick(stream === "medical" && college.type === "Medical College & Hospital" ? ["MBBS", "MBBS", "MBBS", "MD General Medicine"] : stream === "medical" ? def.programs.slice(2, 6) : def.programs, r),
          quota: pick(["Government", "Government", "Management", "NRI"], r),
          category: pick(["OC", "BC", "BC", "MBC", "SC", "ST", "EWS"], r),
          scholarship: r() > 0.6,
          hostel: r() > 0.4,
          guardianName: personName(seedBase * 13 + i + 70),
          guardianPhone: phone(r),
          guardianOccupation: pick(["Farmer", "Teacher", "Business", "Government employee", "Doctor", "Homemaker"], r),
          status,
          documents: idx >= 2 && idx <= 6 ? DOCS.slice(0, 3 + Math.floor(r() * 3)) : [],
          notes: "",
        };
      });
    case "staff":
      return Array.from({ length: n(stream === "medical" ? 6 : 4) }, (_, i) => {
        const base = personName(seedBase * 17 + i + 20);
        const teaching = i < (stream === "medical" ? 5 : 3);
        return {
          fullName: `${teaching ? pick(["Dr.", "Dr.", "Prof."], r) : pick(["Mr.", "Ms."], r)} ${base}`,
          email: emailFor(base, domain),
          phone: phone(r),
          qualification: stream === "medical" ? pick(["MD", "MS", "M.Sc (Nursing)", "MBBS, DNB"], r) : stream === "artsScience" ? pick(["Ph.D.", "M.Phil.", "M.A., NET"], r) : pick(["Ph.D.", "M.E.", "M.Tech"], r),
          department: teaching ? pick(def.departments.filter((d) => d !== "Administration" && d !== "Hospital Administration"), r) : stream === "medical" ? "Hospital Administration" : "Administration",
          designation: teaching ? pick(def.designations, r) : pick(["Administrative Officer", "Accountant", "Librarian"], r),
          staffType: teaching ? "Teaching" : "Administrative",
          employment: pick(["Permanent", "Permanent", "Contract"], r),
          joiningDate: `20${String(8 + Math.floor(r() * 17)).padStart(2, "0")}-0${1 + Math.floor(r() * 8)}-01`,
          experienceYears: Math.floor(2 + r() * 25),
          status: pick(["Active", "Active", "Active", "On leave"], r),
          platformAccess: true,
          notes: "",
        };
      });
    case "users":
      return Array.from({ length: n(4) }, (_, i) => {
        const name = personName(seedBase * 19 + i + 2);
        return {
          fullName: name,
          email: emailFor(name, domain),
          role: pick(["Student", "Student", "Faculty", "HOD", "Principal / Institution Admin"], r),
          department: pick(def.departments, r),
          status: pick(["Active", "Active", "Invited", "Suspended"], r),
          mfaRequired: r() > 0.2,
          ssoOnly: r() > 0.7,
          notes: "",
        };
      });
    case "courses":
      return (college.status === "Onboarding" ? [] : COURSES_BY_STREAM[stream])
        .filter(([, , dept]) => college.type !== "Nursing & Allied Health Sciences" || ["Nursing", "Anatomy", "Physiology", "Biochemistry", "Microbiology"].includes(dept))
        .map(([code, title, department, semester, credits, courseType, faculty], i) => ({
          code,
          title,
          department,
          semester,
          credits,
          courseType,
          faculty,
          status: i === 5 ? "Archived" : "Active",
          description: "",
        }));
    case "events":
      return (college.status === "Onboarding" ? [] : EVENTS_BY_STREAM[stream]).map(([title, type, date, venue, capacity], i) => ({
        title,
        type,
        date,
        startTime: pick(["09:00", "10:00", "11:00", "15:00"], r),
        venue,
        organiser: stream === "medical" ? "Department of Community Medicine" : "Student Affairs Office",
        capacity,
        registrationOpen: i !== 2,
        status: i === 2 ? "Draft" : "Published",
        description: "",
      }));
    case "gallery": {
      if (college.status !== "Active") return [];
      const common: Array<[string, string, string, string, boolean]> = [
        ["/campus/campus.svg", "Main campus", "Campus", "Our main building and quadrangle.", true],
        ["/campus/library.svg", "Central library", "Labs & Library", "Open 8 AM – 8 PM with e-journal access.", false],
        ["/campus/sports.svg", "Sports ground", "Sports", "Inter-college athletics meet, 2025.", false],
        ["/campus/cultural.svg", "Annual cultural fest", "Cultural", "Students performing at the annual day celebrations.", true],
        ["/campus/graduation.svg", "Graduation day 2025", "Convocation", "Congratulations to the graduating class!", false],
      ];
      const specific: Array<[string, string, string, string, boolean]> =
        stream === "medical"
          ? [
              ["/campus/hospital.svg", "Teaching hospital", "Hospital & Clinical", "Our attached teaching hospital serves over 2,900 outpatients a day.", true],
              ["/campus/classroom.svg", "Lecture theatre", "Academics", "Phase I lecture on human anatomy.", false],
            ]
          : stream === "engineering" || stream === "polytechnic"
            ? [
                ["/campus/lab.svg", "Computing & electronics lab", "Labs & Library", "Hands-on sessions in the IoT and embedded systems lab.", true],
                ["/campus/classroom.svg", "Smart classroom", "Academics", "ICT-enabled classrooms across all departments.", false],
              ]
            : [
                ["/campus/classroom.svg", "Seminar in progress", "Academics", "National seminar hosted by the Department of Chemistry.", true],
                ["/campus/lab.svg", "Science laboratory", "Labs & Library", "Well-equipped physics and chemistry labs.", false],
              ];
      return [...specific, ...common].map(([image, title, category, caption, featured], i) => ({
        image,
        title,
        category,
        caption,
        featured,
        status: i === 6 ? "Draft" : "Published",
      }));
    }
    case "departments":
      // Every academic department of the stream; heads are named in active colleges.
      return def.departments
        .filter((d) => !/Administration/.test(d))
        .map((department, i) => ({
          department,
          head: college.status === "Active" ? `Dr. ${personName(seedBase * 31 + i + 4)}` : "",
          established: typeof college.established === "number" ? college.established + (i % 3) * 4 : null,
          status: "Active",
          email: i === 0 ? `hod@${domain}` : "",
          phone: "",
          notes: "",
        }));
    case "rotations":
      if (stream !== "medical" || college.status !== "Active") return [];
      return Array.from({ length: college.type === "Medical College & Hospital" ? 8 : 4 }, (_, i) => {
        const start = 1 + i * 2;
        return {
          student: personName(seedBase * 23 + i + 5),
          regNo: `MB${String(21 + (i % 4))}${String(1000 + i * 37).slice(0, 4)}`,
          phase: college.type === "Medical College & Hospital" ? pick(["Phase II", "Phase III Part 1", "Phase III Part 2", "Internship (CRMI)"], r) : "Phase II",
          department: pick(CLINICAL_DEPARTMENTS, r),
          unit: `Unit ${pick(["I", "II", "III", "IV"], r)} · Ward ${10 + Math.floor(r() * 20)}`,
          startDate: `2026-${String(Math.min(start, 10)).padStart(2, "0")}-01`,
          endDate: `2026-${String(Math.min(start + 1, 12)).padStart(2, "0")}-28`,
          supervisor: `Dr. ${personName(seedBase * 29 + i + 60)}`,
          attendance: Math.round(70 + r() * 30),
          competenciesSigned: Math.floor(r() * 40),
          status: pick(["Scheduled", "Ongoing", "Ongoing", "Completed"], r),
          remarks: "",
        };
      });
    case "questions":
      return [
        {
          question: "Differentiate 3NF and BCNF with a suitable functional dependency example.",
          topic: "Transactions",
          difficulty: "Easy",
          bloom: "Apply",
          co: "CO4",
          marks: 5,
          explanation: "3NF allows transitive dependency if the attribute is prime, whereas BCNF strictly disallows any non-trivial FD X->A unless X is a superkey.",
          status: "Active",
        },
        {
          question: "Explain two-phase locking (2PL) protocol and describe how it guarantees serializability.",
          topic: "SQL",
          difficulty: "Hard",
          bloom: "Apply",
          co: "CO5",
          marks: 10,
          explanation: "2PL has a growing phase where locks are acquired and a shrinking phase where locks are released.",
          status: "Active",
        },
        {
          question: "What is a view in SQL? List its advantages in multi-tenant database systems.",
          topic: "Transactions",
          difficulty: "Easy",
          bloom: "Understand",
          co: "CO2",
          marks: 2,
          explanation: "A view is a virtual table based on the result-set of an SQL statement. It provides data isolation and query simplification.",
          status: "Active",
        },
        {
          question: "Explain ACID properties in relational database management systems.",
          topic: "Indexing",
          difficulty: "Hard",
          bloom: "Understand",
          co: "CO1",
          marks: 5,
          explanation: "Atomicity, Consistency, Isolation, and Durability ensure reliable transaction processing.",
          status: "Active",
        },
        {
          question: "Explain lossless-join decomposition and provide conditions to verify it.",
          topic: "Normalization",
          difficulty: "Hard",
          bloom: "Apply",
          co: "CO4",
          marks: 8,
          explanation: "Decomposition of R into R1 and R2 is lossless if R1 intersect R2 is a superkey of R1 or R2.",
          status: "Active",
        },
        {
          question: "Define functional dependency and state Armstrong axioms with examples.",
          topic: "Normalization",
          difficulty: "Medium",
          bloom: "Remember",
          co: "CO2",
          marks: 4,
          explanation: "A functional dependency is a constraint between two sets of attributes in a relation.",
          status: "Active",
        },
        {
          question: "Construct a B+ tree for keys [10, 20, 5, 15, 30, 25] with order 3.",
          topic: "Indexing",
          difficulty: "Hard",
          bloom: "Apply",
          co: "CO3",
          marks: 10,
          explanation: "B+ trees maintain balanced height and keep all records in leaf nodes connected sequentially.",
          status: "Active",
        },
        {
          question: "Write an optimized SQL query to find the second-highest salary without using LIMIT.",
          topic: "SQL",
          difficulty: "Medium",
          bloom: "Apply",
          co: "CO3",
          marks: 4,
          explanation: "SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);",
          status: "Active",
        },
        {
          question: "Discuss conflict serializability and precedence graphs for schedule verification.",
          topic: "Transactions",
          difficulty: "Hard",
          bloom: "Analyse",
          co: "CO4",
          marks: 10,
          explanation: "A schedule is conflict serializable if its precedence graph has no cycles.",
          status: "Active",
        },
        {
          question: "Explain the differences between clustered and non-clustered indexes in PostgreSQL.",
          topic: "Indexing",
          difficulty: "Medium",
          bloom: "Understand",
          co: "CO1",
          marks: 5,
          explanation: "Clustered index dictates the physical order of data on disk, while non-clustered index creates a separate pointer structure.",
          status: "Active",
        },
      ];
    default:
      return [];
  }
}
