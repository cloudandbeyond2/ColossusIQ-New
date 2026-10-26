import "server-only";
import { RESOURCES, type RecordValue } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { collegeStream, getCollege, listColleges } from "./records";

export async function dynamicInstitutionHome(session: SessionPayload): Promise<RoleHome> {
  // The caller's college; admin ("all") sees the first college.
  let collegeId: string = session.college !== ALL_COLLEGES ? session.college : "";
  let college = collegeId ? await getCollege(collegeId) : undefined;
  if (!college) {
    college = (await listColleges())[0];
    collegeId = college?.id ?? "";
  }

  const collegeName = String(college?.name ?? "College");
  const code = college?.code ? String(college.code) : undefined;
  const city = college?.city ? String(college.city) : undefined;
  const type = college?.type ? String(college.type) : undefined;
  const principal = college?.principal ? String(college.principal) : undefined;
  const capacity = typeof college?.studentCapacity === "number" ? college.studentCapacity : 0;
  const stream = await collegeStream(collegeId);

  const count = (key: string, where?: Record<string, RecordValue>) =>
    getStore().records.count(RESOURCES[key]!, collegeId, where);

  const [
    totalApplications,
    enrolled,
    shortlisted,
    applied,
    verified,
    feePaid,
    enquiry,
    totalStaff,
    activeStaff,
    teachingStaff,
    activeCourses,
    draftCourses,
    invitedUsers,
    totalEvents,
    publishedEvents,
    draftEvents,
    deptRecords,
  ] = await Promise.all([
    count("admissions"),
    count("admissions", { status: "Enrolled" }),
    count("admissions", { status: "Shortlisted" }),
    count("admissions", { status: "Applied" }),
    count("admissions", { status: "Documents verified" }),
    count("admissions", { status: "Fee paid" }),
    count("admissions", { status: "Enquiry" }),
    count("staff"),
    count("staff", { status: "Active" }),
    count("staff", { staffType: "Teaching", status: "Active" }),
    count("courses", { status: "Active" }),
    count("courses", { status: "Draft" }),
    count("users", { status: "Invited" }),
    count("events"),
    count("events", { status: "Published" }),
    count("events", { status: "Draft" }),
    getStore().records.all(RESOURCES.departments!, collegeId),
  ]);

  const deptStats = await getStore().records.stats(RESOURCES.departments!, deptRecords);
  const totalDeptStudents = deptRecords.reduce((sum, d) => sum + (deptStats.get(d.id)?.students ?? 0), 0);
  const totalDeptFaculty = deptRecords.reduce((sum, d) => sum + (deptStats.get(d.id)?.faculty ?? 0), 0);
  const deptsWithStudents = deptRecords.filter((d) => (deptStats.get(d.id)?.students ?? 0) > 0);
  const avgReadiness =
    totalDeptStudents > 0
      ? Math.round(
          deptRecords.reduce(
            (sum, d) => sum + (deptStats.get(d.id)?.readiness ?? 0) * (deptStats.get(d.id)?.students ?? 0),
            0
          ) / totalDeptStudents
        )
      : deptsWithStudents.length > 0
      ? Math.round(
          deptsWithStudents.reduce((sum, d) => sum + (deptStats.get(d.id)?.readiness ?? 0), 0) / deptsWithStudents.length
        )
      : null;

  const studentCount = totalDeptStudents > 0 ? totalDeptStudents : enrolled;
  const facultyCount = teachingStaff > 0 ? teachingStaff : totalDeptFaculty > 0 ? totalDeptFaculty : activeStaff;

  // Rotations for medical stream
  const rotations = stream === "medical" ? await getStore().records.all(RESOURCES.rotations!, collegeId) : [];
  const ongoingRotations = rotations.filter((r) => r.status === "Ongoing").length;
  const withAttendance = rotations.filter((r) => r.attendance !== undefined && r.attendance !== null && r.attendance !== "");
  const avgAttendance =
    withAttendance.length > 0
      ? Math.round(withAttendance.reduce((a, r) => a + Number(r.attendance), 0) / withAttendance.length)
      : null;
  const lowAttendance = withAttendance.filter((r) => Number(r.attendance) < 80).length;
  const certifiedCompetencies = rotations.reduce((a, r) => a + Number(r.competenciesSigned ?? 0), 0);

  // KPIs
  const kpis: Kpi[] =
    stream === "medical"
      ? [
          {
            label: "Medical / MBBS students",
            value: formatNumber(studentCount),
            delta: capacity ? `${Math.round((enrolled / capacity) * 100)}% capacity` : `${enrolled} enrolled`,
            tone: "brand",
          },
          {
            label: "Teaching faculty",
            value: String(facultyCount),
            delta: `${totalStaff} total staff`,
            tone: "teal",
          },
          {
            label: "Clinical postings",
            value: String(rotations.length),
            delta: `${ongoingRotations} ongoing`,
            tone: "brand",
          },
          {
            label: "Avg clinical attendance",
            value: avgAttendance === null ? "—" : `${avgAttendance}%`,
            delta: avgAttendance === null ? "No attendance recorded" : avgAttendance >= 80 ? "Meets the 80% requirement" : "Attendance risk",
            tone: avgAttendance === null ? "neutral" : avgAttendance >= 80 ? "teal" : "rose",
          },
          {
            label: "Departments",
            value: String(deptRecords.length),
            delta: `${deptRecords.filter((d) => d.status === "Active").length} active`,
            tone: "sky",
          },
          {
            label: "Active courses",
            value: String(activeCourses),
            delta: draftCourses ? `${draftCourses} draft` : "Curriculum active",
            tone: "sky",
          },
          {
            label: "Admissions pipeline",
            value: formatNumber(totalApplications),
            delta: `${enrolled} enrolled`,
            tone: "gold",
          },
          {
            label: "Logbook competencies certified",
            value: formatNumber(certifiedCompetencies),
            delta: "Across all postings",
            tone: "teal",
          },
        ]
      : [
          {
            label: "Students",
            value: formatNumber(studentCount),
            delta: capacity ? `${Math.round((enrolled / capacity) * 100)}% capacity filled` : `${enrolled} enrolled`,
            tone: "brand",
          },
          {
            label: "Teaching faculty",
            value: formatNumber(facultyCount),
            delta: `${totalStaff} total staff on record`,
            tone: "teal",
          },
          {
            label: "Departments",
            value: String(deptRecords.length),
            delta: `${deptRecords.filter((d) => d.status === "Active").length} active`,
            tone: "sky",
          },
          {
            label: "Active courses",
            value: String(activeCourses),
            delta: draftCourses ? `${draftCourses} in draft` : "Curriculum active",
            tone: "sky",
          },
          {
            label: "Admissions pipeline",
            value: formatNumber(totalApplications),
            delta: `${enrolled} enrolled`,
            tone: "gold",
          },
          {
            label: "Placement readiness",
            value: avgReadiness !== null && totalDeptStudents > 0 ? `${avgReadiness}%` : "—",
            delta: avgReadiness !== null && totalDeptStudents > 0 ? "Average across departments" : "No active cohort",
            tone: avgReadiness === null ? "neutral" : avgReadiness >= 75 ? "teal" : avgReadiness >= 60 ? "brand" : "amber",
          },
          {
            label: "Campus events",
            value: String(publishedEvents),
            delta: draftEvents ? `${draftEvents} draft` : `${totalEvents} total`,
            tone: "sky",
          },
        ];

  // Dynamic Charts
  const deptData = deptRecords.slice(0, 6).map((d) => {
    const s = deptStats.get(d.id);
    const shortName = String(d.department)
      .replace("Department of ", "")
      .replace("Engineering", "Eng.")
      .replace("Technology", "Tech.")
      .split(" ")
      .slice(0, 2)
      .join(" ");
    return {
      name: shortName,
      Students: s?.students ?? 0,
      Faculty: s?.faculty ?? 0,
      Readiness: s?.readiness ?? 0,
    };
  });

  const chart1: ChartSpec = {
    type: "bar",
    title: "Department breakdown (Students & Faculty)",
    xKey: "name",
    series: ["Students", "Faculty"],
    data:
      deptData.length > 0
        ? deptData
        : [{ name: "Core", Students: studentCount, Faculty: facultyCount }],
  };

  let chart2: ChartSpec;
  if (stream === "medical") {
    const rotationDeptCounts: Record<string, number> = {};
    for (const r of rotations) {
      const dName = String(r.department ?? "General Medicine")
        .replace("Obstetrics & Gynaecology", "OBG")
        .replace("General ", "")
        .split(" ")[0] ?? "Medicine";
      rotationDeptCounts[dName] = (rotationDeptCounts[dName] ?? 0) + 1;
    }
    const rotList = Object.entries(rotationDeptCounts).map(([name, Postings]) => ({ name, Postings }));
    chart2 = {
      type: "bar",
      title: "Clinical Postings by Department",
      xKey: "name",
      series: ["Postings"],
      data: rotList.length > 0 ? rotList : [{ name: "No postings yet", Postings: 0 }],
    };
  } else {
    const funnelData = [
      { name: "Enquiry", Applications: enquiry },
      { name: "Applied", Applications: applied },
      { name: "Verified", Applications: verified },
      { name: "Shortlisted", Applications: shortlisted },
      { name: "Fee Paid", Applications: feePaid },
      { name: "Enrolled", Applications: enrolled },
    ];
    chart2 = {
      type: "bar",
      title: "Admissions conversion pipeline",
      xKey: "name",
      series: ["Applications"],
      data: funnelData,
    };
  }

  // Attention Queue
  const queue: Array<{ title: string; meta: string; href: string; tone: "brand" | "gold" | "teal" | "rose" | "amber" | "sky" | "neutral" }> = [];
  if (applied > 0 || enquiry > 0) {
    queue.push({
      title: `Review ${applied} admissions applications`,
      meta: `${verified} verified · ${enquiry} enquiries pending`,
      href: "/institution/admissions",
      tone: "brand",
    });
  }
  if (invitedUsers > 0) {
    queue.push({
      title: `${invitedUsers} staff / user invitations pending`,
      meta: "MFA onboarding and platform access required",
      href: "/institution/users",
      tone: "amber",
    });
  }
  if (draftCourses > 0) {
    queue.push({
      title: `${draftCourses} draft course${draftCourses > 1 ? "s" : ""} to review`,
      meta: "Curriculum & syllabus approval",
      href: "/institution/course-management",
      tone: "sky",
    });
  }
  if (draftEvents > 0) {
    queue.push({
      title: `Publish ${draftEvents} upcoming campus event${draftEvents > 1 ? "s" : ""}`,
      meta: "Campus calendar & registration",
      href: "/institution/events",
      tone: "teal",
    });
  }
  if (stream === "medical" && lowAttendance > 0) {
    queue.push({
      title: `${lowAttendance} clinical posting${lowAttendance > 1 ? "s" : ""} below 80% attendance`,
      meta: "Eligibility risk before university exams",
      href: "/institution/rotations",
      tone: "rose",
    });
  }
  if (queue.length < 3) {
    queue.push({
      title: "Institutional Knowledge Base (RAG)",
      meta: "Regulations, handbooks and syllabus",
      href: "/institution/knowledge-base",
      tone: "brand",
    });
  }
  if (queue.length < 3) {
    queue.push({
      title: `Review ${deptRecords.length} departments`,
      meta: "Department intelligence and staffing allocation",
      href: "/institution/departments",
      tone: "teal",
    });
  }

  // Dynamic Insights
  const insights: Insight[] = [];
  if (capacity > 0) {
    const pct = Math.round((enrolled / capacity) * 100);
    insights.push({
      title: "Admissions & Intake Progress",
      body: `${enrolled} of ${capacity} sanctioned seats enrolled (${pct}% intake). Total pipeline stands at ${totalApplications} applicants across all quotas.`,
      evidence: `${collegeName} admissions registry`,
      tone: pct >= 80 ? "teal" : pct >= 50 ? "sky" : "amber",
    });
  }
  if (facultyCount > 0 && studentCount > 0) {
    const ratio = Math.round(studentCount / facultyCount);
    insights.push({
      title: "Faculty-to-Student Ratio",
      body: `Current ratio is 1:${ratio} across ${deptRecords.length} academic departments (${facultyCount} active teaching staff for ${formatNumber(studentCount)} students).`,
      evidence: "Staff records vs department enrolments",
      tone: ratio <= 20 ? "teal" : ratio <= 30 ? "sky" : "amber",
    });
  }
  if (deptRecords.length > 0) {
    const activeDepts = deptRecords.filter((d) => (deptStats.get(d.id)?.students ?? 0) > 0);
    const sortedDepts = [...(activeDepts.length > 0 ? activeDepts : deptRecords)].sort(
      (a, b) => (deptStats.get(b.id)?.readiness ?? 0) - (deptStats.get(a.id)?.readiness ?? 0),
    );
    const top = sortedDepts[0];
    if (top) {
      const topS = deptStats.get(top.id);
      insights.push({
        title: "Department Placement Readiness Lead",
        body: `${String(top.department)} leads institutional readiness at ${topS?.readiness ?? 0}% with ${topS?.programmes ?? 1} active programmes and ${topS?.faculty ?? 0} teaching staff.`,
        evidence: "Placement readiness analytics",
        tone: "brand",
      });
    }
  }
  if (insights.length === 0) {
    insights.push({
      title: "Nothing to report yet",
      body: "Insights appear here once the college has admissions, staff and department records.",
      evidence: "No records yet",
      tone: "sky",
    });
  }

  // Departments snapshot for the UI
  const departments = deptRecords.map((d) => {
    const s = deptStats.get(d.id);
    return {
      id: d.id,
      name: String(d.department),
      head: d.head ? String(d.head) : undefined,
      faculty: s?.faculty ?? 0,
      students: s?.students ?? 0,
      readiness: s?.readiness ?? 0,
      programmes: s?.programmes ?? 1,
      status: String(d.status ?? "Active"),
    };
  });

  return {
    greeting: `${collegeName} — Command Center`,
    kpis,
    charts: [chart1, chart2],
    insights,
    queue,
    college: {
      id: collegeId,
      name: collegeName,
      code,
      type,
      city,
      principal,
      capacity,
    },
    departments,
  };
}
