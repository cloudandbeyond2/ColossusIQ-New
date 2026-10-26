import "server-only";
import { RESOURCES } from "@/config/resources";
import type {
  ChartSpec,
  CreateInterventionInput,
  DepartmentSkillsData,
  Insight,
  Kpi,
  SkillGapItem,
  SkillIntervention,
  SkillStudent,
  TopHiringPartner,
} from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { computeReadiness, READINESS_RULES } from "./learning";
import { getCollege } from "./records";
import { supportData } from "./support-data";
import { resolveCollegeId, SupportError } from "./early-warning";

export async function createIntervention(
  session: SessionPayload,
  input: CreateInterventionInput
): Promise<SkillIntervention> {
  const collegeId = await resolveCollegeId(session.college);
  const item = await supportData().addSkill(collegeId, {
    title: input.title.trim(),
    department: input.department.trim(),
    batch: input.batch.trim(),
    targetSkill: input.targetSkill.trim(),
    facultyLead: input.facultyLead.trim(),
    duration: input.duration.trim(),
    authorSub: session.sub,
  });
  if (!item) throw new SupportError("Could not save the programme.", 404);
  await getStore().audit.add({
    actor: session.name,
    action: `Created skill programme: ${item.title}`,
    target: "department-skills",
    collegeId,
    actorSub: session.sub,
  });
  return item;
}

function deriveBatch(rollNo: string): string {
  const clean = rollNo.replace(/\D/g, "");
  if (clean.startsWith("21") || clean.startsWith("23")) return "2023–2027 (Final Year)";
  if (clean.startsWith("22") || clean.startsWith("24")) return "2024–2028 (3rd Year)";
  if (clean.startsWith("25")) return "2025–2029 (2nd Year)";
  if (clean.startsWith("26")) return "2026–2030 (1st Year)";
  return "2023–2027 (Final Year)";
}

export async function getDepartmentSkillsOverview(
  session: SessionPayload,
  filterDept = "all",
  filterBatch = "all",
  filterDomain = "all"
): Promise<DepartmentSkillsData> {
  const collegeId = await resolveCollegeId(session.college);
  const college = await getCollege(collegeId);

  const collegeTitle = String(college?.name ?? "College");
  const store = getStore();

  // 1. Fetch REAL Departments for this college from the store
  const dbDepartments = await store.records.all(RESOURCES.departments!, collegeId);
  const actualDeptNames = [
    ...new Set(dbDepartments.map((d) => String(d.department || "")).filter(Boolean)),
  ];

  const availableDepartments = [
    "All Departments",
    ...(actualDeptNames.length > 0 ? actualDeptNames : ["General"]),
  ];

  // If HOD is logged in and assigned to a specific department, default to their department
  let effectiveDept = filterDept;
  if (session.role === "hod" && filterDept === "all") {
    // Check user record
    const userRec = await store.records.get(RESOURCES.users!, session.sub);
    if (userRec?.department && typeof userRec.department === "string") {
      effectiveDept = userRec.department;
    }
  }

  const isDeptSpecific = effectiveDept !== "all" && effectiveDept !== "All Departments";
  const isBatchSpecific = filterBatch !== "all" && filterBatch !== "All Batches";
  const isDomainSpecific = filterDomain !== "all" && filterDomain !== "All Domains";

  // 2. Fetch REAL Staff (teaching faculty) for this college
  const dbStaff = await store.records.all(RESOURCES.staff!, collegeId);
  const teachingStaff = dbStaff.filter(
    (s) => s.status === "Active" && (s.staffType === "Teaching" || !s.staffType)
  );
  const availableFaculty = [
    ...new Set(teachingStaff.map((s) => String(s.fullName || "")).filter(Boolean)),
  ];

  // 3. Fetch REAL Courses for this college
  const dbCourses = await store.records.all(RESOURCES.courses!, collegeId);
  const filteredCourses = dbCourses.filter((c) => {
    if (isDeptSpecific && String(c.department) !== effectiveDept) return false;
    if (isDomainSpecific && String(c.courseType || "Theory") !== filterDomain) return false;
    return true;
  });

  const availableDomains = [
    "All Domains",
    ...new Set(dbCourses.map((c) => String(c.courseType || "Theory")).filter(Boolean)),
  ];

  // 4. Fetch REAL Students & Readiness for this college
  const rawBoard = await store.readiness.board(collegeId);
  const evaluatedStudents = rawBoard.map(computeReadiness);

  const filteredStudents = evaluatedStudents.filter((s) => {
    if (isDeptSpecific && s.department !== effectiveDept) return false;
    if (isBatchSpecific && deriveBatch(s.rollNo) !== filterBatch) return false;
    return true;
  });

  // 5. Fetch REAL Certificates & Quizzes & Attempts
  const dbCertificates = await store.certificates.list({ scope: collegeId });
  const filteredCertificates = dbCertificates.filter((cert) => {
    if (isDeptSpecific && cert.department !== effectiveDept) return false;
    return true;
  });

  const dbQuizzes = await store.quizzes.list(collegeId);
  const dbAttempts = await store.attempts.list({ collegeId });

  // 6. Compute REAL Student Roster
  const students: SkillStudent[] = filteredStudents.map((s, idx) => {
    // Collect courses belonging to their department
    const deptCourses = dbCourses.filter((c) => !s.department || String(c.department) === s.department);
    const topSkills: string[] = deptCourses.slice(0, 3).map((c) => String(c.title));

    if (topSkills.length === 0) {
      if (s.aptitude >= 60) topSkills.push("Analytical Problem Solving");
      if (s.interview >= 50) topSkills.push("Technical Communication");
      if (s.quizAverage >= 60) topSkills.push("Core Subject Fundamentals");
    }

    return {
      id: s.studentSub || `stu-${idx + 1}`,
      name: s.name,
      rollNo: s.rollNo,
      department: s.department,
      batch: deriveBatch(s.rollNo),
      overallScore: s.total,
      topSkills,
      gapAreas: s.gaps.length > 0 ? s.gaps.slice(0, 3) : ["All criteria met"],
      certifications: s.certificates,
      status: s.status,
    };
  });

  // 7. Compute REAL Skill Gap Matrix from actual courses & student marks
  const TARGET_BENCHMARK = 75; // Passing & industry mastery target
  const skillGaps: SkillGapItem[] = filteredCourses.map((c, idx) => {
    const courseTitle = String(c.title || "Course");
    const courseDept = String(c.department || "");
    const courseFaculty = String(c.faculty || "Department Faculty");

    // Match real attempts for this course
    const matchingQuizzes = dbQuizzes.filter(
      (q) =>
        String(q.course || "").toLowerCase() === courseTitle.toLowerCase() ||
        String(q.department || "").toLowerCase() === courseDept.toLowerCase()
    );
    const quizIds = new Set(matchingQuizzes.map((q) => q.id));
    const courseAttempts = dbAttempts.filter((a) => quizIds.has(a.quizId));

    let readinessScore = 0;
    if (courseAttempts.length > 0) {
      readinessScore = Math.round(
        courseAttempts.reduce((sum, a) => sum + a.percentage, 0) / courseAttempts.length
      );
    } else {
      // Real average from students belonging to this department
      const deptStudents = filteredStudents.filter((st) => !courseDept || st.department === courseDept);
      readinessScore =
        deptStudents.length > 0
          ? Math.round(deptStudents.reduce((sum, st) => sum + st.quizAverage, 0) / deptStudents.length)
          : 0;
    }

    const gap = readinessScore - TARGET_BENCHMARK;
    let urgency: SkillGapItem["urgency"] = "On Track";
    if (gap <= -20) urgency = "Critical";
    else if (gap <= -10) urgency = "High";
    else if (gap <= 0) urgency = "Moderate";

    const assessedCount = filteredStudents.filter(
      (st) => !courseDept || st.department === courseDept
    ).length;

    return {
      id: String(c.id || `skl-${idx + 1}`),
      skill: `${courseTitle} (${String(c.code || "CRS")})`,
      category: String(c.courseType || "Theory"),
      demandScore: TARGET_BENCHMARK,
      readinessScore,
      gap,
      urgency,
      studentsAssessed: assessedCount,
      topRolesRequiring: [
        `${courseDept || "Department"} Graduate`,
        "Core Technical Associate",
      ],
      recommendedIntervention: `Schedule remedial lab & tutorial sessions for ${courseTitle} led by ${courseFaculty}.`,
    };
  });

  // 8. Compute REAL KPIs
  const totalProfiled = filteredStudents.length;
  const readyCount = filteredStudents.filter((s) => s.status === "Placement ready").length;
  const jobReadyPct = totalProfiled > 0 ? Math.round((readyCount / totalProfiled) * 100) : 0;
  const criticalGapsCount = skillGaps.filter(
    (s) => s.urgency === "Critical" || s.urgency === "High"
  ).length;
  const certsCount = filteredCertificates.length;
  const avgProficiency =
    totalProfiled > 0
      ? Math.round(filteredStudents.reduce((sum, s) => sum + s.total, 0) / totalProfiled)
      : 0;

  const kpis: Kpi[] = [
    {
      label: "Students Profiled",
      value: totalProfiled.toLocaleString(),
      delta: isDeptSpecific ? `${effectiveDept}` : "Across active departments",
      tone: "brand",
      hint: "Enrolled students evaluated in active cohort",
    },
    {
      label: "Placement Ready",
      value: `${jobReadyPct}%`,
      delta: `${readyCount} of ${totalProfiled} qualified`,
      tone: jobReadyPct >= 65 ? "teal" : jobReadyPct >= 40 ? "gold" : "amber",
      hint: `Score >= ${READINESS_RULES.minTotal} across quizzes, certs & interview`,
    },
    {
      label: "Identified Skill Deficits",
      value: `${criticalGapsCount}`,
      delta: criticalGapsCount > 0 ? "Below target benchmark" : "All on track",
      tone: criticalGapsCount > 0 ? "rose" : "teal",
      hint: "Curricular areas with < 65% cohort mastery",
    },
    {
      label: "Verified Certificates",
      value: certsCount.toLocaleString(),
      delta: "Issued to date",
      tone: "gold",
      hint: "Passed proctored assessments in this college",
    },
    {
      label: "Avg Readiness Score",
      value: `${avgProficiency} / 100`,
      delta: `Placement bar: ${READINESS_RULES.minTotal}`,
      tone: avgProficiency >= 70 ? "teal" : "brand",
      hint: "Weighted average across cohort assessments",
    },
  ];

  // 9. Compute REAL Charts
  const demandVsReadiness: ChartSpec = {
    type: "bar",
    title: "Syllabus Target Benchmark vs. Real Cohort Mastery",
    series: ["Syllabus Target", "Cohort Mastery"],
    xKey: "name",
    data:
      skillGaps.length > 0
        ? skillGaps.slice(0, 8).map((s) => ({
            name: s.skill.split("(")[0]?.trim().slice(0, 18) ?? s.skill,
            "Syllabus Target": s.demandScore,
            "Cohort Mastery": s.readinessScore,
          }))
        : [
            {
              name: "No Courses Recorded",
              "Syllabus Target": 0,
              "Cohort Mastery": 0,
            },
          ],
  };

  // Group by Course Type / Domain for Radar
  const domainTotals: Record<string, { sum: number; count: number }> = {};
  for (const s of skillGaps) {
    if (!domainTotals[s.category]) domainTotals[s.category] = { sum: 0, count: 0 };
    domainTotals[s.category]!.sum += s.readinessScore;
    domainTotals[s.category]!.count += 1;
  }
  const radarData = Object.entries(domainTotals).map(([cat, data]) => ({
    name: cat,
    Readiness: Math.round(data.sum / Math.max(1, data.count)),
  }));

  const domainRadar: ChartSpec = {
    type: "radar",
    title: "Category Competency Breakdown",
    series: ["Readiness"],
    xKey: "name",
    data:
      radarData.length > 0
        ? radarData
        : [{ name: "General Theory", Readiness: avgProficiency || 50 }],
  };

  // Batch Progression Chart
  const batchCounts: Record<string, { sum: number; count: number }> = {};
  for (const s of filteredStudents) {
    const b = deriveBatch(s.rollNo);
    if (!batchCounts[b]) batchCounts[b] = { sum: 0, count: 0 };
    batchCounts[b]!.sum += s.total;
    batchCounts[b]!.count += 1;
  }
  const batchProgressionData = Object.entries(batchCounts).map(([bName, val]) => ({
    name: bName.split("(")[1]?.replace(")", "") || bName,
    "Cohort Score": Math.round(val.sum / Math.max(1, val.count)),
    "Qualifying %": Math.round(
      (filteredStudents.filter((st) => deriveBatch(st.rollNo) === bName && st.status === "Placement ready").length /
        Math.max(1, val.count)) *
        100
    ),
  }));

  const batchProgression: ChartSpec = {
    type: "bar",
    title: "Cohort Progression & Placement Qualification Rate",
    series: ["Cohort Score", "Qualifying %"],
    xKey: "name",
    data:
      batchProgressionData.length > 0
        ? batchProgressionData
        : [{ name: "Current Cohort", "Cohort Score": avgProficiency, "Qualifying %": jobReadyPct }],
  };

  // Certificate Distribution Chart
  const certCounts: Record<string, number> = {};
  for (const c of filteredCertificates) {
    const key = String(c.course || c.department || "General");
    certCounts[key] = (certCounts[key] ?? 0) + 1;
  }
  const certDonutData = Object.entries(certCounts).map(([name, Count]) => ({
    name: name.slice(0, 20),
    Count,
  }));

  const certDistribution: ChartSpec = {
    type: "donut",
    title: "Verified Certificates by Course",
    series: ["Count"],
    xKey: "name",
    data:
      certDonutData.length > 0
        ? certDonutData
        : [{ name: "No Certificates Issued Yet", Count: 0 }],
  };

  // 10. REAL Curricular Insights
  const topCriticalGap = skillGaps.find((s) => s.urgency === "Critical" || s.urgency === "High");
  const insights: Insight[] = [];

  if (topCriticalGap) {
    insights.push({
      title: `Curricular Deficit in ${topCriticalGap.skill.split("(")[0]?.trim()}`,
      body: `Cohort readiness in ${topCriticalGap.skill} is currently ${topCriticalGap.readinessScore}%, trailing the standard target of ${topCriticalGap.demandScore}%. Remediate through structured lab assignments.`,
      evidence: `Assessed across ${topCriticalGap.studentsAssessed} enrolled students in ${topCriticalGap.category}`,
      tone: "rose",
    });
  } else if (skillGaps.length > 0) {
    insights.push({
      title: "Core Curriculum on Track",
      body: "All assessed course competencies are currently meeting or exceeding syllabus targets.",
      evidence: `Evaluated across ${skillGaps.length} courses in ${effectiveDept}`,
      tone: "teal",
    });
  } else {
    insights.push({
      title: "No Courses Recorded Yet",
      body: "Add courses and syllabus outcomes under Course Management to evaluate skill mastery for this department.",
      evidence: "0 active course records in database",
      tone: "amber",
    });
  }

  if (certsCount === 0) {
    insights.push({
      title: "No Course Certificates Issued Yet",
      body: "Students have not yet passed final proctored assessments. Publishing quizzes in AI Quiz Builder will enable verifiable digital credentials.",
      evidence: "0 issued certificates in store",
      tone: "amber",
    });
  } else {
    insights.push({
      title: `${certsCount} Verifiable Credentials Issued`,
      body: `Students have successfully earned ${certsCount} mark-based certificates with public verification hashes.`,
      evidence: `Verified across ${filteredCertificates.length} records in this institution`,
      tone: "teal",
    });
  }

  insights.push({
    title: "Placement Readiness Gateway Summary",
    body: `${jobReadyPct}% of the cohort qualifies for placement drives (Overall score ≥ ${READINESS_RULES.minTotal}, Quiz avg ≥ ${READINESS_RULES.minQuizAverage}%, Mock interview ≥ ${READINESS_RULES.minInterview}).`,
    evidence: `Aggregated from ${totalProfiled} active student records on the readiness board`,
    tone: jobReadyPct >= 50 ? "teal" : "brand",
  });

  // 11. REAL Recruiter Gateways & Cohort Compliance
  const avgQuiz = totalProfiled > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.quizAverage, 0) / totalProfiled) : 0;
  const avgAptitude = totalProfiled > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.aptitude, 0) / totalProfiled) : 0;
  const avgInterview = totalProfiled > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.interview, 0) / totalProfiled) : 0;
  const avgResume = totalProfiled > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.resume, 0) / totalProfiled) : 0;

  const topHiringPartners: TopHiringPartner[] = [
    {
      name: "Overall Placement Eligibility Gateway",
      hiringDomain: `Total Score ≥ ${READINESS_RULES.minTotal} / 100`,
      minReadiness: READINESS_RULES.minTotal,
      openRoles: totalProfiled,
      trend: `${readyCount} Qualified (${jobReadyPct}%)`,
    },
    {
      name: "Academic & Quiz Mastery Standard",
      hiringDomain: `Quiz Average ≥ ${READINESS_RULES.minQuizAverage}%`,
      minReadiness: READINESS_RULES.minQuizAverage,
      openRoles: totalProfiled,
      trend: `Cohort Avg: ${avgQuiz}%`,
    },
    {
      name: "Technical Mock Interview Clearance",
      hiringDomain: `Interview Score ≥ ${READINESS_RULES.minInterview}`,
      minReadiness: READINESS_RULES.minInterview,
      openRoles: totalProfiled,
      trend: `Cohort Avg: ${avgInterview}%`,
    },
    {
      name: "ATS Resume Standard",
      hiringDomain: "Resume ATS Score ≥ 70",
      minReadiness: 70,
      openRoles: totalProfiled,
      trend: `Cohort Avg: ${avgResume}%`,
    },
    {
      name: "Aptitude & Logical Assessment",
      hiringDomain: "Aptitude Score ≥ 50",
      minReadiness: 50,
      openRoles: totalProfiled,
      trend: `Cohort Avg: ${avgAptitude}%`,
    },
  ];

  // 12. REAL Interventions for this college
  const currentInterventions = (await supportData().skills(collegeId)).filter((item) => {
    if (isDeptSpecific && item.department !== "All Departments" && item.department !== effectiveDept) {
      return false;
    }
    if (isBatchSpecific && item.batch !== "All Batches" && item.batch !== filterBatch) {
      return false;
    }
    return true;
  });

  return {
    college: {
      id: collegeId,
      name: collegeTitle,
    },
    department: effectiveDept,
    availableDepartments,
    batch: filterBatch,
    availableBatches: [
      "All Batches",
      "2023–2027 (Final Year)",
      "2024–2028 (3rd Year)",
      "2025–2029 (2nd Year)",
      "2026–2030 (1st Year)",
    ],
    domain: filterDomain,
    availableDomains,
    availableFaculty,
    kpis,
    demandVsReadiness,
    domainRadar,
    batchProgression,
    certDistribution,
    skillGaps,
    insights,
    students,
    interventions: currentInterventions,
    topHiringPartners,
  };
}
