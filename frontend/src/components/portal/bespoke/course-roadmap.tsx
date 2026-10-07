"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Unit } from "@/lib/api/curriculum-schemas";
import { METHODS, Roadmap, RoadmapBoard, type CreateRoadmap, type Session } from "@/lib/api/roadmap-schemas";
import { cn } from "@/lib/utils";

const KEY = ["course-roadmap"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const fmt = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", o);
const METHOD_ICON: Record<string, string> = { Lecture: "chalkboard-user", Tutorial: "users-alt", Lab: "flask", Activity: "puzzle-alt", Assessment: "edit", Revision: "refresh" };

/** Course Roadmap: plan a course session by session from its syllabus, and track what has been taught. */
export function CourseRoadmapModule() {
  const params = useSearchParams();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/course-roadmap", RoadmapBoard) });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(() => !!params.get("course"));
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  if (openId) return <RoadmapView id={openId} onBack={() => setOpenId(null)} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-2">Pick a course and the days you teach it; the roadmap spreads the syllabus over dated sessions with tutorials, internal assessments and revision. Tick sessions off as you teach.</p>
        {d.roadmaps.length < d.max ? (
          <Button onClick={() => setCreating((c) => !c)}>
            <Fi name={creating ? "cross-small" : "plus"} /> {creating ? "Close" : "New roadmap"}
          </Button>
        ) : null}
      </div>
      {creating ? <NewRoadmap board={d} preset={{ curriculumId: params.get("curriculum"), course: params.get("course") }} onCreated={(id) => setOpenId(id)} /> : null}
      {d.roadmaps.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.roadmaps.map((r) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="card-hover rounded-2xl border border-line bg-surface p-5 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-3">{r.courseCode || "Own course"}</p>
                    <p className="truncate font-semibold text-ink">{r.title}</p>
                    {r.section ? <p className="text-xs text-ink-3">{r.section}</p> : null}
                  </div>
                  <ProgressRing pct={pct} />
                </div>
                <p className="mt-3 text-xs text-ink-3">
                  {fmt(r.startDate, { day: "numeric", month: "short" })} – {fmt(r.endDate, { day: "numeric", month: "short", year: "numeric" })} · {r.done}/{r.total} sessions
                </p>
                {r.overdue ? (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-soft px-2 py-1 text-xs font-medium text-amber">
                    <Fi name="clock" /> {r.overdue} session{r.overdue === 1 ? "" : "s"} behind
                  </p>
                ) : r.next ? (
                  <p className="mt-2 text-xs text-ink-2">
                    Next: <b className="text-ink">{fmt(r.next.date)}</b> · {r.next.topic}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-teal">Course completed</p>
                )}
              </button>
            );
          })}
        </div>
      ) : !creating ? (
        <EmptyState title="No roadmaps yet" body="Create one for each course and section you teach this semester." />
      ) : null}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0" role="img" aria-label={`${pct}% covered`}>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-surface-2" />
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-teal" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" className="fill-ink text-[11px] font-semibold">
        {pct}%
      </text>
    </svg>
  );
}

function NewRoadmap({ board, preset, onCreated }: { board: RoadmapBoard; preset: { curriculumId: string | null; course: string | null }; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const firstSource = board.sources.find((s) => s.curriculumId === preset.curriculumId) ?? board.sources[0];
  const [from, setFrom] = useState<"curriculum" | "custom">(board.sources.length ? "curriculum" : "custom");
  const [curriculumId, setCurriculumId] = useState(firstSource?.curriculumId ?? "");
  const [courseCode, setCourseCode] = useState(preset.course && firstSource?.courses.some((c) => c.code === preset.course) ? preset.course : (firstSource?.courses[0]?.code ?? ""));
  const [custom, setCustom] = useState<{ title: string; units: Unit[] }>({ title: "", units: [{ title: "Unit 1", topics: "", hours: 9 }] });
  const [section, setSection] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [withAssessments, setWithAssessments] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const source = board.sources.find((s) => s.curriculumId === curriculumId);
  const create = useMutation({
    mutationFn: () => {
      const body: CreateRoadmap = from === "curriculum" ? { curriculumId, courseCode, custom: null, section, startDate, weekdays, withAssessments } : { curriculumId: null, courseCode: "", custom, section, startDate, weekdays, withAssessments };
      return apiFetch("/api/v1/course-roadmap", Roadmap, { method: "POST", body });
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: KEY });
      qc.setQueryData([...KEY, r.id], r);
      onCreated(r.id);
    },
    onError: (e) => setErrors(e instanceof ApiError ? { ...e.fields, _: e.message } : { _: "Could not create the roadmap." }),
  });
  const course = source?.courses.find((c) => c.code === courseCode);
  return (
    <Card>
      <CardHeader title="New course roadmap" />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Segmented label="Course from" value={from} onChange={setFrom} options={[{ id: "curriculum", label: "University curriculum" }, { id: "custom", label: "My own units" }]} />
          {from === "curriculum" ? (
            board.sources.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Curriculum" htmlFor="rm-cur">
                  <select
                    id="rm-cur"
                    className={inputClass}
                    value={curriculumId}
                    onChange={(e) => {
                      setCurriculumId(e.target.value);
                      setCourseCode(board.sources.find((s) => s.curriculumId === e.target.value)?.courses[0]?.code ?? "");
                    }}
                  >
                    {board.sources.map((s) => (
                      <option key={s.curriculumId} value={s.curriculumId}>
                        {s.programme} ({s.regulation})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Course" htmlFor="rm-course" error={errors.courseCode} hint={course ? `${course.units} units · ${course.hours} hours` : undefined}>
                  <select id="rm-course" className={inputClass} value={courseCode} onChange={(e) => setCourseCode(e.target.value)}>
                    {source?.courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        Sem {c.semester} · {c.code} {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">No published curriculum has a written syllabus yet. Enter your own units instead.</p>
            )
          ) : (
            <div className="space-y-3">
              <Field label="Course title" htmlFor="rm-title" error={errors["custom.title"]}>
                <input id="rm-title" className={inputClass} value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} />
              </Field>
              {custom.units.map((u, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_90px]">
                  <input aria-label={`Unit ${i + 1} title`} className={inputClass} value={u.title} onChange={(e) => setCustom({ ...custom, units: custom.units.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <input aria-label={`Unit ${i + 1} hours`} type="number" min={1} max={40} className={inputClass} value={u.hours} onChange={(e) => setCustom({ ...custom, units: custom.units.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) || 1 } : x)) })} />
                  <textarea aria-label={`Unit ${i + 1} topics`} className={cn(inputClass, "sm:col-span-2")} placeholder="Topics, comma-separated" value={u.topics} onChange={(e) => setCustom({ ...custom, units: custom.units.map((x, j) => (j === i ? { ...x, topics: e.target.value } : x)) })} />
                </div>
              ))}
              {custom.units.length < 8 ? (
                <Button size="sm" variant="ghost" onClick={() => setCustom({ ...custom, units: [...custom.units, { title: `Unit ${custom.units.length + 1}`, topics: "", hours: 9 }] })}>
                  <Fi name="plus" /> Add unit
                </Button>
              ) : null}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Class / section" htmlFor="rm-sec">
              <input id="rm-sec" className={inputClass} maxLength={40} value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. III CSE A" />
            </Field>
            <Field label="First class on" htmlFor="rm-start" error={errors.startDate}>
              <input id="rm-start" type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">Teaching days</p>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Teaching days">
                {DAYS.map((dname, i) => {
                  const v = i + 1;
                  const on = weekdays.includes(v);
                  return (
                    <button key={dname} type="button" aria-pressed={on} onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== v) : [...weekdays, v])} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-medium", on ? "border-brand bg-brand text-white" : "border-line text-ink-2")}>
                      {dname}
                    </button>
                  );
                })}
              </div>
              {errors.weekdays ? <p className="text-xs text-rose">{errors.weekdays}</p> : null}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="size-4 accent-brand" checked={withAssessments} onChange={(e) => setWithAssessments(e.target.checked)} /> Add internal assessments after units 2 and 4
          </label>
          {errors._ ? (
            <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">
              {errors._}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Fi name="route" />} Build roadmap
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function RoadmapView({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, id], queryFn: () => apiFetch(`/api/v1/course-roadmap/${id}`, Roadmap) });
  const [shiftFrom, setShiftFrom] = useState(today());
  const [showShift, setShowShift] = useState(false);
  const set = (r: Roadmap) => {
    qc.setQueryData([...KEY, id], r);
    void qc.invalidateQueries({ queryKey: KEY, exact: true });
  };
  const patch = useMutation({ mutationFn: ({ sid, body }: { sid: string; body: Partial<Session> }) => apiFetch(`/api/v1/course-roadmap/${id}/sessions/${sid}`, Roadmap, { method: "PATCH", body }), onSuccess: set });
  const shift = useMutation({ mutationFn: () => apiFetch(`/api/v1/course-roadmap/${id}/reschedule`, Roadmap, { method: "POST", body: { from: shiftFrom } }), onSuccess: (r) => (set(r), setShowShift(false)) });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/course-roadmap/${id}`, RoadmapBoard, { method: "DELETE" }),
    onSuccess: (b) => {
      qc.setQueryData(KEY, b);
      onBack();
    },
  });
  const weeks = useMemo(() => {
    const out: Array<{ label: string; sessions: Session[] }> = [];
    if (!q.data) return out;
    const start = new Date(`${q.data.startDate}T00:00:00Z`).getTime();
    for (const s of q.data.sessions) {
      const w = Math.floor((new Date(`${s.date}T00:00:00Z`).getTime() - start) / (7 * 86_400_000)) + 1;
      const label = `Week ${w}`;
      if (out.at(-1)?.label !== label) out.push({ label, sessions: [] });
      out.at(-1)!.sessions.push(s);
    }
    return out;
  }, [q.data]);
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const r = q.data;
  const t = today();
  const done = r.sessions.filter((s) => s.status === "Done").length;
  const overdue = r.sessions.filter((s) => s.status === "Planned" && s.date < t).length;
  const pct = r.sessions.length ? Math.round((done / r.sessions.length) * 100) : 0;
  const units = [...new Set(r.sessions.filter((s) => s.unit).map((s) => s.unit))];
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button type="button" onClick={onBack} className="mt-1 rounded-lg p-1 text-ink-3 hover:bg-surface-2 print:hidden" aria-label="Back to roadmaps">
              <Fi name="arrow-small-left" />
            </button>
            <div>
              <p className="font-mono text-xs text-ink-3">{r.courseCode || "Own course"}</p>
              <h2 className="text-xl font-semibold text-ink">{r.title}</h2>
              <p className="text-sm text-ink-3">{[r.section, r.programme, r.weekdays.map((w) => DAYS[w - 1]).join(", ")].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing pct={pct} />
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button size="sm" variant="secondary" onClick={() => setShowShift((v) => !v)}>
                <Fi name="calendar-clock" /> Reschedule
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                <Fi name="print" /> Print
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.confirm("Delete this roadmap?") && remove.mutate()}>
                <Fi name="trash" />
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center sm:max-w-md">
          <div className="rounded-xl bg-teal-soft/60 py-2">
            <p className="text-lg font-semibold text-teal">{done}</p>
            <p className="text-[11px] text-ink-3">taught</p>
          </div>
          <div className="rounded-xl bg-surface-2/70 py-2">
            <p className="text-lg font-semibold text-ink">{r.sessions.length - done}</p>
            <p className="text-[11px] text-ink-3">to go</p>
          </div>
          <div className={cn("rounded-xl py-2", overdue ? "bg-amber-soft" : "bg-surface-2/70")}>
            <p className={cn("text-lg font-semibold", overdue ? "text-amber" : "text-ink")}>{overdue}</p>
            <p className="text-[11px] text-ink-3">behind</p>
          </div>
        </div>
        {units.length ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {units.map((u) => {
              const us = r.sessions.filter((s) => s.unit === u);
              const ud = us.filter((s) => s.status !== "Planned").length;
              return (
                <span key={u} className={cn("rounded-full border px-2.5 py-1", ud === us.length ? "border-teal/40 bg-teal-soft/50 text-teal" : "border-line text-ink-2")}>
                  Unit {u}: {ud}/{us.length}
                </span>
              );
            })}
          </div>
        ) : null}
        {showShift ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line p-3 print:hidden">
            <Field label="Move every remaining session to start on" htmlFor="rm-shift" hint="For a holiday, leave or exam break: dates follow your teaching days.">
              <input id="rm-shift" type="date" className={inputClass} value={shiftFrom} onChange={(e) => setShiftFrom(e.target.value)} />
            </Field>
            <Button onClick={() => shift.mutate()} disabled={shift.isPending}>
              {shift.isPending ? <Spinner /> : null} Reschedule
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="space-y-4">
        {weeks.map((w) => (
          <section key={w.label} aria-label={w.label}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{w.label}</h3>
            <Card className="divide-y divide-line">
              {w.sessions.map((s) => (
                <SessionRow key={s.id} s={s} late={s.status === "Planned" && s.date < t} isToday={s.date === t} busy={patch.isPending} onPatch={(body) => patch.mutate({ sid: s.id, body })} />
              ))}
            </Card>
          </section>
        ))}
        {!weeks.length ? <EmptyState title="No sessions" body="This roadmap has no sessions." /> : null}
      </div>
    </div>
  );
}

function SessionRow({ s, late, isToday, busy, onPatch }: { s: Session; late: boolean; isToday: boolean; busy: boolean; onPatch: (b: Partial<Session>) => void }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(s.note);
  const [topic, setTopic] = useState(s.topic);
  return (
    <div className={cn("flex flex-wrap items-start gap-3 px-4 py-3", isToday && "bg-brand-soft/40", s.status === "Skipped" && "opacity-60")}>
      <div className="w-24 shrink-0">
        <p className={cn("text-sm font-medium", late ? "text-amber" : "text-ink")}>{fmt(s.date)}</p>
        {isToday ? <Badge tone="brand">Today</Badge> : late ? <span className="text-[11px] text-amber">Not marked</span> : null}
      </div>
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", s.method === "Assessment" ? "bg-rose-soft text-rose" : s.method === "Revision" ? "bg-gold/15 text-gold" : s.method === "Tutorial" ? "bg-sky-soft text-sky" : "bg-brand-soft text-brand")} title={s.method}>
        <Fi name={METHOD_ICON[s.method] ?? "book"} />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <input aria-label="Topic" className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} />
            <div className="flex flex-wrap gap-2">
              <select aria-label="Method" className={cn(inputClass, "w-auto")} value={s.method} onChange={(e) => onPatch({ method: e.target.value as Session["method"] })}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input aria-label="Note" className={cn(inputClass, "flex-1")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (what was covered, homework…)" />
              <Button
                size="sm"
                onClick={() => {
                  onPatch({ topic, note });
                  setEditing(false);
                }}
                disabled={topic.trim().length < 2}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={cn("text-sm text-ink", s.status === "Skipped" && "line-through")}>{s.topic}</p>
            <p className="text-xs text-ink-3">
              {s.unit ? `Unit ${s.unit} · ${s.unitTitle}` : s.unitTitle} · {s.method}
              {s.note ? ` · ${s.note}` : ""}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 print:hidden">
        {s.status === "Planned" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onPatch({ status: "Done" })} disabled={busy} aria-label={`Mark ${s.topic} as taught`}>
              <Fi name="check" /> Taught
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onPatch({ status: "Skipped" })} disabled={busy} aria-label="Skip this session">
              Skip
            </Button>
          </>
        ) : (
          <button type="button" onClick={() => onPatch({ status: "Planned" })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs" title="Undo">
            <Badge tone={s.status === "Done" ? "teal" : "neutral"}>{s.status === "Done" ? "Taught" : "Skipped"}</Badge>
            <Fi name="undo" className="text-ink-3" />
          </button>
        )}
        <button type="button" onClick={() => setEditing((e) => !e)} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Edit session">
          <Fi name="pencil" />
        </button>
      </div>
    </div>
  );
}
