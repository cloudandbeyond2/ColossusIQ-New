"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, FlaskConical, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChatPanel } from "@/components/ai/chat-panel";
import { LoadError } from "@/components/ui/load-error";
import { AiLabel, Notice } from "@/components/ui/notices";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Progress, Skeleton, Spinner, inputClass } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import {
  RESEARCH_LEVELS,
  RESEARCH_STAGES,
  ResearchOverview,
  type ResearchProject,
  type ResearchTool,
} from "@/lib/api/research-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["research"] as const;
type Tab = ResearchTool | "chat";

export function ResearchModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/research", ResearchOverview) });
  if (q.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (q.isError || !q.data) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <Research data={q.data} />;
}

function Research({ data }: { data: ResearchOverview }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("questions");
  const [problem, setProblem] = useState<string | null>(null);
  const project = data.projects.find((p) => p.id === data.activeId) ?? data.projects[0] ?? null;

  const apply = (o: ResearchOverview) => {
    setProblem(null);
    qc.setQueryData(KEY, o);
  };
  const fail = (e: unknown) => setProblem(problemOf(e, "Something went wrong. Please try again.").message ?? "Please check the details and try again.");
  const select = useMutation({ mutationFn: (id: string) => apiFetch("/api/v1/research/active", ResearchOverview, { method: "PUT", body: { id } }), onSuccess: apply, onError: fail });

  return (
    <div className="space-y-6">
      {problem ? (
        <p className="text-sm text-rose" role="alert">
          {problem}
        </p>
      ) : null}
      {data.projects.length === 0 ? (
        <Welcome data={data} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit">
            <CardHeader
              title="Your projects"
              subtitle={`${data.projects.length} saved`}
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> New
                </Button>
              }
            />
            <CardBody className="space-y-2 p-3">
              {data.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (p.id === project?.id ? undefined : select.mutate(p.id))}
                  aria-current={p.id === project?.id}
                  className={cn("w-full rounded-xl border p-3 text-left transition-colors", p.id === project?.id ? "border-brand bg-brand-soft/40" : "border-line hover:bg-surface-2")}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-ink">{p.title}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {p.field} · {p.level}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="sky">{p.stage}</Badge>
                    {[p.questions, p.literature, p.outline, p.plan].filter(Boolean).length > 0 ? <span className="text-[11px] text-ink-3">{[p.questions, p.literature, p.outline, p.plan].filter(Boolean).length} of 4 tools used</span> : null}
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>

          {project ? <Workspace key={project.id} project={project} data={data} tab={tab} setTab={setTab} onApply={apply} onFail={fail} /> : null}
        </div>
      )}
      {creating ? <NewProject data={data} onClose={() => setCreating(false)} onDone={(o) => { apply(o); setTab("questions"); setCreating(false); }} /> : null}
    </div>
  );
}

/* ───────────────────────────── first project ───────────────────────────── */

function Welcome({ data }: { data: ResearchOverview }) {
  const qc = useQueryClient();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardBody className="space-y-4 py-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FlaskConical className="size-6" aria-hidden />
          </span>
          <h2 className="font-serif text-2xl font-semibold text-ink">Start a research project</h2>
          <p className="mx-auto max-w-lg text-sm text-ink-2">
            Save a project and the assistant works with it: sharper research questions, a search plan for the literature, a paper outline and a step-by-step work plan. Everything is saved for you, and you can keep several projects.
          </p>
          <p className="mx-auto max-w-lg text-xs text-ink-3">The assistant cannot browse papers, so it never cites them. It writes search strings and you run them in Google Scholar, IEEE Xplore or Scopus.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="New project" subtitle="You can change all of this later" />
        <CardBody>
          <ProjectForm data={data} onDone={(o) => qc.setQueryData(KEY, o)} />
        </CardBody>
      </Card>
    </div>
  );
}

function NewProject({ data, onClose, onDone }: { data: ResearchOverview; onClose: () => void; onDone: (o: ResearchOverview) => void }) {
  return (
    <Modal title="New research project" onClose={onClose}>
      <ProjectForm data={data} onDone={onDone} onCancel={onClose} />
    </Modal>
  );
}

function ProjectForm({ data, onDone, onCancel }: { data: ResearchOverview; onDone: (o: ResearchOverview) => void; onCancel?: () => void }) {
  const [f, setF] = useState({ title: "", field: "", level: data.defaults.level as string, stage: "Idea" as string, goal: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: Record<string, string>) => apiFetch("/api/v1/research/projects", ResearchOverview, { method: "POST", body }),
    onSuccess: onDone,
    onError: (e) => {
      const p = problemOf(e, "Could not save the project.");
      setErrors(p.fields);
      setGeneral(p.message);
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.title.trim().length < 3) errs.title = "Give the project a title (at least 3 characters)";
    if (f.field.trim().length < 2) errs.field = "Name the field of study";
    setErrors(errs);
    setGeneral(null);
    if (Object.keys(errs).length) return;
    create.mutate({ title: f.title.trim(), field: f.field.trim(), level: f.level, stage: f.stage, ...(f.goal.trim() ? { goal: f.goal.trim() } : {}) });
  };
  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <Field label="Project title or topic" htmlFor="rp-title" error={errors.title}>
        <input id="rp-title" className={inputClass} maxLength={120} placeholder="e.g. Low-cost IoT soil moisture sensing for farms" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <Field label="Field" htmlFor="rp-field" error={errors.field}>
        <input id="rp-field" list="rp-fields" className={inputClass} maxLength={60} placeholder="e.g. Computer Science" value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })} />
        <datalist id="rp-fields">
          {data.fieldSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Level" htmlFor="rp-level" error={errors.level}>
          <select id="rp-level" className={inputClass} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            {RESEARCH_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Where are you now?" htmlFor="rp-stage" error={errors.stage}>
          <select id="rp-stage" className={inputClass} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
            {RESEARCH_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Goal (optional)" htmlFor="rp-goal" hint="For example: a conference paper, a final-year project, a thesis chapter." error={errors.goal}>
        <textarea id="rp-goal" rows={2} className={inputClass} maxLength={500} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
      </Field>
      {general ? (
        <p className="text-sm text-rose" role="alert">
          {general}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? <Spinner /> : <Plus className="size-4" />} Create project
        </Button>
      </div>
    </form>
  );
}

/* ───────────────────────────── one project ───────────────────────────── */

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "questions", label: "Research questions" },
  { id: "literature", label: "Literature search" },
  { id: "outline", label: "Paper outline" },
  { id: "plan", label: "Work plan" },
  { id: "chat", label: "Ask the assistant" },
];

function Workspace({ project, data, tab, setTab, onApply, onFail }: { project: ResearchProject; data: ResearchOverview; tab: Tab; setTab: (t: Tab) => void; onApply: (o: ResearchOverview) => void; onFail: (e: unknown) => void }) {
  const patch = useMutation({
    mutationFn: (body: Record<string, string>) => apiFetch(`/api/v1/research/projects/${project.id}`, ResearchOverview, { method: "PATCH", body }),
    onSuccess: onApply,
    onError: onFail,
  });
  const remove = useMutation({ mutationFn: () => apiFetch(`/api/v1/research/projects/${project.id}`, ResearchOverview, { method: "DELETE" }), onSuccess: onApply, onError: onFail });
  const [confirming, setConfirming] = useState(false);
  const [edit, setEdit] = useState(false);

  return (
    <div className="min-w-0 space-y-6">
      <Card>
        <CardHeader
          title={project.title}
          subtitle={`${project.field} · ${project.level}`}
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" aria-label={`Delete ${project.title}`} onClick={() => setConfirming(true)}>
                <Trash2 className="size-4 text-rose" />
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-3">
          {project.goal ? <p className="text-sm text-ink-2">{project.goal}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="rp-stage-now" className="text-sm font-medium text-ink-2">
              Stage
            </label>
            <select id="rp-stage-now" className="rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" value={project.stage} disabled={patch.isPending} onChange={(e) => patch.mutate({ stage: e.target.value })}>
              {RESEARCH_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-ink-3">Updating it makes the work plan skip what you have already done.</span>
          </div>
        </CardBody>
      </Card>

      <div role="tablist" aria-label="Research tools" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", tab === t.id ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <Card className="flex h-[620px] min-h-[480px] flex-col overflow-hidden">
          <ChatPanel
            key={project.id}
            agent="research"
            agentName="Research Assistant"
            intro={`I'm working with you on **${project.title}** (${project.field}, ${project.level}, ${project.stage.toLowerCase()} stage). I can sharpen research questions, plan your literature search, compare approaches and help structure your writing. I can't look up or cite papers, so check every source yourself.`}
            suggestions={[`Suggest research questions for "${project.title}"`, "How should I search the literature for this?", "Outline a conference paper for this project", `What should I do next at the ${project.stage.toLowerCase()} stage?`]}
            context={[`Project: ${project.title}`, `Field: ${project.field}`, `Level: ${project.level}`, `Stage: ${project.stage}`]}
            className="flex-1"
          />
        </Card>
      ) : (
        <ToolPanel key={`${project.id}-${tab}`} project={project} kind={tab} aiLive={data.aiLive} onApply={onApply} onFail={onFail} />
      )}

      <Notes project={project} onSave={(notes) => patch.mutate({ notes })} saving={patch.isPending} />

      {edit ? <EditDialog project={project} data={data} onClose={() => setEdit(false)} onApply={(o) => { onApply(o); setEdit(false); }} /> : null}
      {confirming ? (
        <Modal title="Delete this project?" onClose={() => setConfirming(false)}>
          <p className="text-sm text-ink-2">“{project.title}” and everything saved with it (questions, search plan, outline, work plan and notes) will be removed. This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Notes({ project, onSave, saving }: { project: ResearchProject; onSave: (n: string) => void; saving: boolean }) {
  const [text, setText] = useState(project.notes);
  const dirty = text.trim() !== project.notes;
  return (
    <Card>
      <CardHeader title="Notes" subtitle="Your own scratch space for this project" />
      <CardBody className="space-y-3">
        <label htmlFor="rp-notes" className="sr-only">
          Project notes
        </label>
        <textarea id="rp-notes" rows={4} maxLength={4000} className={inputClass} placeholder="Ideas, supervisor feedback, reading list…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-3">{text.length} / 4000</span>
          <Button size="sm" variant="secondary" disabled={!dirty || saving} onClick={() => onSave(text.trim())}>
            {saving ? <Spinner /> : null} Save notes
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function EditDialog({ project, data, onClose, onApply }: { project: ResearchProject; data: ResearchOverview; onClose: () => void; onApply: (o: ResearchOverview) => void }) {
  const [f, setF] = useState({ title: project.title, field: project.field, level: project.level as string, goal: project.goal });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, string>) => apiFetch(`/api/v1/research/projects/${project.id}`, ResearchOverview, { method: "PATCH", body }),
    onSuccess: onApply,
    onError: (e) => {
      const p = problemOf(e, "Could not save.");
      setErrors(p.fields);
      setGeneral(p.message);
    },
  });
  return (
    <Modal title="Edit project" onClose={onClose}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const errs: Record<string, string> = {};
          if (f.title.trim().length < 3) errs.title = "Give the project a title (at least 3 characters)";
          if (f.field.trim().length < 2) errs.field = "Name the field of study";
          setErrors(errs);
          if (Object.keys(errs).length) return;
          save.mutate({ title: f.title.trim(), field: f.field.trim(), level: f.level, goal: f.goal.trim() });
        }}
      >
        <Field label="Title" htmlFor="re-title" error={errors.title}>
          <input id="re-title" className={inputClass} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Field" htmlFor="re-field" error={errors.field}>
            <input id="re-field" list="re-fields" className={inputClass} maxLength={60} value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })} />
            <datalist id="re-fields">
              {data.fieldSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Level" htmlFor="re-level" error={errors.level}>
            <select id="re-level" className={inputClass} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
              {RESEARCH_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Goal" htmlFor="re-goal" error={errors.goal}>
          <textarea id="re-goal" rows={3} className={inputClass} maxLength={500} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        </Field>
        {general ? (
          <p className="text-sm text-rose" role="alert">
            {general}
          </p>
        ) : null}
        <p className="text-xs text-ink-3">Changing the title, field or level does not rewrite what is already saved. Generate a tool again to update it.</p>
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── the four tools ───────────────────────────── */

const COPY: Record<ResearchTool, { title: string; blurb: string; focusLabel?: string; focusHint?: string }> = {
  questions: { title: "Research questions", blurb: "Questions that could be answered by a feasible study, each with why it matters and how to test it.", focusLabel: "Angle to focus on (optional)", focusHint: "e.g. low-cost hardware, rural deployment, comparison with deep learning" },
  literature: { title: "Literature search plan", blurb: "Search strings to run in the real databases, where to look, and how to decide what to keep. It does not list papers: it cannot read them.", focusLabel: "Narrow the search (optional)", focusHint: "e.g. LoRaWAN, transformer models, post-2020" },
  outline: { title: "Paper outline", blurb: "A section-by-section outline for a paper on this project, with what to write in each part." },
  plan: { title: "Work plan", blurb: "The steps from where you are now to submission, with weeks and tasks. Tick steps off as you finish them." },
};

function ToolPanel({ project, kind, aiLive, onApply, onFail }: { project: ResearchProject; kind: ResearchTool; aiLive: boolean; onApply: (o: ResearchOverview) => void; onFail: (e: unknown) => void }) {
  const [focus, setFocus] = useState("");
  const copy = COPY[kind];
  const result = project[kind];
  const run = useMutation({
    mutationFn: () => apiFetch(`/api/v1/research/projects/${project.id}/tools/${kind}`, ResearchOverview, { method: "POST", body: { focus: focus.trim() } }),
    onSuccess: onApply,
    onError: onFail,
  });

  return (
    <Card>
      <CardHeader
        title={copy.title}
        subtitle={copy.blurb}
        action={
          <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Spinner /> : <Sparkles className="size-4" />} {result ? "Write again" : "Write it"}
          </Button>
        }
      />
      <CardBody className="space-y-5">
        {copy.focusLabel ? (
          <Field label={copy.focusLabel} htmlFor={`rt-focus-${kind}`} hint={copy.focusHint}>
            <input id={`rt-focus-${kind}`} className={inputClass} maxLength={300} value={focus} onChange={(e) => setFocus(e.target.value)} />
          </Field>
        ) : null}
        {run.isPending ? (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Spinner /> Working on “{project.title}”…
          </p>
        ) : null}
        {!result && !run.isPending ? <EmptyState title="Nothing written yet" body={aiLive ? "Press “Write it” and the assistant drafts this for your project." : "Press “Write it” to fill in a template from your project's details. AI drafting is not switched on."} /> : null}
        {result ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              {result.source === "ai" ? <AiLabel /> : <Badge tone="neutral">Template</Badge>}
              <span>Written {new Date(result.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              {result.source === "built-in" ? <span>· Built from your project&apos;s details. With AI on, it is tailored further.</span> : null}
            </div>
            {kind === "questions" && project.questions ? <Questions r={project.questions} /> : null}
            {kind === "literature" && project.literature ? <Literature r={project.literature} /> : null}
            {kind === "outline" && project.outline ? <Outline r={project.outline} /> : null}
            {kind === "plan" && project.plan ? <Plan project={project} onApply={onApply} onFail={onFail} /> : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? "Copied" : label}
    </Button>
  );
}

function Questions({ r }: { r: NonNullable<ResearchProject["questions"]> }) {
  const text = r.items.map((i, k) => `${k + 1}. ${i.question}\n   Why: ${i.why}\n   Test: ${i.test}`).join("\n\n");
  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {r.items.map((i, k) => (
          <li key={`${k}-${i.question}`} className="rounded-xl border border-line p-4">
            <p className="font-medium text-ink">
              <span className="mr-2 text-brand">{k + 1}.</span>
              {i.question}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              <span className="font-semibold text-ink">Why it matters: </span>
              {i.why}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-semibold text-ink">How to test it: </span>
              {i.test}
            </p>
          </li>
        ))}
      </ol>
      <CopyButton text={text} label="Copy all questions" />
    </div>
  );
}

const ENGINES: Array<[string, (q: string) => string]> = [
  ["Google Scholar", (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`],
  ["Semantic Scholar", (q) => `https://www.semanticscholar.org/search?q=${encodeURIComponent(q)}`],
  ["IEEE Xplore", (q) => `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(q)}`],
  ["arXiv", (q) => `https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(q)}`],
];

function Literature({ r }: { r: NonNullable<ResearchProject["literature"]> }) {
  return (
    <div className="space-y-6">
      <Notice tone="sky">This is a search plan, not a reading list. The assistant cannot see papers, so it has not cited any. Open the searches below, read the real abstracts and keep only what you can trace to a publisher.</Notice>
      <ul className="space-y-3">
        {r.queries.map((x, k) => (
          <li key={`${k}-${x.query}`} className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-ink">{x.label}</p>
            <code className="mt-1 block break-words rounded-lg bg-surface-2/70 px-3 py-2 text-sm text-ink-2">{x.query}</code>
            <div className="mt-2 flex flex-wrap gap-2">
              {ENGINES.map(([name, url]) => (
                <a key={name} href={url(x.query)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-brand hover:bg-surface-2">
                  {name} <ExternalLink className="size-3" aria-hidden />
                </a>
              ))}
              <CopyButton text={x.query} label="Copy search" />
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-3">
        <List title="Where to look" items={r.venues} />
        <List title="What to keep" items={r.criteria} />
        <List title="Reading tips" items={r.tips} />
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
      <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-2">
        {items.map((x, i) => (
          <li key={`${i}-${x}`}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Outline({ r }: { r: NonNullable<ResearchProject["outline"]> }) {
  const text = r.sections.map((s) => `${s.heading}\n${s.points.map((p) => `  - ${p}`).join("\n")}`).join("\n\n");
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {r.sections.map((s, k) => (
          <li key={`${k}-${s.heading}`} className="rounded-xl border border-line p-4">
            <p className="font-semibold text-ink">{s.heading}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {s.points.map((p, i) => (
                <li key={`${i}-${p}`}>{p}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <CopyButton text={text} label="Copy outline" />
    </div>
  );
}

function Plan({ project, onApply, onFail }: { project: ResearchProject; onApply: (o: ResearchOverview) => void; onFail: (e: unknown) => void }) {
  const plan = project.plan;
  const toggle = useMutation({
    mutationFn: (v: { stepId: string; done: boolean }) => apiFetch(`/api/v1/research/projects/${project.id}/plan/steps`, ResearchOverview, { method: "PATCH", body: v }),
    onSuccess: onApply,
    onError: onFail,
  });
  if (!plan) return null;
  const total = plan.steps.reduce((n, s) => n + s.weeks, 0);
  const doneWeeks = plan.steps.filter((s) => s.done).reduce((n, s) => n + s.weeks, 0);
  const pct = total ? Math.round((doneWeeks / total) * 100) : 0;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex justify-between text-sm text-ink-2">
          <span>
            {plan.steps.filter((s) => s.done).length} of {plan.steps.length} steps done
          </span>
          <span>
            {doneWeeks} of {total} weeks
          </span>
        </div>
        <Progress value={pct} tone="teal" label="Work plan progress" />
      </div>
      <ol className="space-y-3">
        {plan.steps.map((s) => (
          <li key={s.id} className={cn("rounded-xl border border-line p-4", s.done && "bg-surface-2/50")}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--color-brand,#4f46e5)]" checked={s.done} disabled={toggle.isPending} onChange={() => toggle.mutate({ stepId: s.id, done: !s.done })} />
              <span className="min-w-0 flex-1">
                <span className={cn("flex flex-wrap items-center gap-2 font-semibold text-ink", s.done && "text-ink-3 line-through")}>
                  {s.title} <Badge tone="neutral">{s.weeks} wk</Badge>
                </span>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm font-normal text-ink-2">
                  {s.tasks.map((t, i) => (
                    <li key={`${i}-${t}`}>{t}</li>
                  ))}
                </ul>
              </span>
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}
