"use client";

import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { Button, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { apiFetch, ApiError } from "@/lib/api/client";
import { AWARD_KINDS, KIND_INFO, type AwardBody, type AwardKind, type CertificateProfile, type SheetData } from "@/lib/api/certificate-schemas";
import { UNIVERSITY } from "@/config/tenancy";
import { mediaUrl } from "@/lib/media";
import { acceptAttr, validateUpload } from "@/lib/security/upload";
import { cn } from "@/lib/utils";

export const emptyAward = (): AwardBody => ({ kind: "appreciation", recipientName: "", recipientSub: null, recipientDetail: "", reason: "", eventName: "", eventDate: "" });

/** What the certificate sheet shows for a draft award (used for live previews). */
export function previewSheet(b: AwardBody, profile: CertificateProfile, id = ""): SheetData {
  const today = new Date().toISOString();
  return {
    id,
    kind: b.kind,
    recipientName: b.recipientName || "Recipient Name",
    recipientDetail: b.recipientDetail,
    statement: b.reason || KIND_INFO[b.kind].example,
    highlights: [
      ...(b.eventName ? [{ label: b.kind === "internship" ? "Programme" : "Event", value: b.eventName }] : []),
      ...(b.eventDate ? [{ label: "Held on", value: new Date(`${b.eventDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) }] : []),
      { label: "Date of issue", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
    ],
    issuedAt: today,
    status: "valid",
    note: "",
    university: UNIVERSITY.name,
    profile,
  };
}

type Student = { sub: string; name: string; rollNo: string; department: string };

/** The award form: type, recipient (a student of the college, or someone external), what it is for, event and date. */
export function AwardForm({ value, onChange, students, errors }: { value: AwardBody; onChange: (b: AwardBody) => void; students: Student[]; errors: Record<string, string> }) {
  const [mode, setMode] = useState<"student" | "external">(value.recipientSub || !value.recipientName ? "student" : "external");
  const [search, setSearch] = useState("");
  const set = <K extends keyof AwardBody>(k: K, v: AwardBody[K]) => onChange({ ...value, [k]: v });
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return students.filter((s) => `${s.name} ${s.rollNo} ${s.department}`.toLowerCase().includes(q)).slice(0, 8);
  }, [students, search]);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Certificate type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AWARD_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={value.kind === k} onClick={() => set("kind", k as AwardKind)} className={cn("rounded-xl border px-3 py-2 text-left text-sm transition-colors", value.kind === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:border-brand/50")}>
              <span className="block font-medium">{KIND_INFO[k].label}</span>
              <span className="block text-xs opacity-75">Certificate {KIND_INFO[k].subtitle}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Recipient</legend>
        <div className="mb-2 flex gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label="Recipient type">
          {(["student", "external"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                onChange({ ...value, recipientSub: null, recipientName: "", recipientDetail: "" });
              }}
              className={cn("flex-1 rounded-lg px-3 py-1.5", mode === m ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3")}
            >
              {m === "student" ? "A student of this college" : "Someone else (guest, staff, other college)"}
            </button>
          ))}
        </div>
        {mode === "student" ? (
          value.recipientSub ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2 text-sm">
              <span>
                <b className="text-ink">{value.recipientName}</b> <span className="text-ink-3">· {value.recipientDetail}</span>
              </span>
              <Button size="sm" variant="ghost" type="button" onClick={() => onChange({ ...value, recipientSub: null, recipientName: "", recipientDetail: "" })}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <label htmlFor="award-student" className="sr-only">
                Search students
              </label>
              <input id="award-student" className={inputClass} placeholder="Search by name or roll number…" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
              {matches.length ? (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
                  {matches.map((s) => (
                    <li key={s.sub}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                        onClick={() => {
                          onChange({ ...value, recipientSub: s.sub, recipientName: s.name, recipientDetail: [s.rollNo, s.department].filter(Boolean).join(" · ") });
                          setSearch("");
                        }}
                      >
                        <b className="text-ink">{s.name}</b> <span className="text-ink-3">· {s.rollNo} · {s.department}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {errors.recipientSub || errors.recipientName ? <p className="mt-1 text-xs text-rose">{errors.recipientSub ?? errors.recipientName}</p> : null}
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="award-name" error={errors.recipientName}>
              <input id="award-name" className={inputClass} maxLength={80} value={value.recipientName} onChange={(e) => set("recipientName", e.target.value)} />
            </Field>
            <Field label="Designation / institution (optional)" htmlFor="award-detail" error={errors.recipientDetail}>
              <input id="award-detail" className={inputClass} maxLength={120} placeholder="e.g. Resource person, Infosys Ltd" value={value.recipientDetail} onChange={(e) => set("recipientDetail", e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>

      <Field label={`What it is for (${value.reason.length}/400)`} htmlFor="award-reason" error={errors.reason} hint="Printed after the recipient's name. Start in lower case, e.g. “in recognition of …”, “has secured …”.">
        <textarea id="award-reason" className={cn(inputClass, "min-h-24")} maxLength={400} value={value.reason} onChange={(e) => set("reason", e.target.value)} placeholder={KIND_INFO[value.kind].example} />
      </Field>
      <button type="button" className="-mt-2 text-xs font-medium text-brand hover:underline" onClick={() => set("reason", KIND_INFO[value.kind].example)}>
        Use the example wording
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event / programme (optional)" htmlFor="award-event" error={errors.eventName}>
          <input id="award-event" className={inputClass} maxLength={120} value={value.eventName} onChange={(e) => set("eventName", e.target.value)} placeholder="e.g. TECHNOVA 2026" />
        </Field>
        <Field label="Held on (optional)" htmlFor="award-date" error={errors.eventDate}>
          <input id="award-date" type="date" className={inputClass} value={value.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/** A small uploader for a logo, seal or signature (PNG/JPEG/WebP ≤ 2 MB, signature-checked on the server). */
export function ImageSlot({ id, label, hint, value, onChange, disabled }: { id: string; label: string; hint: string; value: string; onChange: (ref: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = mediaUrl(value);
  const upload = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const check = await validateUpload(file, "image");
    if (!check.ok) return setError(check.reason);
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? "").split(",")[1] ?? "");
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await apiFetch("/api/v1/media", z.object({ id: z.string() }), { method: "POST", body: { contentType: file.type, data } });
      onChange(res.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="mt-1 flex items-center gap-3">
        <div className="bg-notebook grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={`${label} preview`} className="h-full w-full object-contain p-1" /> : <Fi name="picture" className="text-2xl text-ink-3" />}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>
              {busy ? <Spinner /> : <Fi name="upload" />} {src ? "Replace" : "Upload"}
            </Button>
            {src ? (
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange("")}>
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-3">{hint}</p>
          {error ? <p className="text-xs text-rose">{error}</p> : null}
        </div>
        <input ref={input} id={id} type="file" accept={acceptAttr("image")} className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}
