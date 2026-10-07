"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { Round, type RoundResult } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { CatalogueTab } from "./catalogue-tab";
import { CurrentAffairsFeed } from "./current-affairs-feed";
import { NotesView } from "./notes-view";
import { PlanTab } from "./plan-tab";
import { DailyTab, EnglishTab, MocksTab, PracticeTab } from "./practice-tabs";
import { PREP_KEY, type StartTest, type Tab, type TabProps } from "./shared";
import { SyllabusTab } from "./syllabus-tab";
import { ResultView, TestRunner } from "./test-runner";

const TABS: Array<[Tab, string]> = [
  ["plan", "My plan"],
  ["syllabus", "Syllabus & notes"],
  ["daily", "Daily test"],
  ["practice", "Topic practice"],
  ["mocks", "Practice mocks"],
  ["english", "English"],
  ["current-affairs", "Current affairs"],
  ["catalogue", "Exams & eligibility"],
];

type Active = { kind: "running"; round: Round; path: string; body?: unknown; againLabel?: string } | { kind: "result"; result: RoundResult; path: string; body?: unknown; againLabel?: string };

/** Competitive Exam Prep Hub: a personal guide for Indian competitive, eligibility and entrance exams. */
export function ExamPrepHubModule() {
  const [tab, setTab] = useState<Tab>("plan");
  const [examId, setExamId] = useState<string | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studying, setStudying] = useState<string | null>(null);
  const qc = useQueryClient();

  const begin = useMutation({
    mutationFn: (v: { path: string; body?: unknown; againLabel?: string }) => apiFetch(v.path, Round, { method: "POST", body: v.body ?? {} }).then((round) => ({ ...v, round })),
    onSuccess: (v) => {
      setError(null);
      setActive({ kind: "running", round: v.round, path: v.path, body: v.body, againLabel: v.againLabel });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not start the test."),
  });
  const start: StartTest = (path, body, againLabel) => begin.mutate({ path, body, againLabel });
  const exit = () => {
    setActive(null);
    void qc.invalidateQueries({ queryKey: PREP_KEY });
    void qc.invalidateQueries({ queryKey: ["current-affairs"] });
  };
  const go: TabProps["go"] = (t, opts) => {
    setStudying(null);
    setTab(t);
    setExamId(opts?.examId ?? null);
  };
  const study = (topicId: string) => {
    setStudying(topicId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const props: TabProps = { start, go, study };

  if (active?.kind === "running")
    return (
      <TestRunner
        key={active.round.id}
        round={active.round}
        onExit={exit}
        onDone={(result) => {
          setActive({ kind: "result", result, path: active.path, body: active.body, againLabel: active.againLabel });
          void qc.invalidateQueries({ queryKey: PREP_KEY });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  if (studying && !active)
    return (
      <NotesView
        topicId={studying}
        onBack={() => {
          setStudying(null);
          void qc.invalidateQueries({ queryKey: PREP_KEY });
        }}
        onPractise={(topicId) => start("/api/v1/exam-prep/practice", { topicId }, "Another drill")}
        error={error}
        busy={begin.isPending}
      />
    );
  if (active?.kind === "result") {
    const repeatable = active.result.kind === "practice" || active.result.kind === "english" || active.result.kind === "mock";
    return <ResultView result={active.result} onExit={exit} onAgain={repeatable ? () => start(active.path, active.body, active.againLabel) : undefined} againLabel={active.againLabel} />;
  }

  return (
    <div className="space-y-5">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Exam prep sections">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => go(id)} className={cn("rounded-xl px-3 py-1.5 text-sm font-medium transition-colors", tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </Card>
      ) : null}
      {begin.isPending ? (
        <Card className="flex items-center gap-3 p-4 text-sm text-ink-2">
          <Spinner /> Preparing your test…
        </Card>
      ) : null}

      <div role="tabpanel">
        {tab === "plan" ? <PlanTab {...props} /> : null}
        {tab === "syllabus" ? <SyllabusTab {...props} examId={examId} /> : null}
        {tab === "daily" ? <DailyTab {...props} /> : null}
        {tab === "practice" ? <PracticeTab {...props} /> : null}
        {tab === "mocks" ? <MocksTab {...props} /> : null}
        {tab === "english" ? <EnglishTab {...props} /> : null}
        {tab === "current-affairs" ? <CurrentAffairsFeed {...props} /> : null}
        {tab === "catalogue" ? <CatalogueTab {...props} openExam={examId} /> : null}
      </div>
    </div>
  );
}
