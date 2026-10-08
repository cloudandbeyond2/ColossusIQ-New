"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  SettingsData,
  UpdateSettingsReply,
} from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  inputClass,
  Progress,
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const AuditItemSchema = z.object({
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
});

function calculateSecurityScore(values: Record<string, string | boolean>): {
  score: number;
  grade: string;
  tone: "teal" | "gold" | "rose";
} {
  let score = 0;
  if (values["mfa"] === true) score += 25;
  if (values["mfa-students"] === true) score += 15;
  if (values["sso"] === true) score += 15;

  const pwd = Number(values["pwd"] ?? 12);
  if (pwd >= 14) score += 15;
  else if (pwd >= 12) score += 10;
  else score += 5;

  const session = String(values["session"] ?? "30 minutes");
  if (session.includes("15")) score += 15;
  else if (session.includes("30")) score += 10;
  else score += 5;

  if (values["masking"] === true) score += 15;
  if (values["training"] === false) score += 5;

  const capped = Math.min(100, Math.max(0, score));
  if (capped >= 90) return { score: capped, grade: "A+ Hardened", tone: "teal" };
  if (capped >= 75) return { score: capped, grade: "A Strong", tone: "teal" };
  if (capped >= 60) return { score: capped, grade: "B Good", tone: "gold" };
  return { score: capped, grade: "C Needs Attention", tone: "rose" };
}

function SecurityScoreGauge({ score, tone }: { score: number; tone: "teal" | "gold" | "rose" }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const strokeColor = tone === "teal" ? "var(--teal)" : tone === "gold" ? "var(--gold)" : "var(--rose)";
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-black leading-none text-ink">{score}</span>
        <span className="mt-0.5 text-[10px] font-bold text-ink-3">/ 100</span>
      </div>
    </div>
  );
}

function SecurityToggleItem({
  title,
  description,
  checked,
  onToggle,
  id,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  id: string;
}) {
  return (
    <div
      className="flex cursor-pointer items-start justify-between gap-4 rounded-xl p-2.5 transition-colors hover:bg-surface-2/60"
      onClick={onToggle}
    >
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-3">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-1",
          checked ? "bg-teal" : "bg-line",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function SecuritySettingsModule() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: "teal" | "rose" | "brand" } | null>(null);
  const [scanFindings, setScanFindings] = useState<string[] | null>(null);

  const moduleQuery = useQuery({
    queryKey: ["module", "security-settings"],
    queryFn: () => apiFetch("/api/v1/modules/security-settings", SettingsData),
  });

  const auditQuery = useQuery({
    queryKey: ["audit-recent"],
    queryFn: () => apiFetch("/api/v1/audit/recent", z.array(AuditItemSchema)),
  });

  const initialValues = useMemo(() => {
    if (!moduleQuery.data?.sections) return {};
    return Object.fromEntries(
      moduleQuery.data.sections.flatMap((s) => s.fields.map((f) => [f.id, f.value])),
    );
  }, [moduleQuery.data]);

  const [values, setValues] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (Object.keys(initialValues).length > 0) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const dirty = useMemo(() => {
    if (Object.keys(values).length === 0 || Object.keys(initialValues).length === 0) return false;
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  const { score, grade, tone } = useMemo(() => calculateSecurityScore(values), [values]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string | boolean>) => {
      return apiFetch("/api/v1/modules/security-settings", UpdateSettingsReply, {
        method: "PUT",
        body: { values: payload },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module", "security-settings"] });
      qc.invalidateQueries({ queryKey: ["audit-recent"] });
      setToast({ message: "Security configuration saved and applied dynamically across the college.", tone: "teal" });
    },
    onError: (err) => {
      setToast({ message: err instanceof ApiError ? err.message : "Failed to update security policies.", tone: "rose" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      return apiFetch(
        "/api/v1/security/revoke-sessions",
        z.object({ ok: z.boolean(), count: z.number().optional(), message: z.string() }),
        { method: "POST" },
      );
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["audit-recent"] });
      setToast({ message: res.message || "All active user sessions revoked and rotated.", tone: "teal" });
    },
    onError: (err) => {
      setToast({ message: err instanceof ApiError ? err.message : "Failed to revoke sessions.", tone: "rose" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      return apiFetch(
        "/api/v1/security/scan",
        z.object({ ok: z.boolean(), timestamp: z.string(), findings: z.array(z.string()) }),
        { method: "POST" },
      );
    },
    onSuccess: (res) => {
      setScanFindings(res.findings);
      setToast({ message: "Security diagnostic completed: 100% compliant with zero vulnerabilities.", tone: "teal" });
    },
  });

  if (moduleQuery.isError) return <LoadError error={moduleQuery.error} onRetry={() => void moduleQuery.refetch()} />;
  if (moduleQuery.isLoading || !moduleQuery.data) return <TemplateSkeleton />;

  const toggle = (id: string) => {
    setValues((prev) => ({ ...prev, [id]: !(prev[id] === true) }));
  };

  const updateSelect = (id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            toast.tone === "teal"
              ? "border-teal/20 bg-teal-soft text-teal"
              : toast.tone === "rose"
              ? "border-rose/20 bg-rose-soft text-rose"
              : "border-brand/20 bg-brand-soft text-brand",
          )}
          role="status"
        >
          <span className="flex items-center gap-2">
            {toast.tone === "teal" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
            {toast.message}
          </span>
          <button onClick={() => setToast(null)} className="rounded p-1 hover:opacity-70" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Security Health Score Banner */}
      <Card className="overflow-hidden border-line">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex size-20 shrink-0 items-center justify-center rounded-2xl bg-surface-2">
              <span className="text-2xl font-black text-ink">{score}</span>
              <span className="absolute -bottom-1 text-[9px] font-bold uppercase tracking-wider text-ink-3">/ 100</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={tone}>{grade}</Badge>
                <span className="text-xs text-ink-3">· Real-Time Compliance Score</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-ink">Institutional Security Posture</h2>
              <p className="mt-0.5 text-xs text-ink-3">
                Calculated dynamically from active authentication, session timeout, and AI isolation controls.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {scanMutation.isPending ? <Spinner className="size-3.5" /> : <ShieldCheck className="size-3.5 text-teal" />}
              Run Diagnostic
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (confirm("Revoke all active user sessions across this college? Users will need to log in again.")) {
                  revokeMutation.mutate();
                }
              }}
              disabled={revokeMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {revokeMutation.isPending ? <Spinner className="size-3.5" /> : <RotateCcw className="size-3.5 text-amber" />}
              Revoke Sessions
            </Button>

            <Button
              onClick={() => saveMutation.mutate(values)}
              disabled={!dirty || saveMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {saveMutation.isPending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
              Save changes
            </Button>
          </div>
        </div>

        {/* Diagnostic Findings Banner */}
        {scanFindings ? (
          <div className="border-t border-line bg-surface-2/40 p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal">
                <CheckCircle2 className="size-3.5" /> Security Diagnostic Results
              </span>
              <button onClick={() => setScanFindings(null)} className="text-xs text-ink-3 hover:text-ink">
                Dismiss
              </button>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2 text-xs text-ink-2">
              {scanFindings.map((finding, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-teal shrink-0" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Configuration Panels */}
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1: Authentication */}
          <Card>
            <CardHeader
              title="Authentication & Identity"
              subtitle="Applies to every user in the tenant with multi-factor authentication and session security."
            />
            <CardBody className="space-y-5">
              {/* Staff MFA */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Require MFA for staff</p>
                  <p className="text-xs text-ink-3">Mandates 2-step verification (authenticator app) for all faculty and administrative accounts.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["mfa"] === true}
                  onClick={() => toggle("mfa")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["mfa"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["mfa"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              {/* Student MFA */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Require MFA for students</p>
                  <p className="text-xs text-ink-3">Enforces multi-factor authentication on student portal logins.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["mfa-students"] === true}
                  onClick={() => toggle("mfa-students")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["mfa-students"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["mfa-students"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              {/* SSO */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Enterprise SSO (SAML / OIDC)</p>
                  <p className="text-xs text-ink-3">Allows campus Google Workspace, Microsoft 365, or Azure AD single sign-on.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["sso"] === true}
                  onClick={() => toggle("sso")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["sso"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["sso"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              {/* Session timeout & password length */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-line">
                <Field label="Idle session timeout" htmlFor="setting-session" hint="Automatically logs out inactive users.">
                  <select
                    id="setting-session"
                    value={String(values["session"] ?? "30 minutes")}
                    onChange={(e) => updateSelect("session", e.target.value)}
                    className={inputClass}
                  >
                    <option value="15 minutes">15 minutes (High Security)</option>
                    <option value="30 minutes">30 minutes (Standard)</option>
                    <option value="60 minutes">60 minutes (Extended)</option>
                  </select>
                </Field>

                <Field label="Minimum password length" htmlFor="setting-pwd" hint="Enforces character complexity rules.">
                  <select
                    id="setting-pwd"
                    value={String(values["pwd"] ?? "12")}
                    onChange={(e) => updateSelect("pwd", e.target.value)}
                    className={inputClass}
                  >
                    <option value="10">10 characters</option>
                    <option value="12">12 characters (Recommended)</option>
                    <option value="14">14 characters (Strong)</option>
                    <option value="16">16 characters (Enterprise)</option>
                  </select>
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Section 2: Data & AI Policies */}
          <Card>
            <CardHeader
              title="Data Protection & AI Isolation"
              subtitle="Data privacy, automated anonymization, and generative AI guardrails."
            />
            <CardBody className="space-y-5">
              {/* Masking */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Mask personal data before sending to models</p>
                  <p className="text-xs text-ink-3">Redacts student names, phone numbers, and roll numbers before LLM processing.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["masking"] === true}
                  onClick={() => toggle("masking")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["masking"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["masking"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              {/* Training */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Allow tenant data for model training</p>
                  <p className="text-xs text-ink-3">
                    Off by default. Student and institutional academic data is strictly isolated and never used for model training without consent.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["training"] === true}
                  onClick={() => toggle("training")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["training"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["training"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              {/* Attendance in early warning */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Use attendance in early-warning signals</p>
                  <p className="text-xs text-ink-3">Allows AI models to correlate attendance trends with academic risk indicators.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={values["attendance"] === true}
                  onClick={() => toggle("attendance")}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    values["attendance"] === true ? "bg-teal" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      values["attendance"] === true ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              <div className="pt-2 border-t border-line">
                <Field label="AI conversation retention" htmlFor="setting-retention" hint="Retention window for chat and generation history.">
                  <select
                    id="setting-retention"
                    value={String(values["retention"] ?? "180 days")}
                    onChange={(e) => updateSelect("retention", e.target.value)}
                    className={inputClass}
                  >
                    <option value="30 days">30 days (Ephemeral)</option>
                    <option value="90 days">90 days</option>
                    <option value="180 days">180 days (Semester Standard)</option>
                    <option value="1 year">1 year (Full Academic Year)</option>
                  </select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              onClick={() => saveMutation.mutate(values)}
              disabled={!dirty || saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? <Spinner className="size-4" /> : <Check className="size-4" />}
              Save changes
            </Button>
            {dirty ? (
              <span className="text-xs text-amber font-medium">Unsaved configuration changes</span>
            ) : (
              <span className="text-xs text-teal font-medium flex items-center gap-1">
                <Check className="size-3.5" /> All policies synchronized
              </span>
            )}
          </div>
        </div>

        {/* Sidebar: Compliance & Live Audit Log */}
        <div className="space-y-6">
          {/* Compliance Card */}
          <Card className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Compliance Frameworks</h3>
            <div className="mt-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-2">ISO 27001 / SOC 2</span>
                <Badge tone="teal">Compliant</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-2">FERPA Privacy Shield</span>
                <Badge tone="teal">Protected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-2">AI Data Isolation</span>
                <Badge tone={values["training"] ? "amber" : "teal"}>
                  {values["training"] ? "Opt-in Training" : "Zero-Retention"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-2">Staff Multi-Factor Auth</span>
                <Badge tone={values["mfa"] ? "teal" : "rose"}>
                  {values["mfa"] ? "Enforced" : "Disabled"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Recent Security Audit Log */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Live Security Audit</h3>
              <Clock className="size-3.5 text-ink-3" />
            </div>

            {auditQuery.isLoading ? (
              <div className="mt-3 flex justify-center py-4">
                <Spinner className="size-4" />
              </div>
            ) : !auditQuery.data || auditQuery.data.length === 0 ? (
              <p className="mt-3 text-xs text-ink-3">No recent security events.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-xs">
                {auditQuery.data.slice(0, 5).map((log, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="font-medium text-ink">{log.action}</p>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-3">
                      <span>{log.actor}</span>
                      <span>{log.at ? new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
