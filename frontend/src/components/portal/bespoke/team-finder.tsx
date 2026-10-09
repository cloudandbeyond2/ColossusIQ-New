"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Layers,
  ArrowRight,
  Filter,
  X,
  UserPlus,
  Send,
} from "lucide-react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import {
  TeamCandidate,
  TeamFinderOverview,
  TeamFinderOverviewSchema,
  TeamRequestItem,
} from "@/lib/api/team-finder-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, toneForScore } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "All",
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication",
  "Artificial Intelligence & Data Science",
  "Management Studies",
] as const;

export function TeamFinderModule() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"classmates" | "interdept" | "requests">("classmates");
  const [search, setSearch] = useState("");
  const [interDeptFilter, setInterDeptFilter] = useState<string>("All Other Departments");
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [inviteModalCandidate, setInviteModalCandidate] = useState<TeamCandidate | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["team-finder"],
    queryFn: () => apiFetch("/api/v1/team-finder", TeamFinderOverviewSchema),
  });

  const myDept = data?.myDepartment || "Computer Science & Engineering";

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  // Post Team Request mutation
  const postRequestMutation = useMutation({
    mutationFn: (body: {
      projectId: string;
      projectTitle: string;
      roleNeeded: string;
      skillsRequired: string[];
      slots: number;
      department: string;
      description: string;
    }) => apiFetch("/api/v1/team-finder/requests", z.unknown(), { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-finder"] });
      setIsPostOpen(false);
      showToast("Team request successfully posted to campus board!");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to post team request", "error");
    },
  });

  // Invite candidate to project mutation
  const inviteMutation = useMutation({
    mutationFn: (body: { projectId: string; studentName: string }) =>
      apiFetch("/api/v1/team-finder/invite", z.unknown(), { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-finder"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setInviteModalCandidate(null);
      showToast(`Teammate successfully added to your project team!`);
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to add teammate", "error");
    },
  });

  // Apply to request mutation
  const applyMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiFetch("/api/v1/team-finder/apply", z.unknown(), { method: "POST", body: { requestId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-finder"] });
      showToast("Application sent! Team lead has been notified.");
    },
  });

  // Available other departments for filter
  const otherDepartments = useMemo(() => {
    if (!data?.candidates) return [];
    const depts = new Set<string>();
    data.candidates.forEach((c) => {
      if (c.dept.toLowerCase() !== myDept.toLowerCase()) {
        depts.add(c.dept);
      }
    });
    return ["All Other Departments", ...Array.from(depts)];
  }, [data?.candidates, myDept]);

  // Classmates (Same Department as Anand)
  const classmates = useMemo(() => {
    if (!data?.candidates) return [];
    return data.candidates.filter((c) => {
      const matchDept = c.dept.toLowerCase() === myDept.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.looking.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q));
      return matchDept && matchSearch;
    });
  }, [data?.candidates, myDept, search]);

  // Inter-department candidates (Cross-branch)
  const interDeptCandidates = useMemo(() => {
    if (!data?.candidates) return [];
    return data.candidates.filter((c) => {
      const notMyDept = c.dept.toLowerCase() !== myDept.toLowerCase();
      const matchDept =
        interDeptFilter === "All Other Departments" || c.dept === interDeptFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.dept.toLowerCase().includes(q) ||
        c.looking.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q));
      return notMyDept && matchDept && matchSearch;
    });
  }, [data?.candidates, myDept, interDeptFilter, search]);

  const filteredRequests = useMemo(() => {
    if (!data?.requests) return [];
    return data.requests.filter((r) => {
      const q = search.toLowerCase();
      return (
        !q ||
        r.projectTitle.toLowerCase().includes(q) ||
        r.roleNeeded.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.skillsRequired.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [data?.requests, search]);

  if (isLoading || !data) return <TemplateSkeleton />;

  const displayedCandidates = activeTab === "classmates" ? classmates : interDeptCandidates;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[100] flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3",
            toast.tone === "error" ? "bg-rose border border-rose/30" : "bg-teal border border-teal/30"
          )}
        >
          {toast.tone === "error" ? <AlertCircle className="size-5 shrink-0" /> : <CheckCircle2 className="size-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIsPostOpen(true)} className="gap-2">
            <Plus className="size-4" /> Post a Team Request
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/5 px-3 py-2 text-xs font-semibold text-teal">
            <GraduationCap className="size-4 text-teal" />
            <span>Your Dept: {myDept}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2">
            <Briefcase className="size-4 text-amber" />
            <span>{data.requests.length} Open Campus Requests</span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex rounded-xl border border-line bg-surface-2 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("classmates")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              activeTab === "classmates" ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink"
            )}
          >
            <Users className="size-3.5 text-teal" />
            <span>My Classmates ({data.candidates.filter((c) => c.dept.toLowerCase() === myDept.toLowerCase()).length})</span>
          </button>
          <button
            onClick={() => setActiveTab("interdept")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              activeTab === "interdept" ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink"
            )}
          >
            <Layers className="size-3.5 text-sky" />
            <span>Inter-Department ({data.candidates.filter((c) => c.dept.toLowerCase() !== myDept.toLowerCase()).length})</span>
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              activeTab === "requests" ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink"
            )}
          >
            <Briefcase className="size-3.5 text-amber" />
            <span>Campus Requests ({data.requests.length})</span>
          </button>
        </div>
      </div>

      {/* Helpful Mode Banner */}
      {activeTab === "classmates" && (
        <div className="flex items-center gap-2.5 rounded-xl border border-teal/20 bg-teal/5 px-4 py-2.5 text-xs text-teal">
          <GraduationCap className="size-4 shrink-0" />
          <span>
            <strong>Classmate Roster ({myDept}):</strong> Showing peers in your branch. Ideal for semester lab coursework, internal assignments, and department mini-projects.
          </span>
        </div>
      )}

      {activeTab === "interdept" && (
        <div className="flex items-center gap-2.5 rounded-xl border border-sky/20 bg-sky/5 px-4 py-2.5 text-xs text-sky">
          <Layers className="size-4 shrink-0" />
          <span>
            <strong>Cross-Branch Talent:</strong> Showing students in Electronics, Design, Management, and IT. Perfect for Multi-Disciplinary Capstones (MDP), Smart India Hackathons, and startup prototypes!
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "classmates"
                ? `Search classmates in ${myDept} by name, skill (Python, React...), or interest...`
                : activeTab === "interdept"
                ? "Search cross-department peers by name, department, or specialized skill..."
                : "Search requests by role, project, or required skills..."
            }
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-teal focus:outline-none"
          />
        </div>

        {activeTab === "interdept" && (
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-ink-3" />
            <select
              value={interDeptFilter}
              onChange={(e) => setInterDeptFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-medium text-ink focus:border-teal focus:outline-none"
            >
              {otherDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1 & 2: TALENT DIRECTORY (CLASSMATES OR INTER-DEPARTMENT) */}
      {(activeTab === "classmates" || activeTab === "interdept") &&
        (displayedCandidates.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <EmptyState
              title={
                activeTab === "classmates"
                  ? `No classmates found in ${myDept}`
                  : "No cross-department peers match the filter"
              }
              body="Try clearing your search query or selecting a different department."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedCandidates.map((cand) => (
              <Card key={cand.id} className="transition-all hover:shadow-md">
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 font-sans text-sm font-bold text-teal">
                        {cand.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">{cand.name}</h4>
                        <p className="text-xs text-ink-3 line-clamp-1">{cand.dept}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone="teal" className="text-[11px]">
                        {cand.match}% Match
                      </Badge>
                    </div>
                  </div>

                  {cand.bio && <p className="text-xs text-ink-2 leading-relaxed">{cand.bio}</p>}

                  <div>
                    <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5">
                      Skills & Tech Stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cand.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-2"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-surface-2 p-2.5 text-xs">
                    <span className="font-medium text-ink-3">Interested in: </span>
                    <span className="font-semibold text-ink">{cand.looking}</span>
                  </div>

                  <div className="pt-1">
                    <Button
                      variant="secondary"
                      className="w-full gap-2 text-xs"
                      onClick={() => {
                        setInviteModalCandidate(cand);
                        if (data.myProjects.length > 0) {
                          setSelectedProjectId(data.myProjects[0]!.id);
                        }
                      }}
                    >
                      <UserPlus className="size-3.5 text-teal" />
                      <span>Invite to Project Team</span>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ))}

      {/* TAB 2: ACTIVE CAMPUS REQUESTS */}
      {activeTab === "requests" && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="transition-all hover:shadow-md">
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="sky" className="mb-1 text-[11px]">
                      {req.department}
                    </Badge>
                    <h4 className="font-bold text-ink text-base">{req.roleNeeded}</h4>
                    <p className="text-xs font-medium text-teal mt-0.5">Project: {req.projectTitle}</p>
                  </div>
                  <Badge tone="amber">{req.slots} Open Slot{req.slots > 1 ? "s" : ""}</Badge>
                </div>

                <p className="text-xs text-ink-2 leading-relaxed">{req.description}</p>

                <div>
                  <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5">
                    Required Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {req.skillsRequired.map((s) => (
                      <span
                        key={s}
                        className="rounded-lg border border-teal/20 bg-teal/5 px-2 py-0.5 text-xs font-medium text-teal"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3">
                  <span>Posted by {req.createdBy}</span>
                  <div className="flex items-center gap-2">
                    <span>{req.applicantsCount} Applied</span>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => applyMutation.mutate(req.id)}
                      disabled={applyMutation.isPending}
                    >
                      <Send className="size-3" /> Apply
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* INVITE TO PROJECT MODAL */}
      {inviteModalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-teal/10 text-teal">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Add Teammate</h3>
                  <p className="text-xs text-ink-3">Invite {inviteModalCandidate.name} to your project</p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalCandidate(null)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  Select Project to Link
                </label>
                {data.myProjects.length === 0 ? (
                  <p className="text-xs text-rose">You have no active projects yet. Start one in Project Hub first.</p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                  >
                    {data.myProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.domain})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs space-y-1 text-ink-2">
                <p>
                  <span className="font-semibold text-ink">Candidate Skills: </span>
                  {inviteModalCandidate.skills.join(", ")}
                </p>
                <p>
                  <span className="font-semibold text-ink">Action: </span>
                  Will dynamically add <span className="font-semibold text-teal">{inviteModalCandidate.name}</span> to the project team in the database.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setInviteModalCandidate(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    inviteMutation.mutate({
                      projectId: selectedProjectId,
                      studentName: inviteModalCandidate.name,
                    })
                  }
                  disabled={!selectedProjectId || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Adding..." : "Confirm & Add Teammate"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POST TEAM REQUEST MODAL */}
      {isPostOpen && (
        <PostTeamRequestModal
          projects={data.myProjects}
          onClose={() => setIsPostOpen(false)}
          onSubmit={(req) => postRequestMutation.mutate(req)}
          isSubmitting={postRequestMutation.isPending}
        />
      )}
    </div>
  );
}

function PostTeamRequestModal({
  projects,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  projects: { id: string; title: string; domain: string }[];
  onClose: () => void;
  onSubmit: (data: {
    projectId: string;
    projectTitle: string;
    roleNeeded: string;
    skillsRequired: string[];
    slots: number;
    department: string;
    description: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "PRJ-1001");
  const [projectTitle, setProjectTitle] = useState(projects[0]?.title || "My Project");
  const [roleNeeded, setRoleNeeded] = useState("Full Stack Developer");
  const [skillsInput, setSkillsInput] = useState("React, Python, FastAPI");
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [slots, setSlots] = useState(1);
  const [description, setDescription] = useState(
    "Looking for a motivated teammate to collaborate on API integration and frontend UI/UX."
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const matchP = projects.find((p) => p.id === projectId);

    onSubmit({
      projectId,
      projectTitle: matchP ? matchP.title : projectTitle,
      roleNeeded: roleNeeded.trim(),
      skillsRequired: skills.length ? skills : ["General Engineering"],
      slots,
      department,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-teal/10 text-teal">
              <Plus className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">Post a Team Opening</h3>
              <p className="text-xs text-ink-3">Broadcast open slots for your project to campus peers</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Project</label>
            {projects.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const found = projects.find((p) => p.id === e.target.value);
                  if (found) setProjectTitle(found.title);
                }}
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Project title..."
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                required
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Role Needed</label>
            <input
              type="text"
              value={roleNeeded}
              onChange={(e) => setRoleNeeded(e.target.value)}
              placeholder="e.g. Drone Telemetry Lead, UI Designer, Backend Engineer"
              className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Preferred Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-ink focus:border-teal focus:outline-none"
              >
                {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Slots Open</label>
              <input
                type="number"
                min={1}
                max={5}
                value={slots}
                onChange={(e) => setSlots(Number(e.target.value))}
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-ink focus:border-teal focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">
              Skills Required (comma-separated)
            </label>
            <input
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. React, Python, Embedded C"
              className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Description & Goals</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this teammate be building? What are the key deliverables?"
              className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Posting..." : "Publish Team Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
