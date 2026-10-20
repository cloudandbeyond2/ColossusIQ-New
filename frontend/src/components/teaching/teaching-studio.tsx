"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { ILLUSTRATIONS, SavedOutline, StaffSummary, TeachingPack, TeachingSources, type Illustration } from "@/lib/api/teaching-schemas";
import { TopicIllustration } from "@/components/learning/illustration";
import { TemplateSkeleton } from "@/components/modules/shared";
import { AiLabel } from "@/components/ui/notices";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { hostLabel, isReferenceUrl, parseVideoUrl } from "@/lib/video";
import { cn } from "@/lib/utils";
import { InfographicPoster } from "./infographic-poster";
import { SmartBoard } from "./smart-board";

const TABS = [
  { key: "basics", label: "Topic basics", icon: "bulb" },
  { key: "outline", label: "Lesson outline", icon: "list-timeline" },
  { key: "roadmap", label: "Roadmap", icon: "road" },
  { key: "infographic", label: "Infographic", icon: "picture" },
  { key: "board", label: "Smart board", icon: "chalkboard-user" },
  { key: "summary", label: "Class summary", icon: "share" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const LENGTHS = [40, 50, 60, 90, 120];
const ILL_LABEL: Record<Illustration, string> = { flow: "Flow", layers: "Layers", cycle: "Cycle" };

export function TeachingStudioModule() {
  const sources = useQuery({ queryKey: ["teaching-sources"], queryFn: () => apiFetch("/api/v1/teaching/sources", TeachingSources) });
  const [pack, setPack] = useState<TeachingPack | null>(null);
  const [tab, setTab] = useState<TabKey>("basics");
  const [illustration, setIllustration] = useState<Illustration>("flow");
  const [board, setBoard] = useState(false);

  if (sources.isLoading) return <TemplateSkeleton />;
  if (sources.isError) return <LoadError error={sources.error} onRetry={() => void sources.refetch()} />;
  if (!sources.data?.stream) return <EmptyState title="Choose a college first" body="Teaching tools work inside one college. Switch into a college from the top bar." />;

  const openBoard = () => {
    setBoard(true);
    void apiFetch("/api/v1/teaching/events", z.object({ ok: z.boolean() }), { method: "POST", body: { kind: "smartboard_session" } }).catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <Chooser
        sources={sources.data}
        onPack={(p) => {
          setPack(p);
          setIllustration(p.illustration);
          setTab("basics");
        }}
      />

      {!pack ? (
        <Card className="bg-notebook p-10 text-center">
          <span className="bg-brand-gradient mx-auto flex size-14 items-center justify-center rounded-2xl text-2xl text-[#e0b453]">
            <Fi name="chalkboard-user" />
          </span>
          <h3 className="display mt-4 text-2xl text-ink">Everything for one class, in one place</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-2">
            Pick a chapter from your department&apos;s courses or type any topic. You get a plain-language explanation, a timed lesson outline, a semester roadmap, an infographic handout, smart-board slides and a class summary to share with students.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="eyebrow">{pack.source.courseTitle ? `${pack.source.code} · ${pack.source.courseTitle}` : pack.department}</p>
                <h2 className="display mt-1 text-3xl text-ink">{pack.topic}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AiLabel />
                  {pack.draft ? <Badge tone="amber">Generic draft — add your own notes</Badge> : <Badge tone="teal">From your course content</Badge>}
                </div>
              </div>
              <Button variant="gold" size="lg" onClick={openBoard}>
                <Fi name="chalkboard-user" /> Open smart board
              </Button>
            </div>
            <div role="tablist" aria-label="Teaching pack" className="flex gap-1 overflow-x-auto border-t border-line px-3" onKeyDown={(e) => tabKeys(e, tab, setTab)}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  id={`tt-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={`tp-${t.key}`}
                  tabIndex={tab === t.key ? 0 : -1}
                  onClick={() => setTab(t.key)}
                  className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium", tab === t.key ? "border-brand text-brand" : "border-transparent text-ink-3 hover:text-ink")}
                >
                  <Fi name={t.icon} /> {t.label}
                </button>
              ))}
            </div>
          </Card>

          <div role="tabpanel" id={`tp-${tab}`} aria-labelledby={`tt-${tab}`} key={tab} className="animate-fade-up">
            {tab === "basics" ? <BasicsTab pack={pack} illustration={illustration} setIllustration={setIllustration} /> : null}
            {tab === "outline" ? <OutlineTab pack={pack} /> : null}
            {tab === "roadmap" ? <RoadmapTab pack={pack} /> : null}
            {tab === "infographic" ? <InfographicTab pack={pack} illustration={illustration} onShare={() => setTab("summary")} /> : null}
            {tab === "board" ? <BoardTab pack={pack} onOpen={openBoard} /> : null}
            {tab === "summary" ? <SummaryTab pack={pack} illustration={illustration} departments={sources.data.departments} /> : null}
          </div>
          {board ? <SmartBoard pack={{ ...pack, illustration }} onClose={() => setBoard(false)} /> : null}
        </>
      )}
    </div>
  );
}

function tabKeys(e: KeyboardEvent, tab: TabKey, setTab: (t: TabKey) => void) {
  const i = TABS.findIndex((t) => t.key === tab);
  const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const next = TABS[(i + d + TABS.length) % TABS.length]!.key;
  setTab(next);
  document.getElementById(`tt-${next}`)?.focus();
}

/* ─────────────────────────────── chooser ─────────────────────────────── */
function Chooser({ sources, onPack }: { sources: TeachingSources; onPack: (p: TeachingPack) => void }) {
  const [mode, setMode] = useState<"course" | "topic">(sources.courses.length ? "course" : "topic");
  const [courseId, setCourseId] = useState(sources.courses[0]?.id ?? "");
  const course = sources.courses.find((c) => c.id === courseId);
  const [chapter, setChapter] = useState(course?.chapters[0]?.index ?? 1);
  const [topic, setTopic] = useState("");
  const [department, setDepartment] = useState(sources.departments[0] ?? "");
  const [minutes, setMinutes] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const build = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/teaching/pack", TeachingPack, {
        method: "POST",
        body: mode === "course" ? { courseId, chapterIndex: chapter, minutes } : { topic: topic.trim(), department, minutes },
      }),
    onSuccess: (p) => {
      setError(null);
      onPack(p);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not build the teaching pack."),
  });

  return (
    <Card>
      <CardHeader title="What are you teaching?" subtitle="Build a teaching pack for one class" />
      <CardBody>
        <div className="mb-4 inline-flex rounded-xl border border-line p-1 text-sm" role="group" aria-label="Source">
          {[
            ["course", "From a course chapter"],
            ["topic", "Any topic"],
          ].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k as "course" | "topic")} className={cn("rounded-lg px-3 py-1.5", mode === k ? "bg-brand text-white" : "text-ink-2")}>
              {l}
            </button>
          ))}
        </div>
        <form
          className="grid items-end gap-3 md:grid-cols-[1.3fr_1.3fr_150px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            build.mutate();
          }}
        >
          {mode === "course" ? (
            sources.courses.length ? (
              <>
                <Field label="Course" htmlFor="ts-course">
                  <select
                    id="ts-course"
                    className={inputClass}
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      setChapter(sources.courses.find((c) => c.id === e.target.value)?.chapters[0]?.index ?? 1);
                    }}
                  >
                    {sources.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title} {c.status === "Draft" ? "(draft)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Chapter" htmlFor="ts-chapter">
                  <select id="ts-chapter" className={inputClass} value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
                    {course?.chapters.map((ch, i) => (
                      <option key={ch.index} value={ch.index}>
                        {i + 1}. {ch.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <p className="text-sm text-ink-3 md:col-span-2">No courses yet — create one in AI Course Studio, or use “Any topic”.</p>
            )
          ) : (
            <>
              <Field label="Topic" htmlFor="ts-topic" hint="e.g. Deadlocks, Acute inflammation, Depreciation">
                <input id="ts-topic" className={inputClass} maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} />
              </Field>
              <Field label="Department" htmlFor="ts-dept">
                <select id="ts-dept" className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {sources.departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Class length" htmlFor="ts-len">
            <select id="ts-len" className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" size="lg" disabled={build.isPending || (mode === "topic" ? topic.trim().length < 3 : !courseId)}>
            {build.isPending ? <Spinner /> : <Fi name="sparkles" />} Build teaching pack
          </Button>
        </form>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ─────────────────────────────── basics ─────────────────────────────── */
function BasicsTab({ pack, illustration, setIllustration }: { pack: TeachingPack; illustration: Illustration; setIllustration: (i: Illustration) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6 sm:p-8">
          <p className="eyebrow flex items-center gap-2">
            <Fi name="bulb" className="text-gold" /> What it is — in plain words
          </p>
          <p className="display mt-4 text-[1.6rem] leading-snug text-ink sm:text-[1.9rem]">{pack.basics.what}</p>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">Why it matters</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{pack.basics.why}</p>
          </Card>
          <Card className="p-5">
            <p className="eyebrow">Before you start</p>
            <ul className="mt-2 space-y-1.5 text-[14px] text-ink-2">
              {pack.basics.before.map((b) => (
                <li key={b} className="flex gap-2">
                  <Fi name="arrow-small-right" className="mt-1 text-brand" /> {b}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow flex items-center gap-2">
            <Fi name="chart-network" className="text-gold" /> The idea in one picture
          </p>
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="Illustration style">
            {ILLUSTRATIONS.map((k) => (
              <button key={k} type="button" aria-pressed={illustration === k} onClick={() => setIllustration(k)} className={cn("rounded-md px-3 py-1", illustration === k ? "bg-brand text-white" : "text-ink-2")}>
                {ILL_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <TopicIllustration title={pack.topic} points={pack.keyPoints} kind={illustration} />
        </div>
        <p className="mt-4 text-xs text-ink-3">The same picture appears on the smart board and in the infographic handout.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="eyebrow">The big idea in {pack.basics.bigIdea.length} points</p>
          <ol className="mt-4 space-y-3">
            {pack.basics.bigIdea.map((p, i) => (
              <li key={p} className="flex gap-3 text-[14.5px] leading-relaxed text-ink">
                <span className="display-italic font-display text-3xl leading-none text-gold">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="eyebrow">Words to know</p>
          {pack.terms.length ? (
            <dl className="mt-4 space-y-3">
              {pack.terms.map((t) => (
                <div key={t.term}>
                  <dt className="font-semibold text-ink">{t.term}</dt>
                  <dd className="text-[13.5px] leading-relaxed text-ink-2">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-3">No key terms for this topic yet — add them in AI Course Studio.</p>
          )}
        </Card>
      </div>

      {pack.example ? (
        <Card className="p-5 sm:p-7">
          <p className="eyebrow mb-3">Worked example</p>
          <SafeMarkdown className="lesson-content text-[15px] leading-7">{pack.example}</SafeMarkdown>
        </Card>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── outline ─────────────────────────────── */
function OutlineTab({ pack }: { pack: TeachingPack }) {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["teaching-outlines"], queryFn: () => apiFetch("/api/v1/teaching/outlines", z.array(SavedOutline)) });
  const [msg, setMsg] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/teaching/outlines", SavedOutline, {
        method: "POST",
        body: { topic: pack.topic, courseTitle: pack.source.courseTitle ?? null, minutes: pack.outline.minutes, blocks: pack.outline.blocks },
      }),
    onSuccess: () => {
      setMsg("Outline saved.");
      void qc.invalidateQueries({ queryKey: ["teaching-outlines"] });
      void qc.invalidateQueries({ queryKey: ["booster"] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Could not save."),
  });
  const total = pack.outline.minutes;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <Card className="print-area p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Lesson outline · {total} minutes</p>
            <h3 className="display mt-1 text-2xl text-ink">{pack.topic}</h3>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="secondary" onClick={() => window.print()}>
              <Fi name="print" /> Print
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <Fi name="disk" />} Save outline
            </Button>
          </div>
        </div>
        {msg ? (
          <p role="status" className="mt-2 text-sm text-teal">
            {msg}
          </p>
        ) : null}
        {/* minute bar */}
        <div className="mt-6 flex h-3 overflow-hidden rounded-full" aria-hidden>
          {pack.outline.blocks.map((b, i) => (
            <span key={b.title} style={{ width: `${(b.minutes / total) * 100}%`, background: ["#4a5bd4", "#2f9e93", "#8b74ec", "#c8952c", "#4f93d8", "#c85672"][i % 6] }} />
          ))}
        </div>
        <ol className="relative mt-6 space-y-4 border-l-2 border-line pl-6">
          {pack.outline.blocks.map((b, i) => (
            <li key={b.title} className="relative">
              <span className="absolute -left-[37px] flex size-6 items-center justify-center rounded-full border-2 border-bg font-sans tabular-nums text-[10px] text-white" style={{ background: ["#4a5bd4", "#2f9e93", "#8b74ec", "#c8952c", "#4f93d8", "#c85672"][i % 6] }}>
                {i + 1}
              </span>
              <div className="rounded-2xl border border-line bg-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <Fi name={b.icon} className="text-brand" /> {b.title}
                  </p>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-sans tabular-nums text-[11px] text-ink-2">
                    {b.start}–{b.start + b.minutes} min · {b.minutes} min
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-[13.5px] leading-relaxed sm:grid-cols-2">
                  <p>
                    <span className="eyebrow block !text-[10px]">Teacher</span>
                    <span className="text-ink">{b.teacher}</span>
                  </p>
                  <p>
                    <span className="eyebrow block !text-[10px]">Students</span>
                    <span className="text-ink-2">{b.students}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <p className="eyebrow">Materials</p>
          <ul className="mt-3 space-y-2 text-[13.5px] text-ink-2">
            {pack.outline.materials.map((m) => (
              <li key={m} className="flex gap-2">
                <Fi name="check" className="mt-1 text-teal" /> {m}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Exit ticket</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13.5px] text-ink">
            {pack.outline.exitTicket.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Saved outlines</p>
          {saved.data?.length ? (
            <ul className="mt-3 space-y-2 text-[13px]">
              {saved.data.slice(0, 6).map((o) => (
                <li key={o.id} className="flex justify-between gap-2 border-b border-dashed border-line pb-2 last:border-0">
                  <span className="text-ink">{o.topic}</span>
                  <span className="shrink-0 font-sans tabular-nums text-ink-3">{o.minutes} min</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-3">None yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────── roadmap ─────────────────────────────── */
const KIND_STYLE: Record<string, { tone: string; label: string; icon: string }> = {
  orientation: { tone: "bg-sky-soft text-sky", label: "Orientation", icon: "compass-alt" },
  teach: { tone: "bg-brand-soft text-brand", label: "Teach", icon: "chalkboard-user" },
  assessment: { tone: "bg-amber-soft text-amber", label: "Assessment", icon: "clipboard-list-check" },
  revision: { tone: "bg-teal-soft text-teal", label: "Revision", icon: "book-open-cover" },
  final: { tone: "bg-gold-soft text-gold", label: "Final", icon: "diploma" },
};

function RoadmapTab({ pack }: { pack: TeachingPack }) {
  const weeks = pack.roadmap.weeks;
  return (
    <Card className="print-area p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Teaching roadmap</p>
          <h3 className="display mt-1 text-2xl text-ink">{pack.roadmap.title}</h3>
        </div>
        <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
          <Fi name="print" /> Print
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(KIND_STYLE).map(([k, s]) => (
          <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium", s.tone)}>
            <Fi name={s.icon} /> {s.label}
          </span>
        ))}
      </div>
      <ol className="relative mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {weeks.map((w) => {
          const s = KIND_STYLE[w.kind]!;
          return (
            <li key={w.week} className={cn("relative rounded-2xl border p-4", w.current ? "border-brand bg-brand-soft/60 ring-2 ring-brand/30" : "border-line bg-bg")}>
              {w.current ? <span className="absolute -top-3 right-4 rounded-full bg-brand px-2.5 py-0.5 font-sans tabular-nums text-[10px] uppercase tracking-wider text-white">You are here</span> : null}
              <div className="flex items-center justify-between">
                <span className="font-sans tabular-nums text-[11px] text-ink-3">{pack.source.kind === "course" ? `WEEK ${w.week}` : `SESSION ${w.week}`}</span>
                <span className={cn("flex size-7 items-center justify-center rounded-lg", s.tone)}>
                  <Fi name={s.icon} />
                </span>
              </div>
              <p className="mt-2 font-semibold leading-snug text-ink">{w.title}</p>
              <ul className="mt-2 space-y-1 text-[12.5px] text-ink-2">
                {w.items.map((it) => (
                  <li key={it}>· {it}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ─────────────────────────────── infographic ─────────────────────────────── */
function posterFrom(pack: TeachingPack, illustration: Illustration) {
  return {
    topic: pack.topic,
    department: pack.department,
    courseTitle: pack.source.courseTitle ?? null,
    what: pack.basics.what,
    keyPoints: pack.keyPoints.slice(0, 5),
    terms: pack.terms.slice(0, 4),
    mistakes: pack.mistakes.slice(0, 3),
    illustration,
    question: pack.practice[0] ?? null,
  };
}

function InfographicTab({ pack, illustration, onShare }: { pack: TeachingPack; illustration: Illustration; onShare: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">A one-page lesson handout. Print it for class, or attach it to the class summary so students can revise from it.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Fi name="print" /> Print / save as PDF
          </Button>
          <Button onClick={onShare}>
            <Fi name="share" /> Share with students
          </Button>
        </div>
      </div>
      <InfographicPoster data={posterFrom(pack, illustration)} className="mx-auto max-w-4xl" />
    </div>
  );
}

/* ─────────────────────────────── smart board ─────────────────────────────── */
function BoardTab({ pack, onOpen }: { pack: TeachingPack; onOpen: () => void }) {
  const slides = ["Title", "Today's plan", "Topic basics", "The idea in one picture", "Key points", pack.terms.length ? "Key terms" : "", pack.example ? "Worked example" : "", pack.mistakes.length ? "Watch out" : "", ...pack.practice.map((_, i) => `Check ${i + 1}`), "Summary & exit ticket"].filter(Boolean);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card className="overflow-hidden">
        <div className="relative flex aspect-video flex-col justify-center overflow-hidden p-8 text-white" style={{ background: "radial-gradient(900px 400px at 80% -10%, #2a3a8a66, transparent), #0f1530" }}>
          <p className="font-sans tabular-nums text-xs uppercase tracking-[0.12em] text-[#e0b453]">{pack.department}</p>
          <p className="display mt-3 text-4xl sm:text-5xl">{pack.topic}</p>
          <svg className="absolute bottom-6 right-6 h-24 w-40 opacity-70" viewBox="0 0 160 90" aria-hidden>
            <path d="M8 70 C 40 20, 70 80, 100 36 S 150 30, 152 12" fill="none" stroke="#ffd54a" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-ink-2">{slides.length} slides · pen, highlighter and eraser · night, chalkboard and whiteboard styles</p>
          <Button variant="gold" size="lg" onClick={onOpen}>
            <Fi name="play" /> Present now
          </Button>
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <p className="eyebrow">Slides</p>
          <ol className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
            {slides.map((s, i) => (
              <li key={s} className="rounded-lg bg-surface-2 px-3 py-2 text-ink-2">
                <span className="font-sans tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span> {s}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Classroom controls</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2">
            <li>
              <kbd className="rounded border border-line px-1.5 font-mono text-xs">→</kbd> / <kbd className="rounded border border-line px-1.5 font-mono text-xs">Space</kbd> next slide ·{" "}
              <kbd className="rounded border border-line px-1.5 font-mono text-xs">←</kbd> previous
            </li>
            <li>
              <kbd className="rounded border border-line px-1.5 font-mono text-xs">P</kbd> pen on/off · draw with a mouse, touch screen or stylus
            </li>
            <li>
              <kbd className="rounded border border-line px-1.5 font-mono text-xs">Esc</kbd> close · full-screen button for the projector
            </li>
            <li>Drawings are kept per slide while you present.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────── class summary ─────────────────────────────── */
function SummaryTab({ pack, illustration, departments }: { pack: TeachingPack; illustration: Illustration; departments: string[] }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const initialResources = [...pack.videos.map((v) => ({ label: v.title, url: v.url })), ...pack.links].slice(0, 6);
  const [form, setForm] = useState({
    title: `Class summary — ${pack.topic}`,
    date: today,
    department: departments.includes(pack.department) ? pack.department : (departments[0] ?? ""),
    points: pack.keyPoints.join("\n"),
    homework: pack.practice[1]?.q ?? pack.practice[0]?.q ?? "",
    nextClass: pack.nextTopic ?? "",
    attach: true,
  });
  const [resources, setResources] = useState(initialResources);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const shared = useQuery({ queryKey: ["teaching-summaries"], queryFn: () => apiFetch("/api/v1/teaching/summaries", z.array(StaffSummary)) });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const share = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/teaching/summaries", z.object({ id: z.string() }), {
        method: "POST",
        body: {
          title: form.title,
          topic: pack.topic,
          department: form.department,
          courseTitle: pack.source.courseTitle ?? null,
          date: form.date,
          points: form.points.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 10),
          homework: form.homework,
          nextClass: form.nextClass,
          resources,
          infographic: form.attach
            ? {
                what: pack.basics.what,
                keyPoints: pack.keyPoints.slice(0, 5),
                terms: pack.terms.slice(0, 4),
                mistakes: pack.mistakes.slice(0, 3),
                illustration,
                question: pack.practice[0] ?? null,
              }
            : null,
        },
      }),
    onSuccess: () => {
      setMsg({ ok: true, text: "Shared. Students in this college can now read it in Class Notes." });
      void qc.invalidateQueries({ queryKey: ["teaching-summaries"] });
      void qc.invalidateQueries({ queryKey: ["booster"] });
    },
    onError: (e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Could not share." }),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/teaching/summaries/${id}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["teaching-summaries"] }),
  });
  const linkOk = !newLink.url || isReferenceUrl(newLink.url) || parseVideoUrl(newLink.url) !== null;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader title="Share a class summary" subtitle="What you covered, the homework and where to revise — sent to your students' Class Notes." />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setMsg(null);
              share.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
              <Field label="Title" htmlFor="cs-title">
                <input id="cs-title" className={inputClass} maxLength={140} value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Class date" htmlFor="cs-date">
                <input id="cs-date" type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
            </div>
            <Field label="Share with" htmlFor="cs-dept" hint="Students of this department see it first in their Class Notes.">
              <select id="cs-dept" className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)}>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="What we covered (one point per line)" htmlFor="cs-points">
              <textarea id="cs-points" rows={5} className={inputClass} value={form.points} onChange={(e) => set("points", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Homework" htmlFor="cs-hw">
                <textarea id="cs-hw" rows={3} maxLength={600} className={inputClass} value={form.homework} onChange={(e) => set("homework", e.target.value)} />
              </Field>
              <Field label="Next class" htmlFor="cs-next">
                <textarea id="cs-next" rows={3} maxLength={200} className={inputClass} value={form.nextClass} onChange={(e) => set("nextClass", e.target.value)} />
              </Field>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Resources</p>
              <ul className="mt-2 space-y-1.5">
                {resources.map((r, i) => (
                  <li key={r.url} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px]">
                    <Fi name={hostLabel(r.url) === "YouTube" ? "play-circle" : "globe"} className="text-brand" />
                    <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
                    <span className="font-sans tabular-nums text-[10.5px] text-ink-3">{hostLabel(r.url)}</span>
                    <button type="button" aria-label={`Remove ${r.label}`} className="text-ink-3 hover:text-rose" onClick={() => setResources((rs) => rs.filter((_, j) => j !== i))}>
                      <Fi name="cross-small" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <input aria-label="Resource name" placeholder="Name" className={inputClass} maxLength={120} value={newLink.label} onChange={(e) => setNewLink((l) => ({ ...l, label: e.target.value }))} />
                <input aria-label="Resource link" aria-invalid={!linkOk} placeholder="https://www.youtube.com/watch?v=…" className={inputClass} maxLength={400} value={newLink.url} onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))} />
                <Button
                  variant="secondary"
                  disabled={!newLink.url || !newLink.label.trim() || !linkOk || resources.length >= 8}
                  onClick={() => {
                    setResources((rs) => [...rs, { label: newLink.label.trim(), url: newLink.url.trim() }]);
                    setNewLink({ label: "", url: "" });
                  }}
                >
                  Add
                </Button>
              </div>
              {!linkOk ? <p className="mt-1 text-xs text-rose">Use an https link from YouTube, NPTEL, SWAYAM or Wikipedia.</p> : null}
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" checked={form.attach} onChange={(e) => set("attach", e.target.checked)} />
              <span>
                <span className="font-medium text-ink">Attach the infographic lesson</span>
                <span className="block text-xs text-ink-3">Students get the one-page handout with the illustration, key terms and a quick check.</span>
              </span>
            </label>
            {msg ? (
              <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-teal-soft text-teal" : "bg-rose-soft text-rose")}>
                {msg.text}
              </p>
            ) : null}
            <Button type="submit" size="lg" variant="gold" disabled={share.isPending || !form.points.trim()}>
              {share.isPending ? <Spinner /> : <Fi name="paper-plane" />} Share with students
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Shared summaries" subtitle="Read counts update as students open them" />
        <CardBody>
          {shared.data?.length ? (
            <ul className="space-y-3">
              {shared.data.map((s) => (
                <li key={s.id} className="rounded-xl border border-line p-3">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-ink-3">
                    {s.date} · {s.department} {s.infographic ? "· infographic attached" : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs text-teal">
                      <Fi name="eye" /> Read by {s.readCount} student{s.readCount === 1 ? "" : "s"}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(s.id)}>
                      Withdraw
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Nothing shared yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
