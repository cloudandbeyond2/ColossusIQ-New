import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { cleanText } from "@/lib/security/sanitize";
import { meetsDrive, packageText } from "@/lib/api/drive-schemas";
import {
  ApplyJobBody,
  JobApplication,
  JobItem,
  StudentJobsOverview,
  ToggleSaveJobBody,
  WithdrawJobBody,
} from "@/lib/api/jobs-schemas";
import { computeReadiness, READINESS_RULES, type Readiness } from "./learning";
import { getStudentAcademicProfile } from "./student-profile";
import { driveStore } from "./drive-store";
import { studentStateStore } from "./student-state-store";
import type { MockResult } from "./router";

const STATE_KEY = "jobs_state";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});

interface StoredStudentJobsData {
  applications: JobApplication[];
  savedIds: string[];
}

async function loadStudentJobsData(s: SessionPayload): Promise<StoredStudentJobsData> {
  const raw = await studentStateStore().get(s.sub, STATE_KEY);
  if (!raw || typeof raw !== "object") {
    // Initial sample applications if brand new to showcase rich tracking immediately
    return {
      applications: [
        {
          id: "app-init-1",
          jobId: "curated-tcs-digital",
          company: "Tata Consultancy Services",
          role: "System Engineer - Digital Innovator",
          type: "On-campus",
          appliedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          status: "Shortlisted",
          stage: 2,
          nextStep: "Round 2 Technical Assessment scheduled on campus",
          resumeName: "Primary ATS Resume (Score: 88%)",
          notes: "Focus on Algorithms and System Design.",
        },
      ],
      savedIds: ["curated-zoho-sde", "curated-freshworks-assoc"],
    };
  }
  const data = raw as Partial<StoredStudentJobsData>;
  return {
    applications: Array.isArray(data.applications) ? (data.applications as JobApplication[]) : [],
    savedIds: Array.isArray(data.savedIds) ? (data.savedIds as string[]) : [],
  };
}

async function saveStudentJobsData(s: SessionPayload, data: StoredStudentJobsData): Promise<void> {
  await studentStateStore().save(s.college, s.sub, STATE_KEY, data);
}

const CURATED_JOBS: Array<Omit<JobItem, "matchScore" | "matchedSkills" | "missingSkills" | "isEligible" | "eligibilityReasons" | "eligibilityGaps">> = [
  {
    id: "curated-tcs-digital",
    company: "Tata Consultancy Services",
    companyLogo: "TCS",
    role: "System Engineer - Digital Innovator",
    type: "On-campus",
    category: "campus-drive",
    location: "Chennai / Bengaluru / Pune",
    venue: "Main Auditorium, Academic Block A",
    packageMin: 7.0,
    packageMax: 9.2,
    packageText: "₹7.0–9.2 LPA",
    openings: 45,
    departments: ["Computer Science & Engineering", "Information Technology", "Electronics & Communication Engineering"],
    minReadiness: 60,
    minCgpa: 6.5,
    date: "2026-10-18",
    deadline: "2026-10-15",
    description: "TCS Digital hiring drive for final-year engineering students. Work on cutting-edge cloud architectures, enterprise AI systems, and distributed platforms.",
    responsibilities: [
      "Design and build scalable full-stack applications with modern microservices architecture",
      "Collaborate with solution architects to implement secure cloud-native solutions",
      "Participate in automated CI/CD pipeline deployments and code reviews",
    ],
    skills: ["Data Structures", "Java", "Python", "SQL", "Cloud Fundamentals", "System Design"],
    rounds: [
      "Round 1: National Qualifier Test (Advanced Aptitude + Verbal)",
      "Round 2: Hands-on Algorithmic Coding Challenge (2 Problems)",
      "Round 3: Technical Viva & Project Architecture Discussion",
      "Round 4: HR & Cultural Fitment Interview",
    ],
    status: "Open",
    isDrive: true,
  },
  {
    id: "curated-zoho-sde",
    company: "Zoho Corporation",
    companyLogo: "ZOHO",
    role: "Software Development Engineer (SDE)",
    type: "On-campus",
    category: "campus-drive",
    location: "Chennai / Tenkasi / Remote",
    venue: "CS Computer Lab 2 & 3",
    packageMin: 8.4,
    packageMax: 12.0,
    packageText: "₹8.4–12.0 LPA",
    openings: 30,
    departments: ["Computer Science & Engineering", "Information Technology", "Electronics & Communication Engineering", "Electrical & Electronics Engineering"],
    minReadiness: 70,
    minCgpa: 7.0,
    date: "2026-10-24",
    deadline: "2026-10-20",
    description: "Zoho is hiring passionate software craftsmen who love core problem solving and clean systems code. Zoho builds all software from the ground up without third-party cloud lock-in.",
    responsibilities: [
      "Implement high-performance backend modules in Java and C++",
      "Develop responsive and resilient browser client applications",
      "Optimize relational query execution plans and database storage engines",
    ],
    skills: ["Java", "Data Structures", "Algorithms", "Object-Oriented Design", "SQL", "Problem Solving"],
    rounds: [
      "Round 1: Basic Programming & C/Java Logic Assessment",
      "Round 2: Advanced Data Structures & Algorithm Design",
      "Round 3: Live Application Design & Code Walkthrough",
      "Round 4: HR & General Technical Interview",
    ],
    status: "Open",
    isDrive: true,
  },
  {
    id: "curated-microsoft-sde",
    company: "Microsoft India",
    companyLogo: "MSFT",
    role: "Software Engineer Trainee",
    type: "Virtual",
    category: "industry-job",
    location: "Bengaluru / Hyderabad",
    venue: "Microsoft Teams (Virtual Assessment)",
    packageMin: 18.0,
    packageMax: 26.0,
    packageText: "₹18.0–26.0 LPA",
    openings: 10,
    departments: ["Computer Science & Engineering", "Information Technology"],
    minReadiness: 78,
    minCgpa: 8.0,
    date: "2026-11-02",
    deadline: "2026-10-28",
    description: "Join Microsoft Azure or Office 365 Core Engineering teams. Empower billions of people by building resilient, planetary-scale distributed cloud infrastructure.",
    responsibilities: [
      "Contribute to distributed system components serving millions of requests per second",
      "Write high-quality, observable, and testable code in C#, C++, or Go",
      "Drive performance benchmarks and optimize memory and network throughput",
    ],
    skills: ["Data Structures", "Algorithms", "System Design", "Operating Systems", "Computer Networks", "C++", "Python"],
    rounds: [
      "Round 1: Online Codility Coding Assessment (3 Algorithmic Problems)",
      "Round 2: Technical Interview - DSA & Complexity Analysis",
      "Round 3: System Design, OS Internals & Multithreading",
      "Round 4: As-Appropriate (AA) Director Interview",
    ],
    status: "Open",
    isDrive: false,
  },
  {
    id: "curated-freshworks-assoc",
    company: "Freshworks",
    companyLogo: "FW",
    role: "Associate Product Engineer",
    type: "Pool campus",
    category: "campus-drive",
    location: "Chennai / Bengaluru",
    venue: "Convention Centre Hall B",
    packageMin: 9.0,
    packageMax: 14.0,
    packageText: "₹9.0–14.0 LPA",
    openings: 20,
    departments: ["Computer Science & Engineering", "Information Technology", "Electronics & Communication Engineering"],
    minReadiness: 68,
    minCgpa: 7.0,
    date: "2026-10-29",
    deadline: "2026-10-25",
    description: "Freshworks builds SaaS products that delight customers and employees. As an Associate Product Engineer, you will create scalable, intuitive B2B experiences.",
    responsibilities: [
      "Develop responsive frontends using React and robust Node.js / Ruby microservices",
      "Collaborate closely with UI/UX product designers and product managers",
      "Ensure test coverage with automated unit and integration suites",
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "REST APIs", "SQL"],
    rounds: [
      "Round 1: Online Aptitude & Coding Round",
      "Round 2: Machine Coding Challenge (Build a Feature in 2 Hours)",
      "Round 3: Technical Problem Solving & Architecture",
      "Round 4: Culture & Managerial Round",
    ],
    status: "Open",
    isDrive: true,
  },
  {
    id: "curated-analytics-hub",
    company: "Analytics Insights Hub",
    companyLogo: "AIH",
    role: "Data Analyst & BI Engineer",
    type: "On-campus",
    category: "campus-drive",
    location: "Coimbatore / Chennai",
    venue: "Department Seminar Hall",
    packageMin: 6.5,
    packageMax: 9.5,
    packageText: "₹6.5–9.5 LPA",
    openings: 15,
    departments: ["Computer Science & Engineering", "Information Technology", "Electronics & Communication Engineering", "Mechanical Engineering"],
    minReadiness: 60,
    minCgpa: 6.0,
    date: "2026-11-05",
    deadline: "2026-10-31",
    description: "Transform multi-terabyte datasets into actionable business intelligence dashboards, predictive pipelines, and automated anomaly detection models.",
    responsibilities: [
      "Write complex analytical SQL queries, CTEs, and window functions",
      "Build dynamic PowerBI / Tableau dashboards for executive leadership",
      "Automate data extraction and cleaning scripts in Python and Pandas",
    ],
    skills: ["SQL", "Python", "Data Analysis", "PowerBI", "Database Management Systems", "Statistics"],
    rounds: [
      "Round 1: Analytical Aptitude & SQL Assessment",
      "Round 2: Live SQL & Data Wrangling Practical Test",
      "Round 3: Technical Viva & Case Study Presentation",
      "Round 4: HR Discussion",
    ],
    status: "Open",
    isDrive: true,
  },
  {
    id: "curated-cloudsphere-intern",
    company: "CloudSphere Solutions",
    companyLogo: "CSS",
    role: "Cloud Operations & DevOps Intern",
    type: "Internship",
    category: "internship",
    location: "Hyderabad / Remote",
    venue: "Google Meet (Online)",
    packageMin: 4.8,
    packageMax: 6.0,
    packageText: "₹35,000 / month (Stipend)",
    openings: 12,
    departments: ["Computer Science & Engineering", "Information Technology"],
    minReadiness: 62,
    minCgpa: 6.5,
    date: "2026-10-22",
    deadline: "2026-10-19",
    description: "6-month pre-placement internship with PPO (Pre-Placement Offer) upon graduation. Hands-on experience with Kubernetes clusters, AWS infrastructure, and Terraform automation.",
    responsibilities: [
      "Monitor and support multi-region Kubernetes clusters and AWS infrastructure",
      "Write Terraform and Ansible infrastructure-as-code configuration scripts",
      "Assist in setting up GitHub Actions CI/CD workflows and automated container scans",
    ],
    skills: ["Linux", "Operating Systems", "Computer Networks", "Docker", "AWS", "Python"],
    rounds: [
      "Round 1: Linux & Networking Online MCQ",
      "Round 2: Practical Scripting & Debugging Task",
      "Round 3: Technical Interview with DevOps Lead",
    ],
    status: "Open",
    isDrive: false,
  },
  {
    id: "curated-amazon-intern",
    company: "Amazon Web Services (AWS)",
    companyLogo: "AWS",
    role: "Cloud Support Associate Intern",
    type: "Internship",
    category: "internship",
    location: "Bengaluru / Hyderabad",
    venue: "Amazon Chime (Virtual)",
    packageMin: 6.0,
    packageMax: 8.5,
    packageText: "₹45,000 / month (Stipend)",
    openings: 8,
    departments: ["Computer Science & Engineering", "Information Technology", "Electronics & Communication Engineering"],
    minReadiness: 72,
    minCgpa: 7.0,
    date: "2026-11-10",
    deadline: "2026-11-05",
    description: "Work directly with AWS Enterprise customers to troubleshoot complex networking, compute, and storage architectures. Top performers convert to full-time Cloud Support Engineers.",
    responsibilities: [
      "Troubleshoot complex TCP/IP network topologies, VPN tunnels, and DNS routing",
      "Analyze Linux and Windows operating system memory dumps and system logs",
      "Participate in root-cause-analysis post-mortems and write internal knowledge bases",
    ],
    skills: ["Computer Networks", "Operating Systems", "Linux", "Troubleshooting", "Python", "Cloud Fundamentals"],
    rounds: [
      "Round 1: Online Assessment (Linux, Networking, Scenarios)",
      "Round 2: Technical Interview - Networking & OS Deep-Dive",
      "Round 3: Amazon Leadership Principles & Behavioral Interview",
    ],
    status: "Open",
    isDrive: false,
  },
];

function calculateMatch(
  job: { minReadiness: number; departments: string[]; skills: string[]; minCgpa: number },
  studentDept: string,
  readinessTotal: number,
  studentCgpa: number,
  studentSkills: string[]
): {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  isEligible: boolean;
  reasons: string[];
  gaps: string[];
} {
  const reasons: string[] = [];
  const gaps: string[] = [];

  // Department eligibility
  const deptOk = job.departments.length === 0 || job.departments.some((d) => d.toLowerCase() === studentDept.toLowerCase() || studentDept.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(studentDept.toLowerCase()));
  if (deptOk) {
    reasons.push("Department matches hiring criteria");
  } else {
    gaps.push(`Open for ${job.departments.join(", ")}`);
  }

  // Readiness eligibility
  const readinessOk = readinessTotal >= job.minReadiness;
  if (readinessOk) {
    reasons.push(`Placement readiness (${readinessTotal}%) meets minimum requirement (${job.minReadiness}%)`);
  } else {
    gaps.push(`Requires readiness total of ${job.minReadiness}+ (current: ${readinessTotal})`);
  }

  // CGPA eligibility
  const cgpaOk = studentCgpa >= job.minCgpa;
  if (cgpaOk) {
    reasons.push(`CGPA (${studentCgpa.toFixed(1)}) meets minimum threshold (${job.minCgpa.toFixed(1)})`);
  } else {
    gaps.push(`Minimum CGPA required is ${job.minCgpa.toFixed(1)} (current: ${studentCgpa.toFixed(1)})`);
  }

  const isEligible = deptOk && readinessOk && cgpaOk;

  // Skills overlap
  const studentSkillSet = new Set(studentSkills.map((s) => s.toLowerCase()));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of job.skills) {
    if (studentSkillSet.has(skill.toLowerCase()) || studentSkills.some((s) => s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase()))) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Score computation (weighted 0-100)
  // Readiness weight: 40 points
  const readinessPoints = Math.min(40, (readinessTotal / 100) * 40);
  // Department weight: 25 points
  const deptPoints = deptOk ? 25 : 10;
  // Skills match weight: 25 points
  const skillRatio = job.skills.length > 0 ? matchedSkills.length / job.skills.length : 1;
  const skillPoints = skillRatio * 25;
  // CGPA weight: 10 points
  const cgpaPoints = cgpaOk ? 10 : 5;

  const rawScore = Math.round(readinessPoints + deptPoints + skillPoints + cgpaPoints);
  const matchScore = Math.min(99, Math.max(50, rawScore));

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    isEligible,
    reasons,
    gaps,
  };
}

export async function dispatchJobs(
  method: string,
  segs: string[],
  rawBody: unknown,
  s: SessionPayload,
  query: URLSearchParams
): Promise<MockResult> {
  const store = getStore();

  // 1. Fetch Student Profile and Readiness
  const profile = await getStudentAcademicProfile(s);
  const readiness: Readiness = computeReadiness(await store.readiness.forStudent(s));

  // Extract student skills from curriculum subjects and academic records
  const studentSkills = [
    "Data Structures",
    "Algorithms",
    "SQL",
    "Database Management Systems",
    "Operating Systems",
    "Computer Networks",
    "Python",
    "Java",
    "Object-Oriented Design",
    "Problem Solving",
  ];
  for (const subj of profile.enrolledSubjects) {
    if (subj.shortName && !studentSkills.includes(subj.shortName)) studentSkills.push(subj.shortName);
    if (subj.title && !studentSkills.includes(subj.title)) studentSkills.push(subj.title);
  }

  // 2. Load stored student applications and saved jobs
  const studentJobsData = await loadStudentJobsData(s);

  // 3. GET /api/v1/jobs - Return comprehensive jobs overview
  if (method === "GET" && segs.length === 1) {
    // Also load college's live drives from driveStore
    let campusDrives: JobItem[] = [];
    try {
      const liveDrives = await driveStore().list(s);
      campusDrives = liveDrives.map((d) => {
        const pkgText = packageText(d.packageMin, d.packageMax);
        const match = calculateMatch(
          {
            minReadiness: d.minReadiness,
            departments: d.departments,
            skills: ["Technical Aptitude", "Problem Solving", "Domain Core"],
            minCgpa: 6.0,
          },
          profile.department,
          readiness.total,
          profile.cgpa,
          studentSkills
        );

        return {
          id: `drive-${d.id}`,
          company: d.company,
          companyLogo: d.company.slice(0, 3).toUpperCase(),
          role: d.role,
          type: d.type,
          category: "campus-drive" as const,
          location: d.venue || "Campus Venue",
          venue: d.venue,
          packageMin: d.packageMin,
          packageMax: d.packageMax,
          packageText: pkgText,
          openings: d.openings,
          departments: d.departments,
          minReadiness: d.minReadiness,
          minCgpa: 6.0,
          date: d.date,
          deadline: d.deadline || d.date,
          description: d.description || `Campus placement drive organized by the training and placement cell for ${d.company}.`,
          responsibilities: [
            `Participate in campus recruitment assessments and technical interviews for ${d.role}`,
            "Interact with visiting technical leadership and placement coordinators",
          ],
          skills: ["Core Domain", "Problem Solving", "Communication", "Aptitude"],
          rounds: d.rounds.length > 0 ? d.rounds : ["Round 1: Screening Test", "Round 2: Technical Interview", "Round 3: HR Interview"],
          status: d.status === "Open" ? "Open" : "Upcoming",
          isDrive: true,
          driveId: d.id,
          matchScore: match.matchScore,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          isEligible: match.isEligible,
          eligibilityReasons: match.reasons,
          eligibilityGaps: match.gaps,
        };
      });
    } catch {
      // ignore if drive store list error in mock
    }

    // Combine curated jobs with match evaluation
    const enrichedCuratedJobs: JobItem[] = CURATED_JOBS.map((j) => {
      const match = calculateMatch(
        j,
        profile.department,
        readiness.total,
        profile.cgpa,
        studentSkills
      );
      return {
        ...j,
        matchScore: match.matchScore,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        isEligible: match.isEligible,
        eligibilityReasons: match.reasons,
        eligibilityGaps: match.gaps,
      };
    });

    // Merge without duplicating company & role if college already posted the drive
    const allJobs: JobItem[] = [...campusDrives];
    for (const cj of enrichedCuratedJobs) {
      if (!allJobs.some((x) => x.company.toLowerCase() === cj.company.toLowerCase() && x.role.toLowerCase() === cj.role.toLowerCase())) {
        allJobs.push(cj);
      }
    }

    // Sort by match score descending by default
    allJobs.sort((a, b) => b.matchScore - a.matchScore);

    const eligibleCount = allJobs.filter((j) => j.isEligible).length;
    const campusDrivesCount = allJobs.filter((j) => j.category === "campus-drive").length;
    const packages = allJobs.map((j) => j.packageMax).filter((p) => p > 0);
    const avgPkg = packages.length ? Math.round((packages.reduce((a, b) => a + b, 0) / packages.length) * 10) / 10 : 0;
    const maxPkg = packages.length ? Math.max(...packages) : 0;

    const shortlistedCount = studentJobsData.applications.filter((a) =>
      ["Shortlisted", "Interview Scheduled", "Offered"].includes(a.status)
    ).length;

    const overview: StudentJobsOverview = {
      student: {
        sub: s.sub,
        name: profile.name,
        rollNo: profile.rollNo,
        department: profile.department,
        semester: profile.semester,
        cgpa: profile.cgpa,
      },
      readiness: {
        total: readiness.total,
        quizAverage: readiness.quizAverage,
        certificates: readiness.certificates,
        aptitude: readiness.aptitude,
        interview: readiness.interview,
        resume: readiness.resume,
        status: readiness.status,
        gaps: readiness.gaps,
      },
      summary: {
        totalOpportunities: allJobs.length,
        eligibleCount,
        campusDrivesCount,
        applicationsCount: studentJobsData.applications.length,
        shortlistedCount,
        savedCount: studentJobsData.savedIds.length,
        highestPackageLpa: maxPkg,
        averagePackageLpa: avgPkg,
      },
      jobs: allJobs,
      applications: studentJobsData.applications,
      savedIds: studentJobsData.savedIds,
    };

    return ok(overview);
  }

  // 4. POST /api/v1/jobs/apply - Student applies for a job / campus drive
  if (method === "POST" && segs[1] === "apply") {
    const parse = ApplyJobBody.safeParse(rawBody);
    if (!parse.success) {
      return err(422, "validation", "Invalid application payload.");
    }

    const { jobId, resumeName, notes } = parse.data;

    // Check if already applied
    const existing = studentJobsData.applications.find((a) => a.jobId === jobId);
    if (existing) {
      return err(409, "already_applied", "You have already submitted an application for this role.");
    }

    // Locate job details
    const targetJob = CURATED_JOBS.find((j) => j.id === jobId) || {
      id: jobId,
      company: "Campus Partner",
      role: "Placement Candidate",
      type: "On-campus",
    };

    const newApp: JobApplication = {
      id: `app-${randomUUID().slice(0, 8)}`,
      jobId,
      company: targetJob.company,
      role: targetJob.role,
      type: targetJob.type,
      appliedAt: new Date().toISOString(),
      status: "Applied",
      stage: 1,
      nextStep: "Profile & ATS Resume submitted for recruiter screening",
      resumeName: cleanText(resumeName, 100),
      notes: notes ? cleanText(notes, 500) : undefined,
    };

    studentJobsData.applications.unshift(newApp);
    await saveStudentJobsData(s, studentJobsData);

    // If drive, increment drive registered count in driveStore if accessible
    if (jobId.startsWith("drive-")) {
      const rawDriveId = jobId.replace(/^drive-/, "");
      try {
        const d = await driveStore().get(s, rawDriveId);
        if (d) {
          await driveStore().update(s, rawDriveId, {
            ...d,
            registered: d.registered + 1,
          });
        }
      } catch {
        // non-blocking
      }
    }

    return ok({ ok: true, application: newApp, message: "Application submitted successfully!" }, 201);
  }

  // 5. POST /api/v1/jobs/withdraw - Student withdraws an application
  if (method === "POST" && segs[1] === "withdraw") {
    const parse = WithdrawJobBody.safeParse(rawBody);
    if (!parse.success) return err(422, "validation", "Job ID required");

    const idx = studentJobsData.applications.findIndex((a) => a.jobId === parse.data.jobId);
    if (idx === -1) return err(404, "not_found", "No application found for this role.");

    const [removed] = studentJobsData.applications.splice(idx, 1);
    await saveStudentJobsData(s, studentJobsData);

    if (removed && removed.jobId.startsWith("drive-")) {
      const rawDriveId = removed.jobId.replace(/^drive-/, "");
      try {
        const d = await driveStore().get(s, rawDriveId);
        if (d && d.registered > 0) {
          await driveStore().update(s, rawDriveId, {
            ...d,
            registered: d.registered - 1,
          });
        }
      } catch {
        // non-blocking
      }
    }

    return ok({ ok: true, message: "Application withdrawn successfully." });
  }

  // 6. POST /api/v1/jobs/save - Toggle bookmarked/saved job
  if (method === "POST" && segs[1] === "save") {
    const parse = ToggleSaveJobBody.safeParse(rawBody);
    if (!parse.success) return err(422, "validation", "Job ID required");

    const { jobId } = parse.data;
    const exists = studentJobsData.savedIds.includes(jobId);
    if (exists) {
      studentJobsData.savedIds = studentJobsData.savedIds.filter((id) => id !== jobId);
    } else {
      studentJobsData.savedIds.push(jobId);
    }
    await saveStudentJobsData(s, studentJobsData);

    return ok({ ok: true, saved: !exists, savedIds: studentJobsData.savedIds });
  }

  return err(404, "not_found", "Endpoint not found.");
}
