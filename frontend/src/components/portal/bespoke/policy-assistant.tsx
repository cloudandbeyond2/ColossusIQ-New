"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, EmptyState, Skeleton, Spinner } from "@/components/ui/primitives";
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
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/policy", PolicyOverview), staleTime: 30_000, refetchOnWindowFocus: false });
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [docFilter, setDocFilter] = useState("all");
  const [searchDoc, setSearchDoc] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [mobileTab, setMobileTab] = useState<"chat" | "documents">("chat");
  const bottom = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const ask = useMutation({
    mutationFn: (question: string) => apiFetch("/api/v1/policy/ask", PolicyAnswer, { method: "POST", body: { question }, timeoutMs: 90_000 }),
    onSuccess: (r) => {
      qc.setQueryData<PolicyOverview>(KEY, (cur) => (cur ? { ...cur, history: [r.turn, ...cur.history.filter((t) => t.id !== r.turn.id)].slice(0, POLICY_HISTORY_MAX) } : cur));
    },
    onSettled: () => {
      if (isMounted.current) setAsked(null);
    },
  });

  const clear = useMutation({
    mutationFn: () => apiFetch("/api/v1/policy/history", z.object({ ok: z.literal(true) }), { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<PolicyOverview>(KEY, (cur) => (cur ? { ...cur, history: [] } : cur));
      if (isMounted.current) setConfirmClear(false);
    },
  });

  const count = q.data?.history.length ?? 0;
  useEffect(() => {
    if (!isMounted.current) return;
    if (bottom.current && (count > 0 || asked)) {
      bottom.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [count, asked]);

  if (q.isPending) return <Skeleton className="h-[440px] sm:h-[560px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const thread = [...d.history].reverse(); // oldest first
  const ready = d.stats.approved > 0;
  const isMed = Boolean(d.isMedical);

  const run = (question: string) => {
    const t = question.trim();
    if (t.length < 3 || ask.isPending || !ready) return;
    setText("");
    setAsked(t);
    setMobileTab("chat"); // Auto switch to chat tab on mobile
    ask.mutate(t);
  };

  // Filter sources on the right sidebar
  const filteredSources = d.sources.filter((s) => {
    const matchType = docFilter === "all" || s.type.toLowerCase() === docFilter.toLowerCase();
    const matchSearch = !searchDoc || s.title.toLowerCase().includes(searchDoc.toLowerCase()) || s.owner.toLowerCase().includes(searchDoc.toLowerCase());
    return matchType && matchSearch;
  });

  // Dynamic quick topic questions
  const topicCategories = isMed
    ? [
        { id: "all", label: "All Topics" },
        { id: "attendance", label: "Attendance & Postings" },
        { id: "leave", label: "Faculty Leave & Duty" },
        { id: "anatomy", label: "Anatomy & Labs" },
        { id: "research", label: "Research & ICMR" },
        { id: "safety", label: "Infection Control & Safety" },
      ]
    : [
        { id: "all", label: "All Topics" },
        { id: "attendance", label: "Attendance & Exams" },
        { id: "leave", label: "Faculty Leave & Workload" },
        { id: "assessment", label: "Internal Assessment" },
        { id: "research", label: "Research Seed Grants" },
        { id: "conduct", label: "Student Code of Conduct" },
      ];

  const topicQuestions: Record<string, string[]> = isMed
    ? {
        attendance: [
          "What is the minimum mandatory attendance for MBBS theory and clinical postings?",
          "What are the condonation rules for clinical attendance shortage?",
          "What happens if a student has less than 75% clinical attendance?",
        ],
        leave: [
          "How many days of Casual Leave (CL) can faculty take, and what is the night duty compensatory off rule?",
          "What are the On-Duty (OD) permissions for medical conferences and CME programs?",
          "What is the procedure for station leave permissions for faculty?",
        ],
        anatomy: [
          "What are the decorum and safety rules in the Anatomy Dissection Hall?",
          "What is the mandatory dress code and apron rule for dissection halls?",
          "What is the procedure to borrow dry bone sets from the osteology bone bank?",
        ],
        research: [
          "What seed grants are available for clinical research and ICMR-STS proposals?",
          "What are the requirements for Institutional Ethics Committee (IEC) clearance?",
          "What reimbursement is offered for publishing in PubMed and Scopus journals?",
        ],
        safety: [
          "What is the protocol for biomedical waste segregation and color coding?",
          "What is the emergency protocol for accidental needle-stick injury?",
          "What are the 24x7 emergency casualty triage contacts?",
        ],
      }
    : {
        attendance: [
          "What is the minimum attendance required for semester exam eligibility?",
          "What are the rules for condonation of attendance shortage?",
        ],
        leave: [
          "What are the rules for faculty Casual Leave and on-duty conference permissions?",
          "What is the direct teaching workload per week for faculty under AICTE norms?",
        ],
        assessment: [
          "How is the internal assessment mark calculated (40 marks distribution)?",
          "What are the criteria to request an internal assessment retest?",
        ],
        research: [
          "What research seed grants and publication incentives are offered to faculty?",
          "What funding is available for patent filings and student innovation?",
        ],
        conduct: [
          "What are the mandatory rules for campus identity cards and lab safety?",
          "What are the anti-ragging contact helplines and penalties?",
        ],
      };

  const activeQuestions = selectedTopic === "all" ? d.suggestions : topicQuestions[selectedTopic] || d.suggestions;

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 sm:space-y-4 overflow-hidden">
      {/* Context Header - Scales gracefully from 320px mobile up to 4K */}
      <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-line bg-surface p-3 sm:px-4 sm:py-3 text-xs sm:text-sm shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-brand-soft text-brand font-semibold text-xs shrink-0">
            <Fi name="building" />
          </span>
          <span className="font-semibold text-ink truncate max-w-[200px] sm:max-w-none">{d.collegeName || "Institutional Policies"}</span>
          {d.stream ? (
            <Badge tone="brand">
              {d.isMedical ? "🩺 Medical" : `🎓 ${d.stream.toUpperCase()}`}
            </Badge>
          ) : null}
          {d.department ? (
            <Badge tone="neutral">
              🏛️ {d.department}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-ink-3 shrink-0">
          <span className="flex items-center gap-1.5 font-medium text-teal">
            <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            {d.ai.enabled ? "AI Search" : "Knowledge Base"}
          </span>
          <span>·</span>
          <span>{d.stats.approved} Docs</span>
        </div>
      </div>

      {/* Mobile Tab Switcher - Seamless navigation on screens under 1024px */}
      <div className="w-full min-w-0 flex rounded-xl bg-surface-2 p-1 lg:hidden border border-line/60">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition truncate ${
            mobileTab === "chat" ? "bg-surface text-brand shadow-xs border border-line/40" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Fi name="sparkles" className="text-amber shrink-0" />
          <span className="truncate">Policy Assistant {count > 0 ? `(${count})` : ""}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("documents")}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition truncate ${
            mobileTab === "documents" ? "bg-surface text-brand shadow-xs border border-line/40" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Fi name="document" className="shrink-0" />
          <span className="truncate">Docs ({d.stats.approved})</span>
        </button>
      </div>

      {/* Main Grid Layout: Side-by-side on desktop (lg+), clean tabbed view on mobile/tablet */}
      <div className="w-full min-w-0 grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Conversation & Search Card */}
        <Card className={`w-full min-w-0 max-w-full flex min-h-[440px] sm:min-h-[520px] lg:min-h-[600px] flex-col overflow-hidden ${mobileTab === "documents" ? "hidden lg:flex" : "flex"}`}>
          {/* Responsive Header */}
          <div className="flex items-start justify-between gap-2.5 p-3 sm:p-5 border-b border-line/40 min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="font-sans text-sm sm:text-base font-semibold tracking-tight text-ink">Ask about your college's policies</h3>
              <p className="mt-0.5 text-xs sm:text-sm text-ink-3 line-clamp-1 sm:line-clamp-none">
                Answers come strictly from approved documents with verified citations.
              </p>
            </div>
            {count > 0 ? (
              confirmClear ? (
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
                  <span className="text-ink-3 hidden sm:inline">Clear {count}?</span>
                  <Button size="sm" variant="danger" disabled={clear.isPending} onClick={() => clear.mutate()} className="h-7 px-2 text-xs">
                    {clear.isPending ? <Spinner /> : <Fi name="trash" />} Clear
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)} className="h-7 px-2 text-xs">
                    Keep
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} className="h-7 px-2 sm:h-8 sm:px-3 text-xs shrink-0">
                  <Fi name="trash" /> <span className="hidden sm:inline">Clear conversation</span><span className="sm:hidden">Clear</span>
                </Button>
              )
            ) : null}
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 w-full min-w-0 space-y-3 sm:space-y-4 overflow-y-auto px-2.5 py-3 sm:px-5 sm:pb-4 max-h-[48vh] sm:max-h-[58vh] lg:max-h-[64vh] overflow-x-hidden" aria-live="polite">
            {!ready ? (
              <EmptyState
                title="No approved documents yet"
                body={
                  d.stats.pending > 0
                    ? `${d.stats.pending} document${d.stats.pending === 1 ? " is" : "s are"} waiting for approval. Once approved, you can ask questions about them here.`
                    : "The assistant only answers from documents your college has approved, so there is nothing to search yet."
                }
                action={
                  d.canManage ? (
                    <Link href={`/${role}/knowledge-base`} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
                      <Fi name="document" /> Open Knowledge Base
                    </Link>
                  ) : (
                    <p className="text-xs sm:text-sm text-ink-3">Ask your Principal or Dean to add and approve the policy documents.</p>
                  )
                }
              />
            ) : thread.length === 0 && !asked ? (
              <div className="space-y-3 sm:space-y-4 py-1 sm:py-3 w-full min-w-0">
                {/* Topic Selector Tabs */}
                <div className="w-full min-w-0">
                  <p className="mb-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Explore Policy Topics</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 sm:flex-wrap scrollbar-none w-full min-w-0">
                    {topicCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedTopic(cat.id)}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition whitespace-nowrap ${
                          selectedTopic === cat.id
                            ? "bg-brand text-white shadow-xs"
                            : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggestions Grid */}
                <div className="w-full min-w-0">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
                    <Fi name="sparkles" className="text-amber" /> Suggested Questions
                  </p>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 w-full min-w-0">
                    {activeQuestions.slice(0, 6).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => run(s)}
                        className="group flex items-start gap-2 rounded-xl border border-line bg-surface p-2.5 sm:p-3 text-left text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-brand-soft/20 hover:text-brand w-full min-w-0 overflow-hidden"
                      >
                        <span className="mt-0.5 text-brand opacity-60 group-hover:opacity-100 shrink-0">
                          <Fi name="paper-plane" />
                        </span>
                        <span className="flex-1 leading-snug break-words">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {thread.map((t) => (
              <Exchange key={t.id} turn={t} />
            ))}

            {asked ? (
              <div className="space-y-2.5 sm:space-y-3 w-full min-w-0">
                <Bubble who="you">{asked}</Bubble>
                <div className="rounded-xl sm:rounded-2xl border border-line bg-surface p-3 sm:p-4 w-full min-w-0">
                  <p className="flex items-center gap-2 text-xs sm:text-sm text-ink-2 font-medium">
                    <Spinner /> Searching {d.stats.passages.toLocaleString("en-IN")} passages across {d.stats.approved} approved document{d.stats.approved === 1 ? "" : "s"}…
                  </p>
                  <p className="mt-1 text-[11px] sm:text-xs text-ink-3">Extracting exact clauses, rules, and authoritative citations.</p>
                </div>
              </div>
            ) : null}
            {ask.isError && !asked ? (
              <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-xs sm:text-sm text-rose w-full min-w-0 break-words">
                {problem(ask.error)}
              </p>
            ) : null}
            <div ref={bottom} />
          </div>

          {/* Quick suggestions strip above input */}
          {thread.length > 0 && ready && !asked ? (
            <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto border-t border-line/60 bg-surface-2/40 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs scrollbar-none">
              <span className="shrink-0 text-ink-3 font-medium flex items-center gap-1 text-[11px] sm:text-xs">
                <Fi name="sparkles" className="text-amber" /> Try:
              </span>
              {d.suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => run(s)}
                  className="shrink-0 max-w-[200px] sm:max-w-[280px] truncate rounded-lg bg-surface px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs text-ink-2 hover:bg-brand-soft hover:text-brand border border-line transition"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {/* Responsive Question Input Form: flex-1 min-w-0 ensures input never forces button off-screen */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(text);
            }}
            className="w-full min-w-0 flex items-center gap-1.5 sm:gap-2 border-t border-line p-2.5 sm:p-4 bg-surface"
          >
            <label htmlFor="policy-q" className="sr-only">
              Your question
            </label>
            <input
              id="policy-q"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              disabled={!ready}
              placeholder={
                ready
                  ? isMed
                    ? "Ask about clinical attendance, leave, dissection rules..."
                    : "Ask a question about college policies..."
                  : "Approve a document to start asking"
              }
              className="flex-1 min-w-0 w-full rounded-xl border border-line bg-surface px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-brand/30 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={!ready || ask.isPending || text.trim().length < 3}
              className="shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
            >
              {ask.isPending ? <Spinner /> : <Fi name="paper-plane" />}
              <span>Ask</span>
            </Button>
          </form>
        </Card>

        {/* Sidebar: Documents & Info */}
        <div className={`w-full min-w-0 space-y-3 sm:space-y-4 ${mobileTab === "chat" ? "hidden lg:block" : "block"}`}>
          <Card className="w-full min-w-0 overflow-hidden">
            <div className="p-3 sm:p-5 pb-1 sm:pb-2">
              <h3 className="font-sans text-sm sm:text-base font-semibold tracking-tight text-ink">What I answer from</h3>
              <p className="mt-0.5 text-xs text-ink-3">Approved documents of your college only</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 px-2.5 py-2.5 sm:px-5 sm:pb-4 text-center min-w-0">
              <Figure label="Documents" value={d.stats.approved} />
              <Figure label="Passages" value={d.stats.passages} />
              <Figure label="Categories" value={d.stats.categories} />
            </div>

            {/* Document search & filter */}
            {d.sources.length > 0 ? (
              <div className="border-t border-line p-2.5 sm:p-3 space-y-2 min-w-0">
                <div className="relative w-full min-w-0">
                  <input
                    type="text"
                    value={searchDoc}
                    onChange={(e) => setSearchDoc(e.target.value)}
                    placeholder="Filter documents..."
                    className="w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand"
                  />
                  {searchDoc ? (
                    <button
                      type="button"
                      onClick={() => setSearchDoc("")}
                      className="absolute right-2.5 top-2 text-ink-3 hover:text-ink text-xs"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-none min-w-0">
                  {["all", "regulation", "policy", "handbook", "guideline", "circular"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDocFilter(t)}
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition whitespace-nowrap ${
                        docFilter === t ? "bg-brand text-white" : "bg-surface-2 text-ink-3 hover:text-ink"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredSources.length ? (
              <ul className="max-h-[260px] sm:max-h-[320px] overflow-y-auto divide-y divide-line border-t border-line w-full min-w-0">
                {filteredSources.map((s) => (
                  <li key={s.id} className="group p-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm hover:bg-surface-2/40 transition w-full min-w-0">
                    <p className="font-medium text-ink leading-snug break-words">{s.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-ink-3">
                      <Badge tone="neutral">{s.type}</Badge>
                      <span>{s.owner}</span>
                      <span>· {s.passages} passages</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => run(`Summarise the key rules in “${s.title}”`)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                    >
                      <Fi name="sparkles" className="text-amber" /> Ask about this document
                    </button>
                  </li>
                ))}
              </ul>
            ) : d.sources.length ? (
              <p className="border-t border-line px-4 py-3 text-xs text-ink-3 text-center">No documents matching “{searchDoc || docFilter}”.</p>
            ) : (
              <p className="border-t border-line px-4 py-3 text-xs sm:text-sm text-ink-3">Nothing approved yet.</p>
            )}
            <div className="border-t border-line p-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs text-ink-3">
              {d.stats.pending > 0 ? <p className="mb-1 text-amber">{d.stats.pending} more waiting for approval, not used for answers.</p> : null}
              {d.canManage ? (
                <Link href={`/${role}/knowledge-base`} className="font-medium text-brand hover:underline">
                  Add or approve documents in the Knowledge Base
                </Link>
              ) : (
                <p>Missing something? Ask your Principal or Dean to add it to the Knowledge Base.</p>
              )}
            </div>
          </Card>

          <Card className="p-3 sm:p-5 text-xs sm:text-sm text-ink-2 w-full min-w-0">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink text-xs sm:text-sm">
              <Fi name="scroll" className="text-brand" /> How answers work
            </h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-[11px] sm:text-xs text-ink-2 leading-relaxed">
              <li>Your question is matched to passages of approved documents{d.ai.enabled ? " by meaning and by keywords" : " by keywords"}.</li>
              <li>{d.ai.enabled ? "A short answer is written from only those passages, with numbered references." : "The best matching sentences are quoted, with their sources."}</li>
              <li>If the documents do not cover it, you are told so instead of getting a guess.</li>
            </ol>
            <p className="mt-2.5 text-[11px] sm:text-xs text-ink-3">Your last {POLICY_HISTORY_MAX} questions are saved for you only.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2/70 py-1.5 sm:py-2">
      <p className="text-sm sm:text-lg font-semibold text-ink">{value.toLocaleString("en-IN")}</p>
      <p className="text-[10px] sm:text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function Bubble({ who, children }: { who: "you"; children: React.ReactNode }) {
  return (
    <div className={who === "you" ? "flex justify-end w-full min-w-0" : "w-full min-w-0"}>
      <p className="max-w-[90%] sm:max-w-[85%] break-words whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-white shadow-xs">
        {children}
      </p>
    </div>
  );
}

/** One question and its answer, with the passages behind it. */
function Exchange({ turn: t }: { turn: PolicyTurn }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cited = t.citations.filter((c) => c.cited);
  const shown = open ? t.citations : [];

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${t.answer}${cited.length ? `\n\nSources: ${cited.map((c) => `[${c.n}] ${c.docTitle} · ${c.section}${c.page ? ` · p.${c.page}` : ""}`).join("; ")}` : ""}`);
      setCopied(true);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 w-full min-w-0">
      <Bubble who="you">{t.question}</Bubble>
      <div className="w-full min-w-0 rounded-xl sm:rounded-2xl rounded-bl-md border border-line bg-surface p-3 sm:p-4 shadow-xs overflow-hidden">
        {/* Adaptive badges row: compact on mobile to prevent stretching width */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <Badge tone={t.grounded ? "teal" : "amber"} className="whitespace-normal text-left text-[10px] sm:text-xs">
            <span className="hidden sm:inline">{t.grounded ? "From approved documents" : "Not found in approved documents"}</span>
            <span className="sm:hidden">{t.grounded ? "Approved Doc" : "Not in Docs"}</span>
          </Badge>
          <Badge tone="neutral" className="whitespace-normal text-left text-[10px] sm:text-xs">
            <span className="hidden sm:inline">{t.mode === "ai" ? "Written by AI from passages" : t.mode === "extract" ? "Quoted from passages" : "No answer"}</span>
            <span className="sm:hidden">{t.mode === "ai" ? "AI Answer" : t.mode === "extract" ? "Quoted" : "No answer"}</span>
          </Badge>
          <span className="text-[10px] sm:text-xs text-ink-3 shrink-0">{time(t.at)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed text-ink w-full min-w-0">
          <Cited text={t.answer} onRef={() => setOpen(true)} />
        </p>
        <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            {t.citations.length ? (
              <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs">
                <Fi name="angle-down" className={open ? "rotate-180" : ""} /> Sources ({cited.length || t.citations.length})
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void copy()} className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs">
              <Fi name="copy" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <span className="text-ink-3 text-[10px] sm:text-[11px] truncate max-w-[200px] sm:max-w-none">
            Searched {t.searched.passages} passages in {t.searched.documents} docs
          </span>
        </div>
        {shown.length ? (
          <ul className="mt-2.5 sm:mt-3 space-y-2 w-full min-w-0">
            {shown.map((c) => (
              <li key={c.n} className={`rounded-xl border p-2.5 sm:p-3 w-full min-w-0 ${c.cited ? "border-brand/40 bg-brand-soft/30" : "border-line"}`}>
                <p className="text-[11px] sm:text-xs font-medium text-brand break-words">
                  [{c.n}] {c.docTitle} · {c.section}
                  {c.page ? ` · p.${c.page}` : ""}
                  {c.cited ? " · used in answer" : ""}
                </p>
                <p className="mt-1 text-xs sm:text-sm text-ink-2 break-words leading-relaxed">{c.snippet}</p>
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
          <button key={i} type="button" onClick={onRef} className="mx-0.5 inline-flex items-center rounded bg-brand-soft px-1 py-0.5 align-baseline text-[11px] sm:text-xs font-semibold text-brand hover:underline shrink-0" aria-label={`Show source ${p}`}>
            {p}
          </button>
        ) : (
          <span key={i} className="break-words">{p}</span>
        ),
      )}
    </>
  );
}
