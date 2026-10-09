/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Test records for the AICTE Compliance page (/institution/aicte-compliance), written into PostgreSQL for COL-1001
 * (Anna Institute of Technology): six statutory committees in different states and a small action plan. Chairpersons
 * are the college's own teaching staff, read from the `staff` table. The AICTE permanent id is NOT filled in, because
 * it would have to be invented; enter the real one on the page.
 *
 *   npm run db:seed-aicte             add them (replaces earlier test records for the college)
 *   npm run db:seed-aicte -- --remove delete the college's AICTE records
 *
 * Run it after `npm run db:migrate` (the aicte_compliance table comes from migration 20261021000000).
 */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
const q = async (sql: string, ...args: unknown[]) => (await prisma.$queryRawUnsafe(sql, ...args)) as any[];

const COLLEGE = "COL-1001";
const BY = "Seed (test data)";

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function main() {
  const college = (await q(`SELECT id::text AS id FROM colleges WHERE public_id = $1`, COLLEGE))[0];
  if (!college) throw new Error(`College ${COLLEGE} not found. Run the base seed first.`);

  if (process.argv.includes("--remove")) {
    await q(`DELETE FROM aicte_compliance WHERE college_id = $1::uuid`, college.id);
    console.log(`Removed the AICTE records of ${COLLEGE}.`);
    return;
  }

  const staff = await q(
    `SELECT full_name FROM staff WHERE college_id = $1::uuid AND status = 'Active' AND staff_type = 'Teaching' ORDER BY joining_date, full_name LIMIT 6`,
    college.id
  );
  const names: string[] = staff.map((s) => String(s.full_name));
  const lead = (i: number) => names[i % Math.max(names.length, 1)] ?? "Principal Office";
  const now = new Date().toISOString();

  const rec = (i: number, status: string, members: number, last: string, mom: string) => ({
    status,
    chairperson: lead(i),
    membersCount: members,
    lastMeetingDate: last,
    momStatus: mom,
    updatedAt: now,
    updatedBy: BY,
  });

  const data = {
    pid: "",
    committees: {
      "COM-01": rec(0, "Constituted & Active", 7, day(-35), "Certified by Principal"),
      "COM-02": rec(1, "Constituted & Active", 6, day(-62), "Pending"),
      "COM-03": rec(0, "Constituted & Active", 6, day(-48), "Certified by Principal"),
      "COM-04": rec(2, "Pending Reconstitution", 5, day(-410), "Not Held"),
      "COM-05": rec(0, "Constituted & Active", 9, day(-21), "Certified by Principal"),
      "COM-06": rec(3, "Constituted & Active", 8, day(-90), "Certified by Principal"),
    },
    actions: [
      { id: "ACT-SEED0001", title: "Reconstitute the SC / ST Committee and hold its first meeting", category: "Statutory Committees", priority: "High", assignedTo: "Principal Office", dueDate: day(-6), status: "Open", notes: "Nominate members for the new term and circulate the notice.", createdAt: day(-30), createdBy: BY, resolvedAt: "" },
      { id: "ACT-SEED0002", title: "Get ICC meeting minutes certified", category: "Statutory Committees", priority: "Medium", assignedTo: lead(1), dueDate: day(9), status: "In Progress", notes: "Minutes of the last meeting are with the Principal for signature.", createdAt: day(-20), createdBy: BY, resolvedAt: "" },
      { id: "ACT-SEED0003", title: "Add laboratory courses for departments without a practical course", category: "Infrastructure & Labs", priority: "Medium", assignedTo: lead(2), dueDate: day(30), status: "Open", notes: "Register the lab courses in Course Management so the laboratory norm can be measured.", createdAt: day(-8), createdBy: BY, resolvedAt: "" },
      { id: "ACT-SEED0004", title: "Update the mandatory disclosure page", category: "Mandatory Disclosures", priority: "Low", assignedTo: "Principal Office", dueDate: day(-12), status: "Resolved", notes: "Profile fields and contact details verified.", createdAt: day(-40), createdBy: BY, resolvedAt: day(-15) },
    ],
  };

  await q(
    `INSERT INTO aicte_compliance (college_id, data, updated_by) VALUES ($1::uuid, $2::jsonb, $3)
     ON CONFLICT (college_id) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    college.id,
    JSON.stringify(data),
    BY
  );
  console.log(`Wrote 6 committees and ${data.actions.length} actions for ${COLLEGE}; chairpersons: ${names.join(", ") || "(no staff found, used Principal Office)"}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
