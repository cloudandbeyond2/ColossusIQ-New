import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import type { RequestContext } from "../index";

/*
 * Every PostgreSQL access runs inside one transaction per request:
 *   SET LOCAL ROLE ciq_app                    → row-level security applies, even if DATABASE_URL is the owner
 *   SELECT app_set_context(college, scope, user)  → which college's rows are visible (db/migrations/0001_init.sql)
 * The transaction client is kept in AsyncLocalStorage so store code can call db() anywhere below.
 */

export type Tx = Prisma.TransactionClient;

interface Ctx {
  tx: Tx;
  scope: string;
  collegeUuid: string | null;
  userUuid: string | null;
  /** Per-request memo (college ids, student ids …). */
  cache: Map<string, unknown>;
}

const als = new AsyncLocalStorage<Ctx>();
const holder = globalThis as unknown as { __ciqPrisma?: PrismaClient };

export function prisma(): PrismaClient {
  holder.__ciqPrisma ??= new PrismaClient({ log: process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : ["warn", "error"] });
  return holder.__ciqPrisma;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A college id that matches nothing, for scopes naming a college that does not exist. */
const NO_COLLEGE = "00000000-0000-0000-0000-000000000000";

export async function runInTransaction<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  // Nested calls (a helper that opens its own context) join the outer transaction.
  if (als.getStore()) return fn();
  return prisma().$transaction(
    async (tx) => {
      if (ctx.readOnly) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL ROLE ciq_app");
      const all = ctx.scope === "all";
      let collegeUuid: string | null = null;
      if (!all) {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id::text FROM colleges WHERE public_id = ${ctx.scope} OR id::text = ${ctx.scope} OR name = ${ctx.scope}`;
        collegeUuid = rows[0]?.id ?? NO_COLLEGE;
      }
      let userUuid = ctx.sub && UUID.test(ctx.sub) ? ctx.sub : null;
      if (!userUuid && ctx.sub?.startsWith("demo-") && collegeUuid && collegeUuid !== NO_COLLEGE) {
        const role = ctx.sub.split("-")[1];
        if (role) {
          const match = await tx.roleAssignment.findFirst({
            where: { role: role as any, collegeId: collegeUuid },
            select: { userId: true },
          });
          if (match) userUuid = match.userId;
        }
      }
      await tx.$executeRaw`SELECT app_set_context(${collegeUuid}::uuid, ${all ? "all" : "college"}, ${userUuid}::uuid)`;
      return als.run({ tx, scope: ctx.scope, collegeUuid, userUuid, cache: new Map() }, fn);
    },
    { maxWait: 30_000, timeout: 180_000 },
  );
}

function current(): Ctx {
  const c = als.getStore();
  if (!c) throw new Error("No database context — wrap the call in withRequestContext().");
  return c;
}

/** The current request's transaction client. */
export function db(): Tx {
  return current().tx;
}

/** Memoise a value for the rest of the request. */
export async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cache = current().cache;
  if (cache.has(key)) return cache.get(key) as T;
  const v = await load();
  cache.set(key, v);
  return v;
}
export function remember(key: string, value: unknown) {
  current().cache.set(key, value);
}
export function recall<T>(key: string): T | undefined {
  return current().cache.get(key) as T | undefined;
}
export function forget(prefix: string) {
  const cache = current().cache;
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

export function requestUser(): string | null {
  return current().userUuid;
}
/** The request's scope: a college public id, or "all". */
export function requestScope(): string {
  return current().scope;
}

export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** Maps a unique-violation or check-violation from PostgreSQL to a short reason, or rethrows. */
export function dbErrorReason(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
  const msg = e instanceof Error ? e.message : String(e);
  if (/violates check constraint|check_violation|does not belong to the|exceeds the .* stream maximum|only for medical colleges/.test(msg)) return "check";
  if (/violates foreign key constraint|P2003/.test(msg)) return "in_use";
  return null;
}
