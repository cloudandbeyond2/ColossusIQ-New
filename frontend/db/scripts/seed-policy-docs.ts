/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Test documents for the Knowledge Base and the Policy Assistant (/institution/policy-assistant), written into
 * PostgreSQL for COL-1001 (Anna Institute of Technology). They are sample college policies for testing, not real
 * regulations: every row is marked "Seed (test data)" and the description says so.
 *
 *   npm run db:seed-policy-docs             add them (safe to run again; nothing is duplicated)
 *   npm run db:seed-policy-docs -- --remove delete exactly what this script added
 *
 * Passages are split per numbered section ("## n. Heading"), which is how the app's own chunker splits a document,
 * and are searched by keywords until you press "Re-index" in the Knowledge Base (that adds semantic embeddings).
 */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
const q = async (sql: string, ...args: unknown[]) => (await prisma.$queryRawUnsafe(sql, ...args)) as any[];

const COLLEGE = "COL-1001";
const BY = "Seed (test data)";
const NOTE = "Sample content for testing the Policy Assistant. Not an official regulation.";

interface Doc {
  title: string;
  type: string;
  owner: string;
  scope: string;
  status: "Approved" | "Pending approval";
  sections: Array<[string, string]>;
}

const DOCS: Doc[] = [
  {
    title: "Academic Regulations 2026",
    type: "Regulation",
    owner: "Registrar",
    scope: "Institution-wide",
    status: "Approved",
    sections: [
      ["1. Scope", "These regulations apply to every undergraduate and postgraduate programme of the college from the 2026-27 academic year. Where a programme has its own rule, the stricter rule applies."],
      ["2. Attendance", "A student must attend at least 75% of the classes held in every course to be eligible for the end-semester examination. Attendance is counted separately for theory and laboratory components. A student with attendance between 65% and 75% may be granted condonation of up to 10% by the Principal on medical or official grounds, on submission of a valid certificate within 7 days of returning to class. Students below 65% are not eligible and must re-register for the course."],
      ["3. Internal assessment", "Internal assessment carries 40 marks: two internal tests (the better of the two, scaled to 20 marks), assignments (10 marks) and attendance and class participation (10 marks). A student who misses an internal test for a valid reason may request a retest within 7 days, with the approval of the Head of Department."],
      ["4. End-semester examination", "The end-semester examination carries 60 marks. To pass a course a student must score at least 40% in the end-semester examination and at least 50% overall (internal plus end-semester) in that course."],
      ["5. Arrears", "A student who fails a course must clear it in the next four consecutive examination sessions. Arrear courses are written together with the regular examinations of the semester."],
      ["6. Revaluation", "A student may apply for revaluation of an end-semester answer script within 7 days of the publication of results, through the student portal, on payment of the revaluation fee announced in the examination circular. The revised mark replaces the original only if it is higher."],
      ["7. Malpractice", "Malpractice in an examination leads to cancellation of that examination and is reported to the Controller of Examinations. A repeat offence results in debarment from the next semester's examinations."],
    ],
  },
  {
    title: "Examination Fee Circular 2026-27",
    type: "Circular",
    owner: "Controller of Examinations",
    scope: "Students",
    status: "Approved",
    sections: [
      ["1. Fee schedule", "The end-semester examination fee is Rs 1,000 per semester for all regular students, covering up to six theory courses and two laboratory courses. Each arrear course carries an additional fee of Rs 150."],
      ["2. Last date", "Examination applications open through the student portal under Exams, then Apply, two weeks before each end-semester examination. The fee must be paid online before the last date announced for the cycle."],
      ["3. Late fee", "Applications received after the last date are accepted for up to three working days on payment of a late fee of Rs 500 in addition to the examination fee. No application is accepted after that."],
      ["4. Revaluation fee", "The fee for revaluation of an answer script is Rs 400 per course. The fee is refunded in full if the revaluation changes the result from fail to pass."],
    ],
  },
  {
    title: "Faculty Leave and Duty Policy",
    type: "Policy",
    owner: "Principal's Office",
    scope: "Faculty & staff",
    status: "Approved",
    sections: [
      ["1. Casual leave", "Every faculty member is entitled to 12 days of casual leave in a calendar year. Casual leave cannot be combined with more than 2 consecutive weekly offs and cannot be carried over to the next year."],
      ["2. Applying for leave", "Leave must be applied for through the Head of Department at least 3 working days in advance, except in an emergency, when the Head of Department must be informed on the same day. Leave on a day with an internal test or an examination duty needs the Principal's approval."],
      ["3. On-duty leave", "Faculty attending conferences, workshops, or serving as external examiners are granted on-duty leave with prior approval of the Head of Department and the Principal. A short report must be submitted to the Head of Department within 7 days of returning."],
      ["4. Arranging substitutes", "A faculty member on leave must arrange a substitute for every class and laboratory session and record it in the department register. The Head of Department may assign a substitute where none was arranged."],
      ["5. Maternity and medical leave", "Maternity leave and medical leave are granted as per the applicable statutory rules, on submission of the relevant certificate. These do not count against casual leave."],
    ],
  },
  {
    title: "Student Code of Conduct",
    type: "Handbook",
    owner: "Dean of Students",
    scope: "Students",
    status: "Approved",
    sections: [
      ["1. Identity cards", "Every student must carry the college identity card on campus and show it when asked by security staff or faculty. A lost card must be reported to the Dean of Students' office within 2 working days to get a replacement."],
      ["2. Mobile phones", "Mobile phones must be switched off or kept silent during classes, laboratories, examinations and library hours. Phones are not permitted inside the examination hall."],
      ["3. Ragging", "Ragging in any form is prohibited. A complaint can be made to any faculty member, the Anti-Ragging Committee or the Principal, and will be investigated promptly. Students found guilty face suspension or expulsion as decided by the committee."],
      ["4. Use of facilities", "Laboratories, the library and the sports facilities are open on working days between 9:00 and 17:00. Damage to college property must be reported and the cost recovered from the students responsible."],
    ],
  },
  {
    title: "Hostel Rules (draft)",
    type: "Policy",
    owner: "Warden",
    scope: "Students",
    status: "Pending approval",
    sections: [
      ["1. Timings", "Residents must be inside the hostel premises before 9:00 in the evening on all days. Late entry needs the Warden's written permission."],
      ["2. Visitors", "Visitors are allowed in the visitors' room between 10:00 and 17:00 on Sundays only."],
    ],
  },
];

const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

async function remove() {
  const docs = await q(`DELETE FROM knowledge_documents WHERE uploaded_by = $1 RETURNING public_id`, BY);
  console.log(`Removed ${docs.length} seeded document(s) and their passages.`);
}

async function add() {
  const col = (await q(`SELECT id::text AS id FROM colleges WHERE public_id = $1`, COLLEGE))[0];
  if (!col) throw new Error(`${COLLEGE} not found. Run the migrations and base seed first.`);
  for (const d of DOCS) {
    const exists = await q(`SELECT 1 FROM knowledge_documents WHERE college_id = $1::uuid AND lower(title) = lower($2) AND status <> 'Archived'`, col.id, d.title);
    if (exists.length) {
      console.log(`Already there: ${d.title}`);
      continue;
    }
    const body = d.sections.map(([h, t]) => `${h}\n${t}`).join("\n\n");
    const approved = d.status === "Approved";
    const row = (
      await q(
        `INSERT INTO knowledge_documents (college_id, title, doc_type, owner, scope, description, file_name, mime, size_bytes, status, chunk_count, embedded_count, uploaded_by, approved_by, approved_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, '', 'text/plain', $7, $8, $9, 0, $10, $11, $12) RETURNING id::text AS id, public_id`,
        col.id, d.title, d.type, d.owner, d.scope, NOTE, Buffer.byteLength(body), d.status, d.sections.length, BY, approved ? BY : null, approved ? new Date() : null,
      )
    )[0];
    for (const [i, [heading, text]] of d.sections.entries()) {
      await q(
        `INSERT INTO knowledge_chunks (document_id, college_id, chunk_index, section, content, tokens, page) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NULL)`,
        row.id, col.id, i, heading, text, tokens(text),
      );
    }
    console.log(`Added ${row.public_id}: ${d.title} (${d.status}, ${d.sections.length} passages)`);
  }
  const t = (await q(`SELECT count(*) FILTER (WHERE status = 'Approved')::int AS approved, count(*) FILTER (WHERE status = 'Pending approval')::int AS pending FROM knowledge_documents WHERE college_id = $1::uuid`, col.id))[0];
  console.log(`${COLLEGE} now has ${t.approved} approved and ${t.pending} pending document(s).`);
}

async function main() {
  try {
    if (process.argv.includes("--remove")) await remove();
    else await add();
  } catch (e: any) {
    console.error("Database error:", e.message ?? e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
void main();
