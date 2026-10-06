import "server-only";
import type { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { ResumeDoc, StoredResume, type ResumeOverview } from "@/lib/api/resume-schemas";
import { experienceStore } from "./experience-store";
import { periodOf } from "./experience";
import { collegeName } from "./records";
import { getStudentAcademicProfile } from "./student-profile";
import { studentStateStore } from "./student-state-store";
import type { MockResult } from "./router";

/*
 * Resume Builder. One resume per student, saved as a small document. The first time the page opens it is a draft made
 * from facts the platform already holds (name, programme, college, enrolled subjects, Experience Passport entries);
 * nothing is invented — contact details and project bullets stay empty for the student to write.
 */

const STATE_KEY = "resume";
const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });

const blankDoc = (name: string): ResumeDoc => ({
  template: "Classic",
  name,
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  education: [],
  skills: [],
  projects: [],
  experience: [],
  certifications: [],
  achievements: [],
});

async function seedFor(s: SessionPayload): Promise<ResumeDoc> {
  const doc = blankDoc(s.name);
  try {
    const p = await getStudentAcademicProfile(s);
    const school = await collegeName(s.college).catch(() => "");
    doc.name = p.name || s.name;
    doc.headline = `${p.degree} student · ${p.department}`;
    doc.education = [{ school, degree: `${p.degree}, ${p.department}`, period: "", score: p.cgpa ? `CGPA ${p.cgpa.toFixed(2)}` : "" }];
    doc.skills = [...new Set(p.enrolledSubjects.map((x) => x.title))].slice(0, 12);
  } catch {
    /* keep the blank draft */
  }
  try {
    const rows = (await experienceStore().list(s, "mine")).filter((r) => r.status !== "Rejected");
    const verified = rows.filter((r) => r.status === "Verified");
    doc.experience = (verified.length ? verified : rows).slice(0, 8).map((r) => ({
      title: r.role || r.title,
      org: r.organisation,
      period: periodOf(r.startMonth, r.endMonth),
      bullets: r.description
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 4),
    }));
  } catch {
    /* no passport entries */
  }
  return ResumeDoc.parse(doc);
}

/** Strips markup and control characters from every string the student typed. */
function clean(d: ResumeDoc): ResumeDoc {
  const c = (v: string, n: number) => cleanText(v, n);
  const list = (a: string[], n: number) => a.map((v) => c(v, n)).filter(Boolean);
  return {
    template: d.template,
    name: c(d.name, 80),
    headline: c(d.headline, 120),
    email: c(d.email, 120),
    phone: c(d.phone, 30),
    location: c(d.location, 80),
    links: list(d.links, 200),
    summary: c(d.summary, 700),
    education: d.education.map((e) => ({ school: c(e.school, 140), degree: c(e.degree, 160), period: c(e.period, 40), score: c(e.score, 40) })).filter((e) => e.school || e.degree),
    skills: [...new Set(list(d.skills, 40))],
    projects: d.projects.map((p) => ({ name: c(p.name, 120), tech: c(p.tech, 160), link: c(p.link, 200), bullets: list(p.bullets, 300) })).filter((p) => p.name),
    experience: d.experience.map((x) => ({ title: c(x.title, 120), org: c(x.org, 140), period: c(x.period, 40), bullets: list(x.bullets, 300) })).filter((x) => x.title || x.org),
    certifications: list(d.certifications, 200),
    achievements: list(d.achievements, 240),
  };
}

const invalid = (e: z.ZodError): MockResult => err(422, "validation", e.issues[0]?.message ?? "That resume could not be saved.");

export async function dispatchResume(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "student") return err(403, "forbidden", "The Resume Builder is for students.");
  if (segs.length !== 1) return err(404, "not_found", "Not found.");
  const store = studentStateStore();

  if (method === "GET") {
    const saved = StoredResume.safeParse(await store.get(s.sub, STATE_KEY));
    const seed = await seedFor(s);
    const body: ResumeOverview = saved.success
      ? { doc: saved.data.doc, seed, saved: true, updatedAt: saved.data.updatedAt }
      : { doc: seed, seed, saved: false, updatedAt: null };
    return ok(body);
  }

  if (method === "PUT") {
    const p = ResumeDoc.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const doc = clean(p.data);
    if (!doc.name) return err(422, "validation", "Add your name before saving.");
    const updatedAt = new Date().toISOString();
    await store.save(s.college, s.sub, STATE_KEY, { doc, updatedAt });
    return ok({ doc, updatedAt });
  }

  if (method === "DELETE") {
    await store.remove(s.sub, STATE_KEY);
    return ok({ ok: true });
  }

  return err(405, "method_not_allowed", "Not allowed.");
}
