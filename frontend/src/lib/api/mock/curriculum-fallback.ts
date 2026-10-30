import "server-only";
import { COURSE_CATEGORIES, Course, Syllabus, type CreateCurriculum, type CurriculumData, type SyllabusRequest } from "@/lib/api/curriculum-schemas";
import { cleanText } from "@/lib/security/sanitize";

const clean = (s: string, max: number) => cleanText(s.replace(/https?:\/\/\S+/gi, "").replace(/<\/?[a-z][^>]*>/gi, ""), max);

interface DisciplineTemplate {
  disciplineCode: string;
  programmeOutcomes: string[];
  semesters: Array<Array<{
    codeSuffix: string;
    title: string;
    category: (typeof COURSE_CATEGORIES)[number];
    l: number;
    t: number;
    p: number;
    credits: number;
  }>>;
}

const PO_ENGINEERING = [
  "PO1: Engineering Knowledge: Apply the knowledge of mathematics, science, engineering fundamentals, and an engineering specialization to the solution of complex engineering problems.",
  "PO2: Problem Analysis: Identify, formulate, review research literature, and analyze complex engineering problems reaching substantiated conclusions using first principles of mathematics, natural sciences, and engineering sciences.",
  "PO3: Design/Development of Solutions: Design solutions for complex engineering problems and design system components or processes that meet the specified needs with appropriate consideration for public health and safety, and cultural, societal, and environmental considerations.",
  "PO4: Conduct Investigations of Complex Problems: Use research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of information to provide valid conclusions.",
  "PO5: Modern Tool Usage: Create, select, and apply appropriate techniques, resources, and modern engineering and IT tools including prediction and modeling to complex engineering activities with an understanding of the limitations.",
  "PO6: The Engineer and Society: Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to professional engineering practice.",
  "PO7: Environment and Sustainability: Understand the impact of professional engineering solutions in societal and environmental contexts, and demonstrate knowledge of, and need for sustainable development.",
  "PO8: Ethics: Apply ethical principles and commit to professional ethics and responsibilities and norms of engineering practice.",
  "PO9: Individual and Team Work: Function effectively as an individual, and as a member or leader in diverse teams, and in multidisciplinary settings.",
  "PO10: Communication: Communicate effectively on complex engineering activities with the engineering community and with society at large, such as being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.",
  "PO11: Project Management and Finance: Demonstrate knowledge and understanding of engineering and management principles and apply these to one's own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.",
  "PO12: Life-long Learning: Recognize the need for, and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.",
];

const TEMPLATES: Record<"ece" | "cse", DisciplineTemplate> = {
  ece: {
    disciplineCode: "EC",
    programmeOutcomes: PO_ENGINEERING,
    semesters: [
      // Sem 1
      [
        { codeSuffix: "1101", title: "Professional English I", category: "HS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1102", title: "Engineering Mathematics I", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1103", title: "Engineering Physics", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1104", title: "Engineering Chemistry", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1105", title: "Problem Solving and Python Programming", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1106", title: "Engineering Graphics", category: "ES", l: 2, t: 0, p: 2, credits: 3 },
        { codeSuffix: "1108", title: "Physics and Chemistry Laboratory", category: "BS", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "1109", title: "Python Programming Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 2
      [
        { codeSuffix: "1201", title: "Professional English II", category: "HS", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "1202", title: "Engineering Mathematics II", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1203", title: "Physics for Electronics Engineering", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1204", title: "Basic Electrical and Instrumentation Engineering", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1205", title: "Circuit Theory and Analysis", category: "ES", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1206", title: "Programming in C and Data Structures", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1208", title: "Engineering Practice Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "1209", title: "Circuits and Devices Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 3
      [
        { codeSuffix: "2101", title: "Transforms and Partial Differential Equations", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2102", title: "Electronic Devices and Circuits", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2103", title: "Digital System Design", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2104", title: "Signals and Systems", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2105", title: "Network Theory and Synthesis", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2108", title: "Analog Circuits Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2109", title: "Digital System Design Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2110", title: "Environmental Science and Sustainability", category: "MC", l: 2, t: 0, p: 0, credits: 0 },
      ],
      // Sem 4
      [
        { codeSuffix: "2201", title: "Probability and Random Processes", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2202", title: "Electromagnetic Fields and Waves", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2203", title: "Linear Integrated Circuits", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2204", title: "Analog and Digital Communication", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2205", title: "Microprocessors and Microcontrollers", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2208", title: "Linear Integrated Circuits Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2209", title: "Microprocessor and Microcontroller Lab", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2210", title: "Mini Project and Circuit Simulation", category: "EEC", l: 0, t: 0, p: 2, credits: 1 },
      ],
      // Sem 5
      [
        { codeSuffix: "3101", title: "Digital Signal Processing", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "3102", title: "Transmission Lines and Waveguides", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "3103", title: "Control Systems Engineering", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3104", title: "Computer Architecture and Organization", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3105", title: "Professional Elective I", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3106", title: "Open Elective I", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3108", title: "Digital Signal Processing Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3109", title: "Communication Systems Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 6
      [
        { codeSuffix: "3201", title: "VLSI Design and Technology", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3202", title: "Antennas and Microwave Engineering", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3203", title: "Wireless Communication Systems", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3204", title: "Professional Elective II", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3205", title: "Professional Elective III", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3206", title: "Open Elective II", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3208", title: "VLSI and Embedded Systems Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3209", title: "Microwave and Optical Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3210", title: "Technical Seminar and Report Writing", category: "EEC", l: 0, t: 0, p: 2, credits: 1 },
      ],
      // Sem 7
      [
        { codeSuffix: "4101", title: "Optical Communication and Networks", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4102", title: "Embedded Systems and IoT", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4103", title: "Professional Elective IV", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4104", title: "Professional Elective V", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4105", title: "Open Elective III", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4108", title: "IoT and Embedded Systems Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "4109", title: "Project Work Phase I", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
      ],
      // Sem 8
      [
        { codeSuffix: "4201", title: "Professional Elective VI", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4202", title: "Open Elective IV", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4209", title: "Project Work Phase II / Industrial Internship", category: "EEC", l: 0, t: 0, p: 16, credits: 8 },
      ],
    ],
  },
  cse: {
    disciplineCode: "CS",
    programmeOutcomes: PO_ENGINEERING,
    semesters: [
      [
        { codeSuffix: "1101", title: "Professional English I", category: "HS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1102", title: "Engineering Mathematics I", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1103", title: "Engineering Physics", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1104", title: "Engineering Chemistry", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1105", title: "Problem Solving and Python Programming", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1106", title: "Engineering Graphics", category: "ES", l: 2, t: 0, p: 2, credits: 3 },
        { codeSuffix: "1108", title: "Physics and Chemistry Laboratory", category: "BS", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "1109", title: "Python Programming Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      [
        { codeSuffix: "1201", title: "Professional English II", category: "HS", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "1202", title: "Engineering Mathematics II", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1203", title: "Physics for Information Science", category: "BS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1204", title: "Basic Electrical and Electronics Engineering", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1205", title: "Programming in C", category: "ES", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1206", title: "Digital Principles and Computer Organization", category: "ES", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "1208", title: "Programming in C Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "1209", title: "Engineering Practice Laboratory", category: "ES", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      [
        { codeSuffix: "2101", title: "Discrete Mathematics", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2102", title: "Data Structures and Algorithms", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2103", title: "Object Oriented Programming using Java", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2104", title: "Database Management Systems", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2105", title: "Computer Architecture", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2108", title: "Data Structures Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2109", title: "Database Management Systems Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2110", title: "Environmental Science and Sustainability", category: "MC", l: 2, t: 0, p: 0, credits: 0 },
      ],
      [
        { codeSuffix: "2201", title: "Probability, Statistics and Queueing Theory", category: "BS", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2202", title: "Design and Analysis of Algorithms", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "2203", title: "Operating Systems", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2204", title: "Software Engineering", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2205", title: "Theory of Computation", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "2208", title: "Operating Systems Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2209", title: "Algorithms and Software Engineering Lab", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2210", title: "Technical Communication and Soft Skills", category: "EEC", l: 0, t: 0, p: 2, credits: 1 },
      ],
      [
        { codeSuffix: "3101", title: "Computer Networks", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3102", title: "Compiler Design", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "3103", title: "Artificial Intelligence and Machine Learning", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3104", title: "Web Technology", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3105", title: "Professional Elective I", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3106", title: "Open Elective I", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3108", title: "Computer Networks Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3109", title: "AI and Web Technology Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      [
        { codeSuffix: "3201", title: "Cryptography and Cyber Security", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3202", title: "Cloud Computing and Virtualization", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3203", title: "Mobile Application Development", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3204", title: "Professional Elective II", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3205", title: "Professional Elective III", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3206", title: "Open Elective II", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3208", title: "Security and Cloud Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3209", title: "Mobile App Development Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "3210", title: "Mini Project with Agile Practices", category: "EEC", l: 0, t: 0, p: 2, credits: 1 },
      ],
      [
        { codeSuffix: "4101", title: "Distributed Systems and Big Data Analytics", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4102", title: "Internet of Things Architecture", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4103", title: "Professional Elective IV", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4104", title: "Professional Elective V", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4105", title: "Open Elective III", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4108", title: "Big Data and IoT Laboratory", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "4109", title: "Project Work Phase I", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
      ],
      [
        { codeSuffix: "4201", title: "Professional Elective VI", category: "PE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4202", title: "Open Elective IV", category: "OE", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4209", title: "Project Work Phase II / Industrial Internship", category: "EEC", l: 0, t: 0, p: 16, credits: 8 },
      ],
    ],
  },
};

function matchDisciplineTemplate(discipline: string): DisciplineTemplate {
  const norm = discipline.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("ece") || norm.includes("electronic") || norm.includes("telecom") || norm.includes("communication")) {
    return TEMPLATES.ece;
  }
  if (norm.includes("cse") || norm.includes("computer") || norm.includes("software") || norm.includes("data") || norm.includes("artificial") || norm.includes("it")) {
    return TEMPLATES.cse;
  }
  return TEMPLATES.ece;
}

export function fallbackCourses(c: CreateCurriculum): { courses: CurriculumData["courses"]; programmeOutcomes: string[] } {
  const tmpl = matchDisciplineTemplate(c.discipline);
  const prefix = c.discipline.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || tmpl.disciplineCode;
  const courses: CurriculumData["courses"] = [];
  const seen = new Set<string>();

  for (let s = 1; s <= c.semesters; s++) {
    const semIndex = (s - 1) % tmpl.semesters.length;
    const semCourses = tmpl.semesters[semIndex] ?? [];
    for (const item of semCourses) {
      let code = `${item.category === "HS" || item.category === "BS" || item.category === "ES" ? item.category : prefix}${s}${item.codeSuffix.slice(1)}`;
      if (seen.has(code)) {
        code = `${prefix}${s}${Math.floor(100 + Math.random() * 899)}`;
      }
      seen.add(code);

      const parsed = Course.safeParse({
        code,
        title: clean(item.title, 120),
        semester: s,
        category: item.category,
        l: item.l,
        t: item.t,
        p: item.p,
        credits: item.credits,
        units: [],
        outcomes: [],
        textbooks: [],
      });
      if (parsed.success) {
        courses.push(parsed.data);
      }
    }
  }

  return {
    courses,
    programmeOutcomes: tmpl.programmeOutcomes.map((po) => clean(po, 300)),
  };
}

export function fallbackSyllabus(q: SyllabusRequest): Syllabus {
  const total = Math.max(15, Math.min(90, q.hours || 45));
  const perUnit = Math.floor(total / 5);
  const remainder = total - perUnit * 5;

  return {
    units: [
      {
        title: "Unit I: Foundations & Theoretical Principles",
        topics: `Introduction to ${q.title}, basic definitions, fundamental principles, standard taxonomy, historical context, underlying mathematics, domain concepts and illustrative case studies.`,
        hours: perUnit + remainder,
      },
      {
        title: "Unit II: Core Models & Analytical Frameworks",
        topics: `Mathematical formulation, modeling techniques, governing equations, component-level analysis, structural representations, parameter estimation and simulation models.`,
        hours: perUnit,
      },
      {
        title: "Unit III: System Architecture & Design Methodologies",
        topics: `Architecture design, subsystem decomposition, design constraints, standard interfaces, trade-off analysis, modular design principles and industrial best practices.`,
        hours: perUnit,
      },
      {
        title: "Unit IV: Implementation, Verification & Performance Tuning",
        topics: `Implementation strategies, testing methodologies, performance metrics, troubleshooting procedures, optimization techniques and experimental verification.`,
        hours: perUnit,
      },
      {
        title: "Unit V: Advanced Topics, Standards & Emerging Trends",
        topics: `Modern industry standards, regulatory compliance, emerging frameworks, security considerations, future research directions and contemporary real-world applications.`,
        hours: perUnit,
      },
    ],
    outcomes: [
      `CO1: Understand and explain foundational principles and theoretical framework of ${q.title}.`,
      `CO2: Apply analytical models and engineering methods to solve problems in ${q.title}.`,
      `CO3: Analyze architecture, subsystem performance and functional requirements.`,
      `CO4: Design and develop optimized implementations conforming to industry standards.`,
      `CO5: Evaluate emerging trends, modern tools, practical applications and case studies.`,
    ],
    textbooks: [
      `${q.title}: Principles and Practice, 4th Edition, Pearson Education, 2024.`,
      `Modern ${q.title}: Analysis and System Design, McGraw Hill Higher Education, 2023.`,
      `Foundations of ${q.programme}, Oxford University Press, 2022.`,
    ],
  };
}
