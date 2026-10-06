import { z } from "zod";

/* Resume Builder: one saved resume per student, in the shape the page edits and the three downloads print. */

export const RESUME_TEMPLATES = ["Classic", "Modern", "Compact"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];

const line = (max: number) => z.string().trim().max(max);
const bullets = z.array(line(300)).max(8);

export const ResumeEducation = z.object({
  school: line(140),
  degree: line(160),
  period: line(40),
  score: line(40),
});
export const ResumeProject = z.object({
  name: line(120),
  tech: line(160),
  link: line(200),
  bullets,
});
export const ResumeExperience = z.object({
  title: line(120),
  org: line(140),
  period: line(40),
  bullets,
});

export const ResumeDoc = z.object({
  template: z.enum(RESUME_TEMPLATES),
  name: line(80),
  headline: line(120),
  email: line(120),
  phone: line(30),
  location: line(80),
  links: z.array(line(200)).max(5),
  summary: line(700),
  education: z.array(ResumeEducation).max(6),
  skills: z.array(line(40)).max(40),
  projects: z.array(ResumeProject).max(8),
  experience: z.array(ResumeExperience).max(8),
  certifications: z.array(line(200)).max(12),
  achievements: z.array(line(240)).max(12),
});
export type ResumeDoc = z.infer<typeof ResumeDoc>;

export const ResumeOverview = z.object({
  doc: ResumeDoc,
  /** A fresh draft built from the student's profile and Experience Passport, for "Fill from my profile". */
  seed: ResumeDoc,
  saved: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type ResumeOverview = z.infer<typeof ResumeOverview>;

export const StoredResume = z.object({ doc: ResumeDoc, updatedAt: z.string() });
export type StoredResume = z.infer<typeof StoredResume>;

/** The plain text the ATS check reads and the .txt download writes: the same words, in reading order. */
export function resumeText(d: ResumeDoc): string {
  const out: string[] = [d.name, d.headline, [d.email, d.phone, d.location, ...d.links].filter(Boolean).join(" | ")];
  if (d.summary) out.push("", "SUMMARY", d.summary);
  if (d.education.length) {
    out.push("", "EDUCATION");
    for (const e of d.education) out.push([e.degree, e.school, e.period, e.score].filter(Boolean).join(" | "));
  }
  if (d.skills.length) out.push("", "SKILLS", d.skills.join(", "));
  if (d.projects.length) {
    out.push("", "PROJECTS");
    for (const p of d.projects) {
      out.push([p.name, p.tech, p.link].filter(Boolean).join(" | "));
      for (const b of p.bullets) out.push(`- ${b}`);
    }
  }
  if (d.experience.length) {
    out.push("", "EXPERIENCE");
    for (const x of d.experience) {
      out.push([x.title, x.org, x.period].filter(Boolean).join(" | "));
      for (const b of x.bullets) out.push(`- ${b}`);
    }
  }
  if (d.certifications.length) out.push("", "CERTIFICATIONS", ...d.certifications.map((c) => `- ${c}`));
  if (d.achievements.length) out.push("", "ACHIEVEMENTS", ...d.achievements.map((c) => `- ${c}`));
  return out.filter((l, i, a) => !(l === "" && (i === 0 || a[i - 1] === ""))).join("\n");
}

/** How complete the resume is, as a checklist the page shows (not an ATS score). */
export function resumeChecklist(d: ResumeDoc): Array<{ label: string; done: boolean }> {
  return [
    { label: "Name and email", done: !!d.name && !!d.email },
    { label: "A short summary", done: d.summary.length >= 60 },
    { label: "Education", done: d.education.length > 0 },
    { label: "At least 6 skills", done: d.skills.length >= 6 },
    { label: "A project with bullet points", done: d.projects.some((p) => p.bullets.length > 0) },
    { label: "Experience or leadership", done: d.experience.length > 0 },
    { label: "A link (GitHub or LinkedIn)", done: d.links.length > 0 },
    { label: "Certifications or achievements", done: d.certifications.length + d.achievements.length > 0 },
  ];
}
