"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { emptyValues, recordSchema, streamRuleErrors, type RecordValue, type ResourceDef } from "@/config/resources";
import { streamOfType, type Stream } from "@/config/streams";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { apiFetch, ApiError } from "@/lib/api/client";
import { CollegeOptions, RecordEnvelope, ResourceRecordSchema } from "@/lib/api/schemas";
import { ModuleHeader } from "@/components/modules/module-header";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { Button, Card, CardBody, EmptyState, IconChip, LinkButton, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { FieldInput } from "./fields";
import { setFlash } from "./flash";

const SECTION_ICONS = ["user", "graduation-cap", "diploma", "users-alt", "shield-check", "briefcase", "settings"];

export function CrudForm({
  mod,
  role,
  resource,
  recordId,
  allColleges = false,
  stream = null,
  defaultDepartment = null,
}: {
  mod: ModuleDef;
  role: Role;
  resource: ResourceDef;
  recordId?: string;
  allColleges?: boolean;
  stream?: Stream | null;
  defaultDepartment?: string | null;
}) {
  const isEdit = Boolean(recordId);
  const existing = useQuery({
    queryKey: ["record", resource.key, recordId],
    queryFn: () => apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(recordId!)}`, RecordEnvelope),
    enabled: isEdit,
  });

  if (isEdit && existing.isLoading) return <TemplateSkeleton />;
  if (isEdit && (existing.error || !existing.data)) {
    return (
      <EmptyState
        title="Record not found"
        body={existing.error instanceof ApiError ? existing.error.message : undefined}
        action={<LinkButton href={`/${role}/${mod.slug}`}>Back to {resource.title}</LinkButton>}
      />
    );
  }
  const record = existing.data?.record;
  // Key forces a fresh form state when a different record (or version) loads.
  return (
    <FormInner
      key={`${recordId ?? "new"}-${record?.version ?? 0}`}
      mod={mod}
      role={role}
      resource={resource}
      initial={record}
      pickCollege={allColleges && Boolean(resource.scoped) && !isEdit}
      sessionStream={stream ?? (record?.collegeType ? streamOfType(record.collegeType) : null)}
      defaultDepartment={defaultDepartment}
    />
  );
}

function FormInner({
  mod,
  role,
  resource,
  initial,
  pickCollege,
  sessionStream,
  defaultDepartment,
}: {
  mod: ModuleDef;
  role: Role;
  resource: ResourceDef;
  initial?: Record<string, RecordValue> & { id: string; version: number; collegeName?: RecordValue };
  pickCollege: boolean;
  sessionStream: Stream | null;
  defaultDepartment?: string | null;
}) {
  const [collegeId, setCollegeId] = useState("");
  const collegeOptions = useQuery({
    queryKey: ["college-options"],
    queryFn: () => apiFetch("/api/v1/colleges/options", CollegeOptions),
    enabled: pickCollege,
  });
  const pickedType = collegeOptions.data?.colleges.find((c) => c.id === collegeId)?.type;
  const stream: Stream | null = pickCollege ? (pickedType ? streamOfType(pickedType) : null) : sessionStream;
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = Boolean(initial);
  const isScopedStaff = (role === "hod" || role === "faculty") && Boolean(defaultDepartment);
  const start = useMemo(() => {
    const base = emptyValues(resource);
    if (!initial) {
      if (isScopedStaff && defaultDepartment && "department" in base) {
        return { ...base, department: defaultDepartment };
      }
      return base;
    }
    return Object.fromEntries(Object.keys(base).map((k) => [k, initial[k] ?? base[k] ?? null]));
  }, [initial, resource, isScopedStaff, defaultDepartment]);

  const [values, setValues] = useState<Record<string, RecordValue>>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(start);
  const base = `/${role}/${mod.slug}`;

  // Warn before leaving with unsaved changes (tab close / reload).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (data: Record<string, RecordValue>) =>
      isEdit
        ? apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(initial!.id)}`, ResourceRecordSchema, { method: "PUT", body: { data, version: initial!.version } })
        : apiFetch(`/api/v1/records/${resource.key}`, ResourceRecordSchema, { method: "POST", body: pickCollege ? { data, collegeId } : { data } }),
    onSuccess: (rec) => {
      void qc.invalidateQueries({ queryKey: ["records", resource.key] });
      void qc.invalidateQueries({ queryKey: ["record", resource.key, rec.id] });
      setFlash(isEdit ? `${resource.singular} ${rec.id} was updated.` : `${resource.singular} ${rec.id} was created.`);
      router.push(`${base}/${encodeURIComponent(rec.id)}`);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setFormError(e.message);
      } else setFormError("Could not save. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Same schema the server uses — instant feedback, server re-validates anyway.
    const parsed = recordSchema(resource).safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setFormError(`Please fix ${Object.keys(next).length} highlighted ${Object.keys(next).length === 1 ? "field" : "fields"}.`);
      document.getElementById(`f-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    if (stream) {
      const streamErrs = streamRuleErrors(resource, parsed.data as Record<string, RecordValue>, stream);
      if (Object.keys(streamErrs).length) {
        setErrors(streamErrs);
        setFormError("Some choices are not offered by this college's stream.");
        document.getElementById(`f-${Object.keys(streamErrs)[0]}`)?.focus();
        return;
      }
    }
    if (pickCollege && !collegeId) {
      setErrors({ collegeId: "Choose the college this record belongs to" });
      setFormError("Please choose a college.");
      document.getElementById("f-collegeId")?.focus();
      return;
    }
    setErrors({});
    save.mutate(parsed.data as Record<string, RecordValue>);
  };

  const set = (name: string, v: RecordValue) => {
    setValues((p) => ({ ...p, [name]: v }));
    if (errors[name])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
  };

  const requiredCount = resource.fields.filter((f) => f.required).length;
  const filledRequired = resource.fields.filter((f) => f.required && values[f.name] !== "" && values[f.name] !== null).length;
  const completion = Math.round((filledRequired / Math.max(requiredCount, 1)) * 100);

  return (
    <div>
      <ModuleHeader
        mod={mod}
        role={role}
        crumbs={isEdit ? [{ label: initial!.id, href: `${base}/${encodeURIComponent(initial!.id)}` }, { label: "Edit" }] : [{ label: `New ${resource.singular.toLowerCase()}` }]}
        title={isEdit ? `Edit ${resource.singular.toLowerCase()} · ${initial!.id}` : `Add ${resource.singular.toLowerCase()}`}
        description={isEdit ? `Update the details below. Changes are validated, versioned and recorded in the audit log.` : `Fill in the details below. Fields marked * are required.`}
      />

      <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {formError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-ink" role="alert">
              <Fi name="triangle-warning" className="mt-0.5 text-rose" />
              <div>
                <p className="font-medium">{formError}</p>
                {errors._ ? <p className="text-ink-2">{errors._}</p> : null}
              </div>
            </div>
          ) : null}

          {pickCollege ? (
            <Card className="overflow-hidden border-violet/30">
              <div className="flex items-center gap-3 border-b border-line bg-violet-soft/60 px-5 py-4">
                <IconChip tone="brand" className="size-9 text-base">
                  <Fi name="school" />
                </IconChip>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">College</h2>
                  <p className="text-xs text-ink-3">You are working at university level — choose which college owns this record.</p>
                </div>
              </div>
              <CardBody>
                <label htmlFor="f-collegeId" className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
                  College <span className="text-rose" aria-hidden>*</span>
                </label>
                <select
                  id="f-collegeId"
                  value={collegeId}
                  aria-invalid={Boolean(errors.collegeId)}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-rose"
                >
                  <option value="">Select a college…</option>
                  {collegeOptions.data?.colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.type}, {c.city}
                      {c.status !== "Active" ? ` (${c.status})` : ""}
                    </option>
                  ))}
                </select>
                {errors.collegeId ? <p className="mt-1.5 text-xs text-rose" role="alert">{errors.collegeId}</p> : null}
              </CardBody>
            </Card>
          ) : initial?.collegeName ? (
            <p className="flex items-center gap-2 rounded-2xl border border-violet/20 bg-violet-soft/50 px-4 py-3 text-sm text-ink">
              <Fi name="school" className="text-violet" /> Belongs to <strong>{String(initial.collegeName)}</strong> — records cannot be moved between colleges.
            </p>
          ) : null}

          {resource.sections.map((section, i) => {
            const fields = resource.fields.filter((f) => f.section === section);
            if (!fields.length) return null;
            const sectionErrors = fields.filter((f) => errors[f.name]).length;
            return (
              <Card key={section} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line bg-surface-2/50 px-5 py-4">
                  <IconChip tone={(["brand", "gold", "teal", "sky", "amber"] as const)[i % 5]} className="size-9 text-base">
                    <Fi name={SECTION_ICONS[i % SECTION_ICONS.length] ?? "apps"} />
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-ink">{section}</h2>
                    <p className="text-xs text-ink-3">
                      Step {i + 1} of {resource.sections.length}
                    </p>
                  </div>
                  {sectionErrors ? <span className="rounded-full bg-rose-soft px-2 py-0.5 text-xs font-medium text-rose">{sectionErrors} to fix</span> : null}
                </div>
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  {fields.map((f) => {
                    const isDeptLocked = f.name === "department" && isScopedStaff && resource.key === "courses";
                    return (
                      <FieldInput
                        key={f.name}
                        field={f}
                        value={isDeptLocked ? (defaultDepartment ?? values[f.name] ?? null) : (values[f.name] ?? null)}
                        error={errors[f.name]}
                        onChange={(v) => set(f.name, v)}
                        disabled={save.isPending || (pickCollege && !collegeId) || isDeptLocked}
                        stream={stream}
                        collegeId={collegeId || undefined}
                      />
                    );
                  })}
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* Sticky summary / actions */}
        <aside className="xl:sticky xl:top-24 xl:h-fit">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">{isEdit ? "Editing" : "New"} {resource.singular.toLowerCase()}</p>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-ink-3">Required fields</span>
                <span className="font-medium text-ink">
                  {filledRequired}/{requiredCount}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={cn("h-full rounded-full transition-all", completion === 100 ? "bg-teal" : "bg-brand-gradient")} style={{ width: `${completion}%` }} />
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-ink-2">
              <li className="flex items-center gap-2">
                <Fi name="shield-check" className="text-teal" /> Validated in the browser and on the server
              </li>
              <li className="flex items-center gap-2">
                <Fi name="time-past" className="text-sky" /> {isEdit ? `Version ${initial!.version} — conflicting edits are blocked` : "Every change is audit-logged"}
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <Button type="submit" size="lg" disabled={save.isPending || (isEdit && !dirty)}>
                {save.isPending ? <Spinner /> : <Fi name={isEdit ? "disk" : "check"} />} {isEdit ? "Save changes" : `Create ${resource.singular.toLowerCase()}`}
              </Button>
              <Link
                href={isEdit ? `${base}/${encodeURIComponent(initial!.id)}` : base}
                onClick={(e) => {
                  if (dirty && !window.confirm("Discard your unsaved changes?")) e.preventDefault();
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink-2 hover:bg-surface-2"
              >
                Cancel
              </Link>
            </div>
            {dirty ? <p className="mt-3 text-center text-xs text-amber">You have unsaved changes</p> : null}
          </Card>
        </aside>
      </form>
    </div>
  );
}
