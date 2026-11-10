/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Test & standard policy documents for the Knowledge Base and the Policy Assistant (/faculty/policy-assistant),
 * written into PostgreSQL for all colleges dynamically based on their stream and institutional profile.
 *
 *   npm run db:seed-policy-docs             add them to all colleges (safe to run again; nothing is duplicated)
 *   npm run db:seed-policy-docs -- --remove delete seeded test documents
 */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
const q = async (sql: string, ...args: unknown[]) => (await prisma.$queryRawUnsafe(sql, ...args)) as any[];

const BY = "Seed (test data)";
const NOTE = "Official institutional policy document for the Policy Assistant and Knowledge Base.";

export interface DocDef {
  title: string;
  type: "Regulation" | "Policy" | "Handbook" | "Guideline" | "Circular";
  owner: string;
  scope: "Institution-wide" | "Students" | "Faculty & staff";
  status: "Approved" | "Pending approval";
  sections: Array<[string, string]>;
}

export function getPoliciesForCollege(collegeName: string, collegeType: string): DocDef[] {
  const isMed = /medical|hospital|health|nursing|mbb/i.test(collegeType) || /medical|hospital/i.test(collegeName);
  const isNursing = /nursing/i.test(collegeType) || /nursing/i.test(collegeName);
  const isMgmt = /management|business/i.test(collegeType) || /management|business/i.test(collegeName);
  const isArts = /arts|science/i.test(collegeType) || /arts/i.test(collegeName);

  if (isNursing) {
    return [
      {
        title: `${collegeName} - Nursing Council Clinical & Academic Regulations 2026`,
        type: "Regulation",
        owner: "Principal & Nursing Superintendent",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Scope & INC Guidelines", `These regulations govern all B.Sc. Nursing, M.Sc. Nursing, and Post-Basic Nursing programs at ${collegeName} as mandated by the Indian Nursing Council (INC) and State Nursing Directorate.`],
          ["2. Mandatory Clinical & Theory Attendance", "A minimum attendance of 80% in theory classes and 100% attendance in clinical hospital postings in designated hospital wards is strictly mandatory before appearing for university examinations. Clinical absences must be made up hour-for-hour during vacation periods."],
          ["3. Clinical Assessment & Skill Logbooks", "Clinical evaluation carries 50% internal assessment weightage through Objective Structured Clinical Examinations (OSCE), bedside procedure logs, medication administration checks, and nursing care plans."],
          ["4. Uniform Code & Professional Decorum", "Students on clinical duty must wear pristine white nursing uniforms, hairnets, black non-slip shoes, and institutional identity badges. Mobile phones are prohibited inside patient wards and intensive care units."],
          ["5. Hepatitis B Vaccination & Student Health", "All nursing students must complete mandatory Hepatitis B 3-dose vaccination and annual health screening at the hospital health unit before entering clinical rotations."],
        ],
      },
      {
        title: `${collegeName} - Hospital Ward Duty, Safety & Patient Care Guidelines`,
        type: "Guideline",
        owner: "Nursing Superintendent Office",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Shift Rotations & Clinical Handover", "Nursing shifts are divided into Morning (7:00 AM - 2:00 PM), Evening (2:00 PM - 8:00 PM), and Night (8:00 PM - 7:30 AM). Formal clinical bedside handover of all patient vitals and drug charts is compulsory."],
          ["2. Infection Control & Biomedical Waste", "Strict adherence to the 5 moments of hand hygiene. Segregation of waste into Yellow (dressings/anatomical), Red (syringes/tubings), White (sharps/needles), and Blue (glass vials) bins is rigorously audited daily."],
          ["3. Accidental Needle-Stick Protocol", "Immediately wash under running tap water for 5 minutes. Do not squeeze. Report within 1 hour to the Emergency Department Casualty Medical Officer for post-exposure prophylaxis (PEP)."],
        ],
      },
      {
        title: `${collegeName} - Faculty Leave & Service Regulations`,
        type: "Policy",
        owner: "Office of the Principal",
        scope: "Faculty & staff",
        status: "Approved",
        sections: [
          ["1. Casual Leave & Vacation", "Teaching staff are entitled to 12 days of Casual Leave (CL) per calendar year. Maximum 3 consecutive days may be availed with HOD recommendation."],
          ["2. On-Duty (OD) Permissions", "Up to 15 days of OD leave per year for presenting research papers at state/national nursing conferences or external examiner assignments."],
        ],
      },
    ];
  }

  if (isMed) {
    return [
      {
        title: `${collegeName} - NMC Academic & Clinical Training Regulations 2026`,
        type: "Regulation",
        owner: "Dean & Vice-Principal",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Scope & CBME Framework", `These regulations govern all MBBS, MD/MS, and superspecialty academic and clinical training programs at ${collegeName} in strict conformity with National Medical Commission (NMC) Competency-Based Medical Education (CBME) guidelines.`],
          ["2. Mandatory Attendance in Theory & Clinical Postings", "A minimum attendance of 75% in theory and 80% in practicals and hospital clinical postings per subject is strictly mandatory for eligibility to appear in university professional examinations. Condonation up to 5% may only be granted by the Dean on certified medical grounds (inpatient hospitalization). Students below 75% clinical attendance must repeat the rotation before the supplementary cycle."],
          ["3. Internal Assessment & Logbook Standards", "Internal assessment comprises 50% continuous formative evaluation (OSCE/OSPE objective examinations, theory tests, bed-side clinics, and case presentations) and 50% clinical logbook certification. A candidate must secure at least 50% combined internal marks in theory and practicals separately to qualify for university examinations."],
          ["4. Dissection Hall & Laboratory Decorum", "White aprons and institutional photo ID cards are mandatory in the Anatomy Dissection Hall, Histology Laboratory, and Mortuary. Full reverence to cadavers ('Silent Teachers') is strictly enforced. Photography or unauthorized electronic recording inside dissection halls is an unbailable violation resulting in immediate disciplinary suspension."],
          ["5. University Examinations & Supplementary Phase", "End-of-phase university examinations are conducted under NMC guidelines. Candidates failing a phase are eligible to appear in the supplementary examination held within 6 weeks of result declaration to prevent academic term loss."],
          ["6. Preclinical Remedial Tutorials & Mentorship", "Students securing below 40% in internal tests are mandatorily assigned faculty mentors from preclinical departments (such as Anatomy, Physiology, and Biochemistry) with bi-weekly remedial tutorials and micro-tests."],
        ],
      },
      {
        title: `${collegeName} - Medical Faculty & Resident Doctor Duty, On-Call & Leave Policy`,
        type: "Policy",
        owner: "Dean & Medical Superintendent",
        scope: "Faculty & staff",
        status: "Approved",
        sections: [
          ["1. Casual Leave & Station Leave", "Every faculty member and tutor is entitled to 12 days of Casual Leave (CL) per calendar year. Up to 3 consecutive days may be availed with prior recommendation of the Head of Department. Station leave permissions must be obtained from the Dean for travel outside the district."],
          ["2. Clinical Emergency Duty & Compensatory Off", "Faculty members and resident medical officers assigned 24-hour casualty duty, emergency obstetrics, or trauma on-call shifts are entitled to a full next-day compensatory off upon formal clinical handover to the incoming duty team."],
          ["3. On-Duty (OD) Permissions & CME Training", "Faculty members are eligible for up to 15 working days of On-Duty (OD) leave per year for presenting peer-reviewed medical research papers at state/national medical conferences (e.g., NATCON, APICON, ASICON), attending NMC-mandated Curriculum Implementation Support Programs (CISP), or serving as external university examiners. Applications must be endorsed by the HOD 7 days prior."],
          ["4. Teaching Workload & Substitute Arrangements", "Teaching faculty on planned leave must record a substitute faculty member for all lecture halls, histology demonstrations, and cadaveric dissection sessions in the Department Academic Register."],
          ["5. Institutional Research Seed Funding & ICMR Grants", "Competitive seed grants up to ₹2,50,000 per clinical investigation are awarded annually by the Institutional Research Review Board. Full reimbursement of registration and publication fees in indexed Medline/PubMed/Scopus journals is provided."],
        ],
      },
      {
        title: `${collegeName} - Anatomy Dissection Hall, Lab Protocols & Code of Conduct`,
        type: "Handbook",
        owner: "Head of Department (Anatomy)",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Cadaveric Reverence & Silent Teachers", "Cadaveric donors are treated with the highest ethical reverence as 'first human teachers'. A solemn Cadaveric Oath is administered on the first day of the MBBS course. Any disrespect, photography, videography, or social media posting of dissection specimens is strictly prohibited and leads to immediate expulsion and NMC intimation."],
          ["2. Apron & Protective Attire", "Clean full-sleeve white medical aprons and institutional photo identity badges are mandatory for all students, demonstrators, and faculty inside the Dissection Hall, Histology Laboratory, and Mortuary. Closed footwear and surgical gloves must be worn during cadaveric work."],
          ["3. Formalin Safety & Ventilation", "The dissection hall maintains continuous positive-pressure ventilation and formalin exhaust filtration. Students with known respiratory sensitivity or asthma must notify faculty instructors and use approved organic-vapor respirators provided by the department."],
          ["4. Osteology Bone Bank & Museum Specimens", "Articulated skeletons, dry bone sets, and plastinated anatomical museum specimens may be borrowed by students against their ID card for study hall sessions between 8:00 AM and 6:00 PM. Specimen damage or loss requires replacement or penalty fee."],
        ],
      },
      {
        title: `${collegeName} - Hospital Infection Control & Bio-Medical Waste Regulations`,
        type: "Guideline",
        owner: "Hospital Infection Control Committee (HICC)",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Bio-Medical Waste Color Coding", "Bio-medical waste segregation at source is strictly mandatory throughout the hospital, wards, and laboratories: Yellow bins for human anatomical tissues, organs, and soiled dressings; Red bins for contaminated plastic tubing, catheters, and syringes without needles; White puncture-proof containers for needles, scalpels, and blades; Blue bins for glass ampoules and medicine vials."],
          ["2. Standard Universal Precautions", "All clinical faculty, nursing officers, and student trainees must observe WHO 5 Moments of Hand Hygiene and wear appropriate PPE (masks, gloves, face shields) during aerosol-generating or invasive clinical procedures."],
          ["3. Needle-Stick Injury Protocol", "Any accidental needle-stick injury or body fluid splash must be flushed under running water for 5 minutes and immediately reported to the HICC nodal officer at Casualty (Ext: 2110). Prophylactic post-exposure counseling (PEP) is initiated within 2 hours."],
          ["4. Anti-Ragging Directives", "Strict compliance with NMC Prevention and Prohibition of Ragging Regulations is enforced. Ragging in any form in hospital wards, campus, or hostels is an unbailable criminal offence. Emergency Anti-Ragging squad contact: 0452-2532535 / Ext. 100."],
        ],
      },
      {
        title: `${collegeName} - Hospital Directory & Emergency Services 2026`,
        type: "Circular",
        owner: "Medical Superintendent",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. 24x7 Emergency Trauma & Casualty", "Ground Floor, Hospital Block A. Emergency Triage line: Ext. 2100; Direct: 0452-2532535. Chief Medical Officer (CMO) on duty round the clock."],
          ["2. Administrative Offices", "Dean's Office: Admin Block, 1st Floor (open 9:00 AM - 5:00 PM). Medical Superintendent's Office: Hospital Block, 1st Floor, Room H-105. Controller of Examinations: Block B, Room 201."],
          ["3. Central Medical Library", "Block C, 2nd Floor. Operating hours: 8:00 AM to 10:00 PM daily. Off-campus and on-campus digital access to PubMed, BMJ Best Practice, ClinicalKey, and UpToDate available via campus Wi-Fi (SSID: MMCH-Academic-HighSpeed)."],
        ],
      },
    ];
  }

  if (isMgmt) {
    return [
      {
        title: `${collegeName} - MBA Academic & Corporate Internship Regulations 2026`,
        type: "Regulation",
        owner: "Dean of Management Studies",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Scope & Trimester Curriculum", `These regulations govern the MBA and Executive PGDM programs at ${collegeName}. The curriculum follows a rigorous trimester credit system with case-based pedagogy.`],
          ["2. Attendance & Case Study Participation", "A minimum attendance of 80% is mandatory in each course. Active participation in Harvard/Ivey case analysis and boardroom simulation exercises accounts for 20% of continuous internal evaluation."],
          ["3. Mandatory Summer Internship Project (SIP)", "Every student must complete an 8-week corporate summer internship with an approved enterprise between the 3rd and 4th trimesters. Submission of an executive dissertation and viva voce evaluation by industry external examiners is required."],
          ["4. Placements & Corporate Ethics", "Students must maintain a minimum CGPA of 6.5 with zero active backlogs to participate in campus recruitment. Unethical conduct during interviews leads to de-registration from the placement season."],
        ],
      },
      {
        title: `${collegeName} - Faculty Consulting & Research Regulations`,
        type: "Policy",
        owner: "Principal & Director",
        scope: "Faculty & staff",
        status: "Approved",
        sections: [
          ["1. Management Development Programs (MDP)", "Faculty members are encouraged to conduct corporate MDPs and consulting projects. Revenue sharing follows the 60:40 institute-faculty model."],
          ["2. Casual Leave & Research Days", "Faculty members receive 12 days of Casual Leave and up to 10 days of paid research leave for empirical data collection and Scopus/ABDC indexed journal writing."],
        ],
      },
    ];
  }

  if (isArts) {
    return [
      {
        title: `${collegeName} - Choice Based Credit System (CBCS) Academic Regulations 2026`,
        type: "Regulation",
        owner: "Controller of Examinations & Academic Council",
        scope: "Institution-wide",
        status: "Approved",
        sections: [
          ["1. Scope & CBCS Framework", `These regulations apply to all Undergraduate (B.A., B.Sc., B.Com, B.C.A.) and Postgraduate (M.A., M.Sc., M.Com) programs at ${collegeName} under UGC guidelines.`],
          ["2. Attendance & Examination Condonation", "A minimum of 75% attendance in theory and practical courses is mandatory to write semester examinations. Condonation of 65% to 74% may be sanctioned by the Principal for genuine medical grounds on payment of the prescribed condonation fee."],
          ["3. Continuous Internal Assessment (CIA)", "Internal assessment carries 25% marks (tests, model exams, assignments, seminars). Semester examinations carry 75% marks. Minimum 40% in semester exams and 40% overall is required to pass."],
          ["4. Arrears & Supplementary Tests", "Students who do not clear a paper may reappear in subsequent semester examinations. Instant examinations are conducted for final-year students with a single arrear paper."],
        ],
      },
      {
        title: `${collegeName} - Faculty Service, Research & Library Guidelines`,
        type: "Policy",
        owner: "Principal's Office",
        scope: "Faculty & staff",
        status: "Approved",
        sections: [
          ["1. Casual Leave & Vacation", "Teaching faculty are entitled to 12 days of Casual Leave per calendar year. Prior approval of HOD is required at least 2 days in advance."],
          ["2. Research Grants & UGC-CARE Publications", "The college provides financial assistance of ₹10,000 for faculty publishing in UGC-CARE and Scopus indexed journals, and covers national seminar registration fees."],
          ["3. Central Library & Digital Repositories", "Open 8:30 AM to 5:30 PM on working days. Faculty have access to N-LIST (INFLIBNET), DELNET, and over 6,000 e-journals."],
        ],
      },
    ];
  }

  // Default: Engineering & Technology
  return [
    {
      title: `${collegeName} - Academic Regulations 2026`,
      type: "Regulation",
      owner: "Registrar",
      scope: "Institution-wide",
      status: "Approved",
      sections: [
        ["1. Scope & Accreditation", `These regulations apply to all B.E./B.Tech and M.E./M.Tech programmes of ${collegeName} under AICTE and University norms. Where a programme has its own specific rule, the stricter rule applies.`],
        ["2. Attendance & Condonation", "A student must attend at least 75% of the classes held in every course to be eligible for the end-semester examination. A student with attendance between 65% and 75% may be granted condonation of up to 10% by the Principal on medical or official grounds, on submission of a valid certificate within 7 days. Students below 65% are not eligible and must repeat the course."],
        ["3. Internal Assessment (40 Marks)", "Internal assessment carries 40 marks: two internal tests (the better scaled to 20 marks), assignments/quizzes (10 marks) and attendance & class participation (10 marks). A retest may be requested within 7 days for valid medical absence."],
        ["4. End-Semester Examination (60 Marks)", "The end-semester examination carries 60 marks. To pass a course a student must score at least 40% in the end-semester examination and at least 50% overall in that course."],
        ["5. Arrear Examinations", "A student who fails a course must clear it in subsequent examination sessions. Arrear courses are written together with regular examinations."],
      ],
    },
    {
      title: `${collegeName} - Faculty Leave, Workload & Duty Policy`,
      type: "Policy",
      owner: "Principal's Office",
      scope: "Faculty & staff",
      status: "Approved",
      sections: [
        ["1. Casual Leave & Applications", "Every faculty member is entitled to 12 days of casual leave in a calendar year. Leave must be applied through the HOD at least 3 working days in advance, except in emergencies."],
        ["2. AICTE Teaching Workload", "Direct teaching workload per week adheres to AICTE guidelines: Assistant Professors teach 16 hours/week; Associate Professors teach 14 hours/week; Professors teach 12 hours/week."],
        ["3. On-Duty (OD) Leave", "Faculty attending conferences, FDPs, or valuation duties are granted up to 15 days of on-duty leave with prior approval of HOD and Principal. A conference attendance report must be submitted within 7 days."],
        ["4. Research Seed Grants & Publications", "Institutional Seed Grants up to ₹2,00,000 per project are awarded for interdisciplinary research. Cash incentives of ₹15,000 for IEEE/Scopus Q1 papers are awarded."],
      ],
    },
    {
      title: `${collegeName} - Student Code of Conduct & Lab Guidelines`,
      type: "Handbook",
      owner: "Dean of Students",
      scope: "Students",
      status: "Approved",
      sections: [
        ["1. Identity Cards & Campus Etiquette", "Students must wear college identity cards visibly on campus at all times. Mobile phones are prohibited inside examination halls and laboratory sessions."],
        ["2. Laboratory Safety Standards", "Safety goggles, closed footwear, and lab coats are compulsory in Chemistry, Physics, and Mechanical workshops. Equipment tampering attracts penalties."],
        ["3. Anti-Ragging Directives", "Ragging in any form is prohibited. Complaints can be made to any faculty member or the 24x7 Anti-Ragging committee. Guilty students face immediate suspension or expulsion."],
      ],
    },
    {
      title: `${collegeName} - Campus Directory & Emergency Services`,
      type: "Circular",
      owner: "Administrative Office",
      scope: "Institution-wide",
      status: "Approved",
      sections: [
        ["1. Administrative Directory", "Principal's Office: Admin Block A, 1st Floor. Controller of Examinations: Block B, Room 102. Dean of Academic Affairs: Block A, Room 105."],
        ["2. Central Library & IEEE Xplore", "Open 8:00 AM to 8:00 PM on working days. High-speed access to IEEE Xplore, ScienceDirect, and digital learning portals is available campus-wide."],
      ],
    },
  ];
}

const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

async function remove() {
  const docs = await q(`DELETE FROM knowledge_documents WHERE uploaded_by = $1 RETURNING public_id`, BY);
  console.log(`Removed ${docs.length} seeded document(s) and their passages.`);
}

async function addAll() {
  const colleges = await q(`SELECT id::text AS id, public_id, name, type FROM colleges ORDER BY public_id`);
  console.log(`Found ${colleges.length} colleges in the database.`);

  for (const col of colleges) {
    const docs = getPoliciesForCollege(col.name, col.type || "");
    let addedCount = 0;

    for (const d of docs) {
      const exists = await q(
        `SELECT 1 FROM knowledge_documents WHERE college_id = $1::uuid AND lower(title) = lower($2) AND status <> 'Archived'`,
        col.id,
        d.title
      );
      if (exists.length) continue;

      const body = d.sections.map(([h, t]) => `${h}\n${t}`).join("\n\n");
      const approved = d.status === "Approved";
      const row = (
        await q(
          `INSERT INTO knowledge_documents (college_id, title, doc_type, owner, scope, description, file_name, mime, size_bytes, status, chunk_count, embedded_count, uploaded_by, approved_by, approved_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, '', 'text/plain', $7, $8, $9, 0, $10, $11, $12) RETURNING id::text AS id, public_id`,
          col.id,
          d.title,
          d.type,
          d.owner,
          d.scope,
          NOTE,
          Buffer.byteLength(body),
          d.status,
          d.sections.length,
          BY,
          approved ? BY : null,
          approved ? new Date() : null,
        )
      )[0];

      for (const [i, [heading, text]] of d.sections.entries()) {
        await q(
          `INSERT INTO knowledge_chunks (document_id, college_id, chunk_index, section, content, tokens, page) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NULL)`,
          row.id,
          col.id,
          i,
          heading,
          text,
          tokens(text),
        );
      }
      addedCount++;
    }

    const t = (
      await q(
        `SELECT count(*) FILTER (WHERE status = 'Approved')::int AS approved, count(*) FILTER (WHERE status = 'Pending approval')::int AS pending FROM knowledge_documents WHERE college_id = $1::uuid`,
        col.id
      )
    )[0];
    console.log(`${col.public_id} (${col.name}): added ${addedCount} docs -> now ${t.approved} approved, ${t.pending} pending`);
  }
}

async function main() {
  try {
    if (process.argv.includes("--remove")) await remove();
    else await addAll();
  } catch (e: any) {
    console.error("Database error:", e.message ?? e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
void main();
