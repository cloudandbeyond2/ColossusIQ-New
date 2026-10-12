import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { MODULES } from "@/config/modules";
import { PERMISSION_CATALOG, ROLE_PERMISSIONS, ROLES } from "@/lib/auth/roles";
import { pairKey, resetModuleAccessMemory, saveDisabledPairs } from "@/lib/module-access";
import type { RolesOverview } from "@/lib/api/roles-schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "institution", name: "Principal", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (role: SessionPayload["role"] = "institution", college = "COL-1001"): SessionPayload => ({ ...base, role, college, sub: `${role}-1` });
const q = new URLSearchParams();
const get = (s: SessionPayload) => dispatch("GET", ["roles-permissions"], undefined, s, q);
const overview = async (s = who()) => (await get(s)).body as RolesOverview;

beforeEach(() => resetModuleAccessMemory());

describe("Roles & Permissions is built from live data", () => {
  it("lists every permission the API knows, grouped, with a role column for every role", async () => {
    const o = await overview();
    expect(o.permissions.map((p) => p.key).sort()).toEqual(Object.keys(PERMISSION_CATALOG).sort());
    expect(o.permissions.some((p) => p.key === "certificates:authorize")).toBe(true); // used to be missing from the matrix
    expect(o.roles.map((r) => r.id)).toEqual([...ROLES]);
    for (const r of o.roles) expect(r.permissions).toEqual([...ROLE_PERMISSIONS[r.id]]);
    for (const p of o.permissions) expect(o.groups).toContain(p.group);
  });

  it("counts the accounts holding each role in the college", async () => {
    const o = await overview();
    for (const r of o.roles) {
      expect(r.users.active + r.users.invited + r.users.suspended).toBeLessThanOrEqual(r.users.total);
      expect(r.members.length).toBeLessThanOrEqual(6);
      expect(r.members.length).toBeLessThanOrEqual(r.users.total);
      expect(JSON.stringify(r.members)).not.toMatch(/@/); // no emails in the response
    }
  });

  it("shows which modules a role cannot open once Module Control switches them off, and clears them when switched back on", async () => {
    const mod = MODULES.find((m) => m.roles.includes("faculty") && m.group !== "Placement" && m.group !== "Career")!;
    const before = (await overview()).roles.find((r) => r.id === "faculty")!;
    expect(before.modules.closed.some((m) => m.slug === mod.slug)).toBe(false);

    await saveDisabledPairs([pairKey(mod.slug, "faculty")], "test");
    const after = (await overview()).roles.find((r) => r.id === "faculty")!;
    expect(after.modules.closed).toContainEqual(expect.objectContaining({ slug: mod.slug, reason: "role" }));
    expect(after.modules.open).toBe(before.modules.open - 1);
    expect(after.modules.byGroup.reduce((n, g) => n + g.open, 0)).toBe(after.modules.open);

    await saveDisabledPairs([], "test");
    expect((await overview()).roles.find((r) => r.id === "faculty")!.modules.closed.some((m) => m.slug === mod.slug)).toBe(false);
  });

  it("reports a Module Control change as a flag", async () => {
    const mod = MODULES.find((m) => m.roles.includes("hod"))!;
    await saveDisabledPairs([pairKey(mod.slug, "hod")], "test");
    expect((await overview()).flags.some((f) => /Module Control has switched off/.test(f.title))).toBe(true);
  });

  it("is open to the principal and the Super Admin only", async () => {
    expect((await get(who("institution"))).status).toBe(200);
    expect((await get(who("admin", "all"))).status).toBe(200);
    for (const role of ["faculty", "hod", "placement", "student", "recruiter"] as const) expect((await get(who(role))).status).toBe(403);
  });

  it("covers every college for the Super Admin", async () => {
    const o = await overview(who("admin", "all"));
    expect(o.allColleges).toBe(true);
    expect(o.scopeLabel).toBe("All colleges");
  });
});
