import "server-only";
import { EMPTY_PROFILE, type ActionRow, type CommitteeRow, type DepartmentNorm, type NmcData } from "@/lib/api/mock/nmc-data";
import type { NmcProfile } from "@/lib/api/nmc-schemas";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * NMC compliance records on PostgreSQL (prisma/migrations/20261031000000_nmc_compliance): nmc_profile, nmc_committees,
 * nmc_actions and nmc_department_norms. Row-level security keeps each college to its own rows. Plain SQL.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const COMMITTEE = `c.id, c.college_id as "collegeId", c.name, c.mandate, c.chairperson, c.convener, c.members_count as "membersCount",
  c.meeting_frequency as "meetingFrequency", c.last_meeting_date as "lastMeetingDate", c.status, c.mom_uploaded as "momUploaded", c.notes`;
const ACTION = `a.id, a.college_id as "collegeId", a.title, a.category, a.priority, a.status, a.assignee, a.due_date as "dueDate", a.notes, a.resolved_at as "resolvedAt"`;

const toCommittee = async (r: Raw): Promise<CommitteeRow> => ({
  id: r.id, college: await collegePublic(r.collegeId), name: r.name, mandate: r.mandate, chairperson: r.chairperson, convener: r.convener,
  membersCount: Number(r.membersCount), meetingFrequency: r.meetingFrequency, lastMeetingDate: r.lastMeetingDate, status: r.status,
  momUploaded: Boolean(r.momUploaded), notes: r.notes,
});
const toAction = async (r: Raw): Promise<ActionRow> => ({
  id: r.id, college: await collegePublic(r.collegeId), title: r.title, category: r.category, priority: r.priority, status: r.status,
  assignee: r.assignee, dueDate: r.dueDate, notes: r.notes, resolvedAt: r.resolvedAt ?? undefined,
});

const COMMITTEE_COLUMN: Record<string, string> = {
  chairperson: "chairperson", convener: "convener", membersCount: "members_count", meetingFrequency: "meeting_frequency",
  lastMeetingDate: "last_meeting_date", status: "status", momUploaded: "mom_uploaded", notes: "notes",
};
const PROFILE_COLUMN: Record<keyof NmcProfile, string> = {
  nmcCode: "nmc_code", mbbsSeats: "mbbs_seats", lopStatus: "lop_status", affiliationYear: "affiliation_year",
  cctvStreamsOnline: "cctv_online", cctvStreamsTotal: "cctv_total", aebasPortalActive: "aebas_active", meuCertified: "meu_certified",
  ethicsCommitteeRegNo: "ethics_reg_no", lastInspectionDate: "last_inspection_date", nextInspectionWindow: "next_inspection_window",
};

async function profileOf(cid: string): Promise<NmcProfile> {
  const r = (await q<Raw>(`SELECT * FROM nmc_profile WHERE college_id = $1::uuid;`, cid))[0];
  if (!r) return { ...EMPTY_PROFILE };
  return {
    nmcCode: r.nmc_code, mbbsSeats: r.mbbs_seats, lopStatus: r.lop_status, affiliationYear: r.affiliation_year,
    cctvStreamsOnline: r.cctv_online, cctvStreamsTotal: r.cctv_total, aebasPortalActive: r.aebas_active, meuCertified: r.meu_certified,
    ethicsCommitteeRegNo: r.ethics_reg_no, lastInspectionDate: r.last_inspection_date, nextInspectionWindow: r.next_inspection_window,
  };
}

async function committeeById(id: string) {
  if (!isUuid(id)) return undefined;
  const r = (await q<Raw>(`SELECT ${COMMITTEE} FROM nmc_committees c WHERE c.id = $1::uuid;`, id))[0];
  return r ? toCommittee(r) : undefined;
}
async function actionById(id: string) {
  if (!isUuid(id)) return undefined;
  const r = (await q<Raw>(`SELECT ${ACTION} FROM nmc_actions a WHERE a.id = $1::uuid;`, id))[0];
  return r ? toAction(r) : undefined;
}

export const postgresNmc: NmcData = {
  async profile(college) {
    const cid = await collegeUuid(college);
    return cid ? profileOf(cid) : { ...EMPTY_PROFILE };
  },
  async saveProfile(college, patch) {
    const cid = await collegeUuid(college);
    if (!cid) return { ...EMPTY_PROFILE };
    const merged = { ...(await profileOf(cid)), ...patch };
    const keys = Object.keys(PROFILE_COLUMN) as Array<keyof NmcProfile>;
    await q(
      `INSERT INTO nmc_profile (college_id, ${keys.map((k) => PROFILE_COLUMN[k]).join(", ")})
       VALUES ($1::uuid, ${keys.map((_, i) => `$${i + 2}`).join(", ")})
       ON CONFLICT (college_id) DO UPDATE SET ${keys.map((k) => `${PROFILE_COLUMN[k]} = EXCLUDED.${PROFILE_COLUMN[k]}`).join(", ")}, updated_at = now();`,
      cid, ...keys.map((k) => merged[k]),
    );
    return merged;
  },
  async committees(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all((await q<Raw>(`SELECT ${COMMITTEE} FROM nmc_committees c WHERE c.college_id = $1::uuid ORDER BY c.created_at, c.name;`, cid)).map(toCommittee));
  },
  committee: committeeById,
  async addCommittees(college, drafts) {
    const cid = await collegeUuid(college);
    if (!cid) return 0;
    let n = 0;
    for (const d of drafts) {
      n += (
        await q<Raw>(
          `INSERT INTO nmc_committees (college_id, name, mandate, meeting_frequency) VALUES ($1::uuid, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`,
          cid, d.name, d.mandate, d.meetingFrequency,
        )
      ).length;
    }
    return n;
  },
  async updateCommittee(id, patch) {
    if (!(await committeeById(id))) return undefined;
    const sets: string[] = [];
    const args: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      const col = COMMITTEE_COLUMN[k];
      if (!col || v === undefined) continue;
      args.push(v);
      sets.push(`${col} = $${args.length}`);
    }
    if (sets.length) await q(`UPDATE nmc_committees SET ${sets.join(", ")} WHERE id = $1::uuid;`, ...args);
    return committeeById(id);
  },
  async actions(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all((await q<Raw>(`SELECT ${ACTION} FROM nmc_actions a WHERE a.college_id = $1::uuid ORDER BY a.created_at DESC LIMIT 500;`, cid)).map(toAction));
  },
  action: actionById,
  async addAction(college, d) {
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const r = (
      await q<Raw>(
        `INSERT INTO nmc_actions (college_id, title, category, priority, assignee, due_date, notes) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7) RETURNING id;`,
        cid, d.title, d.category, d.priority, d.assignee, d.dueDate, d.notes ?? "",
      )
    )[0];
    return r ? actionById(r.id) : undefined;
  },
  async setActionStatus(id, status, notes) {
    if (!(await actionById(id))) return undefined;
    await q(
      `UPDATE nmc_actions SET status = $2, notes = COALESCE($3, notes), resolved_at = CASE WHEN $2 = 'Resolved' THEN to_char(now(), 'YYYY-MM-DD') ELSE NULL END WHERE id = $1::uuid;`,
      id, status, notes ?? null,
    );
    return actionById(id);
  },
  async removeAction(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM nmc_actions WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async norms(college) {
    const cid = await collegeUuid(college);
    const out = new Map<string, DepartmentNorm>();
    if (!cid) return out;
    for (const r of await q<Raw>(`SELECT department, required_faculty, aebas_attendance FROM nmc_department_norms WHERE college_id = $1::uuid;`, cid)) {
      out.set(r.department, { requiredFaculty: r.required_faculty === null ? null : Number(r.required_faculty), aebasAttendance: r.aebas_attendance === null ? null : Number(r.aebas_attendance) });
    }
    return out;
  },
  async setNorm(college, department, norm) {
    const cid = await collegeUuid(college);
    if (!cid) return;
    await q(
      `INSERT INTO nmc_department_norms (college_id, department, required_faculty, aebas_attendance) VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (college_id, department) DO UPDATE SET required_faculty = EXCLUDED.required_faculty, aebas_attendance = EXCLUDED.aebas_attendance, updated_at = now();`,
      cid, department, norm.requiredFaculty, norm.aebasAttendance,
    );
  },
};
