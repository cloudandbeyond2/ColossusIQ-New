import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resumeChecklist, resumeText, type ResumeDoc, type ResumeOverview } from "@/lib/api/resume-schemas";
import { resumeHtml } from "@/lib/resume-export";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "Asha Rao", tenant: "uni-tntu", college: "COL-RES-1", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student"): SessionPayload => ({ ...base, sub, role });
const call = (s: SessionPayload, method: string, body?: unknown) => dispatch(method, ["resume"], body, s, new URLSearchParams());
const get = async (s: SessionPayload) => (await call(s, "GET")).body as ResumeOverview;

describe("Resume Builder", () => {
  it("opens with a draft from the profile and invents no contact details", async () => {
    const o = await get(who("r-new"));
    expect(o.saved).toBe(false);
    expect(o.doc.name).toBeTruthy();
    expect(o.doc.education.length).toBe(1);
    expect(o.doc.skills.length).toBeGreaterThan(0);
    expect(o.doc.email).toBe("");
    expect(o.doc.projects).toEqual([]);
  });

  it("saves, cleans and returns the same resume next time, per student", async () => {
    const s = who("r-save");
    const o = await get(s);
    const r = await call(s, "PUT", { ...o.doc, summary: "Builds <b>APIs</b>", skills: ["SQL", "SQL", " "], links: ["", "github.com/asha"], projects: [{ name: "", tech: "", link: "", bullets: [] }, { name: "Campus app", tech: "Next.js", link: "", bullets: ["Cut load time 30%", ""] }] });
    expect(r.status).toBe(200);
    const again = await get(s);
    expect(again.saved).toBe(true);
    expect(again.doc.summary).toBe("Builds <b>APIs</b>"); // stored as text; every output escapes it
    expect(again.doc.skills).toEqual(["SQL"]);
    expect(again.doc.links).toEqual(["github.com/asha"]);
    expect(again.doc.projects).toHaveLength(1);
    expect(again.doc.projects[0]!.bullets).toEqual(["Cut load time 30%"]);
    expect((await get(who("r-other"))).saved).toBe(false);
  });

  it("rejects an empty name and oversize lists", async () => {
    const s = who("r-bad");
    const o = await get(s);
    expect((await call(s, "PUT", { ...o.doc, name: "  " })).status).toBe(422);
    expect((await call(s, "PUT", { ...o.doc, links: Array(6).fill("a.com") })).status).toBe(422);
    expect((await call(s, "PUT", { nope: 1 })).status).toBe(422);
  });

  it("resets to a fresh draft and is students only", async () => {
    const s = who("r-reset");
    const o = await get(s);
    await call(s, "PUT", { ...o.doc, summary: "Changed" });
    expect((await call(s, "DELETE")).status).toBe(200);
    expect((await get(s)).saved).toBe(false);
    expect((await call(who("r-fac", "faculty"), "GET")).status).toBe(403);
  });

  it("turns a resume into plain text, a checklist and Word-safe HTML", async () => {
    const d: ResumeDoc = {
      template: "Modern", name: "Asha <Rao>", headline: "Student", email: "a@b.in", phone: "", location: "", links: ["github.com/asha"],
      summary: "x".repeat(70), education: [{ school: "NIT", degree: "B.E.", period: "2022", score: "8.4" }],
      skills: ["SQL", "Python", "Git", "Java", "Docker", "REST"], projects: [{ name: "App", tech: "", link: "", bullets: ["Did it"] }],
      experience: [], certifications: ["AWS"], achievements: [],
    };
    const t = resumeText(d);
    expect(t).toContain("SKILLS\nSQL, Python");
    expect(t).toContain("- Did it");
    expect(resumeChecklist(d).filter((c) => !c.done).map((c) => c.label)).toEqual(["Experience or leadership"]);
    const html = resumeHtml(d);
    expect(html).toContain("Asha &lt;Rao&gt;");
    expect(html).not.toContain("<Rao>");
  });
});
