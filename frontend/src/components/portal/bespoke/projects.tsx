"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Code2,
  ExternalLink,
  Globe,
  Lightbulb,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { Project } from "@/lib/api/schemas";
import { LearningContext } from "@/lib/api/learning-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  Progress,
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STAGES_LIST = [
  "Idea",
  "Team Formation",
  "Architecture",
  "Milestones",
  "Implementation",
  "Testing",
  "AI Review",
  "Faculty Review",
  "Demo",
  "Portfolio",
] as const;

const MEDICAL_DOMAINS = [
  "ICMR-STS · Short Term Studentship Research",
  "Clinical Audit & Observational Study",
  "Epidemiology, Community Health & PSM",
  "HealthTech · Biomedical Devices & AI Diagnostics",
  "Anatomy & Cadaveric Morphometric Study",
  "Pathology & Histopathological Correlation",
  "Pharmacovigilance & Rational Drug Therapy",
  "Microbiology & Antimicrobial Resistance (AMR)",
  "Forensic Medicine & Medico-Legal Analysis",
  "Surgical Protocols & Clinical Case Series",
];

const ENGINEERING_DOMAINS = [
  "AI/ML · Computer Vision & NLP",
  "AI/ML · IoT & Edge Computing",
  "Full Stack · Next.js & Cloud",
  "Mechanical · Robotics, EV & Thermal",
  "Civil · Structural & Sustainable Infra",
  "Electrical · Power Systems & Smart Grid",
  "Electronics · Embedded Systems & VLSI",
  "AgriTech · Embedded & Sensor Systems",
  "HealthTech · Biomedical Devices",
  "Cybersecurity & Blockchain",
];

const POPULAR_DOMAINS = ENGINEERING_DOMAINS;

const MEDICAL_MENTORS = [
  "Dr. K. Senthil Kumar, MD (Anatomy)",
  "Dr. S. Meenakshi Sundaram, MBBS, MD",
  "Dr. Priya Ramanathan, MS (Surgery)",
  "Dr. R. Balaji, MD (Community Medicine)",
  "Dr. Meena Raghavan, MD (Pathology)",
];

const ENGINEERING_MENTORS = [
  "Dr. Meena Raghavan",
  "Prof. R. Balaji",
  "Dr. K. Saravanan",
  "Dr. P. Vasanthi",
  "Prof. A. Senthilkumar",
];

const DEFAULT_MENTORS = ENGINEERING_MENTORS;

const StaffMemberSimple = z.object({
  name: z.string(),
  role: z.string().optional(),
  department: z.string().optional(),
  qualifications: z.string().optional(),
});

const StaffQuerySchema = z.union([
  z.object({ staff: z.array(StaffMemberSimple) }).passthrough().transform((r) => r.staff),
  z.object({ data: z.array(StaffMemberSimple) }).passthrough().transform((r) => r.data),
  z.array(StaffMemberSimple),
  z.unknown().transform(() => []),
]);

function matchesMentor(mentor: string, currentUserName?: string | null): boolean {
  if (!mentor || !currentUserName) return false;
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/gi, "")
      .replace(/\b(mbbs|md|ms|phd|m\.sc|mtech|btech|be|me)\b/gi, "")
      .replace(/[^a-z0-9]/g, "");

  const m = normalize(mentor);
  const u = normalize(currentUserName);
  if (!m || !u) return false;
  return m.includes(u) || u.includes(m);
}

function matchesStudentTeam(team: string[], currentUserName?: string | null): boolean {
  if (!team || !team.length) return false;
  if (team.includes("Lead Student (You)") || team.includes("Lead Student")) return true;
  if (!currentUserName) return false;
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/gi, "")
      .replace(/[^a-z0-9]/g, "");
  const u = normalize(currentUserName);
  return team.some((t) => {
    const member = normalize(t);
    return member.includes(u) || u.includes(member);
  });
}

export function ProjectsModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const contextQuery = useQuery({
    queryKey: ["learning-context"],
    queryFn: () => apiFetch("/api/v1/learning/context", LearningContext),
  });
  const staffQuery = useQuery({
    queryKey: ["staff", role],
    queryFn: () => apiFetch("/api/v1/modules/staff", StaffQuerySchema),
    staleTime: 60_000,
  });

  const dynamicMentors = useMemo(() => {
    if (!staffQuery.data || staffQuery.data.length === 0) return null;
    const list = staffQuery.data
      .filter((s) => !s.role || s.role === "Faculty" || s.role === "HOD")
      .map((s) => {
        const extra = s.qualifications ? `, ${s.qualifications}` : (s.department ? ` (${s.department})` : "");
        return `${s.name}${extra}`;
      })
      .filter(Boolean);
    return list.length > 0 ? list : null;
  }, [staffQuery.data]);

  const isMedical =
    contextQuery.data?.stream === "medical" ||
    Boolean(
      contextQuery.data?.departments?.some((d) =>
        [
          "Anatomy",
          "Physiology",
          "Biochemistry",
          "Pathology",
          "Microbiology",
          "Pharmacology",
          "Community Medicine",
          "General Medicine",
          "General Surgery",
        ].includes(d)
      )
    );

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [stageModalProject, setStageModalProject] = useState<Project | null>(null);
  const [reviewModalProject, setReviewModalProject] = useState<Project | null>(null);
  const [deleteTargetProject, setDeleteTargetProject] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/api/v1/projects", z.array(Project)),
  });

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4500);
  };

  // Create Project mutation
  const createMutation = useMutation({
    mutationFn: (body: {
      title: string;
      domain: string;
      mentor: string;
      team: string[];
      description?: string;
      repoUrl?: string;
      docUrl?: string;
      demoUrl?: string;
    }) => apiFetch("/api/v1/projects", z.unknown(), { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setIsCreateOpen(false);
      showToast("Project successfully created & saved to database!", "success");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to create project", "error");
    },
  });

  // Update Stage / Deliverables mutation
  const stageMutation = useMutation({
    mutationFn: ({
      projectId,
      stage,
      repoUrl,
      docUrl,
      demoUrl,
    }: {
      projectId: string;
      stage: string;
      repoUrl?: string;
      docUrl?: string;
      demoUrl?: string;
    }) =>
      apiFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/stage`, z.unknown(), {
        method: "PATCH",
        body: { stage, repoUrl, docUrl, demoUrl },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setStageModalProject(null);
      showToast("Stage deliverables & progress successfully updated!", "success");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to update project stage", "error");
    },
  });

  // Faculty Review & Approval mutation
  const reviewMutation = useMutation({
    mutationFn: ({
      projectId,
      architecture,
      documentation,
      codeQuality,
      testing,
      innovation,
      facultyFeedback,
      approve,
    }: {
      projectId: string;
      architecture: number;
      documentation: number;
      codeQuality: number;
      testing: number;
      innovation: number;
      facultyFeedback: string;
      approve: boolean;
    }) =>
      apiFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/review`, z.unknown(), {
        method: "POST",
        body: {
          architecture,
          documentation,
          codeQuality,
          testing,
          innovation,
          facultyFeedback,
          approve,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setReviewModalProject(null);
      showToast("Faculty review submitted & milestone sign-off saved!", "success");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to submit review", "error");
    },
  });

  // Delete Project mutation
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, z.unknown(), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTargetProject(null);
      showToast("Project successfully deleted!", "success");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to delete project", "error");
    },
  });

  const currentUserName = contextQuery.data?.userName;
  const [scopeFilter, setScopeFilter] = useState<"my" | "all">(
    role === "admin" || role === "institution" ? "all" : "my"
  );

  const myProjects = useMemo(() => {
    if (!data) return [];
    if (role === "student") {
      return data.filter((p) => matchesStudentTeam(p.team, currentUserName));
    }
    if (role === "faculty") {
      return data.filter((p) => matchesMentor(p.mentor, currentUserName));
    }
    return data;
  }, [data, currentUserName, role]);

  const allCount = data?.length || 0;
  const myCount = myProjects.length;

  const scopedList = scopeFilter === "my" ? myProjects : (data || []);

  const filteredProjects = useMemo(() => {
    if (!scopedList) return [];
    if (!search.trim()) return scopedList;
    const q = search.toLowerCase();
    return scopedList.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q) ||
        p.mentor.toLowerCase().includes(q) ||
        p.team.some((m) => m.toLowerCase().includes(q))
    );
  }, [scopedList, search]);

  if (isLoading || !data) return <TemplateSkeleton />;

  const isStaff = role === "faculty" || role === "hod" || role === "admin";

  return (
    <div className="space-y-6">
      {/* Toast Notification - elevated to z-[100] above modals */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[100] flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3",
            toast.tone === "error" ? "bg-rose border border-rose/30" : "bg-teal border border-teal/30"
          )}
        >
          {toast.tone === "error" ? (
            <AlertCircle className="size-5 shrink-0" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {role === "student" && (
            <>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="size-4" /> Start New Project
              </Button>
              <LinkButton href="/student/project-ideas" variant="secondary">
                <Lightbulb className="size-4" /> Generate Idea
              </LinkButton>
              <LinkButton href="/student/team-finder" variant="secondary">
                <Users className="size-4" /> Find Teammates
              </LinkButton>
              <LinkButton href="/student/viva" variant="secondary">
                <Mic className="size-4" /> Practise Viva
              </LinkButton>
            </>
          )}

          {isStaff && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2">
              <ShieldCheck className="size-4 text-teal" />
              <span>Faculty Mentorship & Milestone Evaluation Desk</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Search projects, domains, mentors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Scope Filter Tabs (My Mentored Projects vs All College Projects) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setScopeFilter("my")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              scopeFilter === "my"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <UserCheck className="size-3.5" />
            <span>{role === "student" ? "My Team Projects" : "My Mentored Projects"}</span>
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                scopeFilter === "my" ? "bg-white/20 text-white" : "bg-surface-3 text-ink-3"
              )}
            >
              {myCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              scopeFilter === "all"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Building2 className="size-3.5" />
            <span>All College Projects</span>
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                scopeFilter === "all" ? "bg-white/20 text-white" : "bg-surface-3 text-ink-3"
              )}
            >
              {allCount}
            </span>
          </button>
        </div>

        <div className="text-xs text-ink-3">
          {scopeFilter === "my" ? (
            <span>
              Showing {filteredProjects.length} {role === "student" ? "project(s) in your team" : "project(s) assigned to you as mentor"}
            </span>
          ) : (
            <span>Showing {filteredProjects.length} project(s) across the college repository</span>
          )}
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card className="p-8 text-center">
          <Lightbulb className="mx-auto mb-3 size-10 text-ink-3" />
          <p className="font-semibold text-ink">
            {scopeFilter === "my" && role === "faculty"
              ? "No Projects Assigned to You as Mentor Yet"
              : "No projects found"}
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {scopeFilter === "my" && role === "faculty"
              ? "When students select you as their faculty mentor, their submissions will appear here for milestone review and sign-off."
              : search
              ? "No projects match your search criteria."
              : "Projects created in your college will appear here."}
          </p>
          {scopeFilter === "my" && allCount > 0 && (
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="secondary" onClick={() => setScopeFilter("all")} className="gap-2">
                <Building2 className="size-3.5" /> View All College Projects ({allCount})
              </Button>
            </div>
          )}
        </Card>
      ) : (
        filteredProjects.map((p) => {
          return (
            <Card key={p.id}>
              <CardHeader
                title={p.title}
                subtitle={`${p.domain} · Mentor: ${p.mentor}`}
                action={
                  <div className="flex items-center gap-2">
                    {isStaff && matchesMentor(p.mentor, currentUserName) && (
                      <Badge tone="teal" className="gap-1 font-semibold">
                        <UserCheck className="size-3" /> Assigned to You
                      </Badge>
                    )}
                    <Badge tone={p.stage === "Portfolio" || p.stage === "Demo" ? "teal" : "gold"}>
                      {p.stage}
                    </Badge>

                    {role === "student" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setStageModalProject(p)}
                        className="text-xs"
                      >
                        Advance Stage
                      </Button>
                    )}

                    {isStaff && (
                      <Button
                        size="sm"
                        variant="gold"
                        onClick={() => setReviewModalProject(p)}
                        className="text-xs"
                      >
                        Review & Approve
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-ink-3 hover:bg-rose/10 hover:text-rose"
                      title="Delete Project"
                      onClick={() => setDeleteTargetProject(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                }
              />

              <CardBody className="space-y-6">
                {/* Team & Links */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 text-sm text-ink-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="size-4 text-teal" aria-hidden />
                    <span className="font-medium text-ink">Team:</span>
                    <span className="text-ink-2">{p.team.join(", ")}</span>
                    <LinkButton
                      href={`/${role}/team-finder`}
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px] text-teal hover:bg-teal/10"
                      title={role === "student" ? "Find more teammates for this project in Team Finder" : "View student talent pool in Team Finder"}
                    >
                      <Plus className="size-3" /> {role === "student" ? "Find Teammates" : "Team Pool"}
                    </LinkButton>
                  </div>

                  {/* Artifact Links */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {p.repoUrl && (
                      <a
                        href={p.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-2 hover:text-ink hover:underline"
                      >
                        <Code2 className="size-3.5" /> Repository / Files
                      </a>
                    )}
                    {p.docUrl && (
                      <a
                        href={p.docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-2 hover:text-ink hover:underline"
                      >
                        <ExternalLink className="size-3.5" /> Documentation
                      </a>
                    )}
                    {p.demoUrl && (
                      <a
                        href={p.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-2 hover:text-ink hover:underline"
                      >
                        <Globe className="size-3.5" /> Live Demo
                      </a>
                    )}
                  </div>
                </div>

                {/* 10-Stage Lifecycle Stepper */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-2">
                    <span className="font-medium text-ink">Project Lifecycle</span>
                    <span className="font-semibold text-brand">{p.progress}% completed</span>
                  </div>
                  <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Project lifecycle">
                    {p.stages.map((s) => (
                      <li key={s.title} className="min-w-24 flex-1">
                        <div
                          className={cn(
                            "h-1.5 rounded-full transition-colors",
                            s.status === "done"
                              ? "bg-teal"
                              : s.status === "active"
                              ? "bg-gold"
                              : "bg-line"
                          )}
                        />
                        <p
                          className={cn(
                            "mt-1.5 flex items-center gap-1 text-[11px]",
                            s.status === "todo" ? "text-ink-3" : "text-ink font-medium"
                          )}
                        >
                          {s.status === "done" ? (
                            <Check className="size-3 text-teal" aria-hidden />
                          ) : null}
                          {s.title}
                          <span className="sr-only"> ({s.status})</span>
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* AI Project Review Board */}
                <div className="rounded-xl border border-line bg-surface-2/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Sparkles className="size-4 text-brand" />
                      <span>AI Project Review Board</span>
                    </div>
                    {p.review.facultyApproved && (
                      <Badge tone="teal" className="text-[11px]">
                        ✓ Faculty Milestone Approved
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {Object.entries({
                      architecture: p.review.architecture,
                      documentation: p.review.documentation,
                      codeQuality: p.review.codeQuality,
                      testing: p.review.testing,
                      innovation: p.review.innovation,
                    }).map(([k, v]) => (
                      <div key={k}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="capitalize text-ink-2">
                            {k === "codeQuality" ? "Code / Build Quality" : k.replace(/([A-Z])/g, " $1")}
                          </span>
                          <span className="tabular-nums font-semibold text-ink">{v || "—"}</span>
                        </div>
                        <Progress value={v} tone={toneForScore(v)} className="h-1.5" label={k} />
                      </div>
                    ))}
                  </div>

                  {p.review.facultyFeedback && (
                    <div className="mt-3 rounded-lg border border-teal/30 bg-teal/5 p-2.5 text-xs text-ink">
                      <span className="font-semibold text-teal">Faculty Remarks: </span>
                      {p.review.facultyFeedback}
                    </div>
                  )}

                  <p className="mt-3 text-xs text-ink-3">
                    AI review is advisory; faculty review decides milestone approval and portfolio
                    publication.
                  </p>
                </div>
              </CardBody>
            </Card>
          );
        })
      )}

      {/* CREATE PROJECT MODAL */}
      {isCreateOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          isMedical={isMedical}
          dynamicMentors={dynamicMentors ?? undefined}
        />
      )}

      {/* ADVANCE STAGE / DELIVERABLES MODAL */}
      {stageModalProject && (
        <StageDeliverableModal
          project={stageModalProject}
          onClose={() => setStageModalProject(null)}
          onSubmit={(data) => stageMutation.mutate(data)}
          isSubmitting={stageMutation.isPending}
          isMedical={isMedical}
        />
      )}

      {/* FACULTY REVIEW MODAL */}
      {reviewModalProject && (
        <FacultyReviewModal
          project={reviewModalProject}
          onClose={() => setReviewModalProject(null)}
          onSubmit={(data) => reviewMutation.mutate(data)}
          isSubmitting={reviewMutation.isPending}
          isMedical={isMedical}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetProject && (
        <DeleteConfirmModal
          project={deleteTargetProject}
          onClose={() => setDeleteTargetProject(null)}
          onConfirm={() => deleteMutation.mutate(deleteTargetProject.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL COMPONENTS
// ─────────────────────────────────────────────────────────────

function CreateProjectModal({
  onClose,
  onSubmit,
  isSubmitting,
  isMedical,
  dynamicMentors,
}: {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    domain: string;
    mentor: string;
    team: string[];
    description?: string;
    repoUrl?: string;
    docUrl?: string;
    demoUrl?: string;
  }) => void;
  isSubmitting: boolean;
  isMedical?: boolean;
  dynamicMentors?: string[];
}) {
  const domainsList = isMedical ? MEDICAL_DOMAINS : ENGINEERING_DOMAINS;
  const mentorsList =
    dynamicMentors && dynamicMentors.length > 0
      ? dynamicMentors
      : isMedical
      ? MEDICAL_MENTORS
      : ENGINEERING_MENTORS;
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState(domainsList[0]!);
  const [customDomain, setCustomDomain] = useState("");
  const [mentor, setMentor] = useState(mentorsList[0]!);
  const [selectedTeammates, setSelectedTeammates] = useState<string[]>(["Lead Student (You)"]);
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const toggleTeammate = (name: string) => {
    setSelectedTeammates((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const finalTeam = selectedTeammates.map((t) => (t.startsWith("Lead Student") ? "Lead Student" : t));

    onSubmit({
      title: title.trim(),
      domain: domain === "Other" && customDomain ? customDomain.trim() : domain,
      mentor,
      team: finalTeam.length ? finalTeam : ["Lead Student"],
      description,
      repoUrl: repoUrl.trim() || undefined,
      docUrl: docUrl.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-base font-semibold text-ink">
            Create New Project
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Project Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isMedical
                  ? "e.g. Study of Blood Pressure Monitoring in Rural Clinics"
                  : "e.g. Autonomous Campus Delivery Rover"
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Domain / Track *
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              >
                {domainsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="Other">Other (Custom)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Faculty Mentor *
              </label>
              <select
                value={mentor}
                onChange={(e) => setMentor(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              >
                {mentorsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {domain === "Other" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Custom Domain</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder={
                  isMedical
                    ? "e.g. Clinical Health Study"
                    : "e.g. Quantum Algorithms"
                }
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Project Team</label>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-teal/10 text-xs font-bold text-teal">
                You
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">Lead Student (You)</p>
                <p className="text-[11px] text-ink-3">Project Creator & Team Lead</p>
              </div>
            </div>
            <p className="text-[11px] text-ink-3 mt-1.5">
              💡 Your project starts with you as lead. You can search and invite peers anytime using the <strong>Team Finder</strong> module in the sidebar.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Repository / Project Files URL (optional)
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder={
                isMedical
                  ? "https://drive.google.com/... or Google Docs link"
                  : "https://github.com/... or Google Drive link"
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Brief Problem Statement
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of what the project solves or investigates..."
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StageDeliverableModal({
  project,
  onClose,
  onSubmit,
  isSubmitting,
  isMedical,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (data: {
    projectId: string;
    stage: string;
    repoUrl?: string;
    docUrl?: string;
    demoUrl?: string;
  }) => void;
  isSubmitting: boolean;
  isMedical?: boolean;
}) {
  const currIndex = STAGES_LIST.indexOf(project.stage as any);
  const nextStage =
    currIndex >= 0 && currIndex < STAGES_LIST.length - 1
      ? STAGES_LIST[currIndex + 1]!
      : project.stage;

  const [selectedStage, setSelectedStage] = useState<string>(nextStage);
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || "");
  const [docUrl, setDocUrl] = useState(project.docUrl || "");
  const [demoUrl, setDemoUrl] = useState(project.demoUrl || "");

  const selectedIdx = STAGES_LIST.indexOf(selectedStage as any);
  const targetProgress = Math.min(
    100,
    Math.round(((selectedIdx + 1) / STAGES_LIST.length) * 100)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      projectId: project.id,
      stage: selectedStage,
      repoUrl: repoUrl.trim() || undefined,
      docUrl: docUrl.trim() || undefined,
      demoUrl: demoUrl.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-sans text-base font-semibold text-ink">Advance Lifecycle Stage</h3>
            <p className="text-xs text-ink-3">{project.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Select Stage to Advance To
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-brand focus:outline-none"
            >
              {STAGES_LIST.map((st, idx) => {
                const pct = Math.min(100, Math.round(((idx + 1) / STAGES_LIST.length) * 100));
                return (
                  <option key={st} value={st}>
                    {st} — ({pct}% progress)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Live Progress Preview */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-2">
                Current: <strong className="text-ink">{project.stage}</strong> ({project.progress}%)
              </span>
              <span className="text-brand font-bold">➔</span>
              <span className="text-ink-2">
                New: <strong className="text-brand">{selectedStage}</strong> ({targetProgress}%)
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Repository / Project Files URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://drive.google.com/... or https://github.com/..."
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Documentation / Report URL
            </label>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/... or OneDrive link"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Live Demo / Presentation Video URL
            </label>
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://... (YouTube, Google Drive, or demo link)"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Progress"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FacultyReviewModal({
  project,
  onClose,
  onSubmit,
  isSubmitting,
  isMedical,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (data: {
    projectId: string;
    architecture: number;
    documentation: number;
    codeQuality: number;
    testing: number;
    innovation: number;
    facultyFeedback: string;
    approve: boolean;
  }) => void;
  isSubmitting: boolean;
  isMedical?: boolean;
}) {
  const [arch, setArch] = useState(project.review.architecture || 75);
  const [doc, setDoc] = useState(project.review.documentation || 70);
  const [code, setCode] = useState(project.review.codeQuality || 75);
  const [test, setTest] = useState(project.review.testing || 65);
  const [innov, setInnov] = useState(project.review.innovation || 80);
  const [feedback, setFeedback] = useState(project.review.facultyFeedback || "");
  const [approve, setApprove] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      projectId: project.id,
      architecture: arch,
      documentation: doc,
      codeQuality: code,
      testing: test,
      innovation: innov,
      facultyFeedback: feedback.trim(),
      approve,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-sans text-base font-semibold text-ink">
              Faculty Review & Milestone Evaluation
            </h3>
            <p className="text-xs text-ink-3">
              {project.title} · Team: {project.team.join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-3">
            <p className="text-xs font-semibold text-ink">Scorecards (0–100)</p>

            {[
              { label: "Architecture / Design", val: arch, set: setArch },
              { label: "Documentation / Specs", val: doc, set: setDoc },
              { label: "Code / Build Quality", val: code, set: setCode },
              { label: "Testing & Validation", val: test, set: setTest },
              { label: "Innovation", val: innov, set: setInnov },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 text-xs">
                <span className="w-36 text-ink-2">{f.label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={f.val}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-brand"
                />
                <span className="w-8 text-right font-semibold tabular-nums text-ink">{f.val}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink">
              Faculty Remarks / Feedback
            </label>
            <textarea
              rows={3}
              required
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Project deliverables verified. Approved to proceed to next milestone."
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={approve}
              onChange={(e) => setApprove(e.target.checked)}
              className="size-4 rounded accent-teal"
            />
            <span>Approve milestone and unlock Demo stage</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Review & Sign-off"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  project,
  onClose,
  onConfirm,
  isDeleting,
}: {
  project: Project;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose/10 text-rose">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h3 className="font-sans text-base font-semibold text-ink">Delete Project</h3>
              <p className="text-xs text-ink-3">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-ink-2">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-ink">"{project.title}"</span>? All recorded
          lifecycle stages, repository links, and review scores will be permanently removed.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

