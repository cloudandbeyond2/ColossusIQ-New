import { existsSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  const password = process.env.DEV_PASSWORD || "Dev-6WQsYmZ2";
  const email = "incubation@ait.edu.in";
  const fullName = "Mr. Arjun Iyer";

  const db = new PrismaClient();
  try {
    // 1. Find College COL-1001 (Anna Institute of Technology)
    const college = await db.college.findFirst({
      where: { publicId: "COL-1001" },
    });
    if (!college) {
      console.error("COL-1001 (Anna Institute of Technology) not found in DB.");
      return;
    }
    console.log(`Found college: ${college.name} (${college.publicId})`);

    // 2. Find or Create User
    let user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          universityId: college.universityId,
          email,
          fullName,
          status: "Active",
          mfaRequired: false,
        },
      });
      console.log(`Created user: ${user.fullName} (${user.email})`);
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          status: "Active",
          fullName,
        },
      });
      console.log(`Updated existing user: ${user.fullName} (${user.email})`);
    }

    // 3. Set password credential
    const passwordHash = await hash(password, ARGON2);
    await db.userCredential.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        passwordHash,
        failedAttempts: 0,
      },
      update: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`Password credential set for ${email}.`);

    // 4. Role Assignment: incubation role for COL-1001
    const existingRole = await db.roleAssignment.findFirst({
      where: {
        userId: user.id,
        role: "incubation",
        collegeId: college.id,
      },
    });

    if (!existingRole) {
      await db.roleAssignment.create({
        data: {
          userId: user.id,
          role: "incubation",
          collegeId: college.id,
        },
      });
      console.log(`Assigned role 'incubation' for ${college.name}.`);
    } else {
      console.log(`Role 'incubation' already assigned for ${college.name}.`);
    }

    // 5. Staff entry (Innovation & Incubation Cell Head)
    const existingStaff = await db.staff.findFirst({
      where: { userId: user.id },
    });

    const desig = (await db.designation.findFirst({
      where: { streamKey: "engineering", name: { contains: "Professor", mode: "insensitive" } },
    })) ?? (await db.designation.findFirst({ where: { streamKey: "engineering" } }));

    const collegeDept = await db.collegeDepartment.findFirst({
      where: { collegeId: college.id },
    });
    const deptId = collegeDept?.departmentId ?? (await db.department.findFirst({ where: { streamKey: "engineering" } }))?.id ?? 1;

    if (!existingStaff) {
      await db.staff.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          fullName,
          email: "staff.incubation@ait.edu.in",
          phone: "9840192834",
          qualification: "M.Tech, Ph.D",
          departmentId: deptId,
          designationId: desig?.id ?? 1,
          staffType: "Administrative",
          employment: "Permanent",
          experienceYears: 12,
          joiningDate: new Date("2018-06-01"),
          status: "Active",
          platformAccess: true,
        },
      });
      console.log("Created staff profile for Incubation Head.");
    }

    console.log("\n==========================================");
    console.log("Incubation Head Login Successfully Created!");
    console.log("URL:      http://localhost:3000/login");
    console.log(`College:  ${college.name} (${college.publicId})`);
    console.log(`Role:     Incubation Head (incubation)`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("MFA Code: 246810");
    console.log("==========================================\n");
  } catch (err: any) {
    console.error("Error creating incubation login:", err.message);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
