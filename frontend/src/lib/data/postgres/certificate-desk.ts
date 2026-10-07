import "server-only";
import type { Prisma } from "@prisma/client";
import type { AwardRecord, CertificateDeskStore, StoredProfile } from "@/lib/api/mock/certificate-store";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Certificate design and Principal-issued certificates on PostgreSQL: `certificate_profiles` and
 * `certificate_awards` (db/migrations/0016_certificate_authority.sql). Row-level security limits every query to the
 * signed-in college (the public verification page reads at "all" scope). The record body is JSON validated by the
 * application; the columns hold what is searched on.
 */

interface ProfileRow {
  data: unknown;
  updatedBy: string;
  updatedAt: Date;
}
interface AwardDbRow {
  id: string;
  publicId: string | null;
  recipientSub: string | null;
  status: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

const toProfile = (r: ProfileRow): StoredProfile => ({ data: r.data, updatedBy: r.updatedBy, updatedAt: r.updatedAt.toISOString() });
const toAward = (r: AwardDbRow): AwardRecord => ({ ...(r.data as Omit<AwardRecord, "id" | "publicId" | "status" | "createdAt">), id: r.id, publicId: r.publicId, status: r.status as AwardRecord["status"], createdAt: r.createdAt.toISOString() });
const body = (a: Omit<AwardRecord, "id" | "createdAt">) => {
  const { publicId, status, ...rest } = a;
  void publicId;
  void status;
  return rest as unknown as Prisma.InputJsonValue;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profilesDb = () => (db() as any).certificateProfile;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const awardsDb = () => (db() as any).certificateAward;

export const postgresCertificateDesk: CertificateDeskStore = {
  async getProfile(s) {
    const r = await profilesDb().findUnique({ where: { collegeId: await collegeUuid(s.college) } });
    return r ? toProfile(r) : undefined;
  },
  async saveProfile(s, data, by) {
    const collegeId = await collegeUuid(s.college);
    const r = await profilesDb().upsert({ where: { collegeId }, create: { collegeId, data: data as Prisma.InputJsonValue, updatedBy: by }, update: { data: data as Prisma.InputJsonValue, updatedBy: by, updatedAt: new Date() } });
    return toProfile(r);
  },
  async listAwards() {
    const rows = await awardsDb().findMany({ orderBy: { createdAt: "desc" }, take: 2000 });
    return rows.map((r: AwardDbRow) => toAward(r));
  },
  async getAward(_s, id) {
    if (!isUuid(id)) return undefined;
    const r = await awardsDb().findUnique({ where: { id } });
    return r ? toAward(r) : undefined;
  },
  async createAward(s, rec) {
    const r = await awardsDb().create({ data: { collegeId: await collegeUuid(s.college), publicId: rec.publicId, recipientSub: rec.recipientSub, status: rec.status, data: body(rec) } });
    return toAward(r);
  },
  async updateAward(_s, rec) {
    if (!isUuid(rec.id)) return undefined;
    const old = await awardsDb().findUnique({ where: { id: rec.id } });
    if (!old) return undefined;
    const r = await awardsDb().update({ where: { id: rec.id }, data: { publicId: rec.publicId, recipientSub: rec.recipientSub, status: rec.status, data: body(rec), updatedAt: new Date() } });
    return toAward(r);
  },
  async findByPublicId(publicId) {
    const r = await awardsDb().findUnique({ where: { publicId } });
    return r ? toAward(r) : undefined;
  },
  async profileOf(collegeId) {
    const r = await profilesDb().findUnique({ where: { collegeId: await collegeUuid(collegeId) } });
    return r ? toProfile(r) : undefined;
  },
};
