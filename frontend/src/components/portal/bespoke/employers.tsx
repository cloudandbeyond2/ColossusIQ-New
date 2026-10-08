"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Handshake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import {
  EMPLOYER_SECTORS,
  EMPLOYER_TIERS,
  EmployerBody,
  EmployerItem,
  EmployerOverview,
  MOU_STATUSES,
  type EmployerSector,
  type EmployerTier,
  type MouStatus,
} from "@/lib/api/employer-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["employers"] as const;
const Ok = z.object({ ok: z.boolean() });

const TIER_TONES: Record<EmployerTier, "brand" | "teal" | "sky" | "amber" | "neutral"> = {
  "Tier-1 Partner": "brand",
  "Preferred Recruiter": "teal",
  Active: "sky",
  Prospect: "amber",
  Inactive: "neutral",
};

const MOU_TONES: Record<MouStatus, "teal" | "amber" | "sky" | "neutral"> = {
  "Active MoU": "teal",
  "Under Renewal": "amber",
  "In Discussion": "sky",
  None: "neutral",
};

const dateText = (iso: string) => {
  if (!iso) return "–";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** A CSV cell that a spreadsheet will read safely as text. */
const cell = (v: string | number) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

function downloadEmployersCsv(employers: EmployerItem[]) {
  const head = [
    "Company",
    "Sector",
    "Tier",
    "Location",
    "HR Contact",
    "Designation",
    "Email",
    "Phone",
    "MoU Status",
    "MoU Valid Until",
    "3-Yr Hires",
    "Avg CTC (LPA)",
    "Highest CTC (LPA)",
    "Next Drive",
  ];
  const body = employers.map((e) => [
    e.company,
    e.sector,
    e.tier,
    e.location,
    e.contactName,
    e.contactDesignation,
    e.contactEmail,
    e.contactPhone,
    e.mouStatus,
    e.mouValidUntil,
    e.totalHires,
    e.averagePackage,
    e.highestPackage,
    e.nextDriveDate,
  ]);
  const csv = [head, ...body].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `campus-employers-directory.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EmployersModule() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch("/api/v1/employers", EmployerOverview),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<"all" | EmployerSector>("all");
  const [tierFilter, setTierFilter] = useState<"all" | EmployerTier>("all");
  const [mouFilter, setMouFilter] = useState<"all" | MouStatus>("all");

  const [form, setForm] = useState<{ employer: EmployerItem | null } | null>(null);
  const [viewing, setViewing] = useState<EmployerItem | null>(null);
  const [removing, setRemoving] = useState<EmployerItem | null>(null);

  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data?.items ?? []).filter((e) => {
      const matchSearch =
        !needle ||
        `${e.company} ${e.contactName} ${e.location} ${e.contactDesignation}`
          .toLowerCase()
          .includes(needle);
      const matchSector = sectorFilter === "all" || e.sector === sectorFilter;
      const matchTier = tierFilter === "all" || e.tier === tierFilter;
      const matchMou = mouFilter === "all" || e.mouStatus === mouFilter;
      return matchSearch && matchSector && matchTier && matchMou;
    });
  }, [q.data, search, sectorFilter, tierFilter, mouFilter]);

  if (q.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;

  const o = q.data;
  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });

  return (
    <div className="space-y-6">
      {/* ── Summary KPI Cards ─────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total Employers", String(o.summary.totalEmployers), "Registered corporate partners", Building2],
          ["Active Partners", String(o.summary.activePartners), "Tier-1, Preferred & Active", Handshake],
          ["Tier-1 Partners", String(o.summary.tier1Count), "Marquee corporate relationships", TrendingUp],
          ["3-Yr Total Hires", String(o.summary.totalHires3Yr), "Cumulative students hired", Users],
          [
            "Average CTC",
            o.summary.averagePackage ? `₹${o.summary.averagePackage} LPA` : "–",
            "Across hiring partners",
            CheckCircle2,
          ],
        ].map(([k, v, hint, Icon]: any) => (
          <Card key={k} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-3">{k}</p>
              <Icon className="size-4 text-brand opacity-80" aria-hidden />
            </div>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink">{v}</p>
            <p className="mt-1 text-xs text-ink-3">{hint}</p>
          </Card>
        ))}
      </div>

      {/* ── Main Employer Directory Card ─────────── */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="employer-search" className="sr-only">
              Search employers
            </label>
            <input
              id="employer-search"
              value={search}
              maxLength={80}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, contact person or location…"
              className={cn(inputClass, "pl-9")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as "all" | EmployerSector)}
              className={cn(inputClass, "w-auto text-xs sm:text-sm")}
            >
              <option value="all">All Sectors</option>
              {EMPLOYER_SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by relationship tier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as "all" | EmployerTier)}
              className={cn(inputClass, "w-auto text-xs sm:text-sm")}
            >
              <option value="all">All Tiers</option>
              {EMPLOYER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by MoU status"
              value={mouFilter}
              onChange={(e) => setMouFilter(e.target.value as "all" | MouStatus)}
              className={cn(inputClass, "w-auto text-xs sm:text-sm")}
            >
              <option value="all">All MoUs</option>
              {MOU_STATUSES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadEmployersCsv(items)}
              disabled={items.length === 0}
              title="Export filtered employers as CSV"
            >
              <Download className="size-4" /> Export CSV
            </Button>

            {o.canEdit ? (
              <Button size="sm" onClick={() => setForm({ employer: null })}>
                <Plus className="size-4" /> Add employer
              </Button>
            ) : null}
          </div>
        </div>

        <CardBody>
          {o.items.length === 0 ? (
            <EmptyState
              title="No employers registered yet"
              body={
                o.canEdit
                  ? "Add your institution's corporate recruiter relationships, MoU details, and historical placement records."
                  : "The placement office has not registered any corporate partners yet."
              }
              action={
                o.canEdit ? (
                  <Button onClick={() => setForm({ employer: null })}>Add employer</Button>
                ) : undefined
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No matching employers"
              body="Try adjusting your search criteria, sector filter, or partnership tier."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-xs transition hover:border-brand/40"
                >
                  <div>
                    {/* Header: Company & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">{e.company}</h3>
                          <Badge tone={TIER_TONES[e.tier]}>{e.tier}</Badge>
                          <Badge tone="neutral">{e.sector}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span>{e.location}</span>
                          {e.website ? (
                            <>
                              <span>•</span>
                              <a
                                href={e.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-brand hover:underline"
                              >
                                <Globe className="size-3" aria-hidden /> Website
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setViewing(e)}>
                          Details
                        </Button>
                        {o.canEdit ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setForm({ employer: e })}
                              aria-label={`Edit ${e.company}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRemoving(e)}
                              aria-label={`Delete ${e.company}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* HR Contact info */}
                    <div className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
                      <div className="flex items-center justify-between font-medium text-ink">
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5 text-ink-3" aria-hidden />
                          {e.contactName}
                        </span>
                        <span className="text-ink-3">{e.contactDesignation}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <a
                          href={`mailto:${e.contactEmail}`}
                          className="flex items-center gap-1 text-brand hover:underline"
                        >
                          <Mail className="size-3" aria-hidden /> {e.contactEmail}
                        </a>
                        {e.contactPhone ? (
                          <span className="flex items-center gap-1 text-ink-3">
                            <Phone className="size-3" aria-hidden /> {e.contactPhone}
                          </span>
                        ) : null}
                        {e.contactLinkedin ? (
                          <a
                            href={e.contactLinkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-brand hover:underline"
                          >
                            <ExternalLink className="size-3" aria-hidden /> LinkedIn
                          </a>
                        ) : null}
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                      <div>
                        <dt className="text-ink-3">3-Yr Hires</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-ink">{e.totalHires}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-3">Avg Package</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                          {e.averagePackage ? `₹${e.averagePackage} LPA` : "–"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3">Highest CTC</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                          {e.highestPackage ? `₹${e.highestPackage} LPA` : "–"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Footer: MoU Status & Drives */}
                  <div className="mt-4 flex flex-wrap items-center justify-between border-t border-line pt-3 text-xs text-ink-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={MOU_TONES[e.mouStatus]}>{e.mouStatus}</Badge>
                      {e.mouValidUntil ? <span>Valid till {dateText(e.mouValidUntil)}</span> : null}
                    </div>
                    {e.nextDriveDate ? (
                      <span className="flex items-center gap-1 font-medium text-brand">
                        <Calendar className="size-3.5" aria-hidden /> Next drive: {dateText(e.nextDriveDate)}
                      </span>
                    ) : e.lastDriveDate ? (
                      <span>Last drive: {dateText(e.lastDriveDate)}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ── Add / Edit Employer Modal ───────────────── */}
      {form ? (
        <EmployerFormModal
          employer={form.employer}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      ) : null}

      {/* ── View Details Modal ──────────────────────── */}
      {viewing ? <EmployerDetailModal employer={viewing} onClose={() => setViewing(null)} /> : null}

      {/* ── Delete Confirmation Modal ──────────────── */}
      {removing ? (
        <RemoveEmployerModal
          employer={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Add / Edit Form Modal ───────────────────────── */
interface FormState {
  company: string;
  sector: EmployerSector;
  tier: EmployerTier;
  website: string;
  location: string;
  contactName: string;
  contactDesignation: string;
  contactEmail: string;
  contactPhone: string;
  contactLinkedin: string;
  mouStatus: MouStatus;
  mouValidUntil: string;
  totalHires: string;
  averagePackage: string;
  highestPackage: string;
  lastDriveDate: string;
  nextDriveDate: string;
  notes: string;
}

const fromEmployer = (e: EmployerItem | null): FormState => ({
  company: e?.company ?? "",
  sector: e?.sector ?? "IT & Software",
  tier: e?.tier ?? "Active",
  website: e?.website ?? "",
  location: e?.location ?? "",
  contactName: e?.contactName ?? "",
  contactDesignation: e?.contactDesignation ?? "University Relations Lead",
  contactEmail: e?.contactEmail ?? "",
  contactPhone: e?.contactPhone ?? "",
  contactLinkedin: e?.contactLinkedin ?? "",
  mouStatus: e?.mouStatus ?? "None",
  mouValidUntil: e?.mouValidUntil ?? "",
  totalHires: e?.totalHires ? String(e.totalHires) : "0",
  averagePackage: e?.averagePackage ? String(e.averagePackage) : "",
  highestPackage: e?.highestPackage ? String(e.highestPackage) : "",
  lastDriveDate: e?.lastDriveDate ?? "",
  nextDriveDate: e?.nextDriveDate ?? "",
  notes: e?.notes ?? "",
});

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

function EmployerFormModal({
  employer,
  onClose,
  onSaved,
}: {
  employer: EmployerItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FormState>(() => fromEmployer(employer));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const body: EmployerBody = {
        company: f.company,
        sector: f.sector,
        tier: f.tier,
        website: f.website,
        location: f.location,
        contactName: f.contactName,
        contactDesignation: f.contactDesignation,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        contactLinkedin: f.contactLinkedin,
        mouStatus: f.mouStatus,
        mouValidUntil: f.mouValidUntil,
        totalHires: Math.round(num(f.totalHires)),
        averagePackage: num(f.averagePackage),
        highestPackage: num(f.highestPackage),
        lastDriveDate: f.lastDriveDate,
        nextDriveDate: f.nextDriveDate,
        notes: f.notes,
      };
      return apiFetch(
        employer ? `/api/v1/employers/${encodeURIComponent(employer.id)}` : "/api/v1/employers",
        EmployerItem,
        { method: employer ? "PUT" : "POST", body }
      );
    },
    onSuccess: onSaved,
  });

  const { fields, message } = problemOf(save.error, "Could not save employer details. Try again.");

  return (
    <Modal title={employer ? `Edit ${employer.company}` : "Add Corporate Recruiter"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name" htmlFor="emp-company" error={fields.company}>
            <input
              id="emp-company"
              className={inputClass}
              value={f.company}
              maxLength={100}
              placeholder="e.g. Google India"
              onChange={(e) => set("company", e.target.value)}
              required
            />
          </Field>

          <Field label="Sector / Industry" htmlFor="emp-sector" error={fields.sector}>
            <select
              id="emp-sector"
              className={inputClass}
              value={f.sector}
              onChange={(e) => set("sector", e.target.value as EmployerSector)}
            >
              {EMPLOYER_SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Relationship Tier" htmlFor="emp-tier" error={fields.tier}>
            <select
              id="emp-tier"
              className={inputClass}
              value={f.tier}
              onChange={(e) => set("tier", e.target.value as EmployerTier)}
            >
              {EMPLOYER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location / HQ" htmlFor="emp-location" error={fields.location}>
            <input
              id="emp-location"
              className={inputClass}
              value={f.location}
              maxLength={100}
              placeholder="e.g. Bengaluru, Karnataka"
              onChange={(e) => set("location", e.target.value)}
              required
            />
          </Field>

          <Field label="Company Careers URL (optional)" htmlFor="emp-site" error={fields.website}>
            <input
              id="emp-site"
              type="url"
              className={inputClass}
              value={f.website}
              maxLength={200}
              placeholder="https://company.com/careers"
              onChange={(e) => set("website", e.target.value)}
            />
          </Field>

          <Field label="MoU Status" htmlFor="emp-mou" error={fields.mouStatus}>
            <select
              id="emp-mou"
              className={inputClass}
              value={f.mouStatus}
              onChange={(e) => set("mouStatus", e.target.value as MouStatus)}
            >
              {MOU_STATUSES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="MoU Validity Until (optional)" htmlFor="emp-moudate" error={fields.mouValidUntil}>
            <input
              id="emp-moudate"
              type="date"
              className={inputClass}
              value={f.mouValidUntil}
              onChange={(e) => set("mouValidUntil", e.target.value)}
            />
          </Field>

          <Field label="Next Scheduled Drive (optional)" htmlFor="emp-nextdrive" error={fields.nextDriveDate}>
            <input
              id="emp-nextdrive"
              type="date"
              className={inputClass}
              value={f.nextDriveDate}
              onChange={(e) => set("nextDriveDate", e.target.value)}
            />
          </Field>
        </div>

        {/* HR Contact Section */}
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">University Relations Contact</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Contact Person" htmlFor="emp-cname" error={fields.contactName}>
              <input
                id="emp-cname"
                className={inputClass}
                value={f.contactName}
                maxLength={100}
                placeholder="e.g. Anandita Sen"
                onChange={(e) => set("contactName", e.target.value)}
                required
              />
            </Field>

            <Field label="Designation" htmlFor="emp-cdesig" error={fields.contactDesignation}>
              <input
                id="emp-cdesig"
                className={inputClass}
                value={f.contactDesignation}
                maxLength={100}
                placeholder="e.g. Head of University Relations"
                onChange={(e) => set("contactDesignation", e.target.value)}
                required
              />
            </Field>

            <Field label="Official Email" htmlFor="emp-cemail" error={fields.contactEmail}>
              <input
                id="emp-cemail"
                type="email"
                className={inputClass}
                value={f.contactEmail}
                maxLength={120}
                placeholder="recruiter@company.com"
                onChange={(e) => set("contactEmail", e.target.value)}
                required
              />
            </Field>

            <Field label="Phone / Mobile (optional)" htmlFor="emp-cphone" error={fields.contactPhone}>
              <input
                id="emp-cphone"
                className={inputClass}
                value={f.contactPhone}
                maxLength={25}
                placeholder="+91 98840 12345"
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="LinkedIn Profile URL (optional)" htmlFor="emp-clinkedin" error={fields.contactLinkedin}>
                <input
                  id="emp-clinkedin"
                  type="url"
                  className={inputClass}
                  value={f.contactLinkedin}
                  maxLength={200}
                  placeholder="https://linkedin.com/in/recruiter-profile"
                  onChange={(e) => set("contactLinkedin", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Placement Metrics Section */}
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm font-semibold text-ink">Historical Placement Statistics</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="3-Yr Total Hires" htmlFor="emp-hires" error={fields.totalHires}>
              <input
                id="emp-hires"
                type="number"
                min={0}
                max={50000}
                className={inputClass}
                value={f.totalHires}
                onChange={(e) => set("totalHires", e.target.value)}
              />
            </Field>

            <Field label="Average Package (LPA)" htmlFor="emp-avgpkg" error={fields.averagePackage}>
              <input
                id="emp-avgpkg"
                type="number"
                min={0}
                max={500}
                step="0.1"
                className={inputClass}
                value={f.averagePackage}
                placeholder="12.5"
                onChange={(e) => set("averagePackage", e.target.value)}
              />
            </Field>

            <Field label="Highest Package (LPA)" htmlFor="emp-highpkg" error={fields.highestPackage}>
              <input
                id="emp-highpkg"
                type="number"
                min={0}
                max={500}
                step="0.1"
                className={inputClass}
                value={f.highestPackage}
                placeholder="18.0"
                onChange={(e) => set("highestPackage", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Field label="Relationship Notes & Feedback (optional)" htmlFor="emp-notes" error={fields.notes}>
          <textarea
            id="emp-notes"
            rows={3}
            maxLength={1500}
            className={inputClass}
            placeholder="Key discussion points, target departments, student feedback, or recruiter preferences..."
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        {message ? (
          <p className="text-sm text-rose" role="alert">
            {message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null}{" "}
            {save.isPending ? "Saving…" : employer ? "Save changes" : "Add employer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── View Details Modal ──────────────────────────── */
function EmployerDetailModal({
  employer,
  onClose,
}: {
  employer: EmployerItem;
  onClose: () => void;
}) {
  return (
    <Modal title={`${employer.company} · Relationship Profile`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TIER_TONES[employer.tier]}>{employer.tier}</Badge>
          <Badge tone="neutral">{employer.sector}</Badge>
          <Badge tone={MOU_TONES[employer.mouStatus]}>{employer.mouStatus}</Badge>
          <span className="text-xs text-ink-3">Location: {employer.location}</span>
        </div>

        {employer.website ? (
          <p className="text-xs text-ink-3">
            Careers Website:{" "}
            <a
              href={employer.website}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              {employer.website}
            </a>
          </p>
        ) : null}

        {/* HR Profile */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">University Relations Contact</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-ink-3">Contact Person:</span>{" "}
              <strong className="text-ink">{employer.contactName}</strong>
            </div>
            <div>
              <span className="text-ink-3">Designation:</span>{" "}
              <span className="text-ink">{employer.contactDesignation}</span>
            </div>
            <div>
              <span className="text-ink-3">Email:</span>{" "}
              <a href={`mailto:${employer.contactEmail}`} className="text-brand hover:underline">
                {employer.contactEmail}
              </a>
            </div>
            {employer.contactPhone ? (
              <div>
                <span className="text-ink-3">Phone:</span>{" "}
                <span className="text-ink">{employer.contactPhone}</span>
              </div>
            ) : null}
            {employer.contactLinkedin ? (
              <div className="sm:col-span-2">
                <span className="text-ink-3">LinkedIn:</span>{" "}
                <a
                  href={employer.contactLinkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  {employer.contactLinkedin}
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Placement Track Record */}
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm font-semibold text-ink">Campus Hiring Track Record</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
            <div className="rounded-lg bg-surface-2 p-3">
              <span className="text-ink-3">3-Yr Hires</span>
              <p className="mt-1 text-lg font-bold text-ink">{employer.totalHires}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <span className="text-ink-3">Average CTC</span>
              <p className="mt-1 text-lg font-bold text-ink">
                {employer.averagePackage ? `₹${employer.averagePackage} LPA` : "–"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <span className="text-ink-3">Highest CTC</span>
              <p className="mt-1 text-lg font-bold text-ink">
                {employer.highestPackage ? `₹${employer.highestPackage} LPA` : "–"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <span className="text-ink-3">Next Scheduled</span>
              <p className="mt-1 font-semibold text-brand">
                {employer.nextDriveDate ? dateText(employer.nextDriveDate) : "None"}
              </p>
            </div>
          </div>
        </div>

        {/* MoU details */}
        <div className="rounded-xl bg-surface-2 p-4 text-xs text-ink-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink">Memorandum of Understanding (MoU)</span>
            <Badge tone={MOU_TONES[employer.mouStatus]}>{employer.mouStatus}</Badge>
          </div>
          <p className="mt-2 text-ink-3">
            {employer.mouValidUntil
              ? `Institutional agreement valid until ${dateText(employer.mouValidUntil)}.`
              : "No formal MoU expiration date recorded."}
          </p>
        </div>

        {/* Notes */}
        {employer.notes ? (
          <div>
            <p className="text-xs font-semibold text-ink">Recruiter Engagement Notes</p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
              {employer.notes}
            </p>
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────────── Delete Confirmation Modal ───────────────────── */
function RemoveEmployerModal({
  employer,
  onClose,
  onDone,
}: {
  employer: EmployerItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const del = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/employers/${encodeURIComponent(employer.id)}`, Ok, { method: "DELETE" }),
    onSuccess: onDone,
  });

  const { message } = problemOf(del.error, "Could not remove the employer record. Try again.");

  return (
    <Modal title={`Remove ${employer.company}?`} onClose={onClose}>
      <p className="text-sm text-ink-2">
        Are you sure you want to delete the relationship record for{" "}
        <strong className="text-ink">{employer.company}</strong>? All historical hire totals and
        contact information will be removed from your directory.
      </p>
      {message ? (
        <p className="mt-3 text-sm text-rose" role="alert">
          {message}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>
          {del.isPending ? "Removing…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
