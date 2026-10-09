"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardHeader, EmptyState, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { PolicyAnswer, PolicyOverview, POLICY_HISTORY_MAX, type PolicyTurn } from "@/lib/api/policy-schemas";
import type { Role } from "@/lib/auth/roles";

const KEY = ["policy", "overview"] as const;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const time = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const problem = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

/** Principal, HOD and faculty: ask questions of the college's approved documents and see exactly which passages answered. */
export function PolicyAssistantModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/policy", PolicyOverview), refetchOnWindowFocus: true });
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) => apiFetch("/api/v1/policy/ask", PolicyAnswer, { method: "POST", body: { question }, timeoutMs: 90_000 }),
    onSuccess: (r) =>
      qc.setQueryData<PolicyOverview>(KEY, (cur) => (cur ? { ...cur, history: [r.turn, ...cur.history.filter((t) => t.id !== r.turn.id)].slice(0, POLICY_HISTORY_MAX) } : cur)),
    onSettled: () => setAsked(null),
  });
  const clear = useMutation({
    mutationFn: () => apiFetch("/api/v1/policy/history", z.object({ ok: z.literal(true) }), { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<PolicyOverview>(KEY, (cur) => (cur ? { ...cur, history: [] } : cur));
      setConfirmClear(false);
    },
  });

  const count = q.data?.history.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [count, asked]);

  if (q.isPending) return <Skeleton className="h-[560px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const thread = [...d.history].reverse(); // oldest first
  const ready = d.stats.approved > 0;

  const run = (question: string) => {
    const t = question.trim();
    if (t.length < 3 || ask.isPending || !ready) return;
    setText("");
    setAsked(t);
    ask.mutate(t);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="flex min-h-[560px] flex-col">
        <CardHeader
          title="Ask about your college's policies"
          subtitle="Answers come only from approved documents, and each one shows the passages it was taken from."
          action={
            count > 0 ? (
              confirmClear ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink-3">Clear {count} saved question{count === 1 ? "" : "s"}?</span>
                  <Button size="sm" variant="danger" disabled={clear.isPending} onClick={() => clear.mutate()}>
                    {clear.isPending ? <Spinner /> : <Fi name="trash" />} Clear
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                  <Fi name="trash" /> Clear conversation
                </Button>
              )
            ) : null
          }
        />

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4" style={{ maxHeight: "62vh" }} aria-live="polite">
          {!ready ? (
            <EmptyState
              title="No approved documents yet"
              body={d.stats.pending > 0 ? `${d.stats.pending} document${d.stats.pending === 1 ? " is" : "s are"} waiting for approval. Once approved, you can ask questions about them here.` : "The assistant only answers from documents your college has approved, so there is nothing to search yet."}
              action={
                d.canManage ? (
                  <Link href={`/${role}/knowledge-base`} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
                    <Fi name="document" /> Open Knowledge Base
                  </Link>
                ) : (
                  <p className="text-sm text-ink-3">Ask your Principal to add and approve the policy documents.</p>
                )
              }
            />
          ) : thread.length === 0 && !asked ? (
            <div className="py-6 text-sm text-ink-2">
              <p className="mb-3 flex items-center gap-2 font-medium text-ink">
                <Fi name="sparkles" className="text-amber" /> Try one of these, taken from your own documents
              </p>
              <div className="flex flex-wrap gap-2">
                {d.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => run(s)} className="rounded-xl bg-surface-2 px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-brand-soft hover:text-brand">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {thread.map((t) => (
            <Exchange key={t.id} turn={t} />
          ))}

          {asked ? (
            <div className="space-y-3">
              <Bubble who="you">{asked}</Bubble>
              <p className="flex items-center gap-2 text-sm text-ink-3">
                <Spinner /> Searching {d.stats.passages.toLocaleString("en-IN")} passages in {d.stats.approved} approved document{d.stats.approved === 1 ? "" : "s"}…
              </p>
            </div>
          ) : null}
          {ask.isError && !asked ? (
            <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">
              {problem(ask.error)}
            </p>
          ) : null}
          <div ref={bottom} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
          className="flex gap-2 border-t border-line p-4"
        >
          <label htmlFor="policy-q" className="sr-only">
            Your question
          </label>
          <input id="policy-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} disabled={!ready} placeholder={ready ? "e.g. What is the minimum attendance for exam eligibility?" : "Approve a document to start asking"} className={inputClass} />
          <Button type="submit" disabled={!ready || ask.isPending || text.trim().length < 3}>
            {ask.isPending ? <Spinner /> : <Fi name="paper-plane" />} Ask
          </Button>
        </form>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="What I answer from" subtitle="Approved documents of your college only" />
          <div className="grid grid-cols-3 gap-2 px-5 pb-4 text-center">
            <Figure label="Documents" value={d.stats.approved} />
            <Figure label="Passages" value={d.stats.passages} />
            <Figure label="Categories" value={d.stats.categories} />
          </div>
          {d.sources.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {d.sources.map((s) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    <Badge tone="neutral">{s.type}</Badge>
                    <span>{s.owner}</span>
                    <span>· {s.scope}</span>
                    <span>· {s.passages} passage{s.passages === 1 ? "" : "s"}</span>
                    <span>· updated {day(s.updatedAt)}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-line px-5 py-4 text-sm text-ink-3">Nothing approved yet.</p>
          )}
          <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
            {d.stats.pending > 0 ? <p className="mb-1 text-amber">{d.stats.pending} more waiting for approval, not used for answers.</p> : null}
            {d.canManage ? (
              <Link href={`/${role}/knowledge-base`} className="font-medium text-brand hover:underline">
                Add or approve documents in the Knowledge Base
              </Link>
            ) : (
              <p>Missing something? Ask your Principal to add it to the Knowledge Base.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 text-sm text-ink-2">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink">
            <Fi name="scroll" className="text-brand" /> How answers work
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Your question is matched to passages of approved documents{d.ai.enabled ? " by meaning and by keywords" : " by keywords"}.</li>
            <li>{d.ai.enabled ? "A short answer is written from only those passages, with numbered references." : "The best matching sentences are quoted, with their sources."}</li>
            <li>If the documents do not cover it, you are told so instead of getting a guess.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-3">Your last {POLICY_HISTORY_MAX} questions are saved for you only.</p>
        </Card>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2/70 py-2">
      <p className="text-lg font-semibold text-ink">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function Bubble({ who, children }: { who: "you"; children: React.ReactNode }) {
  return (
    <div className={who === "you" ? "flex justify-end" : ""}>
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">{children}</p>
    </div>
  );
}

/** One question and its answer, with the passages behind it. */
function Exchange({ turn: t }: { turn: PolicyTurn }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cited = t.citations.filter((c) => c.cited);
  const shown = open ? t.citations : [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${t.answer}${cited.length ? `\n\nSources: ${cited.map((c) => `[${c.n}] ${c.docTitle} · ${c.section}${c.page ? ` · p.${c.page}` : ""}`).join("; ")}` : ""}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <div className="space-y-3">
      <Bubble who="you">{t.question}</Bubble>
      <div className="rounded-2xl rounded-bl-md border border-line bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={t.grounded ? "teal" : "amber"}>{t.grounded ? "From approved documents" : "Not found in approved documents"}</Badge>
          <Badge tone="neutral">{t.mode === "ai" ? "Written by AI from the passages" : t.mode === "extract" ? "Quoted from the passages" : "No answer"}</Badge>
          <span className="text-xs text-ink-3">{time(t.at)}</span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
          <Cited text={t.answer} onRef={() => setOpen(true)} />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {t.citations.length ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <Fi name="angle-down" className={open ? "rotate-180" : ""} /> {t.grounded ? `Sources (${cited.length || t.citations.length})` : `Closest passages (${t.citations.length})`}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => void copy()}>
            <Fi name="copy" /> {copied ? "Copied" : "Copy"}
          </Button>
          <span className="text-ink-3">Searched {t.searched.passages} passages in {t.searched.documents} documents</span>
        </div>
        {shown.length ? (
          <ul className="mt-3 space-y-2">
            {shown.map((c) => (
              <li key={c.n} className={`rounded-xl border p-3 ${c.cited ? "border-brand/40 bg-brand-soft/30" : "border-line"}`}>
                <p className="text-xs font-medium text-brand">
                  [{c.n}] {c.docTitle} · {c.section}
                  {c.page ? ` · p.${c.page}` : ""}
                  {c.cited ? " · used in the answer" : ""}
                </p>
                <p className="mt-1.5 text-sm text-ink-2">{c.snippet}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Shows [1] style references as small badges that open the sources. */
function Cited({ text, onRef }: { text: string; onRef: () => void }) {
  const parts = text.split(/(\[\d{1,2}\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[\d{1,2}\]$/.test(p) ? (
          <button key={i} type="button" onClick={onRef} className="mx-0.5 rounded bg-brand-soft px-1 align-baseline text-xs font-medium text-brand hover:underline" aria-label={`Show source ${p}`}>
            {p}
          </button>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
