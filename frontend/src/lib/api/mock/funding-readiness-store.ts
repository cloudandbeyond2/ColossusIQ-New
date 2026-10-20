import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type FundingReadinessOverview,
  type ReadinessTier,
  type ScoreDimension,
  type UpdateReadinessInput,
  type VentureFundingReadiness,
} from "@/lib/api/funding-readiness-schemas";
import { sharedState } from "./global-state";

function computeTier(score: number): ReadinessTier {
  if (score >= 90) return "Institutional VC Ready";
  if (score >= 75) return "Angel / Pre-Series A Ready";
  if (score >= 60) return "Incubation Seed Ready";
  return "Early Stage / Grant Ready";
}

function computeDimensionStatus(score: number, benchmark: number): "Below Benchmark" | "On Target" | "Exceeds Benchmark" {
  if (score > benchmark + 5) return "Exceeds Benchmark";
  if (score < benchmark - 5) return "Below Benchmark";
  return "On Target";
}

const INITIAL_EVALUATIONS: VentureFundingReadiness[] = [
  {
    ventureId: "stu-agrisoil",
    ventureName: "AgriSoil Sense",
    domain: "AgriTech",
    stage: "Commercial Pilot",
    leadFounder: "Anand Kumar",
    department: "Computer Science & Engineering",
    fundingTarget: "₹25,00,000 (Seed Round)",
    currentFunding: "₹5,50,000 (TANSIM + Seed)",
    readinessScore: 82,
    readinessTier: "Angel / Pre-Series A Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Founder chemistry, technical capability, and execution velocity",
        score: 80,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Customer discovery, pain-point urgency, and total addressable market",
        score: 88,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Functional MVP, hardware durability, and firmware reliability",
        score: 84,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "Active pilot agreements, field trial outcomes, and user retention",
        score: 78,
        benchmark: 65,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "Gross margins, sensor manufacturing cost, and subscription revenue",
        score: 76,
        benchmark: 70,
        weight: 1,
        status: "On Target",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Narrative clarity, financial model defensibility, and data room",
        score: 86,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
    ],
    strengths: [
      "Well-validated problem with 40+ farmer interviews and field tests in Kanchipuram district",
      "Functional edge IoT sensor deployed across 4 district pilot farms with real-time NPK telemetry",
      "Complementary founding team with embedded electronics and computer science expertise",
    ],
    investorGaps: [
      "High bill-of-materials (BOM) in single-unit prototype batch",
      "Unit economics needs verification on mass sensor fabrication and sensor recalibration lifecycle",
    ],
    actionPlan: [
      "Execute paid pilot with 2 Farmer Producer Organizations (FPOs) by end of next quarter",
      "Lock volume manufacturing quotation with domestic contract electronics manufacturer in Chennai",
      "Formalize pitch rehearsal with AgriTech VC syndicate mentors before state demo day",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "DPIIT Recognized Incorporation & CIN",
        category: "Legal & Corporate",
        verified: true,
        notes: "DPIIT-TN-2025-9481 active and verified",
      },
      {
        id: "dil-ip",
        title: "Patent / IP Filing Documentation",
        category: "Product & IP",
        verified: true,
        notes: "Provisional patent filed on sensor telemetry calibration",
      },
      {
        id: "dil-fin",
        title: "3-Year Pro-Forma Financial Model",
        category: "Financials",
        verified: true,
        notes: "Reviewed by incubation financial mentor",
      },
      {
        id: "dil-cust",
        title: "Signed Commercial Pilot MOUs",
        category: "Commercial Traction",
        verified: true,
        notes: "4 pilot agreements with farm clusters on file",
      },
    ],
    lastEvaluatedAt: "2026-10-15T10:30:00.000Z",
    evaluatorNotes:
      "Venture is commercially compelling and demonstrates clear product market fit in precision agriculture. Ready for angel syndicate and seed grant mobilization.",
  },
  {
    ventureId: "stu-mediscan",
    ventureName: "MediScan AI",
    domain: "HealthTech",
    stage: "Commercial Pilot",
    leadFounder: "Divya Raman",
    department: "Biomedical Engineering",
    fundingTarget: "₹50,00,000 (Pre-Series A)",
    currentFunding: "₹12,50,000 (BIRAC BIG + Campus Grant)",
    readinessScore: 88,
    readinessTier: "Angel / Pre-Series A Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Clinical co-investigators, AI research background, and hospital access",
        score: 90,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Prevalence of diabetic retinopathy in rural tertiary clinics",
        score: 92,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Deep learning model sensitivity (97.4%) on offline edge camera",
        score: 86,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "3 hospital screening clinics with 1,200+ patient scans conducted",
        score: 82,
        benchmark: 65,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "Per-scan pay-as-you-go B2B hospital diagnostic SaaS model",
        score: 85,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Peer-reviewed publications, clinical validation reports, and deck",
        score: 93,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
    ],
    strengths: [
      "Published patent and peer-reviewed clinical validation in ophthalmic AI",
      "BIRAC BIG Grant approved with ₹12.5L non-dilutive campus innovation backing",
      "Established clinical trials across 3 major hospital chains in Chennai",
    ],
    investorGaps: [
      "CDSCO medical device software clearance timeline requires external regulatory consultant",
      "Hardware edge camera calibration standardization across varying clinic ambient light",
    ],
    actionPlan: [
      "Submit CDSCO pre-submission briefing document by end of month",
      "Expand multi-center clinical validation to 2,500 patient cohort",
      "Engage healthtech-focused angel syndicates for seed co-investment",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "Private Limited Incorporation (CIN)",
        category: "Legal & Corporate",
        verified: true,
        notes: "U72900TN2025PTC184920 verified",
      },
      {
        id: "dil-ip",
        title: "Published Indian Patent Claims",
        category: "Product & IP",
        verified: true,
        notes: "Published in official patent journal",
      },
      {
        id: "dil-fin",
        title: "Institutional Grant Utilization Certificate",
        category: "Financials",
        verified: true,
        notes: "BIRAC audit submitted",
      },
      {
        id: "dil-cust",
        title: "Hospital Institutional Ethics Committee Approvals",
        category: "Commercial Traction",
        verified: true,
        notes: "Ethics approvals obtained from both trial sites",
      },
    ],
    lastEvaluatedAt: "2026-10-18T14:00:00.000Z",
    evaluatorNotes:
      "Outstanding IP moat and exceptional clinical backing. Positioned for healthtech institutional seed round.",
  },
  {
    ventureId: "stu-edututr",
    ventureName: "Edututr Vernacular",
    domain: "EdTech",
    stage: "Growth & Scaling",
    leadFounder: "R. Priyadarshini",
    department: "Information Technology",
    fundingTarget: "₹1,00,00,000 (Institutional Seed)",
    currentFunding: "₹25,00,000 (Angel Syndicate + TANSIM)",
    readinessScore: 94,
    readinessTier: "Institutional VC Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Full-stack engineering, pedagogy experts, and regional content team",
        score: 95,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Vernacular learning gap in Tier-2/3 state board matriculation schools",
        score: 94,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "AI adaptive curriculum engine in Tamil, Telugu, and Kannada",
        score: 96,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "12 paying school contracts with ₹14.50 Lakhs ARR and 5,000+ active users",
        score: 93,
        benchmark: 65,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "₹240/student/year B2B institutional SaaS model with 82% gross margin",
        score: 92,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Complete data room, audited ARR, and institutional VC deck ready",
        score: 94,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
    ],
    strengths: [
      "Granted Indian patent for vernacular speech and adaptive learning engine",
      "Demonstrated financial profitability with ₹14.50L ARR and 12 annual school renewals",
      "Very low student churn rate (under 4% annual drop-off)",
    ],
    investorGaps: [
      "Sales cycle length in public government-aided schools",
      "Requires executive sales VP for out-of-state distribution expansion",
    ],
    actionPlan: [
      "Recruit enterprise B2B EdTech sales director for Karnataka expansion",
      "Open institutional seed round with specialized edtech venture capital funds",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "Clean Cap Table & Shareholder Agreement",
        category: "Legal & Corporate",
        verified: true,
        notes: "Full legal sign-off from angel investors",
      },
      {
        id: "dil-ip",
        title: "Patent Granted Certificate",
        category: "Product & IP",
        verified: true,
        notes: "Patent granted by Indian Patent Office",
      },
      {
        id: "dil-fin",
        title: "Audited Financial Statements (FY 2025-26)",
        category: "Financials",
        verified: true,
        notes: "Chartered Accountant certified",
      },
      {
        id: "dil-cust",
        title: "12 Executed School Subscription Contracts",
        category: "Commercial Traction",
        verified: true,
        notes: "All agreements verified and uploaded to data room",
      },
    ],
    lastEvaluatedAt: "2026-10-12T11:00:00.000Z",
    evaluatorNotes:
      "Highest readiness in campus portfolio. Strong unit economics and granted patent make it primed for institutional Series Seed.",
  },
  {
    ventureId: "stu-roboharvest",
    ventureName: "RoboHarvest",
    domain: "Robotics & Hardware",
    stage: "Growth & Scaling",
    leadFounder: "K. Vigneshwaran",
    department: "Mechanical Engineering",
    fundingTarget: "₹45,00,000 (Seed Round)",
    currentFunding: "₹18,00,000 (TN Startup Seed + Grant)",
    readinessScore: 92,
    readinessTier: "Institutional VC Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Mechatronics, firmware, field testing team with rural roots",
        score: 92,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Acute shortage of skilled tree climbers and coconut harvesters",
        score: 95,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Autonomous tree climbing robot with 98% harvesting efficiency",
        score: 93,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "8 farm pilots operating with ₹8.50 Lakhs annual service revenue",
        score: 90,
        benchmark: 65,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "Robotics-as-a-Service (RaaS) with ₹18 per harvested tree margin",
        score: 88,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Field video documentation, patent claims, and working live demo",
        score: 94,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
    ],
    strengths: [
      "Granted Indian patent for robotic gripping mechanism",
      "Winner at State Agri-Robotics Innovation Showcase",
      "Over ₹8.5L in verified harvesting service contracts",
    ],
    investorGaps: [
      "Field maintenance logistics across dispersed agricultural clusters",
      "Working capital for component inventory buffer",
    ],
    actionPlan: [
      "Establish regional farm servicing hub partnership with local agro-centers",
      "Pitch to deeptech and agritech climate tech angel funds",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "Company Registration & DPIIT Certificate",
        category: "Legal & Corporate",
        verified: true,
        notes: "U29100TN2025PTC192004 active",
      },
      {
        id: "dil-ip",
        title: "Granted Patent Documentation",
        category: "Product & IP",
        verified: true,
        notes: "Patent granted for tree climber mechanical claw",
      },
      {
        id: "dil-fin",
        title: "RaaS Unit Economics Breakdown",
        category: "Financials",
        verified: true,
        notes: "Field economics validated across 8 orchards",
      },
      {
        id: "dil-cust",
        title: "Farmer Testimonials & Service Slips",
        category: "Commercial Traction",
        verified: true,
        notes: "Customer sign-offs compiled in data room",
      },
    ],
    lastEvaluatedAt: "2026-10-14T16:00:00.000Z",
    evaluatorNotes:
      "Impressive mechanical engineering execution solving an urgent labor crisis in agriculture. High investor readiness.",
  },
  {
    ventureId: "stu-greencharge",
    ventureName: "GreenCharge EV",
    domain: "CleanTech & IoT",
    stage: "MVP Live",
    leadFounder: "Suresh Balaji",
    department: "Electrical & Electronics Engineering",
    fundingTarget: "₹35,00,000 (Seed Round)",
    currentFunding: "₹4,00,000 (DST NIDHI PRAYAS)",
    readinessScore: 79,
    readinessTier: "Angel / Pre-Series A Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Power electronics, battery management systems engineers",
        score: 82,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "EV battery degradation and swapping downtime for last-mile delivery fleets",
        score: 84,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Smart battery swapping dock with active liquid cooling",
        score: 78,
        benchmark: 70,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "2 delivery hub pilots with 45 delivery riders",
        score: 72,
        benchmark: 65,
        weight: 1,
        status: "On Target",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "Hardware sale + monthly battery-as-a-service subscription",
        score: 75,
        benchmark: 70,
        weight: 1,
        status: "On Target",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Hardware prototype demo, thermal data logs, and pitch deck",
        score: 83,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
    ],
    strengths: [
      "Supported by prestigious DST NIDHI PRAYAS national grant",
      "Provisional patent filed for smart thermal battery charging controller",
      "Active pilot with delivery fleet riders demonstrating zero thermal failures",
    ],
    investorGaps: [
      "Requires AIS-156 EV safety standard laboratory certification",
      "Capital expenditure intensity of battery pack inventory",
    ],
    actionPlan: [
      "Submit battery pack to ARAI/ICAT for formal AIS-156 safety testing",
      "Negotiate pilot with commercial logistics fleet provider for 10-station rollout",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "LLP Incorporation Documents",
        category: "Legal & Corporate",
        verified: true,
        notes: "LLP-AAZ-4921 registered",
      },
      {
        id: "dil-ip",
        title: "Provisional Patent Application",
        category: "Product & IP",
        verified: true,
        notes: "Provisional filing confirmed with IPO",
      },
      {
        id: "dil-fin",
        title: "DST PRAYAS Grant Audit Certificate",
        category: "Financials",
        verified: true,
        notes: "Verified milestone delivery report",
      },
      {
        id: "dil-cust",
        title: "Fleet Rider Pilot Logs",
        category: "Commercial Traction",
        verified: false,
        notes: "Needs formal rider feedback survey documentation",
      },
    ],
    lastEvaluatedAt: "2026-10-10T09:30:00.000Z",
    evaluatorNotes:
      "Strong hardware IP and timely alignment with EV fast-charging trends. Needs ARAI certification to unlock institutional venture checks.",
  },
  {
    ventureId: "stu-aquapure",
    ventureName: "AquaPure Nano",
    domain: "CleanTech & IoT",
    stage: "Early Prototype",
    leadFounder: "Naveen Prakash",
    department: "Civil & Environmental Engineering",
    fundingTarget: "₹15,0,000 (Prototype / Seed Grant)",
    currentFunding: "₹75,000 (R&D Grant)",
    readinessScore: 71,
    readinessTier: "Incubation Seed Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Nanomaterials and chemical engineering faculty guides",
        score: 72,
        benchmark: 75,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Groundwater fluoride toxicity in rural Vellore and Dharmapuri belts",
        score: 82,
        benchmark: 75,
        weight: 1,
        status: "Exceeds Benchmark",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Graphene oxide filtration membrane functional in campus lab",
        score: 70,
        benchmark: 70,
        weight: 1,
        status: "On Target",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "Single pilot deployed at campus laboratory water line",
        score: 62,
        benchmark: 65,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "Low-cost cartridge replacement model under economic revision",
        score: 66,
        benchmark: 70,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Technical whitepaper ready; pitch deck currently in draft",
        score: 74,
        benchmark: 75,
        weight: 1,
        status: "Below Benchmark",
      },
    ],
    strengths: [
      "Rigorous lab-proven 99.2% fluoride extraction verified by accredited testing agency",
      "Low raw material cost when synthesized in academic batches",
    ],
    investorGaps: [
      "Patent draft pending final attorney review and prior-art search",
      "Need a commercial co-founder with supply-chain or B2G distribution experience",
    ],
    actionPlan: [
      "File provisional patent before publishing any student thesis results",
      "Pair with industry mentor from water treatment sector via Incubation Mentor Network",
      "Apply for Tamil Nadu State Innovation Voucher Program (IVP)",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "Student Pre-Incubation Agreement",
        category: "Legal & Corporate",
        verified: true,
        notes: "Campus incubator incubation MoU signed",
      },
      {
        id: "dil-ip",
        title: "Prior Art & Patent Search",
        category: "Product & IP",
        verified: false,
        notes: "In drafting with campus IP cell",
      },
      {
        id: "dil-fin",
        title: "BOM Cost Breakdown",
        category: "Financials",
        verified: true,
        notes: "Lab-level cost sheet available",
      },
      {
        id: "dil-cust",
        title: "Community Village Pilot MOU",
        category: "Commercial Traction",
        verified: false,
        notes: "Identified village panchayat; MOU pending approval",
      },
    ],
    lastEvaluatedAt: "2026-09-28T14:15:00.000Z",
    evaluatorNotes:
      "Deep scientific promise with great societal impact. Critical path is patent filing followed by an off-campus community pilot.",
  },
  {
    ventureId: "stu-cybershield",
    ventureName: "CyberShield Campus",
    domain: "FinTech & Web3",
    stage: "Ideation",
    leadFounder: "Akash Verma",
    department: "Computer Science & Engineering",
    fundingTarget: "₹10,00,000 (Pre-Seed Grant)",
    currentFunding: "Bootstrapped",
    readinessScore: 65,
    readinessTier: "Incubation Seed Ready",
    dimensions: [
      {
        id: "team",
        name: "Team & Execution",
        description: "Student developers with competitive programming background",
        score: 68,
        benchmark: 75,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "problem",
        name: "Problem Validation",
        description: "Credential fraud and examination impersonation in university networks",
        score: 75,
        benchmark: 75,
        weight: 1,
        status: "On Target",
      },
      {
        id: "product",
        name: "Product & Tech Maturity",
        description: "Smart contract smart contract prototype deployed on Sepolia testnet",
        score: 64,
        benchmark: 70,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "traction",
        name: "Traction & Commercial Pilots",
        description: "No live institutional pilot yet; tested in internal student hackathon",
        score: 55,
        benchmark: 65,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "businessModel",
        name: "Unit Economics & Business Model",
        description: "SaaS licensing per accredited institution",
        score: 62,
        benchmark: 70,
        weight: 1,
        status: "Below Benchmark",
      },
      {
        id: "pitch",
        name: "Pitch & Diligence Readiness",
        description: "Deck drafted; lacks institutional traction metrics",
        score: 66,
        benchmark: 75,
        weight: 1,
        status: "Below Benchmark",
      },
    ],
    strengths: [
      "Strong technical understanding of decentralized zero-knowledge proofs",
      "Solves a real administrative compliance headache in credential verification",
    ],
    investorGaps: [
      "No enterprise pilot deployment or customer validation interviews with university registrars",
      "Unclear regulatory stance on decentralized storage of student identity data",
    ],
    actionPlan: [
      "Pilot credential verification on 500 mock degrees within the college examination office",
      "Consult university cyber law advisor regarding Digital Personal Data Protection (DPDP) compliance",
    ],
    diligenceChecklist: [
      {
        id: "dil-corp",
        title: "Campus Pre-Incubation Agreement",
        category: "Legal & Corporate",
        verified: true,
        notes: "Pre-incubation status granted",
      },
      {
        id: "dil-ip",
        title: "Open Source / IP Assignment",
        category: "Product & IP",
        verified: false,
        notes: "Code currently in student personal GitHub repo",
      },
      {
        id: "dil-fin",
        title: "Tokenomics / Pricing Model",
        category: "Financials",
        verified: false,
        notes: "Pending pricing architecture review",
      },
      {
        id: "dil-cust",
        title: "Institutional Letters of Intent",
        category: "Commercial Traction",
        verified: false,
        notes: "Targeting 2 college registrars for pilot intent",
      },
    ],
    lastEvaluatedAt: "2026-09-15T11:00:00.000Z",
    evaluatorNotes:
      "Promising early-stage student innovation. Focus should remain on college testbed deployment before external fundraising.",
  },
];

const inMemoryEvaluations = sharedState("campus.incubation.funding-readiness.v1", () => {
  const map = new Map<string, VentureFundingReadiness[]>();
  map.set("COL-1001", [...INITIAL_EVALUATIONS]);
  map.set("all", [...INITIAL_EVALUATIONS]);
  return map;
});

function getCollegeId(session: SessionPayload): string {
  if (!session.college || session.college === "all") return "COL-1001";
  return session.college;
}

export async function getFundingReadinessOverview(
  session: SessionPayload,
  selectedVentureId?: string
): Promise<FundingReadinessOverview> {
  const collegeId = getCollegeId(session);
  let list = inMemoryEvaluations.get(collegeId);
  if (!list) {
    list = [...INITIAL_EVALUATIONS];
    inMemoryEvaluations.set(collegeId, list);
  }

  const effectiveVentureId = selectedVentureId || list[0]?.ventureId || "stu-agrisoil";
  const current = list.find((v) => v.ventureId === effectiveVentureId) || list[0]!;

  const totalScore = list.reduce((acc, v) => acc + v.readinessScore, 0);
  const averageReadinessScore = Math.round(totalScore / list.length);

  const angelReadyCount = list.filter(
    (v) => v.readinessTier === "Angel / Pre-Series A Ready" || v.readinessTier === "Institutional VC Ready"
  ).length;

  const criticalGapsCount = list.reduce((acc, v) => acc + v.investorGaps.length, 0);

  return {
    averageReadinessScore,
    angelReadyCount,
    totalFundingTarget: "₹2.80 Crores",
    criticalGapsCount,
    selectedVentureId: current.ventureId,
    allVentures: list.map((v) => ({
      ventureId: v.ventureId,
      ventureName: v.ventureName,
      domain: v.domain,
      stage: v.stage,
      readinessScore: v.readinessScore,
      readinessTier: v.readinessTier,
    })),
    currentEvaluation: current,
  };
}

export async function updateVentureReadiness(
  session: SessionPayload,
  ventureId: string,
  input: UpdateReadinessInput
): Promise<VentureFundingReadiness | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryEvaluations.get(collegeId) || [];
  const evaluation = list.find((v) => v.ventureId === ventureId);
  if (!evaluation) return null;

  if (input.dimensions && input.dimensions.length > 0) {
    for (const dInput of input.dimensions) {
      const dim = evaluation.dimensions.find((d) => d.id === dInput.id);
      if (dim) {
        dim.score = dInput.score;
        dim.status = computeDimensionStatus(dim.score, dim.benchmark);
      }
    }
    // Recompute total readiness score
    const avg = Math.round(
      evaluation.dimensions.reduce((acc, d) => acc + d.score, 0) / evaluation.dimensions.length
    );
    evaluation.readinessScore = avg;
    evaluation.readinessTier = computeTier(avg);
  }

  if (input.fundingTarget !== undefined) evaluation.fundingTarget = input.fundingTarget;
  if (input.strengths !== undefined) evaluation.strengths = input.strengths;
  if (input.investorGaps !== undefined) evaluation.investorGaps = input.investorGaps;
  if (input.actionPlan !== undefined) evaluation.actionPlan = input.actionPlan;
  if (input.evaluatorNotes !== undefined) evaluation.evaluatorNotes = input.evaluatorNotes;

  if (input.diligenceChecklist && input.diligenceChecklist.length > 0) {
    for (const dCheck of input.diligenceChecklist) {
      const item = evaluation.diligenceChecklist.find((it) => it.id === dCheck.id);
      if (item) {
        item.verified = dCheck.verified;
        if (dCheck.notes !== undefined) item.notes = dCheck.notes;
      }
    }
  }

  evaluation.lastEvaluatedAt = new Date().toISOString();
  inMemoryEvaluations.set(collegeId, list);
  return evaluation;
}
