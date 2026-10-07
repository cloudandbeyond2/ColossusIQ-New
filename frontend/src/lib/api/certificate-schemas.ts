import { z } from "zod";

/*
 * Shared by the browser and the server: certificates as printed documents. The Principal is the certifying authority:
 * only the Principal designs the college's certificate (header, seal, signature) and issues awards; faculty and HODs
 * may request them. Course and quiz certificates are issued automatically and carry the same design.
 */

export const CERT_KINDS = ["course", "quiz", "appreciation", "merit", "participation", "excellence", "internship", "workshop"] as const;
export const CertKind = z.enum(CERT_KINDS);
export type CertKind = z.infer<typeof CertKind>;
export const AWARD_KINDS = ["appreciation", "merit", "participation", "excellence", "internship", "workshop"] as const;
export const AwardKind = z.enum(AWARD_KINDS);
export type AwardKind = z.infer<typeof AwardKind>;

/** How each kind is titled and introduced on the certificate. */
export const KIND_INFO: Record<CertKind, { label: string; heading: string; subtitle: string; lead: string; example: string }> = {
  course: { label: "Course completion", heading: "Certificate", subtitle: "of Course Completion", lead: "This is to certify that", example: "" },
  quiz: { label: "Assessment achievement", heading: "Certificate", subtitle: "of Achievement", lead: "This is to certify that", example: "" },
  appreciation: { label: "Appreciation", heading: "Certificate", subtitle: "of Appreciation", lead: "This certificate is proudly presented to", example: "in recognition of the outstanding contribution as a student coordinator of the National Level Technical Symposium." },
  merit: { label: "Merit", heading: "Certificate", subtitle: "of Merit", lead: "This is to certify that", example: "has secured the First Rank in the Department of Computer Science and Engineering for the academic year 2025–26." },
  participation: { label: "Participation", heading: "Certificate", subtitle: "of Participation", lead: "This is to certify that", example: "has actively participated in the Inter-College Hackathon conducted by the Innovation and Incubation Cell." },
  excellence: { label: "Excellence", heading: "Certificate", subtitle: "of Excellence", lead: "This certificate is proudly presented to", example: "for exemplary academic excellence and leadership demonstrated throughout the academic year." },
  internship: { label: "Internship completion", heading: "Certificate", subtitle: "of Internship Completion", lead: "This is to certify that", example: "has successfully completed a four-week industrial internship in Full-Stack Web Development." },
  workshop: { label: "Workshop / training", heading: "Certificate", subtitle: "of Completion", lead: "This is to certify that", example: "has successfully completed the two-day hands-on workshop on Artificial Intelligence and Machine Learning." },
};

export const THEMES = ["classic", "royal", "emerald", "maroon"] as const;
export const Theme = z.enum(THEMES);
export type Theme = z.infer<typeof Theme>;
export const THEME_LABEL: Record<Theme, string> = { classic: "Classic navy & gold", royal: "Royal blue", emerald: "Emerald", maroon: "Heritage maroon" };

/** An uploaded image (MED-…) or empty. */
const ImageRef = z.union([z.literal(""), z.string().regex(/^MED-[a-f0-9]{24}$/, "Upload the image again")]);
const line = (max: number) => z.string().trim().max(max);

export const CertificateProfile = z.object({
  collegeName: z.string(),
  affiliation: z.string(),
  address: z.string(),
  contact: z.string(),
  accreditation: z.string(),
  motto: z.string(),
  logoRef: z.string(),
  sealRef: z.string(),
  signatureRef: z.string(),
  principalName: z.string(),
  principalDesignation: z.string(),
  theme: Theme,
  updatedBy: z.string(),
  updatedAt: z.string().nullable(),
});
export type CertificateProfile = z.infer<typeof CertificateProfile>;

export const ProfileBody = z
  .object({
    collegeName: z.string().trim().min(3, "Enter the college name").max(120),
    affiliation: line(160),
    address: z.string().trim().min(5, "Enter the address").max(200),
    contact: line(160),
    accreditation: line(120),
    motto: line(120),
    logoRef: ImageRef,
    sealRef: ImageRef,
    signatureRef: ImageRef,
    principalName: z.string().trim().min(3, "Enter the Principal's name").max(80),
    principalDesignation: z.string().trim().min(3).max(80),
    theme: Theme,
  })
  .strict();
export type ProfileBody = z.infer<typeof ProfileBody>;

/* ───────────────────────────── awards (Principal-issued certificates) ───────────────────────────── */
export const AWARD_STATUSES = ["Pending", "Issued", "Rejected", "Revoked"] as const;
export const AwardStatus = z.enum(AWARD_STATUSES);
export type AwardStatus = z.infer<typeof AwardStatus>;

const IsoDay = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-08")]);
export const AwardBody = z
  .object({
    kind: AwardKind,
    recipientName: z.string().trim().min(3, "Enter the recipient's full name").max(80),
    /** The student's account, so the certificate appears in their portal; null for external recipients. */
    recipientSub: z.string().max(80).nullable(),
    recipientDetail: line(120),
    reason: z.string().trim().min(20, "Describe what the certificate is for (at least 20 characters)").max(400),
    eventName: line(120),
    eventDate: IsoDay,
  })
  .strict();
export type AwardBody = z.infer<typeof AwardBody>;

export const AwardRow = AwardBody.extend({
  id: z.string(),
  publicId: z.string().nullable(),
  status: AwardStatus,
  requestedBy: z.string(),
  requestedRole: z.string(),
  decidedBy: z.string(),
  decisionNote: z.string(),
  issuedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AwardRow = z.infer<typeof AwardRow>;

export const DecisionBody = z.object({ note: z.string().trim().max(300).default("") }).strict();

export const DeskOverview = z.object({
  profile: CertificateProfile,
  canAuthorize: z.boolean(),
  /** Set when the viewer may review but never issue (the Super Admin's oversight view). */
  reviewOnly: z.string().nullable().default(null),
  awards: z.array(AwardRow),
  students: z.array(z.object({ sub: z.string(), name: z.string(), rollNo: z.string(), department: z.string() })),
  counts: z.object({ issued: z.number(), pending: z.number(), revoked: z.number(), courseCertificates: z.number() }),
});
export type DeskOverview = z.infer<typeof DeskOverview>;

/* ───────────────────────────── what the certificate sheet prints ───────────────────────────── */
export const SheetData = z.object({
  id: z.string(),
  kind: CertKind,
  recipientName: z.string(),
  recipientDetail: z.string(),
  /** The sentence after the recipient's name. */
  statement: z.string(),
  highlights: z.array(z.object({ label: z.string(), value: z.string() })),
  issuedAt: z.string(),
  status: z.enum(["valid", "revoked"]),
  note: z.string(),
  university: z.string(),
  profile: CertificateProfile,
});
export type SheetData = z.infer<typeof SheetData>;

export const MyAwards = z.array(SheetData);
