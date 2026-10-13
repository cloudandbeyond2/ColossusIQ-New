"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Filter,
  Flag,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  ClubItem,
  ClubsOverview,
  CreateClubInput,
} from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  inputClass,
  Spinner,
} from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/utils";

const CATEGORIES = [
  "All",
  "Technical",
  "Cultural",
  "Social",
  "Innovation",
  "Arts",
  "Sports",
  "Academic",
] as const;

function categoryTone(cat: string): "brand" | "teal" | "gold" | "sky" | "rose" | "amber" {
  switch (cat) {
    case "Technical":
      return "brand";
    case "Cultural":
      return "teal";
    case "Innovation":
      return "gold";
    case "Social":
      return "sky";
    case "Sports":
      return "amber";
    default:
      return "brand";
  }
}

export function ClubsModule({ role }: { role?: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selectedClub, setSelectedClub] = useState<ClubItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["clubs"],
    queryFn: () => apiFetch("/api/v1/clubs", ClubsOverview),
  });

  const isPrivileged = role === "institution" || role === "admin";

  const joinMutation = useMutation({
    mutationFn: async (clubId: string) => {
      return apiFetch(`/api/v1/clubs/${clubId}/join`, ClubItem.pick({ isJoined: true, membersCount: true }), {
        method: "POST",
      });
    },
    onSuccess: (res, clubId) => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      if (selectedClub && selectedClub.id === clubId) {
        setSelectedClub((prev) => (prev ? { ...prev, isJoined: res.isJoined, membersCount: res.membersCount } : null));
      }
      setToast(res.isJoined ? "You have successfully joined the club!" : "You have left the club.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (clubId: string) => {
      return apiFetch(`/api/v1/clubs/${clubId}`, ClubsOverview.pick({ collegeId: true }).partial(), {
        method: "DELETE",
      });
    },
    onSuccess: (_, clubId) => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      if (selectedClub?.id === clubId) setSelectedClub(null);
      setToast("Club disbanded successfully.");
    },
  });

  const filteredClubs = useMemo(() => {
    if (!query.data?.clubs) return [];
    return query.data.clubs.filter((club) => {
      const matchesCategory = category === "All" || club.category === category;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        club.name.toLowerCase().includes(q) ||
        club.lead.toLowerCase().includes(q) ||
        club.facultyAdvisor.toLowerCase().includes(q) ||
        club.meetingSchedule.toLowerCase().includes(q) ||
        club.venue.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [query.data?.clubs, category, search]);

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isLoading || !query.data) return <TemplateSkeleton />;

  const { kpis } = query.data;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/20 bg-teal-soft px-4 py-3 text-sm text-teal" role="status">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            {toast}
          </span>
          <button onClick={() => setToast(null)} className="rounded p-1 hover:bg-teal/10" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Total Clubs</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Flag className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.totalClubs}</p>
          <p className="mt-1 text-xs text-ink-3">Active campus organizations</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Total Members</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-soft text-teal">
              <Users className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{formatNumber(kpis.totalMembers)}</p>
          <p className="mt-1 text-xs text-ink-3">Students actively participating</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Active Categories</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-gold-soft text-gold">
              <Filter className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.activeCategories}</p>
          <p className="mt-1 text-xs text-ink-3">Technical, cultural & social</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Upcoming Activities</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-soft text-sky">
              <Calendar className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.upcomingActivities}</p>
          <p className="mt-1 text-xs text-ink-3">Events & meetups scheduled</p>
        </Card>
      </div>

      {/* Main List Container */}
      <Card>
        {/* Controls Header */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search clubs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-ink-3" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
                aria-label="Filter by category"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="size-4" /> Start a club
            </Button>
          </div>
        </div>

        {/* Clubs Table */}
        {filteredClubs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No clubs found"
              body={search ? "Try adjusting your search or category filter." : "Get started by creating your first student club."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/40 text-left text-xs uppercase tracking-wide text-ink-3">
                  <th scope="col" className="px-5 py-3 font-semibold">Club</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Members</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Student Lead</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Next Activity</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredClubs.map((club) => (
                  <tr
                    key={club.id}
                    onClick={() => setSelectedClub(club)}
                    className="cursor-pointer transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <span className="hover:text-brand hover:underline">{club.name}</span>
                        {club.isJoined ? (
                          <Badge tone="teal" className="text-[10px]">Member</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={categoryTone(club.category)}>{club.category}</Badge>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-ink">
                      {formatNumber(club.membersCount)}
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      {club.lead}
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      {club.meetingSchedule || "TBD"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClub(club);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
                      >
                        View <ArrowRight className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
          Showing {filteredClubs.length} of {query.data.clubs.length} clubs
        </div>
      </Card>

      {/* Start a Club Modal */}
      {isCreateOpen ? (
        <CreateClubModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(club) => {
            setIsCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["clubs"] });
            setToast(`"${club.name}" club has been successfully created!`);
          }}
        />
      ) : null}

      {/* Club Details Drawer */}
      {selectedClub ? (
        <ClubDetailModal
          club={selectedClub}
          isPrivileged={isPrivileged}
          isJoining={joinMutation.isPending}
          isDeleting={deleteMutation.isPending}
          onClose={() => setSelectedClub(null)}
          onToggleJoin={() => joinMutation.mutate(selectedClub.id)}
          onDelete={() => {
            if (confirm(`Are you sure you want to disband "${selectedClub.name}"?`)) {
              deleteMutation.mutate(selectedClub.id);
            }
          }}
          onUpdated={(updated) => {
            setSelectedClub(updated);
            qc.invalidateQueries({ queryKey: ["clubs"] });
          }}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── Create Club Modal ─────────────────────────────── */
function CreateClubModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (club: ClubItem) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CreateClubInput["category"]>("Technical");
  const [description, setDescription] = useState("");
  const [lead, setLead] = useState("");
  const [facultyAdvisor, setFacultyAdvisor] = useState("");
  const [meetingSchedule, setMeetingSchedule] = useState("");
  const [venue, setVenue] = useState("");
  const [membersCount, setMembersCount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: CreateClubInput) => {
      return apiFetch("/api/v1/clubs", ClubItem, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (data) => {
      onSuccess(data);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to create club.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter a club name.");
    if (!lead.trim()) return setError("Please enter the student lead name.");
    if (!meetingSchedule.trim()) return setError("Please specify meeting schedule / next activity.");

    setError(null);
    mutation.mutate({
      name,
      category,
      description,
      lead,
      facultyAdvisor: facultyAdvisor.trim() || "Faculty Coordinator",
      meetingSchedule,
      venue: venue.trim() || "Campus Center",
      membersCount: parseInt(membersCount, 10) || 10,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Start a Campus Club</h2>
            <p className="mt-1 text-xs text-ink-3">Register a new student club with activities and faculty guidance.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose/20 bg-rose-soft px-3 py-2 text-xs text-rose" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Club Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. AI Builders Club, Fine Arts Society"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputClass, "mt-1.5")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CreateClubInput["category"])}
                className={cn(inputClass, "mt-1.5")}
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Initial Members</label>
              <input
                type="number"
                min="1"
                max="5000"
                placeholder="e.g. 20"
                value={membersCount}
                onChange={(e) => setMembersCount(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Student Lead *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ananya Raman"
                value={lead}
                onChange={(e) => setLead(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Faculty Advisor</label>
              <input
                type="text"
                placeholder="e.g. Dr. Meena Raghavan"
                value={facultyAdvisor}
                onChange={(e) => setFacultyAdvisor(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Meeting Schedule *</label>
              <input
                type="text"
                required
                placeholder="e.g. Weekly contest — Sat"
                value={meetingSchedule}
                onChange={(e) => setMeetingSchedule(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Meeting Venue</label>
              <input
                type="text"
                placeholder="e.g. CSE Lab 2 / Block B"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Club Mission / About</label>
            <textarea
              rows={2}
              placeholder="What does this club do? Who should join?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, "mt-1.5 resize-none")}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Spinner className="mr-2 size-4" /> Creating…
                </>
              ) : (
                "Create Club"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Club Detail Modal ─────────────────────────────── */
function ClubDetailModal({
  club,
  isPrivileged,
  isJoining,
  isDeleting,
  onClose,
  onToggleJoin,
  onDelete,
  onUpdated,
}: {
  club: ClubItem;
  isPrivileged: boolean;
  isJoining: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onToggleJoin: () => void;
  onDelete: () => void;
  onUpdated: (club: ClubItem) => void;
}) {
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleInput, setScheduleInput] = useState(club.meetingSchedule);

  const scheduleMutation = useMutation({
    mutationFn: async (newSchedule: string) => {
      return apiFetch(`/api/v1/clubs/${club.id}`, ClubItem, {
        method: "PUT",
        body: { meetingSchedule: newSchedule },
      });
    },
    onSuccess: (updated) => {
      setIsEditingSchedule(false);
      onUpdated(updated);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={categoryTone(club.category)}>{club.category}</Badge>
              <Badge tone={club.status === "Active" ? "teal" : "amber"}>{club.status}</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-ink">{club.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {club.description ? (
          <p className="mt-3 text-sm text-ink-2">{club.description}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface-2/40 p-4">
          <div>
            <p className="text-xs font-medium text-ink-3">Student Lead</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <User className="size-3.5 text-brand" /> {club.lead}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Faculty Advisor</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles className="size-3.5 text-gold" /> {club.facultyAdvisor}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Current Members</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Users className="size-3.5 text-teal" /> {formatNumber(club.membersCount)} students
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Meeting Venue</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin className="size-3.5 text-rose" /> {club.venue || "Campus Center"}
            </p>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="mt-4 rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
              <Clock className="size-3.5 text-brand" /> Next Activity / Schedule
            </span>
            {isPrivileged && !isEditingSchedule ? (
              <button
                onClick={() => setIsEditingSchedule(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Change
              </button>
            ) : null}
          </div>

          {isEditingSchedule ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                className={cn(inputClass, "h-8 text-xs")}
                placeholder="e.g. Hackathon Kickoff — Fri 4 PM"
              />
              <Button
                size="sm"
                onClick={() => scheduleMutation.mutate(scheduleInput)}
                disabled={scheduleMutation.isPending}
              >
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsEditingSchedule(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-ink">
              {club.meetingSchedule || "No activity scheduled yet."}
            </p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          {isPrivileged ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" /> Disband Club
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <Button
              variant={club.isJoined ? "secondary" : "primary"}
              onClick={onToggleJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <Spinner className="mr-1.5 size-4" />
              ) : club.isJoined ? (
                "Leave Club"
              ) : (
                "Join Club"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
