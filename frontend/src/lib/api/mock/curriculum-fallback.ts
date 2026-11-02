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

const PO_MEDICAL = [
  "PO1: Clinician: Demonstrate comprehensive knowledge of health, disease, diagnostic skills, and patient-centered therapeutic management conforming to NMC CBME guidelines.",
  "PO2: Communicator: Communicate effectively, empathetically, and clearly with patients, families, and healthcare colleagues.",
  "PO3: Lifelong Learner: Demonstrate continuous pursuit of modern medical knowledge, evidence-based clinical practices, and research orientation.",
  "PO4: Professional & Ethicist: Adhere to highest ethical principles, medical jurisprudence, patient confidentiality, and accountability.",
  "PO5: Leader & Team Member: Function effectively as leader and collaborative member in healthcare delivery teams and hospital setups.",
  "PO6: Critical Thinker: Apply clinical reasoning and evidence-based decision making in preventive, promotive, and curative care.",
  "PO7: Community Healthcare Provider: Recognize social determinants of health and organize community-based preventive and primary care.",
];

const PO_NURSING = [
  "PO1: Patient-Centered Care: Provide safe, evidence-based, compassionate nursing care across various healthcare and clinical settings.",
  "PO2: Clinical Judgment: Apply critical thinking and nursing process in clinical decision-making, health assessment, and emergency care.",
  "PO3: Communication & Teamwork: Foster collaborative communication with patients, families, and multidisciplinary healthcare teams.",
  "PO4: Ethical Practice: Adhere to professional nursing code of ethics, patient advocacy, and legal standards of healthcare practice.",
  "PO5: Health Promotion: Plan and deliver preventive, promotive, and rehabilitative community nursing care.",
];

const TEMPLATES: Record<"ece" | "cse" | "mbbs" | "nursing", DisciplineTemplate> = {
  mbbs: {
    disciplineCode: "MED",
    programmeOutcomes: PO_MEDICAL,
    semesters: [
      // Sem 1 - Phase I Pre-Clinical Part 1
      [
        { codeSuffix: "1101", title: "Human Anatomy and Histology I", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1102", title: "Human Physiology and Biophysics I", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1103", title: "Medical Biochemistry and Molecular Biology I", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1104", title: "Early Clinical Exposure (ECE) I", category: "EEC", l: 1, t: 0, p: 2, credits: 2 },
        { codeSuffix: "1105", title: "Foundation Course and Medical Ethics (AETCOM)", category: "HS", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "1108", title: "Human Anatomy Dissection Practical I", category: "PC", l: 0, t: 0, p: 4, credits: 2 },
        { codeSuffix: "1109", title: "Physiology and Hematology Laboratory I", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 2 - Phase I Pre-Clinical Part 2
      [
        { codeSuffix: "1201", title: "Human Anatomy and Embryology II", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1202", title: "Human Physiology and Neurophysiology II", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1203", title: "Medical Biochemistry and Clinical Genetics II", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1204", title: "Early Clinical Exposure (ECE) II", category: "EEC", l: 1, t: 0, p: 2, credits: 2 },
        { codeSuffix: "1208", title: "Human Anatomy Dissection Practical II", category: "PC", l: 0, t: 0, p: 4, credits: 2 },
        { codeSuffix: "1209", title: "Clinical Physiology and Simulation Lab II", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "1210", title: "Basic Life Support and First Aid Skills", category: "EEC", l: 0, t: 0, p: 2, credits: 1 },
      ],
      // Sem 3 - Phase II Para-Clinical Part 1
      [
        { codeSuffix: "2101", title: "General Pathology and Pathophysiology", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2102", title: "Systemic and Clinical Microbiology I", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2103", title: "General Pharmacology and Autonomic System", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2104", title: "Clinical Bedside Postings Phase II-A", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
        { codeSuffix: "2108", title: "Histopathology and Hematology Practical", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2109", title: "Microbiology Diagnostic Techniques Lab", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
        { codeSuffix: "2110", title: "Experimental and Clinical Pharmacology Lab", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 4 - Phase II Para-Clinical Part 2
      [
        { codeSuffix: "2201", title: "Systemic Pathology and Morbid Anatomy", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2202", title: "Immunology, Virology and Parasitology", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2203", title: "Systemic and Clinical Pharmacology", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "2204", title: "Forensic Medicine and Medical Jurisprudence I", category: "PC", l: 2, t: 0, p: 1, credits: 2.5 },
        { codeSuffix: "2205", title: "Clinical Bedside Postings Phase II-B", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
        { codeSuffix: "2208", title: "Clinical Pathology and Morbid Anatomy Lab", category: "PC", l: 0, t: 0, p: 3, credits: 1.5 },
      ],
      // Sem 5 - Phase III Part 1
      [
        { codeSuffix: "3101", title: "Community Medicine and Epidemiology", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "3102", title: "Ophthalmology and Visual Sciences", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "3103", title: "Otorhinolaryngology (ENT) and Head-Neck Surgery", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "3104", title: "Forensic Medicine, Toxicology and Autopsy Practice", category: "PC", l: 2, t: 0, p: 2, credits: 3 },
        { codeSuffix: "3108", title: "Clinical Ophthalmology Bedside Postings", category: "EEC", l: 0, t: 0, p: 4, credits: 2 },
        { codeSuffix: "3109", title: "Clinical ENT Bedside Postings", category: "EEC", l: 0, t: 0, p: 4, credits: 2 },
      ],
      // Sem 6 - Phase III Part 1 Continued
      [
        { codeSuffix: "3201", title: "Preventive and Social Medicine", category: "PC", l: 3, t: 1, p: 0, credits: 4 },
        { codeSuffix: "3202", title: "Clinical Dermatology, Venereology and Leprosy", category: "PC", l: 2, t: 0, p: 1, credits: 2.5 },
        { codeSuffix: "3203", title: "Clinical Psychiatry and Behavioral Sciences", category: "PC", l: 2, t: 0, p: 1, credits: 2.5 },
        { codeSuffix: "3204", title: "Respiratory Medicine and Pulmonology", category: "PC", l: 2, t: 0, p: 1, credits: 2.5 },
        { codeSuffix: "3208", title: "Family Health and Rural Outreach Postings", category: "EEC", l: 0, t: 0, p: 4, credits: 2 },
        { codeSuffix: "3209", title: "Inpatient Clinical Bedside Postings", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
      ],
      // Sem 7 - Phase III Part 2
      [
        { codeSuffix: "4101", title: "General Medicine and Clinical Therapeutics I", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "4102", title: "General Surgery and Surgical Principles I", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "4103", title: "Obstetrics and Maternal Health", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "4104", title: "Paediatrics and Child Health I", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4105", title: "Orthopaedics and Trauma Surgery", category: "PC", l: 2, t: 0, p: 1, credits: 2.5 },
        { codeSuffix: "4108", title: "General Medicine Inpatient Ward Postings", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
        { codeSuffix: "4109", title: "General Surgery Operation Theatre Postings", category: "EEC", l: 0, t: 0, p: 6, credits: 3 },
      ],
      // Sem 8 - Phase III Part 2 Final
      [
        { codeSuffix: "4201", title: "General Medicine and Critical Care II", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "4202", title: "General Surgery and Emergency Medicine II", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "4203", title: "Gynaecology and Reproductive Healthcare", category: "PC", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "4204", title: "Paediatrics, Neonatology and Pediatric Emergencies II", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4205", title: "Anaesthesiology, Critical Care and Pain Management", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "4209", title: "Comprehensive Hospital Bedside Rotations", category: "EEC", l: 0, t: 0, p: 8, credits: 4 },
      ],
    ],
  },
  nursing: {
    disciplineCode: "NUR",
    programmeOutcomes: PO_NURSING,
    semesters: [
      // Sem 1
      [
        { codeSuffix: "1101", title: "Applied Anatomy and Physiology", category: "BS", l: 3, t: 0, p: 2, credits: 4 },
        { codeSuffix: "1102", title: "Applied Sociology and Psychology", category: "HS", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1103", title: "Nursing Foundation I (Theory)", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1104", title: "Nursing Foundation I (Clinical Skills Lab)", category: "PC", l: 0, t: 0, p: 6, credits: 3 },
        { codeSuffix: "1105", title: "Communicative English", category: "HS", l: 2, t: 0, p: 0, credits: 2 },
      ],
      // Sem 2
      [
        { codeSuffix: "1201", title: "Applied Biochemistry and Nutrition", category: "BS", l: 3, t: 0, p: 1, credits: 3.5 },
        { codeSuffix: "1202", title: "Nursing Foundation II (Theory)", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "1203", title: "Nursing Foundation II (Clinical Practicum)", category: "PC", l: 0, t: 0, p: 8, credits: 4 },
        { codeSuffix: "1204", title: "Health Assessment and Vital Signs Lab", category: "PC", l: 1, t: 0, p: 2, credits: 2 },
      ],
      // Sem 3
      [
        { codeSuffix: "2101", title: "Applied Microbiology and Infection Control", category: "BS", l: 3, t: 0, p: 1, credits: 3.5 },
        { codeSuffix: "2102", title: "Pharmacology I", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "2103", title: "Adult Health Nursing I (Medical-Surgical Theory)", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "2104", title: "Adult Health Nursing I (Hospital Bedside Practicum)", category: "PC", l: 0, t: 0, p: 8, credits: 4 },
      ],
      // Sem 4
      [
        { codeSuffix: "2201", title: "Pharmacology II and Clinical Therapeutics", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "2202", title: "Pathology and Genetics for Nurses", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "2203", title: "Adult Health Nursing II (Advanced Medical-Surgical)", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "2204", title: "Adult Health Nursing II (Hospital Bedside Practicum)", category: "PC", l: 0, t: 0, p: 8, credits: 4 },
      ],
      // Sem 5
      [
        { codeSuffix: "3101", title: "Child Health Nursing I (Theory)", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3102", title: "Mental Health Nursing I (Theory)", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3103", title: "Community Health Nursing I", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3104", title: "Child and Mental Health Clinical Postings", category: "EEC", l: 0, t: 0, p: 8, credits: 4 },
      ],
      // Sem 6
      [
        { codeSuffix: "3201", title: "Child Health Nursing II (Advanced Paediatrics)", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "3202", title: "Mental Health Nursing II (Psychiatric Nursing)", category: "PC", l: 2, t: 0, p: 0, credits: 2 },
        { codeSuffix: "3203", title: "Nursing Management and Leadership", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "3204", title: "Specialty Clinical Postings (ICU/OT/Pediatric)", category: "EEC", l: 0, t: 0, p: 8, credits: 4 },
      ],
      // Sem 7
      [
        { codeSuffix: "4101", title: "Midwifery / Obstetrics and Gynaecology Nursing I", category: "PC", l: 4, t: 0, p: 0, credits: 4 },
        { codeSuffix: "4102", title: "Nursing Research and Biostatistics", category: "PC", l: 2, t: 1, p: 0, credits: 3 },
        { codeSuffix: "4103", title: "Obstetrics Bedside and Labour Room Postings", category: "EEC", l: 0, t: 0, p: 8, credits: 4 },
      ],
      // Sem 8
      [
        { codeSuffix: "4201", title: "Midwifery and Gynaecology Nursing II", category: "PC", l: 3, t: 0, p: 0, credits: 3 },
        { codeSuffix: "4202", title: "Comprehensive Hospital Clinical Internship", category: "EEC", l: 0, t: 0, p: 16, credits: 8 },
      ],
    ],
  },
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

function matchDisciplineTemplate(degree: string, discipline: string): DisciplineTemplate {
  const norm = (degree + " " + discipline).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("nurs")) {
    return TEMPLATES.nursing;
  }
  if (norm.includes("mbbs") || norm.includes("medic") || norm.includes("surg") || norm.includes("doctor") || norm.includes("clinic") || norm.includes("health")) {
    return TEMPLATES.mbbs;
  }
  if (norm.includes("ece") || norm.includes("electronic") || norm.includes("telecom") || norm.includes("communication")) {
    return TEMPLATES.ece;
  }
  if (norm.includes("cse") || norm.includes("computer") || norm.includes("software") || norm.includes("data") || norm.includes("artificial") || norm.includes("it")) {
    return TEMPLATES.cse;
  }
  return norm.includes("btech") || norm.includes("be") || norm.includes("engineer") ? TEMPLATES.cse : TEMPLATES.mbbs;
}

export function fallbackCourses(c: CreateCurriculum): { courses: CurriculumData["courses"]; programmeOutcomes: string[] } {
  const tmpl = matchDisciplineTemplate(c.degree || "", c.discipline);
  const prefix = tmpl.disciplineCode;
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
        topics: `Introduction to ${q.title}, basic definitions, fundamental principles, standard taxonomy, historical context, underlying concepts and illustrative case studies.`,
        hours: perUnit + remainder,
      },
      {
        title: "Unit II: Core Models & Clinical/Analytical Frameworks",
        topics: `Core mechanisms, analytical modeling, governing principles, component-level analysis, structural representations, diagnostic parameters and observational studies.`,
        hours: perUnit,
      },
      {
        title: "Unit III: Methodologies & Practical Procedures",
        topics: `Procedures, clinical / technical workflows, practical standards, constraint management, protocol adherence and modern professional best practices.`,
        hours: perUnit,
      },
      {
        title: "Unit IV: Implementation, Diagnostics & Evidence Evaluation",
        topics: `Diagnostic strategies, case evaluations, troubleshooting procedures, management protocols, clinical correlations and practical verification.`,
        hours: perUnit,
      },
      {
        title: "Unit V: Advanced Topics, Standards & Modern Trends",
        topics: `Modern standards, regulatory compliance, emerging frameworks, ethical considerations, future research directions and contemporary real-world applications.`,
        hours: perUnit,
      },
    ],
    outcomes: [
      `CO1: Understand and explain foundational principles and theoretical framework of ${q.title}.`,
      `CO2: Apply diagnostic, analytical and practical methods in ${q.title}.`,
      `CO3: Correlate pathological / system mechanisms, functional requirements and clinical signs.`,
      `CO4: Formulate and evaluate management plans conforming to standard protocols.`,
      `CO5: Demonstrate ethical practice, modern techniques and interdisciplinary patient/system care.`,
    ],
    textbooks: [
      `${q.title}: Principles and Practice, Latest Edition, 2024.`,
      `Standard Text of ${q.programme || q.title}, Higher Education Publications, 2023.`,
      `Clinical and Applied Foundations of ${q.title}, Medical & Technical Press, 2022.`,
    ],
  };
}
