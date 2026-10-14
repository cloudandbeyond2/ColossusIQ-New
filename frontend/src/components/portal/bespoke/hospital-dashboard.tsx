"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { z } from "zod";
import {
  HospitalOverviewSchema,
  HospitalDepartment,
  HospitalRotationItem,
  UpdateHospitalCensusInput,
  CertifyRotationInput,
} from "@/lib/api/hospital-schemas";
import { toCsv } from "@/lib/csv";
import { TemplateSkeleton } from "@/components/modules/shared";
import { ChartView } from "@/components/charts/chart-card";
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
import type { Role } from "@/lib/auth/roles";

type TabKey = "overview" | "departments" | "rotations" | "nmc-compliance" | "census-log";

export function HospitalDashboardModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Census modal state
  const [showCensusModal, setShowCensusModal] = useState<boolean>(false);
  const [selectedDeptForCensus, setSelectedDeptForCensus] = useState<string>("");
  const [censusOpd, setCensusOpd] = useState<number>(120);
  const [censusIpd, setCensusIpd] = useState<number>(10);
  const [censusOccupiedBeds, setCensusOccupiedBeds] = useState<number>(110);
  const [censusSurgeries, setCensusSurgeries] = useState<number>(0);
  const [censusDeliveries, setCensusDeliveries] = useState<number>(0);
  const [censusNotes, setCensusNotes] = useState<string>("");
  const [censusError, setCensusError] = useState<string | null>(null);

  // Rotation sign-off modal state
  const [showCertifyModal, setShowCertifyModal] = useState<boolean>(false);
  const [certifyingRotation, setCertifyingRotation] = useState<HospitalRotationItem | null>(null);
  const [certifyCompetencies, setCertifyCompetencies] = useState<number>(1);
  const [certifyAttendance, setCertifyAttendance] = useState<number>(90);
  const [certifyRemarks, setCertifyRemarks] = useState<string>("");
  const [certifyError, setCertifyError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hospital-overview"],
    queryFn: () => apiFetch("/api/v1/hospital/overview", HospitalOverviewSchema),
    refetchInterval: 30_000,
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

  const censusMutation = useMutation({
    mutationFn: (input: UpdateHospitalCensusInput) =>
      apiFetch("/api/v1/hospital/census", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hospital-overview"] });
      setShowCensusModal(false);
      setCensusNotes("");
      setCensusError(null);
      flash("Ward census recorded successfully and NMC compliance norms recalculated.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setCensusError(err.message);
      } else {
        setCensusError("Failed to record census. Please check the values entered.");
      }
    },
  });

  const certifyMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CertifyRotationInput }) =>
      apiFetch(`/api/v1/hospital/rotations/${id}/certify`, z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hospital-overview"] });
      setShowCertifyModal(false);
      setCertifyingRotation(null);
      setCertifyRemarks("");
      setCertifyError(null);
      flash("Clinical rotation certified. CBME logbook updated.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setCertifyError(err.message);
      } else {
        setCertifyError("Failed to certify clinical rotation.");
      }
    },
  });

  const openCensusModalFor = (dept?: HospitalDepartment) => {
    if (dept) {
      setSelectedDeptForCensus(dept.name);
      setCensusOpd(dept.opdDaily);
      setCensusIpd(dept.ipdAdmissionsDaily);
      setCensusOccupiedBeds(dept.occupiedBeds);
      setCensusSurgeries(dept.surgeriesMonthly ? Math.round(dept.surgeriesMonthly / 25) : 0);
      setCensusDeliveries(dept.deliveriesMonthly ? Math.round(dept.deliveriesMonthly / 25) : 0);
    } else if (data && data.departments.length > 0) {
      const first = data.departments[0];
      if (first) {
        setSelectedDeptForCensus(first.name);
        setCensusOpd(first.opdDaily);
        setCensusIpd(first.ipdAdmissionsDaily);
        setCensusOccupiedBeds(first.occupiedBeds);
      }
      setCensusSurgeries(0);
      setCensusDeliveries(0);
    }
    setCensusNotes("");
    setCensusError(null);
    setShowCensusModal(true);
  };

  const openCertifyModalFor = (rot: HospitalRotationItem) => {
    setCertifyingRotation(rot);
    setCertifyCompetencies(rot.competenciesSigned + 1);
    setCertifyAttendance(rot.attendance);
    setCertifyRemarks("");
    setCertifyError(null);
    setShowCertifyModal(true);
  };

  const handleCensusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptForCensus) {
      setCensusError("Please select a department.");
      return;
    }
    censusMutation.mutate({
      department: selectedDeptForCensus,
      opd: Number(censusOpd),
      ipdAdmissions: Number(censusIpd),
      occupiedBeds: Number(censusOccupiedBeds),
      surgeries: Number(censusSurgeries) || undefined,
      deliveries: Number(censusDeliveries) || undefined,
      notes: censusNotes.trim() || undefined,
    });
  };

  const handleCertifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certifyingRotation) return;
    certifyMutation.mutate({
      id: certifyingRotation.id,
      input: {
        rotationId: certifyingRotation.id,
        competenciesSigned: Number(certifyCompetencies),
        attendance: Number(certifyAttendance),
        remarks: certifyRemarks.trim() || undefined,
      },
    });
  };

  const filteredDepartments = useMemo(() => {
    if (!data) return [];
    return data.departments.filter((d) => {
      const matchesCat = selectedCategory === "All Categories" || d.category === selectedCategory;
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.hod.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [data, selectedCategory, searchQuery]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Department", "Category", "HOD", "Teaching Beds", "Occupied Beds", "Occupancy %", "Daily OPD", "Daily IPD", "Status"];
    const rows = data.departments.map((d) => [
      d.name,
      d.category,
      d.hod,
      d.teachingBeds,
      d.occupiedBeds,
      `${d.occupancyPercent}%`,
      d.opdDaily,
      d.ipdAdmissionsDaily,
      d.status,
    ]);
    const csvContent = toCsv([header, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `teaching-hospital-census-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportNmcCsv = () => {
    if (!data) return;
    const header = ["Norm ID", "Requirement", "Current Observed", "Mandated Standard", "Compliance Status", "Remediation"];
    const rows = data.nmcNorms.map((n) => [
      n.id,
      n.title,
      n.currentValue,
      n.normRequirement,
      n.status,
      n.remediation || "N/A",
    ]);
    const csvContent = toCsv([header, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `nmc-msr-compliance-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        title="Failed to load Teaching Hospital data"
        body="Could not connect to the hospital information system or live census feed."
        action={<Button variant="primary" onClick={() => refetch()}>Try Again</Button>}
      />
    );
  }

  const { kpis, departments, nmcNorms, recentLogs, activeRotations, monthlyTrends } = data;
  const isOccupancyCompliant = kpis.occupancyRate >= 80;

  // Chart data for departmental beds
  const deptBedChartData = departments.slice(0, 7).map((d) => ({
    dept: d.name.replace("General ", "Gen. ").replace("Respiratory ", "Resp. "),
    Occupied: d.occupiedBeds,
    Available: Math.max(0, d.teachingBeds - d.occupiedBeds),
  }));

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

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Teaching Hospital Management</h1>
            <Badge tone="teal">Medical Stream</Badge>
            <Badge tone="sky">NMC MSR 2023 Norms</Badge>
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            {data.hospitalName} &bull; Live inpatient census, outpatient footfall, CBME rotation postings, and council compliance.
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
            onClick={exportCsv}
            className="flex items-center gap-1.5"
          >
            <Fi name="document" className="text-xs" />
            Export Census CSV
          </Button>
          {(role === "institution" || role === "hod" || role === "admin") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCensusModalFor()}
              className="flex items-center gap-1.5"
            >
              <Fi name="plus" className="text-xs" />
              Update Daily Census
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--line)] flex gap-2 overflow-x-auto pb-px">
        {[
          { key: "overview", label: "Overview & Live Census", icon: "dashboard" },
          { key: "departments", label: `Wards & Departments (${departments.length})`, icon: "building" },
          { key: "rotations", label: `CBME Rotations (${activeRotations.length})`, icon: "stethoscope" },
          { key: "nmc-compliance", label: `NMC Council Audit (${nmcNorms.length})`, icon: "shield-check" },
          { key: "census-log", label: `Audit Trail (${recentLogs.length})`, icon: "scroll" },
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bed Occupancy Card */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Bed Occupancy Rate</span>
                  <Badge tone={isOccupancyCompliant ? "teal" : "rose"}>
                    NMC Min: 80%
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.occupancyRate}%</span>
                  <span className="text-xs text-[var(--ink-2)]">
                    ({kpis.occupiedBeds} / {kpis.totalBeds} beds)
                  </span>
                </div>
                <Progress value={kpis.occupancyRate} tone={isOccupancyCompliant ? "teal" : "rose"} className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  {isOccupancyCompliant
                    ? "Compliant with NMC MSR 2023 regulations (≥80% requirement)."
                    : "Deficiency alert: Occupancy is below the mandatory 80% threshold."}
                </p>
              </CardBody>
            </Card>

            {/* Daily OPD Footfall */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Daily OPD Footfall</span>
                  <Badge tone="teal">Norm: ≥1,200/day</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.dailyOpd.toLocaleString()}</span>
                  <span className="text-xs text-emerald-600 font-medium">Patients/Day</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--ink-2)]">
                  <span>IPD Admissions: {kpis.dailyIpdAdmissions}</span>
                  <span>Discharges: {kpis.dailyDischarges}</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  Adequate clinical material available for bedside CBME training.
                </p>
              </CardBody>
            </Card>

            {/* ICU & Trauma Care */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Critical Care (ICU / ICCU)</span>
                  <Badge tone="amber">
                    {Math.round((kpis.icuOccupiedBeds / kpis.totalIcuBeds) * 100)}% Load
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">
                    {kpis.icuOccupiedBeds} / {kpis.totalIcuBeds}
                  </span>
                  <span className="text-xs text-[var(--ink-2)]">Beds Occupied</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--ink-2)]">
                  <span>Emergency 24x7: {kpis.emergencyFootfall} pts</span>
                  <span>Ratio: {( (kpis.totalIcuBeds / kpis.totalBeds) * 100 ).toFixed(1)}% (Norm ≥10%)</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  ICU, ICCU, NICU, PICU & Trauma triage units operational.
                </p>
              </CardBody>
            </Card>

            {/* Council Compliance Score */}
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>NMC / Council Compliance</span>
                  <Badge tone="brand">Annual Audit</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {kpis.nmcComplianceScore}%
                  </span>
                  <span className="text-xs text-[var(--ink-2)]">Overall Index</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--ink-2)]">
                  <span>Surgeries: {kpis.monthlySurgeries}/mo</span>
                  <span>Deliveries: {kpis.monthlyDeliveries}/mo</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  Bedside case exposure: {kpis.clinicalMaterialAvg} cases/wk (Norm ≥15)
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend Chart */}
            <Card className="border-[var(--line)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--ink)]">6-Month Clinical Material Trend</h3>
                  <p className="text-xs text-[var(--ink-2)]">OPD Footfall (÷10), IPD Admissions & Bed Occupancy %</p>
                </div>
                <Badge tone="neutral">Live HIS Sync</Badge>
              </div>
              <ChartView
                spec={{
                  type: "line",
                  title: "6-Month Trend",
                  data: monthlyTrends,
                  xKey: "name",
                  series: ["opdDivided10", "ipd", "occupancy"],
                }}
                height={260}
              />
            </Card>

            {/* Department Bed Occupancy Bar Chart */}
            <Card className="border-[var(--line)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--ink)]">Teaching Bed Distribution by Specialty</h3>
                  <p className="text-xs text-[var(--ink-2)]">Occupied vs Available Teaching Beds</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("departments")} className="text-xs">
                  View All &rarr;
                </Button>
              </div>
              <ChartView
                spec={{
                  type: "bar",
                  title: "Bed Distribution",
                  data: deptBedChartData,
                  xKey: "dept",
                  series: ["Occupied", "Available"],
                }}
                height={260}
              />
            </Card>
          </div>

          {/* Quick Department Snapshot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--ink)]">Clinical Department Census Snapshot</h3>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab("departments")}>
                Manage All 11 Wards
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.slice(0, 3).map((dept) => (
                <Card key={dept.id} className="border-[var(--line)]">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-[var(--ink)]">{dept.name}</h4>
                        <p className="text-xs text-[var(--ink-2)]">{dept.hod}</p>
                      </div>
                      <Badge
                        tone={
                          dept.status === "Optimal"
                            ? "teal"
                            : dept.status === "Surplus"
                            ? "sky"
                            : "amber"
                        }
                      >
                        {dept.status}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--ink-2)]">Bed Occupancy:</span>
                        <span className="font-semibold text-[var(--ink)]">
                          {dept.occupiedBeds} / {dept.teachingBeds} ({dept.occupancyPercent}%)
                        </span>
                      </div>
                      <Progress
                        value={dept.occupancyPercent}
                        tone={dept.occupancyPercent >= 80 ? "teal" : "amber"}
                        className="h-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[var(--line)]">
                      <div>
                        <span className="text-[var(--ink-3)] block">Daily OPD</span>
                        <span className="font-semibold text-[var(--ink)]">{dept.opdDaily} pts</span>
                      </div>
                      <div>
                        <span className="text-[var(--ink-3)] block">Active Students</span>
                        <span className="font-semibold text-teal-600 dark:text-teal-400">{dept.activeStudents} MBBS</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WARDS & DEPARTMENTS */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {["All Categories", "Medicine & Allied", "Surgery & Allied", "OBG & Paediatrics", "Emergency & Critical Care"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full font-medium transition-colors border",
                      selectedCategory === cat
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                    )}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search department or HOD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(inputClass, "text-xs py-1.5")}
              />
            </div>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => (
              <Card key={dept.id} className="border-[var(--line)] flex flex-col justify-between">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                        {dept.category}
                      </span>
                      <h4 className="font-bold text-sm text-[var(--ink)]">{dept.name}</h4>
                      <p className="text-xs text-[var(--ink-2)] mt-0.5">HOD: {dept.hod}</p>
                    </div>
                    <Badge
                      tone={
                        dept.status === "Optimal"
                          ? "teal"
                          : dept.status === "Surplus"
                          ? "sky"
                          : "amber"
                      }
                    >
                      {dept.status}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--ink-2)]">Bed Occupancy</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {dept.occupiedBeds} / {dept.teachingBeds} ({dept.occupancyPercent}%)
                      </span>
                    </div>
                    <Progress
                      value={dept.occupancyPercent}
                      tone={dept.occupancyPercent >= 80 ? "teal" : "amber"}
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--line)]">
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Daily Outpatients</span>
                      <span className="font-semibold text-[var(--ink)]">{dept.opdDaily} pts/day</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Daily Admissions</span>
                      <span className="font-semibold text-[var(--ink)]">{dept.ipdAdmissionsDaily} pts/day</span>
                    </div>
                    {dept.surgeriesMonthly !== undefined && (
                      <div>
                        <span className="text-[11px] text-[var(--ink-3)] block">Surgeries (Monthly)</span>
                        <span className="font-semibold text-[var(--ink)]">{dept.surgeriesMonthly} cases</span>
                      </div>
                    )}
                    {dept.deliveriesMonthly !== undefined && (
                      <div>
                        <span className="text-[11px] text-[var(--ink-3)] block">Deliveries (Monthly)</span>
                        <span className="font-semibold text-[var(--ink)]">{dept.deliveriesMonthly} cases</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Student Cases / Wk</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {dept.studentCasesWeekly} / {dept.cbmeTargetCases} target
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--ink-3)] block">Active Students</span>
                      <span className="font-semibold text-teal-600 dark:text-teal-400">
                        {dept.activeStudents} Posting
                      </span>
                    </div>
                  </div>

                  {dept.statusNotes && (
                    <div className="p-2 rounded bg-[var(--surface-2)] text-[11px] text-[var(--ink-2)] border border-[var(--line)]">
                      {dept.statusNotes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--ink-3)]">
                      {dept.units.length} Unit{dept.units.length > 1 ? "s" : ""}: {dept.units.join(", ")}
                    </span>
                    {(role === "institution" || role === "hod" || role === "admin") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openCensusModalFor(dept)}
                        className="text-xs h-7 px-2.5"
                      >
                        Record Census
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CBME ROTATIONS */}
      {activeTab === "rotations" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Active Clinical Postings & CBME Sign-Offs</h3>
              <p className="text-xs text-[var(--ink-2)]">
                MBBS Phase II, Phase III & Internship (CRMI) clinical ward postings synchronized from academic rotations.
              </p>
            </div>
            <Badge tone="teal">
              NMC CBME Logbook Norms
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-left text-xs text-[var(--ink-2)]">
              <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                <tr>
                  <th className="p-3">Student & Reg No</th>
                  <th className="p-3">Phase</th>
                  <th className="p-3">Department & Unit</th>
                  <th className="p-3">Posting Period</th>
                  <th className="p-3">Clinical Supervisor</th>
                  <th className="p-3">Attendance</th>
                  <th className="p-3">Competencies Signed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {activeRotations.map((rot) => (
                  <tr key={rot.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="p-3 font-medium text-[var(--ink)]">
                      <div>{rot.student}</div>
                      <div className="text-[11px] text-[var(--ink-3)] font-mono">{rot.regNo}</div>
                    </td>
                    <td className="p-3">
                      <Badge tone="neutral">
                        {rot.phase}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[var(--ink)]">{rot.department}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">{rot.unit}</div>
                    </td>
                    <td className="p-3 text-[11px]">
                      {rot.startDate} &rarr; {rot.endDate}
                    </td>
                    <td className="p-3 text-[var(--ink)]">{rot.supervisor}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-semibold", rot.attendance < 75 ? "text-rose-600" : "text-emerald-600")}>
                          {rot.attendance}%
                        </span>
                        <div className="w-12 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full", rot.attendance < 75 ? "bg-rose-500" : "bg-emerald-500")}
                            style={{ width: `${rot.attendance}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-[var(--ink)]">{rot.competenciesSigned}</span>
                      <span className="text-[var(--ink-3)]"> / 8 certified</span>
                    </td>
                    <td className="p-3">
                      <Badge
                        tone={rot.status === "Active" ? "teal" : "sky"}
                      >
                        {rot.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {(role === "institution" || role === "hod" || role === "faculty" || role === "admin") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openCertifyModalFor(rot)}
                          className="text-xs h-7 px-2.5"
                        >
                          Certify Sign-Off
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: NMC / COUNCIL AUDIT */}
      {activeTab === "nmc-compliance" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">
                NMC Minimum Standard Requirements (MSR) Compliance Audit
              </h3>
              <p className="text-xs text-[var(--ink-2)]">
                Assessed against NMC Undergraduate Medical Education Board (UGMEB) Regulations 2023.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={exportNmcCsv} className="flex items-center gap-1.5">
                <Fi name="document" className="text-xs" />
                Download NMC Dossier CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nmcNorms.map((norm) => (
              <Card key={norm.id} className="border-[var(--line)]">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-[var(--ink)]">{norm.title}</h4>
                    <Badge
                      tone={
                        norm.status === "Pass"
                          ? "teal"
                          : norm.status === "Warning"
                          ? "amber"
                          : "rose"
                      }
                    >
                      {norm.status}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-3)]">Current Observed:</span>
                      <span className="font-bold text-[var(--ink)]">{norm.currentValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-3)]">NMC Requirement:</span>
                      <span className="font-medium text-[var(--ink-2)]">{norm.normRequirement}</span>
                    </div>
                  </div>

                  {norm.remediation && (
                    <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200">
                      <strong>Remediation Note:</strong> {norm.remediation}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === "census-log" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Daily Ward Census & Certification Audit Log</h3>
              <p className="text-xs text-[var(--ink-2)]">
                Immutable record of clinical bed adjustments, attendance updates, and CBME competency sign-offs.
              </p>
            </div>
            <Badge tone="neutral">
              Live Audit Trail
            </Badge>
          </div>

          <div className="space-y-3">
            {recentLogs.map((log) => (
              <Card key={log.id} className="border-[var(--line)]">
                <CardBody className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" className="font-mono">
                        {log.department}
                      </Badge>
                      <span className="text-xs font-semibold text-[var(--ink)]">{log.summary}</span>
                    </div>
                    {log.notes && <p className="text-xs text-[var(--ink-2)] italic">&quot;{log.notes}&quot;</p>}
                    <div className="text-[11px] text-[var(--ink-3)]">
                      Recorded by: <span className="font-medium text-[var(--ink-2)]">{log.actor}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[var(--ink-3)] whitespace-nowrap self-start sm:self-center">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: UPDATE WARD CENSUS */}
      {showCensusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Record Daily Ward Census</h3>
                <p className="text-xs text-[var(--ink-2)]">Update daily bed occupancy, OPD footfall and surgical counts.</p>
              </div>
              <button
                onClick={() => setShowCensusModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCensusSubmit} className="p-4 space-y-4">
              {censusError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {censusError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Clinical Department</label>
                <select
                  value={selectedDeptForCensus}
                  onChange={(e) => {
                    setSelectedDeptForCensus(e.target.value);
                    const found = departments.find((d) => d.name === e.target.value);
                    if (found) {
                      setCensusOpd(found.opdDaily);
                      setCensusIpd(found.ipdAdmissionsDaily);
                      setCensusOccupiedBeds(found.occupiedBeds);
                    }
                  }}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.teachingBeds} Beds)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Occupied Teaching Beds</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={censusOccupiedBeds}
                    onChange={(e) => setCensusOccupiedBeds(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Today's OPD Footfall</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={censusOpd}
                    onChange={(e) => setCensusOpd(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">IPD Admissions</label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={censusIpd}
                    onChange={(e) => setCensusIpd(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Surgeries Today</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={censusSurgeries}
                    onChange={(e) => setCensusSurgeries(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Deliveries Today</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={censusDeliveries}
                    onChange={(e) => setCensusDeliveries(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Clinical Remarks / Nurse Notes</label>
                <textarea
                  rows={2}
                  value={censusNotes}
                  onChange={(e) => setCensusNotes(e.target.value)}
                  placeholder="e.g. Ward 4B renovated; 12 emergency admissions during night shift."
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCensusModal(false)}
                  disabled={censusMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={censusMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {censusMutation.isPending && <Spinner className="size-3.5" />}
                  Save Ward Census
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CERTIFY ROTATION & SIGN-OFF */}
      {showCertifyModal && certifyingRotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Certify CBME Clinical Rotation</h3>
                <p className="text-xs text-[var(--ink-2)]">Sign off competencies and update student attendance record.</p>
              </div>
              <button
                onClick={() => setShowCertifyModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCertifySubmit} className="p-4 space-y-4">
              {certifyError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {certifyError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-[var(--surface-2)] space-y-1 text-xs">
                <div className="font-bold text-[var(--ink)]">{certifyingRotation.student}</div>
                <div className="text-[var(--ink-2)]">
                  {certifyingRotation.regNo} &bull; {certifyingRotation.phase}
                </div>
                <div className="text-[var(--ink-3)]">
                  {certifyingRotation.department} ({certifyingRotation.unit})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">
                    Certified Competencies (Total: 8)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="8"
                    value={certifyCompetencies}
                    onChange={(e) => setCertifyCompetencies(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Attendance Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={certifyAttendance}
                    onChange={(e) => setCertifyAttendance(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Faculty Sign-Off Remarks</label>
                <textarea
                  rows={2}
                  value={certifyRemarks}
                  onChange={(e) => setCertifyRemarks(e.target.value)}
                  placeholder="e.g. Demonstrated satisfactory bedside clinical examination skills; logbook verified."
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCertifyModal(false)}
                  disabled={certifyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={certifyMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {certifyMutation.isPending && <Spinner className="size-3.5" />}
                  Sign Off & Certify
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
