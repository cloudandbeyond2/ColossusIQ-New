"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { AssignmentItem, Submission, type AssignmentStatus } from "@/lib/api/assignments-schemas";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, EmptyState, Field, Progress, Skeleton, Spinner, inputClass } from "@/components/ui/primitives";
import { LIST_KEY, Modal, dueText, problemOf, submissionsKey, toLocalInput, tomorrowAt5pm, when } from "./assignments-shared";

const statusTone = { Open: "teal", Closed: "rose", Draft: "amber" } as const;

export function FacultyAssignments({ items }: { items: AssignmentItem[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | AssignmentStatus>("All");
  const [editing, setEditing] = useState<AssignmentItem | "new" | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AssignmentItem | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/assignments/${id}`, AssignmentItem, { method: "PUT", body: { status: "Open" } }),
    onSuccess: () => {
      setProblem(null);
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (e) => setProblem(problemOf(e, "Could not publish.").message ?? Object.values(problemOf(e, "").fields)[0] ?? "Could not publish."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/assignments/${id}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  const q = search.trim().toLowerCase();
  const shown = items.filter((a) => (filter === "All" || a.status === filter) && (!q || a.title.toLowerCase().includes(q) || a.course.toLowerCase().includes(q)));
  const viewing = items.find((a) => a.id === viewingId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input type="search" aria-label="Search assignments" placeholder="Search assignments…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} />
          </div>
          <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="All">All</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New assignment
        </Button>
      </div>

      {problem ? (
        <p className="text-sm text-rose" role="alert">
          {problem}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-[11px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-6 py-3.5">Assignment</th>
                <th className="px-4 py-3.5">Due</th>
                <th className="w-52 px-4 py-3.5">Handed in</th>
                <th className="px-4 py-3.5">Marked</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <EmptyState title={items.length === 0 ? "No assignments yet" : "No assignments match"} body={items.length === 0 ? "Create an assignment and publish it. Students will see it straight away." : "Try another search or filter."} />
                  </td>
                </tr>
              ) : (
                shown.map((a) => {
                  const st = a.stats ?? { submitted: 0, graded: 0, enrolled: null };
                  const pct = st.enrolled ? Math.min(100, Math.round((st.submitted / st.enrolled) * 100)) : null;
                  const due = dueText(a);
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-surface-2/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-ink">{a.title}</p>
                        <p className="text-xs text-ink-3">
                          {a.course} · {a.maxMarks} marks{a.canManage ? "" : ` · ${a.authorName}`}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="text-ink-2">{a.due}</p>
                        {a.status === "Open" && a.dueAt ? <p className={`text-xs ${due.overdue ? "text-rose" : "text-ink-3"}`}>{due.text}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        {pct !== null ? (
                          <div className="flex items-center gap-3">
                            <Progress value={pct} tone={pct >= 80 ? "teal" : pct >= 50 ? "brand" : "amber"} className="flex-1" label={`${a.title} handed in`} />
                            <span className="min-w-16 text-right text-xs font-semibold text-ink-3">
                              {st.submitted} / {st.enrolled}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-ink-2">{st.submitted} handed in</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-ink-2">{st.submitted === 0 ? "–" : `${st.graded} of ${st.submitted}`}</td>
                      <td className="px-4 py-4">
                        <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                      </td>
                      <td className="space-x-1 whitespace-nowrap px-6 py-4 text-right">
                        {a.status === "Draft" && a.canManage ? (
                          <Button size="sm" variant="secondary" disabled={publish.isPending} onClick={() => publish.mutate(a.id)}>
                            {publish.isPending && publish.variables === a.id ? <Spinner /> : <Send className="size-3.5" />} Publish
                          </Button>
                        ) : null}
                        {a.canManage ? (
                          <>
                            <IconButton label={`Submissions for ${a.title}`} onClick={() => setViewingId(a.id)}>
                              <Eye className="size-4" />
                            </IconButton>
                            <IconButton label={`Edit ${a.title}`} onClick={() => setEditing(a)}>
                              <Pencil className="size-4" />
                            </IconButton>
                            <IconButton label={`Delete ${a.title}`} danger onClick={() => setDeleting(a)}>
                              <Trash2 className="size-4" />
                            </IconButton>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line p-4 text-xs text-ink-3">
          Showing {shown.length} of {items.length} assignments. Students see an assignment once it is Open, and can hand it in until you close it.
        </div>
      </Card>

      {editing ? <AssignmentForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {viewing ? <SubmissionsDialog assignment={viewing} onClose={() => setViewingId(null)} /> : null}
      {deleting ? (
        <Modal title="Delete assignment?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink-2">
            “{deleting.title}” will disappear from every student’s list, and the {deleting.stats?.submitted ?? 0} submission(s) and marks with it. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
          {remove.isError ? (
            <p className="mt-3 text-sm text-rose" role="alert">
              {problemOf(remove.error, "Could not delete.").message}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`inline-flex rounded-md p-1.5 transition-colors ${danger ? "text-rose hover:bg-surface-2" : "text-ink-2 hover:bg-surface-2 hover:text-brand"}`}>
      {children}
    </button>
  );
}

/* ───────────────────────────── create / edit ───────────────────────────── */

function AssignmentForm({ initial, onClose }: { initial: AssignmentItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    course: initial?.course ?? "",
    description: initial?.description ?? "",
    maxMarks: String(initial?.maxMarks ?? 10),
    dueAt: initial?.dueAt ? toLocalInput(new Date(initial.dueAt)) : tomorrowAt5pm(),
    status: (initial?.status ?? "Open") as AssignmentStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (initial ? apiFetch(`/api/v1/assignments/${initial.id}`, AssignmentItem, { method: "PUT", body }) : apiFetch("/api/v1/assignments", AssignmentItem, { method: "POST", body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      onClose();
    },
    onError: (e) => {
      const p = problemOf(e, "Could not save the assignment.");
      setErrors(p.fields);
      setGeneral(p.message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const marks = Number(f.maxMarks);
    if (f.title.trim().length < 2) errs.title = "Give the assignment a title";
    if (!f.course.trim()) errs.course = "Pick a course";
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) errs.maxMarks = "A whole number from 1 to 1000";
    const due = new Date(f.dueAt);
    if (!f.dueAt || Number.isNaN(due.getTime())) errs.dueAt = "Pick a due date and time";
    setErrors(errs);
    setGeneral(null);
    if (Object.keys(errs).length) return;
    save.mutate({ title: f.title.trim(), course: f.course.trim(), description: f.description.trim(), maxMarks: marks, dueAt: due.toISOString(), status: f.status });
  };

  return (
    <Modal title={initial ? "Edit assignment" : "New assignment"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor="as-title" error={errors.title}>
          <input id="as-title" className={inputClass} maxLength={120} placeholder="e.g. Process Scheduling Simulation" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course" htmlFor="as-course" error={errors.course}>
            <input id="as-course" className={inputClass} maxLength={40} placeholder="e.g. OS, DBMS" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} />
          </Field>
          <Field label="Total marks" htmlFor="as-marks" error={errors.maxMarks}>
            <input id="as-marks" type="number" inputMode="numeric" min={1} max={1000} className={inputClass} value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} />
          </Field>
        </div>
        <Field label="Instructions for students" htmlFor="as-desc" hint="What to do, what to hand in and how it will be marked." error={errors.description}>
          <textarea id="as-desc" rows={4} className={inputClass} maxLength={3000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date and time" htmlFor="as-due" error={errors.dueAt}>
            <input id="as-due" type="datetime-local" className={inputClass} value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />
          </Field>
          <Field label="Status" htmlFor="as-status" hint="Students see it when it is Open." error={errors.status}>
            <select id="as-status" className={inputClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AssignmentStatus })}>
              <option value="Draft">Draft (only you see it)</option>
              <option value="Open">Open (students can hand in)</option>
              <option value="Closed">Closed (no more submissions)</option>
            </select>
          </Field>
        </div>
        {general ? (
          <p className="text-sm text-rose" role="alert">
            {general}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} {initial ? "Save changes" : f.status === "Open" ? "Publish to students" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── submissions and marking ───────────────────────────── */

function SubmissionsDialog({ assignment, onClose }: { assignment: AssignmentItem; onClose: () => void }) {
  const q = useQuery({ queryKey: submissionsKey(assignment.id), queryFn: () => apiFetch(`/api/v1/assignments/${assignment.id}/submissions`, z.array(Submission)) });
  const st = assignment.stats;
  return (
    <Modal title={`Submissions · ${assignment.title}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-ink-3">
        {assignment.course} · out of {assignment.maxMarks} · due {assignment.due}
        {st ? ` · ${st.submitted}${st.enrolled ? ` of ${st.enrolled}` : ""} handed in, ${st.graded} marked` : ""}
      </p>
      {q.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : q.isError ? (
        <LoadError error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title="Nothing handed in yet" body="Submissions appear here as students send them." />
      ) : (
        <ul className="space-y-4">
          {q.data.map((s) => (
            <li key={s.id}>
              <SubmissionCard sub={s} assignment={assignment} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function SubmissionCard({ sub, assignment }: { sub: Submission; assignment: AssignmentItem }) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState(sub.marks === null ? "" : String(sub.marks));
  const [feedback, setFeedback] = useState(sub.feedback);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const grade = useMutation({
    mutationFn: (body: { marks: number; feedback: string }) => apiFetch(`/api/v1/assignments/${assignment.id}/submissions/${sub.id}`, Submission, { method: "PATCH", body }),
    onSuccess: () => {
      setErrors({});
      setGeneral(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      void qc.invalidateQueries({ queryKey: submissionsKey(assignment.id) });
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (e) => {
      const p = problemOf(e, "Could not save the marks.");
      setErrors(p.fields);
      setGeneral(p.message);
    },
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(marks);
    if (marks.trim() === "" || !Number.isInteger(n) || n < 0 || n > assignment.maxMarks) {
      setErrors({ marks: `A whole number from 0 to ${assignment.maxMarks}` });
      return;
    }
    grade.mutate({ marks: n, feedback: feedback.trim() });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{sub.studentName}</p>
        {sub.rollNo ? <span className="text-xs text-ink-3">{sub.rollNo}</span> : null}
        <span className="text-xs text-ink-3">· handed in {when(sub.submittedAt)}</span>
        {sub.late ? <Badge tone="rose">Late</Badge> : null}
        {sub.marks !== null ? <Badge tone="teal">{`${sub.marks} / ${assignment.maxMarks}`}</Badge> : <Badge tone="amber">Not marked</Badge>}
      </div>
      {sub.text ? <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2/60 p-3 text-sm text-ink-2">{sub.text}</p> : null}
      {sub.link ? (
        <p className="mt-2 text-sm">
          <a href={sub.link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand underline">
            {sub.link}
          </a>
        </p>
      ) : null}
      <form className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr_auto] sm:items-start" onSubmit={save} noValidate>
        <Field label={`Marks / ${assignment.maxMarks}`} htmlFor={`m-${sub.id}`} error={errors.marks}>
          <input id={`m-${sub.id}`} type="number" inputMode="numeric" min={0} max={assignment.maxMarks} className={inputClass} value={marks} onChange={(e) => setMarks(e.target.value)} />
        </Field>
        <Field label="Feedback for the student" htmlFor={`f-${sub.id}`} error={errors.feedback}>
          <textarea id={`f-${sub.id}`} rows={2} maxLength={1000} className={inputClass} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" className="sm:mt-6" disabled={grade.isPending}>
          {grade.isPending ? <Spinner /> : null} {sub.marks === null ? "Save marks" : "Update"}
        </Button>
      </form>
      {saved ? (
        <p className="mt-2 text-sm font-medium text-teal" role="status">
          ✓ Marks saved successfully!
        </p>
      ) : null}
      {general ? (
        <p className="mt-2 text-sm text-rose" role="alert">
          {general}
        </p>
      ) : null}
    </Card>
  );
}
