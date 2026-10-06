"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, CircleAlert, CircleX, FileDown, FileText, FileType2, Plus, RotateCcw, Save, ScanSearch, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { AiLabel } from "@/components/ui/notices";
import { Badge, Button, Card, CardBody, CardHeader, Field, Progress, Skeleton, Spinner, inputClass, toneForScore } from "@/components/ui/primitives";
import { apiFetch, ApiError } from "@/lib/api/client";
import { RESUME_TEMPLATES, ResumeDoc, ResumeOverview, resumeChecklist, resumeText } from "@/lib/api/resume-schemas";
import { ResumeAnalysis } from "@/lib/api/schemas";
import { downloadText, downloadWord, printResume } from "@/lib/resume-export";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";
import { PRINT_CSS, ResumePaper } from "./resume-preview";

const KEY = ["resume"] as const;
const ROLES = ["Software Engineer", "Data Analyst", "Data Scientist"];
const Saved = z.object({ doc: ResumeDoc, updatedAt: z.string() });
const TABS = ["Basics", "Education", "Skills", "Projects", "Experience", "More"] as const;
type Tab = (typeof TABS)[number];

const TEMPLATE_HELP: Record<(typeof RESUME_TEMPLATES)[number], string> = {
  Classic: "Serif, centred header. The safe choice for most campus drives.",
  Modern: "Clean sans-serif with a teal accent.",
  Compact: "Smaller type to fit more on one page.",
};

const same = (a: ResumeDoc, b: ResumeDoc) => JSON.stringify(a) === JSON.stringify(b);
const lines = (v: string, max: number) => v.split("\n").slice(0, max);
const swap = <T,>(a: T[], i: number, patch: Partial<T>): T[] => a.map((x, j) => (j === i ? { ...x, ...patch } : x));
const drop = <T,>(a: T[], i: number): T[] => a.filter((_, j) => j !== i);

export function ResumeModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/resume", ResumeOverview), staleTime: 0, refetchOnMount: "always" });
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Skeleton className="h-[600px] w-full" />;
  return <Builder data={q.data} />;
}

function Builder({ data }: { data: ResumeOverview }) {
  const qc = useQueryClient();
  const [doc, setDoc] = useState<ResumeDoc>(data.doc);
  const [tab, setTab] = useState<Tab>("Basics");
  const [role, setRole] = useState(ROLES[0]!);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = !same(doc, data.doc);
  const set = (patch: Partial<ResumeDoc>) => {
    setJustSaved(false);
    setDoc((d) => ({ ...d, ...patch }));
  };
  const checklist = useMemo(() => resumeChecklist(doc), [doc]);
  const done = checklist.filter((c) => c.done).length;
  const estLines = useMemo(() => resumeText(doc).split("\n").length, [doc]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/v1/resume", Saved, { method: "PUT", body: doc }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, { ...data, doc: r.doc, saved: true, updatedAt: r.updatedAt } satisfies ResumeOverview);
      setDoc(r.doc);
      setJustSaved(true);
    },
  });
  const analyze = useMutation({
    mutationFn: () => apiFetch("/api/v1/ai/resume/analyze", ResumeAnalysis, { method: "POST", body: { text: resumeText(doc), role } }),
  });
  const saveProblem = save.isError ? problemOf(save.error, "Could not save your resume. Try again.") : null;
  const canExport = doc.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <Card className="print:hidden">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold text-ink">{doc.name || "Your resume"}</p>
            <p className="text-xs text-ink-3" aria-live="polite">
              {dirty ? "Unsaved changes" : justSaved || data.saved ? `Saved${data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}` : "Draft made from your profile. Save it to keep it."}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setConfirmSeed(true)}>
            <RotateCcw className="size-4" /> Fill from my profile
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (!dirty && data.saved)}>
            {save.isPending ? <Spinner /> : <Save className="size-4" />} Save resume
          </Button>
        </CardBody>
        {saveProblem?.message ? (
          <p className="px-5 pb-4 text-sm text-rose" role="alert">
            {saveProblem.message}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6 print:hidden">
          <Card>
            <CardHeader title="Template" subtitle="All three are single-column with real text, so applicant-tracking systems can read them." />
            <CardBody className="grid gap-2 sm:grid-cols-3">
              {RESUME_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={doc.template === t}
                  onClick={() => set({ template: t })}
                  className={cn("rounded-xl border-2 p-3 text-left transition", doc.template === t ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40")}
                >
                  <span className="block text-sm font-semibold text-ink">{t}</span>
                  <span className="mt-0.5 block text-xs text-ink-2">{TEMPLATE_HELP[t]}</span>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <div role="tablist" aria-label="Resume sections" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn("shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium", tab === t ? "border-b-2 border-brand text-brand" : "text-ink-2 hover:text-ink")}
                >
                  {t}
                </button>
              ))}
            </div>
            <CardBody className="space-y-4">
              {tab === "Basics" ? <Basics doc={doc} set={set} /> : null}
              {tab === "Education" ? <EducationTab doc={doc} set={set} /> : null}
              {tab === "Skills" ? <SkillsTab doc={doc} set={set} /> : null}
              {tab === "Projects" ? <ProjectsTab doc={doc} set={set} /> : null}
              {tab === "Experience" ? <ExperienceTab doc={doc} set={set} /> : null}
              {tab === "More" ? <MoreTab doc={doc} set={set} /> : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="print:hidden">
            <CardBody className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-sm font-semibold text-ink">Download</span>
              <Button size="sm" onClick={() => printResume(doc)} disabled={!canExport}>
                <FileDown className="size-4" /> PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadWord(doc)} disabled={!canExport}>
                <FileType2 className="size-4" /> Word
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadText(doc)} disabled={!canExport}>
                <FileText className="size-4" /> Text
              </Button>
              <p className="w-full text-xs text-ink-3">PDF opens your browser&apos;s print window: choose &ldquo;Save as PDF&rdquo; as the destination. Word opens in Word, Google Docs and Pages.</p>
              {estLines > 58 ? <p className="w-full text-xs text-amber">This is long for one page. Fresher resumes read best on a single page, so trim older or weaker items.</p> : null}
            </CardBody>
          </Card>
          <div className="overflow-x-auto rounded-2xl bg-surface-2 p-3 sm:p-5">
            <ResumePaper doc={doc} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] print:hidden">
        <Card>
          <CardHeader title="Completeness" subtitle={`${done} of ${checklist.length} done`} />
          <CardBody className="space-y-2">
            <Progress value={Math.round((done / checklist.length) * 100)} tone={toneForScore((done / checklist.length) * 100)} label="Resume completeness" />
            <ul className="space-y-1.5 pt-1 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-ink-2">
                  {c.done ? <CheckCircle2 className="size-4 text-teal" /> : <Circle className="size-4 text-ink-3" />}
                  <span className={c.done ? "" : "text-ink"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="ATS check" subtitle="Keywords, structure and missing sections, read from the text of this resume." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select aria-label="Target role" className={cn(inputClass, "w-auto")} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Button onClick={() => analyze.mutate()} disabled={analyze.isPending || resumeText(doc).length < 20}>
                {analyze.isPending ? <Spinner /> : <ScanSearch className="size-4" />} Check my resume
              </Button>
            </div>
            {analyze.isError ? (
              <p className="text-sm text-rose" role="alert">
                {analyze.error instanceof ApiError ? analyze.error.message : "The check failed. Try again."}
              </p>
            ) : null}
            {analyze.data ? <AnalysisView a={analyze.data} role={role} /> : <p className="text-sm text-ink-3">Pick the role you are applying for and run the check. It re-reads whatever is in the preview now.</p>}
          </CardBody>
        </Card>
      </div>

      {confirmSeed ? (
        <Modal title="Fill from my profile?" onClose={() => setConfirmSeed(false)}>
          <p className="text-sm text-ink-2">
            This replaces what is in the editor with a fresh draft built from your name, programme, subjects and Experience Passport. Your last saved resume is not changed until you press Save.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmSeed(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                set({ ...data.seed, template: doc.template, email: doc.email || data.seed.email, phone: doc.phone, location: doc.location, links: doc.links });
                setConfirmSeed(false);
              }}
            >
              Replace with profile draft
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── editor tabs ───────────────────────────── */
interface TabProps {
  doc: ResumeDoc;
  set: (p: Partial<ResumeDoc>) => void;
}

const Text = ({ id, label, value, onChange, max, placeholder, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; hint?: string }) => (
  <Field label={label} htmlFor={id} hint={hint}>
    <input id={id} className={inputClass} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </Field>
);

const Bulleted = ({ id, label, value, onChange, max = 8, hint }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; max?: number; hint?: string }) => (
  <Field label={label} htmlFor={id} hint={hint ?? "One point per line. Start with a verb and add a number where you can."}>
    <textarea id={id} rows={Math.min(8, Math.max(3, value.length + 1))} className={inputClass} value={value.join("\n")} onChange={(e) => onChange(lines(e.target.value, max).map((l) => l.slice(0, 300)))} />
  </Field>
);

function Item({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${title}`}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function Basics({ doc, set }: TabProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text id="cv-name" label="Full name" value={doc.name} max={80} onChange={(v) => set({ name: v })} />
        <Text id="cv-headline" label="Headline" value={doc.headline} max={120} placeholder="B.E. Computer Science student · Backend developer" onChange={(v) => set({ headline: v })} />
        <Text id="cv-email" label="Email" value={doc.email} max={120} placeholder="you@example.com" onChange={(v) => set({ email: v })} />
        <Text id="cv-phone" label="Phone" value={doc.phone} max={30} onChange={(v) => set({ phone: v })} />
        <Text id="cv-location" label="Location" value={doc.location} max={80} placeholder="Tiruchirappalli, Tamil Nadu" onChange={(v) => set({ location: v })} />
      </div>
      <Field label="Links" htmlFor="cv-links" hint="One per line, up to 5: GitHub, LinkedIn, portfolio.">
        <textarea id="cv-links" rows={3} className={inputClass} value={doc.links.join("\n")} onChange={(e) => set({ links: lines(e.target.value, 5).map((l) => l.slice(0, 200)) })} />
      </Field>
      <Field label="Summary" htmlFor="cv-summary" hint={`${doc.summary.length}/700. Two or three lines on what you do and what you are looking for.`}>
        <textarea id="cv-summary" rows={4} maxLength={700} className={inputClass} value={doc.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>
    </>
  );
}

function EducationTab({ doc, set }: TabProps) {
  return (
    <>
      {doc.education.map((e, i) => (
        <Item key={i} title={e.degree || e.school || `Education ${i + 1}`} onRemove={() => set({ education: drop(doc.education, i) })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text id={`ed-d-${i}`} label="Degree" value={e.degree} max={160} onChange={(v) => set({ education: swap(doc.education, i, { degree: v }) })} />
            <Text id={`ed-s-${i}`} label="College / school" value={e.school} max={140} onChange={(v) => set({ education: swap(doc.education, i, { school: v }) })} />
            <Text id={`ed-p-${i}`} label="Years" value={e.period} max={40} placeholder="2022 – 2026" onChange={(v) => set({ education: swap(doc.education, i, { period: v }) })} />
            <Text id={`ed-m-${i}`} label="CGPA / percentage" value={e.score} max={40} placeholder="CGPA 8.4" onChange={(v) => set({ education: swap(doc.education, i, { score: v }) })} />
          </div>
        </Item>
      ))}
      {doc.education.length < 6 ? (
        <Button variant="secondary" size="sm" onClick={() => set({ education: [...doc.education, { school: "", degree: "", period: "", score: "" }] })}>
          <Plus className="size-4" /> Add education
        </Button>
      ) : null}
    </>
  );
}

function SkillsTab({ doc, set }: TabProps) {
  return (
    <>
      <Field label="Skills" htmlFor="cv-skills" hint="Separate with commas. Use the words job posts use: Python, SQL, React, Git.">
        <textarea
          id="cv-skills"
          rows={4}
          className={inputClass}
          value={doc.skills.join(", ")}
          onChange={(e) => set({ skills: e.target.value.split(",").map((s) => s.trimStart().slice(0, 40)).slice(0, 40) })}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {doc.skills.filter((s) => s.trim()).map((s, i) => (
          <Badge key={`${s}-${i}`} tone="teal">
            {s.trim()}
          </Badge>
        ))}
      </div>
    </>
  );
}

function ProjectsTab({ doc, set }: TabProps) {
  return (
    <>
      {doc.projects.map((p, i) => (
        <Item key={i} title={p.name || `Project ${i + 1}`} onRemove={() => set({ projects: drop(doc.projects, i) })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text id={`pr-n-${i}`} label="Project name" value={p.name} max={120} onChange={(v) => set({ projects: swap(doc.projects, i, { name: v }) })} />
            <Text id={`pr-t-${i}`} label="Tech used" value={p.tech} max={160} placeholder="Next.js, PostgreSQL" onChange={(v) => set({ projects: swap(doc.projects, i, { tech: v }) })} />
            <Text id={`pr-l-${i}`} label="Link" value={p.link} max={200} placeholder="github.com/you/project" onChange={(v) => set({ projects: swap(doc.projects, i, { link: v }) })} />
          </div>
          <Bulleted id={`pr-b-${i}`} label="What you did" value={p.bullets} onChange={(v) => set({ projects: swap(doc.projects, i, { bullets: v }) })} />
        </Item>
      ))}
      {doc.projects.length < 8 ? (
        <Button variant="secondary" size="sm" onClick={() => set({ projects: [...doc.projects, { name: "", tech: "", link: "", bullets: [] }] })}>
          <Plus className="size-4" /> Add project
        </Button>
      ) : null}
    </>
  );
}

function ExperienceTab({ doc, set }: TabProps) {
  return (
    <>
      <p className="text-xs text-ink-3">Internships, clubs, volunteering, leadership. Items you add to your Experience Passport come in through &ldquo;Fill from my profile&rdquo;.</p>
      {doc.experience.map((x, i) => (
        <Item key={i} title={x.title || x.org || `Experience ${i + 1}`} onRemove={() => set({ experience: drop(doc.experience, i) })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text id={`ex-t-${i}`} label="Role" value={x.title} max={120} onChange={(v) => set({ experience: swap(doc.experience, i, { title: v }) })} />
            <Text id={`ex-o-${i}`} label="Organisation" value={x.org} max={140} onChange={(v) => set({ experience: swap(doc.experience, i, { org: v }) })} />
            <Text id={`ex-p-${i}`} label="Period" value={x.period} max={40} placeholder="Jun 2025 – Aug 2025" onChange={(v) => set({ experience: swap(doc.experience, i, { period: v }) })} />
          </div>
          <Bulleted id={`ex-b-${i}`} label="What you did" value={x.bullets} onChange={(v) => set({ experience: swap(doc.experience, i, { bullets: v }) })} />
        </Item>
      ))}
      {doc.experience.length < 8 ? (
        <Button variant="secondary" size="sm" onClick={() => set({ experience: [...doc.experience, { title: "", org: "", period: "", bullets: [] }] })}>
          <Plus className="size-4" /> Add experience
        </Button>
      ) : null}
    </>
  );
}

function MoreTab({ doc, set }: TabProps) {
  return (
    <>
      <Bulleted id="cv-certs" label="Certifications" value={doc.certifications} max={12} hint="One per line, with the issuer: AWS Cloud Practitioner, 2025." onChange={(v) => set({ certifications: v })} />
      <Bulleted id="cv-ach" label="Achievements" value={doc.achievements} max={12} hint="Hackathons, ranks, awards, publications." onChange={(v) => set({ achievements: v })} />
    </>
  );
}

/* ───────────────────────────── ATS result ───────────────────────────── */
function AnalysisView({ a, role }: { a: ResumeAnalysis; role: string }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-3">ATS readiness for {role}</p>
        <p className="font-serif text-4xl font-semibold text-ink">{a.atsScore}</p>
        <Progress value={a.atsScore} tone={toneForScore(a.atsScore)} className="mt-2" label="ATS score" />
        <p className="mt-2 text-xs text-ink-3">An indicator of parse-ability and keyword coverage, not a hiring prediction.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {a.keywordsFound.map((k) => (
          <Badge key={k} tone="teal">
            {k}
          </Badge>
        ))}
        {a.keywordsMissing.map((k) => (
          <Badge key={k} tone="neutral">
            + {k}
          </Badge>
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {a.sections.map((s) => (
          <li key={s.name} className="flex gap-2.5 rounded-lg border border-line p-3">
            {s.status === "good" ? <CheckCircle2 className="size-4 shrink-0 text-teal" /> : s.status === "improve" ? <CircleAlert className="size-4 shrink-0 text-amber" /> : <CircleX className="size-4 shrink-0 text-rose" />}
            <div>
              <p className="text-sm font-medium text-ink">{s.name}</p>
              <p className="text-xs text-ink-2">{s.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
        {a.suggestions.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <AiLabel />
    </div>
  );
}
