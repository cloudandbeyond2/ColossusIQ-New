"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  GraduationCap,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  INTERVIEW_ROUNDS,
  RECRUITER_ROLES,
  RECRUITER_STAGES,
  ShortlistCandidate,
  ShortlistsOverview,
  type InterviewRound,
  type RecruiterRole,
  type RecruiterStage,
  type ScheduleInterviewInput,
  type UpdateShortlistStageInput,
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
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STAGE_TONES: Record<RecruiterStage, "neutral" | "sky" | "brand" | "amber" | "teal" | "gold" | "rose"> = {
  Shortlisted: "neutral",
  "Technical Assessment": "sky",
  "Technical Interview": "brand",
  "HR Round": "amber",
  "Offer Extended": "gold",
  Hired: "teal",
  Rejected: "rose",
};

export function ShortlistsModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");

  // Modals
  const [schedulingFor, setSchedulingFor] = useState<ShortlistCandidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<ShortlistCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Shortlists
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["recruiter-shortlists", roleFilter],
    queryFn: () =>
      apiFetch(
        `recruiter/shortlists${roleFilter !== "All" ? `?role=${encodeURIComponent(roleFilter)}` : ""}`,
        ShortlistsOverview
      ),
  });

  // Stage Mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShortlistStageInput }) =>
      apiFetch(`recruiter/shortlists/${id}`, z.any(), {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["recruiter-shortlists"] });
      setEditingCandidate(null);
      showToast(`Updated stage for ${updated.candidateName} to "${updated.stage}"`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to update stage.");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`recruiter/shortlists/${id}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruiter-shortlists"] });
      qc.invalidateQueries({ queryKey: ["recruiter-candidates"] });
      showToast("Removed candidate from shortlist requisition.");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to remove candidate.");
    },
  });

  // Schedule Interview Mutation
  const scheduleMutation = useMutation({
    mutationFn: (input: ScheduleInterviewInput) =>
      apiFetch("recruiter/interviews", z.any(), {
        method: "POST",
        body: input,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["recruiter-shortlists"] });
      qc.invalidateQueries({ queryKey: ["recruiter-interviews"] });
      setSchedulingFor(null);
      showToast(`Interview scheduled for ${created.candidateName} (${created.dateTime})!`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to schedule interview.");
    },
  });

  // Filtered list
  const filteredShortlists = useMemo(() => {
    if (!data?.shortlists) return [];
    return data.shortlists.filter((s) => {
      if (stageFilter !== "All" && s.stage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = s.candidateName.toLowerCase().includes(q);
        const matchesRoll = s.roll.toLowerCase().includes(q);
        const matchesRole = s.roleRequisition.toLowerCase().includes(q);
        const matchesNotes = s.notes.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesRole && !matchesNotes) return false;
      }
      return true;
    });
  }, [data?.shortlists, stageFilter, search]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredShortlists.length) return;
    const headers = [
      "Candidate Name",
      "Roll No",
      "Department",
      "College",
      "Role Requisition",
      "Stage",
      "Assessment Score",
      "Placement Readiness",
      "Interviews Count",
      "Shortlisted At",
      "Recruiter Notes",
    ];

    const rows = filteredShortlists.map((s) => [
      `"${s.candidateName.replace(/"/g, '""')}"`,
      `"${s.roll}"`,
      `"${s.department}"`,
      `"${s.college}"`,
      `"${s.roleRequisition}"`,
      `"${s.stage}"`,
      s.assessmentScore,
      `${s.readiness}%`,
      s.interviewsCount,
      `"${s.shortlistedAt.slice(0, 10)}"`,
      `"${s.notes.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `candidate-shortlists-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded candidate shortlists CSV.");
  };

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
        {/* KPI 1 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Total In Pipeline
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <Users className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.totalShortlisted}
            </span>
            <span className="text-[11px] text-brand font-medium">Candidates</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Across all active requisitions</p>
        </Card>

        {/* KPI 2 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-sky">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              In Assessment
            </span>
            <span className="rounded-lg bg-sky-soft p-1.5 text-sky">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.inAssessmentCount}
            </span>
            <span className="text-[11px] text-sky font-semibold">Online Tests</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Coding & analytical test stage</p>
        </Card>

        {/* KPI 3 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-amber">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              In Interview Panels
            </span>
            <span className="rounded-lg bg-amber-soft p-1.5 text-amber">
              <Video className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.inInterviewCount}
            </span>
            <span className="text-[11px] text-amber font-semibold">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Technical & HR rounds scheduled</p>
        </Card>

        {/* KPI 4 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Offers Extended
            </span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
              <Award className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.offersExtendedCount}
            </span>
            <Badge tone="teal" className="text-[10px]">
              Final Stage
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Offer letters issued / accepted</p>
        </Card>
      </div>

      {/* FILTER TOOLBAR */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate name, roll, or requisition..."
              className={cn(inputClass, "pl-9 text-xs sm:text-sm")}
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

          {/* Filters & Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Requisition */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Requisitions</option>
              {RECRUITER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Pipeline Stage */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Stages</option>
              {RECRUITER_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Export CSV */}
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs gap-1.5"
              title="Download shortlist CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* PIPELINE CANDIDATE TABLE */}
      {filteredShortlists.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No shortlisted candidates found"
            body="No candidates matched your search or stage filters. Head over to Talent Search to discover and shortlist verified candidates."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("All");
                  setStageFilter("All");
                }}
              >
                Reset Filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-line bg-surface-2/60 text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Candidate & Roll</th>
                  <th className="py-3 px-3">Role Requisition</th>
                  <th className="py-3 px-3">Hiring Stage</th>
                  <th className="py-3 px-3">Assessment Score</th>
                  <th className="py-3 px-3">Readiness</th>
                  <th className="py-3 px-3">Interviews</th>
                  <th className="py-3 px-3">Recruiter Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredShortlists.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/40 transition">
                    {/* Candidate */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-bold text-ink">{s.candidateName}</p>
                      <p className="text-[10px] text-ink-3 font-mono">
                        {s.roll} · {s.department}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge tone="brand" className="text-xs font-semibold">
                        {s.roleRequisition}
                      </Badge>
                    </td>

                    {/* Stage quick selector */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <select
                        value={s.stage}
                        onChange={(e) =>
                          updateStageMutation.mutate({
                            id: s.id,
                            input: { stage: e.target.value as RecruiterStage },
                          })
                        }
                        className={cn(
                          "h-7 rounded-lg border border-line px-2 text-xs font-semibold cursor-pointer",
                          s.stage === "Hired"
                            ? "bg-teal-soft text-teal"
                            : s.stage === "Offer Extended"
                            ? "bg-amber-soft text-amber"
                            : s.stage === "Rejected"
                            ? "bg-rose-soft text-rose"
                            : "bg-surface text-ink"
                        )}
                      >
                        {RECRUITER_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Assessment */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {s.assessmentScore > 0 ? (
                        <div className="flex items-center gap-1 font-mono font-bold text-ink">
                          <span>{s.assessmentScore}</span>
                          <span className="text-[10px] text-ink-3 font-normal">/100</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-3 italic">Pending test</span>
                      )}
                    </td>

                    {/* Readiness */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-ink">
                      {s.readiness}%
                    </td>

                    {/* Interviews count & schedule button */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-ink">
                        {s.interviewsCount} round(s)
                      </span>
                    </td>

                    {/* Recruiter Notes */}
                    <td className="py-3 px-3 max-w-[220px]">
                      <p className="truncate text-ink-2" title={s.notes}>
                        {s.notes || "—"}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSchedulingFor(s)}
                          className="h-7 px-2 text-xs gap-1 text-brand font-semibold"
                          title="Schedule Interview"
                        >
                          <Video className="size-3" />
                          <span>Interview</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCandidate(s)}
                          className="h-7 px-2 text-xs"
                          title="Edit Stage / Score"
                        >
                          <Edit3 className="size-3" />
                        </Button>

                        <button
                          onClick={() => {
                            if (confirm(`Remove ${s.candidateName} from ${s.roleRequisition}?`)) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          className="rounded p-1 text-ink-3 hover:text-rose transition"
                          title="Remove candidate"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: SCHEDULE INTERVIEW */}
      {schedulingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Schedule Interview</h3>
                <p className="text-xs text-ink-3">
                  For {schedulingFor.candidateName} · {schedulingFor.roleRequisition}
                </p>
              </div>
              <button
                onClick={() => setSchedulingFor(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                scheduleMutation.mutate({
                  shortlistId: schedulingFor.id,
                  round: fd.get("round") as InterviewRound,
                  dateTime: String(fd.get("dateTime")),
                  durationMinutes: Number(fd.get("durationMinutes") || 45),
                  panelists: String(fd.get("panelists")),
                  meetingLink: String(fd.get("meetingLink") || "https://meet.google.com/technova-live-eval"),
                  location: String(fd.get("location") || "Online Video / Room 204"),
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Interview Round *</label>
                <select name="round" className={cn(inputClass, "mt-1")}>
                  {INTERVIEW_ROUNDS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Date & Time *</label>
                  <input
                    name="dateTime"
                    required
                    placeholder="e.g. Tomorrow, 03:00 PM"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Duration (mins)</label>
                  <input
                    type="number"
                    name="durationMinutes"
                    defaultValue={45}
                    min={15}
                    max={120}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">Panelist Names *</label>
                <input
                  name="panelists"
                  required
                  placeholder="e.g. Vikram Sethi (Principal Architect), Priya M."
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">Video Meeting Link</label>
                <input
                  name="meetingLink"
                  placeholder="https://meet.google.com/..."
                  defaultValue="https://meet.google.com/technova-eval"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">Room / Campus Location</label>
                <input
                  name="location"
                  defaultValue="Placement Interview Room 204"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button variant="secondary" type="button" onClick={() => setSchedulingFor(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={scheduleMutation.isPending}>
                  {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: EDIT STAGE & SCORE */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Update Candidate Progress</h3>
                <p className="text-xs text-ink-3">
                  {editingCandidate.candidateName} · {editingCandidate.roleRequisition}
                </p>
              </div>
              <button
                onClick={() => setEditingCandidate(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateStageMutation.mutate({
                  id: editingCandidate.id,
                  input: {
                    stage: fd.get("stage") as RecruiterStage,
                    assessmentScore: Number(fd.get("assessmentScore")),
                    notes: String(fd.get("notes") || ""),
                  },
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Hiring Stage *</label>
                <select
                  name="stage"
                  defaultValue={editingCandidate.stage}
                  className={cn(inputClass, "mt-1")}
                >
                  {RECRUITER_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink">Assessment Score (0 - 100)</label>
                <input
                  type="number"
                  name="assessmentScore"
                  min={0}
                  max={100}
                  defaultValue={editingCandidate.assessmentScore}
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">Recruiter Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingCandidate.notes}
                  className={cn(inputClass, "mt-1 resize-none")}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button variant="secondary" type="button" onClick={() => setEditingCandidate(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStageMutation.isPending}>
                  {updateStageMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
