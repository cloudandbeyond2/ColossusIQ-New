"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileQuestion,
  Filter,
  Folder,
  FolderOpen,
  HelpCircle,
  Layers,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  BLOOM_LEVELS,
  COURSE_OUTCOMES,
  DIFFICULTY_OPTIONS,
  QUESTION_STATUSES,
} from "@/config/resources";
import {
  QuestionBankItem,
  QuestionBankOverview,
  QuestionBankOverviewSchema,
  QuestionFolder,
} from "@/lib/api/question-ai-schemas";
import type { Role } from "@/lib/auth/roles";
import { QuestionAiDialog } from "@/components/crud/question-ai-dialog";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  inputClass,
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function difficultyTone(diff: string): "teal" | "amber" | "rose" | "brand" {
  switch (diff) {
    case "Easy":
      return "teal";
    case "Medium":
      return "amber";
    case "Hard":
      return "rose";
    default:
      return "brand";
  }
}

function bloomTone(bloom: string): "brand" | "teal" | "gold" | "sky" {
  switch (bloom) {
    case "Remember":
    case "Understand":
      return "teal";
    case "Apply":
      return "sky";
    case "Analyse":
      return "gold";
    case "Evaluate":
    case "Create":
      return "brand";
    default:
      return "brand";
  }
}

interface FolderWithFiltered extends QuestionFolder {
  filteredQuestions: QuestionBankItem[];
  matchesFilter: boolean;
}

export function QuestionBankModule({ role }: { role?: Role }) {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(searchParams.get("topic") || null);

  const handleSelectTopic = (topic: string | null) => {
    setSelectedTopic(topic);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (topic) {
        url.searchParams.set("topic", topic);
      } else {
        url.searchParams.delete("topic");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [bloomFilter, setBloomFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"folders" | "accordion">("folders");

  // Modals & Dialogs
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isNewQuestionOpen, setIsNewQuestionOpen] = useState(false);
  const [newQuestionTopic, setNewQuestionTopic] = useState("");
  const [questionToDelete, setQuestionToDelete] = useState<QuestionBankItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});
  const [expandedAccordion, setExpandedAccordion] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch all questions grouped into folders
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["question-bank-folders"],
    queryFn: () => apiFetch("/api/v1/question-bank/folders", QuestionBankOverviewSchema),
  });

  // Delete mutation
  const del = useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/api/v1/records/questions/${encodeURIComponent(id)}`,
        z.object({ ok: z.literal(true) }).passthrough(),
        { method: "DELETE" }
      ),
    onSuccess: () => {
      setQuestionToDelete(null);
      showToast("Question removed from bank.");
      void qc.invalidateQueries({ queryKey: ["question-bank-folders"] });
    },
    onError: (e) => {
      showToast(e instanceof ApiError ? e.message : "Failed to delete question.");
    },
  });

  // Filter folders and questions based on search & filters
  const processedFolders = useMemo(() => {
    if (!data?.folders) return [];

    const q = search.trim().toLowerCase();

    return data.folders
      .map((folder) => {
        // Filter questions within this folder
        const matchedQuestions = folder.questions.filter((item) => {
          if (difficultyFilter !== "All" && item.difficulty !== difficultyFilter) return false;
          if (bloomFilter !== "All" && item.bloom !== bloomFilter) return false;
          if (statusFilter !== "All" && item.status !== statusFilter) return false;

          if (q) {
            const inPrompt = item.question.toLowerCase().includes(q);
            const inTopic = item.topic.toLowerCase().includes(q);
            const inCo = item.co.toLowerCase().includes(q);
            const inId = item.id.toLowerCase().includes(q);
            const inExplanation = item.explanation?.toLowerCase().includes(q);
            if (!inPrompt && !inTopic && !inCo && !inId && !inExplanation) return false;
          }

          return true;
        });

        // Folder matches if it contains matching questions OR if topic name matches search
        const topicMatches = q ? folder.topic.toLowerCase().includes(q) : true;

        return {
          ...folder,
          filteredQuestions: matchedQuestions,
          matchesFilter: matchedQuestions.length > 0 || (topicMatches && matchedQuestions.length > 0),
        };
      })
      .filter((f) => f.matchesFilter);
  }, [data?.folders, search, difficultyFilter, bloomFilter, statusFilter]);

  // Current active folder (if one is clicked)
  const currentFolder: FolderWithFiltered | null = useMemo(() => {
    if (!selectedTopic || !data?.folders) return null;
    const found = processedFolders.find((f) => f.topic === selectedTopic);
    if (found) return found;
    const raw = data.folders.find((f) => f.topic === selectedTopic);
    if (raw) return { ...raw, filteredQuestions: raw.questions, matchesFilter: true };
    return null;
  }, [selectedTopic, processedFolders, data?.folders]);

  // All existing topic names for quick creation dropdown
  const existingTopics = useMemo(() => {
    if (!data?.folders) return [];
    return data.folders.map((f) => f.topic);
  }, [data?.folders]);

  const toggleAnswer = (id: string) => {
    setExpandedAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAccordion = (topic: string) => {
    setExpandedAccordion((prev) => ({ ...prev, [topic]: !prev[topic] }));
  };

  const copyQuestion = (item: QuestionBankItem) => {
    const text = `Question (${item.id}):\n${item.question}\n\nDifficulty: ${item.difficulty} | Bloom: ${item.bloom} | Marks: ${item.marks} | CO: ${item.co}${item.explanation ? `\n\nModel Answer:\n${item.explanation}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    showToast(`Question ${item.id} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <TemplateSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        title="Unable to load Question Bank"
        body={error instanceof ApiError ? error.message : "An unexpected error occurred while loading topic folders."}
        action={<Button onClick={() => void refetch()}>Try Again</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-2"
        >
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Assessment Question Bank</h2>
          <p className="text-xs text-ink-3">
            Topic-organized folders with Bloom&apos;s Taxonomy, course outcomes, and model solutions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.canManage && (
            <Button
              variant="gold"
              onClick={() => setIsAiOpen(true)}
              className="gap-1.5 shadow-xs"
            >
              <Sparkles className="size-4" />
              Generate with AI
            </Button>
          )}

          {data.canManage && (
            <Button
              variant="primary"
              onClick={() => {
                setNewQuestionTopic(selectedTopic || "");
                setIsNewQuestionOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add Question
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="gap-1.5"
            title="Refresh Question Bank"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
            <Folder className="size-4 text-brand" />
            <span>Topic Folders</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{data.totalFolders}</div>
          <div className="mt-0.5 text-xs text-ink-3">Categorized headings</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
            <FileQuestion className="size-4 text-sky" />
            <span>Total Questions</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{data.totalQuestions}</div>
          <div className="mt-0.5 text-xs text-ink-3">Across all syllabi</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Active &amp; Ready</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-600">{data.activeCount}</div>
          <div className="mt-0.5 text-xs text-ink-3">Usable in exams</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
            <Clock className="size-4 text-amber-500" />
            <span>Drafts</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-amber-600">{data.draftCount}</div>
          <div className="mt-0.5 text-xs text-ink-3">Awaiting review</div>
        </div>

        <div className="col-span-2 rounded-xl border border-line bg-surface p-3.5 shadow-xs sm:col-span-1">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
            <Layers className="size-4 text-purple-500" />
            <span>Avg Marks</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{data.avgMarks}</div>
          <div className="mt-0.5 text-xs text-ink-3">{data.totalMarks} total points</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions by statement, topic heading, ID, outcome..."
            className={cn(inputClass, "pl-9 text-sm")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty filter */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
          >
            <option value="All">All Difficulties</option>
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Bloom filter */}
          <select
            value={bloomFilter}
            onChange={(e) => setBloomFilter(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
          >
            <option value="All">All Bloom Levels</option>
            {BLOOM_LEVELS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
          >
            <option value="All">All Statuses</option>
            {QUESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-line bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode("folders");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "folders"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Folders</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("accordion");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "accordion"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              <List className="size-3.5" />
              <span>Expandable</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA: DRILLDOWN FOLDER VIEW vs FOLDER GRID
          ───────────────────────────────────────────────────────────── */}

      {selectedTopic && currentFolder ? (
        /* ══════════════════════════════════════════════════════════════
           OPENED FOLDER DRILL-DOWN VIEW (Set of questions in folder)
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => handleSelectTopic(null)}
              className="group inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-xs transition-all hover:border-brand/40 hover:bg-surface-2"
            >
              <ArrowLeft className="size-4 text-ink-3 transition-transform group-hover:-translate-x-1" />
              <span>Back to All Folders</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-ink-3">
              <span>Question Bank</span>
              <ChevronRight className="size-3.5 text-ink-4" />
              <span className="font-semibold text-ink">{currentFolder.topic}</span>
            </div>
          </div>

          {/* Folder Banner Header */}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-inner">
                  <FolderOpen className="size-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-amber-600">
                      Topic Folder
                    </span>
                    <span className="text-xs text-ink-3">·</span>
                    <span className="text-xs text-ink-3">{currentFolder.count} questions</span>
                    <span className="text-xs text-ink-3">·</span>
                    <span className="text-xs text-ink-3">{currentFolder.totalMarks} total marks</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
                    {currentFolder.topic}
                  </h1>
                </div>
              </div>

              {data.canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => setIsAiOpen(true)}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-3.5" />
                    AI Questions for Topic
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setNewQuestionTopic(currentFolder.topic);
                      setIsNewQuestionOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Add Question to Topic
                  </Button>
                </div>
              )}
            </div>

            {/* Folder Metrics Breakdown */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/60 pt-4 text-xs">
              <span className="font-medium text-ink-2">Difficulties:</span>
              {Object.entries(currentFolder.difficulties).map(([diff, count]) =>
                count > 0 ? (
                  <Badge key={diff} tone={difficultyTone(diff)} className="px-2 py-0.5">
                    {diff}: {count}
                  </Badge>
                ) : null,
              )}

              <span className="ml-3 font-medium text-ink-2">Bloom Levels:</span>
              {Object.entries(currentFolder.bloomLevels).map(([bloom, count]) =>
                count > 0 ? (
                  <Badge key={bloom} tone={bloomTone(bloom)} className="px-2 py-0.5">
                    {bloom}: {count}
                  </Badge>
                ) : null,
              )}

              <span className="ml-auto text-xs text-ink-3">
                {currentFolder.activeCount} Active · {currentFolder.draftCount} Draft
              </span>
            </div>
          </div>

          {/* Question List inside Folder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">
                Questions in this folder ({currentFolder.filteredQuestions?.length ?? currentFolder.questions.length})
              </h3>
              <span className="text-xs text-ink-3">
                Click &quot;View Model Answer&quot; to inspect solution criteria
              </span>
            </div>

            {(currentFolder.filteredQuestions ?? currentFolder.questions).length === 0 ? (
              <EmptyState
                title="No questions match filters"
                body="Try adjusting your search query, difficulty, or Bloom's taxonomy filter."
                action={
                  <Button
                    onClick={() => {
                      setSearch("");
                      setDifficultyFilter("All");
                      setBloomFilter("All");
                      setStatusFilter("All");
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              (currentFolder.filteredQuestions ?? currentFolder.questions).map((item, index) => {
                const isExpanded = Boolean(expandedAnswers[item.id]);

                return (
                  <Card
                    key={item.id}
                    className="group border border-line bg-surface transition-all hover:border-brand/30 hover:shadow-xs"
                  >
                    <CardBody className="space-y-3.5 p-5">
                      {/* Question Item Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-md bg-surface-2 font-mono text-xs font-semibold text-ink-2">
                            #{index + 1}
                          </span>
                          <span className="font-mono font-medium text-ink-3">{item.id}</span>
                          <Badge
                            tone={item.status === "Active" ? "teal" : "amber"}
                            className="px-2 py-0.5 font-medium"
                          >
                            {item.status}
                          </Badge>
                          <Badge tone="brand" className="px-2 py-0.5 font-semibold">
                            {item.marks} {item.marks === 1 ? "Mark" : "Marks"}
                          </Badge>
                          <Badge tone={difficultyTone(item.difficulty)} className="px-2 py-0.5">
                            {item.difficulty}
                          </Badge>
                          <Badge tone={bloomTone(item.bloom)} className="px-2 py-0.5">
                            Bloom: {item.bloom}
                          </Badge>
                          <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink-3">
                            {item.co}
                          </span>
                        </div>

                        {/* Actions on this question */}
                        <div className="flex items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => copyQuestion(item)}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                            title="Copy question statement & solution"
                          >
                            {copiedId === item.id ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            <span>{copiedId === item.id ? "Copied" : "Copy"}</span>
                          </button>

                          {role && (
                            <Link
                              href={`/${role}/question-bank/${item.id}`}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-brand"
                              title="Edit in full form"
                            >
                              <Edit3 className="size-3.5" />
                              <span>Edit</span>
                            </Link>
                          )}

                          {data.canManage && (
                            <button
                              type="button"
                              onClick={() => setQuestionToDelete(item)}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              title="Delete question"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question Statement */}
                      <div className="text-sm font-medium leading-relaxed text-ink">
                        {item.question}
                      </div>

                      {/* Model Answer Toggle & Content */}
                      {item.explanation && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleAnswer(item.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark"
                          >
                            <HelpCircle className="size-3.5" />
                            <span>{isExpanded ? "Hide Model Answer & Solution" : "View Model Answer & Solution"}</span>
                            <ChevronDown
                              className={cn(
                                "size-3.5 transition-transform duration-200",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs leading-relaxed text-ink animate-in fade-in duration-150">
                              <div className="mb-1.5 font-semibold text-brand-dark flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-brand" />
                                <span>Model Solution &amp; Grading Explanation:</span>
                              </div>
                              <p className="whitespace-pre-line text-ink-2 font-mono text-xs">
                                {item.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>

          {/* Quick jump to other folders */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <Button
              variant="secondary"
              onClick={() => handleSelectTopic(null)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" /> All Folders
            </Button>

            <div className="text-xs text-ink-3">
              Explore more topics in the main folder directory
            </div>
          </div>
        </div>
      ) : viewMode === "accordion" ? (
        /* ══════════════════════════════════════════════════════════════
           EXPANDABLE ACCORDION VIEW
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-3">
          {processedFolders.length === 0 ? (
            <EmptyState
              title="No topic folders found"
              body="No questions matched your current search filters."
              action={<Button onClick={() => setSearch("")}>Clear Search</Button>}
            />
          ) : (
            processedFolders.map((folder) => {
              const isOpen = Boolean(expandedAccordion[folder.topic]);
              const questions = folder.filteredQuestions ?? folder.questions;

              return (
                <div
                  key={folder.topic}
                  className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-colors hover:border-brand/40"
                >
                  <div className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface-2">
                    <div
                      onClick={() => toggleAccordion(folder.topic)}
                      className="flex flex-1 cursor-pointer items-center gap-3"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                        {isOpen ? <FolderOpen className="size-5" /> : <Folder className="size-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-ink">{folder.topic}</h3>
                          <Badge tone="brand" className="px-2 py-0.2 text-xs">
                            {questions.length} questions
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-3">
                          {folder.totalMarks} total marks · {folder.activeCount} active · {folder.draftCount} draft
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTopic(folder.topic)}
                        className="rounded-lg bg-surface-2 px-3 py-1 text-xs font-medium text-ink hover:bg-brand/10 hover:text-brand"
                      >
                        Open Folder Page →
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAccordion(folder.topic)}
                        className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                        title={isOpen ? "Collapse folder" : "Expand folder"}
                      >
                        <ChevronDown
                          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="divide-y divide-line border-t border-line bg-surface-2/40 p-4 space-y-3">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="pt-3 first:pt-0 space-y-2">
                          <div className="flex items-center justify-between text-xs text-ink-3">
                            <span className="font-mono">#{idx + 1} · {q.id}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge tone={difficultyTone(q.difficulty)} className="text-[10px]">
                                {q.difficulty}
                              </Badge>
                              <Badge tone="brand" className="text-[10px]">
                                {q.marks} Marks
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-ink">{q.question}</p>
                          {q.explanation && (
                            <p className="text-xs text-ink-3 line-clamp-2">
                              💡 Solution: {q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           FOLDER CARDS GRID VIEW (The requested folder experience)
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Folder className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">
                Topic Folders ({processedFolders.length})
              </h3>
            </div>
            <span className="text-xs text-ink-3">
              Click any folder heading to view its questions
            </span>
          </div>

          {processedFolders.length === 0 ? (
            <EmptyState
              title="No topic folders found"
              body="No questions matched your search query or filters."
              action={
                <Button
                  onClick={() => {
                    setSearch("");
                    setDifficultyFilter("All");
                    setBloomFilter("All");
                    setStatusFilter("All");
                  }}
                >
                  Reset Filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {processedFolders.map((folder) => {
                const count = folder.filteredQuestions?.length ?? folder.count;
                const sample = folder.questions[0];

                return (
                  <div
                    key={folder.topic}
                    onClick={() => handleSelectTopic(folder.topic)}
                    className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5"
                  >
                    {/* Folder Tab Visual Edge */}
                    <div className="absolute -top-1 left-6 h-2 w-20 rounded-b-md bg-amber-500/20 group-hover:bg-amber-500/40" />

                    <div>
                      {/* Folder Top Row: Icon + Counter */}
                      <div className="flex items-center justify-between">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-transform duration-200 group-hover:scale-105 group-hover:bg-amber-500/20">
                          <Folder className="size-6 transition-all group-hover:hidden" />
                          <FolderOpen className="hidden size-6 transition-all group-hover:block" />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge tone="brand" className="px-2.5 py-0.5 font-semibold text-xs">
                            {count} {count === 1 ? "Question" : "Questions"}
                          </Badge>
                        </div>
                      </div>

                      {/* Folder Heading (Topic) */}
                      <h4 className="mt-4 text-lg font-bold text-ink transition-colors group-hover:text-amber-600">
                        {folder.topic}
                      </h4>

                      <p className="mt-1 text-xs text-ink-3">
                        {folder.totalMarks} total marks · {folder.activeCount} active · {folder.draftCount} draft
                      </p>

                      {/* Difficulty Pills */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                        {Object.entries(folder.difficulties).map(([diff, cnt]) =>
                          cnt > 0 ? (
                            <span
                              key={diff}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                                diff === "Easy" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                diff === "Medium" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                diff === "Hard" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                              )}
                            >
                              {diff}: {cnt}
                            </span>
                          ) : null,
                        )}
                      </div>

                      {/* Sample Question Preview */}
                      {sample && (
                        <div className="mt-3 rounded-lg bg-surface-2/60 p-2.5 text-xs text-ink-3 line-clamp-2 italic">
                          &quot;{sample.question}&quot;
                        </div>
                      )}
                    </div>

                    {/* Folder Card Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-semibold text-amber-600">
                      <span className="flex items-center gap-1 group-hover:underline">
                        Open folder
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="text-[11px] font-normal text-ink-3">
                        {Object.keys(folder.bloomLevels).slice(0, 2).join(", ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Quick Add Question
          ───────────────────────────────────────────────────────────── */}
      {isNewQuestionOpen && (
        <QuickQuestionModal
          defaultTopic={newQuestionTopic}
          existingTopics={existingTopics}
          onClose={() => setIsNewQuestionOpen(false)}
          onSuccess={(savedTopic) => {
            setIsNewQuestionOpen(false);
            showToast("Question successfully added to question bank!");
            void qc.invalidateQueries({ queryKey: ["question-bank-folders"] });
            if (savedTopic) handleSelectTopic(savedTopic);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: AI Question Generator Dialog
          ───────────────────────────────────────────────────────────── */}
      {isAiOpen && (
        <QuestionAiDialog
          onClose={() => {
            setIsAiOpen(false);
            void qc.invalidateQueries({ queryKey: ["question-bank-folders"] });
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Delete Confirmation
          ───────────────────────────────────────────────────────────── */}
      {questionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10">
                <Trash2 className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Delete Question?</h3>
            </div>

            <p className="mt-3 text-sm text-ink-2">
              Are you sure you want to permanently delete question{" "}
              <span className="font-mono font-semibold text-ink">{questionToDelete.id}</span> from the{" "}
              <span className="font-semibold text-ink">{questionToDelete.topic}</span> folder?
            </p>

            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs italic text-ink-3 line-clamp-3">
              &quot;{questionToDelete.question}&quot;
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setQuestionToDelete(null)}
                disabled={del.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => del.mutate(questionToDelete.id)}
                disabled={del.isPending}
                className="gap-1.5"
              >
                {del.isPending ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                Delete Question
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Inline Modal for Adding a Question
// ──────────────────────────────────────────────────────────────────
function QuickQuestionModal({
  defaultTopic,
  existingTopics,
  onClose,
  onSuccess,
}: {
  defaultTopic: string;
  existingTopics: string[];
  onClose: () => void;
  onSuccess: (topic: string) => void;
}) {
  const [topic, setTopic] = useState(defaultTopic || "");
  const [question, setQuestion] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [bloom, setBloom] = useState("Understand");
  const [co, setCo] = useState("CO1");
  const [marks, setMarks] = useState(2);
  const [status, setStatus] = useState("Active");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");

  const add = useMutation({
    mutationFn: () =>
      apiFetch(
        "/api/v1/records/questions",
        z.object({ id: z.string() }).passthrough(),
        {
          method: "POST",
          body: {
            data: {
              question: question.trim(),
              topic: topic.trim(),
              difficulty,
              bloom,
              co,
              marks: Number(marks) || 2,
              status,
              explanation: explanation.trim(),
            },
          },
        }
      ),
    onSuccess: () => {
      onSuccess(topic.trim());
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "Failed to add question.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Please specify a topic or folder heading.");
      return;
    }
    if (!question.trim()) {
      setError("Please enter the question statement.");
      return;
    }
    setError("");
    add.mutate();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Plus className="size-5" />
            </div>
            <h3 className="text-lg font-bold text-ink">Add New Question</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Topic / Folder Heading */}
          <div>
            <label className="block text-xs font-semibold text-ink-2">
              Topic / Folder Heading *
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                list="topic-options"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Relational Normalization & BCNF"
                required
                className={inputClass}
              />
              <datalist id="topic-options">
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <p className="mt-1 text-[11px] text-ink-3">
              Type a new heading or select an existing folder to group this question.
            </p>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-semibold text-ink-2">Question Statement *</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter clear, concise question statement or problem description..."
              rows={3}
              required
              className={cn(inputClass, "mt-1 resize-y font-normal")}
            />
          </div>

          {/* Classification grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-ink-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={cn(inputClass, "mt-1 text-xs")}
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2">Bloom Level</label>
              <select
                value={bloom}
                onChange={(e) => setBloom(e.target.value)}
                className={cn(inputClass, "mt-1 text-xs")}
              >
                {BLOOM_LEVELS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2">Marks</label>
              <input
                type="number"
                min={1}
                max={50}
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value) || 1)}
                className={cn(inputClass, "mt-1 text-xs")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2">Course Outcome</label>
              <select
                value={co}
                onChange={(e) => setCo(e.target.value)}
                className={cn(inputClass, "mt-1 text-xs")}
              >
                {COURSE_OUTCOMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-ink-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={cn(inputClass, "mt-1 text-xs")}
            >
              {QUESTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Model Solution / Explanation */}
          <div>
            <label className="block text-xs font-semibold text-ink-2">
              Model Answer / Solution Explanation
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Step-by-step model solution, derivation or evaluation criteria..."
              rows={3}
              className={cn(inputClass, "mt-1 resize-y font-mono text-xs")}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" type="button" onClick={onClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={add.isPending} className="gap-1.5">
              {add.isPending ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
              Save Question
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
