"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import type { Role } from "@/lib/auth/roles";
import { apiFetch, ApiError } from "@/lib/api/client";
import { LearningContext, StaffCourseDetail, StaffCourseList, type StaffCourseSummary, type CourseUnit, type EditableQuestion, type Lesson } from "@/lib/api/learning-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { AiLabel } from "@/components/ui/notices";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Spinner, inputClass, toneForStatus } from "@/components/ui/primitives";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { LessonContent } from "@/components/learning/lesson-content";
import { ImageField } from "@/components/crud/image-field";
import { LessonFigure } from "@/components/learning/figure";
import { KIND_LABEL, type Figure } from "@/lib/api/figure-schemas";
import { parseVideoUrl } from "@/lib/video";
import { cn } from "@/lib/utils";

const COURSE_ID = /^LC-[A-F0-9]{8}$/;
const LEVELS = ["Foundation (UG Year 1)", "Intermediate (UG Year 2–3)", "Advanced (UG final / PG)", "Certificate / value-added"] as const;
const STEPS = ["Course details", "Lessons", "Final assessment", "Publish"] as const;
const LETTERS = ["A", "B", "C", "D"];
const SYLLABUS_EXAMPLE = `Unit I: Relational databases
Purpose of database systems – Views of data – Data models
Unit II: Database design
ER model – Functional dependencies – Normalization
Unit III: Transactions
ACID properties – Serializability – Concurrency control`;

export function AiCourseStudioModule({ role }: { role: Role }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const go = (q: string) => router.push(`${pathname}${q}`, { scroll: true });
  const ctx = useQuery({ queryKey: ["learning-context"], queryFn: () => apiFetch("/api/v1/learning/context", LearningContext) });

  if (ctx.isLoading) return <TemplateSkeleton />;
  if (ctx.isError) return <LoadError error={ctx.error} onRetry={() => void ctx.refetch()} />;
  if (!ctx.data?.stream) return <EmptyState title="Choose a college first" body="Courses belong to a department of one college. Switch into a college from the top bar." />;

  const id = params.get("course");
  const step = Math.min(4, Math.max(1, Number(params.get("step")) || 1));
  if (params.get("new") === "1") return <NewCourse ctx={ctx.data} go={go} />;
  if (id && COURSE_ID.test(id)) return <CourseWorkspace id={id} step={step} go={go} role={role} />;
  return <CourseListView go={go} />;
}

/* ─────────────────────────────── stepper ─────────────────────────────── */
function Stepper({ current, onStep, disabled }: { current: number; onStep?: (n: number) => void; disabled?: boolean }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Course steps">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={s}>
            <button
              type="button"
              disabled={disabled || !onStep}
              onClick={() => onStep?.(n)}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                state === "current" ? "border-brand bg-brand-soft font-semibold text-brand" : state === "done" ? "border-teal/40 bg-teal-soft/50 text-ink" : "border-line bg-surface text-ink-3",
                onStep && !disabled && "hover:border-brand/50",
              )}
            >
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", state === "current" ? "bg-brand text-white" : state === "done" ? "bg-teal text-white" : "bg-surface-2 text-ink-3")}>
                {state === "done" ? <Fi name="check" /> : n}
              </span>
              {s}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────── list ─────────────────────────────── */
function CourseListView({ go }: { go: (q: string) => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["studio-courses"], queryFn: () => apiFetch("/api/v1/learning-courses", StaffCourseList) });
  const [toDelete, setToDelete] = useState<StaffCourseSummary | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/learning-courses/${id}?force=1`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-courses"] });
      setToDelete(null);
    },
  });

  if (list.isError) return <LoadError error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isLoading || !list.data) return <TemplateSkeleton />;
  const items = list.data.items;
  const kpis = [
    { label: "Courses", value: items.length, icon: "book-open-cover" },
    { label: "Published to students", value: items.filter((c) => c.status === "Published").length, icon: "paper-plane" },
    { label: "Students learning", value: items.reduce((s, c) => s + c.learners, 0), icon: "users" },
    { label: "Certificates issued", value: items.reduce((s, c) => s + c.certificates, 0), icon: "diploma" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Fi name={k.icon} /> {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink">{k.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Department courses"
          subtitle={list.data.canPublish ? "Create a course, review its lessons and 30-question assessment, then publish it to students." : "Create and edit drafts; your HOD publishes them to students."}
          action={
            <Button onClick={() => go("?new=1")}>
              <Fi name="plus" /> New course
            </Button>
          }
        />
        <CardBody>
          {!items.length ? (
            <EmptyState title="No courses yet" body="Start with a course title or paste your own syllabus." action={<Button onClick={() => go("?new=1")}>New course</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                    <th className="py-2 pr-3 font-medium">Course</th>
                    <th className="py-2 pr-3 font-medium">Built from</th>
                    <th className="py-2 pr-3 font-medium">Lessons</th>
                    <th className="py-2 pr-3 font-medium">Assessment</th>
                    <th className="py-2 pr-3 font-medium">Students</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="py-3 pr-3">
                        <button type="button" onClick={() => go(`?course=${c.id}`)} className="text-left font-medium text-ink hover:text-brand">
                          {c.title}
                        </button>
                        <p className="text-xs text-ink-3">
                          <span className="font-sans tabular-nums">{c.code}</span> · {c.department} · Term {c.semester}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={c.source === "syllabus" ? "sky" : "brand"}>{c.source === "syllabus" ? "Custom syllabus" : "Course title"}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        {c.lessons} <span className="text-ink-3">in {c.units} chapters</span>
                      </td>
                      <td className="py-3 pr-3">
                        {c.questions} questions
                        {c.flagged ? <p className="text-xs text-amber">{c.flagged} to review</p> : null}
                      </td>
                      <td className="py-3 pr-3">
                        {c.learners ? (
                          <>
                            {c.learners} <span className="text-ink-3">· {c.completed} finished</span>
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => go(`?course=${c.id}&step=2`)}>
                            <Fi name="pencil" /> Edit
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => go(`?course=${c.id}`)}>
                            Open <Fi name="arrow-right" />
                          </Button>
                          {list.data.canPublish ? (
                            <Button size="sm" variant="ghost" className="text-rose hover:bg-rose-soft" aria-label={`Delete ${c.title}`} onClick={() => setToDelete(c)}>
                              <Fi name="trash" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {toDelete ? (
        <ConfirmDelete
          open={Boolean(toDelete)}
          recordId={toDelete.id}
          recordName={toDelete.title}
          singular="Course"
          warning="Deleting this course will also delete its curriculum lessons, final assessment, student progress, and attempts."
          busy={remove.isPending}
          error={remove.error instanceof ApiError ? remove.error.message : null}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete.id)}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── step 1: new ─────────────────────────────── */
function NewCourse({ ctx, go }: { ctx: LearningContext; go: (q: string) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ department: ctx.departments[0] ?? "", title: "", level: LEVELS[1] as string, semester: ctx.terms[0] ?? "", credits: 3, faculty: "", mode: "title" as "title" | "syllabus", syllabus: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => apiFetch("/api/v1/learning-courses/generate", StaffCourseDetail, { method: "POST", timeoutMs: 150_000, body: { ...form, syllabus: form.mode === "syllabus" ? form.syllabus : undefined } }),
    onSuccess: (c) => {
      qc.setQueryData(["studio-course", c.id], c);
      qc.invalidateQueries({ queryKey: ["studio-courses"] });
      go(`?course=${c.id}&step=2`);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setError(e.message);
      } else setError("Could not generate the course.");
    },
  });
  const valid = form.title.trim().length >= 3 && form.faculty.trim().length >= 2 && (form.mode === "title" || form.syllabus.trim().length >= 10);

  return (
    <div className="space-y-6">
      <Stepper current={1} />
      <Card>
        <CardHeader title="Course details" subtitle={`${ctx.streamLabel} · choose the department and how the lessons should be built`} action={<Button variant="ghost" size="sm" onClick={() => go("")}>Cancel</Button>} />
        <CardBody>
          <form
            noValidate
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setErrors({});
              if (valid) create.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Department" htmlFor="n-dept" error={errors.department}>
                <select id="n-dept" className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)}>
                  {ctx.departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Course title" htmlFor="n-title" error={errors.title} hint="e.g. Database Management Systems, General Pathology, Financial Accounting">
                <input id="n-title" className={inputClass} maxLength={100} value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Course faculty" htmlFor="n-fac" error={errors.faculty}>
                <input id="n-fac" className={inputClass} maxLength={80} placeholder="Dr. …" value={form.faculty} onChange={(e) => set("faculty", e.target.value)} />
              </Field>
              <Field label="Level" htmlFor="n-level">
                <select id="n-level" className={inputClass} value={form.level} onChange={(e) => set("level", e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Term" htmlFor="n-term" error={errors.semester}>
                <select id="n-term" className={inputClass} value={form.semester} onChange={(e) => set("semester", e.target.value)}>
                  {ctx.terms.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Credits" htmlFor="n-cr">
                <input id="n-cr" type="number" min={1} max={6} className={inputClass} value={form.credits} onChange={(e) => set("credits", Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Build lessons from</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { v: "title" as const, icon: "sparkles", t: "The course title", d: "AI drafts chapters, lessons, key terms, worked examples and practice questions. You review and edit them next." },
                  { v: "syllabus" as const, icon: "document", t: "Our own syllabus", d: "Paste your university syllabus. Each unit becomes a unit, and each topic becomes a lesson." },
                ].map((o) => (
                  <label key={o.v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", form.mode === o.v ? "border-brand bg-brand-soft/60" : "border-line hover:border-brand/40")}>
                    <input type="radio" name="mode" className="mt-1 accent-[var(--brand)]" checked={form.mode === o.v} onChange={() => set("mode", o.v)} />
                    <span>
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <Fi name={o.icon} className="text-brand" /> {o.t}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-3">{o.d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.mode === "syllabus" ? (
              <Field label="Syllabus" htmlFor="n-syl" error={errors.syllabus} hint="Start units with “Unit I:”. Separate topics with “–”, “;” or new lines. Text books and references are ignored.">
                <textarea id="n-syl" rows={10} maxLength={6000} className={cn(inputClass, "font-sans tabular-nums text-[13px]")} placeholder={SYLLABUS_EXAMPLE} value={form.syllabus} onChange={(e) => set("syllabus", e.target.value)} />
              </Field>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              {create.isPending ? <p role="status" className="text-sm text-ink-3">AI is drafting your chapters, lessons and 30 questions — this can take up to a minute. Please keep this page open.</p> : <AiLabel />}
              <Button type="submit" size="lg" disabled={!valid || create.isPending}>
                {create.isPending ? <Spinner /> : <Fi name="sparkles" />} Generate course & continue <Fi name="arrow-right" />
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/* ─────────────────────────────── workspace ─────────────────────────────── */
function CourseWorkspace({ id, step, go, role }: { id: string; step: number; go: (q: string) => void; role: Role }) {
  const course = useQuery({ queryKey: ["studio-course", id], queryFn: () => apiFetch(`/api/v1/learning-courses/${id}`, StaffCourseDetail) });
  const list = useQuery({ queryKey: ["studio-courses"], queryFn: () => apiFetch("/api/v1/learning-courses", StaffCourseList) });
  if (course.isLoading) return <TemplateSkeleton />;
  if (!course.data) return <EmptyState title="Course not found" body={course.error instanceof ApiError ? course.error.message : undefined} action={<Button onClick={() => go("")}>All courses</Button>} />;
  const c = course.data;
  const toStep = (n: number) => go(`?course=${id}&step=${n}`);
  const canPublish = list.data?.canPublish ?? false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => go("")} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-brand">
          <Fi name="arrow-left" /> All courses
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{c.title}</span>
          <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
        </div>
      </div>
      <Stepper current={step} onStep={toStep} />
      {c.status === "Published" && (step === 2 || step === 3) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky/30 bg-sky-soft px-4 py-3 text-sm text-ink-2">
          <span>This course is live for students. You can review, update and save lessons or questions directly.</span>
        </div>
      ) : null}
      {step === 1 ? <DetailsStep course={c} onNext={() => toStep(2)} /> : null}
      {step === 2 ? <LessonsStep key={`l-${c.version}`} course={c} onBack={() => toStep(1)} onNext={() => toStep(3)} /> : null}
      {step === 3 ? <AssessmentStep key={`q-${c.version}`} course={c} onBack={() => toStep(2)} onNext={() => toStep(4)} /> : null}
      {step === 4 ? <PublishStep course={c} canPublish={canPublish} role={role} onBack={() => toStep(3)} onDeleted={() => go("")} goStep={toStep} /> : null}
    </div>
  );
}

function StepFooter({ onBack, onNext, nextLabel = "Next", busy, extra, nextDisabled }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; busy?: boolean; extra?: React.ReactNode; nextDisabled?: boolean }) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-card backdrop-blur">
      <Button variant="secondary" onClick={onBack} disabled={!onBack}>
        <Fi name="arrow-left" /> Back
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {onNext ? (
          <Button onClick={onNext} disabled={busy || nextDisabled}>
            {busy ? <Spinner /> : null} {nextLabel} <Fi name="arrow-right" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DetailsStep({ course: c, onNext }: { course: StaffCourseDetail; onNext: () => void }) {
  const rows: Array<[string, string]> = [
    ["Course code", c.code],
    ["Department", c.department],
    ["Term", c.semester],
    ["Credits", String(c.credits)],
    ["Level", c.level],
    ["Faculty", c.faculty],
    ["Built from", c.source === "syllabus" ? "Custom syllabus" : "Course title (AI draft)"],
    ["Created by", c.createdBy],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Overview" subtitle={c.summary} />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <h4 className="mt-6 text-sm font-semibold text-ink">Curriculum</h4>
            <ol className="mt-2 space-y-2">
              {c.units.map((u, i) => (
                <li key={`${u.title}-${i}`} className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
                  <p className="font-medium text-ink">
                    {chapterLabel(i, c.units.length)} · {u.title}
                  </p>
                  <p className="mt-0.5 text-ink-3">{u.lessons.map((l) => l.title).join(" · ")}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Course outcomes" subtitle="Bloom-mapped, one per unit" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {c.outcomes.map((o) => (
                <li key={o.code} className="rounded-xl border border-line p-3">
                  <span className="font-semibold text-brand">{o.code}</span> <Badge tone="neutral">{o.bloom}</Badge>
                  <p className="mt-1 text-ink-2">{o.text}</p>
                </li>
              ))}
            </ul>
            {c.syllabus ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-ink">Syllabus you provided</summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{c.syllabus}</pre>
              </details>
            ) : null}
          </CardBody>
        </Card>
      </div>
      <StepFooter onNext={onNext} nextLabel="Next: review lessons" />
    </div>
  );
}

/* ─────────────────────────────── step 2: lessons ─────────────────────────────── */
function useSave(courseId: string) {
  const qc = useQueryClient();
  return (data: StaffCourseDetail) => {
    qc.setQueryData(["studio-course", courseId], data);
    qc.invalidateQueries({ queryKey: ["studio-courses"] });
  };
}

function LessonsStep({ course: c, onBack, onNext }: { course: StaffCourseDetail; onBack: () => void; onNext: () => void }) {
  const readOnly = false;
  const store = useSave(c.id);
  const [units, setUnits] = useState<CourseUnit[]>(c.units);
  const [sel, setSel] = useState<{ u: number; l: number }>({ u: 0, l: 0 });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(units) !== JSON.stringify(c.units);

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/learning-courses/${c.id}`, StaffCourseDetail, { method: "PUT", body: {
          version: c.version,
          title: c.title,
          faculty: c.faculty,
          summary: c.summary,
          units: units.map((u) => ({
            title: u.title.trim(),
            lessons: u.lessons.map((l) => ({
              ...l,
              id: l.id || undefined,
              title: l.title.trim(),
              keyPoints: l.keyPoints.map((k) => k.trim()).filter(Boolean),
              videos: (l.videos ?? []).filter((v) => v.url.trim()).map((v) => ({ title: v.title.trim() || "Lecture video", url: v.url.trim() })),
              images: (l.images ?? []).filter((i) => i.ref),
            })),
          })),
        },
      }),
    onSuccess: (d) => {
      store(d);
      setSaved(true);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save."),
  });

  const lesson = units[sel.u]?.lessons[sel.l];
  const patch = (p: Partial<Lesson>) => {
    setSaved(false);
    setUnits((us) => us.map((u, ui) => (ui !== sel.u ? u : { ...u, lessons: u.lessons.map((l, li) => (li === sel.l ? { ...l, ...p } : l)) })));
  };
  const addLesson = (ui: number) => {
    setUnits((us) =>
      us.map((u, i) =>
        i !== ui
          ? u
          : { ...u, lessons: [...u.lessons, { id: "", title: "New lesson", layout: "concepts" as const, minutes: 20, objectives: [], body: "## Introduction\nWrite the lesson content here.\n\n## The key points\n1. …", keyPoints: ["Key point students should remember"] }] },
      ),
    );
    setSel({ u: ui, l: units[ui]!.lessons.length });
  };
  const removeLesson = () => {
    setUnits((us) => us.map((u, ui) => (ui !== sel.u ? u : { ...u, lessons: u.lessons.filter((_, li) => li !== sel.l) })).filter((u) => u.lessons.length));
    setSel({ u: 0, l: 0 });
  };
  const addUnit = () => {
    setUnits((us) => [...us, { title: `Chapter ${us.length}`, lessons: [{ id: "", title: "New lesson", layout: "concepts" as const, minutes: 20, objectives: [], body: "## Introduction\nWrite the lesson content here.", keyPoints: ["Key point students should remember"] }] }]);
    setSel({ u: units.length, l: 0 });
  };
  const next = () => {
    setError(null);
    if (!dirty || readOnly) return onNext();
    save.mutate(undefined, { onSuccess: onNext });
  };
  const count = units.reduce((s, u) => s + u.lessons.length, 0);
  const badLink = units.some((u) => u.lessons.some((l) => (l.videos ?? []).some((v) => v.url.trim() && !parseVideoUrl(v.url))));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Lessons" subtitle={`${count} lessons in ${units.length} chapters`} action={!readOnly ? <Button size="sm" variant="ghost" onClick={addUnit}><Fi name="plus" /> Chapter</Button> : null} />
          <CardBody className="max-h-[65vh] overflow-y-auto">
            {units.map((u, ui) => (
              <div key={ui} className="mb-4">
                {readOnly ? (
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {chapterLabel(ui, units.length)} · {u.title}
                  </p>
                ) : (
                  <input
                    aria-label={`Chapter ${ui} title`}
                    className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3 hover:border-line focus:border-brand focus:outline-none"
                    value={u.title}
                    maxLength={100}
                    onChange={(e) => setUnits((us) => us.map((x, i) => (i === ui ? { ...x, title: e.target.value } : x)))}
                  />
                )}
                <ul className="mt-1">
                  {u.lessons.map((l, li) => (
                    <li key={`${l.id}-${li}`}>
                      <button
                        type="button"
                        onClick={() => setSel({ u: ui, l: li })}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm", sel.u === ui && sel.l === li ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-surface-2")}
                      >
                        <Fi name="document" className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{shortTitle(l.title, u.title)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!readOnly ? (
                  <button type="button" onClick={() => addLesson(ui)} className="mt-1 inline-flex items-center gap-1 px-2 text-xs font-medium text-brand hover:underline">
                    <Fi name="plus" /> Add lesson
                  </button>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>

        {lesson ? (
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                {chapterLabel(sel.u, units.length)} · Lesson {sel.l + 1}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="Editor mode">
                  {[
                    { v: false, t: readOnly ? "Content" : "Edit" },
                    { v: true, t: "Student preview" },
                  ].map((m) => (
                    <button key={m.t} type="button" aria-pressed={preview === m.v} onClick={() => setPreview(m.v)} className={cn("rounded-md px-3 py-1", preview === m.v ? "bg-brand text-white" : "text-ink-2")}>
                      {m.t}
                    </button>
                  ))}
                </div>
                {!readOnly ? (
                  <Button size="sm" variant="ghost" aria-label="Delete lesson" onClick={removeLesson} disabled={count <= 1}>
                    <Fi name="trash" />
                  </Button>
                ) : null}
              </div>
            </div>
            <CardBody className="space-y-4 pt-5">
              {preview || readOnly ? (
                <div>
                  <h3 className="mb-4 text-xl font-semibold text-ink">
                    {lesson.title} <span className="text-xs font-normal text-ink-3">· ~{lesson.minutes} min</span>
                  </h3>
                  <LessonContent lesson={lesson} units={units} chapterIndex={sel.u} />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Field label="Lesson title" htmlFor="le-title">
                      <input id="le-title" className={inputClass} maxLength={120} value={lesson.title} onChange={(e) => patch({ title: e.target.value })} />
                    </Field>
                    <Field label="Minutes" htmlFor="le-min">
                      <input id="le-min" type="number" min={5} max={180} className={inputClass} value={lesson.minutes} onChange={(e) => patch({ minutes: Math.max(5, Math.min(180, Number(e.target.value) || 5)) })} />
                    </Field>
                  </div>
                  <Field
                    label={lesson.layout === "example" ? "Common mistakes (one per line)" : lesson.layout === "practice" ? "Recap checklist (one per line)" : "Key points (one per line)"}
                    htmlFor="le-kp"
                    hint={lesson.layout === "concepts" || !lesson.layout ? "Shown as the concept map. The final assessment asks about these, so write each as a clear statement that doesn't repeat the chapter title." : "Shown as an infographic panel in this lesson."}
                  >
                    <textarea
                      id="le-kp"
                      rows={4}
                      className={inputClass}
                      value={lesson.keyPoints.join("\n")}
                      onChange={(e) => patch({ keyPoints: e.target.value.split("\n").slice(0, 6) })}
                    />
                  </Field>
                  <Field label="Lesson content (Markdown)" htmlFor="le-body" hint="Use ## for headings, 1. for numbered points and - for bullets.">
                    <textarea id="le-body" rows={16} maxLength={8000} className={cn(inputClass, "font-sans tabular-nums text-[13px] leading-relaxed")} value={lesson.body} onChange={(e) => patch({ body: e.target.value })} />
                  </Field>
                  {lesson.terms?.length || lesson.practice?.length ? (
                    <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
                      Also in this lesson: {lesson.terms?.length ? `${lesson.terms.length} key terms` : ""}
                      {lesson.terms?.length && lesson.practice?.length ? " · " : ""}
                      {lesson.practice?.length ? `${lesson.practice.length} practice questions with model answers` : ""} — see them in Student preview.
                    </p>
                  ) : null}
                  <MediaEditor lesson={lesson} patch={patch} />
                </>
              )}
            </CardBody>
          </Card>
        ) : (
          <EmptyState title="Select a lesson" />
        )}
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}
      <StepFooter
        onBack={onBack}
        onNext={next}
        busy={save.isPending}
        nextDisabled={badLink}
        nextLabel={dirty && !readOnly ? "Save & next: final assessment" : "Next: final assessment"}
        extra={
          !readOnly ? (
            <>
              {saved && !dirty ? <span className="text-sm text-teal">Saved</span> : dirty ? <span className="text-sm text-amber">Unsaved changes</span> : null}
              {badLink ? <span className="text-sm text-rose">Fix the highlighted video link</span> : null}
              <Button variant="secondary" disabled={!dirty || save.isPending || badLink} onClick={() => save.mutate()}>
                <Fi name="disk" /> Save
              </Button>
            </>
          ) : null
        }
      />
    </div>
  );
}

/** "Chapter 3", with the orientation and revision chapters named instead of numbered. */
function chapterLabel(index: number, count: number): string {
  return index === 0 ? "Start here" : index === count - 1 ? "Revision" : `Chapter ${index}`;
}

/** Inside a chapter, "Normalization — key concepts" reads better as just "Key concepts". */
function shortTitle(title: string, chapter: string): string {
  const prefix = `${chapter} — `;
  if (!title.startsWith(prefix)) return title;
  const rest = title.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The diagrams the AI drew for a lesson: faculty check each one, fix its title or caption, or remove it. */
function FiguresEditor({ figures, onChange }: { figures: Figure[]; onChange: (f: Figure[]) => void }) {
  if (!figures.length) return null;
  const set = (i: number, p: Partial<Pick<Figure, "title" | "caption">>) => onChange(figures.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Fi name="chart-network" className="text-brand" /> Diagrams
      </p>
      <p className="mt-1 text-xs text-ink-3">Drawn for this lesson by the AI. Check that every label is correct before you publish; remove any diagram that is wrong.</p>
      <div className="mt-3 space-y-3">
        {figures.map((f, i) => (
          <div key={i} className="rounded-xl bg-surface-2/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">{KIND_LABEL[f.kind]}</span>
              <input aria-label={`Diagram ${i + 1} title`} className={cn(inputClass, "min-w-48 flex-1")} maxLength={80} value={f.title} onChange={(e) => set(i, { title: e.target.value })} />
              <Button size="sm" variant="ghost" aria-label={`Remove diagram ${i + 1}`} onClick={() => onChange(figures.filter((_, j) => j !== i))}>
                <Fi name="trash" />
              </Button>
            </div>
            <textarea aria-label={`Diagram ${i + 1} caption`} className={cn(inputClass, "mt-2 min-h-16")} maxLength={300} value={f.caption} placeholder="Caption: how to read this diagram" onChange={(e) => set(i, { caption: e.target.value })} />
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-brand">Preview</summary>
              <LessonFigure figure={f} className="mt-2" />
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Videos (YouTube embeds, NPTEL / SWAYAM links) and images with captions for one lesson. */
function MediaEditor({ lesson, patch }: { lesson: Lesson; patch: (p: Partial<Lesson>) => void }) {
  const videos = lesson.videos ?? [];
  const images = lesson.images ?? [];
  const setVideo = (i: number, v: Partial<{ title: string; url: string }>) => patch({ videos: videos.map((x, j) => (j === i ? { ...x, ...v } : x)) });
  const setImage = (i: number, v: Partial<{ ref: string; caption: string }>) => patch({ images: images.map((x, j) => (j === i ? { ...x, ...v } : x)) });
  return (
    <div className="space-y-5 rounded-2xl border border-line p-4 sm:p-5">
      <FiguresEditor figures={lesson.figures ?? []} onChange={(figures) => patch({ figures })} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Fi name="play-circle" className="text-brand" /> Videos
          </p>
          <Button size="sm" variant="ghost" disabled={videos.length >= 6} onClick={() => patch({ videos: [...videos, { title: "", url: "" }] })}>
            <Fi name="plus" /> Add video
          </Button>
        </div>
        <p className="mt-1 text-xs text-ink-3">Paste a YouTube, NPTEL or SWAYAM link. YouTube videos play inside the lesson; the others open in a new tab.</p>
        <div className="mt-3 space-y-2">
          {videos.map((v, i) => {
            const bad = Boolean(v.url.trim()) && !parseVideoUrl(v.url);
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                <input aria-label={`Video ${i + 1} title`} className={inputClass} placeholder="Title, e.g. NPTEL lecture 12" maxLength={120} value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} />
                <input
                  aria-label={`Video ${i + 1} link`}
                  aria-invalid={bad}
                  className={inputClass}
                  placeholder="https://www.youtube.com/watch?v=…"
                  maxLength={300}
                  inputMode="url"
                  value={v.url}
                  onChange={(e) => setVideo(i, { url: e.target.value })}
                />
                <Button size="sm" variant="ghost" className="self-center" aria-label={`Remove video ${i + 1}`} onClick={() => patch({ videos: videos.filter((_, j) => j !== i) })}>
                  <Fi name="trash" />
                </Button>
                {bad ? <p className="text-xs text-rose sm:col-span-3">Use an https link from YouTube, NPTEL or SWAYAM.</p> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Fi name="picture" className="text-brand" /> Images & diagrams
          </p>
          <Button size="sm" variant="ghost" disabled={images.length >= 6} onClick={() => patch({ images: [...images, { ref: "", caption: "" }] })}>
            <Fi name="plus" /> Add image
          </Button>
        </div>
        <p className="mt-1 text-xs text-ink-3">Upload a PNG, JPEG or WebP (up to 2 MB) — a diagram, a labelled figure or a photo from the lab.</p>
        <div className="mt-3 space-y-3">
          {images.map((img, i) => (
            <div key={i} className="grid items-start gap-2 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <ImageField id={`lesson-img-${i}`} value={img.ref} onChange={(ref) => setImage(i, { ref })} />
              <input aria-label={`Image ${i + 1} caption`} className={inputClass} placeholder="Caption, e.g. Fig 1 — B+ tree with fan-out 3" maxLength={160} value={img.caption} onChange={(e) => setImage(i, { caption: e.target.value })} />
              <Button size="sm" variant="ghost" aria-label={`Remove image ${i + 1}`} onClick={() => patch({ images: images.filter((_, j) => j !== i) })}>
                <Fi name="trash" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── step 3: assessment ─────────────────────────────── */
function AssessmentStep({ course: c, onBack, onNext }: { course: StaffCourseDetail; onBack: () => void; onNext: () => void }) {
  const readOnly = false;
  const store = useSave(c.id);
  const [questions, setQuestions] = useState<EditableQuestion[]>(c.quiz.questions);
  const [passMark, setPassMark] = useState(c.quiz.passMark);
  const [duration, setDuration] = useState(c.quiz.durationMin);
  const [open, setOpen] = useState<number | null>(null);
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(questions) !== JSON.stringify(c.quiz.questions) || passMark !== c.quiz.passMark || duration !== c.quiz.durationMin;
  const flagged = questions.filter((q) => q.review).length;

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/learning-courses/${c.id}/quiz`, StaffCourseDetail, { method: "PUT", body: { version: c.version, passMark, durationMin: duration, questions } }),
    onSuccess: store,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save."),
  });
  const regenerate = useMutation({
    mutationFn: () => apiFetch(`/api/v1/learning-courses/${c.id}/quiz/regenerate`, StaffCourseDetail, { method: "POST", timeoutMs: 120_000 }),
    onSuccess: store,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not regenerate."),
  });

  const update = (i: number, p: Partial<EditableQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const next = () => {
    setError(null);
    if (!dirty || readOnly) return onNext();
    save.mutate(undefined, { onSuccess: onNext });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-ink-3">Questions</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{questions.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-3">To review</p>
          <p className={cn("mt-1 text-2xl font-semibold", flagged ? "text-amber" : "text-teal")}>{flagged}</p>
        </Card>
        <Card className="p-5">
          <label htmlFor="a-pass" className="text-sm text-ink-3">
            Pass mark %
          </label>
          <input id="a-pass" type="number" min={30} max={90} disabled={readOnly} className={cn(inputClass, "mt-1")} value={passMark} onChange={(e) => setPassMark(Math.max(30, Math.min(90, Number(e.target.value) || 30)))} />
        </Card>
        <Card className="p-5">
          <label htmlFor="a-dur" className="text-sm text-ink-3">
            Time (minutes)
          </label>
          <input id="a-dur" type="number" min={10} max={180} disabled={readOnly} className={cn(inputClass, "mt-1")} value={duration} onChange={(e) => setDuration(Math.max(10, Math.min(180, Number(e.target.value) || 10)))} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Final assessment questions"
          subtitle="Built from the lessons' key points and your department question bank. Students see these only after finishing every lesson."
          action={
            !readOnly ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={regenerate.isPending || dirty} title={dirty ? "Save or discard your edits first" : undefined} onClick={() => regenerate.mutate()}>
                  {regenerate.isPending ? <Spinner /> : <Fi name="rotate-right" />} Regenerate from lessons
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={questions.length >= 50}
                  onClick={() => {
                    setQuestions((qs) => [...qs, { prompt: "New question", options: ["Option A", "Option B", "Option C", "Option D"], answer: 0, explanation: "", review: true }]);
                    setOpen(questions.length);
                  }}
                >
                  <Fi name="plus" /> Add question
                </Button>
              </div>
            ) : null
          }
        />
        <CardBody className="space-y-2">
          {flagged && !readOnly ? (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber/40 bg-amber-soft px-4 py-3 text-sm">
              <span className="flex-1 text-ink-2">
                {flagged} question{flagged === 1 ? " is" : "s are"} marked <b>review</b>. Edit them, or confirm you have checked them, before publishing.
              </span>
              <label className="flex items-center gap-2 text-ink">
                <input type="checkbox" className="accent-[var(--brand)]" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> I have checked every question
              </label>
              <Button size="sm" disabled={!attest} onClick={() => setQuestions((qs) => qs.map((q) => ({ ...q, review: false })))}>
                Mark all reviewed
              </Button>
            </div>
          ) : null}
          {questions.map((q, i) => (
            <div key={i} className={cn("rounded-xl border", q.review ? "border-amber/50" : "border-line")}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                <span className="mt-0.5 w-7 shrink-0 text-xs font-semibold text-ink-3">Q{i + 1}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">{q.prompt}</span>
                {q.review ? <Badge tone="amber">Review</Badge> : null}
                <Fi name={open === i ? "angle-small-up" : "angle-small-down"} className="mt-0.5 text-ink-3" />
              </button>
              {open === i ? (
                <div className="space-y-3 border-t border-line px-4 py-4">
                  <label htmlFor={`qp-${i}`} className="sr-only">
                    Question {i + 1}
                  </label>
                  <textarea id={`qp-${i}`} rows={2} maxLength={400} disabled={readOnly} className={inputClass} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((o, k) => (
                      <div key={k} className={cn("flex items-center gap-2 rounded-xl border px-2 py-1.5", q.answer === k ? "border-teal bg-teal-soft" : "border-line")}>
                        <input type="radio" name={`qa-${i}`} disabled={readOnly} aria-label={`Option ${LETTERS[k]} is correct`} className="accent-[var(--teal)]" checked={q.answer === k} onChange={() => update(i, { answer: k })} />
                        <span className="text-xs font-semibold text-ink-3">{LETTERS[k]}</span>
                        <input
                          aria-label={`Option ${LETTERS[k]}`}
                          disabled={readOnly}
                          maxLength={200}
                          className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                          value={o}
                          onChange={(e) => {
                            const opts = [...q.options] as EditableQuestion["options"];
                            opts[k] = e.target.value;
                            update(i, { options: opts });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <input aria-label="Explanation" disabled={readOnly} maxLength={400} className={inputClass} placeholder="Explanation shown after submission" value={q.explanation} onChange={(e) => update(i, { explanation: e.target.value })} />
                  {!readOnly ? (
                    <div className="flex flex-wrap gap-2">
                      {q.review ? (
                        <Button size="sm" variant="secondary" onClick={() => update(i, { review: false })}>
                          <Fi name="check" /> Mark reviewed
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={questions.length <= 10}
                        onClick={() => {
                          setQuestions((qs) => qs.filter((_, j) => j !== i));
                          setOpen(null);
                        }}
                      >
                        <Fi name="trash" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </CardBody>
      </Card>
      {error ? (
        <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}
      <StepFooter
        onBack={onBack}
        onNext={next}
        busy={save.isPending}
        nextLabel={dirty && !readOnly ? "Save & next: publish" : "Next: publish"}
        extra={
          !readOnly ? (
            <>
              {dirty ? <span className="text-sm text-amber">Unsaved changes</span> : null}
              <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                <Fi name="disk" /> Save
              </Button>
            </>
          ) : null
        }
      />
    </div>
  );
}

/* ─────────────────────────────── step 4: publish ─────────────────────────────── */
function PublishStep({
  course: c,
  canPublish,
  role,
  onBack,
  onDeleted,
  goStep,
}: {
  course: StaffCourseDetail;
  canPublish: boolean;
  role: Role;
  onBack: () => void;
  onDeleted: () => void;
  goStep: (n: number) => void;
}) {
  const store = useSave(c.id);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const action = useMutation({
    mutationFn: (what: "publish" | "unpublish") => apiFetch(`/api/v1/learning-courses/${c.id}/${what}`, StaffCourseDetail, { method: "POST" }),
    onSuccess: (d) => {
      store(d);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Action failed."),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/learning-courses/${c.id}?force=1`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-courses"] });
      onDeleted();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed."),
  });

  const checks = [
    { ok: c.lessons > 0, text: `${c.lessons} lessons in ${c.units.length} chapters`, step: 2 },
    { ok: c.quiz.questions.length >= 10, text: `${c.quiz.questions.length} final assessment questions (pass mark ${c.quiz.passMark}%, ${c.quiz.durationMin} min)`, step: 3 },
    { ok: c.flagged === 0, text: c.flagged ? `${c.flagged} question(s) still marked for review` : "Every question reviewed", step: 3 },
  ];
  const ready = checks.every((x) => x.ok);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={c.status === "Published" ? "Live for students" : "Ready to publish?"} subtitle="Students in this college see published courses in My Courses. They read the lessons, then take the final assessment to earn a certificate." />
          <CardBody className="space-y-4">
            <ul className="space-y-2">
              {checks.map((x) => (
                <li key={x.text} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                  <Fi name={x.ok ? "check-circle" : "triangle-warning"} className={cn("text-lg", x.ok ? "text-teal" : "text-amber")} />
                  <span className="flex-1 text-ink">{x.text}</span>
                  {!x.ok ? (
                    <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => goStep(x.step)}>
                      Fix
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {c.status === "Published" ? (
              <div className="rounded-xl border border-teal/30 bg-teal-soft p-4 text-sm text-ink-2">
                Published {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}. {c.learners} student(s) started · {c.completed} finished · {c.certificates} certificate(s) issued.
                {c.courseRecordId ? (
                  <>
                    {" "}
                    Also listed in{" "}
                    <Link href={`/${role}/course-management/${c.courseRecordId}`} className="font-medium text-brand underline">
                      Course Management
                    </Link>
                    .
                  </>
                ) : null}
              </div>
            ) : null}
            {!canPublish ? <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">Only the HOD or Principal can publish courses to students. Your draft is saved; ask your HOD to review and publish it.</p> : null}
            {error ? (
              <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
                {error}
              </p>
            ) : null}
            {canPublish ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {c.status === "Draft" ? (
                  <Button variant="gold" size="lg" disabled={!ready || action.isPending} onClick={() => action.mutate("publish")}>
                    {action.isPending ? <Spinner /> : <Fi name="paper-plane" />} Publish to students
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate("unpublish")}>
                    <Fi name="undo" /> Move back to draft
                  </Button>
                )}
                {confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
                      Confirm delete
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" className="text-rose hover:bg-rose-soft" onClick={() => setConfirmDelete(true)}>
                    <Fi name="trash" /> Delete course
                  </Button>
                )}
              </div>
            ) : null}
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="What students see" />
          <CardBody>
            <ol className="space-y-3 text-sm">
              {[
                ["book-open-cover", `${c.lessons} lessons, read one after another`],
                ["check-circle", "Each lesson is marked complete to unlock the next"],
                ["clipboard-list-check", `${c.quiz.questions.length}-question final assessment, ${c.quiz.durationMin} min, 3 attempts`],
                ["diploma", `Certificate graded O / A+ / A / B / C when they score ${c.quiz.passMark}% or more`],
              ].map(([icon, t], i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Fi name={icon!} />
                  </span>
                  <span className="pt-1 text-ink-2">
                    <b className="text-ink">{i + 1}.</b> {t}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
      <StepFooter onBack={onBack} />
    </div>
  );
}
