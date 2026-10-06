import "server-only";
import type { DriveRow, DriveStore } from "@/lib/api/mock/drive-store";
import type { DriveBody } from "@/lib/api/drive-schemas";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Placement drives on PostgreSQL: `placement_drives` (db/migrations/0011_placement_drives.sql). Row-level security limits
 * every query to the signed-in college.
 */

interface Row {
  id: string;
  company: string;
  roleTitle: string;
  driveType: string;
  driveDate: string;
  driveTime: string;
  venue: string;
  packageMin: number;
  packageMax: number;
  openings: number;
  departments: string[];
  minReadiness: number;
  deadline: string;
  description: string;
  rounds: string[];
  status: string;
  registered: number;
  shortlisted: number;
  offers: number;
  createdAt: Date;
  updatedAt: Date;
}

const toRow = (r: Row): DriveRow => ({
  id: r.id,
  company: r.company,
  role: r.roleTitle,
  type: r.driveType as DriveRow["type"],
  date: r.driveDate,
  time: r.driveTime,
  venue: r.venue,
  packageMin: r.packageMin,
  packageMax: r.packageMax,
  openings: r.openings,
  departments: r.departments,
  minReadiness: r.minReadiness,
  deadline: r.deadline,
  description: r.description,
  rounds: r.rounds,
  status: r.status as DriveRow["status"],
  registered: r.registered,
  shortlisted: r.shortlisted,
  offers: r.offers,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const data = (b: DriveBody) => ({
  company: b.company,
  roleTitle: b.role,
  driveType: b.type,
  driveDate: b.date,
  driveTime: b.time,
  venue: b.venue,
  packageMin: b.packageMin,
  packageMax: b.packageMax,
  openings: b.openings,
  departments: b.departments,
  minReadiness: b.minReadiness,
  deadline: b.deadline,
  description: b.description,
  rounds: b.rounds,
  status: b.status,
  registered: b.registered,
  shortlisted: b.shortlisted,
  offers: b.offers,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drivesDb = () => (db() as any).placementDrive;

export const postgresDrives: DriveStore = {
  async list() {
    const rows = await drivesDb().findMany({ orderBy: [{ driveDate: "asc" }, { company: "asc" }] });
    return rows.map((r: Row) => toRow(r));
  },
  async get(_s, id) {
    if (!isUuid(id)) return undefined;
    const r = await drivesDb().findUnique({ where: { id } });
    return r ? toRow(r) : undefined;
  },
  async create(s, b) {
    const r = await drivesDb().create({ data: { collegeId: await collegeUuid(s.college), ...data(b) } });
    return toRow(r);
  },
  async update(_s, id, b) {
    if (!isUuid(id)) return undefined;
    const old = await drivesDb().findUnique({ where: { id } });
    if (!old) return undefined;
    const r = await drivesDb().update({ where: { id }, data: { ...data(b), updatedAt: new Date() } });
    return toRow(r);
  },
  async remove(_s, id) {
    if (!isUuid(id)) return false;
    const r = await drivesDb().deleteMany({ where: { id } });
    return r.count > 0;
  },
};
