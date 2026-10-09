import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { USER_ROLE_OPTIONS } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";

const principal: SessionPayload = { sub: "pr1", role: "institution", name: "Principal", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
type Page = { items: Array<{ id: string; role: string; status: string }>; total: number; counts: Record<string, number> };
const list = async (params: Record<string, string> = {}) => {
  const r = await dispatch("GET", ["records", "users"], undefined, principal, new URLSearchParams({ pageSize: "50", ...params }));
  expect(r.status).toBe(200);
  return r.body as Page;
};

describe("User Management role filter", () => {
  it("returns only the chosen role, and the totals agree with the unfiltered list", async () => {
    const all = await list();
    expect(all.total).toBeGreaterThan(0);
    const roles = [...new Set(all.items.map((u) => u.role))].filter(Boolean);
    expect(roles.length).toBeGreaterThan(1); // the demo college has several kinds of user

    let sum = 0;
    for (const role of USER_ROLE_OPTIONS) {
      const r = await list({ "filter.role": role });
      expect(r.items.every((u) => u.role === role)).toBe(true);
      sum += r.total;
    }
    expect(sum).toBe(all.total); // every user has exactly one of the listed roles
  });

  it("combines with search and status, and narrows the status counts", async () => {
    const all = await list();
    const role = all.items[0]!.role;
    const only = await list({ "filter.role": role });
    const chipTotal = Object.values(only.counts).reduce((a, b) => a + b, 0);
    expect(chipTotal).toBe(only.total);

    const status = only.items[0]!.status;
    const both = await list({ "filter.role": role, status });
    expect(both.items.every((u) => u.role === role && u.status === status)).toBe(true);

    const none = await list({ "filter.role": role, q: "zzz-no-such-person" });
    expect(none.total).toBe(0);
  });

  it("ignores values that are not real options instead of failing or leaking", async () => {
    const all = await list();
    expect((await list({ "filter.role": "Not A Role" })).total).toBe(all.total);
    expect((await list({ "filter.department": "Anything" })).total).toBe(all.total); // not a filter field of users
  });
});
