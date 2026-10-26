"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  CreateSportInput,
  SportItem,
  SportsOverview,
} from "@/lib/api/schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  inputClass,
  Spinner,
} from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/utils";

const STATUS_FILTERS = ["All", "Trials open", "Active", "Off-season"] as const;

function statusTone(status: string): "teal" | "amber" | "sky" | "brand" {
  switch (status) {
    case "Trials open":
      return "teal";
    case "Active":
      return "sky";
    case "Off-season":
      return "amber";
    default:
      return "brand";
  }
}

export function SportsModule() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedSport, setSelectedSport] = useState<SportItem | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["sports"],
    queryFn: () => apiFetch("/api/v1/sports", SportsOverview),
  });

  // what this person may do is decided by the server
  const isPrivileged = query.data?.permissions.manage ?? false;

  const registerMutation = useMutation({
    mutationFn: async (sportId: string) => {
      return apiFetch(`/api/v1/sports/${sportId}/register`, SportItem.pick({ isRegistered: true, squadSize: true }), {
        method: "POST",
      });
    },
    onError: (err) => {
      setToast(err instanceof ApiError ? err.message : "Could not update your trial registration.");
    },
    onSuccess: (res, sportId) => {
      qc.invalidateQueries({ queryKey: ["sports"] });
      if (selectedSport && selectedSport.id === sportId) {
        setSelectedSport((prev) => (prev ? { ...prev, isRegistered: res.isRegistered, squadSize: res.squadSize } : null));
      }
      setToast(
        res.isRegistered
          ? "Registered for sport trials successfully! Your coach has been notified."
          : "Trial registration withdrawn.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sportId: string) => {
      return apiFetch(`/api/v1/sports/${sportId}`, SportsOverview.pick({ collegeId: true }).partial(), {
        method: "DELETE",
      });
    },
    onSuccess: (_, sportId) => {
      qc.invalidateQueries({ queryKey: ["sports"] });
      if (selectedSport?.id === sportId) setSelectedSport(null);
      setToast("Sport team record removed successfully.");
    },
  });

  const filteredSports = useMemo(() => {
    const list = query.data?.sports ?? [];
    return list.filter((s) => {
      const matchesStatus = statusFilter === "All" || s.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.sport.toLowerCase().includes(q) ||
        s.team.toLowerCase().includes(q) ||
        s.coach.toLowerCase().includes(q) ||
        s.captain.toLowerCase().includes(q) ||
        s.event.toLowerCase().includes(q) ||
        s.venue.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [query.data, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSports.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedSports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSports.slice(startIndex, startIndex + pageSize);
  }, [filteredSports, currentPage, pageSize]);

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isLoading || !query.data) return <TemplateSkeleton />;

  const { kpis } = query.data;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
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
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Total Teams</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Trophy className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.totalTeams}</p>
          <p className="mt-1 text-xs text-ink-3">Competitive collegiate squads</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Total Athletes</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-soft text-teal">
              <Users className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{formatNumber(kpis.totalAthletes)}</p>
          <p className="mt-1 text-xs text-ink-3">Players registered across teams</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Open Trials</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-gold-soft text-gold">
              <Sparkles className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.openTrials}</p>
          <p className="mt-1 text-xs text-ink-3">Sports actively recruiting</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Upcoming Meets</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-soft text-sky">
              <Calendar className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{kpis.upcomingMeets}</p>
          <p className="mt-1 text-xs text-ink-3">Zonal & university tournaments</p>
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
              placeholder="Search sports..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={cn(inputClass, "pl-9")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-ink-3" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className={inputClass}
                aria-label="Filter by status"
              >
                {STATUS_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={() => setIsRegisterOpen(true)} className="gap-2">
              <Plus className="size-4" /> Register
            </Button>
          </div>
        </div>

        {/* Sports Table */}
        {filteredSports.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No sports found"
              body={search ? "Try adjusting your search query or status filter." : "Get started by registering your college sports teams."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/40 text-left text-xs uppercase tracking-wide text-ink-3">
                  <th scope="col" className="px-5 py-3 font-semibold">Sport</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Team</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Coach</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Upcoming</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedSports.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSport(s)}
                    className="cursor-pointer transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <span className="hover:text-brand hover:underline">{s.sport}</span>
                        {s.isRegistered ? (
                          <Badge tone="teal" className="text-[10px]">Registered</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-ink-2 font-medium">
                      {s.team}
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      {s.coach}
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      {s.event || "TBD"}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSport(s);
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

        {/* Pagination Footer */}
        {filteredSports.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-ink-3">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Showing <strong className="text-ink">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                <strong className="text-ink">{Math.min(currentPage * pageSize, filteredSports.length)}</strong> of{" "}
                <strong className="text-ink">{filteredSports.length}</strong> sports teams
              </span>
              <div className="flex items-center gap-1.5 sm:border-l sm:border-line sm:pl-3">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                  aria-label="Items per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="mr-2 text-ink-3">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="gap-1 px-2.5 h-8 text-xs"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>

              {/* Numbered Page Buttons */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={cn(
                      "size-8 rounded-lg text-xs font-medium transition-colors",
                      pNum === currentPage
                        ? "bg-brand text-white shadow-sm font-semibold"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
                    )}
                    aria-label={`Go to page ${pNum}`}
                    aria-current={pNum === currentPage ? "page" : undefined}
                  >
                    {pNum}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="gap-1 px-2.5 h-8 text-xs"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Register Sport / Team Modal */}
      {isRegisterOpen ? (
        <CreateSportModal
          isPrivileged={isPrivileged}
          sports={query.data.sports}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={(sport) => {
            setIsRegisterOpen(false);
            qc.invalidateQueries({ queryKey: ["sports"] });
            setToast(`"${sport.sport} - ${sport.team}" registered successfully!`);
          }}
          onTrialRegistered={() => {
            setIsRegisterOpen(false);
            qc.invalidateQueries({ queryKey: ["sports"] });
            setToast("Trial registration submitted successfully!");
          }}
        />
      ) : null}

      {/* Sport Detail Modal */}
      {selectedSport ? (
        <SportDetailModal
          sport={selectedSport}
          isPrivileged={isPrivileged}
          isRegistering={registerMutation.isPending}
          isDeleting={deleteMutation.isPending}
          onClose={() => setSelectedSport(null)}
          onToggleRegister={() => registerMutation.mutate(selectedSport.id)}
          onDelete={() => {
            if (confirm(`Are you sure you want to remove team "${selectedSport.team}"?`)) {
              deleteMutation.mutate(selectedSport.id);
            }
          }}
          onUpdated={(updated) => {
            setSelectedSport(updated);
            qc.invalidateQueries({ queryKey: ["sports"] });
          }}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── Create Sport Modal ─────────────────────────────── */
function CreateSportModal({
  isPrivileged,
  sports,
  onClose,
  onSuccess,
  onTrialRegistered,
}: {
  isPrivileged: boolean;
  sports: SportItem[];
  onClose: () => void;
  onSuccess: (sport: SportItem) => void;
  onTrialRegistered: () => void;
}) {
  // If student: show student trial registration form
  const [selectedSportId, setSelectedSportId] = useState(sports[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [experience, setExperience] = useState("");

  // If institution: show full team registration form
  const [sportName, setSportName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<CreateSportInput["status"]>("Trials open");
  const [error, setError] = useState<string | null>(null);

  const teamMutation = useMutation({
    mutationFn: async (payload: CreateSportInput) => {
      return apiFetch("/api/v1/sports", SportItem, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (data) => {
      onSuccess(data);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to register sport team.");
    },
  });

  const trialMutation = useMutation({
    mutationFn: async (sportId: string) => {
      return apiFetch(`/api/v1/sports/${sportId}/register`, SportItem.pick({ isRegistered: true, squadSize: true }), {
        method: "POST",
        body: { position: position.trim(), experience: experience.trim() },
      });
    },
    onSuccess: () => {
      onTrialRegistered();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to submit trial registration.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrivileged) {
      if (!selectedSportId) return setError("Please select a sport.");
      trialMutation.mutate(selectedSportId);
      return;
    }

    if (!sportName.trim()) return setError("Please enter sport name.");
    if (!teamName.trim()) return setError("Please enter team name.");
    if (!coachName.trim()) return setError("Please enter coach name.");
    if (!eventDate.trim()) return setError("Please enter upcoming event/meet schedule.");

    setError(null);
    teamMutation.mutate({
      sport: sportName.trim(),
      team: teamName.trim(),
      coach: coachName.trim(),
      captain: captainName.trim(),
      event: eventDate.trim(),
      venue: venue.trim(),
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">
              {isPrivileged ? "Register Sport / Team" : "Register for Sports Trials"}
            </h2>
            <p className="mt-1 text-xs text-ink-3">
              {isPrivileged
                ? "Add a varsity sport squad, coach, and upcoming competition schedule."
                : "Select an active campus sport to register for upcoming team selection trials."}
            </p>
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
          {isPrivileged ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Sport Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Badminton, Swimming"
                    value={sportName}
                    onChange={(e) => setSportName(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AIT Smashers"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Head Coach *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coach Vikram"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Team Captain</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sen"
                    value={captainName}
                    onChange={(e) => setCaptainName(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Upcoming Meet / Event *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zonal meet · Nov 10"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Home Venue</label>
                  <input
                    type="text"
                    placeholder="e.g. Indoor Complex Court 1"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CreateSportInput["status"])}
                    className={cn(inputClass, "mt-1.5")}
                  >
                    <option value="Trials open">Trials open</option>
                    <option value="Active">Active</option>
                    <option value="Off-season">Off-season</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Choose Sport *</label>
                <select
                  value={selectedSportId}
                  onChange={(e) => setSelectedSportId(e.target.value)}
                  className={cn(inputClass, "mt-1.5")}
                >
                  {sports.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.sport} ({sp.team}) — {sp.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Playing Position / Event</label>
                <input
                  type="text"
                  placeholder="e.g. Forward, Opening Batsman, 100m Sprint, Point Guard"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={cn(inputClass, "mt-1.5")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">Past Experience</label>
                <input
                  type="text"
                  placeholder="e.g. School team captain, District level participant"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className={cn(inputClass, "mt-1.5")}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={teamMutation.isPending || trialMutation.isPending}>
              {teamMutation.isPending || trialMutation.isPending ? (
                <>
                  <Spinner className="mr-2 size-4" /> Submitting…
                </>
              ) : (
                "Submit Registration"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Sport Detail Modal ─────────────────────────────── */
function SportDetailModal({
  sport,
  isPrivileged,
  isRegistering,
  isDeleting,
  onClose,
  onToggleRegister,
  onDelete,
  onUpdated,
}: {
  sport: SportItem;
  isPrivileged: boolean;
  isRegistering: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onToggleRegister: () => void;
  onDelete: () => void;
  onUpdated: (sport: SportItem) => void;
}) {
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventInput, setEventInput] = useState(sport.event);

  const updateMutation = useMutation({
    mutationFn: async (newEvent: string) => {
      return apiFetch(`/api/v1/sports/${sport.id}`, SportItem, {
        method: "PUT",
        body: { event: newEvent },
      });
    },
    onSuccess: (updated) => {
      setIsEditingEvent(false);
      onUpdated(updated);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: SportItem["status"]) => {
      return apiFetch(`/api/v1/sports/${sport.id}`, SportItem, {
        method: "PUT",
        body: { status: newStatus },
      });
    },
    onSuccess: (updated) => {
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
              <Badge tone={statusTone(sport.status)}>{sport.status}</Badge>
              <Badge tone="brand">{sport.sport}</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-ink">{sport.team}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface-2/40 p-4">
          <div>
            <p className="text-xs font-medium text-ink-3">Head Coach</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <User className="size-3.5 text-brand" /> {sport.coach}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Team Captain</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles className="size-3.5 text-gold" /> {sport.captain || "Not assigned"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Active Squad</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Users className="size-3.5 text-teal" /> {sport.squadSize} registered
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-3">Training Venue</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin className="size-3.5 text-rose" /> {sport.venue || "Not set"}
            </p>
          </div>
        </div>

        {/* Upcoming Tournament Meet */}
        <div className="mt-4 rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
              <Clock className="size-3.5 text-brand" /> Upcoming Competition
            </span>
            {isPrivileged && !isEditingEvent ? (
              <button
                onClick={() => setIsEditingEvent(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Change
              </button>
            ) : null}
          </div>

          {isEditingEvent ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={eventInput}
                onChange={(e) => setEventInput(e.target.value)}
                className={cn(inputClass, "h-8 text-xs")}
                placeholder="e.g. Zonal meet · Oct 25"
              />
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(eventInput)}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsEditingEvent(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-ink">
              {sport.event || "No competition scheduled."}
            </p>
          )}
        </div>

        {/* Status Toggle for Admins */}
        {isPrivileged ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/20 px-4 py-3">
            <span className="text-xs font-medium text-ink-2">Recruitment Status:</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={sport.status === "Trials open" ? "primary" : "secondary"}
                onClick={() => toggleStatusMutation.mutate("Trials open")}
                disabled={toggleStatusMutation.isPending}
                className="text-xs"
              >
                Open Trials
              </Button>
              <Button
                size="sm"
                variant={sport.status === "Active" ? "primary" : "secondary"}
                onClick={() => toggleStatusMutation.mutate("Active")}
                disabled={toggleStatusMutation.isPending}
                className="text-xs"
              >
                Active
              </Button>
            </div>
          </div>
        ) : null}

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
              <Trash2 className="size-3.5" /> Disband Squad
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <Button
              variant={sport.isRegistered ? "secondary" : "primary"}
              onClick={onToggleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <Spinner className="mr-1.5 size-4" />
              ) : sport.isRegistered ? (
                "Withdraw Registration"
              ) : (
                "Register for Trials"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
