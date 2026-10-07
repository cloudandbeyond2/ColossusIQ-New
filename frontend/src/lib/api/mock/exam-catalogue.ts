import "server-only";
import type { Stream } from "@/config/streams";
import { ENGLISH_KINDS, MAX_FULL_QUESTIONS, type EnglishKind, type ExamGroup } from "@/lib/api/exam-prep-schemas";
import { bankFor } from "./learning-content";
import { ENGLISH_INFO, ENGLISH_ITEMS, englishRound, reorder } from "./exam-bank-english";
import { GA_TOPICS, gaQuestions } from "./exam-bank-ga";
import { QUANT, QUANT_TOPICS } from "./exam-bank-quant";
import { fixedQ, REASONING, REASONING_TOPICS } from "./exam-bank-reasoning";
import { shuffled, type Q, type Rng } from "./refresh-zone-content";

/*
 * Indian competitive, eligibility and entrance exams: who may sit them, their published pattern (sections, questions,
 * marks, negative marking, time) and the practice topics behind each section. Patterns are indicative and change
 * from year to year, so every exam page tells students to check the official notification. No exam dates are kept
 * here: students enter the date they are aiming for.
 */

/* ───────────────────────────── topics ───────────────────────────── */
export type Family = "Quantitative aptitude" | "Reasoning" | "English" | "General awareness" | "Subjects";
export interface TopicDef {
  id: string;
  title: string;
  family: Family;
  /** How many questions the bank can give, in words ("generated" for formula-built topics). */
  items: string;
  build: (n: number, rng: Rng) => Q[];
}

const generated = (kinds: string[], table: Record<string, (rng: Rng) => Q>) => (n: number, rng: Rng): Q[] => {
  const out: Q[] = [];
  const seen = new Set<string>();
  const order = shuffled(rng, kinds);
  for (let i = 0; out.length < n && i < n * 8; i++) {
    const q = table[order[i % order.length]!]!(rng);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    out.push(q);
  }
  return out;
};
const fromList = (list: () => Q[]) => (n: number, rng: Rng): Q[] => shuffled(rng, list()).slice(0, n).map((q) => reorder(rng, q));

const DEPT_BANKS: Record<string, { title: string; departments: string[] }> = {
  "d-cse": { title: "Computer science core", departments: ["Computer Science & Engineering"] },
  "d-ece": { title: "Electronics & communication core", departments: ["Electronics & Communication"] },
  "d-mech": { title: "Mechanical engineering core", departments: ["Mechanical Engineering"] },
  "d-civil": { title: "Civil engineering core", departments: ["Civil Engineering"] },
  "d-medical": { title: "Pre- and para-clinical subjects", departments: ["Anatomy", "Physiology", "Pathology", "Pharmacology"] },
  "d-commerce": { title: "Commerce & accountancy", departments: ["Commerce"] },
};

function buildTopics(): Map<string, TopicDef> {
  const m = new Map<string, TopicDef>();
  for (const [id, t] of Object.entries(QUANT_TOPICS)) m.set(id, { id, title: t.title, family: "Quantitative aptitude", items: "generated fresh each time", build: generated(t.kinds, QUANT) });
  for (const [id, t] of Object.entries(REASONING_TOPICS)) {
    const fixed = t.fixed;
    m.set(id, fixed ? { id, title: t.title, family: "Reasoning", items: `${fixed.length} questions`, build: fromList(() => fixed.map(fixedQ)) } : { id, title: t.title, family: "Reasoning", items: "generated fresh each time", build: generated(t.kinds, REASONING) });
  }
  for (const kind of ENGLISH_KINDS) m.set(`e-${kind}`, { id: `e-${kind}`, title: ENGLISH_INFO[kind].title, family: "English", items: ENGLISH_ITEMS[kind], build: (n, rng) => englishRound(kind, n, rng) });
  for (const [id, t] of Object.entries(GA_TOPICS)) m.set(id, { id, title: t.title, family: t.family, items: `${t.rows.length} questions`, build: fromList(() => gaQuestions(id)) });
  for (const [id, t] of Object.entries(DEPT_BANKS)) {
    const list = () => t.departments.flatMap((d) => bankFor(d)).map((b) => ({ prompt: b.prompt, options: [...b.options] as Q["options"], answer: b.answer, explanation: b.explanation }));
    m.set(id, { id, title: t.title, family: "Subjects", items: `${list().length} questions`, build: fromList(list) });
  }
  return m;
}
export const TOPICS = buildTopics();
export const topicTitle = (id: string) => TOPICS.get(id)?.title ?? id;
export const englishTopic = (k: EnglishKind) => `e-${k}`;

/* ───────────────────────────── exams ───────────────────────────── */
export type Level = "10th" | "12th" | "UG" | "PG" | "MBBS" | "Teacher";
export interface SectionDef {
  name: string;
  questions: number;
  marks: number;
  negative: number;
  topics: string[];
}
export interface ExamDef {
  id: string;
  name: string;
  fullName: string;
  conductedBy: string;
  group: ExamGroup;
  level: Level;
  qualification: string;
  /** Final-year students may apply; "third-year" = from the third year of a degree (GATE). */
  finalYear?: boolean | "third-year";
  /** Only students of these streams clearly qualify; others are told to check the notification. */
  streams?: Stream[];
  summary: string;
  officialSite: string | null;
  durationMin: number;
  sections: SectionDef[];
  ageNote: string;
  patternNote?: string;
  hasTest?: false;
}

const QA = ["q-percentage", "q-profit-loss", "q-interest", "q-time-work", "q-speed", "q-ratio", "q-average", "q-number", "q-series"];
const RE = ["r-series", "r-coding", "r-direction", "r-analogy", "r-ranking", "r-blood", "r-syllogism"];
const EN = ["e-synonyms", "e-antonyms", "e-idioms", "e-one-word", "e-error-spotting", "e-fill-blanks", "e-sentence-improvement", "e-vocabulary"];
const GA = ["g-polity", "g-history", "g-geography", "g-economy", "g-science"];
const GA_TN = [...GA, "g-tamil-nadu"];
const BANK_GA = ["g-banking", "g-economy", "g-computer"];
const AGE = "Age limits differ by post and category, with relaxation for reserved categories. See the official notification.";

export const EXAMS: ExamDef[] = [
  // ── Central government ──
  { id: "upsc-cse", name: "UPSC CSE", fullName: "UPSC Civil Services Examination (Preliminary)", conductedBy: "Union Public Service Commission", group: "central", level: "UG", finalYear: true, qualification: "Graduate in any discipline (final-year students may apply)", summary: "Gateway to the IAS, IPS, IFS and other central services. The prelims screen candidates for the mains and interview.", officialSite: "https://upsc.gov.in", durationMin: 240, sections: [{ name: "General Studies Paper I", questions: 100, marks: 2, negative: 0.66, topics: [...GA, "g-tamil-nadu"] }, { name: "CSAT (Paper II, qualifying)", questions: 80, marks: 2.5, negative: 0.83, topics: [...QA, ...RE] }], ageNote: "Usually 21 to 32 years for the general category, with category relaxations and a limit on attempts.", patternNote: "CSAT is qualifying (33%). Current affairs carry heavy weight in Paper I: use the Current Affairs tab." },
  { id: "ssc-cgl", name: "SSC CGL", fullName: "SSC Combined Graduate Level (Tier 1)", conductedBy: "Staff Selection Commission", group: "central", level: "UG", finalYear: true, qualification: "Graduate (must hold the degree by the notified cut-off date)", summary: "Group B and C posts in central ministries: assistant section officer, inspector, auditor and more.", officialSite: "https://ssc.gov.in", durationMin: 60, sections: [{ name: "General Intelligence & Reasoning", questions: 25, marks: 2, negative: 0.5, topics: RE }, { name: "General Awareness", questions: 25, marks: 2, negative: 0.5, topics: GA }, { name: "Quantitative Aptitude", questions: 25, marks: 2, negative: 0.5, topics: QA }, { name: "English Comprehension", questions: 25, marks: 2, negative: 0.5, topics: EN }], ageNote: "Usually 18 to 32 years depending on the post. " + AGE },
  { id: "ssc-chsl", name: "SSC CHSL", fullName: "SSC Combined Higher Secondary Level (Tier 1)", conductedBy: "Staff Selection Commission", group: "central", level: "12th", qualification: "12th pass", summary: "Lower division clerk, postal and sorting assistant and data entry operator posts.", officialSite: "https://ssc.gov.in", durationMin: 60, sections: [{ name: "General Intelligence", questions: 25, marks: 2, negative: 0.5, topics: RE }, { name: "General Awareness", questions: 25, marks: 2, negative: 0.5, topics: GA }, { name: "Quantitative Aptitude", questions: 25, marks: 2, negative: 0.5, topics: QA }, { name: "English Language", questions: 25, marks: 2, negative: 0.5, topics: EN }], ageNote: "Usually 18 to 27 years. " + AGE },
  { id: "ssc-mts", name: "SSC MTS", fullName: "SSC Multi-Tasking (Non-Technical) Staff", conductedBy: "Staff Selection Commission", group: "central", level: "10th", qualification: "10th pass", summary: "Multi-tasking staff and havaldar posts in central departments.", officialSite: "https://ssc.gov.in", durationMin: 90, sections: [{ name: "Numerical & Mathematical Ability", questions: 20, marks: 3, negative: 0, topics: QA }, { name: "Reasoning Ability", questions: 20, marks: 3, negative: 0, topics: RE }, { name: "General Awareness", questions: 25, marks: 3, negative: 1, topics: GA }, { name: "English Language", questions: 25, marks: 3, negative: 1, topics: EN }], ageNote: "Usually 18 to 25 or 27 years. " + AGE, patternNote: "Session 1 (first two sections) has no negative marking; Session 2 deducts 1 mark per wrong answer." },

  // ── Tamil Nadu ──
  { id: "tnpsc-group-1", name: "TNPSC Group 1", fullName: "TNPSC Combined Civil Services Examination–I (Preliminary)", conductedBy: "Tamil Nadu Public Service Commission", group: "state", level: "UG", qualification: "Graduate", summary: "Deputy Collector, DSP, Assistant Commissioner and other top state posts.", officialSite: "https://www.tnpsc.gov.in", durationMin: 180, sections: [{ name: "General Studies", questions: 175, marks: 1.5, negative: 0, topics: GA_TN }, { name: "Aptitude & Mental Ability", questions: 25, marks: 1.5, negative: 0, topics: [...QA, ...RE] }], ageNote: "Usually 21 to 34 years for the general category, higher for reserved categories. " + AGE },
  { id: "tnpsc-group-2", name: "TNPSC Group 2", fullName: "TNPSC Combined Civil Services Examination–II (Preliminary)", conductedBy: "Tamil Nadu Public Service Commission", group: "state", level: "UG", qualification: "Graduate", summary: "Interview and non-interview posts such as sub-registrar, assistant section officer and revenue assistant.", officialSite: "https://www.tnpsc.gov.in", durationMin: 180, sections: [{ name: "General Studies", questions: 75, marks: 1.5, negative: 0, topics: GA_TN }, { name: "Aptitude & Mental Ability", questions: 25, marks: 1.5, negative: 0, topics: [...QA, ...RE] }], ageNote: AGE, patternNote: "The paper also has a 100-question General Tamil / General English part, not included in the practice mock." },
  { id: "tnpsc-group-4", name: "TNPSC Group 4", fullName: "TNPSC Combined Civil Services Examination–IV", conductedBy: "Tamil Nadu Public Service Commission", group: "state", level: "10th", qualification: "10th (SSLC) pass", summary: "Village administrative officer, junior assistant, typist and similar posts.", officialSite: "https://www.tnpsc.gov.in", durationMin: 180, sections: [{ name: "General Studies", questions: 75, marks: 1.5, negative: 0, topics: GA_TN }, { name: "Aptitude & Mental Ability", questions: 25, marks: 1.5, negative: 0, topics: [...QA, ...RE] }], ageNote: AGE, patternNote: "The paper also has a 100-question Tamil eligibility-cum-scoring part, not included in the practice mock." },

  // ── Banking ──
  { id: "ibps-po", name: "IBPS PO", fullName: "IBPS Probationary Officer (Preliminary)", conductedBy: "Institute of Banking Personnel Selection", group: "banking", level: "UG", qualification: "Graduate (must hold the degree by the notified date)", summary: "Officer posts in public sector banks.", officialSite: "https://www.ibps.in", durationMin: 60, sections: [{ name: "English Language", questions: 30, marks: 1, negative: 0.25, topics: EN }, { name: "Quantitative Aptitude", questions: 35, marks: 1, negative: 0.25, topics: QA }, { name: "Reasoning Ability", questions: 35, marks: 1, negative: 0.25, topics: RE }], ageNote: "Usually 20 to 30 years. " + AGE, patternNote: "Each section has its own 20-minute timer in the real exam." },
  { id: "ibps-clerk", name: "IBPS Clerk", fullName: "IBPS Clerk (Preliminary)", conductedBy: "Institute of Banking Personnel Selection", group: "banking", level: "UG", qualification: "Graduate", summary: "Clerical posts in public sector banks.", officialSite: "https://www.ibps.in", durationMin: 60, sections: [{ name: "English Language", questions: 30, marks: 1, negative: 0.25, topics: EN }, { name: "Numerical Ability", questions: 35, marks: 1, negative: 0.25, topics: QA }, { name: "Reasoning Ability", questions: 35, marks: 1, negative: 0.25, topics: RE }], ageNote: "Usually 20 to 28 years. " + AGE },
  { id: "sbi-po", name: "SBI PO", fullName: "SBI Probationary Officer (Preliminary)", conductedBy: "State Bank of India", group: "banking", level: "UG", finalYear: true, qualification: "Graduate (final-year students may apply provisionally)", summary: "Officer posts in the State Bank of India.", officialSite: "https://sbi.co.in/web/careers", durationMin: 60, sections: [{ name: "English Language", questions: 40, marks: 1, negative: 0.25, topics: EN }, { name: "Quantitative Aptitude", questions: 30, marks: 1, negative: 0.25, topics: QA }, { name: "Reasoning Ability", questions: 30, marks: 1, negative: 0.25, topics: RE }], ageNote: "Usually 21 to 30 years. " + AGE },
  { id: "rbi-grade-b", name: "RBI Grade B", fullName: "RBI Grade B Officer (Phase I)", conductedBy: "Reserve Bank of India", group: "banking", level: "UG", qualification: "Graduate with at least 60% (lower for reserved categories)", summary: "Officer posts at the Reserve Bank of India.", officialSite: "https://opportunities.rbi.org.in", durationMin: 120, sections: [{ name: "General Awareness", questions: 80, marks: 1, negative: 0.25, topics: [...BANK_GA, "g-polity", "g-geography"] }, { name: "Reasoning", questions: 60, marks: 1, negative: 0.25, topics: RE }, { name: "English Language", questions: 30, marks: 1, negative: 0.25, topics: EN }, { name: "Quantitative Aptitude", questions: 30, marks: 1, negative: 0.25, topics: QA }], ageNote: "Usually 21 to 30 years. " + AGE },

  // ── Railways ──
  { id: "rrb-ntpc", name: "RRB NTPC", fullName: "RRB Non-Technical Popular Categories (CBT 1, graduate level)", conductedBy: "Railway Recruitment Boards", group: "railways", level: "UG", qualification: "Graduate (12th pass for undergraduate-level posts)", summary: "Station master, goods guard, clerk and commercial apprentice posts.", officialSite: "https://indianrailways.gov.in", durationMin: 90, sections: [{ name: "Mathematics", questions: 30, marks: 1, negative: 0.33, topics: QA }, { name: "General Intelligence & Reasoning", questions: 30, marks: 1, negative: 0.33, topics: RE }, { name: "General Awareness", questions: 40, marks: 1, negative: 0.33, topics: GA }], ageNote: "Usually 18 to 33 years for graduate posts. " + AGE },
  { id: "rrb-group-d", name: "RRB Group D", fullName: "RRB Level 1 (Group D)", conductedBy: "Railway Recruitment Boards", group: "railways", level: "10th", qualification: "10th pass or ITI", summary: "Track maintainer, helper and assistant posts.", officialSite: "https://indianrailways.gov.in", durationMin: 90, sections: [{ name: "Mathematics", questions: 25, marks: 1, negative: 0.33, topics: QA }, { name: "General Intelligence & Reasoning", questions: 30, marks: 1, negative: 0.33, topics: RE }, { name: "General Science", questions: 25, marks: 1, negative: 0.33, topics: ["g-science", "s-physics", "s-chemistry", "s-biology"] }, { name: "General Awareness", questions: 20, marks: 1, negative: 0.33, topics: GA }], ageNote: "Usually 18 to 33 years. " + AGE },

  // ── Defence ──
  { id: "nda", name: "NDA", fullName: "National Defence Academy & Naval Academy Examination", conductedBy: "Union Public Service Commission", group: "defence", level: "12th", qualification: "12th pass (Physics and Maths for Air Force and Navy wings); unmarried", summary: "Entry to the Army, Navy and Air Force wings of the NDA.", officialSite: "https://upsc.gov.in", durationMin: 300, sections: [{ name: "Mathematics", questions: 120, marks: 2.5, negative: 0.83, topics: ["s-maths", ...QA] }, { name: "General Ability Test", questions: 150, marks: 4, negative: 1.33, topics: [...EN, ...GA, "s-physics", "s-chemistry"] }], ageNote: "Usually between 16½ and 19½ years on the notified date.", patternNote: "Two papers of 2½ hours each, followed by the SSB interview." },
  { id: "cds", name: "CDS", fullName: "Combined Defence Services Examination", conductedBy: "Union Public Service Commission", group: "defence", level: "UG", finalYear: true, qualification: "Graduate (engineering degree for the Naval Academy and Air Force Academy needs specific subjects)", summary: "Entry to IMA, INA, AFA and OTA.", officialSite: "https://upsc.gov.in", durationMin: 360, sections: [{ name: "English", questions: 120, marks: 0.83, negative: 0.28, topics: EN }, { name: "General Knowledge", questions: 120, marks: 0.83, negative: 0.28, topics: GA }, { name: "Elementary Mathematics", questions: 100, marks: 1, negative: 0.33, topics: ["s-maths", ...QA] }], ageNote: "Usually 19 to 25 years depending on the academy; unmarried.", patternNote: "Three papers of 2 hours each, 100 marks each." },
  { id: "afcat", name: "AFCAT", fullName: "Air Force Common Admission Test", conductedBy: "Indian Air Force", group: "defence", level: "UG", finalYear: true, qualification: "Graduate with the required subjects and marks", summary: "Flying, ground duty technical and non-technical branches of the Indian Air Force.", officialSite: "https://afcat.cdac.in", durationMin: 120, sections: [{ name: "General Awareness", questions: 25, marks: 3, negative: 1, topics: GA }, { name: "Verbal Ability in English", questions: 25, marks: 3, negative: 1, topics: EN }, { name: "Numerical Ability", questions: 25, marks: 3, negative: 1, topics: QA }, { name: "Reasoning & Military Aptitude", questions: 25, marks: 3, negative: 1, topics: RE }], ageNote: "Usually 20 to 24 years (flying) or 20 to 26 years (ground duty)." },

  // ── Teaching & eligibility ──
  { id: "ctet", name: "CTET", fullName: "Central Teacher Eligibility Test (Paper II)", conductedBy: "Central Board of Secondary Education", group: "teaching", level: "Teacher", qualification: "Graduate with B.Ed (or as listed in the notification)", summary: "Eligibility for teaching classes 6 to 8 in central government schools.", officialSite: "https://ctet.nic.in", durationMin: 150, sections: [{ name: "Child Development & Pedagogy", questions: 30, marks: 1, negative: 0, topics: ["s-pedagogy"] }, { name: "Language I (English)", questions: 30, marks: 1, negative: 0, topics: EN }, { name: "Mathematics & Science", questions: 60, marks: 1, negative: 0, topics: ["s-maths", "g-science", ...QA] }], ageNote: "No upper age limit for the test itself.", patternNote: "Language II (30 questions) is not included in the practice mock. Paper I covers classes 1 to 5." },
  { id: "tntet", name: "TNTET", fullName: "Tamil Nadu Teacher Eligibility Test (Paper II)", conductedBy: "Teachers Recruitment Board, Tamil Nadu", group: "teaching", level: "Teacher", qualification: "Graduate with B.Ed (or as listed in the notification)", summary: "Eligibility for graduate teacher posts in Tamil Nadu schools.", officialSite: "https://trb.tn.gov.in", durationMin: 180, sections: [{ name: "Child Development & Pedagogy", questions: 30, marks: 1, negative: 0, topics: ["s-pedagogy"] }, { name: "English", questions: 30, marks: 1, negative: 0, topics: EN }, { name: "Mathematics & Science", questions: 60, marks: 1, negative: 0, topics: ["s-maths", "g-science", "s-physics", "s-chemistry", "s-biology"] }], ageNote: "No upper age limit for the test itself.", patternNote: "The Tamil language section (30 questions) is not included in the practice mock." },
  { id: "ugc-net", name: "UGC-NET", fullName: "UGC National Eligibility Test", conductedBy: "National Testing Agency", group: "teaching", level: "PG", finalYear: true, qualification: "Master's degree with at least 55% (final-year PG students may apply)", summary: "Eligibility for Assistant Professor posts, PhD admission and the Junior Research Fellowship.", officialSite: "https://ugcnet.nta.ac.in", durationMin: 180, sections: [{ name: "Paper I: Teaching & Research Aptitude", questions: 50, marks: 2, negative: 0, topics: ["s-research", "q-average", "q-percentage", "r-syllogism", "r-coding", "g-computer"] }], ageNote: "No upper age limit for Assistant Professor; JRF usually up to 30 years.", patternNote: "Paper II (100 questions on your subject) is not included in the practice mock." },
  { id: "tn-set", name: "TN SET", fullName: "Tamil Nadu State Eligibility Test", conductedBy: "State-designated agency (see notification)", group: "teaching", level: "PG", finalYear: true, qualification: "Master's degree with at least 55%", summary: "Eligibility for Assistant Professor posts in Tamil Nadu universities and colleges.", officialSite: null, durationMin: 180, sections: [{ name: "Paper I: Teaching & Research Aptitude", questions: 50, marks: 2, negative: 0, topics: ["s-research", "q-average", "q-percentage", "r-syllogism", "g-computer"] }], ageNote: "No upper age limit.", patternNote: "Paper II (100 questions on your subject) is not included in the practice mock. The conducting body is announced with each notification." },

  // ── UG entrance ──
  { id: "jee-main", name: "JEE Main", fullName: "Joint Entrance Examination (Main), Paper 1", conductedBy: "National Testing Agency", group: "ug-entrance", level: "12th", qualification: "12th with Physics, Chemistry and Mathematics", summary: "Admission to NITs, IIITs and other institutes, and qualification for JEE Advanced (IITs).", officialSite: "https://jeemain.nta.nic.in", durationMin: 180, sections: [{ name: "Physics", questions: 25, marks: 4, negative: 1, topics: ["s-physics"] }, { name: "Chemistry", questions: 25, marks: 4, negative: 1, topics: ["s-chemistry"] }, { name: "Mathematics", questions: 25, marks: 4, negative: 1, topics: ["s-maths"] }], ageNote: "No age limit; you may appear in the year you pass 12th and the next two years.", patternNote: "Each subject has 20 multiple-choice and 5 numerical questions. The practice mock uses multiple-choice only." },
  { id: "neet-ug", name: "NEET-UG", fullName: "National Eligibility cum Entrance Test (UG)", conductedBy: "National Testing Agency", group: "ug-entrance", level: "12th", qualification: "12th with Physics, Chemistry, Biology and English", summary: "Admission to MBBS, BDS, AYUSH and nursing courses across India.", officialSite: "https://neet.nta.nic.in", durationMin: 180, sections: [{ name: "Physics", questions: 45, marks: 4, negative: 1, topics: ["s-physics"] }, { name: "Chemistry", questions: 45, marks: 4, negative: 1, topics: ["s-chemistry"] }, { name: "Biology (Botany & Zoology)", questions: 90, marks: 4, negative: 1, topics: ["s-biology"] }], ageNote: "At least 17 years by 31 December of the admission year." },
  { id: "cuet-ug", name: "CUET-UG", fullName: "Common University Entrance Test (UG)", conductedBy: "National Testing Agency", group: "ug-entrance", level: "12th", qualification: "12th pass", summary: "Admission to UG programmes in central and many state and private universities.", officialSite: "https://cuet.nta.nic.in", durationMin: 120, sections: [{ name: "Language: English", questions: 50, marks: 5, negative: 1, topics: EN }, { name: "General Test", questions: 50, marks: 5, negative: 1, topics: [...GA, ...QA, ...RE] }], ageNote: "No age limit.", patternNote: "Domain subject papers are chosen by each candidate and are not included in the practice mock." },
  { id: "tnea", name: "TNEA", fullName: "Tamil Nadu Engineering Admissions", conductedBy: "Directorate of Technical Education, Tamil Nadu", group: "ug-entrance", level: "12th", qualification: "12th with Mathematics, Physics and Chemistry", summary: "Single-window counselling for B.E./B.Tech seats in Tamil Nadu. There is no entrance test: rank comes from the cut-off mark.", officialSite: "https://www.tneaonline.org", durationMin: 0, sections: [], ageNote: "No age limit.", patternNote: "Cut-off (out of 200) = Mathematics (out of 100) + Physics ÷ 2 + Chemistry ÷ 2. Practise Physics, Chemistry and Maths topics to strengthen your 12th marks.", hasTest: false },
  { id: "clat", name: "CLAT UG", fullName: "Common Law Admission Test (UG)", conductedBy: "Consortium of National Law Universities", group: "ug-entrance", level: "12th", qualification: "12th with at least 45% (40% for reserved categories)", summary: "Admission to five-year integrated LL.B. programmes at National Law Universities.", officialSite: "https://consortiumofnlus.ac.in", durationMin: 120, sections: [{ name: "English Language", questions: 24, marks: 1, negative: 0.25, topics: EN }, { name: "Current Affairs & GK", questions: 30, marks: 1, negative: 0.25, topics: GA }, { name: "Legal Reasoning", questions: 30, marks: 1, negative: 0.25, topics: ["s-legal"] }, { name: "Logical Reasoning", questions: 24, marks: 1, negative: 0.25, topics: RE }, { name: "Quantitative Techniques", questions: 12, marks: 1, negative: 0.25, topics: QA }], ageNote: "No upper age limit.", patternNote: "Real CLAT questions are passage-based; the practice mock uses single questions." },

  // ── PG entrance ──
  { id: "gate", name: "GATE", fullName: "Graduate Aptitude Test in Engineering", conductedBy: "IISc and the IITs (a different institute organises each year)", group: "pg-entrance", level: "UG", finalYear: "third-year", streams: ["engineering", "artsScience"], qualification: "In the third or higher year of a degree in engineering, technology, science, commerce or arts", summary: "M.Tech and PhD admission at IITs, NITs and IISc, and recruitment by many public sector undertakings.", officialSite: null, durationMin: 180, sections: [{ name: "General Aptitude", questions: 10, marks: 1.5, negative: 0.5, topics: ["q-percentage", "q-ratio", "q-series", "r-analogy", "e-fill-blanks", "e-synonyms"] }, { name: "Engineering subject", questions: 55, marks: 1.5, negative: 0.5, topics: ["d-cse", "d-ece", "d-mech", "d-civil", "s-maths"] }], ageNote: "No age limit.", patternNote: "The real paper mixes 1- and 2-mark questions, multiple-select and numerical answers; the practice mock uses 1.5 marks on average. The organising institute changes every year, so search for “GATE” and the year." },
  { id: "cat", name: "CAT", fullName: "Common Admission Test", conductedBy: "Indian Institutes of Management", group: "pg-entrance", level: "UG", finalYear: true, qualification: "Graduate with at least 50% (45% for reserved categories); final-year students may apply", summary: "MBA and PGP admission at the IIMs and hundreds of other business schools.", officialSite: "https://iimcat.ac.in", durationMin: 120, sections: [{ name: "Verbal Ability & Reading Comprehension", questions: 24, marks: 3, negative: 1, topics: EN }, { name: "Data Interpretation & Logical Reasoning", questions: 22, marks: 3, negative: 1, topics: [...RE, "q-percentage", "q-ratio", "q-average"] }, { name: "Quantitative Ability", questions: 22, marks: 3, negative: 1, topics: QA }], ageNote: "No age limit.", patternNote: "Each section has its own 40-minute timer. Type-in-the-answer questions have no negative marking." },
  { id: "cuet-pg", name: "CUET-PG", fullName: "Common University Entrance Test (PG)", conductedBy: "National Testing Agency", group: "pg-entrance", level: "UG", finalYear: true, qualification: "Bachelor's degree (final-year students may apply)", summary: "Admission to PG programmes in central and participating universities.", officialSite: "https://exams.nta.ac.in/CUET-PG", durationMin: 90, sections: [{ name: "General paper", questions: 75, marks: 4, negative: 1, topics: [...EN, ...GA, ...QA, ...RE] }], ageNote: "No age limit.", patternNote: "Most papers test your subject. The practice mock covers the general and aptitude parts only." },
  { id: "tancet", name: "TANCET", fullName: "Tamil Nadu Common Entrance Test (MBA)", conductedBy: "Anna University", group: "pg-entrance", level: "UG", finalYear: true, qualification: "Bachelor's degree with at least 50% (45% for reserved categories)", summary: "MBA and MCA admission at Tamil Nadu universities and colleges.", officialSite: "https://tancet.annauniv.edu", durationMin: 120, sections: [{ name: "Problem Solving & Data Sufficiency", questions: 40, marks: 1, negative: 0.33, topics: QA }, { name: "Analytical Reasoning", questions: 30, marks: 1, negative: 0.33, topics: RE }, { name: "English Comprehension", questions: 30, marks: 1, negative: 0.33, topics: EN }], ageNote: "No age limit.", patternNote: "Section sizes vary by year; the practice mock follows a typical split." },
  { id: "neet-pg", name: "NEET-PG", fullName: "National Eligibility cum Entrance Test (PG)", conductedBy: "National Board of Examinations in Medical Sciences", group: "pg-entrance", level: "MBBS", streams: ["medical"], qualification: "MBBS with the compulsory rotating internship completed by the notified date", summary: "Admission to MD, MS and PG diploma courses.", officialSite: "https://natboard.edu.in", durationMin: 210, sections: [{ name: "Pre-, para- and clinical subjects", questions: 200, marks: 4, negative: 1, topics: ["d-medical", "s-biology"] }], ageNote: "No age limit.", patternNote: "The practice mock draws on the pre- and para-clinical bank; clinical subjects are not yet covered." },
  { id: "iit-jam", name: "IIT JAM", fullName: "Joint Admission Test for Masters", conductedBy: "An IIT (a different one each year)", group: "pg-entrance", level: "UG", finalYear: true, streams: ["artsScience", "engineering"], qualification: "Bachelor's degree with the required subjects (final-year students may apply)", summary: "M.Sc. and integrated PhD admission at the IITs and IISc.", officialSite: null, durationMin: 180, sections: [{ name: "Subject paper (Mathematics, Physics or Chemistry)", questions: 60, marks: 1.5, negative: 0.5, topics: ["s-maths", "s-physics", "s-chemistry"] }], ageNote: "No age limit.", patternNote: "The real paper mixes 1- and 2-mark MCQs, multiple-select and numerical questions. The organising IIT changes every year." },
];

export const examById = (id: string) => EXAMS.find((e) => e.id === id);
export const DISCLAIMER = "Patterns and eligibility are indicative and change from year to year. Always confirm the dates, eligibility, age limits and pattern in the official notification before you apply.";

/* ───────────────────────────── practice mocks ───────────────────────────── */
export const MOCK_SECTION_CAP = 10;
export interface MockPlan {
  questions: number;
  minutes: number;
  scaled: boolean;
  sections: Array<SectionDef & { count: number }>;
}
/**
 * A practice mock. "short": every section, up to MOCK_SECTION_CAP questions each. "full": the real paper's size and
 * time, scaled down only when it is longer than MAX_FULL_QUESTIONS. The time is always scaled to the questions asked.
 */
export function mockPlan(e: ExamDef, length: "short" | "full" = "short"): MockPlan | null {
  if (e.hasTest === false || !e.sections.length) return null;
  const real = e.sections.reduce((n, s) => n + s.questions, 0);
  const factor = length === "full" ? Math.min(1, MAX_FULL_QUESTIONS / real) : 1;
  const sections = e.sections.map((s) => ({ ...s, count: length === "full" ? Math.max(1, Math.round(s.questions * factor)) : Math.min(s.questions, MOCK_SECTION_CAP) }));
  const questions = sections.reduce((n, s) => n + s.count, 0);
  const minutes = Math.max(10, Math.round((e.durationMin * questions) / real));
  return { questions, minutes, scaled: questions < real, sections };
}

/** Questions for one section of a mock: spread across its topics, no repeats. */
export function sectionQuestions(topics: string[], n: number, rng: Rng): Array<Q & { topic: string }> {
  const out: Array<Q & { topic: string }> = [];
  const seen = new Set<string>();
  const order = shuffled(rng, topics.filter((t) => TOPICS.has(t)));
  const pools = new Map(order.map((t) => [t, TOPICS.get(t)!.build(n, rng)]));
  for (let round = 0; out.length < n && round < n; round++) {
    let added = false;
    for (const t of order) {
      const q = pools.get(t)?.[round];
      if (!q || seen.has(q.prompt)) continue;
      seen.add(q.prompt);
      out.push({ ...q, topic: t });
      added = true;
      if (out.length >= n) break;
    }
    if (!added) break;
  }
  return out;
}
