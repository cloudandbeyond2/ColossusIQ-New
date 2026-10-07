"use client";

import { Badge } from "@/components/ui/primitives";
import type { Eligibility, TaskTab } from "@/lib/api/exam-prep-schemas";

export const PREP_KEY = ["exam-prep"] as const;
export type Tab = "plan" | "syllabus" | TaskTab;

/** How a tab asks for a test: the endpoint that starts it, its body and the label for "go again". */
export type StartTest = (path: string, body?: unknown, againLabel?: string) => void;
export interface TabProps {
  start: StartTest;
  go: (tab: Tab, opts?: { examId?: string }) => void;
  /** Opens a topic's study notes. */
  study: (topicId: string) => void;
}

const ELIGIBILITY: Record<Eligibility, { label: string; tone: "teal" | "sky" | "amber" | "neutral" }> = {
  eligible: { label: "Eligible", tone: "teal" },
  "eligible-final-year": { label: "Can apply now", tone: "sky" },
  "not-yet": { label: "Not yet eligible", tone: "neutral" },
  "check-notification": { label: "Check notification", tone: "amber" },
};
export function EligibilityBadge({ value }: { value: Eligibility }) {
  const e = ELIGIBILITY[value];
  return <Badge tone={e.tone}>{e.label}</Badge>;
}

export const accTone = (a: number | null) => (a === null ? "neutral" : a >= 75 ? "teal" : a >= 50 ? "amber" : "rose");
