import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cleanText } from "@/lib/security/sanitize";
import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";

export interface QuestionPaperRecord {
  id: string;
  collegeId: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  semester: string;
  academicYear: string;
  examType: "Internal Assessment I" | "Internal Assessment II" | "Model Examination" | "Semester End Examination" | "Class Test";
  units: string;
  marks: number;
  duration: string;
  pattern: string;
  bloomLevels: string[];
  markdown: string;
  authorName: string;
  authorSub: string;
  status: "Draft" | "Approved" | "Finalized";
  createdAt: string;
  updatedAt: string;
}

const INITIAL_QUESTION_PAPERS: QuestionPaperRecord[] = [
  {
    id: "QP-2026-CSE101-IA1",
    collegeId: "COL-001",
    courseCode: "CSE101",
    courseTitle: "Database Management Systems",
    department: "Computer Science & Engineering",
    semester: "Semester 5",
    academicYear: "2026-2027",
    examType: "Internal Assessment I",
    units: "Units 1–2",
    marks: 50,
    duration: "90 Minutes",
    pattern: "Part A (2 marks) + Part B (13 marks)",
    bloomLevels: ["Remember", "Understand", "Apply", "Analyze"],
    authorName: "Dr. Meena Raghavan",
    authorSub: "USR-004",
    status: "Finalized",
    createdAt: "2026-10-04T10:30:00Z",
    updatedAt: "2026-10-04T11:00:00Z",
    markdown: `### 📑 University Examination: CSE101 Database Management Systems
**Assessment:** Internal Assessment I (IA-1) | **Syllabus Coverage:** Units 1–2
**Maximum Marks:** 50 Marks | **Duration:** 90 Minutes | **Date:** 04-Oct-2026
**Approved Blueprint Regulations 2026 — Department of Computer Science & Engineering**

---

#### 📝 Part A (5 × 2 = 10 Marks)
*Answer ALL questions. Each question carries 2 marks.*

1. State the key differences between a file-processing system and an enterprise Database Management System. *(CO1, Remember)*
2. Define schema and instance in the ANSI-SPARC three-tier database architecture. *(CO1, Remember)*
3. What is a candidate key? How does it differ from a primary key and alternate key? *(CO2, Understand)*
4. Express the Natural Join ($\bowtie$) operator in relational algebra using fundamental selection ($\sigma$), projection ($\Pi$), and Cartesian product ($\times$). *(CO2, Understand)*
5. Explain the significance of referential integrity constraints with a syntax example in SQL. *(CO2, Remember)*

---

#### 📝 Part B (3 × 13 or 14 = 40 Marks)
*Answer either (a) or (b) from each question. Schematics, relational schemas, and step-by-step solutions required.*

**Q6. (13 Marks)**
- **(a)** An engineering college maintains student attendance, course enrollments, faculty allocations, and laboratory schedules. Design a comprehensive Entity-Relationship (ER) diagram capturing all cardinalities, total/partial participations, and weak entities. *(CO1, Apply)*
  **— OR —**
- **(b)** Deconstruct the Relational Data Model. Explain tuple relational calculus (TRC) vs. domain relational calculus (DRC) with formal calculus queries retrieving students with attendance below 75%. *(CO1, Apply)*

**Q7. (13 Marks)**
- **(a)** Consider the relation $R(A, B, C, D, E, F)$ with functional dependencies:
  $F = \\{ A \\to BC, CD \\to E, B \\to D, E \\to A \\}$.
  1. Determine all candidate keys of $R$.
  2. Compute the canonical cover $F_c$.
  3. Determine the highest normal form of $R$. *(CO2, Analyze)*
  **— OR —**
- **(b)** Formulate SQL DDL and DML queries for an Online Hospital Management System:
  1. Create tables with \`CHECK\`, \`FOREIGN KEY ON DELETE CASCADE\`, and \`UNIQUE\` constraints.
  2. Write a nested correlated subquery with \`EXISTS\` to find physicians with no patients admitted in the current month. *(CO2, Analyze)*

**Q8. (14 Marks)**
- **(a)** Define Boyce-Codd Normal Form (BCNF). Prove whether every BCNF decomposition is guaranteed to be lossless and dependency-preserving. Provide a counterexample relation demonstrating dependency loss during BCNF decomposition. *(CO2, Evaluate)*
  **— OR —**
- **(b)** Explain the architectural differences between Row-oriented Relational Storage vs Columnar and Document DBMS engines. Evaluate storage efficiency for OLTP vs OLAP workloads. *(CO2, Evaluate)*

---

#### 📊 Blueprint & Bloom Attainment Matrix
- **CO Coverage:** CO1 (Relational Data Model & ER): 45% · CO2 (Relational Algebra, SQL & Normalization): 55%
- **Cognitive Attainment:** Remember: 20% · Understand: 20% · Apply: 35% · Analyze: 25%
- **Accreditation Standard:** Fully mapped to NBA / ABET Criterion 3 Programme Outcomes PO1, PO2, PO3, PO5.`,
  },
  {
    id: "QP-2026-CS2354-IA2",
    collegeId: "COL-001",
    courseCode: "CS2354",
    courseTitle: "python",
    department: "Computer Science & Engineering",
    semester: "Semester 3",
    academicYear: "2026-2027",
    examType: "Internal Assessment II",
    units: "Units 3–4",
    marks: 50,
    duration: "90 Minutes",
    pattern: "Part A (2 marks) + Part B (13 marks)",
    bloomLevels: ["Remember", "Understand", "Apply", "Analyze"],
    authorName: "Dr. Meena Raghavan",
    authorSub: "USR-004",
    status: "Approved",
    createdAt: "2026-10-10T14:15:00Z",
    updatedAt: "2026-10-10T14:45:00Z",
    markdown: `### 📑 University Examination: CS2354 python
**Assessment:** Internal Assessment II (IA-2) | **Syllabus Coverage:** Units 3–4 (OOP, Files & Exceptions, Modules)
**Maximum Marks:** 50 Marks | **Duration:** 90 Minutes | **Date:** 10-Oct-2026
**Approved Blueprint Regulations 2026 — Department of Computer Science & Engineering**

---

#### 📝 Part A (5 × 2 = 10 Marks)
*Answer ALL questions. Each question carries 2 marks.*

1. Distinguish between deep copy and shallow copy in Python with code examples. *(CO3, Understand)*
2. What is the role of \`__slots__\` in Python class declarations? *(CO3, Remember)*
3. Explain how Python handles the Method Resolution Order (MRO) in multiple inheritance using the C3 linearization algorithm. *(CO3, Understand)*
4. Differentiate between \`raise\` and \`assert\` statements in Python runtime error handling. *(CO4, Remember)*
5. What are context managers in Python? How does the \`with\` statement guarantee file descriptor closure? *(CO4, Understand)*

---

#### 📝 Part B (3 × 13 or 14 = 40 Marks)
*Answer either (a) or (b) from each question.*

**Q6. (13 Marks)**
- **(a)** Design a modular Object-Oriented Banking Hierarchy in Python implementing encapsulation, abstract base classes via \`abc.ABC\`, property decorators (\`@property\`, \`@setter\`), and class methods. Include custom exceptions for \`InsufficientFundsError\` and \`DailyLimitExceededError\`. *(CO3, Apply)*
  **— OR —**
- **(b)** Explain operator overloading in Python. Implement a complete \`Matrix2D\` class that overloads \`__add__\`, \`__sub__\`, \`__matmul__\` (\`@\`), and \`__repr__\` with dimension validation guards. *(CO3, Apply)*

**Q7. (13 Marks)**
- **(a)** Write a high-performance Python script to parse a 500 MB web server log file (\`access.log\`). Use generators and streaming iterators to count top 10 requesting IP addresses, status code distribution (2xx, 4xx, 5xx), and peak traffic hours without loading the full file into memory. *(CO4, Analyze)*
  **— OR —**
- **(b)** Discuss Python serialization using \`pickle\` vs \`json\`. Analyze security vulnerabilities associated with unpickling untrusted data streams and implement a secure HMAC signature validation wrapper. *(CO4, Analyze)*

**Q8. (14 Marks)**
- **(a)** Construct a Python function decorator \`@rate_limiter(max_calls, period_seconds)\` that enforces execution rate limits using \`functools.wraps\` and thread-safe timestamps. Handle burst capacity gracefully. *(CO4, Evaluate)*
  **— OR —**
- **(b)** Compare Python's Global Interpreter Lock (GIL) impact on multi-threading vs multi-processing for CPU-bound and I/O-bound scientific workloads. Provide benchmark code snippets utilizing \`concurrent.futures\`. *(CO4, Evaluate)*

---

#### 📊 Blueprint & Bloom Attainment Matrix
- **CO Coverage:** CO3 (OOP & Polymorphism): 50% · CO4 (File I/O, Exceptions & Concurrency): 50%
- **Cognitive Attainment:** Remember: 15% · Understand: 25% · Apply: 35% · Analyze/Evaluate: 25%`,
  },
  {
    id: "QP-2026-AID102-MODEL",
    collegeId: "COL-001",
    courseCode: "AID102",
    courseTitle: "AI Ethics, Bias, and Governance",
    department: "Artificial Intelligence & Data Science",
    semester: "Semester 6",
    academicYear: "2026-2027",
    examType: "Model Examination",
    units: "Units 1–5",
    marks: 100,
    duration: "3 Hours",
    pattern: "Part A (2 marks) + Part B (13 marks) + Part C (15 marks)",
    bloomLevels: ["Remember", "Understand", "Apply", "Analyze", "Evaluate"],
    authorName: "Dr. Meena Raghavan",
    authorSub: "USR-004",
    status: "Approved",
    createdAt: "2026-10-12T09:00:00Z",
    updatedAt: "2026-10-12T09:30:00Z",
    markdown: `### 📑 University Examination: AID102 AI Ethics, Bias, and Governance
**Assessment:** Model Examination | **Syllabus Coverage:** Full Syllabus (Units 1–5)
**Maximum Marks:** 100 Marks | **Duration:** 3 Hours | **Date:** 12-Oct-2026
**Approved Blueprint Regulations 2026 — Board of Studies in AI & Data Science**

---

#### 📝 Part A (10 × 2 = 20 Marks)
*Answer ALL questions. Each question carries 2 marks.*

1. Define algorithmic bias and contrast historical bias with representation bias. *(CO1, Remember)*
2. What is Demographic Parity in fair machine learning classifiers? *(CO1, Remember)*
3. Differentiate between Equalized Odds and Predictive Parity fairness criteria. *(CO2, Understand)*
4. State the core requirements of EU AI Act High-Risk AI System compliance. *(CO2, Remember)*
5. Explain the concept of counterfactual fairness in causal graph models. *(CO3, Understand)*
6. What is model watermarking and how does it prevent unauthorized AI model extraction? *(CO3, Remember)*
7. State two methods for mitigating bias in pre-processing training data distributions. *(CO4, Understand)*
8. Differentiate between Local Interpretable Model-agnostic Explanations (LIME) and SHAP (Shapley Additive exPlanations). *(CO4, Understand)*
9. What is differential privacy and how does epsilon ($\\epsilon$) quantify privacy loss? *(CO5, Remember)*
10. Outline the IEEE 7000 standard for addressing ethical concerns during system design. *(CO5, Remember)*

---

#### 📝 Part B (5 × 13 = 65 Marks)
*Answer either (a) or (b) from each question.*

**Q11. (13 Marks)**
- **(a)** Formulate mathematical definitions for False Positive Rate parity and False Negative Rate parity. Demonstrate how COMPAS recidivism prediction algorithms exhibited racial disparity despite race being excluded as an explicit feature. *(CO1, Apply)*
  **— OR —**
- **(b)** Analyze the trade-off between statistical fairness definitions. Prove why Demographic Parity, Equalized Odds, and Predictive Parity cannot be satisfied simultaneously when base prevalence rates differ. *(CO1, Analyze)*

**Q12. (13 Marks)**
- **(a)** Conduct a deep ethical analysis of autonomous vehicular collision dilemmas (the Trolley Problem in AI). Contrast utilitarian algorithms with deontological and contractualist frameworks. *(CO2, Evaluate)*
  **— OR —**
- **(b)** Deconstruct the governance lifecycle for enterprise AI deployments. Include audits, model cards, continuous telemetry drift detection, and human-in-the-loop escalation gates. *(CO2, Analyze)*

**Q13. (13 Marks)**
- **(a)** Evaluate in-processing vs post-processing bias mitigation algorithms. Implement an adversarial debiasing architecture where a predictor minimizes classification loss while an adversary maximizes discriminator confusion. *(CO3, Apply)*
  **— OR —**
- **(b)** Formulate an algorithm for Fair Representation Learning using variational autoencoders. Explain how latent representations decouple sensitive attributes while retaining predictive utility. *(CO3, Apply)*

**Q14. (13 Marks)**
- **(a)** Compare Post-Hoc Explainability (SHAP, Grad-CAM) vs Inherently Interpretable Models (GAMs, Decision Trees). Under what high-stakes conditions is post-hoc explanation legally or ethically insufficient? *(CO4, Evaluate)*
  **— OR —**
- **(b)** Explain Membership Inference Attacks and Model Inversion Attacks against deep neural networks. Show how differentially private SGD (DP-SGD) with gradient clipping prevents reconstruction. *(CO4, Analyze)*

**Q15. (13 Marks)**
- **(a)** Examine the liability allocation framework for AI-generated medical misdiagnoses. Who holds legal accountability: data providers, foundational model creators, hospital administrators, or attending clinicians? *(CO5, Evaluate)*
  **— OR —**
- **(b)** Design an AI Ethics Governance Board framework for an accredited university deploying AI proctoring and grading models. Outline student appeal mechanisms, transparency disclosures, and algorithmic impact assessments. *(CO5, Create)*

---

#### 📝 Part C (1 × 15 = 15 Marks)
*Comprehensive Problem-Solving / Case Study.*

**Q16. (15 Marks)**
A state health portal deploys an automated triage system to prioritize ICU bed allocations during disease outbreaks. Post-deployment audits reveal that marginalized communities received 38% lower priority scores due to insurance claim histories acting as biased proxy variables.
1. Formulate a comprehensive forensic audit methodology to isolate proxy variables.
2. Formulate a corrected loss function incorporating constrained optimization for Equal Opportunity.
3. Establish a continuous ethical monitoring dashboard with automatic circuit-breaker triggers. *(CO5, Synthesize/Evaluate)*

---

#### 📊 Blueprint & Bloom Attainment Matrix
- **CO Coverage:** CO1: 20% · CO2: 20% · CO3: 20% · CO4: 20% · CO5: 20%
- **Cognitive Attainment:** Remember: 15% · Understand: 20% · Apply: 25% · Analyze: 20% · Evaluate/Synthesize: 20%`,
  },
];

function getStoragePath(): string {
  const base = process.cwd();
  if (fs.existsSync(path.join(base, "frontend"))) {
    return path.join(base, "frontend", ".question-papers-data.json");
  }
  return path.join(base, ".question-papers-data.json");
}

let inMemoryPapers: QuestionPaperRecord[] | null = null;

function loadPapers(): QuestionPaperRecord[] {
  if (inMemoryPapers !== null) return inMemoryPapers;
  try {
    const p = getStoragePath();
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryPapers = parsed;
        return inMemoryPapers;
      }
    }
  } catch (err) {
    console.warn("[question-papers] Failed to load from disk, using initial seed:", err);
  }
  inMemoryPapers = [...INITIAL_QUESTION_PAPERS];
  persistPapers(inMemoryPapers);
  return inMemoryPapers;
}

function persistPapers(records: QuestionPaperRecord[]): void {
  try {
    const p = getStoragePath();
    fs.writeFileSync(p, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.warn("[question-papers] Failed to write to disk:", err);
  }
}

export interface ListQuestionPapersOptions {
  collegeId?: string | null;
  courseCode?: string | null;
  search?: string | null;
  examType?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
}

export interface PaginatedQuestionPapersResult {
  papers: QuestionPaperRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listQuestionPapers(
  collegeIdOrOptions?: string | null | ListQuestionPapersOptions,
  courseCodeParam?: string | null
): Promise<PaginatedQuestionPapersResult> {
  let collegeId: string | null | undefined;
  let courseCode: string | null | undefined;
  let search: string | null | undefined;
  let examType: string | null | undefined;
  let status: string | null | undefined;
  let page = 1;
  let pageSize = 10;

  if (typeof collegeIdOrOptions === "object" && collegeIdOrOptions !== null) {
    collegeId = collegeIdOrOptions.collegeId;
    courseCode = collegeIdOrOptions.courseCode;
    search = collegeIdOrOptions.search;
    examType = collegeIdOrOptions.examType;
    status = collegeIdOrOptions.status;
    page = collegeIdOrOptions.page || 1;
    pageSize = collegeIdOrOptions.pageSize || 10;
  } else {
    collegeId = collegeIdOrOptions;
    courseCode = courseCodeParam;
  }

  if (dataBackend() === "postgres") {
    try {
      const t = db();
      let collegeUuid: string | null = null;
      if (collegeId && collegeId !== "all" && collegeId !== "COL-001") {
        const col = await t.college.findFirst({
          where: {
            OR: [
              { publicId: collegeId },
              { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collegeId) ? collegeId : undefined },
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });
        collegeUuid = col?.id || null;
      }

      // Build WHERE conditions
      const q = (search || "").trim();
      const codeFilter = (courseCode || "").trim();
      const typeFilter = (examType || "").trim();
      const statusFilter = (status || "").trim();

      const whereClauses: string[] = ["1=1"];
      const params: any[] = [];

      if (collegeUuid) {
        params.push(collegeUuid);
        whereClauses.push(`(college_id = $${params.length}::uuid OR college_id IS NULL)`);
      }

      if (codeFilter && codeFilter !== "ALL") {
        params.push(`%${codeFilter}%`);
        whereClauses.push(`(course_code ILIKE $${params.length} OR course_title ILIKE $${params.length})`);
      }

      if (q) {
        params.push(`%${q}%`);
        whereClauses.push(`(
          course_code ILIKE $${params.length} OR 
          course_title ILIKE $${params.length} OR 
          units ILIKE $${params.length} OR 
          markdown ILIKE $${params.length} OR
          author_name ILIKE $${params.length}
        )`);
      }

      if (typeFilter && typeFilter !== "ALL") {
        params.push(`%${typeFilter}%`);
        whereClauses.push(`exam_type ILIKE $${params.length}`);
      }

      if (statusFilter && statusFilter !== "ALL") {
        params.push(statusFilter);
        whereClauses.push(`status = $${params.length}`);
      }

      const whereSql = whereClauses.join(" AND ");

      const countResult = await t.$queryRawUnsafe<Array<{ count: string | number }>>(
        `SELECT COUNT(*)::int as count FROM question_papers WHERE ${whereSql}`,
        ...params
      );
      const total = Number(countResult[0]?.count || 0);

      const offset = (page - 1) * pageSize;
      params.push(pageSize);
      const limitParamIdx = params.length;
      params.push(offset);
      const offsetParamIdx = params.length;

      const rows = await t.$queryRawUnsafe<any[]>(
        `SELECT 
          public_id as id,
          college_id as "collegeId",
          course_code as "courseCode",
          course_title as "courseTitle",
          department,
          semester,
          academic_year as "academicYear",
          exam_type as "examType",
          units,
          marks,
          duration,
          pattern,
          bloom_levels as "bloomLevels",
          markdown,
          author_name as "authorName",
          author_sub as "authorSub",
          status,
          to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
          to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
        FROM question_papers
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        ...params
      );

      const papers: QuestionPaperRecord[] = (rows || []).map((r: any) => ({
        id: r.id,
        collegeId: r.collegeId || "COL-001",
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        department: r.department || "Computer Science & Engineering",
        semester: r.semester || "Semester 5",
        academicYear: r.academicYear || "2026-2027",
        examType: r.examType,
        units: r.units,
        marks: Number(r.marks) || 50,
        duration: r.duration || "90 Minutes",
        pattern: r.pattern,
        bloomLevels: Array.isArray(r.bloomLevels) ? r.bloomLevels : ["Remember", "Understand", "Apply"],
        markdown: r.markdown,
        authorName: r.authorName || "Faculty Member",
        authorSub: r.authorSub || "USR-004",
        status: r.status,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString(),
      }));

      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return {
        papers,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (e) {
      console.warn("[question-papers] Postgres query error, falling back to disk store:", e);
    }
  }

  // Fallback to disk / in-memory store
  const all = loadPapers();
  const filtered = all
    .filter((p) => {
      if (collegeId && p.collegeId !== collegeId && p.collegeId !== "COL-001") return false;
      if (courseCode && courseCode !== "ALL" && !p.courseCode.toLowerCase().includes(courseCode.toLowerCase()) && !p.courseTitle.toLowerCase().includes(courseCode.toLowerCase())) return false;
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const match =
          p.courseCode.toLowerCase().includes(q) ||
          p.courseTitle.toLowerCase().includes(q) ||
          p.units.toLowerCase().includes(q) ||
          p.markdown.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (examType && examType !== "ALL" && !p.examType.toLowerCase().includes(examType.toLowerCase())) return false;
      if (status && status !== "ALL" && p.status !== status) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const papers = filtered.slice(start, start + pageSize);

  return {
    papers,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getQuestionPaperById(id: string): Promise<QuestionPaperRecord | null> {
  if (dataBackend() === "postgres") {
    try {
      const t = db();
      const rows = await t.$queryRawUnsafe<any[]>(
        `SELECT 
          public_id as id,
          college_id as "collegeId",
          course_code as "courseCode",
          course_title as "courseTitle",
          department,
          semester,
          academic_year as "academicYear",
          exam_type as "examType",
          units,
          marks,
          duration,
          pattern,
          bloom_levels as "bloomLevels",
          markdown,
          author_name as "authorName",
          author_sub as "authorSub",
          status,
          to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
          to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
        FROM question_papers
        WHERE public_id = $1 OR id::text = $1
        LIMIT 1`,
        id
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          collegeId: r.collegeId || "COL-001",
          courseCode: r.courseCode,
          courseTitle: r.courseTitle,
          department: r.department || "Computer Science & Engineering",
          semester: r.semester || "Semester 5",
          academicYear: r.academicYear || "2026-2027",
          examType: r.examType,
          units: r.units,
          marks: Number(r.marks) || 50,
          duration: r.duration || "90 Minutes",
          pattern: r.pattern,
          bloomLevels: Array.isArray(r.bloomLevels) ? r.bloomLevels : ["Remember", "Understand", "Apply"],
          markdown: r.markdown,
          authorName: r.authorName || "Faculty Member",
          authorSub: r.authorSub || "USR-004",
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
    } catch (err) {
      console.warn("[question-papers] Error fetching by id from PostgreSQL:", err);
    }
  }

  const all = loadPapers();
  return all.find((p) => p.id === id) ?? null;
}

export async function createQuestionPaper(data: {
  collegeId: string;
  courseCode: string;
  courseTitle: string;
  department?: string;
  semester?: string;
  academicYear?: string;
  examType: QuestionPaperRecord["examType"];
  units: string;
  marks: number;
  duration?: string;
  pattern: string;
  bloomLevels?: string[];
  markdown: string;
  authorName: string;
  authorSub: string;
  status?: QuestionPaperRecord["status"];
}): Promise<QuestionPaperRecord> {
  const all = loadPapers();
  const id = `QP-${new Date().getFullYear()}-${cleanText(data.courseCode, 10).toUpperCase().replace(/[^A-Z0-9]/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();

  const record: QuestionPaperRecord = {
    id,
    collegeId: data.collegeId || "COL-001",
    courseCode: cleanText(data.courseCode, 20).toUpperCase(),
    courseTitle: cleanText(data.courseTitle, 120),
    department: data.department ? cleanText(data.department, 80) : "Computer Science & Engineering",
    semester: data.semester ? cleanText(data.semester, 40) : "Semester 5",
    academicYear: data.academicYear ? cleanText(data.academicYear, 20) : "2026-2027",
    examType: data.examType || "Internal Assessment I",
    units: cleanText(data.units, 60) || "Units 1–2",
    marks: Number(data.marks) || 50,
    duration: data.duration || (data.marks >= 100 ? "3 Hours" : "90 Minutes"),
    pattern: cleanText(data.pattern, 100) || "Part A (2 marks) + Part B (13 marks)",
    bloomLevels: data.bloomLevels?.length ? data.bloomLevels : ["Remember", "Understand", "Apply", "Analyze"],
    markdown: data.markdown,
    authorName: cleanText(data.authorName, 80) || "Faculty Member",
    authorSub: cleanText(data.authorSub, 60) || "USR-004",
    status: data.status || "Approved",
    createdAt: now,
    updatedAt: now,
  };

  const updated = [record, ...all];
  inMemoryPapers = updated;
  persistPapers(updated);

  if (dataBackend() === "postgres") {
    try {
      const t = db();
      let collegeUuid: string | null = null;
      if (record.collegeId && record.collegeId !== "COL-001") {
        const col = await t.college.findFirst({
          where: {
            OR: [
              { publicId: record.collegeId },
              { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.collegeId) ? record.collegeId : undefined },
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });
        collegeUuid = col?.id || null;
      }

      await t.$executeRawUnsafe(`
        INSERT INTO question_papers (
          public_id,
          college_id,
          course_code,
          course_title,
          department,
          semester,
          academic_year,
          exam_type,
          units,
          marks,
          duration,
          pattern,
          bloom_levels,
          markdown,
          author_name,
          author_sub,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz, $19::timestamptz
        );
      `,
        record.id,
        collegeUuid,
        record.courseCode,
        record.courseTitle,
        record.department,
        record.semester,
        record.academicYear,
        record.examType,
        record.units,
        record.marks,
        record.duration,
        record.pattern,
        record.bloomLevels,
        record.markdown,
        record.authorName,
        record.authorSub,
        record.status,
        record.createdAt,
        record.updatedAt
      );
    } catch (err) {
      console.warn("[question-papers] Error saving to PostgreSQL:", err);
    }
  }

  return record;
}

export async function updateQuestionPaper(id: string, updates: Partial<QuestionPaperRecord>): Promise<QuestionPaperRecord | null> {
  const all = loadPapers();
  const idx = all.findIndex((p) => p.id === id);
  const now = new Date().toISOString();

  let updatedRecord: QuestionPaperRecord;
  if (idx >= 0) {
    const existing = all[idx]!;
    updatedRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: now,
    };
    all[idx] = updatedRecord;
    inMemoryPapers = all;
    persistPapers(all);
  } else {
    updatedRecord = {
      id,
      collegeId: "COL-001",
      courseCode: updates.courseCode || "COURSE",
      courseTitle: updates.courseTitle || "",
      department: updates.department || "",
      semester: updates.semester || "",
      academicYear: updates.academicYear || "2026-2027",
      examType: updates.examType || "Internal Assessment I",
      units: updates.units || "Units 1–2",
      marks: updates.marks || 50,
      duration: updates.duration || "90 Minutes",
      pattern: updates.pattern || "Part A (2 marks) + Part B (13 marks)",
      bloomLevels: updates.bloomLevels || ["Remember", "Understand"],
      markdown: updates.markdown || "",
      authorName: updates.authorName || "Faculty Member",
      authorSub: updates.authorSub || "USR-004",
      status: updates.status || "Approved",
      createdAt: now,
      updatedAt: now,
    };
  }

  if (dataBackend() === "postgres") {
    try {
      const t = db();
      const setClauses: string[] = ["updated_at = now()"];
      const params: any[] = [];

      if (updates.status) {
        params.push(updates.status);
        setClauses.push(`status = $${params.length}`);
      }
      if (updates.marks !== undefined) {
        params.push(updates.marks);
        setClauses.push(`marks = $${params.length}`);
      }
      if (updates.markdown) {
        params.push(updates.markdown);
        setClauses.push(`markdown = $${params.length}`);
      }

      params.push(id);
      const idParamIdx = params.length;

      await t.$executeRawUnsafe(
        `UPDATE question_papers SET ${setClauses.join(", ")} WHERE public_id = $${idParamIdx} OR id::text = $${idParamIdx};`,
        ...params
      );
    } catch (err) {
      console.warn("[question-papers] Error updating in PostgreSQL:", err);
    }
  }

  return updatedRecord;
}

export async function deleteQuestionPaper(id: string): Promise<boolean> {
  const all = loadPapers();
  const filtered = all.filter((p) => p.id !== id);
  const foundInDisk = filtered.length !== all.length;
  if (foundInDisk) {
    inMemoryPapers = filtered;
    persistPapers(filtered);
  }

  if (dataBackend() === "postgres") {
    try {
      const t = db();
      await t.$executeRawUnsafe(
        `DELETE FROM question_papers WHERE public_id = $1 OR id::text = $1;`,
        id
      );
      return true;
    } catch (err) {
      console.warn("[question-papers] Error deleting from PostgreSQL:", err);
    }
  }

  return foundInDisk;
}
