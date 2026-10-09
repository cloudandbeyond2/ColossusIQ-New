/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Test data for Student Fees (/institution/student-fees, /student/fee-payment, /admin/billing), written straight
 * into PostgreSQL so every page reads it through the normal API.
 *
 *   npm run db:seed-fees            add the data (safe to run again; nothing is duplicated)
 *   npm run db:seed-fees -- --remove  delete exactly what this script added
 *
 * What it adds, for COL-1001 (Anna Institute of Technology):
 *   - the University's billing settings for 2026-27, only if the University has not set them up yet
 *     (automatic locking stays OFF, so no account is ever locked by this data);
 *   - 14 test students (marked "fee-seed test data", @fees-seed.test addresses, no password, so nobody can sign in);
 *   - their fees: paid online, paid offline and approved, waived, awaiting verification, a failed attempt then a
 *     success, a rejected offline payment, and some still due.
 * The three real students of the college are not touched. Payment ids are marked TEST so they are never mistaken
 * for real gateway payments.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
const q = async (sql: string, ...args: unknown[]) => (await prisma.$queryRawUnsafe(sql, ...args)) as any[];

const COLLEGE = "COL-1001";
const YEAR = "2026-27";
const TAG = "fee-seed test data";
const DOMAIN = "fees-seed.test";

type Plan =
  | { kind: "online"; gateway: "razorpay" | "payu" | "ccavenue"; daysAgo: number; failedFirst?: boolean }
  | { kind: "offline"; mode: string; ref: string; daysAgo: number; outcome: "Paid" | "Pending verification" | "Rejected"; note?: string }
  | { kind: "waived"; note: string }
  | { kind: "due"; opened: boolean };

const STUDENTS: Array<{ name: string; plan: Plan }> = [
  { name: "Aarthi Subramanian", plan: { kind: "online", gateway: "razorpay", daysAgo: 21 } },
  { name: "Karthik Rajan", plan: { kind: "online", gateway: "razorpay", daysAgo: 18 } },
  { name: "Divya Lakshmi", plan: { kind: "online", gateway: "payu", daysAgo: 12 } },
  { name: "Mohammed Irfan", plan: { kind: "online", gateway: "razorpay", daysAgo: 9, failedFirst: true } },
  { name: "Priya Dharshini", plan: { kind: "online", gateway: "ccavenue", daysAgo: 5 } },
  { name: "Suresh Babu", plan: { kind: "offline", mode: "Cash", ref: "Office receipt 4471", daysAgo: 15, outcome: "Paid", note: "Verified against the office cash book." } },
  { name: "Nandhini Velu", plan: { kind: "offline", mode: "UPI (direct)", ref: "UPI 4021 8890 3312", daysAgo: 7, outcome: "Paid", note: "Matches the college UPI statement." } },
  { name: "Vignesh Kumar", plan: { kind: "offline", mode: "NEFT / RTGS", ref: "NEFT-26280-118842", daysAgo: 1, outcome: "Pending verification" } },
  { name: "Harini Raghavan", plan: { kind: "offline", mode: "Demand draft", ref: "DD 552318", daysAgo: 3, outcome: "Pending verification" } },
  { name: "Ganesh Perumal", plan: { kind: "offline", mode: "Cheque", ref: "Cheque 009913", daysAgo: 11, outcome: "Rejected", note: "Cheque number does not match the bank slip. Please resubmit." } },
  { name: "Thenmozhi Annamalai", plan: { kind: "waived", note: "Merit scholarship: fee waived by the University." } },
  { name: "Arjun Balasubramanian", plan: { kind: "waived", note: "Fee waiver approved on a financial-hardship request." } },
  { name: "Meenakshi Sundaram", plan: { kind: "due", opened: true } },
  { name: "Rohit Chandrasekar", plan: { kind: "due", opened: false } },
];

const emailOf = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@${DOMAIN}`;
const hex20 = (seed: string) => createHash("sha1").update(`fees-seed:${seed}`).digest("hex").slice(0, 20);
const ago = (days: number, hour = 11) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 15, 0, 0);
  return d;
};

async function remove() {
  const users = await q(`SELECT id::text AS id FROM users WHERE email::text LIKE $1 AND notes = $2`, `%@${DOMAIN}`, TAG);
  const subs = users.map((u) => u.id);
  if (subs.length) {
    const p = await q(`DELETE FROM fee_payments WHERE user_sub = ANY($1::text[]) RETURNING id`, subs);
    const d = await q(`DELETE FROM student_dues WHERE user_sub = ANY($1::text[]) RETURNING user_sub`, subs);
    const u = await q(`DELETE FROM users WHERE id = ANY($1::uuid[]) RETURNING id`, subs);
    console.log(`Removed ${p.length} payments, ${d.length} dues and ${u.length} test students.`);
  } else console.log("No test students found.");
  const s = await q(`DELETE FROM billing_settings WHERE updated_by LIKE 'Seed (test data)%' RETURNING id`);
  if (s.length) console.log("Removed the seeded billing settings.");
}

async function add() {
  const col = (await q(`SELECT id::text AS id, university_id::text AS university_id FROM colleges WHERE public_id = $1`, COLLEGE))[0];
  if (!col) throw new Error(`${COLLEGE} not found. Run the migrations and base seed first.`);

  // 1. Billing settings (the University's), only when nothing has been configured yet.
  const hasSettings = (await q(`SELECT 1 FROM billing_settings WHERE id = 1`)).length > 0;
  if (!hasSettings) {
    await q(
      `INSERT INTO billing_settings (id, academic_year, year_start, due_date, grace_days, reminder_days, currency, auto_lock, lock_staff, fees, updated_by)
       VALUES (1, $1, '2026-06-01', '2026-10-31', 15, 15, 'INR', false, false, $2::jsonb, 'Seed (test data)')`,
      YEAR,
      JSON.stringify({ "Campus Starter": 500, "Campus Pro": 1000, "University Enterprise": 1500 }),
    );
    console.log(`Opened fee collection for ${YEAR} (due 31 Oct 2026, locking off).`);
  } else {
    console.log("Billing settings already exist, left as they are.");
  }
  const s = (await q(`SELECT academic_year, currency, fees FROM billing_settings WHERE id = 1`))[0];
  const year: string = s.academic_year;
  const currency: string = s.currency;

  // 2. This college's fee: its own override, else its plan's fee.
  const override = (await q(`SELECT fee_override FROM college_billing WHERE college_id = $1::uuid AND academic_year = $2`, col.id, year))[0]?.fee_override;
  let plan = "Campus Pro";
  try {
    plan = (await q(`SELECT plan FROM colleges WHERE id = $1::uuid`, col.id))[0]?.plan ?? plan;
  } catch {
    /* no plan column: use the default plan */
  }
  const fee = override !== null && override !== undefined ? Number(override) : Number(s.fees?.[plan] ?? s.fees?.["Campus Pro"] ?? 1000);

  // 3. Test students: copy the account status and role binding of a real student of the college.
  const sample = (await q(`SELECT u.status::text AS status FROM role_assignments ra JOIN users u ON u.id = ra.user_id WHERE ra.role = 'student' AND ra.college_id = $1::uuid LIMIT 1`, col.id))[0];
  let made = 0;
  let money = 0;
  for (const st of STUDENTS) {
    const email = emailOf(st.name);
    await q(
      `INSERT INTO users (university_id, email, full_name, status, mfa_required, notes)
       VALUES ($1::uuid, $2, $3, $4::user_status, false, $5) ON CONFLICT (email) DO NOTHING`,
      col.university_id,
      email,
      st.name,
      sample?.status ?? "Active",
      TAG,
    );
    const u = (await q(`SELECT id::text AS id FROM users WHERE email = $1`, email))[0];
    await q(`INSERT INTO role_assignments (user_id, role, college_id) VALUES ($1::uuid, 'student', $2::uuid) ON CONFLICT DO NOTHING`, u.id, col.id);
    made += 1;

    const p = st.plan;
    const base = { sub: u.id, name: st.name };
    const due = (status: string, method: string, by: string, at: Date | null) =>
      q(
        `INSERT INTO student_dues (user_sub, academic_year, college_id, student_name, amount, status, method, cleared_by, cleared_at, created_at)
         VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (user_sub, academic_year) DO NOTHING`,
        base.sub, year, col.id, base.name, fee, status, method, by, at, at ?? ago(20),
      );
    const pay = async (tag: string, v: { gateway: string; status: string; at: Date; orderId?: string; payId?: string; mode?: string; ref?: string; reviewedBy?: string; note?: string }) => {
      const id = `PAY-${hex20(`${email}:${tag}`)}`;
      const receipt = v.status === "Paid" ? `CIQ/${year}/${id.slice(4, 14).toUpperCase()}` : "";
      await q(
        `INSERT INTO fee_payments (id, receipt_no, user_sub, student_name, college_id, academic_year, amount, currency, gateway, gateway_order_id, gateway_payment_id, status, offline_mode, offline_ref, reviewed_by, review_note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17) ON CONFLICT (id) DO NOTHING`,
        id, receipt, base.sub, base.name, col.id, year, fee, currency, v.gateway, v.orderId ?? "", v.payId ?? "", v.status, v.mode ?? "", v.ref ?? "", v.reviewedBy ?? "", v.note ?? "", v.at,
      );
    };

    if (p.kind === "online") {
      const at = ago(p.daysAgo);
      if (p.failedFirst) await pay("failed", { gateway: p.gateway, status: "Failed", at: new Date(at.getTime() - 40 * 60_000), orderId: `order_TEST_${hex20(`${email}:fo`).slice(0, 14)}`, note: "Test data: gateway declined the first attempt." });
      await pay("paid", { gateway: p.gateway, status: "Paid", at, orderId: `order_TEST_${hex20(`${email}:o`).slice(0, 14)}`, payId: `pay_TEST_${hex20(`${email}:p`).slice(0, 14)}` });
      await due("Paid", "online", "gateway", at);
      money += fee;
    } else if (p.kind === "offline") {
      const at = ago(p.daysAgo, 14);
      const reviewed = p.outcome === "Pending verification" ? {} : { reviewedBy: "University Super Admin", note: p.note ?? "" };
      await pay("offline", { gateway: "offline", status: p.outcome, at, mode: p.mode, ref: p.ref, ...reviewed });
      if (p.outcome === "Paid") {
        await due("Paid", "offline", "University Super Admin", new Date(at.getTime() + 26 * 3_600_000));
        money += fee;
      } else await due("Due", "", "", null);
    } else if (p.kind === "waived") {
      await due("Waived", "waiver", "University Super Admin", ago(14, 10));
    } else if (p.opened) {
      await due("Due", "", "", null);
    }
  }
  const totals = (await q(`SELECT status, count(*)::int AS n FROM student_dues WHERE college_id = $1::uuid AND academic_year = $2 GROUP BY status ORDER BY status`, col.id, year));
  console.log(`Test students ensured: ${made}. Fee per student: ${fee} ${currency}. Test collections: ${money} ${currency}.`);
  console.log("Dues now on file for the college:", totals.map((t) => `${t.status} ${t.n}`).join(", "));
}

async function main() {
  try {
    if (process.argv.includes("--remove")) await remove();
    else await add();
  } catch (e: any) {
    console.error("Database error:", e.message ?? e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
void main();
