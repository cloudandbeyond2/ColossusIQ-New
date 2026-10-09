"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardHeader, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { CollegeFees, type CollegeStudentFee } from "@/lib/api/billing-schemas";
import { money } from "./fee-payment";

const KEY = ["fees", "college"] as const;
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const Sent = z.object({ sent: z.number(), view: CollegeFees });
type Filter = "all" | "Due" | "Paid" | "Waived" | "pending";

const statusOf = (s: CollegeStudentFee) => (s.status === "Due" && s.pendingOffline ? { label: "Awaiting verification", tone: "sky" as const } : s.status === "Due" ? { label: "Due", tone: "amber" as const } : { label: s.status, tone: "teal" as const });

/** Principal: every student's app fee status for this year, and fee reminders sent through the portal. */
export function StudentFeesModule() {
  const qc = useQueryClient();
  // Payments and offline approvals happen elsewhere, so the list refreshes itself while the page is open.
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/fees/college", CollegeFees), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState<"selected" | "all" | null>(null);
  if (q.isPending) return <Skeleton className="h-[560px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;

  if (!d.configured) {
    return (
      <Card className="flex items-start gap-3 p-5 text-sm text-ink-2">
        <Fi name="info" className="mt-0.5 text-sky" />
        <p>The University has not opened fee collection for this academic year yet. Once it does, every student&rsquo;s fee status appears here.</p>
      </Card>
    );
  }

  const count = (f: (s: CollegeStudentFee) => boolean) => d.students.filter(f).length;
  const paid = count((s) => s.status === "Paid");
  const waived = count((s) => s.status === "Waived");
  const pending = count((s) => s.status === "Due" && s.pendingOffline);
  const due = count((s) => s.status === "Due");
  const rows = d.students.filter((s) => (filter === "all" ? true : filter === "pending" ? s.status === "Due" && s.pendingOffline : s.status === filter) && (!search || `${s.name} ${s.email}`.toLowerCase().includes(search.toLowerCase())));
  const dueRows = rows.filter((s) => s.status === "Due");
  const allPicked = dueRows.length > 0 && dueRows.every((s) => picked.has(s.userSub));
  const toggle = (sub: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(sub)) n.delete(sub);
    else n.add(sub);
    return n;
  });

  const csv = () => {
    const esc = (v: string | number) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [["Student", "Email", "Fee", "Status", "Cleared on", "Last reminder"], ...rows.map((s) => [s.name, s.email, s.amount, statusOf(s).label, s.clearedAt?.slice(0, 10) ?? "", s.lastReminder?.slice(0, 10) ?? ""])];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `student-fees-${d.academicYear}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5 text-sm">
        <div>
          <p className="text-xs text-ink-3">Academic year</p>
          <p className="text-lg font-semibold text-ink">{d.academicYear}</p>
        </div>
        <div>
          <p className="text-xs text-ink-3">App fee per student</p>
          <p className="text-lg font-semibold text-ink">{money(d.fee, d.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-3">Due by</p>
          <p className="text-lg font-semibold text-ink">{day(d.dueDate)}</p>
        </div>
        <div className="flex-1 text-xs text-ink-3">
          Students see a reminder on every page from {day(d.reminderFrom)}.{d.lockActive ? ` Unpaid student accounts are locked since ${day(d.lockDate)}.` : ` Unpaid accounts lock after ${day(d.lockDate)} if the University has locking on.`}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Money label="Collected" value={money(d.summary.collected, d.currency)} tone="text-teal" />
            <Money label="Still to collect" value={money(d.summary.outstanding, d.currency)} tone={d.summary.outstanding ? "text-rose" : "text-ink"} />
            <Money label="Total payable" value={money(d.summary.expected, d.currency)} />
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span>Updated {new Date(q.dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            <Button size="sm" variant="ghost" onClick={() => void q.refetch()} disabled={q.isFetching}>
              {q.isFetching ? <Spinner /> : <Fi name="refresh" />} Refresh
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-ink-3">
            <span>Collection progress</span>
            <span>{d.summary.rate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={d.summary.rate} aria-valuemin={0} aria-valuemax={100} aria-label="Share of payable fees collected">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${d.summary.rate}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Students" value={d.students.length} onClick={() => setFilter("all")} active={filter === "all"} />
        <Stat label="Paid" value={paid} tone="teal" onClick={() => setFilter("Paid")} active={filter === "Paid"} />
        <Stat label="Waived" value={waived} onClick={() => setFilter("Waived")} active={filter === "Waived"} />
        <Stat label="Awaiting verification" value={pending} tone="sky" onClick={() => setFilter("pending")} active={filter === "pending"} />
        <Stat label="Due" value={due} tone="rose" onClick={() => setFilter("Due")} active={filter === "Due"} />
      </div>

      <Card>
        <CardHeader
          title="Students"
          subtitle="Fee status for this academic year. Offline payments are verified by the University."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={csv} disabled={!rows.length}>
                <Fi name="download" /> Export CSV
              </Button>
              {d.canRemind ? (
                <>
                  <Button size="sm" variant="secondary" disabled={!picked.size} onClick={() => setCompose("selected")}>
                    <Fi name="bell" /> Remind selected ({picked.size})
                  </Button>
                  <Button size="sm" disabled={!due} onClick={() => setCompose("all")}>
                    <Fi name="megaphone" /> Remind all unpaid ({due})
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
        <div className="px-5 pb-4">
          <input aria-label="Search students" placeholder="Search by name or email" className={`${inputClass} max-w-xs`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="w-10 px-5 py-2">
                    {d.canRemind ? <input type="checkbox" aria-label="Select every student with a fee due" checked={allPicked} disabled={!dueRows.length} onChange={() => setPicked(allPicked ? new Set() : new Set(dueRows.map((s) => s.userSub)))} /> : null}
                  </th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Fee</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Paid via</th>
                  <th className="px-3 py-2 font-medium">Cleared on</th>
                  <th className="px-3 py-2 font-medium">Last reminder</th>
                  <th className="px-5 py-2 font-medium"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const st = statusOf(s);
                  return (
                    <tr key={s.userSub} className="border-t border-line">
                      <td className="px-5 py-3">{d.canRemind && s.status === "Due" ? <input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.has(s.userSub)} onChange={() => toggle(s.userSub)} /> : null}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink">{s.name || "Student"}</p>
                        <p className="text-xs text-ink-3">
                          {s.email || "—"}
                          {!s.signedIn && s.status === "Due" ? " · not signed in this year" : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{money(s.amount, d.currency)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-3 py-3 capitalize text-ink-3">{s.method || "—"}</td>
                      <td className="px-3 py-3 text-ink-3">{day(s.clearedAt)}</td>
                      <td className="px-3 py-3 text-ink-3">{s.status === "Due" ? day(s.lastReminder) : "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setOpen(s.userSub)} aria-label={`Payment details for ${s.name || "student"}`}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-3">No students match.</p>
        )}
      </Card>

      {d.sent.length ? (
        <Card>
          <CardHeader title="Reminders sent" subtitle="Students see these in a popup and in their notifications until their fee is cleared." />
          <ul className="divide-y divide-line">
            {d.sent.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm">
                <p className="text-ink">{n.message}</p>
                <p className="mt-1 text-xs text-ink-3">
                  To {n.to} · {n.sentBy} · {new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {open ? <Detail data={d} sub={open} onClose={() => setOpen(null)} /> : null}

      {compose ? (
        <Compose
          data={d}
          students={compose === "selected" ? [...picked] : undefined}
          count={compose === "selected" ? picked.size : due}
          onClose={() => setCompose(null)}
          onSent={(view) => {
            qc.setQueryData(KEY, view);
            setPicked(new Set());
            setCompose(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Money({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

const payTone = (s: string) => (s === "Paid" ? ("teal" as const) : s === "Pending verification" ? ("sky" as const) : s === "Created" ? ("neutral" as const) : ("rose" as const));

/** One student's fee: status, how it was settled, and every payment attempt this year. */
function Detail({ data: d, sub, onClose }: { data: CollegeFees; sub: string; onClose: () => void }) {
  const s = d.students.find((x) => x.userSub === sub);
  if (!s) return null;
  const st = statusOf(s);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Fee details for ${s.name}`}>
      <Card className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-ink">{s.name || "Student"}</p>
            <p className="text-sm text-ink-3">{s.email || "No email on file"}</p>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-3">Fee for {d.academicYear}</dt>
            <dd className="font-medium text-ink">{money(s.amount, d.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Cleared on</dt>
            <dd className="font-medium text-ink">{day(s.clearedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Settled by</dt>
            <dd className="font-medium capitalize text-ink">{s.method || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Last reminder</dt>
            <dd className="font-medium text-ink">{day(s.lastReminder)}</dd>
          </div>
        </dl>
        {!s.signedIn && s.status === "Due" ? <p className="text-xs text-ink-3">This student has not opened Fees &amp; Payments this year.</p> : null}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Payments this year</p>
          {s.payments.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {s.payments.map((p) => (
                <li key={`${p.receiptNo}-${p.at}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-ink">
                      {money(p.amount, d.currency)} · <span className="capitalize">{p.via}</span>
                    </p>
                    <p className="text-xs text-ink-3">
                      {p.receiptNo ? `Receipt ${p.receiptNo} · ` : ""}
                      {p.reference ? `Ref ${p.reference} · ` : ""}
                      {day(p.at)}
                    </p>
                    {p.note ? <p className="mt-1 text-xs text-ink-3">Note: {p.note}</p> : null}
                  </div>
                  <Badge tone={payTone(p.status)}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No payment has been made or submitted yet.</p>
          )}
          {s.pendingOffline ? <p className="mt-2 text-xs text-ink-3">An offline payment is waiting for the University to verify it.</p> : null}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "teal" | "sky" | "rose"; active: boolean; onClick: () => void }) {
  const color = tone === "teal" ? "text-teal" : tone === "sky" ? "text-sky" : tone === "rose" ? "text-rose" : "text-ink";
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-2xl border bg-surface p-4 text-left transition hover:bg-surface-2 ${active ? "border-brand ring-1 ring-brand" : "border-line"}`}>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value.toLocaleString("en-IN")}</p>
    </button>
  );
}

function Compose({ data: d, students, count, onClose, onSent }: { data: CollegeFees; students?: string[]; count: number; onClose: () => void; onSent: (view: CollegeFees) => void }) {
  const [message, setMessage] = useState(`Dear student, your ColossusIQ app fee of ${money(d.fee, d.currency)} for ${d.academicYear} is due by ${day(d.dueDate)}. Please pay under Fees & Payments to avoid your account being locked. — College office`);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => apiFetch("/api/v1/fees/college/remind", Sent, { method: "POST", body: { ...(students ? { students } : {}), message } }),
    onSuccess: (r) => onSent(r.view),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not send the reminder."),
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Send fee reminder">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <p className="text-lg font-semibold text-ink">Send fee reminder</p>
          <p className="text-sm text-ink-3">
            To {students ? `${count} selected student${count === 1 ? "" : "s"}` : `all ${count} students whose fee is due`}. They see it in a popup and in their notifications until the fee is cleared.
          </p>
        </div>
        <Field label="Message" htmlFor="remind-msg" hint={`${message.length}/500`}>
          <textarea id="remind-msg" rows={5} className={inputClass} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {error ? (
          <p className="text-sm text-rose" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending || message.trim().length < 5} onClick={() => (setError(null), send.mutate())}>
            {send.isPending ? <Spinner /> : <Fi name="paper-plane" />} Send reminder
          </Button>
        </div>
      </Card>
    </div>
  );
}
