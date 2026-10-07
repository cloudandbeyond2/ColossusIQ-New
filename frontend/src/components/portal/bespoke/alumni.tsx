"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  AlumniMemberItem,
  AlumniNetworkOverview,
  CreateAlumniBody,
  MENTORSHIP_TOPICS,
  MentorshipRequestItem,
  PREFERRED_MODES,
  RequestMentorshipBody,
} from "@/lib/api/alumni-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Progress,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { Modal } from "./assignments-shared";

const ALUMNI_KEY = ["alumni-network"] as const;

const TOPIC_TONES: Record<string, "brand" | "teal" | "amber" | "sky" | "neutral"> = {
  "Placement Prep": "teal",
  "Mock Interviews & System Design": "brand",
  "Resume Review & Startups": "amber",
  "ML & Analytics Career Guidance": "sky",
  "Core Engineering & Higher Studies": "neutral",
};

export function AlumniModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ALUMNI_KEY,
    queryFn: () => apiFetch("/api/v1/alumni", AlumniNetworkOverview),
  });

  const [activeTab, setActiveTab] = useState<"directory" | "requests">("directory");
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("All");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Modals state
  const [requestModalMentor, setRequestModalMentor] = useState<AlumniMemberItem | null>(null);
  const [showAddMentorModal, setShowAddMentorModal] = useState(false);
  const [detailMentor, setDetailMentor] = useState<AlumniMemberItem | null>(null);

  // Mentorship request form state
  const [requestTopic, setRequestTopic] = useState<string>("Placement Prep");
  const [requestMode, setRequestMode] = useState<string>("Virtual Call");
  const [requestMessage, setRequestMessage] = useState<string>("");

  // Mutations
  const requestMutation = useMutation({
    mutationFn: (body: RequestMentorshipBody) =>
      apiFetch("/api/v1/alumni/request", { ok: true }, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ALUMNI_KEY });
      setRequestModalMentor(null);
      setRequestMessage("");
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiFetch(`/api/v1/alumni/requests/${requestId}`, { ok: true }, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ALUMNI_KEY });
    },
  });

  const addMentorMutation = useMutation({
    mutationFn: (body: CreateAlumniBody) =>
      apiFetch("/api/v1/alumni", { ok: true }, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ALUMNI_KEY });
      setShowAddMentorModal(false);
    },
  });

  const overview = q.data;

  // Filtered alumni members list
  const filteredMembers = useMemo(() => {
    if (!overview) return [];
    let list = [...overview.items];

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          m.company.toLowerCase().includes(s) ||
          m.currentPosition.toLowerCase().includes(s) ||
          m.skills.some((sk) => sk.toLowerCase().includes(s)) ||
          m.mentorshipTopics.some((t) => t.toLowerCase().includes(s))
      );
    }

    if (selectedTopic !== "All") {
      list = list.filter((m) => m.mentorshipTopics.includes(selectedTopic));
    }

    if (onlyAvailable) {
      list = list.filter((m) => m.isAvailable && m.activeMentees < m.maxMentees);
    }

    return list;
  }, [overview, search, selectedTopic, onlyAvailable]);

  if (q.isLoading) return <TemplateSkeleton />;
  if (q.isError || !overview) {
    return (
      <EmptyState
        title="Unable to load Alumni Network"
        body={q.error instanceof ApiError ? q.error.message : "Please check your network and try again."}
        action={<Button onClick={() => void q.refetch()}>Retry</Button>}
      />
    );
  }

  const { items, requests, summary, canManage } = overview;
  const isStudent = role === "student";

  return (
    <div className="space-y-6">
      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Alumni Mentors</span>
            <Users className="size-4 text-brand" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink">{summary.totalAlumni}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">Verified alumni directory</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Available Now</span>
            <UserCheck className="size-4 text-teal" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-teal">{summary.availableMentors}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">Taking new mentees</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">{isStudent ? "My Requests" : "Active Requests"}</span>
            <MessageSquare className="size-4 text-sky" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-sky">{summary.activeRequests}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">{summary.acceptedRequests} accepted</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Top Employers</span>
            <Building2 className="size-4 text-amber" />
          </div>
          <p className="mt-1 truncate font-serif text-sm font-bold text-ink">
            {summary.topCompanies.slice(0, 3).join(", ")}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-3">Hiring partner alumni</p>
        </Card>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div role="tablist" className="flex items-center gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "directory"}
            onClick={() => setActiveTab("directory")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "directory"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <span>Alumni Mentors</span>
            <span className={cn("rounded-full px-1.5 text-[10px]", activeTab === "directory" ? "bg-white/20" : "bg-surface-2 text-ink-3")}>
              {items.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "requests"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <span>{isStudent ? "My Mentorship Requests" : "Mentorship Requests"}</span>
            <span className={cn("rounded-full px-1.5 text-[10px]", activeTab === "requests" ? "bg-white/20" : "bg-surface-2 text-ink-3")}>
              {requests.length}
            </span>
          </button>
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setShowAddMentorModal(true)} className="text-xs">
            <Plus className="mr-1 size-3.5" />
            Add Alumni Mentor
          </Button>
        )}
      </div>

      {/* ── Active Tab Content ── */}
      {activeTab === "requests" ? (
        <RequestsView
          requests={requests}
          onCancel={(id) => cancelRequestMutation.mutate(id)}
          cancelling={cancelRequestMutation.isPending}
          onRequestNew={() => {
            setActiveTab("directory");
            if (items[0]) {
              setRequestModalMentor(items[0]);
              setRequestTopic(items[0].mentorshipTopics[0] || "Placement Prep");
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* ── Action and Filter Bar (matches Screenshot) ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search alumni network..."
                  className={cn(inputClass, "pl-9 text-xs")}
                />
              </div>

              {/* Topic Filter Dropdown */}
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="All">All Topics</option>
                {MENTORSHIP_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>

              <label className="flex cursor-pointer items-center gap-1.5 select-none text-xs text-ink-2 hover:text-ink">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="size-3.5 rounded border-line text-brand focus:ring-brand"
                />
                <span>Available only</span>
              </label>
            </div>

            {/* Primary Action Button */}
            <Button
              onClick={() => {
                if (items[0]) {
                  setRequestModalMentor(items[0]);
                  setRequestTopic(items[0].mentorshipTopics[0] || "Placement Prep");
                }
              }}
              className="text-xs"
            >
              Request mentorship
            </Button>
          </div>

          {/* ── Alumni Directory Table ── */}
          {filteredMembers.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No alumni mentors found"
                body="Try adjusting your search query or topic filter."
                action={
                  <Button
                    onClick={() => {
                      setSearch("");
                      setSelectedTopic("All");
                      setOnlyAvailable(false);
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden border-line">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                    <tr>
                      <th className="py-3 pl-4 pr-3">Alumnus / Mentor</th>
                      <th className="px-3 py-3">Batch</th>
                      <th className="px-3 py-3">Current Position</th>
                      <th className="px-3 py-3">Company</th>
                      <th className="px-3 py-3">Can Mentor In</th>
                      <th className="px-3 py-3">Match Score</th>
                      <th className="py-3 pl-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredMembers.map((m) => {
                      const topic = m.mentorshipTopics[0] || "Placement Prep";
                      const tone = TOPIC_TONES[topic] || "brand";

                      return (
                        <tr key={m.id} className="transition-colors hover:bg-surface-2/40">
                          {/* Alumnus Name & Avatar */}
                          <td className="py-3.5 pl-4 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 font-bold text-brand ring-1 ring-brand/20">
                                {m.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setDetailMentor(m)}
                                  className="text-left font-bold text-ink hover:text-brand hover:underline"
                                >
                                  {m.name}
                                </button>
                                <div className="flex items-center gap-2 text-[11px] text-ink-3">
                                  <span>{m.location || "India"}</span>
                                  {m.linkedinUrl && (
                                    <a
                                      href={m.linkedinUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-brand hover:underline inline-flex items-center gap-0.5"
                                      aria-label={`Profile for ${m.name}`}
                                    >
                                      <span>LinkedIn</span>
                                      <ExternalLink className="size-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Batch */}
                          <td className="px-3 py-3.5 text-ink-2 font-medium">{m.batch}</td>

                          {/* Position */}
                          <td className="px-3 py-3.5 text-ink">{m.currentPosition}</td>

                          {/* Company */}
                          <td className="px-3 py-3.5 font-semibold text-ink">{m.company}</td>

                          {/* Mentorship Topic Badge */}
                          <td className="px-3 py-3.5">
                            <Badge tone={tone} className="text-[11px] font-medium whitespace-nowrap">
                              {topic}
                            </Badge>
                          </td>

                          {/* Match Score */}
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-24">
                                <Progress value={m.matchScore} tone="teal" />
                              </div>
                              <span className="font-semibold tabular-nums text-teal text-[11px]">
                                {m.matchScore}%
                              </span>
                            </div>
                          </td>

                          {/* Row Action */}
                          <td className="py-3.5 pl-3 pr-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRequestModalMentor(m);
                                setRequestTopic(m.mentorshipTopics[0] || "Placement Prep");
                              }}
                              className="text-xs"
                            >
                              Request
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="border-t border-line/60 bg-surface-2/20 px-4 py-2.5 text-xs text-ink-3">
                Showing {filteredMembers.length} of {items.length} mentors
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Request Mentorship Dialog ── */}
      {requestModalMentor && (
        <Modal
          title={`Request Mentorship with ${requestModalMentor.name}`}
          onClose={() => setRequestModalMentor(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
              <p className="font-semibold text-ink">
                {requestModalMentor.currentPosition} at {requestModalMentor.company}
              </p>
              <p className="text-ink-3">
                {requestModalMentor.batch} • {requestModalMentor.degree}
              </p>
            </div>

            {requestMutation.error && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                {requestMutation.error instanceof ApiError ? requestMutation.error.message : "Error submitting request"}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink">Mentorship Topic</label>
              <select
                value={requestTopic}
                onChange={(e) => setRequestTopic(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {requestModalMentor.mentorshipTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {MENTORSHIP_TOPICS.filter((t) => !requestModalMentor.mentorshipTopics.includes(t)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Preferred Mode</label>
              <select
                value={requestMode}
                onChange={(e) => setRequestMode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {PREFERRED_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Specific Questions or Goals</label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
                placeholder="Share your goals (e.g. preparing for technical interview, reviewing resume, or transitioning to data science)…"
                className={cn(inputClass, "mt-1 text-xs resize-none")}
              />
            </div>

            <div className="rounded-lg border border-line bg-surface p-2.5 text-[11px] text-ink-3">
              ✓ Once submitted, your request is forwarded to the mentor and saved in your institution's alumni mentorship pipeline.
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="outline" size="sm" onClick={() => setRequestModalMentor(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  requestMutation.mutate({
                    alumniId: requestModalMentor.id,
                    topic: requestTopic,
                    preferredMode: requestMode as any,
                    message: requestMessage,
                  })
                }
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending ? <Spinner className="size-4" /> : "Send Request"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Mentor Profile Details Modal ── */}
      {detailMentor && (
        <Modal title={`${detailMentor.name} — Profile`} onClose={() => setDetailMentor(null)} wide>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <h4 className="text-base font-bold text-ink">{detailMentor.name}</h4>
                <p className="text-xs font-medium text-brand">
                  {detailMentor.currentPosition} at {detailMentor.company}
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  {detailMentor.batch} • {detailMentor.degree} ({detailMentor.department})
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  const m = detailMentor;
                  setDetailMentor(null);
                  setRequestModalMentor(m);
                  setRequestTopic(m.mentorshipTopics[0] || "Placement Prep");
                }}
              >
                Request Mentorship
              </Button>
            </div>

            {detailMentor.bio && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-ink-3">About</h5>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{detailMentor.bio}</p>
              </div>
            )}

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-ink-3">Mentorship Offerings</h5>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {detailMentor.mentorshipTopics.map((t) => (
                  <Badge key={t} tone={TOPIC_TONES[t] || "brand"}>
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-ink-3">Core Expertise & Skills</h5>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {detailMentor.skills.map((s) => (
                  <span key={s} className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 ring-1 ring-line">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-line pt-3">
              <Button variant="outline" size="sm" onClick={() => setDetailMentor(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Mentor Modal (for Staff/Placement/Incubation) ── */}
      {showAddMentorModal && (
        <AddMentorDialog
          onClose={() => setShowAddMentorModal(false)}
          onSubmit={(data) => addMentorMutation.mutate(data)}
          isSubmitting={addMentorMutation.isPending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Requests View Component
// ─────────────────────────────────────────────────────────────────────────────

function RequestsView({
  requests,
  onCancel,
  cancelling,
  onRequestNew,
}: {
  requests: MentorshipRequestItem[];
  onCancel: (id: string) => void;
  cancelling: boolean;
  onRequestNew: () => void;
}) {
  if (requests.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No mentorship requests yet"
          body="Explore verified alumni mentors in the directory and request a 1-on-1 session or resume guidance."
          action={<Button onClick={onRequestNew}>Browse Alumni Mentors</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Mentorship Requests Pipeline ({requests.length})</h3>
        <span className="text-xs text-ink-3">Status updates automatically with mentor response</span>
      </div>

      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} className="p-4 border-line">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{r.alumniName || "Alumni Mentor"}</span>
                  {r.alumniCompany && <span className="text-xs text-ink-3">({r.alumniCompany})</span>}
                  <Badge
                    tone={
                      r.status === "Accepted"
                        ? "teal"
                        : r.status === "Declined"
                        ? "rose"
                        : r.status === "Completed"
                        ? "sky"
                        : "amber"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                  <span>Topic: <b className="text-ink-2">{r.topic}</b></span>
                  <span>•</span>
                  <span>Mode: {r.preferredMode}</span>
                  <span>•</span>
                  <span>Requested: {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>

                {r.message && (
                  <p className="mt-2 text-xs italic text-ink-2 bg-surface-2/40 p-2 rounded-lg border border-line/60">
                    "{r.message}"
                  </p>
                )}

                {r.meetingLink && (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={r.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
                    >
                      <Video className="size-3.5" />
                      Join Scheduled Mentorship Session
                    </a>
                  </div>
                )}
              </div>

              {r.status === "Pending" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(r.id)}
                  disabled={cancelling}
                  className="text-xs text-rose hover:bg-rose-500/10 hover:text-rose-600"
                >
                  Cancel Request
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Mentor Dialog Component
// ─────────────────────────────────────────────────────────────────────────────

function AddMentorDialog({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (data: CreateAlumniBody) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [batch, setBatch] = useState("Batch 2022");
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [topics, setTopics] = useState<string[]>(["Placement Prep"]);
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");

  return (
    <Modal title="Register New Alumni Mentor" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            batch,
            currentPosition: position,
            company,
            mentorshipTopics: topics,
            skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
            bio,
            isAvailable: true,
            maxMentees: 5,
            degree: "B.E. Computer Science & Engineering",
            department: "Computer Science & Engineering",
            location: "India",
            linkedinUrl: "",
            email: "",
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-ink">Alumnus Full Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priyadarshini Sundaram"
            className={cn(inputClass, "mt-1 text-xs")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink">Batch</label>
            <input
              required
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="e.g. Batch 2022"
              className={cn(inputClass, "mt-1 text-xs")}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink">Company</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className={cn(inputClass, "mt-1 text-xs")}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink">Current Position</label>
          <input
            required
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
            className={cn(inputClass, "mt-1 text-xs")}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink">Core Mentorship Area</label>
          <select
            value={topics[0]}
            onChange={(e) => setTopics([e.target.value])}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {MENTORSHIP_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink">Skills (comma-separated)</label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. Python, Machine Learning, AWS, System Design"
            className={cn(inputClass, "mt-1 text-xs")}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink">Short Bio / Background</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="Brief bio about their career journey..."
            className={cn(inputClass, "mt-1 text-xs resize-none")}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="size-4" /> : "Save Alumni Mentor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
