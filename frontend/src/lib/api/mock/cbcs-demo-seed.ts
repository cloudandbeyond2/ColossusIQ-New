import "server-only";
import type { CbcsCategory } from "@/lib/api/cbcs-schemas";

/*
 * Sample elective baskets for the in-memory demo backend ONLY (cbcs-store.ts seeds them once per demo college).
 * A real (PostgreSQL) college starts with an empty catalogue and builds its own through the page.
 */

export interface DemoCourse {
  code: string;
  title: string;
  offeringDepartment: string;
  semester: number;
  category: CbcsCategory;
  credits: number;
  seatsTotal: number;
  instructor: string;
  schedule: string;
  syllabusSummary: string;
}

export interface DemoRegistration {
  studentName: string;
  regNo: string;
  department: string;
  semester: number;
  courseCode: string;
  registeredAt: string;
}

export const ARTS_SCIENCE_COURSES: DemoCourse[] = [
  {
    code: "SEC201",
    title: "Data Analytics with Excel & PowerBI",
    offeringDepartment: "Computer Science",
    semester: 4,
    category: "Skill Enhancement Course (SEC)",
    credits: 2,
    seatsTotal: 60,
    instructor: "Dr. K. Anand, M.Sc., Ph.D.",
    schedule: "Tue & Thu, 02:00 PM – 03:30 PM (CS Lab 2)",
    syllabusSummary: "Advanced data models, DAX formulas, interactive KPI dashboards, pivot tables, and statistical forecasting.",
  },
  {
    code: "GE202",
    title: "Digital Marketing & Content Strategy",
    offeringDepartment: "Commerce",
    semester: 4,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 60,
    instructor: "Prof. S. Divya, MBA, M.Phil.",
    schedule: "Mon & Wed, 10:00 AM – 11:30 AM (Room 204)",
    syllabusSummary: "Search engine optimization (SEO), social media branding, Google Ads campaign metrics, and content calendars.",
  },
  {
    code: "AECC101",
    title: "Environmental Studies & Sustainable Green Audit",
    offeringDepartment: "Chemistry & Environmental Science",
    semester: 2,
    category: "Ability Enhancement (AECC)",
    credits: 2,
    seatsTotal: 400,
    instructor: "Dr. M. Sangeetha, Ph.D.",
    schedule: "Friday, 09:00 AM – 11:00 AM (Main Auditorium)",
    syllabusSummary: "Ecosystem dynamics, biodiversity conservation, pollution control, e-waste guidelines, and campus climate footprints.",
  },
  {
    code: "DSE301",
    title: "Tamil Folklore, Ethno-arts & Heritage",
    offeringDepartment: "Tamil Literature",
    semester: 6,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 40,
    instructor: "Dr. R. Selvamani, Ph.D.",
    schedule: "Mon, Wed & Fri, 01:00 PM – 02:00 PM (Language Block)",
    syllabusSummary: "Oral traditions, folk ballads, performative temple arts, archaeological artifacts, and ethno-musicology.",
  },
  {
    code: "DSE302",
    title: "Green Chemistry & Sustainable Organic Synthesis",
    offeringDepartment: "Chemistry",
    semester: 6,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 40,
    instructor: "Dr. V. Ramanathan, Ph.D.",
    schedule: "Tue & Thu, 11:30 AM – 01:00 PM (Science Block)",
    syllabusSummary: "12 Principles of Green Chemistry, atom economy, supercritical solvents, microwave-assisted reactions, and biocatalysts.",
  },
  {
    code: "VAC103",
    title: "Yoga, Ergonomics & Mental Well-being",
    offeringDepartment: "Physical Education & Wellness",
    semester: 2,
    category: "Value-Added Course (VAC)",
    credits: 2,
    seatsTotal: 120,
    instructor: "Mr. P. Murugesan, M.P.Ed., NIS",
    schedule: "Tue & Thu, 06:30 AM – 07:30 AM (Indoor Gymnasium)",
    syllabusSummary: "Asanas, pranayama, stress relaxation mechanisms, workplace posture ergonomics, and mindful lifestyle habits.",
  },
  {
    code: "SEC203",
    title: "Python for Exploratory Data Science",
    offeringDepartment: "Mathematics & Statistics",
    semester: 4,
    category: "Skill Enhancement Course (SEC)",
    credits: 3,
    seatsTotal: 60,
    instructor: "Dr. N. Rajesh, Ph.D.",
    schedule: "Wed & Fri, 02:00 PM – 03:30 PM (Lab 4)",
    syllabusSummary: "NumPy matrix computation, Pandas dataframes, Seaborn visualizations, and statistical hypothesis testing.",
  },
  {
    code: "GE204",
    title: "Journalism, Podcasting & Media Ethics",
    offeringDepartment: "English & Communication",
    semester: 4,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 50,
    instructor: "Prof. Ananya Roy, M.A., NET",
    schedule: "Mon & Thu, 03:00 PM – 04:30 PM (Media Studio)",
    syllabusSummary: "News gathering, podcast audio editing in Audacity, investigative interview techniques, and broadcast defamation laws.",
  },
];

export const MANAGEMENT_COURSES: DemoCourse[] = [
  {
    code: "DSE401",
    title: "FinTech Fundamentals & Blockchain Applications",
    offeringDepartment: "Finance",
    semester: 4,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 60,
    instructor: "Prof. S. Harini, Ph.D.",
    schedule: "Mon & Wed, 09:30 AM – 11:00 AM (Seminar Hall 1)",
    syllabusSummary: "Digital payment gateways, UPI architecture, decentralized ledgers, smart contracts, and algorithmic risk management.",
  },
  {
    code: "DSE402",
    title: "Digital Marketing, SEO & Growth Hacking",
    offeringDepartment: "Marketing",
    semester: 4,
    category: "Discipline-Specific Elective (DSE)",
    credits: 3,
    seatsTotal: 60,
    instructor: "Prof. K. Arvind, MBA",
    schedule: "Tue & Thu, 10:00 AM – 11:30 AM (Room 302)",
    syllabusSummary: "CAC and LTV funnel optimization, viral loops, influencer partnerships, and attribution modelling.",
  },
  {
    code: "SEC301",
    title: "Advanced Negotiation & Conflict Resolution",
    offeringDepartment: "Human Resources",
    semester: 3,
    category: "Skill Enhancement Course (SEC)",
    credits: 2,
    seatsTotal: 40,
    instructor: "Dr. P. Nandhini, Ph.D.",
    schedule: "Friday, 02:00 PM – 04:00 PM (Executive Boardroom)",
    syllabusSummary: "Harvard principled negotiation framework, BATNA analysis, psychological anchoring, and collective bargaining simulations.",
  },
  {
    code: "SEC302",
    title: "Business Analytics with Tableau & Python",
    offeringDepartment: "Operations & Analytics",
    semester: 3,
    category: "Skill Enhancement Course (SEC)",
    credits: 3,
    seatsTotal: 60,
    instructor: "Dr. R. Vignesh, Ph.D.",
    schedule: "Mon & Thu, 02:00 PM – 03:30 PM (Analytics Lab)",
    syllabusSummary: "Executive dashboarding, customer churn predictive models, inventory EOQ sensitivity, and cluster segmentation.",
  },
  {
    code: "GE201",
    title: "Supply Chain Logistics & Global E-Commerce",
    offeringDepartment: "Supply Chain",
    semester: 2,
    category: "Generic Elective (GE)",
    credits: 3,
    seatsTotal: 50,
    instructor: "Prof. M. Karthikeyan, MBA",
    schedule: "Tue & Fri, 11:30 AM – 01:00 PM (Room 105)",
    syllabusSummary: "Cross-docking, reverse logistics, Amazon FBA fulfillment, container shipping economics, and customs compliance.",
  },
  {
    code: "AECC102",
    title: "Corporate Governance, Business Ethics & CSR",
    offeringDepartment: "General Management",
    semester: 2,
    category: "Ability Enhancement (AECC)",
    credits: 2,
    seatsTotal: 120,
    instructor: "Dr. S. Meenakshisundaram, Ph.D.",
    schedule: "Wednesday, 01:30 PM – 03:30 PM (Auditorium)",
    syllabusSummary: "Companies Act 2013 §135 mandates, board independence, insider trading prohibitions, and ESG sustainability reporting.",
  },
  {
    code: "VAC201",
    title: "Executive Presence & Mindful Leadership",
    offeringDepartment: "Organizational Behaviour",
    semester: 4,
    category: "Value-Added Course (VAC)",
    credits: 2,
    seatsTotal: 40,
    instructor: "Dr. Jayashree Raman, Ph.D.",
    schedule: "Saturday, 10:00 AM – 12:00 PM (Conference Hall)",
    syllabusSummary: "Emotional intelligence in high-stakes decisions, active listening, executive vocal modulation, and burnout resilience.",
  },
];


/** Sample registrations (arts & science demo college). */
export const DEMO_REGISTRATIONS: DemoRegistration[] = [
  { studentName: "Kavitha Sundaram", regNo: "22CS1042", department: "Computer Science", semester: 4, courseCode: "SEC201", registeredAt: "2026-10-10T04:45:00Z" },
  { studentName: "Dinesh Kumar", regNo: "22CO1019", department: "Commerce", semester: 4, courseCode: "GE202", registeredAt: "2026-10-10T06:00:00Z" },
  { studentName: "Sanjay Narayanan", regNo: "22EN1008", department: "English", semester: 4, courseCode: "GE204", registeredAt: "2026-10-11T03:50:00Z" },
  { studentName: "Priyanka Balaji", regNo: "22CH1027", department: "Chemistry", semester: 6, courseCode: "DSE302", registeredAt: "2026-10-11T08:35:00Z" },
  { studentName: "Gokul Prasad", regNo: "22MA1014", department: "Mathematics", semester: 4, courseCode: "SEC203", registeredAt: "2026-10-12T03:15:00Z" },
];
