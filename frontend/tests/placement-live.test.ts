import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { todayIst } from "@/lib/api/mock/drives";
import { resetDriveMemory } from "@/lib/api/mock/drive-store";
import type { DriveItem } from "@/lib/api/drive-schemas";
import type { DashboardData, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "placement", name: "Placement", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (role: SessionPayload["role"] = "placement"): SessionPayload => ({ ...base, role, sub: `${role}-1` });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const analytics = async (s = who()) => (await call(s, "GET", "modules/placement-analytics")).body as DashboardData;
const home = async () => (await call(who(), "GET", "home/placement")).body as RoleHome;
const shift = (days: number) => new Date(Date.parse(`${todayIst()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const kpi = (d: { kpis: Array<{ label: string; value: string }> }, label: string) => d.kpis.find((k) => k.label === label)?.value;
const chartOf = (d: DashboardData, title: string) => d.charts.find((c) => c.title === title)!;
const drive = (over: Record<string, unknown> = {}) => ({ company: "Acme Systems", role: "Graduate Engineer", type: "On-campus", date: shift(-5), packageMin: 6, packageMax: 8, ...over });
const add = async (over: Record<string, unknown> = {}) => (await call(who(), "POST", "drives", drive(over))).body as DriveItem;

beforeEach(() => resetDriveMemory());

describe("Placement Analytics is built from live data", () => {
  it("shows zero offers, not invented ones, before any drive exists", async () => {
    const d = await analytics();
    expect(kpi(d, "Offers")).toBe("0");
    expect(kpi(d, "Average package")).toBe("–");
    expect(chartOf(d, "Offers by company").data).toEqual([{ name: "No offers yet", Offers: 0 }]);
    // Readiness figures still come from the students on the board.
    expect(kpi(d, "Placement readiness")).toMatch(/^\d+%$/);
    expect(d.charts.length).toBe(6);
  });

  it("counts offers, funnel, package and months from the drives that were saved", async () => {
    await add({ company: "Zoho", status: "Completed", registered: 100, shortlisted: 30, offers: 18, packageMin: 6, packageMax: 9 });
    await add({ company: "TCS", status: "Completed", registered: 150, shortlisted: 50, offers: 25, packageMin: 7, packageMax: 9, date: shift(-40) });
    const d = await analytics();

    expect(kpi(d, "Offers")).toBe("43");
    expect(kpi(d, "Registered to offer")).toBe("17%"); // 43 of 250
    expect(kpi(d, "Average package")).toBe("₹7.8 LPA"); // mid-points 7.5 and 8
    expect(chartOf(d, "Offers by company").data).toEqual([
      { name: "TCS", Offers: 25 },
      { name: "Zoho", Offers: 18 },
    ]);
    expect(chartOf(d, "Hiring funnel").data).toEqual([
      { name: "Registered", Students: 250 },
      { name: "Shortlisted", Students: 80 },
      { name: "Offers", Students: 43 },
    ]);
    expect(chartOf(d, "Registrations and offers by drive month").data.reduce((n, r) => n + Number(r.Offers), 0)).toBe(43);
  });

  it("follows the drives: a cancelled drive stops counting and a new one starts", async () => {
    const a = await add({ company: "Alpha", status: "Completed", registered: 20, shortlisted: 8, offers: 5 });
    expect(kpi(await analytics(), "Offers")).toBe("5");

    await call(who(), "PUT", `drives/${a.id}`, drive({ company: "Alpha", status: "Cancelled", registered: 20, shortlisted: 8, offers: 5 }));
    expect(kpi(await analytics(), "Offers")).toBe("0");

    await add({ company: "Beta", status: "Completed", registered: 10, shortlisted: 4, offers: 3 });
    expect(kpi(await analytics(), "Offers")).toBe("3");
  });

  it("charts use the name key the chart card reads, and the status split adds up to the students tracked", async () => {
    const d = await analytics();
    for (const c of d.charts) {
      expect(c.xKey).toBe("name");
      expect(c.data.every((r) => "name" in r)).toBe(true);
    }
    const split = chartOf(d, "Readiness status").data.reduce((n, r) => n + Number(r.value), 0);
    const bands = chartOf(d, "Readiness score distribution").data.reduce((n, r) => n + Number(r.Students), 0);
    expect(bands).toBe(split);
    expect(split).toBeGreaterThan(0);
  });

  it("can be read by the placement officer, the HOD and the institution head", async () => {
    for (const role of ["placement", "hod", "institution"] as const) {
      expect((await call(who(role), "GET", "modules/placement-analytics")).status).toBe(200);
    }
    expect((await call(who("faculty"), "GET", "modules/placement-analytics")).status).toBe(403);
  });
});

describe("Placement home is built from the same data", () => {
  it("matches Placement Analytics instead of showing sample numbers", async () => {
    await add({ company: "Zoho", status: "Completed", registered: 100, shortlisted: 30, offers: 18 });
    const h = await home();
    const d = await analytics();
    expect(h.kpis.find((k) => k.label === "Offers")?.value).toBe("18");
    expect(h.kpis.find((k) => k.label === "Offers")?.value).toBe(kpi(d, "Offers"));
    expect(h.kpis.some((k) => k.value === "412" || k.value === "1,860")).toBe(false);
  });

  it("queues the next upcoming drive with how many students are eligible", async () => {
    const next = await add({ company: "Freshworks", status: "Open", date: shift(6), registered: 12 });
    const h = await home();
    const item = h.queue.find((x) => x.title.includes("Freshworks"));
    expect(item).toBeTruthy();
    expect(item!.meta).toContain(`${next.eligible} eligible`);
    expect(item!.meta).toContain("12 registered");
    expect(h.kpis.find((k) => k.label === "Upcoming drives")?.value).toBe("1");
  });

  it("invites the first drive when none exist", async () => {
    const h = await home();
    expect(h.kpis.find((k) => k.label === "Upcoming drives")?.value).toBe("0");
    expect(h.queue.some((x) => x.title === "Schedule your first drive" || x.href === "/placement/placement-board")).toBe(true);
  });
});
