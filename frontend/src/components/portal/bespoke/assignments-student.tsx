"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Send } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { MAX_ANSWER, Submission, type AssignmentItem } from "@/lib/api/assignments-schemas";
import { Badge, Button, Card, EmptyState, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { LIST_KEY, Modal, dueText, problemOf, when } from "./assignments-shared";

type Tab = "todo" | "done" | "all";

/** Where a student stands on one assignment. */
function standing(a: AssignmentItem) {
  if (a.mine?.marks != null) return "marked" as const;
  if (a.mine) return "handed" as const;
  if (a.status === "Closed") return "missed" as const;
  return "todo" as const;
}

export function StudentAssignments({ items }: { items: AssignmentItem[] }) {
  const [tab, setTab] = useState<Tab>("todo");
  const [handing, setHanding] = useState<AssignmentItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const todo = items.filter((a) => standing(a) === "todo");
  const done = items.filter((a) => ["handed", "marked"].includes(standing(a)));
  const marked = items.filter((a) => standing(a) === "marked");
  const byDue = (x: AssignmentItem, y: AssignmentItem) => (x.dueAt ?? "9").localeCompare(y.dueAt ?? "9");
  const shown = (tab === "todo" ? [...todo].sort(byDue) : tab === "done" ? [...done].sort(byDue) : [...items].sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = shown.slice(start, start + pageSize);
  const pending = todo.filter((a) => dueText(a).overdue).length;
  const handing2 = handing ? (items.find((a) => a.id === handing.id) ?? handing) : null;

  const tabs: Array<[Tab, string, number]> = [
    ["todo", "To do", todo.length],
    ["done", "Handed in", done.length],
    ["all", "All", items.length],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="To do" value={todo.length} note={pending ? `${pending} past the deadline` : todo.length ? "Hand in before the deadline" : "You are all caught up"} tone={pending ? "rose" : "brand"} />
        <Stat label="Handed in" value={done.length} note={`${marked.length} marked`} tone="teal" />
        <Stat label="Average so far" value={averageOf(marked)} note={marked.length ? `across ${marked.length} marked` : "Nothing marked yet"} tone="gold" />
      </div>

      <div role="tablist" aria-label="Assignments" className="flex gap-1 border-b border-line">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setPage(1);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
          >
            {label} <span className="ml-1 text-xs text-ink-3">{n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={items.length === 0 ? "No assignments yet" : tab === "todo" ? "Nothing to hand in" : "Nothing here yet"}
            body={items.length === 0 ? "When your teachers publish an assignment, it appears here and in your notifications." : tab === "todo" ? "You have handed in everything that is open." : "Assignments you hand in will be listed here."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-4">
            {paginated.map((a) => (
              <li key={a.id}>
                <AssignmentCard a={a} onHandIn={() => setHanding(a)} />
              </li>
            ))}
          </ul>
          {/* Pagination bar */}
          <Card className="flex flex-col items-center justify-between gap-3 p-4 text-xs text-ink-3 sm:flex-row">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Showing {start + 1}–{Math.min(start + pageSize, shown.length)} of {shown.length} assignments
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  aria-label="Assignments per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="mr-1 text-ink-3">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {handing2 ? <HandInDialog a={handing2} onClose={() => setHanding(null)} /> : null}
    </div>
  );
}

function averageOf(marked: AssignmentItem[]): string {
  if (marked.length === 0) return "–";
  const pct = marked.reduce((sum, a) => sum + ((a.mine?.marks ?? 0) / a.maxMarks) * 100, 0) / marked.length;
  return `${Math.round(pct)}%`;
}

function Stat({ label, value, note, tone }: { label: string; value: number | string; note: string; tone: "brand" | "teal" | "gold" | "rose" }) {
  const color = { brand: "text-brand", teal: "text-teal", gold: "text-amber", rose: "text-rose" }[tone];
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-ink-2">{label}</p>
      <p className={`mt-1 font-serif text-4xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-3">{note}</p>
    </Card>
  );
}

function AssignmentCard({ a, onHandIn }: { a: AssignmentItem; onHandIn: () => void }) {
  const st = standing(a);
  const due = dueText(a);
  const [open, setOpen] = useState(false);
  const long = a.description.length > 220;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{a.title}</h3>
            <Badge tone="sky">{a.course}</Badge>
            {st === "marked" ? <Badge tone="teal">Marked</Badge> : st === "handed" ? <Badge tone="brand">Handed in</Badge> : st === "missed" ? <Badge tone="rose">Closed · not handed in</Badge> : due.overdue ? <Badge tone="rose">Overdue</Badge> : due.soon ? <Badge tone="amber">Due soon</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-ink-3">
            {a.authorName} · {a.maxMarks} marks · due {a.due}
            {st === "todo" ? <span className={due.overdue ? "text-rose" : ""}> · {due.text}</span> : null}
          </p>
        </div>
        {st === "todo" ? (
          <Button size="sm" onClick={onHandIn}>
            <Send className="size-3.5" /> {due.overdue ? "Hand in late" : "Hand in"}
          </Button>
        ) : st === "handed" ? (
          <Button size="sm" variant="secondary" onClick={onHandIn}>
            Edit my work
          </Button>
        ) : null}
      </div>

      {a.description ? (
        <p className={`mt-3 whitespace-pre-wrap text-sm text-ink-2 ${open || !long ? "" : "line-clamp-3"}`}>{a.description}</p>
      ) : (
        <p className="mt-3 text-sm italic text-ink-3">No instructions were added.</p>
      )}
      {long ? (
        <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}

      {a.mine ? <MyWork mine={a.mine} max={a.maxMarks} /> : null}
    </Card>
  );
}

function MyWork({ mine, max }: { mine: Submission; max: number }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        <CheckCircle2 className="size-4 text-teal" aria-hidden /> Handed in {when(mine.submittedAt)}
        {mine.late ? <Badge tone="rose">Late</Badge> : null}
      </p>
      {mine.text ? <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-ink-2">{mine.text}</p> : null}
      {mine.link ? (
        <a href={mine.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 break-all text-sm text-brand underline">
          <ExternalLink className="size-3.5 shrink-0" aria-hidden /> {mine.link}
        </a>
      ) : null}
      {mine.marks !== null ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm font-semibold text-ink">
            Your marks: <span className="text-teal">{mine.marks}</span> / {max}
          </p>
          {mine.feedback ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">“{mine.feedback}”</p> : <p className="mt-1 text-xs text-ink-3">No written feedback.</p>}
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">Waiting for your teacher to mark it. You can still edit it until then.</p>
      )}
    </div>
  );
}

function HandInDialog({ a, onClose }: { a: AssignmentItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState(a.mine?.text ?? "");
  const [link, setLink] = useState(a.mine?.link ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const due = dueText(a);

  const send = useMutation({
    mutationFn: (body: { text: string; link: string }) => apiFetch(`/api/v1/assignments/${a.id}/submission`, Submission, { method: "PUT", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      onClose();
    },
    onError: (e) => {
      const p = problemOf(e, "Could not hand in your work.");
      setErrors(p.fields);
      setGeneral(p.message);
      void qc.invalidateQueries({ queryKey: LIST_KEY }); // the assignment may have been closed meanwhile
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    const l = link.trim();
    const errs: Record<string, string> = {};
    if (!t && !l) errs.text = "Write your answer or add a link";
    if (l && !/^https?:\/\/\S+$/i.test(l)) errs.link = "Use a full link starting with http:// or https://";
    setErrors(errs);
    setGeneral(null);
    if (Object.keys(errs).length) return;
    send.mutate({ text: t, link: l });
  };

  return (
    <Modal title={a.mine ? `Edit your work · ${a.title}` : `Hand in · ${a.title}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        {due.overdue ? (
          <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-rose" role="status">
            The deadline has passed ({due.text.toLowerCase()}). Your work will be marked as late.
          </p>
        ) : (
          <p className="text-xs text-ink-3">
            {due.text} · {a.maxMarks} marks. You can replace your work until your teacher marks it.
          </p>
        )}
        <Field label="Your answer" htmlFor="hi-text" hint={`${text.length} / ${MAX_ANSWER}`} error={errors.text}>
          <textarea id="hi-text" rows={8} maxLength={MAX_ANSWER} className={inputClass} placeholder="Type or paste your answer here" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Link to your work (optional)" htmlFor="hi-link" hint="A shared document, repository or video." error={errors.link}>
          <input id="hi-link" type="url" inputMode="url" maxLength={500} className={inputClass} placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
        {general ? (
          <p className="text-sm text-rose" role="alert">
            {general}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? <Spinner /> : <Send className="size-4" />} {a.mine ? "Save changes" : "Hand in"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
