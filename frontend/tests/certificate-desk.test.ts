import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CertificateSheet } from "@/components/certificate/certificate-sheet";
import type { AwardRow, CertificateProfile, DeskOverview, SheetData } from "@/lib/api/certificate-schemas";
import { lookupCertificate } from "@/lib/api/mock/certificate-desk";
import { certificateDeskStore, resetCertificateDeskMemory } from "@/lib/api/mock/certificate-store";
import { dispatch } from "@/lib/api/mock/router";
import { qrPath } from "@/lib/qr";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const as = (role: SessionPayload["role"], sub: string = role, name = `Test ${role}`): SessionPayload => ({ ...base, role, sub, name });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const principal = as("institution", "principal-1", "Dr. Principal");
const faculty = as("faculty", "faculty-1", "Ms. Faculty");

const award = (over: Record<string, unknown> = {}) => ({ kind: "appreciation", recipientName: "Guest Speaker", recipientSub: null, recipientDetail: "Infosys Ltd", reason: "in recognition of an inspiring keynote address delivered at the symposium.", eventName: "TECHNOVA 2026", eventDate: "2026-09-20", ...over });

beforeEach(() => resetCertificateDeskMemory());

describe("the Principal is the only certificate authority", () => {
  it("lets only the Principal change the design or issue directly", async () => {
    const design = (await call(principal, "GET", "certificate-desk/profile")).body as CertificateProfile;
    expect(design.collegeName.length).toBeGreaterThan(3);
    expect(design.theme).toBe("classic");
    const { updatedAt, updatedBy, ...body } = design;
    void updatedAt;
    void updatedBy;
    expect((await call(faculty, "PUT", "certificate-desk/profile", { ...body, accreditation: "NAAC A++" })).status).toBe(403);
    expect((await call(as("hod"), "PUT", "certificate-desk/profile", body)).status).toBe(403);
    const saved = await call(principal, "PUT", "certificate-desk/profile", { ...body, accreditation: "NAAC A++", theme: "royal" });
    expect(saved.status).toBe(200);
    expect((saved.body as CertificateProfile).accreditation).toBe("NAAC A++");
    // Everyone in the college sees the design (to draw certificates); outsiders and "all colleges" do not.
    expect(((await call(as("student"), "GET", "certificate-desk/profile")).body as CertificateProfile).theme).toBe("royal");
    expect((await call({ ...principal, college: "all" }, "GET", "certificate-desk")).status).toBe(409);
    expect((await call(as("placement"), "GET", "certificate-desk")).status).toBe(403);
    expect((await call({ ...principal, mfa: false }, "POST", "certificate-desk/awards", award())).status).toBe(403);
  });

  it("issues a signed, verifiable certificate", async () => {
    const r = await call(principal, "POST", "certificate-desk/awards", award());
    expect(r.status).toBe(201);
    const row = r.body as AwardRow;
    expect(row.status).toBe("Issued");
    expect(row.publicId).toMatch(/^CIQ-\d{4}-[A-F0-9]{8}$/);
    expect(JSON.stringify(row)).not.toMatch(/signature|requestedBySub/);
    const v = await lookupCertificate(row.publicId!);
    expect(v.valid).toBe(true);
    if (v.valid) {
      expect(v.sheet).toMatchObject({ kind: "appreciation", recipientName: "Guest Speaker", status: "valid" });
      expect(v.sheet.highlights.map((h) => h.label)).toEqual(["Event", "Held on", "Date of issue"]);
    }
  });

  it("detects a tampered record", async () => {
    const row = (await call(principal, "POST", "certificate-desk/awards", award())).body as AwardRow;
    const store = certificateDeskStore();
    const rec = (await store.getAward(principal, row.id))!;
    await store.updateAward(principal, { ...rec, recipientName: "Someone Else" });
    expect(await lookupCertificate(row.publicId!)).toEqual({ valid: false, tampered: true });
  });
});

describe("requests from faculty", () => {
  it("wait for the Principal, who approves, rejects or later revokes", async () => {
    const req = (await call(faculty, "POST", "certificate-desk/awards", award({ kind: "participation" }))).body as AwardRow;
    expect(req).toMatchObject({ status: "Pending", publicId: null, requestedBy: "Ms. Faculty" });
    // Faculty see only their own requests and cannot decide.
    expect(((await call(as("faculty", "faculty-2"), "GET", "certificate-desk")).body as DeskOverview).awards).toHaveLength(0);
    expect((await call(faculty, "POST", `certificate-desk/awards/${req.id}/approve`, { note: "" })).status).toBe(403);

    const ok = (await call(principal, "POST", `certificate-desk/awards/${req.id}/approve`, { note: "Well deserved" })).body as AwardRow;
    expect(ok).toMatchObject({ status: "Issued", decidedBy: "Dr. Principal" });
    expect((await lookupCertificate(ok.publicId!)).valid).toBe(true);

    expect((await call(principal, "POST", `certificate-desk/awards/${req.id}/revoke`, { note: "" })).status).toBe(422);
    const revoked = (await call(principal, "POST", `certificate-desk/awards/${req.id}/revoke`, { note: "Issued in error" })).body as AwardRow;
    expect(revoked.status).toBe("Revoked");
    const v = await lookupCertificate(ok.publicId!);
    expect(v.valid && v.sheet.status).toBe("revoked");

    const other = (await call(as("hod", "hod-1"), "POST", "certificate-desk/awards", award())).body as AwardRow;
    const rejected = (await call(principal, "POST", `certificate-desk/awards/${other.id}/reject`, { note: "Duplicate" })).body as AwardRow;
    expect(rejected.status).toBe("Rejected");
    expect((await call(principal, "POST", `certificate-desk/awards/${other.id}/approve`, {})).status).toBe(409);
  });
});

describe("students", () => {
  it("see certificates issued to them, and only students of the college can be picked", async () => {
    const desk = (await call(principal, "GET", "certificate-desk")).body as DeskOverview;
    expect(desk.students.length).toBeGreaterThan(0);
    const st = desk.students[0]!;
    expect((await call(principal, "POST", "certificate-desk/awards", award({ recipientSub: "not-a-student", recipientName: "Nobody Here" }))).status).toBe(422);
    const row = (await call(principal, "POST", "certificate-desk/awards", award({ kind: "merit", recipientSub: st.sub, recipientName: st.name, recipientDetail: st.rollNo }))).body as AwardRow;
    const mine = (await call({ ...base, sub: st.sub }, "GET", "certificate-desk/mine")).body as SheetData[];
    expect(mine.some((c) => c.id === row.publicId && c.kind === "merit")).toBe(true);
    expect(((await call({ ...base, sub: "someone-else" }, "GET", "certificate-desk/mine")).body as SheetData[]).some((c) => c.id === row.publicId)).toBe(false);
  });
});

describe("the printed sheet", () => {
  it("draws the header, title, QR, golden seal, college seal and the Principal's signature block", async () => {
    const row = (await call(principal, "POST", "certificate-desk/awards", award())).body as AwardRow;
    const v = await lookupCertificate(row.publicId!);
    if (!v.valid) throw new Error("expected a valid certificate");
    const html = renderToStaticMarkup(createElement(CertificateSheet, { data: v.sheet, verifyUrl: `https://college.test/verify/${row.publicId}` }));
    const at = (s: string) => {
      const i = html.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      return i;
    };
    const header = at(v.sheet.profile.affiliation);
    const title = at("of Appreciation");
    const qr = at("QR code to verify certificate");
    const gold = at("Golden verification seal");
    // The faint watermark behind the text is also a seal; the footer seal is the last one drawn.
    const collegeSeal = html.lastIndexOf(`Seal of ${v.sheet.profile.collegeName}`);
    const sign = at(v.sheet.profile.principalDesignation);
    // Reading order matches the layout: header, title, then QR (left), golden seal (centre), seal and signature (right).
    expect(header).toBeLessThan(title);
    expect(title).toBeLessThan(qr);
    expect(qr).toBeLessThan(gold);
    expect(gold).toBeLessThan(collegeSeal);
    expect(collegeSeal).toBeLessThan(sign);
    expect(html).toContain(row.publicId);
    expect(html).not.toContain("REVOKED");
  });
  it("encodes the verification URL as a QR code", () => {
    const a = qrPath("https://college.test/verify/CIQ-2026-ABCDEF12");
    expect(a.size).toBeGreaterThan(20);
    expect(a.d).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    expect(qrPath("https://college.test/verify/CIQ-2026-ABCDEF12")).toEqual(a);
  });
});
