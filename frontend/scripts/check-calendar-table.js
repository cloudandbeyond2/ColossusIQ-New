const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const collegeId = "5b0fc7c5-ecda-418e-b887-324ff1f3f1b5"; // COL-1015

  // 1. Create
  const created = await prisma.$queryRawUnsafe(`
    INSERT INTO calendar_entries (
      college_id, title, date, end_date, time_label, tag, department, venue, description, audience, source, notify, created_by_sub, created_by_name
    ) VALUES (
      $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    ) RETURNING id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
              tag, department, venue, description, audience, source, notify,
              created_by_sub as "createdBySub", created_by_name as "createdByName",
              created_at as "createdAt", updated_at as "updatedAt"
  `, collegeId, "Annual Sports Meet", "2026-11-10", "2026-11-12", "All day", "Event", "All Departments", "Main Ground", "Inter-college events", "All", "academic", true, "principal", "Principal");

  console.log("Created entry:", created[0]);

  // 2. List
  const list = await prisma.$queryRawUnsafe(`
    SELECT id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
           tag, department, venue, description, audience, source, notify,
           created_by_sub as "createdBySub", created_by_name as "createdByName",
           created_at as "createdAt", updated_at as "updatedAt"
    FROM calendar_entries
    WHERE college_id = $1::uuid
    ORDER BY date ASC, created_at ASC
    LIMIT 2000
  `, collegeId);
  console.log("List length:", list.length);

  // 3. Update
  const updated = await prisma.$queryRawUnsafe(`
    UPDATE calendar_entries
    SET title = $2, venue = $3, updated_at = now()
    WHERE id = $1::uuid
    RETURNING id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
              tag, department, venue, description, audience, source, notify,
              created_by_sub as "createdBySub", created_by_name as "createdByName",
              created_at as "createdAt", updated_at as "updatedAt"
  `, created[0].id, "Annual Sports Meet (Updated)", "Indoor Stadium");
  console.log("Updated entry:", updated[0]);

  // 4. Remove
  const removedCount = await prisma.$executeRawUnsafe(`DELETE FROM calendar_entries WHERE id = $1::uuid`, created[0].id);
  console.log("Removed count:", removedCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
