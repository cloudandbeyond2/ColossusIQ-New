import "server-only";
import type {
  CourseDetail,
  EvaluationQueueItem,
  MockTest,
  MockTestSummary,
  Notification,
  Project,
  StudentDashboard,
} from "@/lib/api/schemas";

export const TENANT = { id: "tn-anna-tech", name: "Anna Institute of Technology", university: "Tamil Nadu Technical University" };

export const FIRST_NAMES = [
  "Anand", "Divya", "Karthik", "Priya", "Rahul", "Sneha", "Vignesh", "Aishwarya", "Arjun", "Meera",
  "Harish", "Kavya", "Nikhil", "Pooja", "Sanjay", "Lakshmi", "Rohan", "Nandini", "Suresh", "Fathima",
  "Joseph", "Ananya", "Manoj", "Deepika", "Imran", "Revathi", "Gokul", "Shreya", "Varun", "Keerthana",
];
export const LAST_NAMES = [
  "Kumar", "Raman", "Iyer", "Nair", "Sharma", "Reddy", "Subramanian", "Menon", "Pillai", "Krishnan",
  "Patel", "Das", "Rao", "Joseph", "Khan", "Srinivasan", "Varma", "Gupta", "Balaji", "Mohan",
];

/** Deterministic pseudo-random generator so mock data is stable across reloads. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function personName(i: number): string {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`;
}

export const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Civil Engineering",
  "Artificial Intelligence & Data Science",
  "Management Studies",
  "Commerce",
  "English & Humanities",
];

export const STUDENT_DASHBOARD: StudentDashboard = {
  name: "Anand",
  department: "Computer Science & Engineering",
  departmentCode: "CSE",
  degree: "B.E. Computer Science & Engineering",
  semester: 5,
  year: "3rd Year",
  rollNo: "21CS1014",
  priorities: 3,
  academic: { semesterProgress: 72, examReadiness: 64 },
  skills: { technical: 71, communication: 59, interview: 48 },
  careerReadiness: 63,
  today: [
    { time: "09:00", title: "DBMS Class — Normalization", kind: "class" },
    { time: "11:00", title: "Python Practice — 10 problems", kind: "study" },
    { time: "15:00", title: "Project Work — Smart Campus AI", kind: "project" },
    { time: "18:00", title: "Interview Practice — HR round", kind: "career" },
  ],
  recommendation:
    "Spend 25 minutes revising **normalization (3NF & BCNF)**, then take the 10-question adaptive quiz. It is your weakest DBMS topic and the internal exam is in 9 days.",
  project: { name: "Smart Campus AI", progress: 80 },
  upcoming: [
    { title: "Mock Interview", when: "Friday, 4:00 PM" },
    { title: "DBMS Internal Assessment", when: "in 9 days" },
    { title: "Smart India Hackathon — internal round", when: "Oct 6" },
  ],
  streak: 12,
  xp: 4280,
  weakTopics: [
    { subject: "DBMS", topic: "Normalization", mastery: 42 },
    { subject: "Operating Systems", topic: "Deadlock avoidance", mastery: 48 },
    { subject: "Computer Networks", topic: "Subnetting", mastery: 55 },
  ],
  examCountdown: { exam: "DBMS Internal Assessment II", days: 9, syllabusCovered: 62 },
};

const TOPIC_BANK: Record<string, Array<[string, string]>> = {
  dbms: [
    ["Unit 1 · Introduction", "Data models & schemas"],
    ["Unit 1 · Introduction", "ER modelling"],
    ["Unit 2 · Relational model", "Relational algebra"],
    ["Unit 2 · Relational model", "SQL joins & subqueries"],
    ["Unit 3 · Design", "Functional dependencies"],
    ["Unit 3 · Design", "Normalization (1NF–BCNF)"],
    ["Unit 4 · Transactions", "ACID & schedules"],
    ["Unit 4 · Transactions", "Concurrency control"],
    ["Unit 5 · Storage", "Indexing & B+ trees"],
  ],
  os: [
    ["Unit 1 · Processes", "Process scheduling"],
    ["Unit 2 · Synchronisation", "Semaphores & monitors"],
    ["Unit 3 · Deadlocks", "Deadlock avoidance (Banker's)"],
    ["Unit 4 · Memory", "Paging & segmentation"],
    ["Unit 5 · Storage", "File systems"],
  ],
  cn: [
    ["Unit 1 · Foundations", "OSI & TCP/IP models"],
    ["Unit 2 · Network layer", "IP addressing & subnetting"],
    ["Unit 3 · Transport", "TCP congestion control"],
    ["Unit 4 · Application", "DNS, HTTP & email"],
  ],
  py: [
    ["Unit 1 · Basics", "Data types & control flow"],
    ["Unit 2 · Structures", "Lists, dicts & comprehensions"],
    ["Unit 3 · OOP", "Classes & inheritance"],
    ["Unit 4 · Libraries", "NumPy & pandas"],
  ],
  ml: [
    ["Unit 1 · Foundations", "Linear regression"],
    ["Unit 2 · Classification", "Logistic regression & SVM"],
    ["Unit 3 · Trees", "Decision trees & ensembles"],
    ["Unit 4 · Unsupervised", "Clustering"],
  ],
};

function buildCourse(id: string, code: string, title: string, faculty: string, progress: number, mastery: number): CourseDetail {
  const topics = (TOPIC_BANK[id] ?? []).map(([unit, t], i, arr) => {
    const doneUntil = Math.round((progress / 100) * arr.length);
    const m = Math.max(20, Math.min(96, mastery + ((i * 13) % 30) - 15));
    const status = i < doneUntil ? (m < 50 ? "weak" : "done") : i === doneUntil ? "in-progress" : "todo";
    return { id: `${id}-t${i + 1}`, unit, title: t, mastery: i <= doneUntil ? m : 0, status } as const;
  });
  const next = topics.find((t) => t.status === "in-progress" || t.status === "weak") ?? topics[0];
  return {
    id,
    code,
    title,
    faculty,
    progress,
    mastery,
    units: new Set(topics.map((t) => t.unit)).size,
    nextTopic: next?.title ?? "",
    topics,
  };
}

export const COURSES: CourseDetail[] = [
  buildCourse("dbms", "CS3492", "Database Management Systems", "Dr. Meena Raghavan", 62, 58),
  buildCourse("os", "CS3451", "Operating Systems", "Prof. R. Balaji", 70, 64),
  buildCourse("cn", "CS3591", "Computer Networks", "Dr. K. Anitha", 48, 61),
  buildCourse("py", "GE3151", "Problem Solving with Python", "Prof. S. Mohan", 88, 79),
  buildCourse("ml", "AL3451", "Machine Learning", "Dr. V. Srinivasan", 35, 52),
];

export const MOCK_TESTS: MockTest[] = [
  {
    id: "dbms-normalization",
    title: "Normalization & Functional Dependencies",
    subject: "DBMS",
    durationMin: 20,
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "A relation is in 2NF if it is in 1NF and…",
        options: [
          "It has no multi-valued attributes",
          "Every non-prime attribute is fully functionally dependent on every candidate key",
          "It has no transitive dependencies",
          "Every determinant is a candidate key",
        ],
        marks: 1,
      },
      {
        id: "q2",
        type: "mcq",
        prompt: "Which normal form requires that every determinant be a candidate key?",
        options: ["2NF", "3NF", "BCNF", "4NF"],
        marks: 1,
      },
      {
        id: "q3",
        type: "mcq",
        prompt: "R(A,B,C) with A→B and B→C. The dependency A→C is an example of…",
        options: ["Partial dependency", "Transitive dependency", "Multivalued dependency", "Trivial dependency"],
        marks: 1,
      },
      {
        id: "q4",
        type: "mcq",
        prompt: "Decomposing a relation should ideally be…",
        options: [
          "Lossy and dependency preserving",
          "Lossless-join and dependency preserving",
          "Lossless-join only, never dependency preserving",
          "Neither — decomposition is always avoided",
        ],
        marks: 1,
      },
      {
        id: "q5",
        type: "descriptive",
        prompt:
          "Explain Third Normal Form (3NF) with a suitable example. Show a relation that violates 3NF and decompose it. (10 marks)",
        marks: 10,
      },
    ],
  },
  {
    id: "os-deadlocks",
    title: "Deadlocks & Banker's Algorithm",
    subject: "Operating Systems",
    durationMin: 15,
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "Which is NOT one of the four necessary conditions for deadlock?",
        options: ["Mutual exclusion", "Hold and wait", "Preemption", "Circular wait"],
        marks: 1,
      },
      {
        id: "q2",
        type: "mcq",
        prompt: "Banker's algorithm is a technique for deadlock…",
        options: ["Prevention", "Avoidance", "Detection", "Recovery"],
        marks: 1,
      },
      {
        id: "q3",
        type: "descriptive",
        prompt: "Describe the safety algorithm used in Banker's algorithm and explain what a safe state is. (10 marks)",
        marks: 10,
      },
    ],
  },
];

export const MCQ_KEY: Record<string, Record<string, { answer: number; explanation: string }>> = {
  "dbms-normalization": {
    q1: { answer: 1, explanation: "2NF removes partial dependencies: every non-prime attribute must depend on the whole of each candidate key." },
    q2: { answer: 2, explanation: "BCNF strengthens 3NF: for every non-trivial FD X→Y, X must be a superkey." },
    q3: { answer: 1, explanation: "A→B and B→C gives A→C through B — a transitive dependency, which 3NF removes." },
    q4: { answer: 1, explanation: "Good decompositions are lossless-join (no spurious tuples) and ideally dependency preserving." },
  },
  "os-deadlocks": {
    q1: { answer: 2, explanation: "The condition is *no preemption*. Allowing preemption breaks deadlock." },
    q2: { answer: 1, explanation: "Banker's algorithm avoids deadlock by only granting requests that keep the system in a safe state." },
  },
};

export const MOCK_TEST_SUMMARIES: MockTestSummary[] = [
  ...MOCK_TESTS.map((t, i) => ({
    id: t.id,
    title: t.title,
    subject: t.subject,
    questions: t.questions.length,
    durationMin: t.durationMin,
    difficulty: i === 0 ? "Adaptive" : "Medium",
    lastScore: i === 0 ? 58 : null,
  })),
];

export const PROJECTS: Project[] = [
  {
    id: "smart-campus-ai",
    title: "Smart Campus AI",
    domain: "AI/ML · IoT",
    team: ["Anand Kumar", "Divya Raman", "Karthik Iyer"],
    mentor: "Dr. Meena Raghavan",
    stage: "AI Review",
    progress: 80,
    stages: [
      { title: "Idea", status: "done" },
      { title: "Team Formation", status: "done" },
      { title: "Architecture", status: "done" },
      { title: "Milestones", status: "done" },
      { title: "Implementation", status: "done" },
      { title: "Testing", status: "done" },
      { title: "AI Review", status: "active" },
      { title: "Faculty Review", status: "todo" },
      { title: "Demo", status: "todo" },
      { title: "Portfolio", status: "todo" },
    ],
    review: { architecture: 82, documentation: 64, codeQuality: 76, testing: 58, innovation: 88 },
  },
  {
    id: "agri-soil-sense",
    title: "AgriSoil Sense — low-cost soil health kit",
    domain: "AgriTech · Embedded",
    team: ["Anand Kumar", "Sanjay Rao"],
    mentor: "Prof. R. Balaji",
    stage: "Architecture",
    progress: 30,
    stages: [
      { title: "Idea", status: "done" },
      { title: "Team Formation", status: "done" },
      { title: "Architecture", status: "active" },
      { title: "Milestones", status: "todo" },
      { title: "Implementation", status: "todo" },
      { title: "Testing", status: "todo" },
      { title: "AI Review", status: "todo" },
      { title: "Faculty Review", status: "todo" },
      { title: "Demo", status: "todo" },
      { title: "Portfolio", status: "todo" },
    ],
    review: { architecture: 60, documentation: 40, codeQuality: 0, testing: 0, innovation: 79 },
  },
];

export function notificationsFor(role: string): Notification[] {
  const common: Notification[] = [
    { id: "n1", title: "Security", body: "New sign-in from Chrome on Windows. Not you? Change your password.", when: "Just now", unread: true, tone: "rose" },
  ];
  const byRole: Record<string, Notification[]> = {
    student: [
      { id: "n2", title: "Exam reminder", body: "DBMS Internal Assessment II in 9 days.", when: "2h ago", unread: true, tone: "amber" },
      { id: "n3", title: "AI Mentor", body: "Your study plan was updated after yesterday's quiz.", when: "Yesterday", unread: true, tone: "brand" },
      { id: "n4", title: "Event", body: "Registrations open: Smart India Hackathon internal round.", when: "2 days ago", unread: false, tone: "teal" },
    ],
    faculty: [
      { id: "n2", title: "Evaluation queue", body: "14 AI-evaluated answers are waiting for your review.", when: "1h ago", unread: true, tone: "amber" },
      { id: "n3", title: "Skill Booster", body: "Week 5 of \"AI for Teaching\" is unlocked.", when: "Yesterday", unread: false, tone: "brand" },
    ],
  };
  return [...(byRole[role] ?? [
    { id: "n2", title: "Weekly summary", body: "Your weekly institutional summary is ready.", when: "3h ago", unread: true, tone: "brand" },
  ]), ...common];
}

export function evaluationQueue(): EvaluationQueueItem[] {
  const items: Array<{
    id: string;
    student: string;
    rollNo: string;
    assessment: string;
    question: string;
    answer: string;
    score: number;
    max: number;
    finalScore: number | null;
    status: "approved" | "overridden" | "pending";
    confidence: number;
    remarks?: string;
    criteria: Array<{ criterion: string; awarded: number; max: number }>;
    evidence: string[];
    missing: string[];
  }> = [
    {
      id: "ev-1",
      student: "Anand Kumar",
      rollNo: "21CS0101",
      assessment: "DBMS Internal Assessment I",
      question: "Explain Third Normal Form (3NF) with a suitable example and decomposition. (10 marks)",
      answer:
        "3NF: A relation is in 3NF if it is in 2NF and has no transitive dependency. For every non-trivial FD X -> A, either X is a superkey or A is prime attribute.\nExample: Student(RollNo, Name, DeptId, DeptName). DeptId -> DeptName is transitive via DeptId.\nDecomposition: Student(RollNo, Name, DeptId) and Department(DeptId, DeptName). Lossless join justified.",
      score: 8.5,
      max: 10,
      finalScore: 8.5,
      status: "approved",
      confidence: 0.92,
      remarks: "Accurate decomposition and justification. Full marks on criteria.",
      criteria: [
        { criterion: "3NF Formal Definition", awarded: 3, max: 3 },
        { criterion: "Transitive Dependency Example", awarded: 2.5, max: 3 },
        { criterion: "Lossless Decomposition", awarded: 2, max: 3 },
        { criterion: "Technical Clarity & Presentation", awarded: 1, max: 1 },
      ],
      evidence: ["Defines 3NF using superkeys & prime attributes", "Shows relation Student with DeptId transitive dependency", "Decomposes into two relations with shared key"],
      missing: [],
    },
    {
      id: "ev-2",
      student: "Divya Raman",
      rollNo: "21CS0108",
      assessment: "Operating Systems Midterm",
      question: "Explain Banker's Algorithm for deadlock avoidance with safety algorithm vectors. (10 marks)",
      answer:
        "Banker's Algorithm: Deadlock avoidance ensuring system never enters unsafe state.\nData structures: Available[m], Max[n,m], Allocation[n,m], Need[n,m] where Need = Max - Allocation.\nSafety Algorithm: Initialize Work = Available, Finish[i] = false. Find process i where Finish[i] == false & Need[i] <= Work. Update Work += Allocation[i], Finish[i] = true. If all Finish, system is safe.",
      score: 9.0,
      max: 10,
      finalScore: 9.0,
      status: "approved",
      confidence: 0.94,
      remarks: "Clear step-by-step safety sequence and matrix definitions. Excellent work.",
      criteria: [
        { criterion: "Deadlock Avoidance & Safety Definition", awarded: 2.5, max: 2.5 },
        { criterion: "Data Structures (Available, Max, Need)", awarded: 2.5, max: 2.5 },
        { criterion: "Safety Algorithm Step Sequence", awarded: 3, max: 3.5 },
        { criterion: "Safe State Explanation", awarded: 1, max: 1.5 },
      ],
      evidence: ["Correct Need = Max - Allocation equation", "Iterative safety check step with Work vector", "Defines safe sequence condition"],
      missing: [],
    },
    {
      id: "ev-3",
      student: "Karthik Raja",
      rollNo: "21CS0115",
      assessment: "DBMS Internal Assessment I",
      question: "Explain Third Normal Form (3NF) with a suitable example and decomposition. (10 marks)",
      answer:
        "3NF means no transitive dependency. Example Student(RollNo, Name, DeptId, DeptName). DeptName depends on DeptId, which depends on RollNo. Split into Student(RollNo, Name, DeptId) and Dept(DeptId, DeptName).",
      score: 5.0,
      max: 10,
      finalScore: 6.5,
      status: "overridden",
      confidence: 0.72,
      remarks: "Teacher override from 5.0 to 6.5: Definition is brief but decomposition logic is sound.",
      criteria: [
        { criterion: "3NF Formal Definition", awarded: 1.5, max: 3 },
        { criterion: "Transitive Dependency Example", awarded: 2, max: 3 },
        { criterion: "Lossless Decomposition", awarded: 2, max: 3 },
        { criterion: "Technical Clarity & Presentation", awarded: 1, max: 1 },
      ],
      evidence: ["Identifies transitive dependency", "Provides a decomposition into two relations"],
      missing: ["Formal definition with superkey and prime attributes", "Lossless-join justification"],
    },
    {
      id: "ev-4",
      student: "Meera Nair",
      rollNo: "21CS0122",
      assessment: "Data Structures Unit Test II",
      question: "Describe AVL Tree single and double rotations (LL, RR, LR, RL) with balance factor. (10 marks)",
      answer:
        "AVL Tree is a self-balancing binary search tree. Balance Factor BF = Height(Left) - Height(Right) in {-1, 0, 1}.\nLL Rotation: Single right rotation when insert into left of left child.\nRR Rotation: Single left rotation when insert into right of right child.\nLR Rotation: Left rotate left child, then right rotate parent.\nRL Rotation: Right rotate right child, then left rotate parent.\nTime complexity O(log n).",
      score: 8.0,
      max: 10,
      finalScore: 8.0,
      status: "approved",
      confidence: 0.88,
      remarks: "Good explanation of LL and LR rotations with balance factor formula.",
      criteria: [
        { criterion: "AVL Property & Balance Factor", awarded: 2.5, max: 2.5 },
        { criterion: "Single Rotations (LL, RR)", awarded: 2.5, max: 2.5 },
        { criterion: "Double Rotations (LR, RL)", awarded: 2, max: 3 },
        { criterion: "Time Complexity Analysis", awarded: 1, max: 2 },
      ],
      evidence: ["Defines BF = Height(L) - Height(R)", "Accurate LL, RR, LR, RL rotation steps", "Mentions O(log n) efficiency"],
      missing: ["Diagrammatic rotation examples"],
    },
    {
      id: "ev-5",
      student: "Rahul Sharma",
      rollNo: "21CS0129",
      assessment: "DBMS Internal Assessment I",
      question: "Explain Third Normal Form (3NF) with a suitable example and decomposition. (10 marks)",
      answer:
        "Third normal form removes redundancy. A table should have a primary key and no repeating groups. We split big tables into small tables.",
      score: 4.0,
      max: 10,
      finalScore: null,
      status: "pending",
      confidence: 0.61,
      remarks: "Pending faculty review. Very brief answer, missed transitive dependency.",
      criteria: [
        { criterion: "3NF Formal Definition", awarded: 1, max: 3 },
        { criterion: "Transitive Dependency Example", awarded: 1, max: 3 },
        { criterion: "Lossless Decomposition", awarded: 1, max: 3 },
        { criterion: "Technical Clarity & Presentation", awarded: 1, max: 1 },
      ],
      evidence: ["Mentions redundancy removal"],
      missing: ["Functional dependencies", "Transitive dependency concept", "Lossless decomposition"],
    },
    {
      id: "ev-6",
      student: "Sneha Iyer",
      rollNo: "21CS0136",
      assessment: "Computer Networks Cycle Test",
      question: "Explain distance vector routing algorithm and count-to-infinity problem. (10 marks)",
      answer:
        "Distance Vector Routing uses Bellman-Ford equation Dx(y) = min_v { c(x,v) + Dv(y) }. Nodes exchange vectors with neighbors.\nCount-to-infinity problem: upon link break, nodes form routing loops incrementing hop count to infinity (16 in RIP).\nFix: Split Horizon with Poison Reverse.",
      score: 7.5,
      max: 10,
      finalScore: 7.5,
      status: "approved",
      confidence: 0.89,
      remarks: "Correct formulation of Bellman-Ford and poison reverse mitigation.",
      criteria: [
        { criterion: "Bellman-Ford Formula", awarded: 2.5, max: 3 },
        { criterion: "Routing Loop & Count-to-Infinity", awarded: 2.5, max: 3 },
        { criterion: "Split Horizon / Poison Reverse", awarded: 2.5, max: 3 },
        { criterion: "Convergence Details", awarded: 0, max: 1 },
      ],
      evidence: ["States Bellman-Ford equation", "Explains count-to-infinity loop upon link failure", "Describes poison reverse fix"],
      missing: ["Detailed numerical example with 3 nodes"],
    },
  ];

  return items.map((item) => ({
    id: item.id,
    student: item.student,
    rollNo: item.rollNo,
    assessment: item.assessment,
    question: item.question,
    answer: item.answer,
    result: {
      score: item.score,
      max: item.max,
      confidence: item.confidence,
      rubric: item.criteria,
      evidence: item.evidence.map((e) => `✓ ${e}`),
      missing: item.missing,
      feedback: item.missing.length === 0 ? "Complete answer covering expected points." : `Improve by covering: ${item.missing.join("; ")}`,
      reviewRequired: item.confidence < 0.8,
    },
    status: item.status,
    finalScore: item.finalScore,
    facultyRemarks: item.remarks ?? null,
    evaluatedAt: new Date(Date.now() - 86400000 * (parseInt(item.id.replace("ev-", ""), 10) || 1)).toISOString(),
  }));
}

export const TENANTS = [
  { name: "Anna Institute of Technology", type: "College", plan: "Campus Pro", students: 6420, status: "Active", region: "Chennai" },
  { name: "Tamil Nadu Technical University", type: "University", plan: "University Enterprise", students: 48210, status: "Active", region: "Chennai" },
  { name: "Kaveri College of Arts & Science", type: "College", plan: "Campus Starter", students: 2140, status: "Active", region: "Tiruchirappalli" },
  { name: "Deccan School of Management", type: "College", plan: "Campus Pro", students: 1890, status: "Pilot", region: "Hyderabad" },
  { name: "Malabar Engineering College", type: "College", plan: "Campus Pro", students: 3875, status: "Active", region: "Kozhikode" },
  { name: "Sahyadri Polytechnic", type: "College", plan: "Campus Starter", students: 1210, status: "Onboarding", region: "Pune" },
];
