import "server-only";
import { MODULES, findModule } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { sharedState } from "@/lib/api/mock/global-state";
import { dataBackend } from "@/lib/data";

/*
 * Role-based module control (Super Admin → Module Control). Every module is on for the roles the registry grants it
 * to, until the Super Admin switches it off for a role. Only the switched-off pairs are stored ("slug|role" → false),
 * university-wide (table module_access on PostgreSQL, cached in the process for 15 s). Menus, module pages and the API all consult this, so a module switched off
 * for a role disappears from its menu, its page returns 404 and its API returns 403.
 */

const memory = sharedState("module-access.memory", () => ({ pairs: new Set<string>() }));
const cache = sharedState("module-access.cache", () => ({ pairs: new Set<string>(), at: 0, warned: false }));
const TTL_MS = 15_000;

/** The Super Admin can never switch these off for itself, so it cannot lock itself out. */
export const LOCKED_FOR_ADMIN = new Set(["module-control", "colleges", "users", "roles-permissions", "security-settings", "audit-log", "ai-providers"]);

export const pairKey = (slug: string, role: Role) => `${slug}|${role}`;

export function isLocked(slug: string, role: Role): boolean {
  return role === "admin" && LOCKED_FOR_ADMIN.has(slug);
}

async function savedPairs(): Promise<Set<string>> {
  if (dataBackend() !== "postgres") return memory.pairs;
  if (Date.now() - cache.at < TTL_MS) return cache.pairs;
  try {
    const { loadDisabledPairs } = await import("@/lib/data/postgres/module-access");
    cache.pairs = new Set(await loadDisabledPairs());
  } catch {
    if (!cache.warned) console.warn("[module-access] could not read module_access; every module stays on");
    cache.warned = true;
  }
  cache.at = Date.now();
  return cache.pairs;
}

/** Pairs that are switched off ("slug|role"). Unknown, ungranted or locked pairs are ignored. */
export async function disabledPairs(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const k of await savedPairs()) {
    const [slug, role] = k.split("|") as [string, Role];
    const mod = findModule(slug);
    if (mod && mod.roles.includes(role) && !isLocked(slug, role)) out.add(k);
  }
  return out;
}

/** Slugs switched off for one role. */
export async function blockedSlugs(role: Role): Promise<string[]> {
  const pairs = await disabledPairs();
  return MODULES.filter((m) => pairs.has(pairKey(m.slug, role))).map((m) => m.slug);
}

/** Saves the full set of switched-off pairs (call inside the Super Admin's request context). */
export async function saveDisabledPairs(pairs: string[], by: string): Promise<void> {
  if (dataBackend() === "postgres") {
    const { replaceDisabledPairs } = await import("@/lib/data/postgres/module-access");
    await replaceDisabledPairs(pairs, by);
    cache.pairs = new Set(pairs);
    cache.at = Date.now();
  } else memory.pairs = new Set(pairs);
}

/** Test helper. */
export function resetModuleAccessMemory(): void {
  memory.pairs = new Set();
  cache.pairs = new Set();
  cache.at = 0;
}

/**
 * API areas and the modules they serve. An API area is closed to a role only when every module it serves is
 * switched off for that role (role checks inside each API still apply as before).
 */
export const API_AREAS: Record<string, string[]> = {
  "exam-prep": ["competitive-exams"],
  "current-affairs": ["current-affairs-desk", "competitive-exams"],
  "prep-content": ["exam-prep-studio"],
  "certificate-desk": ["certificate-authority", "certificate-requests", "my-certificates", "issued-certificates"],
  "refresh-zone": ["refresh-zone"],
  achievements: ["achievements"],
  mentor: ["mentor"],
  "study-planner": ["study-planner"],
  languages: ["languages"],
  "mission-planner": ["mission-planner"],
  research: ["research"],
  experience: ["experience"],
  viva: ["viva"],
  resume: ["resume"],
  interview: ["interview"],
  drives: ["drives"],
  knowledge: ["knowledge-base"],
  "ai-providers": ["ai-providers"],
  clubs: ["clubs"],
  "notice-board": ["notice-board"],
  "content-desk": ["content-desk"],
  curriculum: ["curriculum", "course-roadmap"],
  "course-roadmap": ["course-roadmap"],
  integrations: ["integrations"],
  sports: ["sports"],
  hackathons: ["hackathons"],
};

/** Whether the role may use an API area, given the switched-off pairs. */
export function apiAreaOpen(segment: string, role: Role, pairs: Set<string>): boolean {
  const slugs = API_AREAS[segment];
  if (!slugs) return true;
  const granted = slugs.filter((s) => findModule(s)?.roles.includes(role));
  if (!granted.length) return true;
  return granted.some((s) => !pairs.has(pairKey(s, role)));
}
