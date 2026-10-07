"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AwardForm, emptyAward, ImageSlot, previewSheet } from "@/components/certificate/award-form";
import { CertificateSheet } from "@/components/certificate/certificate-sheet";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { AwardRow, CertificateProfile, DeskOverview, KIND_INFO, THEME_LABEL, THEMES, type AwardBody, type ProfileBody, type Theme } from "@/lib/api/certificate-schemas";
import { cn } from "@/lib/utils";

const KEY = ["certificate-desk"] as const;
export const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const STATUS_TONE = { Pending: "amber", Issued: "teal", Rejected: "neutral", Revoked: "rose" } as const;

type Tab = "design" | "issue" | "requests" | "register";

/** Certificate Authority (Principal): design, issue, approve requests and keep the register. */
export function CertificateAuthorityModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/certificate-desk", DeskOverview) });
  const [tab, setTab] = useState<Tab>("issue");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; link?: string } | null>(null);
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const pending = d.awards.filter((a) => a.status === "Pending").length;
  const tabs: Array<[Tab, string]> = [
    ["issue", "Issue certificate"],
    ["requests", `Requests${pending ? ` (${pending})` : ""}`],
    ["register", "Register"],
    ["design", "Certificate design"],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon="diploma" label="Issued by you" value={d.counts.issued} />
        <Tile icon="time-quarter-past" label="Waiting for approval" value={d.counts.pending} tone={d.counts.pending ? "amber" : undefined} />
        <Tile icon="cross-circle" label="Revoked" value={d.counts.revoked} />
        <Tile icon="graduation-cap" label="Course & quiz certificates" value={d.counts.courseCertificates} />
      </div>
      {d.reviewOnly ? (
        <Card className="flex items-start gap-3 border-brand/30 p-4 text-sm text-ink-2">
          <Fi name="eye" className="mt-0.5 text-lg text-brand" />
          <p>{d.reviewOnly}</p>
        </Card>
      ) : !d.canAuthorize ? (
        <Card className="p-4 text-sm text-ink-2">Confirm your sign-in code to issue or change certificates.</Card>
      ) : null}
      {message ? (
        <div role={message.tone === "error" ? "alert" : "status"} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
          <span>{message.text}</span>
          {message.link ? (
            <Link href={message.link} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              View &amp; print
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Certificate authority">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-xl px-3 py-1.5 text-sm font-medium", tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "issue" ? <IssueTab d={d} say={setMessage} /> : null}
      {tab === "requests" ? <RequestsTab d={d} say={setMessage} /> : null}
      {tab === "register" ? <RegisterTab d={d} say={setMessage} /> : null}
      {tab === "design" ? <DesignTab d={d} say={setMessage} /> : null}
    </div>
  );
}

type Say = (m: { tone: "ok" | "error"; text: string; link?: string } | null) => void;

function Tile({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: "amber" }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-lg", tone === "amber" ? "bg-amber-soft text-amber" : "bg-gold-soft text-gold")}>
        <Fi name={icon} />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
    </Card>
  );
}

/* ───────────────────────────── issue ───────────────────────────── */
function IssueTab({ d, say }: { d: DeskOverview; say: Say }) {
  const qc = useQueryClient();
  const origin = useOrigin();
  const [draft, setDraft] = useState<AwardBody>(emptyAward());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const issue = useMutation({
    mutationFn: (b: AwardBody) => apiFetch("/api/v1/certificate-desk/awards", AwardRow, { method: "POST", body: b }),
    onSuccess: (r) => {
      setDraft(emptyAward());
      setErrors({});
      say({ tone: "ok", text: `Issued ${r.publicId} to ${r.recipientName}.`, link: `/verify/${r.publicId}` });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      say({ tone: "error", text: e instanceof ApiError ? e.message : "Could not issue the certificate." });
    },
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_1fr]">
      <Card>
        <CardHeader title="Issue a certificate" subtitle="Signed under your authority as Principal. It is verifiable online the moment you issue it." />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              issue.mutate(draft);
            }}
            className="space-y-5"
          >
            <AwardForm value={draft} onChange={setDraft} students={d.students} errors={errors} />
            <Button type="submit" className="w-full" disabled={!d.canAuthorize || issue.isPending}>
              {issue.isPending ? <Spinner /> : <Fi name="diploma" />} Sign &amp; issue certificate
            </Button>
          </form>
        </CardBody>
      </Card>
      <PreviewPane title="Live preview">
        <CertificateSheet data={previewSheet(draft, d.profile)} verifyUrl={`${origin || "https://your-college"}/verify/CIQ-0000-PREVIEW`} />
      </PreviewPane>
    </div>
  );
}

function PreviewPane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
      <p className="text-sm font-medium text-ink-3">{title}</p>
      <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-black/5">{children}</div>
    </div>
  );
}

/* ───────────────────────────── requests ───────────────────────────── */
function useDecision(say: Say) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" | "revoke"; note: string }) => apiFetch(`/api/v1/certificate-desk/awards/${encodeURIComponent(v.id)}/${v.action}`, AwardRow, { method: "POST", body: { note: v.note } }),
    onSuccess: (r, v) => {
      say({ tone: "ok", text: v.action === "approve" ? `Approved and issued ${r.publicId} to ${r.recipientName}.` : v.action === "reject" ? `Rejected the request for ${r.recipientName}.` : `Revoked ${r.publicId}. Its verification page now shows it as revoked.`, link: r.publicId && v.action !== "reject" ? `/verify/${r.publicId}` : undefined });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => say({ tone: "error", text: e instanceof ApiError ? Object.values(e.fields)[0] ?? e.message : "Could not save the decision." }),
  });
}

function RequestsTab({ d, say }: { d: DeskOverview; say: Say }) {
  const origin = useOrigin();
  const decide = useDecision(say);
  const pending = d.awards.filter((a) => a.status === "Pending");
  const [openId, setOpenId] = useState<string | null>(pending[0]?.id ?? null);
  const open = pending.find((a) => a.id === openId) ?? pending[0];
  const [note, setNote] = useState("");
  if (!pending.length) return <EmptyState title="No requests waiting" body="When faculty or HODs request a certificate, it waits here for your approval." />;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_1fr]">
      <Card>
        <CardHeader title="Waiting for your approval" />
        <ul className="divide-y divide-line">
          {pending.map((a) => (
            <li key={a.id}>
              <button onClick={() => setOpenId(a.id)} className={cn("w-full px-4 py-3 text-left", open?.id === a.id ? "bg-brand-soft" : "hover:bg-surface-2")}>
                <p className="font-medium text-ink">{a.recipientName}</p>
                <p className="text-xs text-ink-3">
                  {KIND_INFO[a.kind].label} · requested by {a.requestedBy} ({a.requestedRole === "hod" ? "HOD" : "Faculty"}) · {fmt(a.createdAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {open ? (
        <div className="space-y-3">
          <PreviewPane title="What will be issued">
            <CertificateSheet data={previewSheet(open, d.profile)} verifyUrl={`${origin || "https://your-college"}/verify/CIQ-0000-PREVIEW`} />
          </PreviewPane>
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <Field label="Note (optional, kept in the register)" htmlFor="decision-note">
                <input id="decision-note" className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            <Button variant="secondary" disabled={!d.canAuthorize || decide.isPending} onClick={() => decide.mutate({ id: open.id, action: "reject", note }, { onSuccess: () => setNote("") })}>
              Reject
            </Button>
            <Button disabled={!d.canAuthorize || decide.isPending} onClick={() => decide.mutate({ id: open.id, action: "approve", note }, { onSuccess: () => setNote("") })}>
              {decide.isPending ? <Spinner /> : <Fi name="diploma" />} Approve &amp; issue
            </Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── register ───────────────────────────── */
function RegisterTab({ d, say }: { d: DeskOverview; say: Say }) {
  const decide = useDecision(say);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"All" | "Issued" | "Revoked" | "Rejected">("All");
  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    return d.awards.filter((a) => a.status !== "Pending" && (status === "All" || a.status === status) && (!t || `${a.recipientName} ${a.publicId ?? ""} ${a.eventName} ${a.recipientDetail}`.toLowerCase().includes(t)));
  }, [d.awards, text, status]);
  return (
    <Card>
      <CardHeader title="Certificate register" subtitle="Every certificate issued, rejected or revoked under your authority." />
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-2">
          <input aria-label="Search the register" className={cn(inputClass, "max-w-xs")} placeholder="Search name, ID or event" value={text} onChange={(e) => setText(e.target.value)} />
          {(["All", "Issued", "Revoked", "Rejected"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn("rounded-full px-3 py-1 text-xs font-medium", status === s ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}>
              {s}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <EmptyState title="Nothing here yet" body="Certificates you issue appear in this register." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Certificate</th>
                  <th className="py-2 pr-3 font-medium">Recipient</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Issued</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 pr-3">{a.publicId ? <Link href={`/verify/${a.publicId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand hover:underline">{a.publicId}</Link> : <span className="text-ink-3">—</span>}</td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-ink">{a.recipientName}</p>
                      <p className="text-xs text-ink-3">{a.recipientDetail}</p>
                    </td>
                    <td className="py-3 pr-3 text-ink-2">{KIND_INFO[a.kind].label}</td>
                    <td className="py-3 pr-3 text-ink-3">{fmt(a.issuedAt)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                      {a.decisionNote ? <p className="mt-1 max-w-[220px] truncate text-xs text-ink-3" title={a.decisionNote}>{a.decisionNote}</p> : null}
                    </td>
                    <td className="py-3 text-right">
                      {a.status === "Issued" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!d.canAuthorize || decide.isPending}
                          onClick={() => {
                            const note = window.prompt(`Why are you revoking ${a.publicId}? (shown on its verification page)`);
                            if (note && note.trim().length >= 5) decide.mutate({ id: a.id, action: "revoke", note: note.trim() });
                          }}
                        >
                          <Fi name="ban" className="text-rose" /> Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ───────────────────────────── design ───────────────────────────── */
function DesignTab({ d, say }: { d: DeskOverview; say: Say }) {
  const qc = useQueryClient();
  const origin = useOrigin();
  const { updatedAt, updatedBy, ...initial } = d.profile;
  void updatedAt;
  void updatedBy;
  const [form, setForm] = useState<ProfileBody>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ProfileBody>(k: K, v: ProfileBody[K]) => setForm({ ...form, [k]: v });
  const save = useMutation({
    mutationFn: (b: ProfileBody) => apiFetch("/api/v1/certificate-desk/profile", CertificateProfile, { method: "PUT", body: b }),
    onSuccess: () => {
      setErrors({});
      say({ tone: "ok", text: "Certificate design saved. Every certificate of the college, old and new, now prints with it." });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      say({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save the design." });
    },
  });
  const sample: AwardBody = { kind: "appreciation", recipientName: "Anand Kumar", recipientSub: null, recipientDetail: "21CS1014 · B.E. Computer Science & Engineering", reason: KIND_INFO.appreciation.example, eventName: "TECHNOVA 2026", eventDate: "" };
  const text = (k: "collegeName" | "affiliation" | "address" | "contact" | "accreditation" | "motto" | "principalName" | "principalDesignation", label: string, max: number, hint?: string) => (
    <Field label={label} htmlFor={`cd-${k}`} error={errors[k]} hint={hint}>
      <input id={`cd-${k}`} className={inputClass} maxLength={max} value={form[k]} onChange={(e) => set(k, e.target.value)} disabled={!d.canAuthorize} />
    </Field>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_1fr]">
      <Card>
        <CardHeader title="Certificate design" subtitle="Applies to every certificate your college issues: course, quiz and those you sign." />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Header</p>
            {text("collegeName", "College name", 120)}
            {text("affiliation", "Affiliation / university line", 160, "e.g. Affiliated to … · Approved by AICTE, New Delhi")}
            {text("address", "Address", 200)}
            {text("contact", "Contact line (optional)", 160, "Phone, e-mail or website")}
            {text("accreditation", "Accreditation badge (optional)", 120, "e.g. NAAC A++ · NBA Accredited")}
            {text("motto", "Motto (optional)", 120)}
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Seal &amp; signature</p>
            <ImageSlot id="cd-logo" label="College logo" hint="Square PNG with a transparent background works best." value={form.logoRef} onChange={(v) => set("logoRef", v)} disabled={!d.canAuthorize} />
            <ImageSlot id="cd-seal" label="College seal" hint="A scan of the round seal. Without one, a seal is drawn from the college name." value={form.sealRef} onChange={(v) => set("sealRef", v)} disabled={!d.canAuthorize} />
            <ImageSlot id="cd-sign" label="Principal's signature" hint="Sign on white paper, scan, and crop tightly. Without one, your name is set in script." value={form.signatureRef} onChange={(v) => set("signatureRef", v)} disabled={!d.canAuthorize} />
            {text("principalName", "Principal's name (printed under the signature)", 80)}
            {text("principalDesignation", "Designation", 80)}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Colour theme</legend>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t: Theme) => (
                  <button key={t} type="button" aria-pressed={form.theme === t} onClick={() => set("theme", t)} disabled={!d.canAuthorize} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", form.theme === t ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>
                    <span className="size-4 rounded-full" style={{ background: { classic: "#1b2a4a", royal: "#14286e", emerald: "#0f3d33", maroon: "#5a1426" }[t] }} />
                    {THEME_LABEL[t]}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="w-full" disabled={!d.canAuthorize || save.isPending}>
              {save.isPending ? <Spinner /> : null} Save design
            </Button>
            {d.profile.updatedAt ? <p className="text-center text-xs text-ink-3">Last changed {fmt(d.profile.updatedAt)} by {d.profile.updatedBy}</p> : null}
          </form>
        </CardBody>
      </Card>
      <PreviewPane title="Live preview (sample certificate)">
        <CertificateSheet data={previewSheet(sample, { ...d.profile, ...form })} verifyUrl={`${origin || "https://your-college"}/verify/CIQ-0000-PREVIEW`} />
      </PreviewPane>
    </div>
  );
}
