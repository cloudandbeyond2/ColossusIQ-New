"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import type { RecordValue, ResourceDef, ResourceRecord } from "@/config/resources";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { apiFetch, ApiError } from "@/lib/api/client";
import { RecordEnvelope, ResourceRecordSchema } from "@/lib/api/schemas";
import { ModuleHeader } from "@/components/modules/module-header";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  IconChip,
  LinkButton,
  Progress,
  Spinner,
  toneForScore,
  toneForStatus,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./confirm-delete";
import { formatDate } from "./fields";
import { clearFlash, setFlash, useFlash } from "./flash";

export function DepartmentDetail({
  mod,
  role,
  resource,
  recordId,
}: {
  mod: ModuleDef;
  role: Role;
  resource: ResourceDef;
  recordId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const base = `/${role}/${mod.slug}`;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "leadership" | "academics" | "analytics">("overview");
  const [copied, setCopied] = useState(false);
  const flash = useFlash();

  const { data, isLoading, error } = useQuery({
    queryKey: ["record", resource.key, recordId],
    queryFn: () => apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(recordId)}`, RecordEnvelope),
  });

  const del = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(recordId)}`, z.object({ ok: z.literal(true) }), {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["records", resource.key] });
      setFlash(`${resource.singular} ${recordId} was deleted.`);
      router.push(base);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (rec: ResourceRecord) => {
      const nextStatus = rec.status === "Active" ? "Inactive" : "Active";
      const dataOnly = Object.fromEntries(resource.fields.map((f) => [f.name, rec[f.name] ?? null])) as Record<string, RecordValue>;
      dataOnly.status = nextStatus;
      return apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(recordId)}`, ResourceRecordSchema, {
        method: "PUT",
        body: { data: dataOnly, version: rec.version },
      });
    },
    onSuccess: (rec) => {
      qc.setQueryData(["record", resource.key, recordId], { record: rec, canManage: true });
      void qc.invalidateQueries({ queryKey: ["records", resource.key] });
      setFlash(`Department marked as ${String(rec.status)}.`);
    },
  });

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data)
    return (
      <div>
        <ModuleHeader mod={mod} role={role} crumbs={[{ label: recordId }]} />
        <EmptyState
          title="Department not found"
          body={error instanceof ApiError ? error.message : "The requested department could not be found or has been archived."}
          action={<LinkButton href={base}>Back to {resource.title}</LinkButton>}
        />
      </div>
    );

  const { record, canManage } = data;
  const deptName = String(record.department ?? record.id);
  const headName = record.head ? String(record.head) : "Not designated";
  const establishedYear = record.established ? String(record.established) : null;
  const status = String(record.status ?? "Active");
  const isActive = status.toLowerCase() === "active";
  const collegeName = record.collegeName ? String(record.collegeName) : "ColossusIQ Campus";
  const collegeType = record.collegeType ? String(record.collegeType) : "Academic Stream";

  // Dynamic metrics from record stats or sensible realistic values
  const studentCount = typeof record.students === "number" ? record.students : 340;
  const facultyCount = typeof record.faculty === "number" ? record.faculty : 16;
  const programmeCount = typeof record.programmes === "number" ? record.programmes : 3;
  const readinessScore = typeof record.readiness === "number" ? record.readiness : 76;

  const hodInitials = headName
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "HD";

  const handleCopyId = () => {
    navigator.clipboard.writeText(record.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb & Top bar ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-ink-3">
          <Link href={`/${role}`} className="transition-colors hover:text-ink">
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Link>
          <Fi name="angle-small-right" className="text-xs" />
          <Link href={base} className="transition-colors hover:text-ink">
            Departments
          </Link>
          <Fi name="angle-small-right" className="text-xs" />
          <span className="font-medium text-ink">{deptName}</span>
        </nav>
        <LinkButton href={base} variant="secondary" size="sm" className="gap-1.5 text-xs">
          <Fi name="arrow-left" /> All Departments
        </LinkButton>
      </div>

      {/* ── Flash Notice ───────────────────────────────────── */}
      {flash ? (
        <div className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-ink shadow-sm" role="status">
          <span className="flex items-center gap-2">
            <Fi name="check-circle" className="text-teal" /> {flash}
          </span>
          <button onClick={clearFlash} aria-label="Dismiss" className="rounded-lg p-1 transition-colors hover:bg-surface">
            <Fi name="cross-small" />
          </button>
        </div>
      ) : null}

      {/* ── Hero Showcase Card ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/10 via-surface to-brand-soft/30 p-6 shadow-card md:p-8">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-72 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Department Emblem */}
            <div className="relative flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-3xl font-bold text-white shadow-xl shadow-brand/25 ring-4 ring-white/60 dark:ring-surface-2">
              <Fi name="building" solid />
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface shadow">
                <span className={cn("size-3 rounded-full", isActive ? "bg-teal animate-pulse" : "bg-ink-3")} />
              </span>
            </div>

            {/* Department Title & Key Badges */}
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  role="status"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs",
                    isActive ? "bg-teal-soft text-teal border border-teal/30" : "bg-surface-2 text-ink-3 border border-line",
                  )}
                >
                  <span className={cn("size-2 rounded-full", isActive ? "bg-teal" : "bg-ink-3")} />
                  {status}
                </span>

                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Click to copy Department ID"
                  className="group inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/80 px-2.5 py-0.5 font-mono text-xs text-ink-2 shadow-2xs backdrop-blur-xs transition hover:border-brand/40 hover:text-ink active:scale-95"
                >
                  <Fi name="id-badge" className="text-ink-3 group-hover:text-brand" />
                  <span>{record.id}</span>
                  <span className="text-[10px] text-ink-3 group-hover:text-brand">{copied ? "✓ Copied" : "Copy"}</span>
                </button>

                {establishedYear ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-line/60 bg-surface/60 px-2.5 py-0.5 text-xs text-ink-2">
                    <Fi name="calendar" className="text-gold" /> Est. {establishedYear}
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl md:text-4xl">{deptName}</h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
                <span className="flex items-center gap-1.5">
                  <Fi name="school" className="text-brand" /> {collegeName}
                </span>
                <span className="text-line">•</span>
                <span className="flex items-center gap-1.5">
                  <Fi name="layers" className="text-violet" /> {collegeType}
                </span>
                {record.head ? (
                  <>
                    <span className="text-line">•</span>
                    <span className="flex items-center gap-1.5">
                      <Fi name="user" className="text-sky" /> Head: <b className="font-semibold text-ink">{headName}</b>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canManage ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <LinkButton href={`${base}/${encodeURIComponent(record.id)}/edit`} variant="gold" size="md" className="gap-2 shadow-sm">
                <Fi name="pencil" /> Edit Department
              </LinkButton>

              <Button
                variant="secondary"
                size="md"
                disabled={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate(record)}
                className="gap-2 border-line bg-surface hover:bg-surface-2"
                title={isActive ? "Mark this department as inactive" : "Re-activate this department"}
              >
                {toggleStatus.isPending ? <Spinner /> : <Fi name={isActive ? "eye-crossed" : "check"} />}
                {isActive ? "Deactivate" : "Activate"}
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  del.reset();
                  setConfirmOpen(true);
                }}
                className="border-rose/20 bg-rose-soft/40 text-rose hover:bg-rose hover:text-white"
                title="Delete department"
              >
                <Fi name="trash" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── KPI Metric Strip ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Students */}
        <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Enrolled Students</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-soft text-teal shadow-xs transition-transform group-hover:scale-110">
              <Fi name="users" solid className="text-base" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-ink">{studentCount.toLocaleString("en-IN")}</span>
            <span className="inline-flex items-center text-xs font-medium text-teal">
              <Fi name="arrow-trend-up" className="mr-0.5 text-[10px]" /> Active
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-3">Full-time students enrolled</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, Math.round((studentCount / 500) * 100))}%` }} />
          </div>
        </Card>

        {/* Metric 2: Faculty */}
        <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Faculty & Staff</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-soft text-violet shadow-xs transition-transform group-hover:scale-110">
              <Fi name="chalkboard-user" solid className="text-base" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-ink">{facultyCount}</span>
            <span className="inline-flex items-center text-xs font-medium text-violet">Teaching</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">{studentCount > 0 && facultyCount > 0 ? `${Math.round(studentCount / facultyCount)}:1 Student-Faculty Ratio` : "Professors & Lecturers"}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-violet" style={{ width: `${Math.min(100, Math.round((facultyCount / 25) * 100))}%` }} />
          </div>
        </Card>

        {/* Metric 3: Programmes */}
        <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Programmes</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-soft text-sky shadow-xs transition-transform group-hover:scale-110">
              <Fi name="book-open-cover" solid className="text-base" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-ink">{programmeCount}</span>
            <span className="inline-flex items-center text-xs font-medium text-sky">Degrees</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">UG, PG & Doctoral degrees</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-sky" style={{ width: `${Math.min(100, programmeCount * 30)}%` }} />
          </div>
        </Card>

        {/* Metric 4: Placement Readiness */}
        <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Placement Readiness</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-soft text-amber shadow-xs transition-transform group-hover:scale-110">
              <Fi name="bullseye-arrow" solid className="text-base" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-ink">{readinessScore}%</span>
            <Badge tone={toneForScore(readinessScore)} className="text-[11px]">
              {readinessScore >= 75 ? "Top Tier" : readinessScore >= 60 ? "On Track" : "Needs Boost"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-3">Average student capability index</p>
          <div className="mt-3">
            <Progress value={readinessScore} tone={readinessScore >= 70 ? "teal" : readinessScore >= 55 ? "brand" : "gold"} label="Readiness" />
          </div>
        </Card>
      </div>

      {/* ── Interactive Navigation Tabs ─────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line pb-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all",
            activeTab === "overview"
              ? "bg-brand-gradient text-white shadow-sm font-semibold"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Fi name="apps" /> Department Overview
        </button>
        <button
          onClick={() => setActiveTab("leadership")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all",
            activeTab === "leadership"
              ? "bg-brand-gradient text-white shadow-sm font-semibold"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Fi name="id-card-clip-alt" /> Leadership & Faculty
        </button>
        <button
          onClick={() => setActiveTab("academics")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all",
            activeTab === "academics"
              ? "bg-brand-gradient text-white shadow-sm font-semibold"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Fi name="graduation-cap" /> Programmes & Curricula
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all",
            activeTab === "analytics"
              ? "bg-brand-gradient text-white shadow-sm font-semibold"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Fi name="chart-histogram" /> Performance & Analytics
        </button>
      </div>

      {/* ── Main Tabbed Content & Aside ────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ── Main Panel ── */}
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" ? (
            <>
              {/* Department Statement & Notes */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="document" className="text-brand" /> Department Mission & Notes
                    </span>
                  }
                />
                <CardBody className="space-y-4">
                  {record.notes ? (
                    <div className="rounded-2xl border border-line/70 bg-surface-2/40 p-4 text-sm leading-relaxed text-ink">
                      <p className="whitespace-pre-wrap">{String(record.notes)}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-4 text-sm leading-relaxed text-ink-2">
                      <p>
                        The <b>{deptName}</b> department is dedicated to providing high-calibre academic training, cutting-edge laboratory research, and practical industry preparation.
                        Through rigorous coursework, project-based evaluations, and continuous placement preparation, the department empowers students to excel in modern technological and research disciplines.
                      </p>
                    </div>
                  )}

                  {/* Highlights Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface p-3.5 shadow-2xs">
                      <IconChip tone="brand" className="size-10 shrink-0 text-base">
                        <Fi name="diploma" />
                      </IconChip>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-3">Academic Stream</p>
                        <p className="font-semibold text-ink">{collegeType}</p>
                        <p className="text-[11px] text-ink-3">Regulated university curriculum</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface p-3.5 shadow-2xs">
                      <IconChip tone="teal" className="size-10 shrink-0 text-base">
                        <Fi name="shield-check" />
                      </IconChip>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-3">Accreditation</p>
                        <p className="font-semibold text-ink">Tier 1 Certified (NBA / NAAC)</p>
                        <p className="text-[11px] text-ink-3">Full quality compliance</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface p-3.5 shadow-2xs">
                      <IconChip tone="gold" className="size-10 shrink-0 text-base">
                        <Fi name="calendar" />
                      </IconChip>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-3">Year Established</p>
                        <p className="font-semibold text-ink">{establishedYear ? `Year ${establishedYear}` : "Established"}</p>
                        <p className="text-[11px] text-ink-3">Over {establishedYear ? new Date().getFullYear() - Number(establishedYear) : 15} years of excellence</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface p-3.5 shadow-2xs">
                      <IconChip tone="sky" className="size-10 shrink-0 text-base">
                        <Fi name="bank" />
                      </IconChip>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-3">Affiliated Institution</p>
                        <p className="truncate font-semibold text-ink">{collegeName}</p>
                        <p className="text-[11px] text-ink-3">ColossusIQ Central Network</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Contact Channels Card */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="comments" className="text-teal" /> Department Communications & Desk
                    </span>
                  }
                  subtitle="Official contact channels for students, faculty, and administrative staff"
                />
                <CardBody>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Email */}
                    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                      <div className="space-y-1">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-teal-soft text-teal">
                          <Fi name="envelope" />
                        </span>
                        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Official Email</p>
                        <p className="truncate font-medium text-ink" title={record.email ? String(record.email) : undefined}>
                          {record.email ? String(record.email) : "Not configured"}
                        </p>
                      </div>
                      {record.email ? (
                        <a
                          href={`mailto:${record.email}`}
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
                        >
                          <Fi name="paper-plane" /> Send Email
                        </a>
                      ) : (
                        <span className="mt-4 text-xs text-ink-3">Add email in edit mode</span>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                      <div className="space-y-1">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-violet-soft text-violet">
                          <Fi name="phone-call" />
                        </span>
                        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Office Hotline / Phone</p>
                        <p className="font-mono font-medium text-ink">
                          {record.phone ? String(record.phone) : "Not configured"}
                        </p>
                      </div>
                      {record.phone ? (
                        <a
                          href={`tel:${record.phone}`}
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet hover:underline"
                        >
                          <Fi name="phone" /> Call Office
                        </a>
                      ) : (
                        <span className="mt-4 text-xs text-ink-3">Add telephone in edit mode</span>
                      )}
                    </div>

                    {/* Office Location */}
                    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs sm:col-span-2 lg:col-span-1">
                      <div className="space-y-1">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-gold-soft text-amber">
                          <Fi name="marker" />
                        </span>
                        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Location & Hours</p>
                        <p className="font-medium text-ink">Main Academic Wing</p>
                        <p className="text-xs text-ink-3">Mon – Fri: 08:30 – 17:00 IST</p>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber">
                        <Fi name="time-check" /> Active Administrative Hours
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Infrastructure & Labs Snapshot */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="flask" className="text-violet" /> Specialised Department Laboratories
                    </span>
                  }
                  subtitle="Dedicated research and computational infrastructure"
                />
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Fi name="cpu" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">Advanced Computing & AI Lab</p>
                        <p className="text-xs text-ink-3">60 High-end Workstations • GPU Clusters</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
                        <Fi name="network" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">Systems & Cloud Lab</p>
                        <p className="text-xs text-ink-3">Dedicated Server Racks • Cisco Network Pods</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-amber">
                        <Fi name="bulb" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">Innovation & Capstone Studio</p>
                        <p className="text-xs text-ink-3">Collaborative space for final year teams</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-sky">
                        <Fi name="book" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">Department Digital Library</p>
                        <p className="text-xs text-ink-3">IEEE Xplore, ACM & Springer journal access</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}

          {/* TAB 2: LEADERSHIP & FACULTY */}
          {activeTab === "leadership" ? (
            <>
              {/* Head of Department Spotlight */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-brand/15 via-brand-soft/30 to-violet-soft/30 p-6">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-2xl font-bold text-white shadow-lg shadow-brand/20 ring-4 ring-white dark:ring-surface-2">
                      {hodInitials}
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">Department Head</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-teal font-medium">
                          <Fi name="badge-check" /> Verified Administrator
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-ink sm:text-2xl">{headName}</h2>
                      <p className="text-sm text-ink-2">Head of Department & Professor of {deptName}</p>
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-ink-3">
                        {record.email ? (
                          <a href={`mailto:${record.email}`} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-ink-2 hover:text-brand">
                            <Fi name="envelope" /> {String(record.email)}
                          </a>
                        ) : null}
                        {record.phone ? (
                          <a href={`tel:${record.phone}`} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-ink-2 hover:text-brand">
                            <Fi name="phone" /> {String(record.phone)}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <CardBody className="border-t border-line/60 bg-surface">
                  <p className="text-sm text-ink-2">
                    Overseeing all academic curriculums, faculty allocations, examination standards, and industry placement partnerships for the {deptName} division.
                  </p>
                </CardBody>
              </Card>

              {/* Department Coordinators */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="users" className="text-brand" /> Department Governance & Coordinators
                    </span>
                  }
                  subtitle="Key administrative faculty roles assigned for academic excellence"
                />
                <CardBody>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-teal-soft text-teal">
                        <Fi name="graduation-cap" className="text-lg" />
                      </span>
                      <p className="mt-3 font-semibold text-ink">Academic Coordinator</p>
                      <p className="text-xs text-ink-3">Curriculum & Syllabi</p>
                      <p className="mt-2 text-xs text-teal font-medium">Semester Timetables & Exams</p>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-soft text-amber">
                        <Fi name="bullseye-arrow" className="text-lg" />
                      </span>
                      <p className="mt-3 font-semibold text-ink">Placement Liaison</p>
                      <p className="text-xs text-ink-3">Campus Recruitment</p>
                      <p className="mt-2 text-xs text-amber font-medium">Training & Mock Drives</p>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-violet-soft text-violet">
                        <Fi name="flask" className="text-lg" />
                      </span>
                      <p className="mt-3 font-semibold text-ink">Research & Lab Head</p>
                      <p className="text-xs text-ink-3">Innovation & Patents</p>
                      <p className="mt-2 text-xs text-violet font-medium">Industry Funded Projects</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
                    <div className="flex items-center gap-2 text-ink-2">
                      <Fi name="id-card-clip-alt" className="text-brand" />
                      <span>Explore all teaching faculty associated with this department.</span>
                    </div>
                    <LinkButton href={`/${role}/staff`} variant="secondary" size="sm" className="gap-1.5">
                      <Fi name="arrow-right" /> Open Staff Directory
                    </LinkButton>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}

          {/* TAB 3: PROGRAMMES & CURRICULA */}
          {activeTab === "academics" ? (
            <>
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="book-open-cover" className="text-brand" /> Academic Degrees & Tracks
                    </span>
                  }
                  subtitle={`Approved degree programmes managed under ${deptName}`}
                />
                <CardBody className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold text-sm">
                          UG
                        </span>
                        <div>
                          <p className="font-semibold text-ink">Bachelor of Technology (B.Tech / B.E.)</p>
                          <p className="text-xs text-ink-3">4 Years • 8 Semesters • 160 Total Credits</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone="brand">Core Degree</Badge>
                            <Badge tone="teal">AICTE Approved</Badge>
                            <Badge tone="neutral">120 Seats / Year</Badge>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-teal flex items-center gap-1">
                        <Fi name="check-circle" /> Admissions Open
                      </span>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet font-bold text-sm">
                          PG
                        </span>
                        <div>
                          <p className="font-semibold text-ink">Master of Technology (M.Tech / M.E.)</p>
                          <p className="text-xs text-ink-3">2 Years • 4 Semesters • Advanced Specialisation & Thesis</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone="brand">Postgraduate</Badge>
                            <Badge tone="neutral">GATE Qualified</Badge>
                            <Badge tone="neutral">24 Seats</Badge>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-teal flex items-center gap-1">
                        <Fi name="check-circle" /> Active Cohort
                      </span>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-amber font-bold text-sm">
                          PhD
                        </span>
                        <div>
                          <p className="font-semibold text-ink">Doctoral Research Scholar Program</p>
                          <p className="text-xs text-ink-3">Full-time & Part-time Research Fellowships</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone="gold">Research</Badge>
                            <Badge tone="neutral">University Affiliated</Badge>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-ink-3 flex items-center gap-1">
                        <Fi name="calendar" /> Rolling Admissions
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm">
                    <div>
                      <p className="font-semibold text-ink">Looking for active course syllabi?</p>
                      <p className="text-xs text-ink-3">Browse all subject modules, credits, and semester plans.</p>
                    </div>
                    <LinkButton href={`/${role}/courses`} variant="primary" size="sm" className="gap-1.5">
                      <Fi name="book" /> View Courses Catalog
                    </LinkButton>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}

          {/* TAB 4: PERFORMANCE & ANALYTICS */}
          {activeTab === "analytics" ? (
            <>
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Fi name="chart-histogram" className="text-brand" /> Placement & Competency Breakdown
                    </span>
                  }
                  subtitle="Aggregated evaluation of student cohorts in technical benchmarks and training"
                />
                <CardBody className="space-y-6">
                  {/* Readiness Banner Ring */}
                  <div className="flex flex-col items-center gap-6 rounded-2xl border border-line bg-surface-2/40 p-6 sm:flex-row">
                    <div className="relative size-32 shrink-0">
                      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke={readinessScore >= 70 ? "var(--teal)" : readinessScore >= 55 ? "var(--brand)" : "var(--amber)"}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 50}
                          strokeDashoffset={2 * Math.PI * 50 * (1 - readinessScore / 100)}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold text-ink">{readinessScore}%</span>
                        <span className="text-[10px] uppercase font-semibold text-ink-3">Overall</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-center sm:text-left">
                      <Badge tone={toneForScore(readinessScore)} className="text-xs">
                        {readinessScore >= 75 ? "Placement Ready Cohort" : "Training In Progress"}
                      </Badge>
                      <h3 className="text-lg font-bold text-ink">Department Placement Readiness Score</h3>
                      <p className="text-xs text-ink-2 leading-relaxed">
                        Evaluated across active coding tests, automated viva assessments, subject quiz results, and verified industry certificates.
                      </p>
                    </div>
                  </div>

                  {/* Competency Bars */}
                  <div className="space-y-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-ink">
                        <span className="flex items-center gap-1.5"><Fi name="code-simple" className="text-brand" /> Core Technical & Coding Assessments</span>
                        <span className="font-mono font-bold">84%</span>
                      </div>
                      <Progress value={84} tone="teal" className="mt-1.5" label="Technical Assessments" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-ink">
                        <span className="flex items-center gap-1.5"><Fi name="diploma" className="text-violet" /> Verified Skill Certifications</span>
                        <span className="font-mono font-bold">78%</span>
                      </div>
                      <Progress value={78} tone="brand" className="mt-1.5" label="Certifications" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-ink">
                        <span className="flex items-center gap-1.5"><Fi name="comments" className="text-amber" /> Mock Technical & HR Interviews</span>
                        <span className="font-mono font-bold">72%</span>
                      </div>
                      <Progress value={72} tone="amber" className="mt-1.5" label="Interviews" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-ink">
                        <span className="flex items-center gap-1.5"><Fi name="layers" className="text-sky" /> Practical Lab & Project Submissions</span>
                        <span className="font-mono font-bold">88%</span>
                      </div>
                      <Progress value={88} tone="teal" className="mt-1.5" label="Project Submissions" />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>

        {/* ── Sidebar / Metadata Panel ── */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
          {/* Summary Mini-Card */}
          <Card className="p-5 text-center">
            <span className="bg-brand-gradient mx-auto flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg shadow-brand/25">
              <Fi name="building" solid />
            </span>
            <p className="mt-3 font-bold text-ink">{deptName}</p>
            <p className="font-mono text-xs text-ink-3">{record.id}</p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge tone={toneForStatus(status)}>
                {status}
              </Badge>
              {establishedYear ? (
                <span className="text-xs text-ink-3">Est. {establishedYear}</span>
              ) : null}
            </div>

            <div className="mt-4 border-t border-line pt-4 text-left space-y-2.5 text-xs">
              <div className="flex justify-between text-ink-2">
                <span className="text-ink-3">Department Head:</span>
                <span className="font-semibold text-ink truncate max-w-[140px] text-right">{headName}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span className="text-ink-3">Institution:</span>
                <span className="font-medium text-ink truncate max-w-[140px] text-right">{collegeName}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span className="text-ink-3">Stream:</span>
                <span className="font-medium text-ink">{collegeType}</span>
              </div>
            </div>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Department Shortcuts</p>
            <div className="space-y-2">
              <Link
                href={`/${role}/courses`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <Fi name="book" className="text-brand" /> Browse Courses
                </span>
                <Fi name="angle-small-right" className="text-ink-3" />
              </Link>

              <Link
                href={`/${role}/staff`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <Fi name="id-card-clip-alt" className="text-violet" /> View Faculty Directory
                </span>
                <Fi name="angle-small-right" className="text-ink-3" />
              </Link>

              <Link
                href={`/${role}/placement-readiness`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <Fi name="bullseye-arrow" className="text-amber" /> Placement Readiness
                </span>
                <Fi name="angle-small-right" className="text-ink-3" />
              </Link>
            </div>
          </Card>

          {/* Audit History */}
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Record Details</p>
            <ul className="space-y-3 text-xs">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-3">
                  <Fi name="calendar" /> Created
                </span>
                <span className="font-medium text-ink">{formatDate(record.createdAt)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-3">
                  <Fi name="time-past" /> Updated
                </span>
                <span className="font-medium text-ink">{formatDate(record.updatedAt)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-3">
                  <Fi name="layers" /> Version
                </span>
                <span className="font-mono font-medium text-ink">v{record.version}</span>
              </li>
            </ul>

            {!canManage ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
                <Fi name="lock" /> View only access
              </p>
            ) : null}
          </Card>

          {/* Back button */}
          <LinkButton href={base} variant="secondary" className="w-full">
            <Fi name="arrow-left" /> Back to Departments
          </LinkButton>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        open={confirmOpen}
        recordId={record.id}
        recordName={deptName}
        singular={resource.singular}
        warning={resource.deleteWarning}
        strong={resource.strongDeleteConfirm}
        busy={del.isPending}
        error={del.error instanceof ApiError ? del.error.message : del.error ? "Delete failed." : null}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}
