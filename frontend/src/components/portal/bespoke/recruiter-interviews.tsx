"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  INTERVIEW_RECOMMENDATIONS,
  INTERVIEW_ROUNDS,
  INTERVIEW_STATUSES,
  InterviewRecommendation,
  InterviewRound,
  InterviewScheduleItem,
  InterviewStatus,
  InterviewsOverview,
  type SubmitInterviewFeedbackInput,
} from "@/lib/api/recruiter-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<InterviewStatus, "brand" | "amber" | "teal" | "sky" | "rose"> = {
  Scheduled: "brand",
  "In Progress": "amber",
  Completed: "teal",
  Rescheduled: "sky",
  Cancelled: "rose",
};

const REC_TONES: Record<InterviewRecommendation, "teal" | "brand" | "amber" | "rose" | "neutral"> = {
  "Strong Hire": "teal",
  Hire: "brand",
  Hold: "amber",
  "No Hire": "rose",
  "Pending Evaluation": "neutral",
};

export function RecruiterInterviewsModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("All");
  const [roundFilter, setRoundFilter] = useState("All");

  // Modals
  const [feedbackInterview, setFeedbackInterview] = useState<InterviewScheduleItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Build query
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (roundFilter !== "All") params.set("round", roundFilter);
    return params.toString();
  }, [statusFilter, roundFilter]);

  // Fetch Interviews
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["recruiter-interviews", queryString],
    queryFn: () =>
      apiFetch(
        `/api/v1/recruiter/interviews${queryString ? `?${queryString}` : ""}`,
        InterviewsOverview
      ),
  });

  // Submit Feedback Mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubmitInterviewFeedbackInput }) =>
      apiFetch(`/api/v1/recruiter/interviews/${id}`, z.any(), {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["recruiter-interviews"] });
      qc.invalidateQueries({ queryKey: ["recruiter-shortlists"] });
      setFeedbackInterview(null);
      showToast(
        `Feedback recorded for ${updated.candidateName}: recommendation "${updated.recommendation}"`
      );
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to submit feedback.");
    },
  });

  // Cancel Interview Mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/recruiter/interviews/${id}`, z.any(), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruiter-interviews"] });
      showToast("Interview round cancelled.");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to cancel interview.");
    },
  });

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => { refetch(); }} />;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* METRIC KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* KPI 1: Upcoming Today */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Panels Today
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <Calendar className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.upcomingTodayCount}
            </span>
            <Badge tone="brand" className="text-[10px]">
              Live Today
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Scheduled evaluation rounds</p>
        </Card>

        {/* KPI 2: This Week */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-sky">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Scheduled (7 Days)
            </span>
            <span className="rounded-lg bg-sky-soft p-1.5 text-sky">
              <Clock className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.thisWeekCount}
            </span>
            <span className="text-[11px] text-sky font-semibold">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Across coding & HR panels</p>
        </Card>

        {/* KPI 3: Completed */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Completed Rounds
            </span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.completedCount}
            </span>
            <span className="text-[11px] text-teal font-semibold">Evaluated</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Finished panel discussions</p>
        </Card>

        {/* KPI 4: Pending Feedback */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-amber">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Pending Feedback
            </span>
            <span className="rounded-lg bg-amber-soft p-1.5 text-amber">
              <MessageSquare className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.pendingFeedbackCount}
            </span>
            <span className="text-[11px] text-amber font-semibold">Action Needed</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Interviews awaiting panel verdict</p>
        </Card>
      </div>

      {/* FILTER TOOLBAR */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-brand" />
            <h3 className="text-xs sm:text-sm font-bold text-ink">
              Candidate Interview Schedule & Evaluation Desk
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Statuses</option>
              {INTERVIEW_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Round Filter */}
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Rounds</option>
              {INTERVIEW_ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* INTERVIEWS LIST */}
      {data.interviews.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No scheduled interviews found"
            body="No interviews matched the selected filter criteria. To schedule interviews, head over to the Shortlists tab and click 'Interview' on any candidate."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.interviews.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col justify-between overflow-hidden border border-line bg-surface hover:shadow-md transition"
            >
              <div className="p-4 sm:p-5">
                {/* Header Row: Badges */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <Badge tone={STATUS_TONES[item.status]} className="text-[10px] font-semibold">
                    {item.status}
                  </Badge>
                  <span className="text-[11px] font-mono font-semibold text-brand flex items-center gap-1">
                    <Clock className="size-3" /> {item.dateTime}
                  </span>
                </div>

                {/* Candidate & Role */}
                <h3 className="text-base font-bold text-ink">{item.candidateName}</h3>
                <p className="text-xs font-semibold text-brand mt-0.5">
                  {item.roleRequisition} · {item.roll}
                </p>

                {/* Round Badge */}
                <div className="mt-2.5">
                  <Badge tone="neutral" className="text-xs font-medium">
                    {item.round}
                  </Badge>
                  <span className="text-[11px] text-ink-3 ml-2">
                    ({item.durationMinutes} mins)
                  </span>
                </div>

                {/* Panelists */}
                <div className="mt-3 rounded-xl border border-line bg-surface-2/40 p-2.5 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-ink-3 block">
                    Assigned Evaluation Panel
                  </span>
                  <p className="font-semibold text-ink line-clamp-1">{item.panelists}</p>
                </div>

                {/* Location / Meeting link */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3">
                  <span className="flex items-center gap-1 truncate max-w-[180px]">
                    <MapPin className="size-3 text-amber shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </span>

                  {item.meetingLink && (
                    <a
                      href={item.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Join Meet</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                {/* Completed Verdict / Recommendation */}
                {item.status === "Completed" && (
                  <div className="mt-3.5 rounded-xl border border-teal/30 bg-teal-soft/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-ink">Score: {item.feedbackScore}/100</span>
                      <Badge tone={REC_TONES[item.recommendation]} className="text-[10px] font-bold">
                        {item.recommendation}
                      </Badge>
                    </div>
                    {item.feedbackNotes && (
                      <p className="text-[11px] text-ink-2 italic line-clamp-2">
                        &quot;{item.feedbackNotes}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-line bg-surface-2/30 px-4 py-2.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFeedbackInterview(item)}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <MessageSquare className="size-3.5" />
                  <span>{item.status === "Completed" ? "Update Verdict" : "Submit Feedback"}</span>
                </Button>

                {item.status === "Scheduled" && (
                  <button
                    onClick={() => {
                      if (confirm(`Cancel interview for ${item.candidateName}?`)) {
                        cancelMutation.mutate(item.id);
                      }
                    }}
                    className="text-xs text-ink-3 hover:text-rose p-1 transition"
                    title="Cancel round"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: SUBMIT / UPDATE INTERVIEW FEEDBACK */}
      {feedbackInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Interview Panel Feedback</h3>
                <p className="text-xs text-ink-3">
                  {feedbackInterview.candidateName} · {feedbackInterview.round}
                </p>
              </div>
              <button
                onClick={() => setFeedbackInterview(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                feedbackMutation.mutate({
                  id: feedbackInterview.id,
                  input: {
                    feedbackScore: Number(fd.get("feedbackScore")),
                    recommendation: fd.get("recommendation") as "Strong Hire" | "Hire" | "Hold" | "No Hire",
                    feedbackNotes: String(fd.get("feedbackNotes")),
                    status: "Completed",
                  },
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Evaluation Score (0 - 100) *</label>
                <input
                  type="number"
                  name="feedbackScore"
                  required
                  min={0}
                  max={100}
                  defaultValue={feedbackInterview.feedbackScore || 85}
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">Panel Recommendation *</label>
                <select
                  name="recommendation"
                  defaultValue={feedbackInterview.recommendation === "Pending Evaluation" ? "Hire" : feedbackInterview.recommendation}
                  className={cn(inputClass, "mt-1")}
                >
                  <option value="Strong Hire">Strong Hire (Fast-track to next round / offer)</option>
                  <option value="Hire">Hire (Meets bar)</option>
                  <option value="Hold">Hold (Need secondary review)</option>
                  <option value="No Hire">No Hire (Does not meet bar)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink">Technical & Behavioral Feedback *</label>
                <textarea
                  name="feedbackNotes"
                  required
                  rows={4}
                  defaultValue={feedbackInterview.feedbackNotes}
                  placeholder="Summarize candidate's problem-solving depth, coding structure, architectural trade-offs, and communication..."
                  className={cn(inputClass, "mt-1 resize-none")}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button variant="secondary" type="button" onClick={() => setFeedbackInterview(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={feedbackMutation.isPending}>
                  {feedbackMutation.isPending ? "Submitting..." : "Save Verdict"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
