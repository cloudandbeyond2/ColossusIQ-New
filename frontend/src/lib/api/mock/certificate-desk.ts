import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { ALL_COLLEGES, UNIVERSITY } from "@/config/tenancy";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { cleanText } from "@/lib/security/sanitize";
import { signCertificateFields } from "@/lib/security/certificate-signature";
import { AwardBody, AwardRow, CertificateProfile, DecisionBody, DeskOverview, KIND_INFO, MyAwards, ProfileBody, SheetData } from "@/lib/api/certificate-schemas";
import { audit } from "./audit";
import { certificateDeskStore, type AwardRecord, type StoredProfile } from "./certificate-store";
import { verifyCertificate, type Certificate } from "./learning";
import { getCollege } from "./records";
import type { MockResult } from "./router";
import { getSite } from "./website";

/*
 * Certificate Authority. The Principal is the college's certifying authority: only the Principal designs the
 * certificate (header, address, accreditation, logo, college seal and signature), issues certificates
 * (appreciation, merit, participation, excellence, internship, workshop), approves or rejects requests that faculty
 * and HODs raise, and revokes certificates. Every issued certificate is HMAC-signed and verifiable at /verify/<id>
 * (the QR code on the certificate); course and quiz certificates use the same design and signature block.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const REQUESTERS = new Set(["faculty", "hod"]);
const STAFF = new Set(["faculty", "hod", "institution"]);
export const MAX_AWARDS = 5000;
const mayAuthorize = (s: SessionPayload) => can(s.role, "certificates:authorize");

/* ───────────────────────────── the college's certificate design ───────────────────────────── */
export async function defaultProfile(collegeId: string): Promise<CertificateProfile> {
  const [c, site] = await Promise.all([getCollege(collegeId), getSite(collegeId)]);
  const name = String(c?.name ?? "College");
  const highlights = String(site?.highlights ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const contact = [site?.phone, site?.email].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join(" · ");
  return {
    collegeName: name,
    affiliation: `Affiliated to ${UNIVERSITY.name}`,
    address: String(site?.address ?? `${name}, ${String(c?.city ?? "")}, Tamil Nadu`),
    contact: contact ? `Phone ${contact}` : "",
    accreditation: highlights.find((h) => /AICTE|NAAC|NBA|NMC|UGC|DOTE|approved|accredited|recognised/i.test(h)) ?? "",
    motto: "",
    logoRef: "",
    sealRef: "",
    signatureRef: "",
    principalName: String(c?.principal ?? "Principal"),
    principalDesignation: "Principal",
    theme: "classic",
    updatedBy: "",
    updatedAt: null,
  };
}

async function profileFrom(collegeId: string, stored: StoredProfile | undefined): Promise<CertificateProfile> {
  const base = await defaultProfile(collegeId);
  if (!stored) return base;
  const p = ProfileBody.safeParse(stored.data);
  return p.success ? { ...base, ...p.data, updatedBy: stored.updatedBy, updatedAt: stored.updatedAt } : base;
}
export const profileForCollege = async (collegeId: string) => profileFrom(collegeId, await certificateDeskStore().profileOf(collegeId));

/* ───────────────────────────── signing ───────────────────────────── */
const signedTitle = (a: Pick<AwardRecord, "reason" | "eventName" | "eventDate" | "recipientDetail">) => [a.reason, a.eventName, a.eventDate, a.recipientDetail].join("|");
function signAward(a: AwardRecord): string {
  return signCertificateFields({ id: a.publicId ?? "", kind: a.kind, studentName: a.recipientName, collegeId: a.collegeId, title: signedTitle(a), marks: 0, total: 0, percentage: 0, grade: "", issuedAt: a.issuedAt ?? "" });
}
function awardValid(a: AwardRecord): boolean {
  const expected = Buffer.from(signAward(a));
  const actual = Buffer.from(a.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const newPublicId = () => `CIQ-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

/* ───────────────────────────── what a certificate prints ───────────────────────────── */
const longDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

function sheetForCert(c: Certificate, profile: CertificateProfile): SheetData {
  const statement =
    c.kind === "course"
      ? `has successfully completed the course “${c.course}” offered by the Department of ${c.department}, and passed its final assessment with ${c.marks} out of ${c.total} marks.`
      : `has successfully completed the assessment “${c.title}” in ${c.course}, Department of ${c.department}, securing ${c.marks} out of ${c.total} marks.`;
  return {
    id: c.id,
    kind: c.kind,
    recipientName: c.studentName,
    recipientDetail: `Department of ${c.department}`,
    statement,
    highlights: [
      { label: "Grade", value: `${c.grade} · ${c.gradeLabel}` },
      { label: "Score", value: `${c.percentage}%` },
      { label: "Date of issue", value: longDate(c.issuedAt) },
    ],
    issuedAt: c.issuedAt,
    status: "valid",
    note: "",
    university: UNIVERSITY.name,
    profile,
  };
}

function sheetForAward(a: AwardRecord, profile: CertificateProfile): SheetData {
  const highlights = [
    ...(a.eventName ? [{ label: KIND_INFO[a.kind].label === "Internship completion" ? "Programme" : "Event", value: a.eventName }] : []),
    ...(a.eventDate ? [{ label: "Held on", value: longDate(a.eventDate) }] : []),
    { label: "Date of issue", value: longDate(a.issuedAt ?? a.createdAt) },
  ];
  return {
    id: a.publicId ?? "",
    kind: a.kind,
    recipientName: a.recipientName,
    recipientDetail: a.recipientDetail,
    statement: a.reason,
    highlights,
    issuedAt: a.issuedAt ?? a.createdAt,
    status: a.status === "Revoked" ? "revoked" : "valid",
    note: a.status === "Revoked" ? `Revoked by the Principal${a.decisionNote ? `: ${a.decisionNote}` : "."}` : "",
    university: UNIVERSITY.name,
    profile,
  };
}

/** Public verification: course/quiz certificates and Principal-issued certificates, with the issuing college's design. */
export async function lookupCertificate(id: string): Promise<{ valid: true; sheet: SheetData } | { valid: false; tampered: boolean }> {
  if (!/^CIQ-\d{4}-[A-F0-9]{8}$/.test(id)) return { valid: false, tampered: false };
  const v = await verifyCertificate(id);
  if (v.valid && v.certificate) return { valid: true, sheet: sheetForCert(v.certificate, await profileForCollege(v.certificate.collegeId)) };
  if (v.tampered) return { valid: false, tampered: true };
  const a = await certificateDeskStore().findByPublicId(id);
  if (!a || (a.status !== "Issued" && a.status !== "Revoked")) return { valid: false, tampered: false };
  if (!awardValid(a)) return { valid: false, tampered: true };
  return { valid: true, sheet: sheetForAward(a, await profileForCollege(a.collegeId)) };
}

/* ───────────────────────────── the desk ───────────────────────────── */
/** What leaves the server: never the signature, the college id or who raised it. */
const row = (a: AwardRecord): AwardRow => {
  const { collegeId, signature, requestedBySub, ...rest } = a;
  void collegeId;
  void signature;
  void requestedBySub;
  return AwardRow.parse(rest);
};
async function studentsOf(s: SessionPayload) {
  return (await getStore().readiness.board(s.college)).map((r) => ({ sub: r.studentSub, name: r.name, rollNo: r.rollNo, department: r.department }));
}
function cleanAward(b: AwardBody): AwardBody {
  const c = (v: string, n: number) => cleanText(v, n);
  return { ...b, recipientName: c(b.recipientName, 80), recipientDetail: c(b.recipientDetail, 120), reason: c(b.reason, 400), eventName: c(b.eventName, 120) };
}

export async function dispatchCertificateDesk(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  const store = certificateDeskStore();
  const [, a1, a2, a3] = segs;
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college: certificates are issued by each college's Principal.");

  // Any member of the college: the design (so portals can draw certificates) and, for students, their own awards.
  if (method === "GET" && a1 === "profile" && segs.length === 2) return ok(CertificateProfile.parse(await profileFrom(s.college, await store.getProfile(s))));
  if (method === "GET" && a1 === "mine" && segs.length === 2) {
    const profile = await profileFrom(s.college, await store.getProfile(s));
    const mine = (await store.listAwards(s)).filter((a) => a.recipientSub === s.sub && (a.status === "Issued" || a.status === "Revoked"));
    const certs = s.role === "student" ? await getStore().certificates.list({ studentSub: s.sub }) : [];
    const sheets = [...certs.map((c) => sheetForCert(c, profile)), ...mine.map((a) => sheetForAward(a, profile))].sort((x, y) => y.issuedAt.localeCompare(x.issuedAt));
    return ok(MyAwards.parse(sheets));
  }

  // The Super Admin may review a college's register and design; issuing stays with that college's Principal.
  const oversight = s.role === "admin";
  if (!STAFF.has(s.role) && !(oversight && method === "GET" && segs.length === 1)) return err(403, "forbidden", "Certificates are issued by the Principal.");
  const authority = mayAuthorize(s);

  if (method === "GET" && segs.length === 1) {
    const [profile, list, students, certs] = await Promise.all([profileFrom(s.college, await store.getProfile(s)), store.listAwards(s), studentsOf(s), getStore().certificates.list({ scope: s.college })]);
    const visible = authority || oversight ? list : list.filter((a) => a.requestedBySub === s.sub);
    const body: DeskOverview = {
      profile,
      canAuthorize: authority && s.mfa,
      reviewOnly: oversight ? `${profile.principalName} is this college's certifying authority. As Super Admin you can review the register, requests and design; issuing, approving and revoking stay with the Principal.` : null,
      awards: visible.slice(0, 1000).map(row),
      students: students.slice(0, 3000),
      counts: { issued: list.filter((a) => a.status === "Issued").length, pending: list.filter((a) => a.status === "Pending").length, revoked: list.filter((a) => a.status === "Revoked").length, courseCertificates: certs.length },
    };
    return ok(DeskOverview.parse(body));
  }

  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");

  // PUT certificate-desk/profile: the design. Principal only.
  if (method === "PUT" && a1 === "profile" && segs.length === 2) {
    if (!authority) return err(403, "forbidden", "Only the Principal can change the certificate design.");
    const p = ProfileBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const c = (v: string, n: number) => cleanText(v, n);
    const data: z.infer<typeof ProfileBody> = { ...p.data, collegeName: c(p.data.collegeName, 120), affiliation: c(p.data.affiliation, 160), address: c(p.data.address, 200), contact: c(p.data.contact, 160), accreditation: c(p.data.accreditation, 120), motto: c(p.data.motto, 120), principalName: c(p.data.principalName, 80), principalDesignation: c(p.data.principalDesignation, 80) };
    const saved = await store.saveProfile(s, data, s.name);
    await audit(s.name, "certificates.design.update", s.college, { collegeId: s.college, actorSub: s.sub });
    return ok(CertificateProfile.parse(await profileFrom(s.college, saved)));
  }

  // POST certificate-desk/awards: the Principal issues; faculty and HODs raise a request for the Principal.
  if (method === "POST" && a1 === "awards" && segs.length === 2) {
    if (!authority && !REQUESTERS.has(s.role)) return err(403, "forbidden", "Only the Principal can issue certificates.");
    const p = AwardBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = cleanAward(p.data);
    if (b.recipientSub && !(await studentsOf(s)).some((x) => x.sub === b.recipientSub)) return err(422, "validation", "Please correct the highlighted fields.", { recipientSub: "Pick a student of this college" });
    if ((await store.listAwards(s)).length >= MAX_AWARDS) return err(409, "limit", "The certificate register is full.");
    const now = new Date().toISOString();
    const draft: Omit<AwardRecord, "id" | "createdAt"> = {
      ...b,
      collegeId: s.college,
      publicId: authority ? newPublicId() : null,
      status: authority ? "Issued" : "Pending",
      requestedBy: s.name,
      requestedRole: s.role,
      requestedBySub: s.sub,
      decidedBy: authority ? s.name : "",
      decisionNote: "",
      issuedAt: authority ? now : null,
      signature: "",
    };
    let created = await store.createAward(s, draft);
    if (authority) {
      created = (await store.updateAward(s, { ...created, signature: signAward(created) }))!;
      await audit(s.name, `certificates.issue:${created.kind}`, created.publicId!, { collegeId: s.college, actorSub: s.sub });
    } else await audit(s.name, `certificates.request:${created.kind}`, created.id, { collegeId: s.college, actorSub: s.sub });
    return ok(row(created), 201);
  }

  // POST certificate-desk/awards/:id/{approve|reject|revoke}: Principal only.
  if (method === "POST" && a1 === "awards" && a2 && a3 && segs.length === 4) {
    if (!authority) return err(403, "forbidden", "Only the Principal can approve, reject or revoke certificates.");
    const p = DecisionBody.safeParse(rawBody ?? {});
    if (!p.success) return invalid(p.error);
    const a = await store.getAward(s, a2);
    if (!a) return err(404, "not_found", "Certificate not found.");
    const note = cleanText(p.data.note, 300);
    if (a3 === "approve") {
      if (a.status !== "Pending") return err(409, "not_pending", "Only pending requests can be approved.");
      const issued: AwardRecord = { ...a, status: "Issued", publicId: newPublicId(), issuedAt: new Date().toISOString(), decidedBy: s.name, decisionNote: note };
      const saved = (await store.updateAward(s, { ...issued, signature: signAward(issued) }))!;
      await audit(s.name, `certificates.approve:${a.kind}`, saved.publicId!, { collegeId: s.college, actorSub: s.sub });
      return ok(row(saved));
    }
    if (a3 === "reject") {
      if (a.status !== "Pending") return err(409, "not_pending", "Only pending requests can be rejected.");
      const saved = (await store.updateAward(s, { ...a, status: "Rejected", decidedBy: s.name, decisionNote: note }))!;
      await audit(s.name, `certificates.reject:${a.kind}`, a.id, { collegeId: s.college, actorSub: s.sub });
      return ok(row(saved));
    }
    if (a3 === "revoke") {
      if (a.status !== "Issued") return err(409, "not_issued", "Only issued certificates can be revoked.");
      if (note.length < 5) return err(422, "validation", "Please correct the highlighted fields.", { note: "Give a reason for revoking" });
      // The signature covers what was issued, not the status, so a revoked certificate still verifies as genuine but revoked.
      const saved = (await store.updateAward(s, { ...a, status: "Revoked", decidedBy: s.name, decisionNote: note }))!;
      await audit(s.name, `certificates.revoke:${a.kind}`, a.publicId!, { collegeId: s.college, actorSub: s.sub });
      return ok(row(saved));
    }
  }

  return err(404, "not_found", "Not found.");
}

