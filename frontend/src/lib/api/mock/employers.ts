import "server-only";
import type { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import {
  EmployerBody,
  EMPLOYER_SECTORS,
  type EmployerOverview,
} from "@/lib/api/employer-schemas";
import { employerStore } from "./employer-store";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});

const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const READERS = ["placement", "hod", "institution", "admin"];

function clean(b: EmployerBody): EmployerBody {
  const c = (v: string, n: number) => cleanText(v, n);
  return {
    ...b,
    company: c(b.company, 100),
    website: c(b.website, 200),
    location: c(b.location, 100),
    contactName: c(b.contactName, 100),
    contactDesignation: c(b.contactDesignation, 100),
    contactEmail: b.contactEmail.trim().toLowerCase(),
    contactPhone: c(b.contactPhone, 25),
    contactLinkedin: c(b.contactLinkedin, 200),
    notes: c(b.notes, 1500),
    averagePackage: Math.round(b.averagePackage * 10) / 10,
    highestPackage: Math.round(b.highestPackage * 10) / 10,
  };
}

export async function dispatchEmployers(
  method: string,
  segs: string[],
  rawBody: unknown,
  s: SessionPayload,
  _query?: URLSearchParams
): Promise<MockResult> {
  if (!READERS.includes(s.role)) {
    return err(403, "forbidden", "Recruiter relationships are managed by the placement office.");
  }
  const canEdit = s.role === "placement";
  const id = segs[1];

  // GET /api/v1/employers
  if (method === "GET" && segs.length === 1) {
    const items = await employerStore.list(s);
    const active = items.filter(
      (i) => i.tier === "Tier-1 Partner" || i.tier === "Preferred Recruiter" || i.tier === "Active"
    );
    const withPkg = items.filter((i) => i.averagePackage > 0);
    const avgPkg = withPkg.length
      ? Math.round((withPkg.reduce((acc, i) => acc + i.averagePackage, 0) / withPkg.length) * 10) / 10
      : null;

    const body: EmployerOverview = {
      items,
      summary: {
        totalEmployers: items.length,
        activePartners: active.length,
        tier1Count: items.filter((i) => i.tier === "Tier-1 Partner").length,
        totalHires3Yr: items.reduce((acc, i) => acc + i.totalHires, 0),
        averagePackage: avgPkg,
        activeMous: items.filter((i) => i.mouStatus === "Active MoU").length,
      },
      sectors: [...EMPLOYER_SECTORS],
      canEdit,
    };
    return ok(body);
  }

  // POST /api/v1/employers
  if (method === "POST" && segs.length === 1) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can add employers.");
    const parsed = EmployerBody.safeParse(rawBody);
    if (!parsed.success) return invalid(parsed.error);
    const b = clean(parsed.data);

    const all = await employerStore.list(s);
    if (all.some((e) => e.company.toLowerCase() === b.company.toLowerCase())) {
      return err(409, "duplicate", "An employer record for this company already exists.");
    }

    const row = await employerStore.create(s, b);
    return ok(row, 201);
  }

  if (!id) return err(404, "not_found", "Not found.");

  // GET /api/v1/employers/:id
  if (method === "GET" && segs.length === 2) {
    const row = await employerStore.get(s, id);
    if (!row) return err(404, "not_found", "Employer not found.");
    return ok(row);
  }

  // PUT /api/v1/employers/:id
  if (method === "PUT" && segs.length === 2) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can modify employers.");
    const parsed = EmployerBody.safeParse(rawBody);
    if (!parsed.success) return invalid(parsed.error);
    const b = clean(parsed.data);

    const all = await employerStore.list(s);
    if (all.some((e) => e.id !== id && e.company.toLowerCase() === b.company.toLowerCase())) {
      return err(409, "duplicate", "Another employer with this company name already exists.");
    }

    const row = await employerStore.update(s, id, b);
    return row ? ok(row) : err(404, "not_found", "Employer not found.");
  }

  // DELETE /api/v1/employers/:id
  if (method === "DELETE" && segs.length === 2) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can remove employers.");
    const deleted = await employerStore.remove(s, id);
    return deleted ? ok({ ok: true }) : err(404, "not_found", "Employer not found.");
  }

  return err(404, "not_found", "Not found.");
}
