"use client";

import { Fi } from "@/components/ui/icon";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { BLOOM_LEVELS, COURSE_OUTCOMES, DIFFICULTY_OPTIONS } from "@/config/resources";
import { EVENT_TYPES, type CurrentAffairData, type EventData, type QuestionItem, type QuestionSetData } from "@/lib/api/content-desk-schemas";
import { CA_CATEGORIES } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";

type Errors = Record<string, string>;
const today = () => new Date().toISOString().slice(0, 10);

export const blankData = {
  "current-affair": (): CurrentAffairData => ({ date: today(), category: "National", headline: "", summary: "", sourceName: "", sourceUrl: "", mcq: null }),
  "question-set": (): QuestionSetData => ({ subject: "", items: [blankQuestion()] }),
  event: (): EventData => ({ title: "", type: "Seminar", date: today(), startTime: "09:30", venue: "", organiser: "University", capacity: 200, registrationOpen: true, description: "" }),
};
export const blankQuestion = (): QuestionItem => ({ question: "", topic: "", difficulty: "Medium", bloom: "Understand", co: "CO1", marks: 2, explanation: "", approved: true });

/* ── current affairs ── */
export function CurrentAffairEditor({ value, onChange, errors, disabled }: { value: CurrentAffairData; onChange: (v: CurrentAffairData) => void; errors: Errors; disabled?: boolean }) {
  const set = <K extends keyof CurrentAffairData>(k: K, v: CurrentAffairData[K]) => onChange({ ...value, [k]: v });
  const mcq = value.mcq;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_180px]">
        <Field label="Headline" htmlFor="ca-h" error={errors.headline}>
          <input id="ca-h" className={inputClass} maxLength={140} value={value.headline} onChange={(e) => set("headline", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Category" htmlFor="ca-c">
          <select id="ca-c" className={inputClass} value={value.category} onChange={(e) => set("category", e.target.value as CurrentAffairData["category"])} disabled={disabled}>
            {CA_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor="ca-d" error={errors.date}>
          <input id="ca-d" type="date" className={inputClass} value={value.date} onChange={(e) => set("date", e.target.value)} disabled={disabled} />
        </Field>
      </div>
      <Field label="Summary" htmlFor="ca-s" error={errors.summary} hint={`${value.summary.length}/600 · exam-focused: who, what, where and why it matters`}>
        <textarea id="ca-s" className={cn(inputClass, "min-h-28")} maxLength={600} value={value.summary} onChange={(e) => set("summary", e.target.value)} disabled={disabled} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source checked" htmlFor="ca-sn" error={errors.sourceName} hint="e.g. PIB, The Hindu">
          <input id="ca-sn" className={inputClass} maxLength={80} value={value.sourceName} onChange={(e) => set("sourceName", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Source link (optional)" htmlFor="ca-su" error={errors.sourceUrl} hint="https link from a government or listed news site">
          <input id="ca-su" className={inputClass} value={value.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://pib.gov.in/…" disabled={disabled} />
        </Field>
      </div>
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Practice question (goes into the weekly quiz)</p>
          {mcq ? (
            <Button size="sm" variant="ghost" onClick={() => set("mcq", null)} disabled={disabled}>
              Remove
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => set("mcq", { question: "", options: ["", "", "", ""], answer: 0, explanation: "" })} disabled={disabled}>
              <Fi name="plus" /> Add question
            </Button>
          )}
        </div>
        {mcq ? (
          <div className="mt-3 space-y-3">
            <input aria-label="Question" className={inputClass} value={mcq.question} onChange={(e) => set("mcq", { ...mcq, question: e.target.value })} placeholder="Question" disabled={disabled} />
            <div className="grid gap-2 sm:grid-cols-2">
              {mcq.options.map((o, i) => (
                <label key={i} className={cn("flex items-center gap-2 rounded-xl border px-2 py-1.5", mcq.answer === i ? "border-teal bg-teal-soft/40" : "border-line")}>
                  <input type="radio" name="ca-ans" checked={mcq.answer === i} onChange={() => set("mcq", { ...mcq, answer: i })} className="accent-teal" disabled={disabled} aria-label={`Option ${i + 1} is correct`} />
                  <input className="w-full bg-transparent text-sm outline-none" value={o} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => set("mcq", { ...mcq, options: mcq.options.map((x, j) => (j === i ? e.target.value : x)) })} disabled={disabled} />
                </label>
              ))}
            </div>
            <input aria-label="Explanation" className={inputClass} value={mcq.explanation} onChange={(e) => set("mcq", { ...mcq, explanation: e.target.value })} placeholder="One-line explanation" disabled={disabled} />
            {errors["mcq.options"] || errors.mcq ? <p className="text-xs text-rose">{errors["mcq.options"] ?? errors.mcq}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── question sets ── */
export function QuestionSetEditor({ value, onChange, errors, disabled }: { value: QuestionSetData; onChange: (v: QuestionSetData) => void; errors: Errors; disabled?: boolean }) {
  const setItem = (i: number, q: QuestionItem) => onChange({ ...value, items: value.items.map((x, j) => (j === i ? q : x)) });
  const approved = value.items.filter((q) => q.approved).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Field label="Subject" htmlFor="qs-sub" error={errors.subject}>
            <input id="qs-sub" className={inputClass} maxLength={100} value={value.subject} onChange={(e) => onChange({ ...value, subject: e.target.value })} disabled={disabled} />
          </Field>
        </div>
        <Badge tone={approved ? "teal" : "amber"}>
          {approved} of {value.items.length} approved
        </Badge>
        {!disabled ? (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => onChange({ ...value, items: value.items.map((q) => ({ ...q, approved: true })) })}>
              Approve all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, items: value.items.map((q) => ({ ...q, approved: false })) })}>
              Clear
            </Button>
          </div>
        ) : null}
      </div>
      {errors.items ? <p className="text-xs text-rose">{errors.items}</p> : null}
      <ol className="space-y-3">
        {value.items.map((q, i) => (
          <li key={i} className={cn("rounded-xl border p-3 transition", q.approved ? "border-teal/40 bg-teal-soft/20" : "border-line")}>
            <div className="flex items-start gap-3">
              <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <textarea aria-label={`Question ${i + 1}`} className={cn(inputClass, "min-h-16")} value={q.question} onChange={(e) => setItem(i, { ...q, question: e.target.value })} disabled={disabled} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <input aria-label="Topic" className={inputClass} value={q.topic} placeholder="Topic" onChange={(e) => setItem(i, { ...q, topic: e.target.value })} disabled={disabled} />
                  <select aria-label="Difficulty" className={inputClass} value={q.difficulty} onChange={(e) => setItem(i, { ...q, difficulty: e.target.value as QuestionItem["difficulty"] })} disabled={disabled}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <select aria-label="Bloom level" className={inputClass} value={q.bloom} onChange={(e) => setItem(i, { ...q, bloom: e.target.value as QuestionItem["bloom"] })} disabled={disabled}>
                    {BLOOM_LEVELS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <select aria-label="Course outcome" className={inputClass} value={q.co} onChange={(e) => setItem(i, { ...q, co: e.target.value as QuestionItem["co"] })} disabled={disabled}>
                    {COURSE_OUTCOMES.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <input aria-label="Marks" type="number" min={1} max={50} className={inputClass} value={q.marks} onChange={(e) => setItem(i, { ...q, marks: Number(e.target.value) || 1 })} disabled={disabled} />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-brand">Model answer</summary>
                  <textarea aria-label="Model answer" className={cn(inputClass, "mt-2 min-h-20")} value={q.explanation} onChange={(e) => setItem(i, { ...q, explanation: e.target.value })} disabled={disabled} />
                </details>
              </div>
              <div className="flex flex-col items-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-2">
                  <input type="checkbox" checked={q.approved} onChange={(e) => setItem(i, { ...q, approved: e.target.checked })} className="size-4 accent-teal" disabled={disabled} /> Approved
                </label>
                {!disabled ? (
                  <button type="button" className="text-ink-3 hover:text-rose" aria-label={`Delete question ${i + 1}`} onClick={() => onChange({ ...value, items: value.items.filter((_, j) => j !== i) })}>
                    <Fi name="trash" />
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {!disabled && value.items.length < 40 ? (
        <Button size="sm" variant="secondary" onClick={() => onChange({ ...value, items: [...value.items, blankQuestion()] })}>
          <Fi name="plus" /> Add a question
        </Button>
      ) : null}
    </div>
  );
}

/* ── events ── */
export function EventEditor({ value, onChange, errors, disabled }: { value: EventData; onChange: (v: EventData) => void; errors: Errors; disabled?: boolean }) {
  const set = <K extends keyof EventData>(k: K, v: EventData[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Event title" htmlFor="ev-t" error={errors.title}>
          <input id="ev-t" className={inputClass} maxLength={100} value={value.title} onChange={(e) => set("title", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Type" htmlFor="ev-ty">
          <select id="ev-ty" className={inputClass} value={value.type} onChange={(e) => set("type", e.target.value as EventData["type"])} disabled={disabled}>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Date" htmlFor="ev-d" error={errors.date}>
          <input id="ev-d" type="date" className={inputClass} value={value.date} onChange={(e) => set("date", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Starts at" htmlFor="ev-st" error={errors.startTime}>
          <input id="ev-st" type="time" className={inputClass} value={value.startTime} onChange={(e) => set("startTime", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Capacity per college" htmlFor="ev-c" error={errors.capacity}>
          <input id="ev-c" type="number" min={1} max={20000} className={inputClass} value={value.capacity} onChange={(e) => set("capacity", Number(e.target.value) || 1)} disabled={disabled} />
        </Field>
        <label className="mt-7 inline-flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={value.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} className="size-4 accent-brand" disabled={disabled} /> Registrations open
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue" htmlFor="ev-v" error={errors.venue} hint="Use “Each college campus” for events held everywhere">
          <input id="ev-v" className={inputClass} maxLength={80} value={value.venue} onChange={(e) => set("venue", e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Organiser" htmlFor="ev-o" error={errors.organiser}>
          <input id="ev-o" className={inputClass} maxLength={80} value={value.organiser} onChange={(e) => set("organiser", e.target.value)} disabled={disabled} />
        </Field>
      </div>
      <Field label="Description and agenda" htmlFor="ev-desc" error={errors.description} hint={`${value.description.length}/1500`}>
        <textarea id="ev-desc" className={cn(inputClass, "min-h-36")} maxLength={1500} value={value.description} onChange={(e) => set("description", e.target.value)} disabled={disabled} />
      </Field>
    </div>
  );
}
