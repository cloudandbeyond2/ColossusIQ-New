import "server-only";
import { createHash } from "node:crypto";
import type { AuditStore, MediaStore, Site, SiteStore } from "../store";
import { db } from "./db";
import { enumValue, label } from "./enums";
import { collegeByPublic, collegePublic, imageRef, refOf, text, userOrNull } from "./lookups";

/* College websites, uploaded media and the audit log. */

export const pgSites: SiteStore = {
  async get(collegeId) {
    const c = await collegeByPublic(collegeId);
    if (!c) return undefined;
    const r = await db().collegeWebsite.findUnique({ where: { collegeId: c.id }, include: { heroMedia: { select: { publicId: true } } } });
    if (!r) return undefined;
    return {
      tagline: r.tagline,
      heroImage: refOf(r.heroMedia, r.heroBuiltin),
      announcement: r.announcement ?? "",
      about: r.about,
      principalMessage: r.principalMessage ?? "",
      highlights: r.highlights ?? "",
      address: r.address,
      phone: r.phone,
      email: r.email,
      officeHours: r.officeHours ?? "",
      showEvents: r.showEvents,
      showGallery: r.showGallery,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
    } satisfies Site;
  },
  async save(collegeId, site) {
    const c = await collegeByPublic(collegeId);
    if (!c) throw new Error(`Unknown college ${collegeId}`);
    const img = await imageRef(site.heroImage);
    const cols = {
      tagline: String(site.tagline),
      heroMediaId: img.mediaId,
      heroBuiltin: img.builtin,
      announcement: text(site.announcement),
      about: String(site.about),
      principalMessage: text(site.principalMessage),
      highlights: text(site.highlights),
      address: String(site.address),
      phone: String(site.phone),
      email: String(site.email),
      officeHours: text(site.officeHours),
      showEvents: site.showEvents !== false,
      showGallery: site.showGallery !== false,
      version: site.version,
    };
    await db().collegeWebsite.upsert({ where: { collegeId: c.id }, create: { ...cols, collegeId: c.id }, update: cols });
    return (await this.get(collegeId))!;
  },
};

export const pgMedia: MediaStore = {
  async save(item) {
    const college = item.collegeId ? await collegeByPublic(item.collegeId) : undefined;
    const row = await db().mediaAsset.create({
      data: {
        collegeId: college?.id ?? null,
        contentType: enumValue("MediaType", item.contentType) as never,
        byteSize: item.bytes.byteLength,
        sha256: createHash("sha256").update(item.bytes).digest(),
        data: Buffer.from(item.bytes),
        uploadedBy: userOrNull(item.uploadedBy),
      },
      select: { publicId: true },
    });
    return row.publicId;
  },
  async get(id) {
    const r = await db().mediaAsset.findUnique({ where: { publicId: id } });
    if (!r || !r.data) return undefined;
    return {
      id: r.publicId,
      contentType: label("MediaType", r.contentType) as "image/png" | "image/jpeg" | "image/webp",
      bytes: new Uint8Array(r.data),
      collegeId: (await collegePublic(r.collegeId)) || null,
      uploadedBy: r.uploadedBy ?? "",
      createdAt: r.createdAt.toISOString(),
    };
  },
};

export const pgAudit: AuditStore = {
  async add({ actor, action, target, collegeId, actorSub }) {
    const college = collegeId ? await collegeByPublic(collegeId) : undefined;
    await db().auditLog.create({
      data: {
        collegeId: college?.id ?? null,
        actorUserId: userOrNull(actorSub),
        actorName: actor.slice(0, 120),
        action: action.slice(0, 160),
        targetId: target.slice(0, 80),
      },
    });
  },
  async recent(limit, scope) {
    const college = scope && scope !== "all" ? await collegeByPublic(scope) : undefined;
    const rows = await db().auditLog.findMany({ where: college ? { collegeId: college.id } : {}, orderBy: { at: "desc" }, take: limit });
    return rows.map((r) => ({ at: r.at.toISOString(), actor: r.actorName, action: r.action, target: r.targetId ?? "", collegeId: scope }));
  },
};
