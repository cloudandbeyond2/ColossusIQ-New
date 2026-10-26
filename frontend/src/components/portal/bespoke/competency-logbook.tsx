"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { LogbookOverview, type LogbookLevel, type LogbookRow } from "@/lib/api/logbook-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, EmptyState, inputClass, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const LEVELS: LogbookLevel[] = ["K", "KH", "SH", "P"];
const LEVEL_HELP: Record<LogbookLevel, string> = { K: "Knows", KH: "Knows how", SH: "Shows how", P: "Performs" };
const STATUS_FILTERS = ["All", "Not attempted", "Pending review", "Returned", "Certified"] as const;

type Tone = "neutral" | "teal" | "amber" | "rose" | "sky" | "brand";
const statusTone = (s: string): Tone => (s === "Certified" ? "teal" : s === "Pending review" ? "amber" : s === "Returned" ? "rose" : "neutral");
const levelTone = (l: LogbookLevel): Tone => (l === "P" ? "teal" : l === "SH" ? "amber" : l === "KH" ? "sky" : "neutral");

const ok = z.object({ ok: z.boolean() }).passthrough();
const added = z.object({ added: z.number(), skipped: z.number() });

/** "CODE | description | department | level" per line (tabs also work). */
function parseBulk(text: string): { items: Array<{ code: string; description: string; department: string; level: LogbookLevel }>; error: string | null } {
  const items: Array<{ code: string; description: string; department: string; level: LogbookLevel }> = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const parts = line.split(/\s*[|\t]\s*/);
    const [code, description, department, level] = parts;
    if (parts.length < 4 || !code || !description || !department) return { items: [], error: `Line ${i + 1}: use CODE | description | department | level` };
    const lv = (level ?? "").toUpperCase() as LogbookLevel;
    if (!LEVELS.includes(lv)) return { items: [], error: `Line ${i + 1}: level must be K, KH, SH or P` };
    items.push({ code, description, department, level: lv });
  }
  return { items, error: null };
}

export function CompetencyLogbookModule() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"entries" | "catalogue">("entries");
  const [status, setStatus] = useState<string>("All");
  const [dept, setDept] = useState("All departments");
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [requesting, setRequesting] = useState<LogbookRow | null>(null);
  const [reqNotes, setReqNotes] = useState("");
  const [reviewing, setReviewing] = useState<LogbookRow | null>(null);
  const [remarks, setRemarks] = useState("");

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState<LogbookLevel>("SH");
  const [bulk, setBulk] = useState("");

  const query = useQuery({
    queryKey: ["competency-logbook"],
    queryFn: () => apiFetch("/api/v1/competency-logbook", LogbookOverview),
  });

  const note = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 4000);
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: ["competency-logbook"] });
  const fail = (e: unknown) => setFormError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

  const requestMutation = useMutation({
    mutationFn: (v: { competencyId: string; notes: string }) => apiFetch("/api/v1/competency-logbook/requests", ok, { method: "POST", body: v }),
    onSuccess: () => {
      refresh();
      setRequesting(null);
      setReqNotes("");
      note("Sign-off requested. Your faculty will review it.");
    },
    onError: fail,
  });

  const reviewMutation = useMutation({
    mutationFn: (v: { id: string; decision: "Certified" | "Returned"; remarks: string }) =>
      apiFetch(`/api/v1/competency-logbook/entries/${encodeURIComponent(v.id)}`, ok, { method: "PATCH", body: { decision: v.decision, remarks: v.remarks } }),
    onSuccess: (_r, v) => {
      refresh();
      setReviewing(null);
      setRemarks("");
      note(v.decision === "Certified" ? "Competency certified." : "Returned to the student.");
    },
    onError: fail,
  });

  const addMutation = useMutation({
    mutationFn: (items: Array<{ code: string; description: string; department: string; level: LogbookLevel }>) =>
      apiFetch("/api/v1/competency-logbook/competencies", added, { method: "POST", body: { items } }),
    onSuccess: (r) => {
      refresh();
      setCode("");
      setDescription("");
      setBulk("");
      setFormError(null);
      note(r.added > 0 ? `Added ${r.added} competenc${r.added === 1 ? "y" : "ies"}${r.skipped ? ` (${r.skipped} already listed)` : ""}.` : "Those competency codes are already listed.");
    },
    onError: fail,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/competency-logbook/competencies/${encodeURIComponent(id)}`, ok, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      note("Competency removed, along with any sign-offs recorded against it.");
    },
    onError: fail,
  });

  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (status === "All" || r.status === status) &&
        (dept === "All departments" || r.department === dept) &&
        (!q || [r.code, r.description, r.studentName, r.rollNo].some((v) => v.toLowerCase().includes(q))),
    );
  }, [data, status, dept, search]);

  if (query.isLoading) return <TemplateSkeleton />;
  if (query.error || !data) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;

  const reviewer = data.mode === "reviewer";
  const { summary, permissions } = data;
  const pct = !reviewer && summary.total > 0 ? Math.round((summary.certified / summary.total) * 100) : null;

  const submitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    addMutation.mutate([{ code: code.trim(), description: description.trim(), department: department.trim(), level }]);
  };
  const submitBulk = () => {
    setFormError(null);
    const p = parseBulk(bulk);
    if (p.error) return setFormError(p.error);
    if (p.items.length === 0) return setFormError("Paste at least one line.");
    addMutation.mutate(p.items);
  };

  return (
    <div className="space-y-5">
      {flash && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {flash}
        </div>
      )}
      {formError && !requesting && !reviewing && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{formError}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardBody className="p-4">
          <div className="text-xs text-[var(--ink-2)]">{reviewer ? "Awaiting your review" : "Certified"}</div>
          <div className="text-2xl font-bold text-[var(--ink)]">{reviewer ? summary.pending : `${summary.certified} / ${summary.total}`}</div>
          {pct !== null && <div className="text-xs text-[var(--ink-3)]">{pct}% of your logbook</div>}
        </CardBody></Card>
        <Card><CardBody className="p-4">
          <div className="text-xs text-[var(--ink-2)]">{reviewer ? "Certified" : "Pending review"}</div>
          <div className="text-2xl font-bold text-[var(--ink)]">{reviewer ? summary.certified : summary.pending}</div>
        </CardBody></Card>
        <Card><CardBody className="p-4">
          <div className="text-xs text-[var(--ink-2)]">Returned</div>
          <div className="text-2xl font-bold text-[var(--ink)]">{summary.returned}</div>
        </CardBody></Card>
        <Card><CardBody className="p-4">
          <div className="text-xs text-[var(--ink-2)]">{reviewer ? "Competencies listed" : "Not attempted"}</div>
          <div className="text-2xl font-bold text-[var(--ink)]">{reviewer ? data.competencies.length : summary.notAttempted}</div>
        </CardBody></Card>
      </div>

      {reviewer && (
        <div className="flex gap-2 border-b border-[var(--line)]">
          {([["entries", `Sign-offs (${data.rows.length})`], ["catalogue", `Competency list (${data.competencies.length})`]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("px-3.5 py-2 text-sm font-medium border-b-2", tab === k ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(!reviewer || tab === "entries") && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input className={cn(inputClass, "sm:max-w-xs text-xs")} placeholder={reviewer ? "Search competency or student..." : "Search competency..."} value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={cn(inputClass, "sm:w-48 text-xs")} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.filter((s) => reviewer ? s !== "Not attempted" : true).map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className={cn(inputClass, "sm:w-56 text-xs")} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option>All departments</option>
              {data.departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          {data.competencies.length === 0 ? (
            <EmptyState
              title="No competencies listed yet"
              body={permissions.manage ? "Add the college's competencies on the Competency list tab; students can then request sign-off on them." : "Your faculty hasn't added any competencies yet."}
            />
          ) : rows.length === 0 ? (
            <EmptyState title={reviewer ? "No sign-off requests yet" : "Nothing matches"} body={reviewer ? "Requests appear here when students ask for sign-off." : "Try a different filter."} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs text-[var(--ink-2)]">
                <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                  <tr>
                    {reviewer && <th className="p-3">Student</th>}
                    <th className="p-3">Competency</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">{reviewer ? "Student note" : "Faculty remarks"}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rows.map((r) => (
                    <tr key={`${r.competencyId}-${r.studentSub}`}>
                      {reviewer && (
                        <td className="p-3 text-[var(--ink)]">
                          <div className="font-medium">{r.studentName || "Student"}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">{r.rollNo}</div>
                        </td>
                      )}
                      <td className="p-3 text-[var(--ink)]">
                        <div className="font-mono font-semibold">{r.code}</div>
                        <div className="text-[11px] text-[var(--ink-2)]">{r.description}</div>
                      </td>
                      <td className="p-3">{r.department}</td>
                      <td className="p-3"><Badge tone={levelTone(r.level)}>{r.level} · {LEVEL_HELP[r.level]}</Badge></td>
                      <td className="p-3">{r.attempts}</td>
                      <td className="p-3">
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                        {r.status === "Certified" && r.certifiedBy && <div className="text-[11px] text-[var(--ink-3)] mt-0.5">by {r.certifiedBy}</div>}
                      </td>
                      <td className="p-3 max-w-[16rem]">{(reviewer ? r.notes : r.remarks) || "—"}</td>
                      <td className="p-3 whitespace-nowrap">
                        {!reviewer && permissions.request && (r.status === "Not attempted" || r.status === "Returned") && (
                          <Button size="sm" variant="secondary" className="text-xs h-7 px-2.5" onClick={() => { setFormError(null); setRequesting(r); }}>
                            Request sign-off
                          </Button>
                        )}
                        {reviewer && permissions.certify && r.status === "Pending review" && (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="primary" className="text-xs h-7 px-2.5" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: r.entryId, decision: "Certified", remarks: "" })}>
                              Certify
                            </Button>
                            <Button size="sm" variant="secondary" className="text-xs h-7 px-2.5" onClick={() => { setFormError(null); setReviewing(r); }}>
                              Return
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reviewer && tab === "catalogue" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardBody className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-[var(--ink)]">Add a competency</h3>
            <form onSubmit={submitSingle} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={cn(inputClass, "text-xs")} placeholder="Code, e.g. PA 7.1" value={code} onChange={(e) => setCode(e.target.value)} required />
                <select className={cn(inputClass, "text-xs")} value={level} onChange={(e) => setLevel(e.target.value as LogbookLevel)}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l} · {LEVEL_HELP[l]}</option>)}
                </select>
              </div>
              <input className={cn(inputClass, "w-full text-xs")} placeholder="Department, e.g. Pathology" value={department} onChange={(e) => setDepartment(e.target.value)} required />
              <textarea className={cn(inputClass, "w-full text-xs")} rows={2} placeholder="What the student must be able to do" value={description} onChange={(e) => setDescription(e.target.value)} required />
              <Button type="submit" size="sm" variant="primary" disabled={addMutation.isPending} className="flex items-center gap-1.5">
                {addMutation.isPending && <Spinner className="size-3.5" />} Add competency
              </Button>
            </form>
          </CardBody></Card>
          <Card><CardBody className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-[var(--ink)]">Paste a list</h3>
            <p className="text-[11px] text-[var(--ink-3)]">One per line: CODE | description | department | level (K, KH, SH or P). Codes already listed are skipped.</p>
            <textarea className={cn(inputClass, "w-full text-xs font-mono")} rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="PA 7.1 | Define and classify neoplasia | Pathology | K" />
            <Button size="sm" variant="secondary" onClick={submitBulk} disabled={addMutation.isPending}>Add all</Button>
          </CardBody></Card>

          <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {data.competencies.length === 0 ? (
              <div className="p-6"><EmptyState title="No competencies yet" body="Add one above or paste a list." /></div>
            ) : (
              <table className="w-full text-left text-xs text-[var(--ink-2)]">
                <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                  <tr><th className="p-3">Code</th><th className="p-3">Description</th><th className="p-3">Department</th><th className="p-3">Level</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {data.competencies.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3 font-mono font-semibold text-[var(--ink)]">{c.code}</td>
                      <td className="p-3">{c.description}</td>
                      <td className="p-3">{c.department}</td>
                      <td className="p-3"><Badge tone={levelTone(c.level)}>{c.level}</Badge></td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs h-7 px-2.5"
                          disabled={removeMutation.isPending}
                          onClick={() => { if (window.confirm(`Remove ${c.code}? Sign-offs recorded against it will be removed too.`)) removeMutation.mutate(c.id); }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {requesting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl p-4 space-y-3">
            <h3 className="font-semibold text-base text-[var(--ink)]">Request sign-off: {requesting.code}</h3>
            <p className="text-xs text-[var(--ink-2)]">{requesting.description}</p>
            {requesting.status === "Returned" && requesting.remarks && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200"><strong>Faculty remarks:</strong> {requesting.remarks}</div>
            )}
            {formError && <div className="p-2 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">{formError}</div>}
            <textarea className={cn(inputClass, "w-full text-xs")} rows={3} placeholder="Where and with whom you performed it (optional)" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRequesting(null)} disabled={requestMutation.isPending}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={requestMutation.isPending} onClick={() => requestMutation.mutate({ competencyId: requesting.competencyId, notes: reqNotes })} className="flex items-center gap-1.5">
                {requestMutation.isPending && <Spinner className="size-3.5" />} Send request
              </Button>
            </div>
          </div>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl p-4 space-y-3">
            <h3 className="font-semibold text-base text-[var(--ink)]">Return {reviewing.code} to {reviewing.studentName || "the student"}</h3>
            {formError && <div className="p-2 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">{formError}</div>}
            <textarea className={cn(inputClass, "w-full text-xs")} rows={3} placeholder="What does the student need to redo?" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReviewing(null)} disabled={reviewMutation.isPending}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={reviewMutation.isPending || remarks.trim() === ""} onClick={() => reviewMutation.mutate({ id: reviewing.entryId, decision: "Returned", remarks })} className="flex items-center gap-1.5">
                {reviewMutation.isPending && <Spinner className="size-3.5" />} Return
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
