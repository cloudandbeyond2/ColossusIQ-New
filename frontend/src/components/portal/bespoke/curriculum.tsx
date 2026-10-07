"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
  CATEGORY_LABEL,
  COURSE_CATEGORIES,
  CurriculumDoc,
  CurriculumList,
  Syllabus,
  curriculumWarnings,
  totalCredits,
  type Course,
  type CreateCurriculum,
  type CurriculumData,
} from "@/lib/api/curriculum-schemas";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const LIST = ["curricula"] as const;
const STATUS_TONE = { Draft: "amber", Published: "teal", Archived: "neutral" } as const;
const CAT_COLOR: Record<string, string> = { HS: "bg-rose", BS: "bg-sky", ES: "bg-gold", PC: "bg-brand", PE: "bg-teal", OE: "bg-amber", EEC: "bg-ink-3", MC: "bg-line" };
const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const Ok = z.object({ ok: z.boolean() });

/** Curriculum Studio: the university's programme curricula, prepared and published by the Super Admin. */
export function CurriculumModule({ role }: { role: Role }) {
  const q = useQuery({ queryKey: LIST, queryFn: () => apiFetch("/api/v1/curriculum", CurriculumList) });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  if (openId) return <Editor id={openId} role={role} onBack={() => setOpenId(null)} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-2">
          {d.canEdit
            ? "Prepare each programme's curriculum: courses by semester with credits and L-T-P, then each course's units and outcomes. Publish when it is ready; every college sees it at once."
            : "Your university's published curricula. Open a programme to see each course's syllabus, and plan your teaching from it."}
        </p>
        {d.canEdit ? (
          <Button onClick={() => setCreating((c) => !c)}>
            <Fi name={creating ? "cross-small" : "plus"} /> {creating ? "Close" : "New curriculum"}
          </Button>
        ) : null}
      </div>
      {creating ? <NewCurriculum aiReady={d.aiReady} onCreated={(id) => setOpenId(id)} /> : null}
      {d.curricula.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.curricula.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="card-hover rounded-2xl border border-line bg-surface p-5 text-left">
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Fi name="diploma" />
                </span>
                <Badge tone={STATUS_TONE[c.status]}>
                  {c.status}
                  {c.status === "Published" ? ` · v${c.version}` : ""}
                </Badge>
              </div>
              <p className="mt-3 font-semibold text-ink">{c.programme}</p>
              <p className="text-sm text-ink-3">Regulation {c.regulation}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface-2/60 py-2">
                  <dt className="text-[11px] text-ink-3">Semesters</dt>
                  <dd className="font-semibold text-ink">{c.semesters}</dd>
                </div>
                <div className="rounded-xl bg-surface-2/60 py-2">
                  <dt className="text-[11px] text-ink-3">Courses</dt>
                  <dd className="font-semibold text-ink">{c.courses}</dd>
                </div>
                <div className="rounded-xl bg-surface-2/60 py-2">
                  <dt className="text-[11px] text-ink-3">Credits</dt>
                  <dd className="font-semibold text-ink">{c.credits}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-ink-3">
                  <span>Syllabus written</span>
                  <span>
                    {c.withSyllabus}/{c.courses}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${c.courses ? (c.withSyllabus / c.courses) * 100 : 0}%` }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-3">
                Updated {when(c.updatedAt)} by {c.updatedBy}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No curricula yet" body={d.canEdit ? "Create the first programme curriculum: start blank or let AI draft the course list for you to refine." : "Your university has not published a curriculum here yet."} />
      )}
    </div>
  );
}

function NewCurriculum({ aiReady, onCreated }: { aiReady: boolean; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [b, setB] = useState<CreateCurriculum>({ degree: "B.E.", discipline: "", regulation: `R${new Date().getFullYear()}`, semesters: 8, start: aiReady ? "ai" : "blank", focus: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => apiFetch("/api/v1/curriculum", CurriculumDoc, { method: "POST", body: b }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: LIST });
      qc.setQueryData(["curriculum", r.id], r);
      onCreated(r.id);
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      setError(e instanceof ApiError ? e.message : "Could not create the curriculum.");
    },
  });
  return (
    <Card>
      <CardHeader title="New programme curriculum" />
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[140px_1fr_160px_140px]">
            <Field label="Degree" htmlFor="nc-deg" error={errors.degree}>
              <input id="nc-deg" className={inputClass} value={b.degree} onChange={(e) => setB({ ...b, degree: e.target.value })} list="nc-degrees" />
              <datalist id="nc-degrees">
                {["B.E.", "B.Tech.", "B.Sc.", "B.Com.", "BBA", "BCA", "B.Pharm.", "MBBS", "B.Sc. Nursing", "M.E.", "M.Tech.", "MBA", "MCA", "Diploma"].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Field>
            <Field label="Discipline" htmlFor="nc-dis" error={errors.discipline}>
              <input id="nc-dis" className={inputClass} value={b.discipline} onChange={(e) => setB({ ...b, discipline: e.target.value })} placeholder="Computer Science and Engineering" />
            </Field>
            <Field label="Regulation" htmlFor="nc-reg" error={errors.regulation}>
              <input id="nc-reg" className={inputClass} value={b.regulation} onChange={(e) => setB({ ...b, regulation: e.target.value })} />
            </Field>
            <Field label="Semesters" htmlFor="nc-sem">
              <select id="nc-sem" className={inputClass} value={b.semesters} onChange={(e) => setB({ ...b, semesters: Number(e.target.value) })}>
                {[2, 4, 6, 8, 10].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Start from</p>
            <Segmented label="Start from" value={b.start} onChange={(v) => setB({ ...b, start: v })} options={[{ id: "ai", label: "AI draft of every semester" }, { id: "blank", label: "Blank" }]} />
            {b.start === "ai" && !aiReady ? <p className="text-xs text-amber">No AI provider is switched on. Add a key in AI Providers, or start blank.</p> : null}
          </div>
          {b.start === "ai" ? (
            <Field label="Focus (optional)" htmlFor="nc-focus" hint="e.g. strong on AI and data science, industry internship in semester 7, NEP 2020 multidisciplinary electives">
              <textarea id="nc-focus" className={cn(inputClass, "min-h-20")} maxLength={600} value={b.focus} onChange={(e) => setB({ ...b, focus: e.target.value })} />
            </Field>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending || (b.start === "ai" && !aiReady)}>
            {create.isPending ? <Spinner /> : <Fi name={b.start === "ai" ? "sparkles" : "plus"} />} {create.isPending && b.start === "ai" ? "Drafting the curriculum… this can take a minute" : "Create curriculum"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* ───────────────────────── editor ───────────────────────── */

function Editor({ id, role, onBack }: { id: string; role: Role; onBack: () => void }) {
  const q = useQuery({ queryKey: ["curriculum", id], queryFn: () => apiFetch(`/api/v1/curriculum/${id}`, CurriculumDoc) });
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <EditorBody key={q.data.updatedAt} doc={q.data} role={role} onBack={onBack} />;
}

function EditorBody({ doc, role, onBack }: { doc: CurriculumDoc; role: Role; onBack: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState<CurriculumData>(doc.data);
  const [sem, setSem] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const edit = doc.canEdit;
  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(doc.data), [data, doc.data]);
  const warnings = useMemo(() => curriculumWarnings(data), [data]);
  const credits = totalCredits(data);
  const done = (r: CurriculumDoc, text: string) => {
    qc.setQueryData(["curriculum", r.id], r);
    void qc.invalidateQueries({ queryKey: LIST });
    setMessage({ tone: "ok", text });
  };
  const fail = (e: unknown) => setMessage({ tone: "error", text: e instanceof ApiError ? `${e.message}${Object.keys(e.fields).length ? ` (${Object.entries(e.fields)[0]!.join(": ")})` : ""}` : "Something went wrong." });
  const save = useMutation({ mutationFn: () => apiFetch(`/api/v1/curriculum/${doc.id}`, CurriculumDoc, { method: "PUT", body: { data } }), onSuccess: (r) => done(r, doc.status === "Published" ? `Saved as version ${r.version}. Colleges see the change now.` : "Saved."), onError: fail });
  const status = useMutation({ mutationFn: (a: "publish" | "archive" | "draft") => apiFetch(`/api/v1/curriculum/${doc.id}/${a}`, CurriculumDoc, { method: "POST" }), onSuccess: (r) => done(r, r.status === "Published" ? "Published to every college." : `Moved to ${r.status}.`), onError: fail });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/curriculum/${doc.id}`, Ok, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST });
      onBack();
    },
    onError: fail,
  });
  const semCourses = data.courses.map((c, i) => ({ c, i })).filter(({ c }) => c.semester === sem);
  const semCredits = semCourses.reduce((a, { c }) => a + c.credits, 0);
  const byCat = COURSE_CATEGORIES.map((k) => ({ k, n: data.courses.filter((c) => c.category === k).reduce((a, c) => a + c.credits, 0) })).filter((x) => x.n > 0);
  const setCourse = (i: number, c: Course) => setData({ ...data, courses: data.courses.map((x, j) => (j === i ? c : x)) });
  const addCourse = () => {
    const c: Course = { code: `NEW${String(data.courses.length + 1).padStart(3, "0")}`, title: "New course", semester: sem, category: "PC", l: 3, t: 0, p: 0, credits: 3, units: [], outcomes: [], textbooks: [] };
    setData({ ...data, courses: [...data.courses, c] });
    setOpen(data.courses.length);
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button type="button" onClick={onBack} className="mt-1 rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Back to all curricula">
              <Fi name="arrow-small-left" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-ink">{doc.programme}</h2>
                <Badge tone={STATUS_TONE[doc.status]}>
                  {doc.status} · v{doc.version}
                </Badge>
              </div>
              <p className="text-sm text-ink-3">
                Regulation {doc.regulation} · {data.semesters} semesters · {data.courses.length} courses · {credits} credits
              </p>
            </div>
          </div>
          {edit ? (
            <div className="flex flex-wrap gap-2">
              {doc.status === "Draft" ? (
                <>
                  <Button variant="ghost" onClick={() => window.confirm("Delete this draft curriculum?") && remove.mutate()} disabled={remove.isPending}>
                    <Fi name="trash" /> Delete
                  </Button>
                  <Button onClick={() => window.confirm("Publish to every college? Staff will see it at once.") && status.mutate("publish")} disabled={dirty || status.isPending} title={dirty ? "Save your changes first" : undefined}>
                    <Fi name="paper-plane" /> Publish
                  </Button>
                </>
              ) : doc.status === "Published" ? (
                <>
                  <Button variant="secondary" onClick={() => status.mutate("draft")} disabled={status.isPending}>
                    Unpublish
                  </Button>
                  <Button variant="ghost" onClick={() => window.confirm("Archive this curriculum? It becomes read-only.") && status.mutate("archive")} disabled={status.isPending}>
                    Archive
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        {message ? (
          <p role={message.tone === "error" ? "alert" : "status"} className={cn("mt-4 rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
            {message.text}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0">
          <div role="tablist" aria-label="Semesters" className="flex gap-1 overflow-x-auto border-b border-line p-2">
            {Array.from({ length: data.semesters }, (_, k) => k + 1).map((s) => {
              const cr = data.courses.filter((c) => c.semester === s).reduce((a, c) => a + c.credits, 0);
              const off = cr && (cr < 16 || cr > 28);
              return (
                <button key={s} type="button" role="tab" aria-selected={sem === s} onClick={() => setSem(s)} className={cn("shrink-0 rounded-xl px-3 py-2 text-left text-sm transition", sem === s ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>
                  <span className="block font-medium">Sem {s}</span>
                  <span className={cn("block text-[11px]", sem === s ? "text-white/75" : off ? "text-amber" : "text-ink-3")}>{cr} cr</span>
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Course</th>
                  <th className="px-2 py-2 font-medium">Cat.</th>
                  <th className="px-2 py-2 text-center font-medium">L-T-P</th>
                  <th className="px-2 py-2 text-center font-medium">Credits</th>
                  <th className="px-2 py-2 font-medium">Syllabus</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {semCourses.map(({ c, i }) => (
                  <tr key={i} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-2">{c.code}</td>
                    <td className="px-2 py-2.5 font-medium text-ink">{c.title}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2" title={CATEGORY_LABEL[c.category]}>
                        <span className={cn("size-2 rounded-full", CAT_COLOR[c.category])} />
                        {c.category}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-ink-2">
                      {c.l}-{c.t}-{c.p}
                    </td>
                    <td className="px-2 py-2.5 text-center font-medium text-ink">{c.credits}</td>
                    <td className="px-2 py-2.5">{c.units.length ? <Badge tone="teal">{c.units.length} units</Badge> : <Badge tone="neutral">Not yet</Badge>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        {!edit && doc.status === "Published" ? (
                          <Link href={`/${role}/course-roadmap?curriculum=${doc.id}&course=${c.code}`} className="text-xs font-medium text-brand hover:underline">
                            Plan teaching
                          </Link>
                        ) : null}
                        <button type="button" onClick={() => setOpen(i)} className="text-xs font-medium text-brand hover:underline">
                          {edit ? "Edit" : "View"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!semCourses.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-3">
                      No courses in semester {sem} yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-3">
              Semester {sem}: <b className="text-ink">{semCredits}</b> credits in {semCourses.length} courses
            </span>
            {edit ? (
              <Button size="sm" variant="secondary" onClick={addCourse}>
                <Fi name="plus" /> Add course
              </Button>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Credit mix" subtitle={`${credits} credits in all`} />
            <CardBody className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
                {byCat.map((x) => (
                  <span key={x.k} className={CAT_COLOR[x.k]} style={{ width: `${credits ? (x.n / credits) * 100 : 0}%` }} title={`${x.k}: ${x.n}`} />
                ))}
              </div>
              <ul className="space-y-1 text-xs">
                {byCat.map((x) => (
                  <li key={x.k} className="flex items-center justify-between gap-2 text-ink-2">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", CAT_COLOR[x.k])} />
                      {CATEGORY_LABEL[x.k]}
                    </span>
                    <span className="font-medium text-ink">{x.n}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          {edit ? (
            <Card>
              <CardHeader title="Checks" subtitle={warnings.length ? `${warnings.length} to look at` : "Looks consistent"} />
              <CardBody>
                {warnings.length ? (
                  <ul className="max-h-64 space-y-1.5 overflow-auto text-xs text-ink-2">
                    {warnings.map((w) => (
                      <li key={w} className="flex gap-1.5">
                        <Fi name="exclamation" className="mt-0.5 shrink-0 text-amber" /> {w}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-teal">
                    <Fi name="check-circle" /> No problems found.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}
          {data.programmeOutcomes.length ? (
            <Card>
              <CardHeader title="Programme outcomes" />
              <CardBody>
                <ol className="list-decimal space-y-1 pl-4 text-xs text-ink-2">
                  {data.programmeOutcomes.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {open !== null && data.courses[open] ? (
        <CourseDrawer
          course={data.courses[open]!}
          programme={doc.programme}
          curriculumId={doc.id}
          edit={edit}
          aiReady={doc.aiReady}
          semesters={data.semesters}
          onChange={(c) => setCourse(open, c)}
          onDelete={() => {
            setData({ ...data, courses: data.courses.filter((_, j) => j !== open) });
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {edit && dirty ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-surface p-4 shadow-xl">
          <p className="text-sm text-ink">{doc.status === "Published" ? "Unsaved changes. Saving updates the published curriculum (new version) for every college." : "You have unsaved changes."}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setData(doc.data)} disabled={save.isPending}>
              Discard
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <Fi name="disk" />} Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CourseDrawer({ course, programme, curriculumId, edit, aiReady, semesters, onChange, onDelete, onClose }: { course: Course; programme: string; curriculumId: string; edit: boolean; aiReady: boolean; semesters: number; onChange: (c: Course) => void; onDelete: () => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Course>(k: K, v: Course[K]) => onChange({ ...course, [k]: v });
  const draft = useMutation({
    mutationFn: () => apiFetch(`/api/v1/curriculum/${curriculumId}/syllabus`, Syllabus, { method: "POST", body: { code: course.code, title: course.title, programme, hours: Math.max(15, Math.min(90, (course.l + course.t) * 15 || 45)), notes: "" } }),
    onSuccess: (s) => {
      setError(null);
      onChange({ ...course, units: s.units, outcomes: s.outcomes, textbooks: s.textbooks });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not draft the syllabus."),
  });
  const hours = course.units.reduce((a, u) => a + u.hours, 0);
  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={`${course.code} ${course.title}`} onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-surface p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-3">{course.code}</p>
            <h3 className="text-lg font-semibold text-ink">{course.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <Fi name="cross-small" className="text-lg" />
          </button>
        </div>
        <fieldset disabled={!edit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Code" htmlFor="cd-code">
              <input id="cd-code" className={inputClass} value={course.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} />
            </Field>
            <Field label="Title" htmlFor="cd-title">
              <input id="cd-title" className={inputClass} maxLength={120} value={course.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Field label="Semester" htmlFor="cd-sem">
              <select id="cd-sem" className={inputClass} value={course.semester} onChange={(e) => set("semester", Number(e.target.value))}>
                {Array.from({ length: semesters }, (_, k) => k + 1).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Category" htmlFor="cd-cat">
              <select id="cd-cat" className={inputClass} value={course.category} onChange={(e) => set("category", e.target.value as Course["category"])}>
                {COURSE_CATEGORIES.map((k) => (
                  <option key={k} value={k} title={CATEGORY_LABEL[k]}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            {(["l", "t", "p"] as const).map((k) => (
              <Field key={k} label={k.toUpperCase()} htmlFor={`cd-${k}`}>
                <input id={`cd-${k}`} type="number" min={0} max={12} className={inputClass} value={course[k]} onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            ))}
            <Field label="Credits" htmlFor="cd-cr">
              <input id="cd-cr" type="number" min={0} max={12} step={0.5} className={inputClass} value={course.credits} onChange={(e) => set("credits", Math.max(0, Number(e.target.value) || 0))} />
            </Field>
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-ink">
            Syllabus <span className="text-sm font-normal text-ink-3">· {hours} hours</span>
          </h4>
          {edit ? (
            <Button size="sm" variant="secondary" onClick={() => draft.mutate()} disabled={!aiReady || draft.isPending} title={aiReady ? undefined : "No AI provider is switched on"}>
              {draft.isPending ? <Spinner /> : <Fi name="sparkles" />} {course.units.length ? "Redraft with AI" : "Draft with AI"}
            </Button>
          ) : null}
        </div>
        {draft.isSuccess && edit ? <p className="mt-2 rounded-xl bg-sky-soft px-3 py-2 text-xs text-ink-2">AI drafted this syllabus. Check the units, outcomes and textbooks, then save the curriculum.</p> : null}
        {error ? <p className="mt-2 rounded-xl bg-rose-soft px-3 py-2 text-xs text-rose">{error}</p> : null}
        <fieldset disabled={!edit} className="mt-3 space-y-3">
          {course.units.map((u, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-3">Unit {i + 1}</span>
                <input aria-label={`Unit ${i + 1} title`} className={cn(inputClass, "py-1.5")} value={u.title} onChange={(e) => set("units", course.units.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <input aria-label={`Unit ${i + 1} hours`} type="number" min={0} max={40} className={cn(inputClass, "w-20 py-1.5")} value={u.hours} onChange={(e) => set("units", course.units.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) || 0 } : x)))} />
                {edit ? (
                  <button type="button" className="text-ink-3 hover:text-rose" aria-label={`Remove unit ${i + 1}`} onClick={() => set("units", course.units.filter((_, j) => j !== i))}>
                    <Fi name="trash" />
                  </button>
                ) : null}
              </div>
              <textarea aria-label={`Unit ${i + 1} topics`} className={cn(inputClass, "mt-2 min-h-16 text-xs")} value={u.topics} placeholder="Topics, comma-separated" onChange={(e) => set("units", course.units.map((x, j) => (j === i ? { ...x, topics: e.target.value } : x)))} />
            </div>
          ))}
          {edit && course.units.length < 8 ? (
            <Button size="sm" variant="ghost" onClick={() => set("units", [...course.units, { title: `Unit ${course.units.length + 1}`, topics: "", hours: 9 }])}>
              <Fi name="plus" /> Add unit
            </Button>
          ) : null}
          <Field label="Course outcomes (one per line)" htmlFor="cd-co">
            <textarea id="cd-co" className={cn(inputClass, "min-h-24 text-xs")} value={course.outcomes.join("\n")} onChange={(e) => set("outcomes", lines(e.target.value).slice(0, 8))} />
          </Field>
          <Field label="Textbooks and references (one per line)" htmlFor="cd-tb">
            <textarea id="cd-tb" className={cn(inputClass, "min-h-20 text-xs")} value={course.textbooks.join("\n")} onChange={(e) => set("textbooks", lines(e.target.value).slice(0, 6))} />
          </Field>
        </fieldset>
        <div className="mt-6 flex justify-between gap-2">
          {edit ? (
            <Button variant="ghost" className="text-rose" onClick={() => window.confirm(`Remove ${course.code} from the curriculum?`) && onDelete()}>
              <Fi name="trash" /> Remove course
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={onClose}>{edit ? "Done" : "Close"}</Button>
        </div>
      </div>
    </div>
  );
}
