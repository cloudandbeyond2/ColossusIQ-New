"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { z } from "zod";
import {
  NmcComplianceDataSchema,
  NmcCommittee,
  NmcDepartmentCompliance,
  CreateNmcActionInput,
  UpdateNmcCommitteeInput,
  UpdateNmcProfileInput,
  UpdateNmcDepartmentNormInput,
} from "@/lib/api/nmc-schemas";
import { toCsv } from "@/lib/csv";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type TabKey = "scorecard" | "departments" | "committees" | "actions" | "profile";

export function NmcComplianceModule() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("scorecard");
  const [deptTypeFilter, setDeptTypeFilter] = useState<string>("All Types");
  const [deptSearch, setDeptSearch] = useState<string>("");
  const [actionStatusFilter, setActionStatusFilter] = useState<string>("All");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Add Action Modal State
  const [showAddActionModal, setShowAddActionModal] = useState<boolean>(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionCategory, setNewActionCategory] = useState("Faculty Strength");
  const [newActionPriority, setNewActionPriority] = useState<"High" | "Medium" | "Low">("High");
  const [newActionAssignee, setNewActionAssignee] = useState("");
  const [newActionDueDate, setNewActionDueDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [newActionNotes, setNewActionNotes] = useState("");
  const [actionFormError, setActionFormError] = useState<string | null>(null);

  // Edit Committee Modal State
  const [editingCommittee, setEditingCommittee] = useState<NmcCommittee | null>(null);
  const [commChairperson, setCommChairperson] = useState("");
  const [commConvener, setCommConvener] = useState("");
  const [commMembers, setCommMembers] = useState(0);
  const [commStatus, setCommStatus] = useState<NmcCommittee["status"]>("Constituted & Active");
  const [commLastMeeting, setCommLastMeeting] = useState("");
  const [commNotes, setCommNotes] = useState("");
  const [committeeFormError, setCommitteeFormError] = useState<string | null>(null);

  // Edit Profile Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [profileNmcCode, setProfileNmcCode] = useState("");
  const [profileMbbsSeats, setProfileMbbsSeats] = useState(0);
  const [profileEthicsReg, setProfileEthicsReg] = useState("");
  const [profileCctvStreams, setProfileCctvStreams] = useState(0);
  const [profileCctvTotal, setProfileCctvTotal] = useState(0);
  const [profileLop, setProfileLop] = useState("");
  const [profileLastInspection, setProfileLastInspection] = useState("");
  const [profileNextWindow, setProfileNextWindow] = useState("");
  const [profileAebas, setProfileAebas] = useState(false);
  const [profileMeu, setProfileMeu] = useState(false);

  // Faculty norm modal
  const [normDept, setNormDept] = useState<NmcDepartmentCompliance | null>(null);
  const [normRequired, setNormRequired] = useState("");
  const [normAebas, setNormAebas] = useState("");
  const [normFormError, setNormFormError] = useState<string | null>(null);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["nmc-compliance"],
    queryFn: () => apiFetch("/api/v1/nmc-compliance", NmcComplianceDataSchema),
  });

  const flash = (message: string) => {
    setFlashMessage(message);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Mutations
  const createActionMutation = useMutation({
    mutationFn: (input: CreateNmcActionInput) =>
      apiFetch("/api/v1/nmc-compliance/actions", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      setShowAddActionModal(false);
      setNewActionTitle("");
      setNewActionAssignee("");
      setNewActionNotes("");
      setActionFormError(null);
      flash("Compliance action item logged successfully.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setActionFormError(err.message);
      } else {
        setActionFormError("Failed to add action item. Please check the values entered.");
      }
    },
  });

  const updateActionStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Pending" | "In Progress" | "Resolved" }) =>
      apiFetch(`/api/v1/nmc-compliance/actions/${id}`, z.any(), { method: "PATCH", body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      flash("Action status updated.");
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/nmc-compliance/actions/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      flash("Action item removed.");
    },
  });

  const updateCommitteeMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNmcCommitteeInput }) =>
      apiFetch(`/api/v1/nmc-compliance/committees/${id}`, z.any(), { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      setEditingCommittee(null);
      flash("Statutory committee constitution updated.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setCommitteeFormError(err.message);
      } else {
        setCommitteeFormError("Failed to update committee. Please check the input.");
      }
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: UpdateNmcProfileInput) =>
      apiFetch("/api/v1/nmc-compliance/profile", z.any(), { method: "PUT", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      setShowEditProfileModal(false);
      flash("NMC college profile saved successfully.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setProfileFormError(err.message);
      } else {
        setProfileFormError("Failed to update NMC profile.");
      }
    },
  });

  const seedCommitteesMutation = useMutation({
    mutationFn: () => apiFetch("/api/v1/nmc-compliance/committees/seed", z.object({ added: z.number() }), { method: "POST", body: {} }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      flash(r.added > 0 ? `Added ${r.added} statutory committees. Fill in their details.` : "All standard committees are already listed.");
    },
    onError: (err: unknown) => flash(err instanceof ApiError ? err.message : "Could not add the committees."),
  });

  const updateNormMutation = useMutation({
    mutationFn: (input: UpdateNmcDepartmentNormInput) =>
      apiFetch("/api/v1/nmc-compliance/departments", z.object({ ok: z.boolean() }), { method: "PUT", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nmc-compliance"] });
      setNormDept(null);
      flash("Department norms saved.");
    },
    onError: (err: unknown) => setNormFormError(err instanceof ApiError ? err.message : "Could not save the norms."),
  });

  const openNorms = (d: NmcDepartmentCompliance) => {
    setNormDept(d);
    setNormRequired(d.requiredFaculty === null ? "" : String(d.requiredFaculty));
    setNormAebas(d.aebasAttendance === null ? "" : String(d.aebasAttendance));
    setNormFormError(null);
  };

  const handleNormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normDept) return;
    updateNormMutation.mutate({
      department: normDept.name,
      requiredFaculty: normRequired.trim() === "" ? null : Number(normRequired),
      aebasAttendance: normAebas.trim() === "" ? null : Number(normAebas),
    });
  };

  const openEditCommittee = (c: NmcCommittee) => {
    setEditingCommittee(c);
    setCommChairperson(c.chairperson);
    setCommConvener(c.convener);
    setCommMembers(c.membersCount);
    setCommStatus(c.status);
    setCommLastMeeting(c.lastMeetingDate);
    setCommNotes(c.notes || "");
    setCommitteeFormError(null);
  };

  const openEditProfile = () => {
    if (!data) return;
    setProfileNmcCode(data.profile.nmcCode);
    setProfileMbbsSeats(data.profile.mbbsSeats);
    setProfileEthicsReg(data.profile.ethicsCommitteeRegNo);
    setProfileCctvStreams(data.profile.cctvStreamsOnline);
    setProfileCctvTotal(data.profile.cctvStreamsTotal);
    setProfileLop(data.profile.lopStatus);
    setProfileLastInspection(data.profile.lastInspectionDate);
    setProfileNextWindow(data.profile.nextInspectionWindow);
    setProfileAebas(data.profile.aebasPortalActive);
    setProfileMeu(data.profile.meuCertified);
    setProfileFormError(null);
    setShowEditProfileModal(true);
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim() || !newActionAssignee.trim()) {
      setActionFormError("Please enter both title and assignee.");
      return;
    }
    createActionMutation.mutate({
      title: newActionTitle.trim(),
      category: newActionCategory,
      priority: newActionPriority,
      assignee: newActionAssignee.trim(),
      dueDate: newActionDueDate,
      notes: newActionNotes.trim() || undefined,
    });
  };

  const handleCommitteeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommittee) return;
    updateCommitteeMutation.mutate({
      id: editingCommittee.id,
      input: {
        chairperson: commChairperson.trim(),
        convener: commConvener.trim(),
        membersCount: Number(commMembers),
        status: commStatus,
        lastMeetingDate: commLastMeeting,
        momUploaded: editingCommittee.momUploaded,
        notes: commNotes.trim() || undefined,
      },
    });
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      nmcCode: profileNmcCode.trim(),
      mbbsSeats: Number(profileMbbsSeats),
      ethicsCommitteeRegNo: profileEthicsReg.trim(),
      cctvStreamsOnline: Number(profileCctvStreams),
      cctvStreamsTotal: Number(profileCctvTotal),
      aebasPortalActive: profileAebas,
      meuCertified: profileMeu,
      lopStatus: profileLop.trim(),
      lastInspectionDate: profileLastInspection,
      nextInspectionWindow: profileNextWindow.trim(),
    });
  };

  const filteredDepartments = useMemo(() => {
    if (!data) return [];
    return data.departments.filter((d) => {
      const matchType = deptTypeFilter === "All Types" || d.type === deptTypeFilter;
      const matchQuery = d.name.toLowerCase().includes(deptSearch.toLowerCase());
      return matchType && matchQuery;
    });
  }, [data, deptTypeFilter, deptSearch]);

  const filteredActions = useMemo(() => {
    if (!data) return [];
    return data.actions.filter((a) => {
      if (actionStatusFilter === "All") return true;
      return a.status === actionStatusFilter;
    });
  }, [data, actionStatusFilter]);

  const exportDossierCsv = () => {
    if (!data) return;
    const header = ["Norm ID", "Requirement", "Category", "Current Value", "NMC Norm", "Compliance Score %", "Status", "Remediation"];
    const rows = data.norms.map((n) => [
      n.id,
      n.name,
      n.category,
      n.current,
      n.norm,
      `${n.score}%`,
      n.status,
      n.remediation || "N/A",
    ]);
    const csvContent = toCsv([header, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `nmc-compliance-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        title="Failed to load NMC Council Compliance"
        body="Could not connect to the council verification service or institution registry."
        action={<Button variant="primary" onClick={() => refetch()}>Try Again</Button>}
      />
    );
  }

  const { kpis, norms, departments, committees, profile, strengths, deficiencies } = data;
  const canManage = data.permissions.manage;
  const activeCommittees = committees.filter((c) => c.status === "Constituted & Active").length;

  return (
    <div className="space-y-6">
      {/* Flash Banner */}
      {flashMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <Fi name="check-circle" className="text-emerald-600 dark:text-emerald-400 text-base" />
            <span>{flashMessage}</span>
          </div>
          <button
            onClick={() => setFlashMessage(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">NMC / Council Compliance</h1>
            <Badge tone="teal">MSR 2023 Regulations</Badge>
            {profile.lopStatus && <Badge tone="brand">{profile.lopStatus}</Badge>}
            {profile.nmcCode && <Badge tone="neutral" className="font-mono text-[11px]">{profile.nmcCode}</Badge>}
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            {data.collegeName} &bull; Minimum Standard Requirements (MSR) audit built from your own staff, hospital, skills-lab and committee records.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            {isRefreshing ? <Spinner className="size-3.5" /> : <Fi name="refresh" className="text-xs" />}
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={exportDossierCsv}
            className="flex items-center gap-1.5"
          >
            <Fi name="document" className="text-xs" />
            Download Dossier (CSV)
          </Button>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionFormError(null);
                setShowAddActionModal(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Fi name="plus" className="text-xs" />
              Add Action Item
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--line)] flex gap-2 overflow-x-auto pb-px">
        {[
          { key: "scorecard", label: `MSR Scorecard (${norms.length} Norms)`, icon: "shield-check" },
          { key: "departments", label: `Departments & AEBAS (${departments.length})`, icon: "building" },
          { key: "committees", label: `Statutory Committees (${committees.length})`, icon: "users" },
          { key: "actions", label: `Action Plan (${data.actions.length})`, icon: "clipboard-list" },
          { key: "profile", label: "Council Registration & CCTV", icon: "settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={cn(
              "px-3.5 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line-2)]"
            )}
          >
            <Fi name={tab.icon} className="text-xs" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MSR SCORECARD */}
      {activeTab === "scorecard" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Score */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Council Compliance Score</span>
                  <Badge tone={kpis.overallCompliance === null ? "neutral" : kpis.overallCompliance >= 90 ? "teal" : "amber"}>
                    {data.overallGrade.split(" ")[0]}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.overallCompliance === null ? "—" : `${kpis.overallCompliance}%`}</span>
                  <span className="text-xs text-[var(--ink-2)]">{data.overallStatus}</span>
                </div>
                <Progress value={kpis.overallCompliance ?? 0} tone={kpis.overallCompliance === null ? "neutral" : kpis.overallCompliance >= 90 ? "teal" : "amber"} className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  Average across the norms below that have data recorded.
                </p>
              </CardBody>
            </Card>

            {/* Faculty Strength */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Faculty Adequacy</span>
                  <Badge tone={kpis.facultyAdequacy === null ? "neutral" : kpis.facultyAdequacy >= 90 ? "teal" : "rose"}>Norm: 100%</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.facultyAdequacy === null ? "—" : `${kpis.facultyAdequacy}%`}</span>
                  <span className="text-xs text-[var(--ink-2)]">Of required posts</span>
                </div>
                <Progress value={kpis.facultyAdequacy ?? 0} tone={kpis.facultyAdequacy === null ? "neutral" : kpis.facultyAdequacy >= 90 ? "teal" : "rose"} className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  Staff in post against the required strength you set per department.
                </p>
              </CardBody>
            </Card>

            {/* Biometric AEBAS */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>AEBAS Biometric Attendance</span>
                  <Badge tone={kpis.aebasAverage === null ? "neutral" : kpis.aebasAverage >= 75 ? "teal" : "rose"}>Norm: ≥75%</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.aebasAverage === null ? "—" : `${kpis.aebasAverage}%`}</span>
                  <span className="text-xs text-[var(--ink-2)]">Average</span>
                </div>
                <Progress value={kpis.aebasAverage ?? 0} tone={kpis.aebasAverage === null ? "neutral" : kpis.aebasAverage >= 75 ? "teal" : "rose"} className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  Average of the attendance recorded per department.
                </p>
              </CardBody>
            </Card>

            {/* Hospital Bed Occupancy */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Teaching Hospital Beds</span>
                  <Badge tone={kpis.bedOccupancy === null ? "neutral" : kpis.bedOccupancy >= 80 ? "teal" : "rose"}>Norm: ≥80%</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.bedOccupancy === null ? "—" : `${kpis.bedOccupancy}%`}</span>
                  <span className="text-xs text-[var(--ink-2)]">Occupancy</span>
                </div>
                <Progress value={kpis.bedOccupancy ?? 0} tone={kpis.bedOccupancy === null ? "neutral" : kpis.bedOccupancy >= 80 ? "teal" : "rose"} className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  From the bed census in the Hospital Dashboard.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* MSR Norms Grid */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[var(--ink)]">Mandatory NMC Council Criteria (MSR 2023)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {norms.map((norm) => (
                <Card key={norm.id} className="border-[var(--line)]">
                  <CardBody className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                          {norm.category}
                        </span>
                        <h4 className="font-semibold text-sm text-[var(--ink)]">{norm.name}</h4>
                      </div>
                      <Badge
                        tone={
                          norm.status === "Not Assessed" ? "neutral" : norm.status === "Compliant"
                            ? "teal"
                            : norm.status === "Needs Attention"
                            ? "amber"
                            : "rose"
                        }
                      >
                        {norm.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--ink-3)]">Current Observed:</span>
                        <span className="font-semibold text-[var(--ink)]">{norm.current}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--ink-3)]">NMC Requirement:</span>
                        <span className="font-medium text-[var(--ink-2)]">{norm.norm}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--ink-3)]">Compliance Index</span>
                        <span className="font-bold text-[var(--ink)]">{norm.status === "Not Assessed" ? "—" : `${norm.score}%`}</span>
                      </div>
                      <Progress
                        value={norm.score}
                        tone={norm.status === "Not Assessed" ? "neutral" : norm.score >= 90 ? "teal" : norm.score >= 75 ? "amber" : "rose"}
                        className="h-1.5"
                      />
                    </div>

                    {norm.remediation && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200">
                        <strong>Remediation:</strong> {norm.remediation}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {/* Strengths & Deficiencies Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Fi name="check-circle" className="text-emerald-600 text-base" />
                  <h4 className="font-semibold text-sm text-[var(--ink)]">Institutional Strengths</h4>
                </div>
                <ul className="space-y-1.5 text-xs text-[var(--ink-2)] list-disc pl-5">
                  {strengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Fi name="triangle-warning" className="text-amber-600 text-base" />
                  <h4 className="font-semibold text-sm text-[var(--ink)]">Council Attention Areas & Deficiencies</h4>
                </div>
                <ul className="space-y-1.5 text-xs text-[var(--ink-2)] list-disc pl-5">
                  {deficiencies.map((def, idx) => (
                    <li key={idx}>{def}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS & AEBAS */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {["All Types", "Pre-clinical", "Para-clinical", "Clinical"].map((type) => (
                <button
                  key={type}
                  onClick={() => setDeptTypeFilter(type)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full font-medium transition-colors border",
                    deptTypeFilter === type
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search department..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className={cn(inputClass, "text-xs py-1.5")}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-left text-xs text-[var(--ink-2)]">
              <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                <tr>
                  <th className="p-3">Department</th>
                  <th className="p-3">Specialty Type</th>
                  <th className="p-3">Professors</th>
                  <th className="p-3">Assoc Prof</th>
                  <th className="p-3">Asst Prof</th>
                  <th className="p-3">Senior Residents</th>
                  <th className="p-3">Actual / Required</th>
                  <th className="p-3">AEBAS Punching</th>
                  <th className="p-3">Compliance</th>
                  {canManage && <th className="p-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="p-3 font-medium text-[var(--ink)]">
                      <div>{dept.name}</div>
                      {dept.deficiencyDetails && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                          {dept.deficiencyDetails}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge tone="neutral">{dept.type}</Badge>
                    </td>
                    <td className="p-3 text-[var(--ink)]">{dept.professors}</td>
                    <td className="p-3 text-[var(--ink)]">{dept.assocProfessors}</td>
                    <td className="p-3 text-[var(--ink)]">{dept.asstProfessors}</td>
                    <td className="p-3 text-[var(--ink)]">{dept.seniorResidents}</td>
                    <td className="p-3 font-semibold">
                      <span className={dept.requiredFaculty !== null && dept.actualFaculty < dept.requiredFaculty ? "text-amber-600" : "text-[var(--ink)]"}>
                        {dept.requiredFaculty === null ? `${dept.actualFaculty} / not set` : `${dept.actualFaculty} / ${dept.requiredFaculty}`}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-semibold", (dept.aebasAttendance ?? 100) < 75 ? "text-rose-600" : "text-emerald-600")}>
                          {dept.aebasAttendance === null ? "—" : `${dept.aebasAttendance}%`}
                        </span>
                        <div className="w-12 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full", (dept.aebasAttendance ?? 100) < 75 ? "bg-rose-500" : "bg-emerald-500")}
                            style={{ width: `${dept.aebasAttendance ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        tone={
                          dept.status === "Not Set" ? "neutral" : dept.status === "Compliant"
                            ? "teal"
                            : dept.status === "Needs Attention"
                            ? "amber"
                            : "rose"
                        }
                      >
                        {dept.status}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="p-3">
                        <Button variant="secondary" size="sm" onClick={() => openNorms(dept)} className="text-xs h-7 px-2.5">
                          Set norms
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STATUTORY COMMITTEES */}
      {activeTab === "committees" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Mandated NMC Statutory Committees & Cells</h3>
              <p className="text-xs text-[var(--ink-2)]">
                Statutory committees a medical college is expected to constitute. Record who chairs each and when it last met.
              </p>
            </div>
            <Badge tone={committees.length > 0 && activeCommittees === committees.length ? "teal" : "amber"}>
              {activeCommittees} of {committees.length} Constituted
            </Badge>
          </div>

          {committees.length === 0 && (
            <EmptyState
              title="No committees recorded yet"
              body="Add the standard statutory committees as a starting list, then record the chairperson, members and meeting dates for each."
              action={
                canManage ? (
                  <Button variant="primary" onClick={() => seedCommitteesMutation.mutate()} disabled={seedCommitteesMutation.isPending}>
                    Add standard NMC committees
                  </Button>
                ) : undefined
              }
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {committees.map((comm) => (
              <Card key={comm.id} className="border-[var(--line)] flex flex-col justify-between">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--ink)]">{comm.name}</h4>
                    </div>
                    <Badge tone={comm.status === "Constituted & Active" ? "teal" : comm.status === "Not Constituted" ? "rose" : "amber"}>
                      {comm.status}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-[var(--ink-2)] bg-[var(--surface-2)] p-2 rounded border border-[var(--line)]">
                    {comm.mandate}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--line)]">
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Chairperson</span>
                      <span className="font-medium text-[var(--ink)]">{comm.chairperson || "Not assigned"}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Convener / Secretary</span>
                      <span className="font-medium text-[var(--ink)]">{comm.convener || "Not assigned"}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Members & Frequency</span>
                      <span className="font-medium text-[var(--ink)]">{comm.membersCount} Members &bull; {comm.meetingFrequency}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Last Meeting Date</span>
                      <span className="font-medium text-[var(--ink)]">{comm.lastMeetingDate || "—"}</span>
                    </div>
                  </div>

                  {comm.notes && (
                    <div className="text-[11px] text-[var(--ink-3)] italic">
                      &quot;{comm.notes}&quot;
                    </div>
                  )}

                  {canManage && (
                    <div className="pt-2 border-t border-[var(--line)] flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditCommittee(comm)}
                        className="text-xs h-7 px-2.5"
                      >
                        Edit Committee Details
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ACTION PLAN */}
      {activeTab === "actions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {["All", "Pending", "In Progress", "Resolved"].map((status) => (
                <button
                  key={status}
                  onClick={() => setActionStatusFilter(status)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full font-medium transition-colors border",
                    actionStatusFilter === status
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActionFormError(null);
                  setShowAddActionModal(true);
                }}
                className="flex items-center gap-1.5"
              >
                <Fi name="plus" className="text-xs" />
                Add Action Item
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {filteredActions.map((act) => (
              <Card key={act.id} className="border-[var(--line)]">
                <CardBody className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={act.priority === "High" ? "rose" : act.priority === "Medium" ? "amber" : "neutral"}>
                        {act.priority} Priority
                      </Badge>
                      <Badge tone="neutral">{act.category}</Badge>
                      <h4 className="font-semibold text-sm text-[var(--ink)]">{act.title}</h4>
                    </div>
                    {act.notes && <p className="text-xs text-[var(--ink-2)]">&quot;{act.notes}&quot;</p>}
                    <div className="flex items-center gap-4 text-[11px] text-[var(--ink-3)]">
                      <span>Assignee: <strong className="text-[var(--ink-2)]">{act.assignee}</strong></span>
                      <span>Due: <strong className="text-[var(--ink-2)]">{act.dueDate}</strong></span>
                      {act.resolvedAt && <span>Resolved on: <strong className="text-emerald-600">{act.resolvedAt}</strong></span>}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {act.status !== "In Progress" && act.status !== "Resolved" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateActionStatusMutation.mutate({ id: act.id, status: "In Progress" })}
                          className="text-xs h-7 px-2"
                        >
                          Mark In Progress
                        </Button>
                      )}
                      {act.status !== "Resolved" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateActionStatusMutation.mutate({ id: act.id, status: "Resolved" })}
                          className="text-xs h-7 px-2"
                        >
                          Resolve
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteActionMutation.mutate(act.id)}
                        className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: REGISTRATION & CCTV PROFILE */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">NMC Regulatory Registration & Live Feed Profile</h3>
              <p className="text-xs text-[var(--ink-2)]">
                National Medical Commission recognition details, CCTV central streaming link, and bio-metric setup.
              </p>
            </div>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={openEditProfile} className="flex items-center gap-1.5">
                <Fi name="settings" className="text-xs" />
                Edit Profile
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-3">
                <h4 className="font-semibold text-sm text-[var(--ink)]">College Recognition & Affiliation</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">NMC Institution Code</span>
                    <span className="font-mono font-bold text-[var(--ink)]">{profile.nmcCode || "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Annual MBBS Seat Sanction</span>
                    <span className="font-bold text-[var(--ink)]">{profile.mbbsSeats > 0 ? `${profile.mbbsSeats} Seats` : "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Renewal of Permission (RoP)</span>
                    <span className="font-medium text-[var(--ink)]">{profile.lopStatus || "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Institutional Ethics Reg No</span>
                    <span className="font-mono text-[var(--ink)]">{profile.ethicsCommitteeRegNo || "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--ink-3)]">Upcoming Inspection Window</span>
                    <span className="font-bold text-[var(--ink)]">{profile.nextInspectionWindow || "Not recorded"}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-3">
                <h4 className="font-semibold text-sm text-[var(--ink)]">Digital Surveillance & Biometric Infrastructure</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">NMC Live CCTV Feeds</span>
                    <span className="font-bold text-emerald-600">
                      {profile.cctvStreamsTotal > 0 ? `${profile.cctvStreamsOnline} / ${profile.cctvStreamsTotal} Streams Active` : "Not recorded"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">AEBAS Attendance Integration</span>
                    <Badge tone={profile.aebasPortalActive ? "teal" : "rose"}>
                      {profile.aebasPortalActive ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Medical Education Unit (MEU)</span>
                    <Badge tone={profile.meuCertified ? "teal" : "amber"}>
                      {profile.meuCertified ? "Certified" : "Not certified"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--ink-3)]">Last NMC Physical Inspection</span>
                    <span className="font-medium text-[var(--ink)]">{profile.lastInspectionDate || "Not recorded"}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD ACTION ITEM */}
      {showAddActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Add Compliance Action Item</h3>
                <p className="text-xs text-[var(--ink-2)]">Log an action to address an NMC council deficiency or inspection notice.</p>
              </div>
              <button
                onClick={() => setShowAddActionModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-4 space-y-4">
              {actionFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {actionFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Action Title</label>
                <input
                  type="text"
                  placeholder="e.g. Recruit 2 Assistant Professors in Radiodiagnosis"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Category</label>
                  <select
                    value={newActionCategory}
                    onChange={(e) => setNewActionCategory(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                  >
                    <option value="Faculty Strength">Faculty Strength</option>
                    <option value="Infrastructure & Labs">Infrastructure & Labs</option>
                    <option value="Hospital & Wards">Hospital & Wards</option>
                    <option value="Academic & CBME">Academic & CBME</option>
                    <option value="Statutory Governance">Statutory Governance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Priority</label>
                  <select
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value as "High" | "Medium" | "Low")}
                    className={cn(inputClass, "w-full text-xs")}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Assignee</label>
                  <input
                    type="text"
                    placeholder="e.g. Dean's Office / HOD"
                    value={newActionAssignee}
                    onChange={(e) => setNewActionAssignee(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={newActionDueDate}
                    onChange={(e) => setNewActionDueDate(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Remediation Notes</label>
                <textarea
                  rows={2}
                  value={newActionNotes}
                  onChange={(e) => setNewActionNotes(e.target.value)}
                  placeholder="e.g. Advertisements published; interviews scheduled for next week."
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddActionModal(false)}
                  disabled={createActionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createActionMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {createActionMutation.isPending && <Spinner className="size-3.5" />}
                  Save Action Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT COMMITTEE */}
      {editingCommittee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Edit Committee: {editingCommittee.name}</h3>
                <p className="text-xs text-[var(--ink-2)]">Update office-bearers, members, and meeting compliance.</p>
              </div>
              <button
                onClick={() => setEditingCommittee(null)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCommitteeSubmit} className="p-4 space-y-4">
              {committeeFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {committeeFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Chairperson</label>
                  <input
                    type="text"
                    value={commChairperson}
                    onChange={(e) => setCommChairperson(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Convener / Secretary</label>
                  <input
                    type="text"
                    value={commConvener}
                    onChange={(e) => setCommConvener(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Members Count</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={commMembers}
                    onChange={(e) => setCommMembers(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Constitution Status</label>
                  <select
                    value={commStatus}
                    onChange={(e) => setCommStatus(e.target.value as NmcCommittee["status"])}
                    className={cn(inputClass, "w-full text-xs")}
                  >
                    <option value="Not Constituted">Not Constituted</option>
                    <option value="Constituted & Active">Constituted & Active</option>
                    <option value="Pending Reconstitution">Pending Reconstitution</option>
                    <option value="In Review">In Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Last Meeting Date</label>
                  <input
                    type="date"
                    value={commLastMeeting}
                    onChange={(e) => setCommLastMeeting(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Remarks / Minutes Summary</label>
                <textarea
                  rows={2}
                  value={commNotes}
                  onChange={(e) => setCommNotes(e.target.value)}
                  placeholder="e.g. Minutes of last meeting approved and uploaded to portal."
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingCommittee(null)}
                  disabled={updateCommitteeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateCommitteeMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {updateCommitteeMutation.isPending && <Spinner className="size-3.5" />}
                  Save Committee
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DEPARTMENT NORMS */}
      {normDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">{normDept.name}: Norms</h3>
                <p className="text-xs text-[var(--ink-2)]">Faculty in post is counted from your staff records.</p>
              </div>
              <button onClick={() => setNormDept(null)} className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1">✕</button>
            </div>
            <form onSubmit={handleNormSubmit} className="p-4 space-y-4">
              {normFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">{normFormError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Required faculty</label>
                  <input type="number" min="0" max="200" value={normRequired} onChange={(e) => setNormRequired(e.target.value)} placeholder="Leave blank if not set" className={cn(inputClass, "w-full text-xs")} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">AEBAS attendance %</label>
                  <input type="number" min="0" max="100" step="0.1" value={normAebas} onChange={(e) => setNormAebas(e.target.value)} placeholder="Leave blank if not set" className={cn(inputClass, "w-full text-xs")} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button type="button" variant="secondary" size="sm" onClick={() => setNormDept(null)} disabled={updateNormMutation.isPending}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={updateNormMutation.isPending} className="flex items-center gap-1.5">
                  {updateNormMutation.isPending && <Spinner className="size-3.5" />}
                  Save Norms
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT PROFILE */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Edit NMC College Profile</h3>
                <p className="text-xs text-[var(--ink-2)]">Update code, MBBS intake, and surveillance parameters.</p>
              </div>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {profileFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {profileFormError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">NMC Code</label>
                  <input type="text" value={profileNmcCode} onChange={(e) => setProfileNmcCode(e.target.value)} className={cn(inputClass, "w-full text-xs")} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">MBBS Annual Seats</label>
                  <input type="number" min="0" max="500" value={profileMbbsSeats} onChange={(e) => setProfileMbbsSeats(Number(e.target.value))} className={cn(inputClass, "w-full text-xs")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Total CCTV Cameras</label>
                  <input type="number" min="0" max="1000" value={profileCctvTotal} onChange={(e) => setProfileCctvTotal(Number(e.target.value))} className={cn(inputClass, "w-full text-xs")} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Cameras Streaming</label>
                  <input type="number" min="0" max="1000" value={profileCctvStreams} onChange={(e) => setProfileCctvStreams(Number(e.target.value))} className={cn(inputClass, "w-full text-xs")} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Institutional Ethics Reg No</label>
                <input type="text" value={profileEthicsReg} onChange={(e) => setProfileEthicsReg(e.target.value)} className={cn(inputClass, "w-full text-xs")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Permission Status</label>
                <input type="text" value={profileLop} onChange={(e) => setProfileLop(e.target.value)} placeholder="e.g. Renewal of permission granted" className={cn(inputClass, "w-full text-xs")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Last Inspection</label>
                  <input type="date" value={profileLastInspection} onChange={(e) => setProfileLastInspection(e.target.value)} className={cn(inputClass, "w-full text-xs")} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Next Inspection Window</label>
                  <input type="text" value={profileNextWindow} onChange={(e) => setProfileNextWindow(e.target.value)} placeholder="e.g. Jan - Mar 2027" className={cn(inputClass, "w-full text-xs")} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--ink)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={profileAebas} onChange={(e) => setProfileAebas(e.target.checked)} /> AEBAS connected</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={profileMeu} onChange={(e) => setProfileMeu(e.target.checked)} /> MEU certified</label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditProfileModal(false)}
                  disabled={updateProfileMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {updateProfileMutation.isPending && <Spinner className="size-3.5" />}
                  Save Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
