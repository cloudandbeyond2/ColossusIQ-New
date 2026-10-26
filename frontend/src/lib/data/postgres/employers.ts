import "server-only";
import type { EmployerRow, EmployerStore } from "@/lib/api/mock/employer-store";
import type { EmployerBody } from "@/lib/api/employer-schemas";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Placement employers on PostgreSQL (prisma/migrations/20261103000000_placement_employers). Row-level security keeps
 * each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();

const COLS = `id, college_id as "collegeId", company, sector, tier, website, location, contact_name as "contactName",
  contact_designation as "contactDesignation", contact_email as "contactEmail", contact_phone as "contactPhone",
  contact_linkedin as "contactLinkedin", mou_status as "mouStatus", mou_valid_until as "mouValidUntil",
  total_hires as "totalHires", average_package as "averagePackage", highest_package as "highestPackage",
  last_drive_date as "lastDriveDate", next_drive_date as "nextDriveDate", notes,
  created_at as "createdAt", updated_at as "updatedAt"`;

async function toRow(r: Raw): Promise<EmployerRow> {
  return {
    id: r.id,
    collegeId: await collegePublic(r.collegeId),
    company: r.company,
    sector: r.sector,
    tier: r.tier,
    website: r.website,
    location: r.location,
    contactName: r.contactName,
    contactDesignation: r.contactDesignation,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    contactLinkedin: r.contactLinkedin,
    mouStatus: r.mouStatus,
    mouValidUntil: r.mouValidUntil,
    totalHires: Number(r.totalHires),
    averagePackage: Number(r.averagePackage),
    highestPackage: Number(r.highestPackage),
    lastDriveDate: r.lastDriveDate,
    nextDriveDate: r.nextDriveDate,
    notes: r.notes,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

const values = (b: EmployerBody) => [
  b.company, b.sector, b.tier, b.website, b.location, b.contactName, b.contactDesignation, b.contactEmail,
  b.contactPhone, b.contactLinkedin, b.mouStatus, b.mouValidUntil, b.totalHires, b.averagePackage, b.highestPackage,
  b.lastDriveDate, b.nextDriveDate, b.notes,
];

export const postgresEmployers: EmployerStore = {
  async list(s) {
    const cid = await collegeUuid(s.college);
    if (!cid) return [];
    const rows = await q<Raw>(
      `SELECT ${COLS} FROM placement_employers WHERE college_id = $1::uuid ORDER BY total_hires DESC, company;`,
      cid
    );
    return Promise.all(rows.map(toRow));
  },
  async get(s, id) {
    if (!isUuid(id)) return undefined;
    const cid = await collegeUuid(s.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(`SELECT ${COLS} FROM placement_employers WHERE id = $1::uuid AND college_id = $2::uuid;`, id, cid);
    return rows[0] ? toRow(rows[0]) : undefined;
  },
  async create(s, b) {
    const cid = await collegeUuid(s.college);
    if (!cid) throw new Error("College not found");
    const rows = await q<Raw>(
      `INSERT INTO placement_employers (college_id, company, sector, tier, website, location, contact_name, contact_designation,
        contact_email, contact_phone, contact_linkedin, mou_status, mou_valid_until, total_hires, average_package, highest_package,
        last_drive_date, next_drive_date, notes)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::int, $15::float8, $16::float8, $17, $18, $19)
       RETURNING ${COLS};`,
      cid, ...values(b)
    );
    const row = rows[0];
    if (!row) throw new Error("Employer was not saved");
    return toRow(row);
  },
  async update(s, id, b) {
    if (!isUuid(id)) return undefined;
    const cid = await collegeUuid(s.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `UPDATE placement_employers SET company=$3, sector=$4, tier=$5, website=$6, location=$7, contact_name=$8,
        contact_designation=$9, contact_email=$10, contact_phone=$11, contact_linkedin=$12, mou_status=$13, mou_valid_until=$14,
        total_hires=$15::int, average_package=$16::float8, highest_package=$17::float8, last_drive_date=$18, next_drive_date=$19,
        notes=$20, updated_at=now()
       WHERE id = $1::uuid AND college_id = $2::uuid RETURNING ${COLS};`,
      id, cid, ...values(b)
    );
    return rows[0] ? toRow(rows[0]) : undefined;
  },
  async remove(s, id) {
    if (!isUuid(id)) return false;
    const cid = await collegeUuid(s.college);
    if (!cid) return false;
    const rows = await q<Raw>(`DELETE FROM placement_employers WHERE id = $1::uuid AND college_id = $2::uuid RETURNING id;`, id, cid);
    return rows.length > 0;
  },
};
