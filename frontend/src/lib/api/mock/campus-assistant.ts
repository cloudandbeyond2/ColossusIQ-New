import "server-only";
import { z } from "zod";
import { geminiEnabled, geminiJson } from "@/lib/ai/gemini";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import type { ChatBodyInput } from "@/lib/api/mentor-schemas";
import type { ChatReply } from "@/lib/api/schemas";
import { looksLikeInjection } from "./ai";
import { answerQuestion } from "./knowledge-base";
import { getCollege } from "./records";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });

const Out = z.object({
  message: z.string().trim().min(1).max(5000),
  sources: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

const SYSTEM_PROMPT = [
  "You are the official Campus AI Assistant for Anna Institute of Technology (affiliated with Tamil Nadu Technical University).",
  "You assist students, faculty, and administrators with clear, authoritative information regarding campus regulations, administrative workflows, academic procedures, leave and duty rules, examination protocols, campus facilities, and emergency contacts.",
  "Tailor answers specifically to the user's role (Faculty vs Student). For faculty, address academic workload, leave/OD procedures, IA marks entry, lab bookings, and seed research grants. For students, address attendance requirements, exam applications, placement procedures, hostel rules, and sports.",
  "Write in professional, friendly Markdown with clear bullet points, bold section highlights, room numbers, and contact details.",
  "Never invent arbitrary external rules. Stick to realistic collegiate administrative operations.",
  'Reply with a single JSON object: {"message": "<markdown text>", "sources": ["<document title or circular>"], "confidence": <0.7 to 1.0>}.',
].join(" ");

function inst(message: string, titles: string[], confidence = 0.95): ChatReply {
  return {
    agent: "knowledge",
    message,
    sources: titles.map((title) => ({ title, kind: "institution" as const })),
    confidence,
  };
}

function gen(message: string, confidence = 0.88): ChatReply {
  return {
    agent: "knowledge",
    message,
    sources: [{ title: "General Campus Guidance — verify with administrative office", kind: "general" as const }],
    confidence,
  };
}

/** Fallback domain response engine when Gemini is offline or prompt does not match explicit KB excerpts. */
function dynamicCampusFallback(session: SessionPayload, question: string, collegeName: string): ChatReply {
  const m = question.toLowerCase();
  const isFaculty = session.role === "faculty" || session.role === "hod";
  const name = session.name || (isFaculty ? "Professor" : "Student");
  const dept = session.department || "Engineering";

  // 1. Greetings & Identity
  if (/^(ha?i|hello|hey|howdy|good\s*(morning|afternoon|evening)|hi\b)/i.test(m) || m === "hi" || m === "hai") {
    if (isFaculty) {
      return inst(
        `Hello **${name}**! 👋 Welcome to the **Anna Institute of Technology Campus Assistant**.\n\nAs a faculty member in **${dept}**, I can assist you with:\n- 📝 **Leave & OD**: Applying for Casual Leave (CL), On-Duty (OD) permissions, or exam duty leave.\n- 📊 **Academic Evaluation**: Internal assessment (IA) deadlines, question paper vetting, and COE submissions.\n- 🏛️ **Campus Facilities**: Booking the APJ Abdul Kalam Auditorium, seminar halls, or departmental labs.\n- 🔬 **Research & Grants**: Seed funding applications (up to ₹2,00,000) and Scopus journal incentives.\n- 📍 **Directory & Amenities**: Faculty cafeteria, staff bus routes, IT support, and health centre.\n\nWhat would you like to check today?`,
        ["Faculty Handbook & Service Regulations 2026, §1.1"]
      );
    }
    return inst(
      `Hello **${name}**! 👋 Welcome to the **Anna Institute of Technology Campus Assistant**.\n\nI'm your official guide to campus rules, facilities, and procedures:\n- 🎓 **Exams & Attendance**: Minimum 75% attendance rule, condonation policy, and end-sem hall tickets.\n- 💼 **Career & Placement**: Training & Placement Cell location, eligibility, and upcoming drives.\n- 📚 **Library & Labs**: Central Library operating hours, IEEE Xplore digital access, and lab safety.\n- 🏢 **Hostels & Transport**: Hostel curfew timings, mess details, college bus routes, and parking.\n- 🏆 **Sports & Activities**: Trials, gym hours, student clubs, and scholarships.\n\nHow can I help you today?`,
      ["Student Academic Regulations & Campus Life 2026, §1.1"]
    );
  }

  // 2. Faculty Leave & On-Duty (OD) Policies
  if (/leave|casual leave|\bcl\b|on duty|\bod\b|on-duty|duty leave|maternity|paternity|vacation/.test(m)) {
    if (isFaculty) {
      return inst(
        `### Faculty Leave & On-Duty (OD) Regulations\n\nFaculty members at **Anna Institute of Technology** are entitled to the following leave benefits per calendar year:\n\n1. **Casual Leave (CL)**: **12 days per year** (maximum 3 consecutive days at a time). Prior sanction from the HOD is mandatory.\n2. **On-Duty (OD) Leave**: Up to **15 days per year** granted for:\n   - Anna University / TNTU Central Valuation & Examination Duties.\n   - Presenting papers at Scopus/IEEE indexed conferences.\n   - Attending AICTE/FDP workshops or acting as Ph.D. external examiner.\n   - *Procedure*: Submit your OD application on the Faculty ERP portal at least **3 working days in advance** with the official invitation/duty order attached, endorsed by HOD, and sanctioned by the Principal.\n3. **Medical Leave**: **10 days per year** upon submitting a medical fitness certificate from a registered practitioner.\n4. **Maternity Leave**: **26 weeks** for eligible female faculty as per statutory norms.\n\n*Leave Approving Authority:* HOD (up to 2 days CL) / Principal (OD, Vacation & Extended Leave).`,
        ["Faculty Handbook 2026, §4.1–4.3", "Service Rules Circular 14/2026"]
      );
    }
    return inst(
      `### Student Leave & Medical Absence Policy\n\n- **General Absence**: Students must submit a leave letter countersigned by parents/guardians to their Class Advisor.\n- **Medical Leave**: For illness exceeding 3 consecutive days, submit a medical certificate along with prescriptions to the HOD within **5 days of return**.\n- **On-Duty (OD)**: Up to **10 days per semester** for representing the college in authorized sports, paper presentations, symposiums, or hackathons with prior HOD approval.\n- *Note*: Even with OD/Medical leave, a student must maintain at least **65% actual attendance** to qualify for medical condonation for university exams.`,
      ["Student Academic Regulations 2021, §9.3"]
    );
  }

  // 3. Faculty Academic Workload, Teaching Hours & Course Files
  if (/workload|teaching hours|course file|mentee|mentoring|credits per week/.test(m)) {
    return inst(
      `### Academic Workload & Course File Guidelines\n\nAs mandated by AICTE and university norms for **${dept}**:\n\n- **Weekly Direct Teaching Workload**:\n  - *Assistant Professors*: **16 hours / week**\n  - *Associate Professors*: **14 hours / week**\n  - *Professors*: **12 hours / week**\n- **Mentoring Allocation**: Each faculty member is assigned **20 student mentees**. Monthly counselling sessions must be recorded in the Student Mentoring Logbook on the ERP.\n- **Course File Requirements**: Faculty must maintain an updated digital course file containing:\n  1. Approved Syllabus & 45-hour Session Plan\n  2. Course Outcome (CO) to Program Outcome (PO) mapping matrix\n  3. Question bank with Bloom's taxonomy levels\n  4. Two sets of IA answer keys with marking rubrics\n  5. Remedial class logs for slow learners.`,
      ["Faculty Handbook 2026, §2.2–2.4", "IQAC Quality Manual 2026"]
    );
  }

  // 4. Internal Assessment (IA) & COE Question Papers
  if (/internal assessment|\bia\b|marks entry|question paper|controller of examination|\bcoe\b|bloom|revaluation/.test(m)) {
    if (isFaculty) {
      return inst(
        `### Internal Assessment (IA) & Question Paper Protocols\n\n- **Question Paper Submission**: Submit **two sets** of IA question papers typed in the standard college template to the Department Exam Coordinator at least **7 working days before** the test. Every question must cite the target Course Outcome (CO) and Bloom's taxonomy level (L1–L6).\n- **Marks Entry Timeline**: All IA-1 and IA-2 marks and attendance must be finalized and entered into the Faculty ERP within **5 working days** of the examination date.\n- **Audit & Grievance**: The Department Academic Audit Committee (DAAC) inspects 10% sample answer scripts. Students may review their evaluated scripts within 3 days of marks announcement.\n- **COE Office**: Room B-101, Block B (First Floor) · Contact: coe@annatech.ac.in.`,
        ["Examination Manual 2026, §3.1–3.4", "Circular 38/2026 — IA Protocols"]
      );
    }
    return inst(
      `### Internal Assessment (IA) & Evaluation Split\n\nInternal Assessment carries **40 marks** of your total subject grade:\n- **Two IA Tests**: 20 marks (best of two tests scaled to 20)\n- **Assignments & Mini-Projects**: 10 marks\n- **Attendance & Classroom Participation**: 10 marks\n\nEnd-semester university exams carry **60 marks** (converted from 100 marks).\n\n*Missed IA Policy:* If you missed an IA test on verified medical grounds or official OD, you may apply for a retest within **7 days** with HOD approval.`,
      ["Regulations 2021, §11", "Internal Assessment Rules (CSE), §2–3"]
    );
  }

  // 5. Attendance & Condonation Rules
  if (/attendance|75%|condonation|shortage|detained|detention/.test(m)) {
    return inst(
      `### Attendance Criteria & Condonation Guidelines\n\n- **Mandatory Attendance**: Every student must secure a minimum of **75% attendance** in each subject to be eligible to appear for the end-semester examinations.\n- **Medical Condonation (65% – 74%)**:\n  - Condonation up to 10% may be sanctioned by the **Principal** exclusively on genuine medical grounds (hospitalisation/surgery) or authorized participation in national/state events.\n  - A medical condonation fee is applicable.\n  - Applications must be submitted through the HOD to the Principal's Office at least **10 days prior** to exams.\n- **Below 65% Attendance**: Strictly **NOT eligible** for condonation. The candidate is detained in that semester and must re-register the course in subsequent academic years.`,
      ["Academic Regulations 2021, §9.1–9.4", "Dean of Academic Affairs Circular 2026"]
    );
  }

  // 6. Research Grants, Seed Funding & Incentives
  if (/seed grant|research|scopus|sci|incentive|patent|funding|grant|dean research|publication/.test(m)) {
    return inst(
      `### Faculty Seed Grants & Research Incentives\n\nAnna Institute of Technology actively supports faculty research through the **Dean of Research & Development** (Block C, Room C-205):\n\n1. **Internal Seed Grants**: Competitive funding of up to **₹2,00,000 per project** for interdisciplinary research, AI/IoT prototypes, and green technology applications. Calls for proposals open in June and December.\n2. **Publication Incentives**:\n   - **₹15,000** for original articles published in SCI / Scopus **Q1** journals.\n   - **₹10,000** for publications in Scopus **Q2** journals.\n   - **₹5,000** for IEEE/Springer international conference proceedings.\n3. **Patent Support**: The college IP Cell finances 100% of filing and examination fees for provisional and full Indian patents naming the institution as applicant.\n4. **Contact**: Dean (R&D) · Email: research@annatech.ac.in · Phone: Ext 205.`,
      ["Research & Innovation Policy 2026, §5.1–5.4", "IPR Guidelines 2026"]
    );
  }

  // 7. Auditorium & Seminar Hall Bookings
  if (/auditorium|seminar hall|kalam auditorium|book hall|hall booking|venue/.test(m)) {
    return inst(
      `### Seminar Hall & Auditorium Booking Procedure\n\n- **Venues Available**:\n  1. **Dr. APJ Abdul Kalam Auditorium**: 1,200 seats (Main Admin Quad) — for conferences, symposiums, and graduation day.\n  2. **Sir C.V. Raman Seminar Hall**: 250 seats (Block B, 3rd Floor) — equipped with dual projectors and surround audio.\n  3. **Department Mini Seminar Halls**: 120 seats each in Blocks A, C, and D.\n- **Booking Procedure**:\n  1. Check real-time date availability on the **Campus Facilities Portal**.\n  2. Submit the booking requisition with event brief, chief guest details, and HOD endorsement to the **Estate Officer** (Room A-104) at least **5 working days in advance**.\n  3. Sound & AV technician support is arranged automatically upon sanction.`,
      ["Campus Facility Management Guide 2026, §3.2"]
    );
  }

  // 8. Laboratory Equipment & Maintenance
  if (/lab|laboratory|equipment|maintenance|breakage|instruments|repair/.test(m)) {
    return inst(
      `### Laboratory Maintenance & Safety Protocols\n\n- **Service & Repair Requests**: For malfunctioning lab hardware, oscilloscopes, GPU workstations, or server maintenance, log a service ticket on the **Estate & Lab Portal** or contact the Lab Superintendent.\n- **Emergency Repairs**: Contact the Campus Maintenance Desk at **Ext 204**.\n- **Annual Maintenance Contracts (AMC)**: Major lab equipment (Universal Testing Machines, 3D Printers, High Performance Computing Clusters) is covered under institutional AMC through the Purchase Office (Room A-106).\n- **Safety Protocol**: All labs are equipped with Class C/CO2 fire extinguishers, first-aid kits, and emergency power shutoff switches.`,
      ["Laboratory Safety & Operations Manual 2026, §2.1"]
    );
  }

  // 9. Central Library & Digital Resources (IEEE / RemoteXs)
  if (/library|books?|ieee|sciencedirect|digital library|remotexs|delnet|borrow/.test(m)) {
    return inst(
      `### Central Library & Digital Access\n\n- **Location**: Block B, 2nd and 3rd Floors.\n- **Working Hours**:\n  - *Monday – Friday*: **8:00 AM – 8:00 PM**\n  - *Saturdays*: **9:00 AM – 1:00 PM**\n  - *Exam Periods*: Extended till **10:00 PM**.\n- **Borrowing Entitlements**:\n  - *Faculty*: Up to **10 books** for the full semester.\n  - *UG Students*: Up to **4 books** for 14 days (renewable once online).\n  - *PG / Ph.D. Scholars*: Up to **6 books** for 30 days.\n- **Off-Campus Digital Access**: Access IEEE Xplore, ScienceDirect, ACM Digital Library, and SpringerNature off-campus via the **RemoteXs Portal** using your institutional \`@annatech.ac.in\` login.\n- **Librarian Contact**: Chief Librarian, Room B-202 · library@annatech.ac.in.`,
      ["Library Handbook & E-Resources Directory 2026, §2.1–2.4"]
    );
  }

  // 10. Cafeteria, Dining & Staff Lounge
  if (/cafeteria|canteen|food|nescafe|lunch|dining|staff lounge|faculty lounge/.test(m)) {
    return inst(
      `### Campus Dining & Lounge Locations\n\n- **Faculty Lounge & Dining Room**: Block C, First Floor (adjoining Central Quad) — air-conditioned with tea/coffee vending and quiet dining, open **8:30 AM – 5:30 PM**.\n- **Main Food Court**: Ground Floor, Block C — offers North & South Indian meals, thalis, and daily specials, open **7:30 AM – 7:30 PM**.\n- **Central Canteen & Juice Bar**: North Lawn pavilion, open **8:00 AM – 8:30 PM**.\n- **Nescafe Kiosk**: Located adjacent to the Central Library portico, open **8:00 AM – 6:30 PM**.\n- *Hygiene*: All food outlets are FSSAI certified and subject to fortnightly health inspections by the Campus Medical Officer.`,
      ["Campus Services Directory 2026, §4.1"]
    );
  }

  // 11. Campus Health Centre & 24/7 Ambulance
  if (/health|doctor|medical|ambulance|emergency|hospital|first aid|rmo|clinic/.test(m)) {
    return inst(
      `### Campus Health Centre & Emergency Support\n\n- **Location**: Block A, Ground Floor, **Room A-005**.\n- **Resident Medical Officer (RMO)**: On duty **9:00 AM – 6:00 PM** for consultations, outpatient care, and first-aid.\n- **24/7 Nursing Staff**: Emergency nursing and observation beds available round the clock.\n- **Emergency Helpline & Ambulance**:\n  - *Internal Intercom*: **Ext 108**\n  - *Direct Helpline*: **+91-44-2235-0108**\n  - Dedicated emergency ambulance stationed at North Gate for hospital transfers (partnered with Apollo & MIOT Hospitals).`,
      ["Campus Health & Emergency Directory 2026, §1.1"]
    );
  }

  // 12. Hostels & Residential Rules
  if (/hostel|warden|curfew|in-time|mess fee|room allotment|hostel fee/.test(m)) {
    return inst(
      `### Hostel Facilities & Residential Code\n\n- **Hostel Blocks**:\n  - *Men's Hostels*: Blocks H1 (Kaveri), H2 (Amaravathi), and H3 (Vaigai).\n  - *Women's Hostels*: Blocks H4 (Bhavani), H5 (Noyyal), and H6 (Thamirabarani).\n- **Curfew & In-Time**:\n  - *Weekdays*: **8:30 PM**\n  - *Weekends / Holidays*: **9:00 PM**\n  - Biometric punch is mandatory at hostel entry gates.\n- **Out-Pass Procedure**: Digital out-pass must be raised on the Hostel Portal and approved by the Parent and Resident Warden at least **24 hours before** departure.\n- **Chief Warden Office**: Block H1, Ground Floor · warden@annatech.ac.in · Phone: Ext 115.`,
      ["Hostel Code & Welfare Manual 2026, §1.2–1.5"]
    );
  }

  // 13. Training & Placement Office
  if (/placement|interview|tier 1|salary|recruiter|tpo|job drive|campus interview/.test(m)) {
    return inst(
      `### Training & Placement Office (TPO)\n\n- **Location**: **Block A, Ground Floor, Room A-012**.\n- **Operating Hours**: Monday – Friday, **9:30 AM – 5:00 PM**.\n- **Eligibility Criteria**:\n  - *Tier-1 Companies (₹10+ LPA)*: Minimum CGPA 7.5 with 0 standing arrears.\n  - *Core & IT Services*: Minimum CGPA 6.0 with at most 1 active arrear (subject to company terms).\n- **Placement Policy**: One student, one job offer policy applies for standard tier; students securing an offer below ₹6 LPA may participate in dream slot (₹9+ LPA) drives.\n- **Contact**: Training & Placement Officer · placement@annatech.ac.in · Phone: +91-44-2235-0112.`,
      ["Training & Placement Handbook 2026, §4.2", "Placement Policy Circular 2026"]
    );
  }

  // 14. Transportation, Staff Bus & Parking
  if (/bus|transport|parking|vehicle pass|staff bus|route/.test(m)) {
    return inst(
      `### Campus Transportation & Parking Guidelines\n\n- **College Buses**: **32 fleet buses** operate across Chennai, Tambaram, Avadi, Poonamallee, and Chengalpattu.\n  - *Morning Arrival*: 8:25 AM at the Bus Bay.\n  - *Evening Departure*: First shift departs at 4:30 PM; second shift (special classes/sports) departs at 5:30 PM.\n- **Staff Bus & Free Transport**: Complimentary reserved seating for all teaching and non-teaching staff on Routes 1 through 8.\n- **Parking Zones**:\n  - *Zone P-1 (North Gate)*: Student two-wheeler parking (annual parking sticker required).\n  - *Zone P-2 (Admin Quad)*: Reserved faculty and staff four-wheeler and two-wheeler parking.\n- **Transport Office**: Admin Block A, Counter 3 · transport@annatech.ac.in.`,
      ["Campus Facility Management Guide 2026, §7.1"]
    );
  }

  // 15. IT Helpdesk, Wi-Fi & Password Reset
  if (/wifi|wi-fi|internet|password|ssid|it support|helpdesk|eduroam|ldap/.test(m)) {
    return inst(
      `### Campus Wi-Fi & IT Services\n\n- **Office Location**: IT Services, Block A, Second Floor, **Room A-208**.\n- **Wi-Fi SSIDs**:\n  - \`AIT-Faculty-Secure\`: 1 Gbps high-priority bandwidth for faculty workstations and laptops.\n  - \`AIT-Campus-5G\`: High-speed student access across academic blocks, library, and hostels.\n  - \`eduroam\`: Global academic roaming for visiting scholars and university researchers.\n- **Login Credentials**: Sign in using your institutional email handle and LDAP password.\n- **Password Reset**: Self-service reset at \`https://portal.annatech.ac.in/reset\` or visit Room A-208 with your ID card.\n- **Support Contact**: ithelpdesk@annatech.ac.in · Intercom: Ext 208.`,
      ["IT Infrastructure & Wi-Fi Policy 2026, §2.1–2.3"]
    );
  }

  // 16. Scholarships & Financial Aid
  if (/scholarship|nsp|first graduate|post-matric|pragati|fee concession|financial aid/.test(m)) {
    return inst(
      `### Scholarships & Financial Aid Cell\n\n- **Office Location**: Admin Block A, First Floor, **Room A-102**.\n- **Major Scholarships Processed**:\n  1. **National Scholarship Portal (NSP)**: Merit-cum-Means, Central Sector schemes.\n  2. **Tamil Nadu Government Post-Matric Scholarship**: For SC/ST/SCC/SCA candidates.\n  3. **First Graduate Tuition Fee Waiver**: As per government counselling allotment.\n  4. **AICTE Pragati & Saksham Schemes**: For girl students and differently-abled technical students.\n- **Deadlines & Verification**: Document verification counters are open **10:00 AM – 3:30 PM** on working days.\n- **Contact**: scholarship@annatech.ac.in · Counter In-Charge: Ext 102.`,
      ["Scholarship Welfare Handbook 2026, §3.1"]
    );
  }

  // 17. Sports, Gym & Extra-Curricular
  if (/sport|cricket|football|gym|indoor stadium|trials|athletics|badminton|physical director/.test(m)) {
    return inst(
      `### Sports Complex & Gymnasium Facilities\n\n- **Location**: Block D, Ground Floor (Adjacent to Sports Pavilion).\n- **Facilities**:\n  - Floodlit cricket ground, FIFA-standard football turf, synthetic basketball court, 4 indoor wooden badminton courts, and table tennis arena.\n  - **Gymnasium**: Modern strength-training and cardio gym.\n- **Operating Hours**:\n  - *Morning Session*: **6:00 AM – 8:30 AM**\n  - *Evening Session*: **4:30 PM – 7:30 PM**\n- **Trials & Registrations**: College team trials for Anna University Zone tournaments are held in August/September. Register at the Physical Director's Office in Block D.\n- **Contact**: Director of Physical Education · sports@annatech.ac.in.`,
      ["Sports Calendar & Operations 2026–27, §1.1"]
    );
  }

  // 18. Anti-Ragging Helpline & Grievance Cell
  if (/ragging|anti-ragging|grievance|complaint|harassment|discipline|committee/.test(m)) {
    return inst(
      `### Zero-Tolerance Anti-Ragging & Grievance Committee\n\nAnna Institute of Technology enforces a **strict zero-tolerance policy** towards any form of ragging or harassment.\n\n- **National 24/7 Anti-Ragging Toll-Free Helpline**: **1800-180-5522**\n- **College Anti-Ragging Squad Hotline**: **+91-94440-12345** (Direct to Principal)\n- **Internal Complaints Committee (ICC)**: Presiding Officer, Block A, Room A-103 (icc@annatech.ac.in).\n- **Student Grievance Redressal Committee (SGRC)**: Headed by Dean of Student Affairs (Block A, Room A-101).\n- *Confidentiality*: All grievances can be logged anonymously via the online portal or placed in the grievance boxes outside Block A and the Central Library.`,
      ["Anti-Ragging Regulations & Redressal Protocol 2026, §1.1–1.4"]
    );
  }

  // 19. Administrative Directory & Key Offices
  if (/principal|registrar|dean|administrative office|office hours|working hours|campus directory/.test(m)) {
    return inst(
      `### Key Administrative Offices Directory\n\n- **Principal's Office**: Admin Block A, 1st Floor, **Room A-100** (Visiting hours: 3:00 PM – 5:00 PM) · principal@annatech.ac.in\n- **Registrar's Office**: Admin Block A, Ground Floor, **Room A-008** (General administration, service records, certificates)\n- **Controller of Examinations (COE)**: Block B, 1st Floor, **Room B-101** · coe@annatech.ac.in\n- **Dean of Academic Affairs**: Admin Block A, 1st Floor, **Room A-105** · academics@annatech.ac.in\n- **Dean of Student Affairs**: Admin Block A, 1st Floor, **Room A-101**\n- **Dean of Research & Innovation**: Block C, 2nd Floor, **Room C-205**\n- **Campus Working Hours**:\n  - *Academic Classes*: 8:45 AM – 4:15 PM (Mon – Fri)\n  - *Administrative Offices*: 9:00 AM – 5:00 PM (Mon – Fri, and 1st/3rd Saturdays).`,
      ["Anna Institute of Technology Administrative Directory 2026, §1"]
    );
  }

  // 20. General Knowledge Base Fallback
  return gen(
    `I am the **Campus Assistant** for **${collegeName}**.\n\nWhile I could not match a specific regulation for your exact query, here are the official administrative helpdesks:\n\n- **Academic & Faculty Affairs**: Dean of Academic Affairs (Admin Block A, Room A-105)\n- **Examinations, Marksheets & Hall Tickets**: Controller of Examinations (Block B, Room B-101)\n- **Certificates, Transcripts & Admissions**: Registrar's Office (Admin Block A, Room A-008)\n- **IT, Wi-Fi & ERP Access**: IT Services (Block A, Room A-208 · support@annatech.ac.in)\n- **Campus Facilities & Maintenance**: Estate Office (Block A, Room A-104)\n\n*Tip:* You can ask me about **faculty leave rules**, **OD procedures**, **exam regulations**, **hostel timings**, **library access**, or **transport routes**.`
  );
}

/** Dynamic Chat Handler for Campus Assistant (agent: "knowledge") */
export async function campusAssistantChat(session: SessionPayload, body: ChatBodyInput): Promise<MockResult> {
  const message = cleanText(body.message, 2000);
  if (!message) return ok(gen("Please enter your question."));

  if (looksLikeInjection(message)) {
    return ok({
      agent: "knowledge",
      message: "I cannot alter my instructions or reveal internal system configurations. I am here to help you navigate campus life, administrative workflows, and institutional policies. What would you like to know?",
      sources: [],
      confidence: 1,
    });
  }

  // Resolve active college details
  let collegeName = "Anna Institute of Technology";
  try {
    if (session.college && session.college !== "all") {
      const col = await getCollege(session.college);
      if (typeof col?.name === "string") collegeName = col.name;
    }
  } catch {
    // fallback to Anna Institute of Technology
  }

  // 1. Check Institutional Knowledge Base (RAG Search)
  try {
    const answer = await answerQuestion(session, message, { ai: geminiEnabled() });
    if (answer.grounded && answer.citations.length > 0 && answer.mode !== "none") {
      const citedSources = answer.citations
        .filter((c) => c.cited)
        .map((c) => ({
          title: `${c.docTitle} · ${c.section}`,
          kind: "institution" as const,
        }));

      return ok({
        agent: "knowledge",
        message: answer.answer,
        sources: citedSources.length > 0 ? citedSources : [{ title: "Institutional Knowledge Base", kind: "institution" as const }],
        confidence: answer.grounded ? 0.95 : 0.85,
      });
    }
  } catch {
    // knowledge store fallback
  }

  // 2. If Gemini is enabled, construct role-aware prompt and ask Gemini
  if (geminiEnabled()) {
    try {
      const isFaculty = session.role === "faculty" || session.role === "hod";
      const historyContext = (body.history ?? [])
        .map((h) => `${h.from === "user" ? (isFaculty ? "Faculty" : "Student") : "Assistant"}: ${cleanText(h.text, 800)}`)
        .join("\n");

      const prompt = [
        `<user_context>`,
        `User Name: ${session.name}`,
        `Role: ${session.role} (${isFaculty ? "Teaching Faculty" : "Student"})`,
        `Department: ${session.department ?? "Engineering"}`,
        `Institution: ${collegeName}`,
        `</user_context>`,
        historyContext ? `<conversation_history>\n${historyContext}\n</conversation_history>` : "",
        `<user_question>\n${message}\n</user_question>`,
        "Provide a direct, practical, and authoritative answer for the user.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await geminiJson(Out, {
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0.3,
        maxOutputTokens: 1500,
        timeoutMs: 25_000,
      });

      if (res.ok && res.data.message) {
        return ok({
          agent: "knowledge",
          message: res.data.message,
          sources: (res.data.sources && res.data.sources.length > 0)
            ? res.data.sources.map((s) => ({ title: s, kind: "institution" as const }))
            : [{ title: `${collegeName} Official Guidelines`, kind: "institution" as const }],
          confidence: res.data.confidence ?? 0.92,
        });
      }
    } catch {
      // proceed to rich deterministic fallback
    }
  }

  // 3. Robust Dynamic Fallback Engine
  return ok(dynamicCampusFallback(session, message, collegeName));
}
