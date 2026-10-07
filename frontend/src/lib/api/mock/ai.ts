import "server-only";
import { z } from "zod";
import type { ChatReply, EvaluationResult, GenerateReply, InterviewTurn, ResumeAnalysis } from "@/lib/api/schemas";
import { geminiEnabled, geminiJson } from "@/lib/ai/gemini";
import { generateDocumentAi } from "./document-ai";
import { generateCopilotContent, generateQuestionPaperContent } from "./copilot-ai";

/*
 * Deterministic stand-ins for the AI Orchestrator. They exist so every screen is fully
 * interactive without a model provider. In live mode these endpoints are served by the real
 * AI gateway (intent detection → context builder → agent router → tools → validation).
 */

const lower = (s: string) => s.toLowerCase();

/** Very small prompt-injection heuristic, mirroring the server-side guard the real gateway runs. */
export function looksLikeInjection(text: string): boolean {
  return /(ignore (all|previous|prior) (instructions|rules)|system prompt|you are now|reveal (your|the) (prompt|instructions)|developer mode|jailbreak)/i.test(
    text,
  );
}

export function chatReply(agent: string, message: string): ChatReply {
  const m = lower(message);
  if (looksLikeInjection(message)) {
    return {
      agent,
      message:
        "I can't change my instructions or reveal internal configuration. I'm happy to help with your studies, projects or career — what would you like to work on?",
      sources: [],
      confidence: 1,
    };
  }

  if (agent === "knowledge" || agent === "policy" || /placement office|exam application|internal assessment|attendance|register for sports|policy/.test(m)) {
    if (/placement office/.test(m))
      return inst(agent, "The **Training & Placement Office** is in **Block A, Ground Floor, Room A-012**, open 9:30–17:00 on working days.", ["Student Handbook 2026, §4.2"]);
    if (/exam application|exam fee/.test(m))
      return inst(agent, "Exam applications open through the student portal two weeks before each end-semester exam.\n\n1. Log in → **Exams → Apply**\n2. Verify subjects and arrears\n3. Pay the fee online before the deadline (late fee applies after that)\n\nThe current cycle closes on **10 October 2026**.", ["Circular 42/2026 — Exam fee", "Regulations 2021, §11"]);
    if (/internal assessment|ia rules/.test(m))
      return inst(agent, "Internal assessment carries **40 marks**: two IA tests (best of two scaled to 20), assignments (10) and attendance/participation (10). A student who misses an IA for a valid reason may request a retest within 7 days with HOD approval.", ["Internal Assessment Rules (CSE), §2–3"]);
    if (/attendance/.test(m))
      return inst(agent, "A minimum of **75% attendance** per course is required for end-semester exam eligibility. Medical condonation up to 10% may be granted by the Principal with valid documentation.", ["Regulations 2021, §9.1"]);
    if (/sport/.test(m))
      return inst(agent, "Register through **Campus Life → Sports**. Trials for cricket, kabaddi and athletics are open this month; contact the Physical Director at the Sports Office, Ground Floor, Block D.", ["Sports Calendar 2026–27"]);
    if (agent === "policy" || agent === "knowledge")
      return {
        agent,
        message:
          "I couldn't find this in the approved institutional documents, so I won't guess. Please contact the Registrar's office, or ask an administrator to add the relevant policy to the knowledge base.",
        sources: [],
        confidence: 0.4,
      };
  }

  if (/what should i study|study today|today/.test(m))
    return gen(agent, "Here's your focus for today, based on your exam in 9 days and recent quiz results:\n\n1. **25 min — Normalization (3NF & BCNF)**: your weakest topic (42% mastery).\n2. **10-question adaptive quiz** on functional dependencies.\n3. **30 min — Python practice** to keep your streak.\n4. Evening: **HR interview practice** (your interview readiness is 48%).\n\nWant me to add these to your planner?", 0.86);
  if (/scoring low|low score|why am i/.test(m))
    return gen(agent, "Across your last three DBMS assessments, **14 of 23 lost marks** came from Unit 3 (normalization and decomposition). The pattern: you define 3NF correctly but rarely justify a **lossless-join** decomposition.\n\n**Suggested fix:** two worked examples today, then a descriptive practice question that I'll evaluate with the rubric your faculty uses.", 0.81);
  if (/skills|software engineer/.test(m))
    return gen(agent, "For an entry-level **Software Engineer** role at product companies, the most requested skills are:\n\n- Data structures & algorithms\n- One backend language (Java / Python / Go) + REST APIs\n- SQL and database design\n- Git, testing and basic cloud deployment\n- Communication in technical interviews\n\nYou're job-ready in Python; your biggest gaps are **DSA practice** and **interview communication**.", 0.83);
  if (/viva|tomorrow/.test(m) || agent === "viva")
    return gen(agent, "Let's begin. **Question 1:** In one minute, explain the problem Smart Campus AI solves and why an AI approach is appropriate rather than a rules-based system.\n\n_After your answer I'll ask a follow-up on your architecture choices._", 0.9);
  if (/90-day|placement plan/.test(m))
    return gen(agent, "**Your 90-day placement plan**\n\n| Weeks | Focus | Target |\n|---|---|---|\n| 1–4 | DSA (arrays → graphs), SQL | 120 problems |\n| 5–8 | Projects + resume, 2 mock interviews/week | Resume ATS ≥ 80 |\n| 9–12 | Company-specific prep, HR practice | Interview readiness ≥ 75% |\n\nI'll track progress weekly and adjust.", 0.84);
  if (agent === "gd")
    return gen(agent, "**Asha (for):** AI tools can personalise feedback during exams for accessibility needs.\n\n**Vikram (against):** Exams measure individual understanding; AI assistance blurs that.\n\n**Neha (moderator):** Good points. Let's hear from you — take a clear position and support it with one example.", 0.88);
  if (agent === "language")
    return gen(agent, "Let's practise! **Hindi greetings**\n\n- नमस्ते (*namaste*) — Hello\n- आप कैसे हैं? (*aap kaise hain?*) — How are you?\n- मैं ठीक हूँ (*main theek hoon*) — I am fine\n\nNow you try: say *\"Hello, how are you?\"* in Hindi.", 0.92);
  if (agent === "research")
    return gen(agent, "**Possible research questions — IoT for agriculture**\n\n1. Can low-cost capacitive sensors match lab-grade soil-moisture accuracy within ±5%?\n2. How does LoRaWAN coverage affect data completeness in rural Tamil Nadu farms?\n3. Does a vernacular voice interface increase farmer adoption of sensor advice?\n\n_Verify related work in IEEE Xplore or Google Scholar before finalising — I haven't cited specific papers._", 0.72);
  if (/explain|what is|how does/.test(m))
    return gen(agent, `Here's a clear explanation:\n\n**Concept.** ${message.replace(/^(explain|what is|how does)\s*/i, "").slice(0, 120) || "This topic"} is best understood by starting from the problem it solves.\n\n**Example.** Consider a table \`Student(RollNo, Name, DeptId, DeptName)\`. Because \`DeptName\` depends on \`DeptId\` rather than the key, updates can become inconsistent.\n\n**Practice.** Try identifying the functional dependencies in \`Order(OrderId, CustomerId, CustomerCity)\`.\n\nWould you like a quiz on this?`, 0.78);

  return gen(agent, "I can help with that. To give you a precise answer, tell me which subject, project or goal this relates to — or pick one of the suggestions above.", 0.6);
}

function inst(agent: string, message: string, titles: string[]): ChatReply {
  return { agent, message, sources: titles.map((title) => ({ title, kind: "institution" as const })), confidence: 0.93 };
}
function gen(agent: string, message: string, confidence: number): ChatReply {
  return { agent, message, sources: [{ title: "General AI explanation — verify important facts", kind: "general" }], confidence };
}

/* ── generators ─────────────────────────────────── */
export async function generate(module: string, inputs: Record<string, string>): Promise<GenerateReply> {
  const v = (key: string, d = "") => (inputs[key] ?? d).slice(0, 200);
  switch (module) {
    case "study-planner": {
      const days = Math.min(Math.max(parseInt(v("days", "20"), 10) || 20, 3), 90);
      const subjects = v("subjects", "DBMS, Operating Systems, Computer Networks").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
      const hours = Math.min(Math.max(parseInt(v("hours", "4"), 10) || 4, 1), 12);
      const lines = Array.from({ length: Math.min(days, 14) }, (_, i) => {
        const subj = subjects[i % subjects.length] ?? "Revision";
        const kind = i % 5 === 4 ? "Mock test + weak-topic remediation" : i >= days - 2 ? "Quick revision cards" : "New topics + practice";
        return `| Day ${i + 1} | ${subj} | ${kind} | ${hours}h |`;
      });
      return {
        agent: "study-planner",
        markdown: `### Your ${days}-day exam plan\n\n**Subject priority:** ${subjects.join(" → ")} (weakest first)\n\n| Day | Subject | Focus | Time |\n|---|---|---|---|\n${lines.join("\n")}\n${days > 14 ? `| … | … | pattern continues to day ${days} | |\n` : ""}\n**Revision slots:** every 5th day, plus the final 2 days.\n\n**Mock tests:** ${Math.max(1, Math.floor(days / 5))} full-length tests scheduled.\n\n**Final strategy:** last-minute mode switches to formula sheets, flashcards and one timed paper.`,
      };
    }
    case "project-ideas":
      return {
        agent: "project",
        markdown: `### Project concepts — ${v("category", "AI/ML")} · ${v("department", "CSE")}\n\n**1. Smart Attendance with Privacy-Preserving Face Matching**\nOn-device embeddings, no raw images stored. *Feasibility:* high · *Budget:* ₹${v("budget", "5000")} · *Team:* ${v("team", "3")}\n\n**2. Campus Energy Advisor**\nIoT meters + forecasting model recommending HVAC schedules. *Feasibility:* medium\n\n**3. Vernacular Lecture Summariser**\nSpeech-to-text + summarisation for Tamil/Hindi lectures. *Feasibility:* medium\n\n**Next steps:** pick one → problem definition → market research → architecture (I can generate SRS, UML and API design).`,
      };
    case "job-prep":
      return {
        agent: "career",
        markdown: `### ${v("weeks", "8")}-week plan — ${v("role", "Software Engineer")} at a ${lower(v("company", "product company"))}\n\n**Required skills:** DSA, one backend language, SQL, system basics, communication\n\n| Week | Coding | Aptitude | Communication |\n|---|---|---|---|\n| 1–2 | Arrays, strings, hashing | Percentages, ratios | STAR stories ×3 |\n| 3–4 | Trees, graphs | Time & work | Mock HR interview |\n| 5–6 | DP, SQL joins/windows | Puzzles | Technical explanation drill |\n| 7–8 | Company PYQs, mock OAs | Full mocks | 2 full mock interviews |\n\n**Resume:** quantify project impact; add GitHub link.\n**Portfolio:** deploy one project publicly.`,
      };
    case "copilot": {
      const tool = v("tool", "Lesson plan");
      const topic = v("topic", "Database normalization");
      const duration = v("duration", "45");
      const level = v("level", "UG Year 3");
      const markdown = await generateCopilotContent(tool, topic, duration, level);
      return {
        agent: "faculty-copilot",
        markdown,
      };
    }
    case "question-generator": {
      const course = v("course", "CS3492 Database Management Systems");
      const units = v("units", "Units 1–5");
      const marks = v("marks", "50");
      const pattern = v("pattern", "Part A (2 marks) + Part B (13 marks)");
      const markdown = await generateQuestionPaperContent(course, units, marks, pattern);
      return {
        agent: "exam",
        markdown,
      };
    }
    case "event-generator": {
      const brief = v("brief") || v("topic") || "Technology Innovation Summit";
      const title = v("title") || brief.split(/[.\n]/)[0]?.slice(0, 50) || "Campus Tech Initiative";
      const budgetNum = parseInt(v("budget", "150000").replace(/[^0-9]/g, ""), 10) || 150000;
      const audience = v("audience", "500");
      const duration = v("duration", "1 Day");
      const venue = v("venue", "Main Campus Auditorium");
      const type = v("type", "Workshop & Hackathon");
      const dept = v("department", "Computer Science & Engineering");

      const venueCost = Math.round(budgetNum * 0.25).toLocaleString("en-IN");
      const foodCost = Math.round(budgetNum * 0.35).toLocaleString("en-IN");
      const prizesCost = Math.round(budgetNum * 0.20).toLocaleString("en-IN");
      const promoCost = Math.round(budgetNum * 0.12).toLocaleString("en-IN");
      const contingencyCost = Math.round(budgetNum * 0.08).toLocaleString("en-IN");

      return {
        agent: "event",
        markdown: `### ${title} — ${type} (${audience} attendees · ${duration})\n\n` +
          `**Organising Department:** ${dept} | **Venue:** ${venue} | **Total Budget:** ₹${budgetNum.toLocaleString("en-IN")}\n\n` +
          `**Concept & Objective:** ${brief}\n\n` +
          `#### 🕒 Master Schedule\n` +
          `| Time | Session / Activity | Track & Venue | Speaker / Lead |\n` +
          `|---|---|---|---|\n` +
          `| 09:00 - 09:45 | Registration, Welcome Kit & Breakfast | Reception Foyer | Student Volunteers |\n` +
          `| 09:45 - 10:30 | Grand Inauguration, Lamp Lighting & Keynote Address | ${venue} | Chief Guest & Principal |\n` +
          `| 10:45 - 13:00 | Hands-on Technical Deep-Dive / Hack Sprint | Lab 1 & Seminar Hall | Industry Mentors |\n` +
          `| 13:00 - 14:00 | Networking Lunch & Sponsor Showcase | Dining Pavilion | Open to all registered |\n` +
          `| 14:00 - 16:30 | Project Demonstrations & Jury Evaluation | Exhibition Gallery | Faculty & Industry Jury |\n` +
          `| 16:30 - 17:30 | Valedictory, Award Ceremony & Group Photo | ${venue} | Patron & HOD ${dept} |\n\n` +
          `#### 💰 Itemised Financial Allocation (₹${budgetNum.toLocaleString("en-IN")})\n` +
          `- **Venue, Stage & Audio-Visual Production:** ₹${venueCost} (25%)\n` +
          `- **Food, Hospitality & High Tea:** ₹${foodCost} (35%)\n` +
          `- **Cash Awards, Trophies & Mementos:** ₹${prizesCost} (20%)\n` +
          `- **Badges, Kits, Posters & Promotion:** ₹${promoCost} (12%)\n` +
          `- **Contingency & Emergency Logistics Reserve:** ₹${contingencyCost} (8%)\n\n` +
          `#### 📢 Multi-Channel Promotion Kit\n` +
          `- **Email Blast:** Drafted for students & faculty with registration deadline and prerequisite instructions.\n` +
          `- **Social Media Pack:** 3 carousel posts, 1 LinkedIn press release, and WhatsApp broadcast templates ready.\n` +
          `- **Forms:** Student registration form with roll-no validation and post-event feedback survey configured.\n\n` +
          `*AI-generated blueprint. Review and customize before publishing to Campus Events.*`,
      };
    }
    case "document-ai":
      return generateDocumentAi(inputs["task"] || "Create flashcards", inputs["text"] || "");
    default:
      return { agent: module, markdown: "Generated output will appear here." };
  }
}

/* ── descriptive evaluation ─────────────────────── */
const KEY_POINTS: Record<string, Array<[string, RegExp]>> = {
  "dbms-normalization:q5": [
    ["Definition referencing functional dependencies", /functional dependenc|fd|x\s*->|x\s*→|superkey|prime attribute/i],
    ["Mentions transitive dependency", /transitive/i],
    ["Gives an example relation", /\(.*,.*\)|table|relation/i],
    ["Shows a decomposition", /decompos|split|break/i],
    ["Justifies lossless join", /lossless/i],
  ],
  "os-deadlocks:q3": [
    ["Defines a safe state", /safe state|safe sequence/i],
    ["Uses Need = Max − Allocation", /need|max|allocation/i],
    ["Describes Work/Finish vectors", /work|finish/i],
    ["Explains iteration until all finish", /all process|until|repeat/i],
  ],
  "ds-avl:q2": [
    ["Defines AVL tree and Balance Factor formula", /avl|balance factor|height\(left\)|height\(right\)/i],
    ["Explains single rotations (LL and RR)", /ll\s*rotation|rr\s*rotation|single rotation|left rotation|right rotation/i],
    ["Explains double rotations (LR and RL)", /lr\s*rotation|rl\s*rotation|double rotation/i],
    ["Mentions logarithmic O(log n) time complexity", /o\(log\s*n\)|logarithmic|complexity/i],
  ],
  "cn-routing:q4": [
    ["States Bellman-Ford or Distance Vector update rule", /bellman|distance vector|dx\(y\)|routing table/i],
    ["Explains count-to-infinity loop upon link failure", /count[- ]to[- ]infinity|link failure|loop/i],
    ["Describes split horizon or poison reverse mitigation", /split horizon|poison reverse/i],
  ],
  "se-lifecycle:q1": [
    ["Compares iterative/sprint model with sequential waterfall", /agile|waterfall|sprint|iterative|sequential/i],
    ["Addresses requirement changes and adaptability", /requirement|flexib|adapt|change/i],
    ["Covers customer collaboration and testing cycles", /customer|feedback|continuous testing|delivery/i],
  ],
};

export interface RubricCriterionInput {
  criterion: string;
  max: number;
  keywords?: string[];
}

export function evaluateDescriptive(
  testId: string,
  questionId: string,
  answer: string,
  max: number,
  questionText?: string,
  expectedKeywords?: string[],
  customRubric?: RubricCriterionInput[],
): EvaluationResult {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  // 1. Explicit custom rubric provided
  if (customRubric && customRubric.length > 0) {
    const hits: string[] = [];
    const misses: string[] = [];
    const rubric = customRubric.map((r) => {
      const kws =
        r.keywords && r.keywords.length > 0
          ? r.keywords
          : r.criterion
              .toLowerCase()
              .split(/[^a-z0-9_-]+/)
              .filter((w) => w.length > 3 && !["with", "from", "that", "this", "explain", "describe", "show"].includes(w));
      const matched = kws.filter((kw) => answer.toLowerCase().includes(kw.toLowerCase()));
      const ratio = kws.length > 0 ? matched.length / kws.length : words > 25 ? 0.8 : 0.4;
      const awarded = Math.round(r.max * Math.min(1, Math.max(0.2, ratio * 1.1)) * 10) / 10;
      if (ratio >= 0.4) {
        hits.push(r.criterion);
      } else {
        misses.push(r.criterion);
      }
      return { criterion: r.criterion, awarded: Math.min(r.max, awarded), max: r.max };
    });
    const totalScore = Math.min(max, Math.round(rubric.reduce((s, c) => s + c.awarded, 0) * 2) / 2);
    const confidence = Math.round(Math.min(0.96, Math.max(0.55, 0.72 + (hits.length / customRubric.length) * 0.23)) * 100) / 100;
    return {
      score: totalScore,
      max,
      confidence,
      rubric,
      evidence: hits.map((h) => `✓ ${h}`),
      missing: misses,
      feedback:
        misses.length === 0
          ? "Comprehensive and well-structured answer covering all required rubric criteria."
          : `Good attempt. To improve, focus on: ${misses.join("; ")}. Ensure precise technical terms.`,
      reviewRequired: confidence < 0.8 || words < 20,
    };
  }

  // 2. Known test fixture key
  const key = `${testId}:${questionId}`;
  if (KEY_POINTS[key]) {
    const points = KEY_POINTS[key];
    const hits = points.filter(([, re]) => re.test(answer));
    const misses = points.filter(([, re]) => !re.test(answer));
    const coverage = hits.length / points.length;
    const lengthFactor = Math.min(1, words / 60);
    const raw = max * (0.75 * coverage + 0.25 * lengthFactor);
    const scoreVal = Math.round(raw * 2) / 2;
    const confidence = Math.round((words < 15 ? 0.55 : 0.7 + 0.25 * coverage) * 100) / 100;
    const per = max / points.length;
    return {
      score: scoreVal,
      max,
      confidence,
      rubric: points.map(([criterion, re]) => ({ criterion, awarded: re.test(answer) ? Math.round(per * 10) / 10 : 0, max: Math.round(per * 10) / 10 })),
      evidence: hits.map(([c]) => `✓ ${c}`),
      missing: misses.map(([c]) => c),
      feedback:
        misses.length === 0
          ? "Complete answer covering every expected point. Consider tightening the wording."
          : `Good start. To improve, address: ${misses.map(([c]) => c.toLowerCase()).join("; ")}.`,
      reviewRequired: confidence < 0.8 || words < 15,
    };
  }

  // 3. Dynamic evaluation from question text and keywords
  const promptWords = (questionText || "")
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((w) => w.length > 3 && !["explain", "describe", "define", "what", "with", "example", "suitable", "using"].includes(w));
  const combinedKeywords = Array.from(new Set([...(expectedKeywords || []), ...promptWords]));

  const criteria = [
    {
      criterion: "Definition & Core Concept",
      weight: 0.35,
      test: () => words >= 15 && (combinedKeywords.length === 0 || combinedKeywords.some((k) => answer.toLowerCase().includes(k.toLowerCase()))),
    },
    {
      criterion: "Technical Terminology & Accuracy",
      weight: 0.3,
      test: () => {
        const matches = combinedKeywords.filter((k) => answer.toLowerCase().includes(k.toLowerCase())).length;
        return combinedKeywords.length > 0 ? matches >= Math.ceil(combinedKeywords.length * 0.4) : words >= 25;
      },
    },
    {
      criterion: "Illustrative Example / Application",
      weight: 0.25,
      test: () => /example|e\.g\.|for instance|such as|table|diagram|step|code|relation/i.test(answer),
    },
    {
      criterion: "Clarity, Depth & Structure",
      weight: 0.1,
      test: () => words >= 35,
    },
  ];

  const hits: string[] = [];
  const misses: string[] = [];
  const rubric = criteria.map((c) => {
    const passed = c.test();
    const cMax = Math.round(max * c.weight * 10) / 10;
    const awarded = passed ? cMax : Math.round(cMax * 0.3 * 10) / 10;
    if (passed) hits.push(c.criterion);
    else misses.push(c.criterion);
    return { criterion: c.criterion, awarded, max: cMax };
  });

  const totalRaw = rubric.reduce((sum, item) => sum + item.awarded, 0);
  const scoreVal = Math.min(max, Math.round(totalRaw * 2) / 2);
  const confidence = Math.round(Math.min(0.95, Math.max(0.6, 0.7 + (hits.length / criteria.length) * 0.22)) * 100) / 100;

  return {
    score: scoreVal,
    max,
    confidence,
    rubric,
    evidence: hits.map((h) => `✓ Covered ${h.toLowerCase()}`),
    missing: misses.map((m) => `Missing ${m.toLowerCase()}`),
    feedback:
      misses.length === 0
        ? "Well-articulated explanation with solid conceptual depth and relevant examples."
        : `To improve your score, include ${misses.map((m) => m.toLowerCase()).join(" and ")}.`,
    reviewRequired: confidence < 0.8 || words < 20,
  };
}

/* ── interview ──────────────────────────────────── */
const INTERVIEW_QUESTIONS: Record<string, string[]> = {
  technical: [
    "Walk me through a project you're proud of. What was your specific contribution?",
    "What's the difference between a process and a thread? When would you prefer one over the other?",
    "How would you design a URL shortener? Start with the core data model.",
    "Explain database indexing. When can an index make performance worse?",
  ],
  hr: [
    "Tell me about yourself in under two minutes.",
    "Describe a time you disagreed with a teammate. How did you resolve it?",
    "Why do you want to join our company?",
    "Where do you see yourself in three years?",
  ],
  behavioral: [
    "Tell me about a time you failed. What did you learn?",
    "Describe a situation where you had to learn something quickly.",
    "Give an example of when you showed leadership without a formal role.",
  ],
};

export function interviewTurn(mode: string, sessionId: string, index: number, lastAnswer: string | null): InterviewTurn {
  const qs = INTERVIEW_QUESTIONS[mode] ?? INTERVIEW_QUESTIONS.technical!;
  const feedback = lastAnswer === null ? null : answerFeedback(lastAnswer);
  if (index >= qs.length) {
    return {
      sessionId,
      question: "",
      index,
      total: qs.length,
      feedback,
      done: true,
      scorecard: {
        overall: 64,
        dimensions: [
          { name: "Content", score: 70 },
          { name: "Technical accuracy", score: 66 },
          { name: "Clarity", score: 61 },
          { name: "Structure", score: 58 },
          { name: "Confidence indicators", score: 63 },
          { name: "Relevance", score: 72 },
        ],
        strengths: ["Relevant examples from your own projects", "Honest about gaps"],
        improvements: ["Use STAR structure for behavioural answers", "Reduce filler words (\"basically\", \"like\")", "State trade-offs explicitly in design answers"],
      },
    };
  }
  return { sessionId, question: qs[index] ?? "", index, total: qs.length, feedback, done: false, scorecard: null };
}

function answerFeedback(answer: string): string {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const fillers = (answer.match(/\b(basically|like|actually|um|uh)\b/gi) ?? []).length;
  const parts: string[] = [];
  if (words < 25) parts.push("Your answer was brief — add a concrete example.");
  else if (words > 220) parts.push("Good detail, but aim to be more concise (under 2 minutes).");
  else parts.push("Good length and relevance.");
  if (fillers > 1) parts.push(`Noticed ${fillers} filler words.`);
  if (/\b(result|impact|improv|reduc|increas)\w*/i.test(answer)) parts.push("Nice — you mentioned an outcome.");
  else parts.push("Try ending with the result or impact.");
  return parts.join(" ");
}

/* ── resume ─────────────────────────────────────── */
const ROLE_KEYWORDS: Record<string, string[]> = {
  "Software Engineer": ["data structures", "algorithms", "java", "python", "sql", "git", "rest", "api", "testing", "docker"],
  "Data Analyst": ["sql", "excel", "python", "pandas", "power bi", "tableau", "statistics", "dashboard", "visualization"],
  "Data Scientist": ["python", "machine learning", "statistics", "pandas", "scikit-learn", "sql", "deep learning", "visualization"],
};

export function analyzeResume(text: string, role: string): ResumeAnalysis {
  const t = lower(text);
  const keywords = ROLE_KEYWORDS[role] ?? ROLE_KEYWORDS["Software Engineer"]!;
  const found = keywords.filter((kw) => t.includes(kw));
  const missing = keywords.filter((kw) => !t.includes(kw));
  const has = (re: RegExp) => re.test(t);
  const sections: ResumeAnalysis["sections"] = [
    { name: "Contact & links", status: has(/@|linkedin|github/) ? "good" : "missing", note: has(/github/) ? "GitHub link present." : "Add GitHub / portfolio link." },
    { name: "Education", status: has(/b\.?e|b\.?tech|cgpa|university|college/) ? "good" : "missing", note: "Include CGPA and expected graduation." },
    { name: "Skills", status: found.length >= 4 ? "good" : "improve", note: `${found.length} of ${keywords.length} role keywords found.` },
    { name: "Projects", status: has(/project/) ? (has(/\d+%|\d+ users|reduced|improved/) ? "good" : "improve") : "missing", note: "Quantify impact (e.g. \"reduced latency 30%\")." },
    { name: "Experience / internships", status: has(/intern|experience/) ? "good" : "improve", note: "List internships, freelance or open-source work." },
    { name: "Certifications & achievements", status: has(/certif|award|hackathon|winner/) ? "good" : "improve", note: "Add verified certifications and competition results." },
  ];
  const sectionScore = sections.reduce((a, s) => a + (s.status === "good" ? 1 : s.status === "improve" ? 0.5 : 0), 0) / sections.length;
  const atsScore = Math.round(35 + 40 * (found.length / keywords.length) + 25 * sectionScore);
  return {
    atsScore: Math.min(98, atsScore),
    keywordsFound: found,
    keywordsMissing: missing,
    sections,
    suggestions: [
      "Start each bullet with a strong action verb (Built, Designed, Reduced).",
      "Keep to one page for fresher roles; use a simple single-column layout for ATS parsing.",
      missing.length ? `Where genuinely true, mention: ${missing.slice(0, 4).join(", ")}.` : "Keyword coverage is strong for this role.",
      "Avoid tables, text boxes and images — many ATS parsers skip them.",
    ],
  };
}
