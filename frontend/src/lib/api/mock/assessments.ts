import "server-only";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import { getStore } from "@/lib/data";
import { SessionPayload } from "@/lib/auth/session";
import { MockTest, MockTestSummary, TestResult } from "@/lib/api/schemas";
import { MCQ_KEY, MOCK_TESTS, MOCK_TEST_SUMMARIES } from "./fixtures";
import { evaluateDescriptive } from "./ai";
import { cleanText } from "@/lib/security/sanitize";
import { audit } from "./audit";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function loadDynamicAssessments(session: SessionPayload): Promise<MockTestSummary[]> {
  const dynamicSummaries: MockTestSummary[] = [];

  try {
    const qRecords = await getStore().records.all(RESOURCES.questions!, session.college);
    const activeQuestions = qRecords.filter((q) => q.status === "Active" || !q.status);

    if (activeQuestions.length > 0) {
      const grouped = new Map<string, typeof activeQuestions>();
      for (const q of activeQuestions) {
        const topic = String(q.topic || "Question Bank Assessment").trim();
        if (!grouped.has(topic)) grouped.set(topic, []);
        grouped.get(topic)!.push(q);
      }

      for (const [topic, qList] of grouped.entries()) {
        const topicSlug = slugify(topic) || "general";
        const totalMarks = qList.reduce((acc, q) => acc + (typeof q.marks === "number" ? q.marks : 5), 0);
        const estDuration = Math.max(10, Math.min(60, qList.length * 5));
        const diff = typeof qList[0]?.difficulty === "string" ? qList[0].difficulty : "Medium";

        dynamicSummaries.push({
          id: `qb-${topicSlug}`,
          title: topic.toLowerCase().startsWith("question bank") ? topic : `Question Bank: ${topic}`,
          subject: "Question Bank",
          questions: qList.length,
          durationMin: estDuration,
          difficulty: diff,
          lastScore: null,
        });
      }
    }
  } catch (err) {
    console.error("[assessments] Failed to load dynamic question bank assessments:", err);
  }

  return [...dynamicSummaries, ...MOCK_TEST_SUMMARIES];
}

export async function getAssessmentById(id: string, session: SessionPayload): Promise<MockTest | undefined> {
  if (id.startsWith("qb-")) {
    try {
      const qRecords = await getStore().records.all(RESOURCES.questions!, session.college);
      const activeQuestions = qRecords.filter((q) => q.status === "Active" || !q.status);
      const targetSlug = id.replace(/^qb-/, "");

      const matching = activeQuestions.filter((q) => {
        const topic = String(q.topic || "Question Bank Assessment").trim();
        return slugify(topic) === targetSlug;
      });

      if (matching.length > 0) {
        const topicName = String(matching[0]?.topic || "Question Bank Assessment");
        const estDuration = Math.max(10, Math.min(60, matching.length * 5));
        return {
          id,
          title: topicName.toLowerCase().startsWith("question bank") ? topicName : `Question Bank: ${topicName}`,
          subject: "Question Bank",
          durationMin: estDuration,
          questions: matching.map((q, i) => ({
            id: String(q.id || `q-${i + 1}`),
            type: "descriptive" as const,
            prompt: String(q.question),
            marks: typeof q.marks === "number" ? q.marks : 5,
          })),
        };
      }
    } catch (err) {
      console.error("[assessments] Failed to get dynamic assessment:", err);
    }
  }

  return MOCK_TESTS.find((t) => t.id === id);
}

export async function submitAssessmentTest(
  id: string,
  rawAnswers: Record<string, number | string>,
  session: SessionPayload,
): Promise<TestResult | null> {
  const test = await getAssessmentById(id, session);
  if (!test) return null;

  const key = MCQ_KEY[test.id] ?? {};
  let mcqScore = 0;
  let mcqMax = 0;
  const answers: Array<{ questionId: string; correct: boolean | null; explanation: string }> = [];
  const descriptive: Array<any> = [];

  let allQuestions: any[] = [];
  if (id.startsWith("qb-")) {
    try {
      allQuestions = await getStore().records.all(RESOURCES.questions!, session.college);
    } catch {
      allQuestions = [];
    }
  }

  for (const q of test.questions) {
    const given = rawAnswers[q.id];
    if (q.type === "mcq") {
      mcqMax += q.marks;
      const k = key[q.id];
      const correct = typeof given === "number" && k ? given === k.answer : false;
      if (correct) mcqScore += q.marks;
      answers.push({ questionId: q.id, correct, explanation: k?.explanation ?? "" });
    } else {
      const text = typeof given === "string" ? cleanText(given, 8000) : "";
      const qRecord = allQuestions.find((r) => String(r.id) === q.id);
      const modelAnswer = qRecord && typeof qRecord.explanation === "string" ? qRecord.explanation : undefined;
      const keywords = modelAnswer
        ? modelAnswer
            .toLowerCase()
            .split(/[^a-z0-9_-]+/)
            .filter((w: string) => w.length > 3)
        : undefined;

      const evalResult = evaluateDescriptive(test.id, q.id, text, q.marks, q.prompt, keywords);
      descriptive.push({ questionId: q.id, ...evalResult });
      answers.push({
        questionId: q.id,
        correct: null,
        explanation: modelAnswer ? `Model Answer: ${modelAnswer}` : "Evaluated by the Answer Evaluation Agent — see rubric below.",
      });
    }
  }

  await audit(session.name, "Attempted assessment", `${test.title} · ${mcqScore}/${mcqMax} MCQ marks`, {
    collegeId: session.college === ALL_COLLEGES ? null : session.college,
    actorSub: session.sub,
  });

  return {
    attemptId: `att-${Date.now().toString(36)}`,
    mcqScore,
    mcqMax,
    answers,
    descriptive,
    nextActions: [
      "Revise the explanations and rubric notes for any lost marks.",
      "Take the adaptive follow-up quiz on your weakest concept.",
      "Faculty will review descriptive answers for internal assessment records.",
    ],
  };
}
