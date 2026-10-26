"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  Handshake,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  MENTOR_AVAILABILITY,
  MENTOR_TYPES,
  MentorItem,
  MentorNetworkOverview,
  type AssignMentorInput,
  type InviteMentorInput,
  type LogSessionInput,
  type MentorAvailability,
  type MentorType,
} from "@/lib/api/mentor-network-schemas";
import { IncubationPipelineOverview } from "@/lib/api/incubation-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
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

const TYPE_TONES: Record<MentorType, "brand" | "teal" | "amber" | "rose" | "sky"> = {
  "Industry Founder": "brand",
  "Alumni Leader": "teal",
  "Faculty Specialist": "sky",
  "Investor / VC": "amber",
  "Legal & IP Expert": "rose",
};

const COMMON_EXPERTISE_TAGS = [
  "AgriTech",
  "HealthTech",
  "CleanTech & IoT",
  "AI & DeepTech",
  "Embedded Systems",
  "Full Stack & Cloud",
  "Fundraising & Pitching",
  "Patent & IP Strategy",
  "Product Market Fit",
  "Go-To-Market",
  "B2B SaaS",
  "Hardware Prototyping",
];

export function MentorNetworkModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [availFilter, setAvailFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [assigningMentor, setAssigningMentor] = useState<MentorItem | null>(null);
  const [loggingSessionMentor, setLoggingSessionMentor] = useState<MentorItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Queries
  const query = useQuery({
    queryKey: ["incubation-mentors"],
    queryFn: () => apiFetch("/api/v1/incubation/mentors", MentorNetworkOverview),
  });

  const pipelineQuery = useQuery({
    queryKey: ["incubation-pipeline"],
    queryFn: () => apiFetch("/api/v1/incubation-pipeline", IncubationPipelineOverview),
  });

  // Mutation: Invite Mentor
  const inviteMutation = useMutation({
    mutationFn: (body: InviteMentorInput) =>
      apiFetch("/api/v1/incubation/mentors", MentorItem, {
        method: "POST",
        body,
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      setIsInviteOpen(false);
      showToast(`Invited ${m.name} to the Mentor Network!`);
    },
  });

  // Mutation: Assign Mentor to Venture
  const assignMutation = useMutation({
    mutationFn: ({ mentorId, input }: { mentorId: string; input: AssignMentorInput }) =>
      apiFetch(`/api/v1/incubation/mentors/${encodeURIComponent(mentorId)}/assign`, MentorItem, {
        method: "POST",
        body: input,
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      setAssigningMentor(null);
      showToast(`Assigned ${m.name} to venture!`);
    },
  });

  // Mutation: Unassign Mentor from Venture
  const unassignMutation = useMutation({
    mutationFn: ({ mentorId, ventureId }: { mentorId: string; ventureId: string }) =>
      apiFetch(`/api/v1/incubation/mentors/${encodeURIComponent(mentorId)}/unassign`, MentorItem, {
        method: "POST",
        body: { ventureId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      showToast("Mentor unassigned from venture.");
    },
  });

  // Mutation: Log Session
  const sessionMutation = useMutation({
    mutationFn: ({ mentorId, input }: { mentorId: string; input: LogSessionInput }) =>
      apiFetch(`/api/v1/incubation/mentors/${encodeURIComponent(mentorId)}/session`, MentorItem, {
        method: "POST",
        body: input,
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      setLoggingSessionMentor(null);
      showToast(`Logged session for ${m.name}! Total: ${m.sessionsCompleted}`);
    },
  });

  // Mutation: Toggle Availability
  const availabilityMutation = useMutation({
    mutationFn: ({ mentorId, availability }: { mentorId: string; availability: MentorAvailability }) =>
      apiFetch(`/api/v1/incubation/mentors/${encodeURIComponent(mentorId)}`, MentorItem, {
        method: "PATCH",
        body: { availability },
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      showToast(`${m.name} status updated to ${m.availability}.`);
    },
  });

  // Mutation: Delete Mentor
  const deleteMutation = useMutation({
    mutationFn: (mentorId: string) =>
      apiFetch(`/api/v1/incubation/mentors/${encodeURIComponent(mentorId)}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incubation-mentors"] });
      showToast("Mentor removed from network.");
    },
  });

  const filteredMentors = useMemo(() => {
    if (!query.data?.mentors) return [];
    return query.data.mentors.filter((m) => {
      const matchesType = typeFilter === "All" || m.type === typeFilter;
      const matchesAvail = availFilter === "All" || m.availability === availFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q) ||
        m.expertise.some((e) => e.toLowerCase().includes(q)) ||
        m.assignedVentures.some((v) => v.ventureName.toLowerCase().includes(q));
      return matchesType && matchesAvail && matchesSearch;
    });
  }, [query.data?.mentors, typeFilter, availFilter, search]);

  const handleExportCsv = () => {
    if (!filteredMentors.length) return;
    const headers = [
      "Mentor Name",
      "Designation",
      "Organization",
      "Category",
      "Expertise",
      "Email",
      "Phone",
      "Availability",
      "Active Ventures Assigned",
      "Sessions Completed",
      "Rating",
    ];
    const rows = filteredMentors.map((m) => [
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.designation.replace(/"/g, '""')}"`,
      `"${m.company.replace(/"/g, '""')}"`,
      `"${m.type}"`,
      `"${m.expertise.join(", ")}"`,
      `"${m.email}"`,
      `"${m.phone}"`,
      `"${m.availability}"`,
      `"${m.assignedVentures.map((v) => v.ventureName).join(", ")}"`,
      m.sessionsCompleted,
      m.rating ?? "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `mentor-network-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (query.isLoading) return <TemplateSkeleton />;
  if (query.error || !query.data) {
    return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const {
    totalMentors,
    availableCount,
    activeAssignmentsCount,
    totalSessionsConducted,
    averageRating,
  } = query.data;

  const availableVentures = pipelineQuery.data?.ventures ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-surface shadow-xl">
          <Sparkles className="size-4 text-gold shrink-0" />
          <span>{toast}</span>
        </div>
      ) : null}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Total Mentors</span>
            <Users className="size-3.5 sm:size-4 text-brand" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{totalMentors}</p>
          <span className="text-[10px] sm:text-xs text-ink-3">Empanelled advisors</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Available Now</span>
            <UserCheck className="size-3.5 sm:size-4 text-teal" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{availableCount}</p>
          <span className="text-[10px] sm:text-xs text-teal font-medium">Ready for new ventures</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Active Pairings</span>
            <Handshake className="size-3.5 sm:size-4 text-sky" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{activeAssignmentsCount}</p>
          <span className="text-[10px] sm:text-xs text-ink-3">Ventures being guided</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Sessions Logged</span>
            <Calendar className="size-3.5 sm:size-4 text-amber" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{totalSessionsConducted}</p>
          <span className="text-[10px] sm:text-xs text-ink-3">1:1 advisory meetings</span>
        </Card>

        <Card className="col-span-2 sm:col-span-1 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Mentor Rating</span>
            <Star className="size-3.5 sm:size-4 text-gold fill-gold" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">★ {averageRating ?? "—"}</p>
          <span className="text-[10px] sm:text-xs text-ink-3">Founder satisfaction score</span>
        </Card>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={cn(inputClass, "h-9 w-full sm:w-44 text-xs font-medium")}
          >
            <option value="All">All Categories</option>
            {MENTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Availability Filter */}
          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            className={cn(inputClass, "h-9 w-full sm:w-36 text-xs")}
          >
            <option value="All">All Availability</option>
            {MENTOR_AVAILABILITY.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative w-full sm:w-56 md:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-ink-3" />
            <input
              type="text"
              placeholder="Search mentors, company, skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "h-9 pl-9 pr-8 text-xs w-full")}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-ink-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "grid" ? "bg-surface-2 text-ink shadow-xs" : "text-ink-3 hover:text-ink"
              )}
            >
              <Users className="size-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "table" ? "bg-surface-2 text-ink shadow-xs" : "text-ink-3 hover:text-ink"
              )}
            >
              <Briefcase className="size-3.5" /> Table
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportCsv} className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs">
              <Download className="size-3.5" /> <span className="hidden sm:inline">Export</span> CSV
            </Button>

            <Button onClick={() => setIsInviteOpen(true)} className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs">
              <UserPlus className="size-3.5" /> Invite Mentor
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {filteredMentors.length === 0 ? (
        <EmptyState
          title="No mentors found"
          body="Try adjusting your category or availability filter, or invite a new mentor into the cell."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setTypeFilter("All");
                setAvailFilter("All");
                setSearch("");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        /* RESPONSIVE MENTOR CARD GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMentors.map((m) => (
            <Card
              key={m.id}
              className="flex flex-col justify-between p-4 sm:p-5 transition hover:border-line-2 hover:shadow-md"
            >
              <div>
                {/* Header: Type Badge, Availability, Rating */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-line">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={TYPE_TONES[m.type] ?? "brand"} className="text-[10px]">
                      {m.type}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        m.availability === "Available"
                          ? "bg-teal-soft text-teal"
                          : m.availability === "Busy"
                          ? "bg-amber-soft text-amber"
                          : "bg-surface-3 text-ink-3"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          m.availability === "Available" ? "bg-teal" : "bg-amber"
                        )}
                      />
                      {m.availability}
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-xs font-bold text-ink shrink-0">
                    <Star className="size-3.5 text-gold fill-gold" /> {m.rating ?? "—"}
                  </span>
                </div>

                {/* Mentor Details */}
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-ink">{m.name}</h4>
                  <p className="text-xs text-ink-2 font-medium">{m.designation}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-3">
                    <Building2 className="size-3 shrink-0" />
                    <span>{m.company}</span>
                  </p>
                </div>

                {/* Expertise Chips */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {m.expertise.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-2 border border-line"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Assigned Ventures Strip */}
                <div className="mt-3.5 rounded-lg bg-surface-2/70 p-2.5 border border-line">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                      Assigned Ventures ({m.assignedVentures.length})
                    </span>
                    <button
                      onClick={() => setAssigningMentor(m)}
                      className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="size-3" /> Pair Venture
                    </button>
                  </div>

                  {m.assignedVentures.length === 0 ? (
                    <p className="text-[11px] text-ink-3 italic">No ventures currently assigned</p>
                  ) : (
                    <div className="space-y-1.5">
                      {m.assignedVentures.map((v) => (
                        <div
                          key={v.ventureId}
                          className="flex items-center justify-between rounded bg-surface px-2 py-1 text-[11px] shadow-xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Rocket className="size-3 text-brand shrink-0" />
                            <span className="font-medium text-ink truncate">{v.ventureName}</span>
                            <span className="rounded bg-surface-2 px-1 text-[9px] text-ink-3">
                              {v.stage}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              unassignMutation.mutate({ mentorId: m.id, ventureId: v.ventureId })
                            }
                            className="text-ink-3 hover:text-rose p-0.5 ml-1 transition"
                            title="Unassign venture"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contact Info & Stats */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-3 pt-2 border-t border-line">
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{m.email}</span>
                  </div>
                  <div className="flex items-center gap-1 truncate justify-end">
                    <Calendar className="size-3 shrink-0 text-brand" />
                    <span>{m.sessionsCompleted} sessions logged</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                {/* Availability quick switch */}
                <select
                  value={m.availability}
                  onChange={(e) =>
                    availabilityMutation.mutate({
                      mentorId: m.id,
                      availability: e.target.value as MentorAvailability,
                    })
                  }
                  className="h-7 rounded border border-line bg-surface px-1.5 text-[10px] font-medium text-ink hover:bg-surface-2"
                >
                  {MENTOR_AVAILABILITY.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    onClick={() => setLoggingSessionMentor(m)}
                    className="h-7 px-2 text-[10px] gap-1"
                  >
                    <Clock className="size-3" /> Log Session
                  </Button>

                  {m.linkedinUrl && (
                    <a
                      href={m.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1 text-ink-3 hover:text-brand transition"
                      title="LinkedIn Profile"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.name} from the mentor roster?`)) {
                        deleteMutation.mutate(m.id);
                      }
                    }}
                    className="rounded p-1 text-ink-3 hover:bg-rose-soft hover:text-rose transition"
                    title="Delete mentor"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-ink-3">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mentor</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold">Expertise Domains</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assigned Ventures</th>
                  <th className="px-4 py-3 font-semibold">Sessions</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredMentors.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2/40 transition">
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-bold text-ink truncate">{m.name}</p>
                      <p className="text-[11px] text-ink-3 truncate">{m.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={TYPE_TONES[m.type] ?? "brand"}>{m.type}</Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="font-medium text-ink truncate">{m.designation}</p>
                      <p className="text-[11px] text-ink-3 truncate">{m.company}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {m.expertise.slice(0, 2).map((t) => (
                          <span key={t} className="rounded bg-surface-2 px-1 text-[9px] text-ink-2">
                            {t}
                          </span>
                        ))}
                        {m.expertise.length > 2 && (
                          <span className="text-[9px] text-ink-3">+{m.expertise.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={m.availability}
                        onChange={(e) =>
                          availabilityMutation.mutate({
                            mentorId: m.id,
                            availability: e.target.value as MentorAvailability,
                          })
                        }
                        className="h-7 rounded border border-line bg-surface px-1.5 text-xs font-semibold text-ink"
                      >
                        {MENTOR_AVAILABILITY.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {m.assignedVentures.length > 0 ? (
                        <div className="space-y-0.5">
                          {m.assignedVentures.map((v) => (
                            <span key={v.ventureId} className="block text-[11px] font-medium text-ink truncate">
                              • {v.ventureName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-3 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{m.sessionsCompleted}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-amber">★ {m.rating ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => setAssigningMentor(m)}
                          className="h-7 px-2 text-xs"
                        >
                          Pair
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setLoggingSessionMentor(m)}
                          className="h-7 px-2 text-xs"
                        >
                          Log
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.name}?`)) {
                              deleteMutation.mutate(m.id);
                            }
                          }}
                          className="rounded p-1 text-ink-3 hover:text-rose transition"
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

      {/* MODAL 1: INVITE MENTOR */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-lg p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Invite New Mentor</h3>
                <p className="text-[11px] sm:text-xs text-ink-3">Empanel an industry founder, alumnus, or faculty expert</p>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="rounded p-1 text-ink-3 hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const expertiseStr = String(fd.get("expertise") || "");
                const expertise = expertiseStr
                  ? expertiseStr.split(",").map((s) => s.trim()).filter(Boolean)
                  : ["Startup Guidance"];

                inviteMutation.mutate({
                  name: String(fd.get("name")),
                  designation: String(fd.get("designation")),
                  company: String(fd.get("company")),
                  type: (fd.get("type") as MentorType) || "Industry Founder",
                  expertise,
                  email: String(fd.get("email")),
                  phone: String(fd.get("phone") || ""),
                  linkedinUrl: String(fd.get("linkedinUrl") || ""),
                  availability: (fd.get("availability") as MentorAvailability) || "Available",
                });
              }}
              className="space-y-3.5 text-xs overflow-y-auto pr-1"
            >
              <div>
                <label className="block font-semibold text-ink">Mentor Full Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Dr. Anandhi Subramanian"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Designation / Role *</label>
                  <input
                    name="designation"
                    required
                    placeholder="VP Product / Founder & CEO"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Organization / Company *</label>
                  <input
                    name="company"
                    required
                    placeholder="Zoho, Google, IIT-M, etc."
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Category *</label>
                  <select name="type" className={cn(inputClass, "mt-1")}>
                    {MENTOR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Initial Availability</label>
                  <select name="availability" className={cn(inputClass, "mt-1")}>
                    {MENTOR_AVAILABILITY.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">Expertise & Domains (comma separated) *</label>
                <input
                  name="expertise"
                  required
                  placeholder="AI/ML, HealthTech, Patent Filing, Scale"
                  className={cn(inputClass, "mt-1")}
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[10px] text-ink-3">Quick suggestions:</span>
                  {COMMON_EXPERTISE_TAGS.slice(0, 5).map((tag) => (
                    <span key={tag} className="text-[10px] text-brand hover:underline cursor-pointer">
                      {tag},
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="mentor@company.com"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Phone / WhatsApp</label>
                  <input
                    name="phone"
                    placeholder="+91 98401 23456"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">LinkedIn Profile URL</label>
                <input
                  name="linkedinUrl"
                  placeholder="https://linkedin.com/in/..."
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-line pt-3.5 shrink-0">
                <Button variant="secondary" type="button" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? <Spinner className="size-4" /> : "Invite to Cell"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: PAIR MENTOR TO VENTURE */}
      {assigningMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Pair Mentor with Venture</h3>
                <p className="text-[11px] sm:text-xs text-ink-3">
                  Assigning: <span className="font-semibold text-ink">{assigningMentor.name}</span>
                </p>
              </div>
              <button onClick={() => setAssigningMentor(null)} className="rounded p-1 text-ink-3 hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const selectedVentureId = String(fd.get("ventureId"));
                const targetVenture = availableVentures.find((v) => v.id === selectedVentureId);

                assignMutation.mutate({
                  mentorId: assigningMentor.id,
                  input: {
                    ventureId: selectedVentureId,
                    ventureName: targetVenture?.name || "Selected Venture",
                    stage: targetVenture?.stage || "Idea",
                  },
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Select Incubation Venture *</label>
                {availableVentures.length === 0 ? (
                  <p className="mt-1 text-xs text-amber">
                    No active ventures found in the pipeline. Please add a venture in Incubation Pipeline first.
                  </p>
                ) : (
                  <select name="ventureId" required className={cn(inputClass, "mt-1")}>
                    {availableVentures.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.stage} · {v.domain})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-lg bg-surface-2 p-3 text-[11px] text-ink-3">
                <p className="font-medium text-ink">Mentor Specializations:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {assigningMentor.expertise.map((e) => (
                    <span key={e} className="rounded bg-surface px-1.5 py-0.5 text-[10px]">
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-3.5">
                <Button variant="secondary" type="button" onClick={() => setAssigningMentor(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignMutation.isPending || availableVentures.length === 0}
                >
                  {assignMutation.isPending ? <Spinner className="size-4" /> : "Confirm Pairing"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: LOG MENTORSHIP SESSION */}
      {loggingSessionMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Log 1:1 Advisory Session</h3>
                <p className="text-[11px] sm:text-xs text-ink-3">
                  Advisor: <span className="font-semibold text-ink">{loggingSessionMentor.name}</span>
                </p>
              </div>
              <button
                onClick={() => setLoggingSessionMentor(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);

                sessionMutation.mutate({
                  mentorId: loggingSessionMentor.id,
                  input: {
                    ventureName: String(fd.get("ventureName")),
                    topic: String(fd.get("topic")),
                    notes: String(fd.get("notes")),
                    durationMinutes: Number(fd.get("duration") || 60),
                  },
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Venture Advised *</label>
                <select name="ventureName" required className={cn(inputClass, "mt-1")}>
                  {loggingSessionMentor.assignedVentures.map((v) => (
                    <option key={v.ventureId} value={v.ventureName}>
                      {v.ventureName} ({v.stage})
                    </option>
                  ))}
                  {loggingSessionMentor.assignedVentures.length === 0 &&
                    availableVentures.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink">Session Topic / Milestone Reviewed *</label>
                <input
                  name="topic"
                  required
                  placeholder="e.g. Unit Economics & Customer Discovery Rehearsal"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">Duration (minutes)</label>
                <select name="duration" defaultValue="60" className={cn(inputClass, "mt-1")}>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes (1 hour)</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes (2 hours)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink">Action Items & Advisory Feedback *</label>
                <textarea
                  name="notes"
                  rows={3}
                  required
                  placeholder="Key guidance provided, customer validation homework, next checkpoint date..."
                  className={cn(inputClass, "mt-1 py-2")}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-3.5">
                <Button variant="secondary" type="button" onClick={() => setLoggingSessionMentor(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sessionMutation.isPending}>
                  {sessionMutation.isPending ? <Spinner className="size-4" /> : "Log Session"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
