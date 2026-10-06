"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, Download, MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, EmptyState, Field, Skeleton, Spinner, inputClass, toneForScore } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { DRIVE_STATUSES, DRIVE_TYPES, DriveDetail, DriveItem, DriveOverview, packageText, type DriveBody, type DriveStatus } from "@/lib/api/drive-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["drives"] as const;
const Ok = z.object({ ok: z.boolean() });
const STATUS_TONE: Record<DriveStatus, "neutral" | "teal" | "amber" | "sky" | "rose"> = { Draft: "neutral", Open: "teal", Closed: "amber", Completed: "sky", Cancelled: "rose" };
const dateText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const rank = (d: DriveItem) => (d.phase === "past" ? 1 : 0);

/** A CSV cell that a spreadsheet will read as text, never as a formula. */
const cell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

function downloadStudents(d: DriveItem, students: DriveDetail["students"]) {
  const head = ["Name", "Roll no", "Department", "Readiness total", "Status"];
  const body = students.map((s) => [s.name, s.rollNo, s.department, s.total, s.status]);
  const csv = [head, ...body].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-eligible-students.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DrivesModule() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/drives", DriveOverview), staleTime: 0, refetchOnMount: "always" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | DriveStatus>("all");
  const [form, setForm] = useState<{ drive: DriveItem | null } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DriveItem | null>(null);

  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data?.items ?? [])
      .filter((d) => (status === "all" || d.status === status) && (!needle || `${d.company} ${d.role} ${d.venue}`.toLowerCase().includes(needle)))
      .sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [q.data, search, status]);

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Upcoming", String(o.summary.upcoming), "Draft or open, not yet held"],
          ["Open now", String(o.summary.open), "Taking registrations"],
          ["Completed", String(o.summary.completed), "Drives held"],
          ["Offers", String(o.summary.offers), "Across all drives"],
          ["Average package", o.summary.averagePackage === null ? "–" : `₹${o.summary.averagePackage} LPA`, "Completed drives, mid-point"],
        ].map(([k, v, hint]) => (
          <Card key={k} className="p-5">
            <p className="text-sm text-ink-3">{k}</p>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink">{v}</p>
            <p className="mt-1 text-xs text-ink-3">{hint}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="drive-search" className="sr-only">
              Search placement drives
            </label>
            <input id="drive-search" value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)} placeholder="Search by company, role or venue…" className={cn(inputClass, "pl-9")} />
          </div>
          <label htmlFor="drive-status" className="sr-only">
            Filter by status
          </label>
          <select id="drive-status" value={status} onChange={(e) => setStatus(e.target.value as "all" | DriveStatus)} className={cn(inputClass, "w-auto")}>
            <option value="all">All statuses</option>
            {DRIVE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {o.canEdit ? (
            <Button onClick={() => setForm({ drive: null })}>
              <Plus className="size-4" /> Schedule drive
            </Button>
          ) : null}
        </div>

        <CardBody>
          {o.items.length === 0 ? (
            <EmptyState
              title="No drives yet"
              body={o.canEdit ? "Schedule your first campus drive. You will see how many students meet its rules as soon as you save it." : "The placement officer has not scheduled any drives yet."}
              action={o.canEdit ? <Button onClick={() => setForm({ drive: null })}>Schedule drive</Button> : undefined}
            />
          ) : items.length === 0 ? (
            <EmptyState title="No matching drives" body="Try a different search or status." />
          ) : (
            <ul className="space-y-3">
              {items.map((d) => (
                <li key={d.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">{d.company}</h3>
                        <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
                        <Badge tone="neutral">{d.type}</Badge>
                        {d.phase === "today" ? <Badge tone="gold">Today</Badge> : null}
                      </div>
                      <p className="text-sm text-ink-2">{d.role}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setViewing(d.id)}>
                        <Users className="size-4" /> Eligible students
                      </Button>
                      {o.canEdit ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setForm({ drive: d })} aria-label={`Edit ${d.company} drive`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRemoving(d)} aria-label={`Delete ${d.company} drive`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm text-ink-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-ink-3" aria-hidden />
                      <dt className="sr-only">Date</dt>
                      <dd>{dateText(d.date)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-ink-3" aria-hidden />
                      <dt className="sr-only">Time</dt>
                      <dd>{d.time || "Time not set"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-ink-3" aria-hidden />
                      <dt className="sr-only">Venue</dt>
                      <dd className="truncate">{d.venue || "Venue not set"}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Package</dt>
                      <dd className="font-medium text-ink">{packageText(d.packageMin, d.packageMax)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-2">
                    <span>
                      <strong className="tabular-nums text-ink">{d.eligible}</strong> of {o.students} students eligible
                    </span>
                    <span>{d.departments.length ? d.departments.join(", ") : "All departments"}</span>
                    {d.minReadiness ? <span>Readiness {d.minReadiness}+</span> : null}
                    {d.deadline ? <span>Register by {dateText(d.deadline)}</span> : null}
                    {d.registered || d.shortlisted || d.offers ? (
                      <span>
                        Registered {d.registered} → shortlisted {d.shortlisted} → offers {d.offers}
                      </span>
                    ) : null}
                  </div>
                  {(d.status === "Open" || d.status === "Draft") && d.phase === "past" ? (
                    <p className="mt-2 text-xs text-amber">The drive date has passed. Mark it Completed or Closed and record how it went.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {form ? (
        <DriveForm
          drive={form.drive}
          departments={o.departments}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      ) : null}
      {viewing ? <Eligible id={viewing} onClose={() => setViewing(null)} /> : null}
      {removing ? (
        <RemoveDialog
          drive={removing}
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

/* ───────────────────────────── eligible students ───────────────────────────── */
function Eligible({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["drive", id], queryFn: () => apiFetch(`/api/v1/drives/${encodeURIComponent(id)}`, DriveDetail), staleTime: 0, refetchOnMount: "always" });
  const d = q.data?.drive;
  return (
    <Modal title={d ? `${d.company} · ${d.role}` : "Eligible students"} onClose={onClose} wide>
      {q.isPending ? <Skeleton className="h-48" /> : null}
      {q.isError ? <LoadError error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data && d ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
            <span>{dateText(d.date)}</span>
            <span>·</span>
            <span>{d.departments.length ? d.departments.join(", ") : "All departments"}</span>
            <span>·</span>
            <span>{d.minReadiness ? `Readiness ${d.minReadiness}+` : "No readiness minimum"}</span>
          </div>
          {d.description ? <p className="whitespace-pre-wrap text-sm text-ink-2">{d.description}</p> : null}
          {d.rounds.length ? (
            <ol className="flex flex-wrap gap-1.5 text-xs">
              {d.rounds.map((r, i) => (
                <li key={`${r}-${i}`}>
                  <Badge tone="neutral">
                    {i + 1}. {r}
                  </Badge>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              {d.eligible} eligible student{d.eligible === 1 ? "" : "s"}
              {d.eligible > q.data.students.length ? ` (first ${q.data.students.length} shown)` : ""}
            </p>
            <Button size="sm" variant="secondary" onClick={() => downloadStudents(d, q.data.students)} disabled={q.data.students.length === 0}>
              <Download className="size-4" /> Download CSV
            </Button>
          </div>
          {q.data.students.length === 0 ? (
            <EmptyState title="No students meet these rules" body="Lower the readiness minimum or include more departments to widen the pool." />
          ) : (
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Student</th>
                    <th scope="col" className="px-3 py-2 font-medium">Roll no</th>
                    <th scope="col" className="px-3 py-2 font-medium">Department</th>
                    <th scope="col" className="px-3 py-2 font-medium">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.students.map((s, i) => (
                    <tr key={`${s.rollNo}-${i}`} className="border-t border-line">
                      <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-2">{s.rollNo}</td>
                      <td className="px-3 py-2 text-ink-2">{s.department}</td>
                      <td className="px-3 py-2">
                        <Badge tone={toneForScore(s.total)}>{s.total}</Badge> <span className="text-xs text-ink-3">{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ink-3">Roll numbers are masked, as on the Placement Readiness Board. Eligibility uses departments and the readiness total only; add any other rule (such as CGPA) to the drive description.</p>
        </div>
      ) : null}
    </Modal>
  );
}

/* ───────────────────────────── schedule / edit ───────────────────────────── */
interface FormState {
  company: string;
  role: string;
  type: (typeof DRIVE_TYPES)[number];
  date: string;
  time: string;
  venue: string;
  packageMin: string;
  packageMax: string;
  openings: string;
  departments: string[];
  minReadiness: string;
  deadline: string;
  description: string;
  rounds: string;
  status: DriveStatus;
  registered: string;
  shortlisted: string;
  offers: string;
}

const fromDrive = (d: DriveItem | null): FormState => ({
  company: d?.company ?? "",
  role: d?.role ?? "",
  type: d?.type ?? "On-campus",
  date: d?.date ?? "",
  time: d?.time ?? "",
  venue: d?.venue ?? "",
  packageMin: d?.packageMin ? String(d.packageMin) : "",
  packageMax: d?.packageMax ? String(d.packageMax) : "",
  openings: d?.openings ? String(d.openings) : "",
  departments: d?.departments ?? [],
  minReadiness: d?.minReadiness ? String(d.minReadiness) : "",
  deadline: d?.deadline ?? "",
  description: d?.description ?? "",
  rounds: (d?.rounds ?? []).join("\n"),
  status: d?.status ?? "Draft",
  registered: d?.registered ? String(d.registered) : "",
  shortlisted: d?.shortlisted ? String(d.shortlisted) : "",
  offers: d?.offers ? String(d.offers) : "",
});

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

function DriveForm({ drive, departments, onClose, onSaved }: { drive: DriveItem | null; departments: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<FormState>(() => fromDrive(drive));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const deptOptions = [...new Set([...departments, ...f.departments])];

  const save = useMutation({
    mutationFn: () => {
      const body: DriveBody = {
        company: f.company,
        role: f.role,
        type: f.type,
        date: f.date,
        time: f.time,
        venue: f.venue,
        packageMin: num(f.packageMin),
        packageMax: num(f.packageMax),
        openings: Math.round(num(f.openings)),
        departments: f.departments,
        minReadiness: Math.round(num(f.minReadiness)),
        deadline: f.deadline,
        description: f.description,
        rounds: f.rounds.split("\n").map((r) => r.trim()).filter(Boolean),
        status: f.status,
        registered: Math.round(num(f.registered)),
        shortlisted: Math.round(num(f.shortlisted)),
        offers: Math.round(num(f.offers)),
      };
      return apiFetch(drive ? `/api/v1/drives/${encodeURIComponent(drive.id)}` : "/api/v1/drives", DriveItem, { method: drive ? "PUT" : "POST", body });
    },
    onSuccess: onSaved,
  });
  const { fields, message } = problemOf(save.error, "Could not save the drive. Try again.");
  const toggleDept = (d: string) => set("departments", f.departments.includes(d) ? f.departments.filter((x) => x !== d) : [...f.departments, d]);

  return (
    <Modal title={drive ? "Edit drive" : "Schedule a drive"} onClose={onClose} wide>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" htmlFor="dr-company" error={fields.company}>
            <input id="dr-company" className={inputClass} value={f.company} maxLength={100} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Role" htmlFor="dr-role" error={fields.role}>
            <input id="dr-role" className={inputClass} value={f.role} maxLength={100} placeholder="Graduate Engineer Trainee" onChange={(e) => set("role", e.target.value)} />
          </Field>
          <Field label="Drive type" htmlFor="dr-type" error={fields.type}>
            <select id="dr-type" className={inputClass} value={f.type} onChange={(e) => set("type", e.target.value as FormState["type"])}>
              {DRIVE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="dr-status" error={fields.status} hint="Draft is hidden from planning counts until you open it.">
            <select id="dr-status" className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value as DriveStatus)}>
              {DRIVE_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Drive date" htmlFor="dr-date" error={fields.date}>
            <input id="dr-date" type="date" className={inputClass} value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Start time (optional)" htmlFor="dr-time" error={fields.time}>
            <input id="dr-time" type="time" className={inputClass} value={f.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
          <Field label="Venue or meeting link (optional)" htmlFor="dr-venue" error={fields.venue}>
            <input id="dr-venue" className={inputClass} value={f.venue} maxLength={150} placeholder="Seminar Hall A" onChange={(e) => set("venue", e.target.value)} />
          </Field>
          <Field label="Register by (optional)" htmlFor="dr-deadline" error={fields.deadline}>
            <input id="dr-deadline" type="date" className={inputClass} value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          <Field label="Lowest package (LPA)" htmlFor="dr-pmin" error={fields.packageMin}>
            <input id="dr-pmin" type="number" min={0} max={500} step="0.1" className={inputClass} value={f.packageMin} onChange={(e) => set("packageMin", e.target.value)} />
          </Field>
          <Field label="Highest package (LPA)" htmlFor="dr-pmax" error={fields.packageMax}>
            <input id="dr-pmax" type="number" min={0} max={500} step="0.1" className={inputClass} value={f.packageMax} onChange={(e) => set("packageMax", e.target.value)} />
          </Field>
          <Field label="Openings (optional)" htmlFor="dr-openings" error={fields.openings}>
            <input id="dr-openings" type="number" min={0} max={5000} className={inputClass} value={f.openings} onChange={(e) => set("openings", e.target.value)} />
          </Field>
          <Field label="Minimum readiness total" htmlFor="dr-ready" error={fields.minReadiness} hint="0 to 100, from the Placement Readiness Board. Leave empty for no minimum.">
            <input id="dr-ready" type="number" min={0} max={100} className={inputClass} value={f.minReadiness} onChange={(e) => set("minReadiness", e.target.value)} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Departments allowed</legend>
          <p className="mb-2 text-xs text-ink-3">{f.departments.length === 0 ? "None selected means every department is eligible." : `${f.departments.length} selected.`}</p>
          {deptOptions.length === 0 ? (
            <p className="text-sm text-ink-3">No students are on the readiness board yet, so there are no departments to choose from.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {deptOptions.map((d) => (
                <button key={d} type="button" aria-pressed={f.departments.includes(d)} onClick={() => toggleDept(d)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", f.departments.includes(d) ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:bg-surface-2")}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <Field label="Selection rounds (optional)" htmlFor="dr-rounds" error={fields.rounds} hint="One per line, in order, up to 8: Aptitude test, Technical interview, HR interview">
          <textarea id="dr-rounds" rows={3} className={inputClass} value={f.rounds} onChange={(e) => set("rounds", e.target.value)} />
        </Field>
        <Field label="Details (optional)" htmlFor="dr-desc" error={fields.description} hint="Extra eligibility such as CGPA or backlogs, bond, location, what to bring.">
          <textarea id="dr-desc" rows={4} maxLength={1500} className={inputClass} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">How it went</p>
          <p className="mb-3 text-xs text-ink-3">Fill these in after the drive. Shortlisted and offers cannot be more than registered.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Registered" htmlFor="dr-reg" error={fields.registered}>
              <input id="dr-reg" type="number" min={0} className={inputClass} value={f.registered} onChange={(e) => set("registered", e.target.value)} />
            </Field>
            <Field label="Shortlisted" htmlFor="dr-short" error={fields.shortlisted}>
              <input id="dr-short" type="number" min={0} className={inputClass} value={f.shortlisted} onChange={(e) => set("shortlisted", e.target.value)} />
            </Field>
            <Field label="Offers" htmlFor="dr-offers" error={fields.offers}>
              <input id="dr-offers" type="number" min={0} className={inputClass} value={f.offers} onChange={(e) => set("offers", e.target.value)} />
            </Field>
          </div>
        </div>

        {message ? (
          <p className="text-sm text-rose" role="alert">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} {save.isPending ? "Saving…" : drive ? "Save changes" : "Schedule drive"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveDialog({ drive, onClose, onDone }: { drive: DriveItem; onClose: () => void; onDone: () => void }) {
  const del = useMutation({
    mutationFn: () => apiFetch(`/api/v1/drives/${encodeURIComponent(drive.id)}`, Ok, { method: "DELETE" }),
    onSuccess: onDone,
  });
  const { message } = problemOf(del.error, "Could not delete the drive. Try again.");
  return (
    <Modal title="Delete this drive?" onClose={onClose}>
      <p className="text-sm text-ink-2">
        {drive.company} · {drive.role} on {dateText(drive.date)} will be removed, with its outcome counts. This cannot be undone. If the drive was called off, set its status to Cancelled instead.
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
          {del.isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
