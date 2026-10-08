import { z } from "zod";
import type { Permission } from "@/lib/auth/roles";
import { TOGGLEABLE_GROUPS } from "./tenancy";
import { ALL_DEPARTMENTS, ALL_DESIGNATIONS, ALL_PROGRAMS, ALL_TERMS, COLLEGE_TYPES, STREAM_DEFS, streamOptions, type Stream } from "./streams";

/*
 * CRUD resource definitions. One definition drives: the list table, the add/edit form,
 * the detail page, client-side validation AND server-side validation (same Zod schema),
 * so the browser and the API can never disagree about what is valid.
 */

export type FieldType = "text" | "email" | "tel" | "number" | "date" | "time" | "select" | "textarea" | "toggle" | "checklist" | "image";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: { regex: string; message: string };
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean | string[];
  /** Full-width in the form grid. */
  wide?: boolean;
  /** Shown as a table column (with the given display kind). */
  column?: "text" | "badge" | "number" | "masked";
  /** Masked on list/detail views (contact details). */
  sensitive?: boolean;
  /** Minimum/maximum ISO dates for date fields. */
  minDate?: string;
  maxDate?: string;
  /** Options depend on the college's academic stream (engineering / medical / arts & science …). */
  streamOptions?: "department" | "program" | "semester" | "designation";
  /** Label and maximum come from the stream's entrance exam (e.g. NEET out of 720). */
  entranceScore?: boolean;
  /** Dynamic entity lookup for options (e.g. "faculty"). */
  lookup?: "faculty";
}

export interface ResourceDef {
  key: string;
  title: string;
  singular: string;
  idPrefix: string;
  managePermission: Permission;
  titleField: string;
  subtitleFields: string[];
  statusField?: string;
  /** Ordered lifecycle shown as a timeline on the detail page. */
  statusFlow?: readonly string[];
  sections: readonly string[];
  fields: FieldDef[];
  /** Deleting requires typing the record ID (for high-impact records). */
  strongDeleteConfirm?: boolean;
  deleteWarning?: string;
  /** Records belong to a college and are isolated per college (multi-college tenancy). */
  scoped?: boolean;
  /** Read-only figures the server computes from other data (shown in the list, never edited). */
  stats?: ReadonlyArray<{ name: string; label: string; kind: "number" | "progress" }>;
}

export type RecordValue = string | number | boolean | string[] | null;
export type ResourceRecord = { id: string; createdAt: string; updatedAt: string; version: number; collegeId?: string | null } & Record<string, RecordValue>;

export const DEPARTMENT_OPTIONS = ALL_DEPARTMENTS;
export const PROGRAMS = ALL_PROGRAMS;

const STATES = ["Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana", "Puducherry", "Maharashtra", "Other"] as const;
const MOBILE = { regex: "^[6-9][0-9]{9}$", message: "Enter a 10-digit Indian mobile number" };

export const ADMISSION_FLOW = ["Enquiry", "Applied", "Documents verified", "Shortlisted", "Offer sent", "Fee paid", "Enrolled"] as const;
export const ADMISSION_STATUSES = [...ADMISSION_FLOW, "Rejected", "Withdrawn"] as const;

export const USER_ROLE_OPTIONS = [
  "Student",
  "Faculty",
  "HOD",
  "Placement Officer",
  "Incubation Head",
  "Principal / Institution Admin",
  "Recruiter",
  "University Super Admin",
] as const;

export { COLLEGE_TYPES };

export const RESOURCES: Record<string, ResourceDef> = {
  colleges: {
    key: "colleges",
    title: "Colleges",
    singular: "College",
    idPrefix: "COL-",
    managePermission: "colleges:manage",
    titleField: "name",
    subtitleFields: ["type", "city"],
    statusField: "status",
    sections: ["College profile", "Leadership & contact", "Subscription & modules"],
    strongDeleteConfirm: true,
    deleteWarning: "A college can only be deleted when it has no records. Suspend it instead to block access immediately while keeping its data.",
    fields: [
      { name: "name", label: "College name", type: "text", section: "College profile", required: true, maxLength: 100, placeholder: "e.g. Apex Institute of Science & Technology", column: "text", wide: true },
      { name: "code", label: "University affiliation code", type: "text", section: "College profile", required: true, maxLength: 8, pattern: { regex: "^[0-9]{4}$", message: "Use the 4-digit affiliation code" }, placeholder: "e.g. 1015", column: "text" },
      { name: "type", label: "College type", type: "select", section: "College profile", required: true, options: COLLEGE_TYPES, column: "badge" },
      { name: "city", label: "City", type: "text", section: "College profile", required: true, maxLength: 60, placeholder: "e.g. Chennai", column: "text" },
      { name: "established", label: "Year established", type: "number", section: "College profile", min: 1850, max: 2030, placeholder: "e.g. 2008" },
      { name: "studentCapacity", label: "Sanctioned student intake", type: "number", section: "College profile", required: true, min: 60, max: 50000, placeholder: "e.g. 1200", column: "number" },
      { name: "principal", label: "Principal", type: "text", section: "Leadership & contact", required: true, maxLength: 80, placeholder: "e.g. Dr. K. Saravanan" },
      { name: "email", label: "Official email", type: "email", section: "Leadership & contact", required: true, placeholder: "e.g. principal@aist.edu.in", sensitive: true },
      { name: "phone", label: "Office phone", type: "tel", section: "Leadership & contact", required: true, pattern: { regex: "^[6-9][0-9]{9}$", message: "Enter a 10-digit number" }, placeholder: "e.g. 9876543210", sensitive: true },
      { name: "plan", label: "Plan", type: "select", section: "Subscription & modules", required: true, options: ["Campus Starter", "Campus Pro", "University Enterprise"], defaultValue: "Campus Pro", column: "badge" },
      { name: "status", label: "Status", type: "select", section: "Subscription & modules", required: true, options: ["Active", "Onboarding", "Suspended"], defaultValue: "Onboarding", column: "badge", help: "Suspended colleges are signed out immediately and cannot sign in." },
      {
        name: "modules",
        label: "Enabled module areas",
        type: "checklist",
        section: "Subscription & modules",
        options: TOGGLEABLE_GROUPS,
        defaultValue: [...TOGGLEABLE_GROUPS],
        wide: true,
        help: "Core academics, assessment and administration are always on. Disabled areas disappear from menus and their APIs are blocked.",
      },
      { name: "admissionsOpen", label: "Accepting online applications", type: "toggle", section: "Subscription & modules", defaultValue: true },
    ],
  },

  admissions: {
    key: "admissions",
    scoped: true,
    title: "Student Admissions",
    singular: "Application",
    idPrefix: "ADM-26-",
    managePermission: "admissions:manage",
    titleField: "fullName",
    subtitleFields: ["program", "quota"],
    statusField: "status",
    statusFlow: ADMISSION_FLOW,
    sections: ["Applicant details", "Academic record", "Programme & quota", "Parent / guardian", "Admission status"],
    fields: [
      { name: "fullName", label: "Full name (as in 12th mark sheet)", type: "text", section: "Applicant details", required: true, maxLength: 80, placeholder: "e.g. Kumar S", column: "text" },
      { name: "dob", label: "Date of birth", type: "date", section: "Applicant details", required: true, minDate: "1990-01-01", maxDate: "2011-12-31" },
      { name: "gender", label: "Gender", type: "select", section: "Applicant details", required: true, options: ["Female", "Male", "Non-binary", "Prefer not to say"] },
      { name: "email", label: "Email", type: "email", section: "Applicant details", required: true, placeholder: "e.g. student@gmail.com", sensitive: true },
      { name: "phone", label: "Mobile number", type: "tel", section: "Applicant details", required: true, pattern: MOBILE, placeholder: "e.g. 9876543210", sensitive: true, column: "masked" },
      { name: "city", label: "City / town", type: "text", section: "Applicant details", maxLength: 60, placeholder: "e.g. Coimbatore" },
      { name: "state", label: "State", type: "select", section: "Applicant details", required: true, options: STATES, defaultValue: "Tamil Nadu" },
      { name: "board", label: "12th board", type: "select", section: "Academic record", required: true, options: ["State Board", "CBSE", "ICSE", "Other"] },
      { name: "hscPercent", label: "12th / HSC percentage", type: "number", section: "Academic record", required: true, min: 35, max: 100, placeholder: "e.g. 92.5", column: "number" },
      { name: "entranceScore", label: "Entrance / merit score", type: "number", section: "Academic record", min: 0, max: 720, placeholder: "e.g. 185.5", entranceScore: true },
      { name: "program", label: "Programme applied for", type: "select", section: "Programme & quota", required: true, options: PROGRAMS, streamOptions: "program", column: "text", wide: true },
      { name: "quota", label: "Quota", type: "select", section: "Programme & quota", required: true, options: ["Government", "Management", "NRI"] },
      { name: "category", label: "Community / category", type: "select", section: "Programme & quota", required: true, options: ["OC", "BC", "MBC", "SC", "ST", "EWS"], column: "badge" },
      { name: "scholarship", label: "Applying for scholarship", type: "toggle", section: "Programme & quota", defaultValue: false },
      { name: "hostel", label: "Hostel accommodation required", type: "toggle", section: "Programme & quota", defaultValue: false },
      { name: "guardianName", label: "Parent / guardian name", type: "text", section: "Parent / guardian", required: true, maxLength: 80, placeholder: "e.g. S. Sundar" },
      { name: "guardianPhone", label: "Parent / guardian mobile", type: "tel", section: "Parent / guardian", required: true, pattern: MOBILE, placeholder: "e.g. 9840123456", sensitive: true },
      { name: "guardianOccupation", label: "Occupation", type: "text", section: "Parent / guardian", maxLength: 60, placeholder: "e.g. Engineer" },
      { name: "status", label: "Status", type: "select", section: "Admission status", required: true, options: ADMISSION_STATUSES, defaultValue: "Enquiry", column: "badge" },
      {
        name: "documents",
        label: "Documents verified",
        type: "checklist",
        section: "Admission status",
        options: ["10th mark sheet", "12th mark sheet", "Transfer certificate", "Community certificate", "Passport photo", "Counselling allotment order"],
        defaultValue: [],
        wide: true,
      },
      { name: "notes", label: "Internal notes", type: "textarea", section: "Admission status", maxLength: 1000, wide: true, placeholder: "Visible to admission staff only...", help: "Visible to admission staff only. Do not store Aadhaar or bank numbers here." },
    ],
    deleteWarning: "Deleting an application removes it from the admission cycle. Prefer marking it Withdrawn or Rejected to keep the audit trail.",
  },

  staff: {
    key: "staff",
    scoped: true,
    title: "Staff Management",
    singular: "Staff member",
    idPrefix: "EMP-",
    managePermission: "staff:manage",
    titleField: "fullName",
    subtitleFields: ["designation", "department"],
    statusField: "status",
    sections: ["Personal details", "Employment", "Access"],
    strongDeleteConfirm: true,
    deleteWarning: "Deleting a staff record also revokes any linked platform login. Consider setting the status to Resigned instead.",
    fields: [
      { name: "fullName", label: "Full name", type: "text", section: "Personal details", required: true, maxLength: 80, placeholder: "e.g. Dr. Meenakshi S", column: "text" },
      { name: "email", label: "Official email", type: "email", section: "Personal details", required: true, placeholder: "e.g. faculty@aist.edu.in", sensitive: true },
      { name: "phone", label: "Mobile number", type: "tel", section: "Personal details", required: true, pattern: MOBILE, placeholder: "e.g. 9876543210", sensitive: true },
      { name: "qualification", label: "Highest qualification", type: "text", section: "Personal details", maxLength: 80, placeholder: "e.g. Ph.D. (Computer Science)" },
      { name: "department", label: "Department", type: "select", section: "Employment", required: true, options: DEPARTMENT_OPTIONS, streamOptions: "department", column: "text", wide: true },
      {
        name: "designation",
        label: "Designation",
        type: "select",
        section: "Employment",
        required: true,
        options: ALL_DESIGNATIONS,
        streamOptions: "designation",
        column: "text",
      },
      { name: "staffType", label: "Staff type", type: "select", section: "Employment", required: true, options: ["Teaching", "Non-teaching", "Administrative"], column: "badge" },
      { name: "employment", label: "Employment type", type: "select", section: "Employment", required: true, options: ["Permanent", "Contract", "Guest / Visiting"] },
      { name: "joiningDate", label: "Date of joining", type: "date", section: "Employment", required: true, minDate: "1970-01-01", maxDate: "2030-12-31" },
      { name: "experienceYears", label: "Experience (years)", type: "number", section: "Employment", min: 0, max: 50, placeholder: "e.g. 8" },
      { name: "status", label: "Status", type: "select", section: "Employment", required: true, options: ["Active", "On leave", "Resigned", "Retired"], defaultValue: "Active", column: "badge" },
      { name: "platformAccess", label: "Create a CollossusIQ login for this staff member", type: "toggle", section: "Access", defaultValue: true, help: "An invitation is emailed; MFA enrolment is required on first sign-in." },
      { name: "notes", label: "Notes", type: "textarea", section: "Access", maxLength: 1000, wide: true, placeholder: "Additional notes or remarks..." },
    ],
  },

  users: {
    key: "users",
    scoped: true,
    title: "User Management",
    singular: "User",
    idPrefix: "USR-",
    managePermission: "users:manage",
    titleField: "fullName",
    subtitleFields: ["role", "department"],
    statusField: "status",
    sections: ["Account", "Security"],
    strongDeleteConfirm: true,
    deleteWarning: "The user loses access immediately and all active sessions are revoked. This cannot be undone.",
    fields: [
      { name: "fullName", label: "Full name", type: "text", section: "Account", required: true, maxLength: 80, placeholder: "e.g. SARAVANAN-PRIN", column: "text" },
      { name: "email", label: "Email (sign-in ID)", type: "email", section: "Account", required: true, placeholder: "e.g. principal@aist.edu.in", column: "masked", sensitive: true },
      { name: "role", label: "Role", type: "select", section: "Account", required: true, options: USER_ROLE_OPTIONS, column: "badge", help: "Only the University Super Admin can grant the Super Admin role." },
      { name: "department", label: "Department", type: "select", section: "Account", options: DEPARTMENT_OPTIONS, streamOptions: "department", column: "text" },
      { name: "status", label: "Status", type: "select", section: "Security", required: true, options: ["Invited", "Active", "Suspended"], defaultValue: "Invited", column: "badge" },
      { name: "mfaRequired", label: "Require multi-factor authentication", type: "toggle", section: "Security", defaultValue: true },
      { name: "ssoOnly", label: "Allow sign-in through institution SSO only", type: "toggle", section: "Security", defaultValue: false },
      { name: "notes", label: "Reason / notes", type: "textarea", section: "Security", maxLength: 500, wide: true, placeholder: "Reason for account change or role grant...", help: "Recorded in the audit log with every change." },
    ],
  },

  courses: {
    key: "courses",
    scoped: true,
    title: "Course Management",
    singular: "Course",
    idPrefix: "CRS-",
    managePermission: "courses:manage",
    titleField: "title",
    subtitleFields: ["code", "department"],
    statusField: "status",
    sections: ["Course details", "Delivery"],
    fields: [
      { name: "code", label: "Course code", type: "text", section: "Course details", required: true, maxLength: 10, pattern: { regex: "^[A-Z]{2,4}[0-9]{3,4}$", message: "Use a code like CS3492 or AN101" }, placeholder: "e.g. CS3492", column: "text" },
      { name: "title", label: "Course title", type: "text", section: "Course details", required: true, maxLength: 100, placeholder: "e.g. Database Management Systems", column: "text", wide: true },
      { name: "department", label: "Department", type: "select", section: "Course details", required: true, options: DEPARTMENT_OPTIONS, streamOptions: "department", column: "text", wide: true },
      { name: "semester", label: "Semester / phase", type: "select", section: "Course details", required: true, options: ALL_TERMS, streamOptions: "semester", column: "text" },
      { name: "credits", label: "Credits", type: "number", section: "Course details", required: true, min: 1, max: 6, placeholder: "e.g. 4", column: "number" },
      { name: "courseType", label: "Type", type: "select", section: "Delivery", required: true, options: ["Theory", "Lab", "Theory + Lab", "Elective", "Project", "Clinical posting", "Practical / skills lab"] },
      { name: "faculty", label: "Course faculty", type: "text", section: "Delivery", required: true, maxLength: 80, placeholder: "e.g. MEENU-FAC / Dr. Meenakshi", column: "text", lookup: "faculty" },
      { name: "createdBy", label: "Created / Assigned by", type: "text", section: "Delivery", placeholder: "e.g. SARAVANAN-PRIN", column: "text" },
      { name: "status", label: "Status", type: "select", section: "Delivery", required: true, options: ["Draft", "Active", "Archived"], defaultValue: "Draft", column: "badge" },
      { name: "description", label: "Course outcomes / description", type: "textarea", section: "Delivery", maxLength: 1500, placeholder: "Describe course objectives, syllabus outline, and expected student learning outcomes...", wide: true },
    ],
  },

  events: {
    key: "events",
    scoped: true,
    title: "Campus Events",
    singular: "Event",
    idPrefix: "EVT-",
    managePermission: "events:manage",
    titleField: "title",
    subtitleFields: ["type", "venue"],
    statusField: "status",
    sections: ["Event details", "Registration"],
    fields: [
      { name: "title", label: "Event title", type: "text", section: "Event details", required: true, maxLength: 100, placeholder: "e.g. Annual Technical Symposium 2026", column: "text", wide: true },
      { name: "type", label: "Type", type: "select", section: "Event details", required: true, options: ["Seminar", "Workshop", "Hackathon", "Cultural", "Sports", "Alumni", "Social service"], column: "badge" },
      { name: "date", label: "Date", type: "date", section: "Event details", required: true, minDate: "2024-01-01", maxDate: "2030-12-31", column: "text" },
      { name: "startTime", label: "Start time", type: "time", section: "Event details", required: true },
      { name: "venue", label: "Venue", type: "text", section: "Event details", required: true, maxLength: 80, placeholder: "e.g. Main Auditorium / Seminar Hall A", column: "text" },
      { name: "organiser", label: "Organiser", type: "text", section: "Event details", required: true, maxLength: 80, placeholder: "e.g. Department of Computer Science & Engineering" },
      { name: "capacity", label: "Capacity", type: "number", section: "Registration", required: true, min: 1, max: 20000, placeholder: "e.g. 250", column: "number" },
      { name: "registrationOpen", label: "Registrations open", type: "toggle", section: "Registration", defaultValue: true },
      { name: "status", label: "Status", type: "select", section: "Registration", required: true, options: ["Draft", "Published", "Completed", "Cancelled"], defaultValue: "Draft", column: "badge" },
      { name: "description", label: "Description", type: "textarea", section: "Registration", maxLength: 1500, placeholder: "Event schedule, guest speakers, and participation guidelines...", wide: true },
    ],
  },
};

export const CLINICAL_DEPARTMENTS = [
  "General Medicine",
  "General Surgery",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Orthopaedics",
  "Community Medicine",
  "Emergency Medicine",
  "Psychiatry",
  "Dermatology",
  "ENT",
  "Ophthalmology",
] as const;

RESOURCES.rotations = {
  key: "rotations",
  scoped: true,
  title: "Clinical Rotations",
  singular: "Clinical posting",
  idPrefix: "ROT-",
  managePermission: "clinical:manage",
  titleField: "student",
  subtitleFields: ["department", "unit"],
  statusField: "status",
  sections: ["Posting", "Supervision & attendance"],
  fields: [
    { name: "student", label: "Student / intern", type: "text", section: "Posting", required: true, maxLength: 80, column: "text" },
    { name: "regNo", label: "University register number", type: "text", section: "Posting", required: true, maxLength: 12, pattern: { regex: "^[A-Z0-9]{6,12}$", message: "6–12 letters or digits" }, column: "masked", sensitive: true },
    { name: "phase", label: "Phase", type: "select", section: "Posting", required: true, options: ["Phase II", "Phase III Part 1", "Phase III Part 2", "Internship (CRMI)"], column: "badge" },
    { name: "department", label: "Clinical department", type: "select", section: "Posting", required: true, options: CLINICAL_DEPARTMENTS, column: "text" },
    { name: "unit", label: "Hospital unit / ward", type: "text", section: "Posting", required: true, maxLength: 60, placeholder: "e.g. Unit II · Ward 14" },
    { name: "startDate", label: "Posting starts", type: "date", section: "Posting", required: true, minDate: "2024-01-01", maxDate: "2030-12-31" },
    { name: "endDate", label: "Posting ends", type: "date", section: "Posting", required: true, minDate: "2024-01-01", maxDate: "2030-12-31" },
    { name: "supervisor", label: "Supervising faculty", type: "text", section: "Supervision & attendance", required: true, maxLength: 80, column: "text", lookup: "faculty" },
    { name: "attendance", label: "Attendance (%)", type: "number", section: "Supervision & attendance", min: 0, max: 100, column: "number", help: "Minimum 80% clinical attendance is required for eligibility." },
    { name: "competenciesSigned", label: "Logbook competencies certified", type: "number", section: "Supervision & attendance", min: 0, max: 200 },
    { name: "status", label: "Status", type: "select", section: "Supervision & attendance", required: true, options: ["Scheduled", "Ongoing", "Completed", "Extended"], defaultValue: "Scheduled", column: "badge" },
    { name: "remarks", label: "Supervisor remarks", type: "textarea", section: "Supervision & attendance", maxLength: 800, wide: true },
  ],
};

/**
 * Stream rules shared by the form and the API: a medical college cannot record a B.E. programme,
 * an engineering college cannot use a NEET score above its 200-point cut-off, and so on.
 */
export function streamRuleErrors(res: ResourceDef, data: Record<string, RecordValue>, stream: Stream): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of res.fields) {
    const v = data[f.name];
    if (f.streamOptions && typeof v === "string" && v && !streamOptions(f.streamOptions, stream).includes(v)) {
      out[f.name] = `Not offered in ${STREAM_DEFS[stream].label} colleges`;
    }
    if (f.entranceScore && typeof v === "number" && v > STREAM_DEFS[stream].entrance.max) {
      out[f.name] = `Maximum for ${STREAM_DEFS[stream].entrance.label.split(" (")[0]} is ${STREAM_DEFS[stream].entrance.max}`;
    }
  }
  if (res.key === "rotations" && typeof data.startDate === "string" && typeof data.endDate === "string" && data.endDate < data.startDate) {
    out.endDate = "Posting cannot end before it starts";
  }
  return out;
}

/** The label a field should show for a given stream (entrance exam names differ). */
export function fieldLabel(f: FieldDef, stream: Stream | null): string {
  if (f.entranceScore && stream) return STREAM_DEFS[stream].entrance.label;
  if (f.name === "semester" && stream) return STREAM_DEFS[stream].termLabel;
  return f.label;
}

export const GALLERY_CATEGORIES = ["Campus", "Academics", "Labs & Library", "Hospital & Clinical", "Sports", "Cultural", "Events", "Convocation"] as const;

RESOURCES.gallery = {
  key: "gallery",
  scoped: true,
  title: "Gallery",
  singular: "Photo",
  idPrefix: "GAL-",
  managePermission: "website:manage",
  titleField: "title",
  subtitleFields: ["category"],
  statusField: "status",
  sections: ["Photo"],
  fields: [
    { name: "image", label: "Image", type: "image", section: "Photo", required: true, wide: true, column: "text" },
    { name: "title", label: "Title", type: "text", section: "Photo", required: true, maxLength: 80, column: "text" },
    { name: "category", label: "Category", type: "select", section: "Photo", required: true, options: GALLERY_CATEGORIES, column: "badge" },
    { name: "caption", label: "Caption", type: "textarea", section: "Photo", maxLength: 300, wide: true },
    { name: "featured", label: "Feature on the college home page", type: "toggle", section: "Photo", defaultValue: false },
    { name: "status", label: "Status", type: "select", section: "Photo", required: true, options: ["Published", "Draft"], defaultValue: "Draft", column: "badge", help: "Only published photos appear on the public college website." },
  ],
};

RESOURCES.departments = {
  key: "departments",
  scoped: true,
  title: "Departments",
  singular: "Department",
  idPrefix: "DEP-",
  managePermission: "department:manage",
  titleField: "department",
  subtitleFields: ["head"],
  statusField: "status",
  sections: ["Department", "Contact"],
  fields: [
    { name: "department", label: "Department", type: "select", section: "Department", required: true, options: DEPARTMENT_OPTIONS, streamOptions: "department", column: "text", wide: true, help: "Departments of your college's academic stream." },
    { name: "head", label: "Head of department", type: "text", section: "Department", maxLength: 80, placeholder: "e.g. Dr. S. Venkatesh", column: "text" },
    { name: "established", label: "Year established", type: "number", section: "Department", min: 1850, max: 2030 },
    { name: "status", label: "Status", type: "select", section: "Department", required: true, options: ["Active", "Inactive"], defaultValue: "Active", column: "badge" },
    { name: "email", label: "Department email", type: "email", section: "Contact", sensitive: true },
    { name: "phone", label: "Office phone", type: "tel", section: "Contact", pattern: MOBILE, sensitive: true },
    { name: "notes", label: "Notes", type: "textarea", section: "Contact", maxLength: 600, wide: true },
  ],
  stats: [
    { name: "programmes", label: "Programmes", kind: "number" },
    { name: "students", label: "Students", kind: "number" },
    { name: "faculty", label: "Faculty", kind: "number" },
    { name: "readiness", label: "Placement readiness", kind: "progress" },
  ],
  deleteWarning: "Removing a department does not delete its staff or students. Set it to Inactive to keep it on record.",
};

export const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"] as const;
export const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"] as const;
export const COURSE_OUTCOMES = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"] as const;
export const QUESTION_STATUSES = ["Active", "Draft", "Archived"] as const;

RESOURCES.questions = {
  key: "questions",
  scoped: true,
  title: "Question Bank",
  singular: "Question",
  idPrefix: "Q-",
  managePermission: "assessment:create",
  titleField: "question",
  subtitleFields: ["topic", "co"],
  statusField: "status",
  sections: ["Question details", "Classification", "Model answer & notes"],
  fields: [
    { name: "question", label: "Question", type: "textarea", section: "Question details", required: true, maxLength: 2000, placeholder: "Enter question statement or problem description...", wide: true, column: "text" },
    { name: "topic", label: "Topic", type: "text", section: "Classification", required: true, maxLength: 100, placeholder: "e.g. Relational Normalization & BCNF", column: "text" },
    { name: "difficulty", label: "Difficulty", type: "select", section: "Classification", required: true, options: DIFFICULTY_OPTIONS, defaultValue: "Medium", column: "badge" },
    { name: "bloom", label: "Bloom level", type: "select", section: "Classification", required: true, options: BLOOM_LEVELS, defaultValue: "Understand", column: "badge" },
    { name: "co", label: "Course outcome (CO)", type: "select", section: "Classification", required: true, options: COURSE_OUTCOMES, defaultValue: "CO1", column: "text" },
    { name: "marks", label: "Marks", type: "number", section: "Classification", required: true, min: 1, max: 50, defaultValue: 2, placeholder: "e.g. 2 or 16", column: "number" },
    { name: "status", label: "Status", type: "select", section: "Classification", required: true, options: QUESTION_STATUSES, defaultValue: "Active", column: "badge" },
    { name: "explanation", label: "Model answer / explanation", type: "textarea", section: "Model answer & notes", maxLength: 2000, placeholder: "Step-by-step model solution, derivation or grading criteria...", wide: true },
  ],
  deleteWarning: "Deleting a question permanently removes it from the department question bank.",
};

/** The public college website (one per college) — edited through the College Website module, not the CRUD list. */
export const WEBSITE: ResourceDef = {
  key: "website",
  title: "College Website",
  singular: "Website",
  idPrefix: "WEB-",
  managePermission: "website:manage",
  titleField: "tagline",
  subtitleFields: [],
  sections: ["Hero", "About", "Contact"],
  fields: [
    { name: "tagline", label: "Hero tagline", type: "text", section: "Hero", required: true, maxLength: 120, wide: true },
    { name: "heroImage", label: "Hero image", type: "image", section: "Hero", required: true, wide: true, help: "Wide images (about 1600×800) look best. PNG, JPEG or WebP up to 2 MB." },
    { name: "announcement", label: "Announcement banner", type: "text", section: "Hero", maxLength: 140, wide: true, placeholder: "e.g. Admissions 2026–27 open — apply before 30 June" },
    { name: "about", label: "About the college", type: "textarea", section: "About", required: true, maxLength: 1500, wide: true },
    { name: "principalMessage", label: "Principal's message", type: "textarea", section: "About", maxLength: 1000, wide: true },
    { name: "highlights", label: "Highlights (one per line)", type: "textarea", section: "About", maxLength: 600, wide: true, help: "Shown as badges, e.g. NAAC A+, NIRF ranked, 1,100-bed hospital." },
    { name: "address", label: "Address", type: "textarea", section: "Contact", required: true, maxLength: 300, wide: true },
    { name: "phone", label: "Enquiry phone", type: "tel", section: "Contact", required: true, pattern: { regex: "^[6-9][0-9]{9}$", message: "Enter a 10-digit number" } },
    { name: "email", label: "Enquiry email", type: "email", section: "Contact", required: true },
    { name: "officeHours", label: "Office hours", type: "text", section: "Contact", maxLength: 80 },
    { name: "showEvents", label: "Show upcoming events", type: "toggle", section: "Contact", defaultValue: true },
    { name: "showGallery", label: "Show photo gallery", type: "toggle", section: "Contact", defaultValue: true },
  ],
};

export function findResource(key: string | undefined): ResourceDef | undefined {
  return key && Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : undefined;
}

/* ── validation ─────────────────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Uploaded media ids are random; bundled illustrations live under /campus/. */
export const MEDIA_REF_RE = /^(MED-[a-f0-9]{24}|\/campus\/[a-z0-9-]{1,40}\.svg)$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  switch (f.type) {
    case "toggle":
      return z.boolean();
    case "image": {
      // Either an uploaded media id or one of the bundled campus illustrations — never an arbitrary URL.
      const img = z.string().regex(MEDIA_REF_RE, "Choose or upload an image");
      return f.required ? img : z.union([img, z.literal("")]);
    }
    case "checklist":
      return z.array(z.enum(f.options as [string, ...string[]])).max(f.options?.length ?? 0).refine((a) => new Set(a).size === a.length, "Duplicate items");
    case "number": {
      let n = z.number({ invalid_type_error: `${f.label} must be a number` }).finite();
      if (f.min !== undefined) n = n.min(f.min, `Minimum is ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `Maximum is ${f.max}`);
      return f.required ? n : n.nullable();
    }
    case "select": {
      const e = z.enum(f.options as [string, ...string[]], { errorMap: () => ({ message: `Choose a ${f.label.toLowerCase()}` }) });
      return f.required ? e : z.union([e, z.literal("")]);
    }
    default: {
      let s = z.string().trim();
      if (f.type === "email") s = s.toLowerCase().max(120).email("Enter a valid email");
      else if (f.type === "date") s = s.regex(ISO_DATE, "Enter a valid date");
      else if (f.type === "time") s = s.regex(TIME, "Enter a valid time");
      else s = s.max(f.maxLength ?? 120, `Maximum ${f.maxLength ?? 120} characters`);
      // eslint-disable-next-line security/detect-non-literal-regexp -- patterns are static config, not user input
      if (f.pattern) s = s.regex(new RegExp(f.pattern.regex), f.pattern.message);
      let out: z.ZodTypeAny = f.required ? s.min(1, `${f.label} is required`) : z.union([s, z.literal("")]);
      if (f.type === "date" && (f.minDate || f.maxDate)) {
        out = out.refine((v: string) => !v || ((!f.minDate || v >= f.minDate) && (!f.maxDate || v <= f.maxDate)), {
          message: `Date must be between ${f.minDate ?? "…"} and ${f.maxDate ?? "…"}`,
        });
      }
      return out;
    }
  }
}

/** Strict schema: unknown keys are rejected (prevents mass-assignment of id/version/createdAt, etc.). */
export function recordSchema(res: ResourceDef) {
  return z.object(Object.fromEntries(res.fields.map((f) => [f.name, fieldSchema(f)]))).strict();
}

export function emptyValues(res: ResourceDef): Record<string, RecordValue> {
  return Object.fromEntries(
    res.fields.map((f) => [
      f.name,
      f.defaultValue !== undefined ? f.defaultValue : f.type === "toggle" ? false : f.type === "checklist" ? [] : f.type === "number" ? null : "",
    ]),
  );
}
