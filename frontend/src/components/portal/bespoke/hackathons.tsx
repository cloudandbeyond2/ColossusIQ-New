"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Download,
  Filter,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
  Code,
  Trophy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  HackathonItem,
  HackathonTeamItem,
  HackathonsOverview,
  RegisterHackathonTeamInput,
} from "@/lib/api/hackathon-schemas";
import type { Role } from "@/lib/auth/roles";
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

const DOMAINS = [
  "AI & Machine Learning",
  "Web3 & Blockchain",
  "Smart Education & EdTech",
  "Healthcare & BioTech",
  "FinTech & CyberSecurity",
  "CleanTech & Sustainability",
  "Open Innovation",
] as const;

function statusTone(status: string): "teal" | "amber" | "sky" | "brand" {
  switch (status) {
    case "Open":
      return "teal";
    case "Active":
      return "sky";
    case "Upcoming":
      return "amber";
    default:
      return "brand";
  }
}

export function HackathonsModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"hackathons" | "my-teams">("hackathons");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState<HackathonItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const query = useQuery({
    queryKey: ["hackathons"],
    queryFn: () => apiFetch("/api/v1/hackathons", HackathonsOverview),
  });

  const filteredHackathons = useMemo(() => {
    if (!query.data?.hackathons) return [];
    return query.data.hackathons.filter((h) => {
      const matchesStatus = statusFilter === "All" || h.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.host.toLowerCase().includes(q) ||
        h.date.toLowerCase().includes(q) ||
        h.domain.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [query.data?.hackathons, statusFilter, search]);

  const handleExportCsv = () => {
    if (!filteredHackathons.length) return;
    const headers = ["Hackathon", "Organizing Body", "Date", "Registered Teams", "Status", "Prize Pool"];
    const rows = filteredHackathons.map((h) => [
      `"${h.name.replace(/"/g, '""')}"`,
      `"${h.host.replace(/"/g, '""')}"`,
      `"${h.date.replace(/"/g, '""')}"`,
      h.teamsCount,
      `"${h.status}"`,
      `"${h.prizePool}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hackathons-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openRegisterModal = (hackathon?: HackathonItem) => {
    setSelectedHackathon(hackathon ?? query.data?.hackathons[0] ?? null);
    setIsRegisterOpen(true);
  };

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isLoading || !query.data) return <TemplateSkeleton />;

  const { kpis, myTeams } = query.data;
  const totalPages = Math.max(1, Math.ceil(filteredHackathons.length / rowsPerPage));
  const paginatedHackathons = filteredHackathons.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/20 bg-teal-soft px-4 py-3 text-sm text-teal shadow-xs" role="status">
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
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Total Hackathons</p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Trophy className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{formatNumber(kpis.totalHackathons)}</p>
          <p className="mt-1 text-xs text-ink-3">National & campus buildathons</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Registered Teams</p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-soft text-teal">
              <Users className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{formatNumber(kpis.registeredTeams)}</p>
          <p className="mt-1 text-xs text-teal">Live student team entries</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">My Registered Teams</p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-sky-soft text-sky">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{formatNumber(kpis.myTeams)}</p>
          <p className="mt-1 text-xs text-ink-3">Stored in PostgreSQL database</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Open Registrations</p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-soft text-amber">
              <Calendar className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{formatNumber(kpis.openRegistrations)}</p>
          <p className="mt-1 text-xs text-amber">Accepting team applications</p>
        </Card>
      </div>

      {/* Main Hackathon Hub View */}
      <Card className="overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-line bg-surface-2/30 px-5 pt-3">
          <button
            onClick={() => setActiveTab("hackathons")}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "hackathons"
                ? "border-brand text-brand font-semibold"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            All Hackathons
          </button>
          <button
            onClick={() => setActiveTab("my-teams")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "my-teams"
                ? "border-brand text-brand font-semibold"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            My Registered Teams
            {myTeams.length > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">
                {myTeams.length}
              </span>
            ) : null}
          </button>
        </div>

        {activeTab === "hackathons" ? (
          <>
            {/* Toolbar - Exactly matches the user's expected layout */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input
                  type="text"
                  placeholder="Search hackathon hub..."
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
                  <Filter className="size-4 text-ink-3" aria-hidden />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className={cn(inputClass, "w-auto")}
                    aria-label="Filter status"
                  >
                    <option value="All">All</option>
                    <option value="Open">Open</option>
                    <option value="Active">Active</option>
                    <option value="Upcoming">Upcoming</option>
                  </select>
                </div>

                <Button variant="secondary" onClick={handleExportCsv} disabled={filteredHackathons.length === 0} title="Export to CSV">
                  <Download className="size-4" /> Export CSV
                </Button>

                <Button onClick={() => openRegisterModal()} className="gap-2">
                  <Plus className="size-4" /> Register team
                </Button>
              </div>
            </div>

            {/* Hackathons Table */}
            {filteredHackathons.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No matching records"
                  body={search ? "Try adjusting your search or status filter." : "No active hackathons found for your college."}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/40 text-left text-xs uppercase tracking-wide text-ink-3">
                      <th scope="col" className="px-5 py-3 font-semibold">Hackathon</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Organizing Body</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Registered Teams</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {paginatedHackathons.map((hackathon) => (
                      <tr key={hackathon.id} className="transition-colors hover:bg-surface-2/50">
                        <td className="px-5 py-3.5 font-medium text-ink">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{hackathon.name}</span>
                            {hackathon.isRegistered ? (
                              <Badge tone="teal" className="text-[10px]">Registered</Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-3">{hackathon.domain}</p>
                        </td>
                        <td className="px-4 py-3.5 text-ink-2">{hackathon.host}</td>
                        <td className="px-4 py-3.5 text-ink-2 whitespace-nowrap">{hackathon.date}</td>
                        <td className="px-4 py-3.5 tabular-nums text-ink">{formatNumber(hackathon.teamsCount)}</td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone(hackathon.status)}>{hackathon.status}</Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {hackathon.isRegistered ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-teal-soft px-2.5 py-1 text-xs font-semibold text-teal">
                              <CheckCircle2 className="size-3" /> Team Entered
                            </span>
                          ) : (
                            <button
                              onClick={() => openRegisterModal(hackathon)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                            >
                              Register team
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-line px-5 py-3 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span>
                  Showing {filteredHackathons.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}–
                  {Math.min(page * rowsPerPage, filteredHackathons.length)} of {filteredHackathons.length} records
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className={cn(inputClass, "h-7 w-auto py-0 text-xs")}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex size-7 items-center justify-center rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex size-7 items-center justify-center rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* My Registered Teams View (PostgreSQL Data) */
          <div className="p-5">
            {myTeams.length === 0 ? (
              <div className="py-12 text-center">
                <Code className="mx-auto size-12 text-ink-3/40" />
                <h3 className="mt-3 text-base font-semibold text-ink">No registered teams yet</h3>
                <p className="mt-1 text-sm text-ink-3">
                  You haven&apos;t registered any team for upcoming hackathons. Join an active hackathon to build your innovation portfolio.
                </p>
                <Button onClick={() => openRegisterModal()} className="mt-4 gap-2">
                  <Plus className="size-4" /> Register team
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myTeams.map((team) => (
                  <div key={team.id} className="rounded-xl border border-line bg-surface p-4 shadow-2xs hover:border-brand/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-ink text-base">{team.teamName}</h4>
                        <p className="text-xs text-brand font-medium mt-0.5">{team.hackathonName}</p>
                      </div>
                      <Badge tone="teal">{team.status}</Badge>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-ink-2">
                      <p className="line-clamp-2">
                        <span className="font-semibold text-ink">Problem / Project:</span> {team.problemStatement}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Lead:</span> {team.teamLeadName} {team.rollNo ? `(${team.rollNo})` : ""}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Members:</span> {team.membersCount} students {team.memberNames ? `— ${team.memberNames}` : ""}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Track:</span> {team.domain}
                      </p>
                      {team.repoUrl ? (
                        <p className="flex items-center gap-1 text-brand">
                          <ExternalLink className="size-3" />
                          <a href={team.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Repository / Demo Link
                          </a>
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 border-t border-line/60 pt-2 text-[11px] text-ink-3 flex items-center justify-between">
                      <span>Saved in PostgreSQL</span>
                      <span>{new Date(team.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Register Team Modal */}
      {isRegisterOpen ? (
        <RegisterHackathonTeamModal
          hackathons={query.data.hackathons}
          defaultHackathon={selectedHackathon}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={(team) => {
            setIsRegisterOpen(false);
            qc.invalidateQueries({ queryKey: ["hackathons"] });
            setToast(`"${team.teamName}" successfully registered for ${team.hackathonName}!`);
          }}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── Register Team Modal ─────────────────────────────── */
function RegisterHackathonTeamModal({
  hackathons,
  defaultHackathon,
  onClose,
  onSuccess,
}: {
  hackathons: HackathonItem[];
  defaultHackathon: HackathonItem | null;
  onClose: () => void;
  onSuccess: (team: HackathonTeamItem) => void;
}) {
  const [selectedHackathonId, setSelectedHackathonId] = useState(
    defaultHackathon?.id || hackathons[0]?.id || "",
  );
  const [teamName, setTeamName] = useState("");
  const [teamLeadName, setTeamLeadName] = useState("");
  const [teamLeadEmail, setTeamLeadEmail] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [membersCount, setMembersCount] = useState("4");
  const [memberNames, setMemberNames] = useState("");
  const [domain, setDomain] = useState<string>("AI & Machine Learning");
  const [problemStatement, setProblemStatement] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedHackathonObj = hackathons.find((h) => h.id === selectedHackathonId) || hackathons[0];

  const mutation = useMutation({
    mutationFn: async (payload: RegisterHackathonTeamInput) => {
      return apiFetch("/api/v1/hackathons/teams", HackathonTeamItem, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (data) => {
      onSuccess(data);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to register team. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return setError("Please enter your team name.");
    if (!teamLeadName.trim()) return setError("Please enter the team lead name.");
    if (!problemStatement.trim()) return setError("Please enter your problem statement or project concept.");

    setError(null);
    mutation.mutate({
      hackathonId: selectedHackathonObj?.id || selectedHackathonId,
      hackathonName: selectedHackathonObj?.name || "Hackathon",
      teamName: teamName.trim(),
      teamLeadName: teamLeadName.trim(),
      teamLeadEmail: teamLeadEmail.trim() || undefined,
      rollNo: rollNo.trim(),
      membersCount: parseInt(membersCount, 10) || 4,
      memberNames: memberNames.trim(),
      domain,
      problemStatement: problemStatement.trim(),
      repoUrl: repoUrl.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Sparkles className="size-5 text-brand" /> Register Hackathon Team
            </h2>
            <p className="mt-1 text-xs text-ink-3">
              Official campus team entry recorded directly into PostgreSQL database.
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
              Target Hackathon *
            </label>
            <select
              value={selectedHackathonId}
              onChange={(e) => setSelectedHackathonId(e.target.value)}
              className={cn(inputClass, "mt-1.5")}
              required
            >
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.status} — {h.date})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Team Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Neural Knights"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Team Size (Members) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={membersCount}
                onChange={(e) => setMembersCount(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Team Lead Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Bala Kumar"
                value={teamLeadName}
                onChange={(e) => setTeamLeadName(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Roll No / Student ID
              </label>
              <input
                type="text"
                placeholder="e.g. 23CS104"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Lead Email
              </label>
              <input
                type="email"
                placeholder="lead@college.edu"
                value={teamLeadEmail}
                onChange={(e) => setTeamLeadEmail(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
                Innovation Domain / Track *
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
              Team Member Names
            </label>
            <input
              type="text"
              placeholder="e.g. Anand K., Priya S., Rahul M."
              value={memberNames}
              onChange={(e) => setMemberNames(e.target.value)}
              className={cn(inputClass, "mt-1.5")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
              Problem Statement / Project Concept *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Describe the problem statement you are solving or your project idea..."
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              className={cn(inputClass, "mt-1.5 resize-none")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3">
              GitHub Repo / Prototype Link
            </label>
            <input
              type="url"
              placeholder="https://github.com/team/project"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className={cn(inputClass, "mt-1.5")}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Spinner className="mr-2 size-4" /> Registering…
                </>
              ) : (
                "Register Team"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
