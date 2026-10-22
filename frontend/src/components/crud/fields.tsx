"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fieldLabel, type FieldDef, type RecordValue } from "@/config/resources";
import { streamOptions, type Stream } from "@/config/streams";
import { Fi } from "@/components/ui/icon";
import { Badge, inputClass, RoleBadge, toneForStatus } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/media";
import { apiFetch } from "@/lib/api/client";
import { FacultyOptions } from "@/lib/api/schemas";
import { ImageField } from "./image-field";

/** Renders one form control for a resource field. Values stay typed (number/boolean/string[]). */
export function FieldInput({
  field,
  value,
  error,
  onChange,
  disabled,
  stream = null,
  collegeId,
}: {
  field: FieldDef;
  value: RecordValue;
  error?: string;
  onChange: (v: RecordValue) => void;
  disabled?: boolean;
  /** The owning college's stream: narrows programme/department/term lists and relabels entrance scores. */
  stream?: Stream | null;
  collegeId?: string;
}) {
  const label = fieldLabel(field, stream);
  const options = field.streamOptions && stream ? streamOptions(field.streamOptions, stream) : field.options;
  const id = `f-${field.name}`;
  const describedBy = error ? `${id}-err` : field.help ? `${id}-help` : undefined;
  const common = { id, disabled, "aria-invalid": Boolean(error), "aria-describedby": describedBy, "aria-required": field.required };

  let control: React.ReactNode;
  if (field.lookup === "faculty") {
    control = (
      <FacultyField
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v)}
        disabled={disabled}
        collegeId={collegeId}
      />
    );
  } else {
    switch (field.type) {
    case "toggle":
      control = (
        <button
          type="button"
          role="switch"
          aria-checked={value === true}
          {...common}
          onClick={() => onChange(!(value === true))}
          className={cn(
            "flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
            value === true ? "border-teal/40 bg-teal-soft/60" : "border-line bg-surface hover:border-brand/30",
          )}
        >
          <span className="text-ink">{label}</span>
          <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value === true ? "bg-teal" : "bg-line")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", value === true ? "translate-x-5" : "translate-x-0.5")} />
          </span>
        </button>
      );
      break;
    case "checklist": {
      const arr = Array.isArray(value) ? value : [];
      control = (
        <div role="group" aria-labelledby={`${id}-label`} className="grid gap-2 sm:grid-cols-2">
          {field.options?.map((opt) => {
            const on = arr.includes(opt);
            return (
              <label key={opt} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors", on ? "border-brand/40 bg-brand-soft" : "border-line hover:border-brand/30")}>
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand)]"
                  checked={on}
                  disabled={disabled}
                  onChange={() => onChange(on ? arr.filter((x) => x !== opt) : [...arr, opt])}
                />
                <span className="text-ink">{opt}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    }
    case "image":
      control = <ImageField id={id} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} disabled={disabled} invalid={Boolean(error)} />;
      break;
    case "select":
      control = (
        <select {...common} className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          {!field.required || !value ? <option value="">{field.required ? "Select…" : "— None —"}</option> : null}
          {/* Keep a legacy value visible even if it is no longer offered for this stream. */}
          {typeof value === "string" && value && !options?.includes(value) ? <option value={value}>{value} (not offered)</option> : null}
          {options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "textarea":
      control = (
        <textarea
          {...common}
          rows={4}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "number":
      control = (
        <input
          {...common}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          className={inputClass}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
      break;
    default:
      control = (
        <input
          {...common}
          type={field.type === "tel" ? "tel" : field.type}
          inputMode={field.type === "tel" ? "numeric" : undefined}
          autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "off"}
          maxLength={field.type === "tel" ? 10 : field.maxLength ?? 120}
          min={field.minDate}
          max={field.maxDate}
          placeholder={field.placeholder}
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }

  return (
    <div className={cn("space-y-1.5", field.wide && "sm:col-span-2")}>
      {field.type !== "toggle" ? (
        <label id={`${id}-label`} htmlFor={field.type === "checklist" || field.type === "image" ? undefined : id} className="flex items-center gap-1 text-sm font-medium text-ink">
          {label}
          {field.required ? (
            <span className="text-rose" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {control}
      {error ? (
        <p id={`${id}-err`} className="flex items-center gap-1 text-xs text-rose" role="alert">
          <Fi name="exclamation" className="text-[10px]" /> {error}
        </p>
      ) : field.help ? (
        <p id={`${id}-help`} className="text-xs text-ink-3">
          {field.help}
        </p>
      ) : null}
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Read-only display of a field value (all text rendered as React text nodes). */
export function ValueView({
  field,
  value,
  inTable = false,
}: {
  field: FieldDef;
  value: RecordValue | undefined;
  inTable?: boolean;
}) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return <span className="text-ink-3">—</span>;
  if (field.type === "toggle") return value ? <Badge tone="teal">Yes</Badge> : <Badge tone="neutral">No</Badge>;
  if (field.type === "image") {
    const src = mediaUrl(value);
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <img src={src} alt="" className="h-12 w-20 rounded-lg border border-line object-cover" /> : <span className="text-ink-3">—</span>;
  }
  if (Array.isArray(value))
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Badge key={v} tone="brand">
            <Fi name="check" className="text-[9px]" /> {v}
          </Badge>
        ))}
      </span>
    );
  if (field.type === "date" && typeof value === "string") return <span>{formatDate(value)}</span>;
  if (field.name === "role" || field.name === "userRole") return <RoleBadge role={String(value)} size={inTable ? "sm" : "md"} />;
  if (field.column === "badge" || field.name === "status") return <Badge tone={toneForStatus(String(value))}>{String(value)}</Badge>;
  if (field.type === "textarea") {
    return inTable ? (
      <span className="line-clamp-2 break-words leading-relaxed" title={String(value)}>
        {String(value)}
      </span>
    ) : (
      <span className="whitespace-pre-wrap">{String(value)}</span>
    );
  }
  if (field.name === "department" || field.name === "title") {
    return (
      <span className="whitespace-normal break-words leading-relaxed" title={String(value)}>
        {String(value)}
      </span>
    );
  }
  return inTable ? (
    <span className="line-clamp-1 break-words" title={String(value)}>
      {String(value)}
    </span>
  ) : (
    <span className="break-words">{String(value)}</span>
  );
}

function FacultyField({
  id,
  value,
  onChange,
  disabled,
  collegeId,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  collegeId?: string;
}) {
  const [customMode, setCustomMode] = useState(false);
  const facultyQuery = useQuery({
    queryKey: ["faculty-options", collegeId],
    queryFn: () => apiFetch(`/api/v1/staff/faculty-options${collegeId ? `?college=${encodeURIComponent(collegeId)}` : ""}`, FacultyOptions),
  });

  const facultyList = facultyQuery.data?.faculty ?? [];
  const hasFaculty = facultyList.length > 0;
  const isKnownFaculty = facultyList.some((f) => f.name === value);

  useEffect(() => {
    if (value && facultyQuery.isSuccess && hasFaculty && !isKnownFaculty) {
      setCustomMode(true);
    }
  }, [value, facultyQuery.isSuccess, hasFaculty, isKnownFaculty]);

  if (customMode || (!facultyQuery.isLoading && !hasFaculty)) {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            className={inputClass}
            placeholder="Type faculty name (e.g. Dr. Meena Raghavan)"
            value={value}
            disabled={disabled}
            maxLength={80}
            onChange={(e) => onChange(e.target.value)}
          />
          {hasFaculty ? (
            <button
              type="button"
              className="shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink transition-colors"
              onClick={() => {
                setCustomMode(false);
                onChange("");
              }}
            >
              Choose from staff
            </button>
          ) : null}
        </div>
        <p className="text-xs text-ink-3">
          {hasFaculty
            ? "Typing custom / visiting faculty. Click 'Choose from staff' to select a registered faculty member."
            : "No staff records found for this college yet. You can type the faculty name directly."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <select
        id={id}
        className={inputClass}
        value={value}
        disabled={disabled || facultyQuery.isLoading}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setCustomMode(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{facultyQuery.isLoading ? "Loading staff list…" : "Select a faculty member…"}</option>
        {facultyList.map((f) => {
          const details = [f.department, f.designation].filter(Boolean).join(" · ");
          return (
            <option key={f.id} value={f.name}>
              {f.name} {details ? `(${details})` : ""}
            </option>
          );
        })}
        <option value="__custom__">+ Enter other / visiting faculty name…</option>
      </select>
    </div>
  );
}
