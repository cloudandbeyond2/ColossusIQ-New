import "server-only";
import type { CensusRow, DeptRow, HospitalData, ProfileRow } from "@/lib/api/mock/hospital-data";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Teaching hospital on PostgreSQL: hospital_departments, hospital_census, hospital_profile
 * (prisma/migrations/20261028000000_teaching_hospital). Row-level security keeps each college to its own rows.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const DEPT = `id, college_id as "collegeId", name, category, hod, teaching_beds as "teachingBeds", icu_beds as "icuBeds",
  cbme_target_cases::float8 as "cbmeTargetCases", units`;
const CENSUS = `id, college_id as "collegeId", department_id::text as "departmentId", occupied_beds as "occupiedBeds",
  icu_occupied as "icuOccupied", opd, ipd_admissions as "ipdAdmissions", discharges, surgeries, deliveries,
  cases_per_student::float8 as "casesPerStudent", notes, actor, actor_sub as "actorSub", created_at as "createdAt"`;

async function toDept(r: Raw): Promise<DeptRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    name: r.name,
    category: r.category,
    hod: r.hod,
    teachingBeds: Number(r.teachingBeds),
    icuBeds: Number(r.icuBeds),
    cbmeTargetCases: Number(r.cbmeTargetCases),
    units: typeof r.units === "string" ? JSON.parse(r.units) : (r.units ?? []),
  };
}

async function toCensus(r: Raw): Promise<CensusRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    departmentId: r.departmentId,
    occupiedBeds: Number(r.occupiedBeds),
    icuOccupied: Number(r.icuOccupied),
    opd: Number(r.opd),
    ipdAdmissions: Number(r.ipdAdmissions),
    discharges: Number(r.discharges),
    surgeries: Number(r.surgeries),
    deliveries: Number(r.deliveries),
    casesPerStudent: r.casesPerStudent === null ? null : Number(r.casesPerStudent),
    notes: r.notes,
    actor: r.actor,
    actorSub: r.actorSub,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  };
}

const COLUMN: Record<string, string> = {
  name: "name",
  category: "category",
  hod: "hod",
  teachingBeds: "teaching_beds",
  icuBeds: "icu_beds",
  cbmeTargetCases: "cbme_target_cases",
};

async function deptById(id: string): Promise<DeptRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${DEPT} FROM hospital_departments WHERE id = $1::uuid;`, id);
  return rows[0] ? toDept(rows[0]) : undefined;
}

export const postgresHospital: HospitalData = {
  async departments(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${DEPT} FROM hospital_departments WHERE college_id = $1::uuid ORDER BY name ASC LIMIT 500;`, id)).map(toDept));
  },
  department: deptById,
  async createDepartment(d) {
    const cid = await collegeUuid(d.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO hospital_departments (college_id, name, category, hod, teaching_beds, icu_beds, cbme_target_cases, units)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT DO NOTHING RETURNING id;`,
      cid, d.name, d.category, d.hod, d.teachingBeds, d.icuBeds, d.cbmeTargetCases, JSON.stringify(d.units),
    );
    return rows[0] ? deptById(rows[0].id) : undefined;
  },
  async updateDepartment(id, patch) {
    const current = await deptById(id);
    if (!current) return undefined;
    const sets: string[] = [];
    const args: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (k === "units") {
        args.push(JSON.stringify(v));
        sets.push(`units = $${args.length}::jsonb`);
        continue;
      }
      const col = COLUMN[k];
      if (!col) continue;
      args.push(v);
      sets.push(`${col} = $${args.length}`);
    }
    if (sets.length === 0) return current;
    try {
      await q(`UPDATE hospital_departments SET ${sets.join(", ")}, updated_at = now() WHERE id = $1::uuid;`, ...args);
    } catch (e) {
      if (String(e).includes("hospital_departments_name_key")) return "duplicate";
      throw e;
    }
    return deptById(id);
  },
  async removeDepartment(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM hospital_departments WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async addCensus(c) {
    const cid = await collegeUuid(c.college);
    if (!cid) throw new Error("College not found.");
    const rows = await q<Raw>(
      `INSERT INTO hospital_census (college_id, department_id, occupied_beds, icu_occupied, opd, ipd_admissions, discharges, surgeries, deliveries, cases_per_student, notes, actor, actor_sub, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, clock_timestamp()) RETURNING ${CENSUS};`,
      cid, c.departmentId, c.occupiedBeds, c.icuOccupied, c.opd, c.ipdAdmissions, c.discharges, c.surgeries, c.deliveries, c.casesPerStudent, c.notes, c.actor, c.actorSub,
    );
    return toCensus(rows[0]!);
  },
  async census(college, sinceIso) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all(
      (await q<Raw>(`SELECT ${CENSUS} FROM hospital_census WHERE college_id = $1::uuid AND created_at >= $2::timestamptz ORDER BY created_at DESC LIMIT 5000;`, cid, sinceIso)).map(toCensus),
    );
  },
  async latestCensus(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all(
      (await q<Raw>(`SELECT DISTINCT ON (department_id) ${CENSUS} FROM hospital_census WHERE college_id = $1::uuid ORDER BY department_id, created_at DESC;`, cid)).map(toCensus),
    );
  },
  async profile(college) {
    const empty: ProfileRow = { hospitalName: "", labTestsDaily: null, bloodWholeUnits: null, bloodComponentUnits: null, bloodBankLicensed: false };
    const cid = await collegeUuid(college);
    if (!cid) return empty;
    const rows = await q<Raw>(
      `SELECT hospital_name as "hospitalName", lab_tests_daily as "labTestsDaily", blood_whole_units as "bloodWholeUnits",
              blood_component_units as "bloodComponentUnits", blood_bank_licensed as "bloodBankLicensed"
       FROM hospital_profile WHERE college_id = $1::uuid;`,
      cid,
    );
    const r = rows[0];
    if (!r) return empty;
    return {
      hospitalName: r.hospitalName,
      labTestsDaily: r.labTestsDaily === null ? null : Number(r.labTestsDaily),
      bloodWholeUnits: r.bloodWholeUnits === null ? null : Number(r.bloodWholeUnits),
      bloodComponentUnits: r.bloodComponentUnits === null ? null : Number(r.bloodComponentUnits),
      bloodBankLicensed: r.bloodBankLicensed,
    };
  },
  async saveProfile(college, p) {
    const cid = await collegeUuid(college);
    if (!cid) throw new Error("College not found.");
    await q(
      `INSERT INTO hospital_profile (college_id, hospital_name, lab_tests_daily, blood_whole_units, blood_component_units, blood_bank_licensed)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (college_id) DO UPDATE SET hospital_name = EXCLUDED.hospital_name, lab_tests_daily = EXCLUDED.lab_tests_daily,
         blood_whole_units = EXCLUDED.blood_whole_units, blood_component_units = EXCLUDED.blood_component_units,
         blood_bank_licensed = EXCLUDED.blood_bank_licensed, updated_at = now();`,
      cid, p.hospitalName, p.labTestsDaily, p.bloodWholeUnits, p.bloodComponentUnits, p.bloodBankLicensed,
    );
    return p;
  },
};
