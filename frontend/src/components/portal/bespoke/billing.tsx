"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardHeader, Field, inputClass, Progress, Skeleton, Spinner } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api/client";
import { BillingOverview, DueList, GATEWAY_NAMES, PaymentList, PLANS, type BillingSettings, type CollegeBillingRow, type FeePayment, type StudentDue } from "@/lib/api/billing-schemas";
import { money } from "./fee-payment";

const KEY = ["billing", "overview"] as const;
type Tab = "overview" | "payments" | "students" | "settings" | "gateways";
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Subscriptions & Billing: plans and seats, the yearly student app fee, collection, approvals and the year lock. */
export function BillingModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/billing/overview", BillingOverview) });
  const [tab, setTab] = useState<Tab>("overview");
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const cur = d.settings.currency;
  return (
    <div className="space-y-5">
      {!d.configured ? (
        <Card className="flex items-start gap-3 border-amber p-4 text-sm text-ink-2">
          <Fi name="info" className="mt-0.5 text-amber" />
          <p>
            Fee collection is not open yet. Set the academic year, due date and fee per plan under <strong>Settings</strong> and save to open it. Students see nothing due until then.
          </p>
        </Card>
      ) : d.lockActive ? (
        <Card className="flex items-start gap-3 border-rose p-4 text-sm text-ink-2">
          <Fi name="lock" className="mt-0.5 text-rose" />
          <p>
            Automatic lock is <strong>on</strong> for {d.settings.academicYear}: students who have not paid{d.settings.lockStaff ? ", and staff of colleges not yet cleared," : ""} can only open their fee page until they are cleared.
          </p>
        </Card>
      ) : (
        <Card className="flex items-start gap-3 p-4 text-sm text-ink-2">
          <Fi name="calendar" className="mt-0.5 text-sky" />
          <p>
            {d.settings.autoLock ? `Unpaid accounts lock automatically after ${day(d.lockDate)}.` : "Automatic locking is off: unpaid students keep full access."} Fee due by {day(d.settings.dueDate)}.
          </p>
        </Card>
      )}
      {!d.canEdit ? (
        <Card className="flex items-start gap-3 border-amber p-4 text-sm text-ink-2">
          <Fi name="eye" className="mt-0.5 text-amber" />
          <p>You are viewing one college. Switch to “All colleges” (with your sign-in code confirmed) to change fees, approve payments or clear colleges.</p>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Expected this year" value={money(d.totals.expected, cur)} hint={`${d.totals.students.toLocaleString("en-IN")} enrolled students`} />
        <Kpi label="Collected" value={money(d.totals.collected, cur)} hint={d.totals.expected ? `${Math.round((d.totals.collected / d.totals.expected) * 100)}% of expected` : "—"} tone="teal" />
        <Kpi label="Paid / waived" value={`${d.totals.paid} / ${d.totals.waived}`} hint="students cleared" />
        <Kpi label="Awaiting verification" value={String(d.totals.pending)} hint="offline payments" tone={d.totals.pending ? "amber" : undefined} />
        <Kpi label="Still due" value={d.totals.due.toLocaleString("en-IN")} hint="students" tone={d.totals.due ? "rose" : undefined} />
      </div>

      <Tabs
        label="Billing sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Colleges" },
          { id: "payments", label: "Payments", count: d.totals.pending },
          { id: "students", label: "Students" },
          { id: "settings", label: "Settings" },
          { id: "gateways", label: "Gateways" },
        ]}
      />
      {tab === "overview" ? <Colleges data={d} /> : null}
      {tab === "payments" ? <Payments canEdit={d.canEdit} colleges={d.colleges} /> : null}
      {tab === "students" ? <Students canEdit={d.canEdit} colleges={d.colleges} currency={cur} /> : null}
      {tab === "settings" ? <Settings data={d} /> : null}
      {tab === "gateways" ? <Gateways data={d} /> : null}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "teal" | "amber" | "rose" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={tone === "teal" ? "text-xl font-semibold text-teal" : tone === "amber" ? "text-xl font-semibold text-amber" : tone === "rose" ? "text-xl font-semibold text-rose" : "text-xl font-semibold text-ink"}>{value}</p>
      <p className="text-xs text-ink-3">{hint}</p>
    </Card>
  );
}

function Colleges({ data: d }: { data: BillingOverview }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const clear = useMutation({
    mutationFn: (v: { id: string; cleared: boolean }) => apiFetch(`/api/v1/billing/colleges/${v.id}/clear`, BillingOverview, { method: "POST", body: { cleared: v.cleared } }),
    onSuccess: (r) => qc.setQueryData(KEY, r),
    onError: (e) => setError(errText(e, "Could not change the college.")),
  });
  const csv = () => {
    const head = ["College", "City", "Plan", "Status", "Capacity", "Enrolled", "Fee", "Paid", "Waived", "Pending", "Due", "Collected", "Staff cleared"];
    const rows = d.colleges.map((c) => [c.name, c.city, c.plan, c.status, c.capacity, c.students, c.fee, c.paid, c.waived, c.pending, c.due, c.collected, c.cleared ? "Yes" : "No"]);
    download(`billing-${d.settings.academicYear}.csv`, [head, ...rows]);
  };
  return (
    <Card>
      <CardHeader
        title={`Colleges · ${d.settings.academicYear}`}
        subtitle={d.settings.lockStaff ? "Staff of a college can work once the college is cleared for the year." : "Seats, fee per student and collection for each college."}
        action={
          <Button size="sm" variant="secondary" onClick={csv}>
            <Fi name="download" /> Export CSV
          </Button>
        }
      />
      {error ? (
        <p className="px-5 pb-3 text-sm text-rose" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-5 py-2 font-medium">College</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Seats used</th>
              <th className="px-3 py-2 font-medium">Fee / student</th>
              <th className="px-3 py-2 font-medium">Paid</th>
              <th className="px-3 py-2 font-medium">Pending</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Collected</th>
              <th className="px-5 py-2 font-medium">Staff access</th>
            </tr>
          </thead>
          <tbody>
            {d.colleges.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-3">
                    {c.city} · {c.status}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone="brand">{c.plan}</Badge>
                </td>
                <td className="w-40 px-3 py-3">
                  <Progress value={c.capacity ? Math.min(100, Math.round((c.students / c.capacity) * 100)) : 0} label={`${c.students} of ${c.capacity}`} />
                  <p className="mt-1 text-xs text-ink-3">
                    {c.students.toLocaleString("en-IN")} / {c.capacity.toLocaleString("en-IN")}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink-2">
                  {money(c.fee, d.settings.currency)}
                  {c.feeOverride !== null ? <span className="block text-xs text-ink-3">college fee</span> : null}
                </td>
                <td className="px-3 py-3 text-ink-2">
                  {c.paid}
                  {c.waived ? <span className="text-xs text-ink-3"> +{c.waived} waived</span> : null}
                </td>
                <td className="px-3 py-3">{c.pending ? <Badge tone="amber">{c.pending}</Badge> : <span className="text-ink-3">0</span>}</td>
                <td className="px-3 py-3 text-ink-2">{c.due}</td>
                <td className="px-3 py-3 font-medium text-ink">{money(c.collected, d.settings.currency)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={c.cleared ? "teal" : d.settings.lockStaff && d.lockActive ? "rose" : "neutral"}>{c.cleared ? "Cleared" : d.settings.lockStaff && d.lockActive ? "Locked" : "Not cleared"}</Badge>
                    {d.canEdit ? (
                      <Button size="sm" variant={c.cleared ? "ghost" : "secondary"} disabled={clear.isPending} onClick={() => (setError(null), clear.mutate({ id: c.id, cleared: !c.cleared }))}>
                        {c.cleared ? "Undo" : "Clear"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const STATUSES = ["Pending verification", "Paid", "Failed", "Rejected", "Created"] as const;
const Proof = z.object({ contentType: z.string(), data: z.string() });

function Payments({ canEdit, colleges }: { canEdit: boolean; colleges: CollegeBillingRow[] }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("Pending verification");
  const [college, setCollege] = useState("");
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(college ? { college } : {}) }).toString();
  const q = useQuery({ queryKey: ["billing", "payments", qs], queryFn: () => apiFetch(`/api/v1/billing/payments?${qs}`, PaymentList) });
  const [open, setOpen] = useState<FeePayment | null>(null);
  const csv = () => {
    const rows = (q.data?.payments ?? []).map((p) => [p.createdAt.slice(0, 10), p.receiptNo, p.studentName, p.collegeName ?? p.college, p.academicYear, p.gateway === "offline" ? `Offline · ${p.offlineMode}` : GATEWAY_NAMES[p.gateway], p.gatewayPaymentId || p.offlineRef, p.amount, p.currency, p.status, p.reviewedBy]);
    download(`payments-${status || "all"}.csv`, [["Date", "Receipt", "Student", "College", "Year", "Method", "Reference", "Amount", "Currency", "Status", "Reviewed by"], ...rows]);
  };
  return (
    <Card>
      <CardHeader
        title="Payments"
        subtitle="Online payments confirm themselves; offline payments wait here for you to check the receipt."
        action={
          <Button size="sm" variant="secondary" onClick={csv} disabled={!q.data?.payments.length}>
            <Fi name="download" /> Export CSV
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 px-5 pb-4">
        <select aria-label="Status" className={`${inputClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "Created" ? "Started, not completed" : s}
            </option>
          ))}
        </select>
        {colleges.length > 1 ? (
          <select aria-label="College" className={`${inputClass} w-auto max-w-xs`} value={college} onChange={(e) => setCollege(e.target.value)}>
            <option value="">All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {q.isPending ? (
        <Skeleton className="mx-5 mb-5 h-40" />
      ) : q.isError ? (
        <div className="px-5 pb-5">
          <LoadError error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : q.data.payments.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.payments.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-5 py-3 text-ink-2">{day(p.createdAt)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{p.studentName}</p>
                    <p className="text-xs text-ink-3">{p.collegeName ?? p.college}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-2">{p.gateway === "offline" ? `Offline · ${p.offlineMode}` : GATEWAY_NAMES[p.gateway]}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-xs text-ink-3" title={p.offlineRef || p.gatewayPaymentId}>
                    {p.receiptNo || p.offlineRef || p.gatewayPaymentId || "—"}
                  </td>
                  <td className="px-3 py-3 font-medium text-ink">{money(p.amount, p.currency)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={p.status === "Paid" ? "teal" : p.status === "Pending verification" ? "amber" : p.status === "Created" ? "neutral" : "rose"}>{p.status === "Created" ? "Not completed" : p.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.status === "Pending verification" ? (
                      <Button size="sm" variant="secondary" onClick={() => setOpen(p)}>
                        Review
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm text-ink-3">No payments match.</p>
      )}
      {open ? (
        <Review
          payment={open}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            void qc.invalidateQueries({ queryKey: ["billing"] });
          }}
        />
      ) : null}
    </Card>
  );
}

function Review({ payment: p, canEdit, onClose, onDone }: { payment: FeePayment; canEdit: boolean; onClose: () => void; onDone: () => void }) {
  const proof = useQuery({ queryKey: ["billing", "proof", p.id], queryFn: () => apiFetch(`/api/v1/billing/payments/${p.id}/proof`, Proof) });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: (approve: boolean) => apiFetch(`/api/v1/billing/payments/${p.id}/review`, z.object({ payment: z.unknown() }), { method: "POST", body: { approve, note } }),
    onSuccess: onDone,
    onError: (e) => setError(errText(e, "Could not save the review.")),
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Review offline payment">
      <Card className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">Offline payment</p>
            <p className="text-lg font-semibold text-ink">
              {p.studentName} · {money(p.amount, p.currency)}
            </p>
            <p className="text-sm text-ink-3">
              {p.collegeName ?? p.college} · {p.offlineMode} · {p.offlineRef}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <Fi name="cross" />
          </Button>
        </div>
        <div className="grid min-h-48 place-items-center rounded-xl bg-surface-2 p-2">
          {proof.isPending ? <Spinner /> : proof.isError ? <p className="text-sm text-ink-3">{errText(proof.error, "The receipt image could not be loaded.")}</p> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:${proof.data.contentType};base64,${proof.data.data}`} alt="Receipt submitted by the student" className="max-h-[50vh] w-auto rounded-lg object-contain" />
          )}
        </div>
        {canEdit ? (
          <>
            <Field label="Note (shown to the student if rejected)" htmlFor="review-note">
              <input id="review-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
            {error ? (
              <p className="text-sm text-rose" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="danger" disabled={review.isPending} onClick={() => review.mutate(false)}>
                Reject
              </Button>
              <Button disabled={review.isPending} onClick={() => review.mutate(true)}>
                {review.isPending ? <Spinner /> : <Fi name="check" />} Approve &amp; clear student
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">Switch to “All colleges” to approve or reject.</p>
        )}
      </Card>
    </div>
  );
}

function Students({ canEdit, colleges, currency }: { canEdit: boolean; colleges: CollegeBillingRow[]; currency: string }) {
  const qc = useQueryClient();
  const [college, setCollege] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["billing", "dues", college], queryFn: () => apiFetch(`/api/v1/billing/dues${college ? `?college=${college}` : ""}`, DueList) });
  const change = useMutation({
    mutationFn: (v: { sub: string; status: StudentDue["status"] }) => apiFetch(`/api/v1/billing/dues/${encodeURIComponent(v.sub)}/status`, z.object({ ok: z.boolean() }), { method: "POST", body: { status: v.status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["billing"] }),
    onError: (e) => setError(errText(e, "Could not change the student's fee.")),
  });
  const rows = (q.data?.dues ?? []).filter((d) => (!status || d.status === status) && (!search || d.name.toLowerCase().includes(search.toLowerCase())));
  return (
    <Card>
      <CardHeader title="Students" subtitle="Students appear here once they have signed in this academic year. Waive a fee (scholarship, staff ward…) or mark one paid by other means." />
      <div className="flex flex-wrap gap-3 px-5 pb-4">
        <input aria-label="Search students" placeholder="Search by name" className={`${inputClass} w-56`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Status" className={`${inputClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option>Due</option>
          <option>Paid</option>
          <option>Waived</option>
        </select>
        {colleges.length > 1 ? (
          <select aria-label="College" className={`${inputClass} w-auto max-w-xs`} value={college} onChange={(e) => setCollege(e.target.value)}>
            <option value="">All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {error ? (
        <p className="px-5 pb-3 text-sm text-rose" role="alert">
          {error}
        </p>
      ) : null}
      {q.isPending ? (
        <Skeleton className="mx-5 mb-5 h-40" />
      ) : q.isError ? (
        <div className="px-5 pb-5">
          <LoadError error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-5 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Cleared by</th>
                <th className="px-5 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.userSub} className="border-t border-line">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{d.name || "Student"}</p>
                    <p className="text-xs text-ink-3">{d.collegeName ?? d.college}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-2">{money(d.amount, currency)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={d.status === "Due" ? "amber" : "teal"}>{d.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-3">{d.clearedBy ? `${d.clearedBy} · ${day(d.clearedAt)}` : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {canEdit ? (
                      d.status === "Due" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" disabled={change.isPending} onClick={() => confirm(`Waive ${d.name}'s fee for ${d.academicYear}?`) && change.mutate({ sub: d.userSub, status: "Waived" })}>
                            Waive
                          </Button>
                          <Button size="sm" variant="secondary" disabled={change.isPending} onClick={() => confirm(`Mark ${d.name}'s fee as paid?`) && change.mutate({ sub: d.userSub, status: "Paid" })}>
                            Mark paid
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={change.isPending} onClick={() => confirm(`Set ${d.name}'s fee back to due? Their account may lock.`) && change.mutate({ sub: d.userSub, status: "Due" })}>
                          Set due
                        </Button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm text-ink-3">No students match.</p>
      )}
    </Card>
  );
}

const nextYear = (y: string) => {
  const a = Number(y.slice(0, 4)) + 1;
  return `${a}-${String((a + 1) % 100).padStart(2, "0")}`;
};
const plusYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

function Settings({ data: d }: { data: BillingOverview }) {
  const qc = useQueryClient();
  const [s, setS] = useState<Omit<BillingSettings, "updatedBy" | "updatedAt">>(() => ({ academicYear: d.settings.academicYear, yearStart: d.settings.yearStart, dueDate: d.settings.dueDate, graceDays: d.settings.graceDays, reminderDays: d.settings.reminderDays, currency: d.settings.currency, autoLock: d.settings.autoLock, lockStaff: d.settings.lockStaff, fees: { ...d.settings.fees } }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: (body: typeof s) => apiFetch("/api/v1/billing/settings", BillingOverview, { method: "PUT", body }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, r);
      setMessage({ ok: true, text: "Saved. Changes apply to every college straight away." });
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fields : {});
      setMessage({ ok: false, text: errText(e, "Could not save.") });
    },
  });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));
  const startNewYear = () => {
    const next = { ...s, academicYear: nextYear(s.academicYear), yearStart: plusYear(s.yearStart), dueDate: plusYear(s.dueDate) };
    if (!confirm(`Start ${next.academicYear}? Every student's fee for ${next.academicYear} becomes due (due by ${day(next.dueDate)})${next.autoLock ? `, and unpaid accounts lock after the grace period${next.lockStaff ? "; staff of each college lock until you clear the college" : ""}` : ""}.`)) return;
    setS(next);
    setErrors({});
    setMessage(null);
    save.mutate(next);
  };
  const ro = !d.canEdit;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Academic year" htmlFor="b-year" hint="e.g. 2026-27" error={errors.academicYear}>
            <input id="b-year" className={inputClass} value={s.academicYear} disabled={ro} onChange={(e) => set("academicYear", e.target.value)} maxLength={7} />
          </Field>
          <Field label="Year starts" htmlFor="b-start" error={errors.yearStart}>
            <input id="b-start" type="date" className={inputClass} value={s.yearStart} disabled={ro} onChange={(e) => set("yearStart", e.target.value)} />
          </Field>
          <Field label="Fee due by" htmlFor="b-due" error={errors.dueDate}>
            <input id="b-due" type="date" className={inputClass} value={s.dueDate} disabled={ro} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
          <Field label="Grace period (days)" htmlFor="b-grace" error={errors.graceDays}>
            <input id="b-grace" type="number" min={0} max={120} className={inputClass} value={s.graceDays} disabled={ro} onChange={(e) => set("graceDays", Math.max(0, Math.min(120, Number(e.target.value) || 0)))} />
          </Field>
          <Field label="Remind students (days before)" htmlFor="b-remind" hint="Banner and popup on every student page" error={errors.reminderDays}>
            <input id="b-remind" type="number" min={0} max={90} className={inputClass} value={s.reminderDays} disabled={ro} onChange={(e) => set("reminderDays", Math.max(0, Math.min(90, Number(e.target.value) || 0)))} />
          </Field>
          <Field label="Currency" htmlFor="b-cur" error={errors.currency}>
            <select id="b-cur" className={inputClass} value={s.currency} disabled={ro} onChange={(e) => set("currency", e.target.value as typeof s.currency)}>
              <option>INR</option>
              <option>USD</option>
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">App fee per student, per year</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <Field key={p} label={p} htmlFor={`b-fee-${p}`}>
                <input id={`b-fee-${p}`} type="number" min={0} step="1" className={inputClass} value={s.fees[p]} disabled={ro} onChange={(e) => set("fees", { ...s.fees, [p]: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">Each college pays the fee of its plan (set on the college under Colleges) unless you give it its own fee on the right.</p>
        </div>
        <div className="space-y-3 rounded-xl border border-line p-4">
          <Toggle id="b-lock" label="Lock unpaid accounts automatically" hint={`From the day after the due date plus the grace period (${day(lockDate(s))}), students who have not paid can only open their fee page.`} checked={s.autoLock} disabled={ro} onChange={(v) => set("autoLock", v)} />
          <Toggle id="b-staff" label="Also lock college staff until the college is cleared" hint="Faculty, HODs, placement, incubation and principals of a college wait for you to clear the college under Colleges." checked={s.lockStaff} disabled={ro || !s.autoLock} onChange={(v) => set("lockStaff", v)} />
        </div>
        {message ? (
          <p className={message.ok ? "text-sm text-teal" : "text-sm text-rose"} role="status">
            {message.text}
          </p>
        ) : null}
        {!ro ? (
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" disabled={save.isPending || !d.configured} onClick={startNewYear} title={d.configured ? "" : "Save the settings first"}>
              <Fi name="calendar" /> Start {nextYear(s.academicYear)}
            </Button>
            <Button disabled={save.isPending} onClick={() => (setErrors({}), setMessage(null), save.mutate(s))}>
              {save.isPending ? <Spinner /> : null} {d.configured ? "Save settings" : "Open fee collection"}
            </Button>
          </div>
        ) : null}
        {d.settings.updatedBy ? (
          <p className="text-xs text-ink-3">
            Last changed by {d.settings.updatedBy} on {day(d.settings.updatedAt)}.
          </p>
        ) : null}
      </Card>
      <CollegeFees data={d} />
    </div>
  );
}

const lockDate = (s: { dueDate: string; graceDays: number }) => {
  const x = new Date(`${s.dueDate}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + s.graceDays);
  return x.toISOString().slice(0, 10);
};

function Toggle({ id, label, hint, checked, disabled, onChange }: { id: string; label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={disabled ? "flex cursor-not-allowed items-start gap-3 opacity-60" : "flex cursor-pointer items-start gap-3"}>
      <input id={id} type="checkbox" className="mt-1 size-4 accent-[var(--color-brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

function CollegeFees({ data: d }: { data: BillingOverview }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(d.colleges.map((c) => [c.id, c.feeOverride === null ? "" : String(c.feeOverride)])));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (c: CollegeBillingRow) => apiFetch(`/api/v1/billing/colleges/${c.id}/clear`, BillingOverview, { method: "POST", body: { cleared: c.cleared, feeOverride: values[c.id] === "" ? null : Number(values[c.id]) } }),
    onSuccess: (r) => qc.setQueryData(KEY, r),
    onError: (e) => setError(errText(e, "Could not save the fee.")),
  });
  return (
    <Card className="h-fit p-5">
      <p className="text-sm font-medium text-ink">College&rsquo;s own fee</p>
      <p className="mb-3 text-xs text-ink-3">Leave empty to use the plan fee. New fees apply to students who have not opened their fee page yet this year.</p>
      {error ? (
        <p className="mb-2 text-sm text-rose" role="alert">
          {error}
        </p>
      ) : null}
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {d.colleges.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2" title={c.name}>
              {c.name}
            </span>
            <input aria-label={`Fee for ${c.name}`} type="number" min={0} placeholder={String(d.settings.fees[c.plan as (typeof PLANS)[number]] ?? "")} className={`${inputClass} h-8 w-24`} value={values[c.id] ?? ""} disabled={!d.canEdit} onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))} />
            {d.canEdit ? (
              <Button size="sm" variant="ghost" disabled={save.isPending || (values[c.id] ?? "") === (c.feeOverride === null ? "" : String(c.feeOverride))} onClick={() => (setError(null), save.mutate(c))}>
                Save
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Gateways({ data: d }: { data: BillingOverview }) {
  return (
    <Card>
      <CardHeader
        title="Payment gateways"
        subtitle="Students see every gateway that is switched on. API keys are entered (and stored encrypted) under Integrations & Setup."
        action={
          <Link href="/admin/integrations" className="text-sm font-medium text-brand hover:underline">
            Open Integrations &amp; Setup →
          </Link>
        }
      />
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
        {d.gateways.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-line p-4">
            <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-ink-2">
              <Fi name="credit-card" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-ink">{g.name}</span>
              <span className="block text-xs text-ink-3">{g.enabled ? "Students can pay with it" : "Not set up or switched off"}</span>
            </span>
            <Badge tone={g.enabled ? "teal" : "neutral"}>{g.enabled ? "On" : "Off"}</Badge>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-4 text-xs text-ink-3">
        <p>
          Offline payments (cash, DD, cheque, bank transfer) are always available: the student uploads the receipt and you approve it under Payments. Razorpay can also confirm payments through a webhook: add <code className="rounded bg-surface-2 px-1">/api/payments/razorpay/webhook</code> on your site&rsquo;s address in the Razorpay dashboard.
        </p>
      </div>
    </Card>
  );
}

function download(name: string, rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    let s = String(v);
    // Keep spreadsheet apps from running formulas in names or references.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
