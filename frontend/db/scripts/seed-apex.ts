import { existsSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  const password = process.env.DEV_PASSWORD || "Dev-6WQsYmZ2";
  const db = new PrismaClient();

  try {
    const university = await db.university.findFirst();
    if (!university) throw new Error("No university found in database.");

    // 1. Create or update College
    let college = await db.college.findFirst({
      where: { name: "Apex Institute of Science & Technology" },
    });

    if (!college) {
      college = await db.college.create({
        data: {
          universityId: university.id,
          name: "Apex Institute of Science & Technology",
          code: "2418",
          type: "Engineering",
          city: "Coimbatore",
          established: 2012,
          studentCapacity: 2400,
          principal: "SARAVANAN-PRIN",
          email: "office@aist.edu.in",
          phone: "9840123456",
          plan: "Campus_Pro",
          status: "Active",
          admissionsOpen: true,
        },
      });
      console.log(`Created College: ${college.name} (${college.publicId})`);
    } else {
      await db.college.update({
        where: { id: college.id },
        data: { principal: "SARAVANAN-PRIN" },
      });
      console.log(`Updated College Principal to SARAVANAN-PRIN for ${college.name}`);
    }

    // 2. Create Website entry if missing
    const existingSite = await db.collegeWebsite.findUnique({
      where: { collegeId: college.id },
    });

    if (!existingSite) {
      await db.collegeWebsite.create({
        data: {
          collegeId: college.id,
          tagline: "Empowering Next-Gen Engineers & Innovators",
          heroBuiltin: "/campus/quad.svg",
          announcement: "Admissions for 2026–27 are open.",
          about: "Apex Institute of Science & Technology is a premier engineering institution known for academic excellence and industry collaboration.",
          principalMessage: "Welcome to Apex Institute. We prepare leaders for tomorrow's technology landscape.",
          highlights: "NAAC A+ Accredited\nTop 10 NIRF Ranked\n100% Placement Record",
          address: "Avinashi Road, Civil Aerodrome Post, Coimbatore, Tamil Nadu 641014",
          phone: "9840123456",
          email: "office@aist.edu.in",
          officeHours: "Mon-Fri: 8:30 AM - 5:00 PM",
          showEvents: true,
          showGallery: true,
        },
      });
      console.log("Created College Website profile.");
    }

    // 3. Create / Update Users
    const passwordHash = await hash(password, ARGON2);

    const userAccounts = [
      {
        email: "principal@aist.edu.in",
        fullName: "SARAVANAN-PRIN",
        role: "institution" as const,
      },
      {
        email: "hod@aist.edu.in",
        fullName: "SARO-HOD",
        role: "hod" as const,
      },
      {
        email: "faculty@aist.edu.in",
        fullName: "MEENU-FAC",
        role: "faculty" as const,
      },
      {
        email: "student1@aist.edu.in",
        fullName: "KUMAR-STU",
        role: "student" as const,
      },
    ];

    for (const acc of userAccounts) {
      let user = await db.user.findFirst({
        where: { email: acc.email },
      });

      if (!user) {
        user = await db.user.create({
          data: {
            universityId: university.id,
            email: acc.email,
            fullName: acc.fullName,
            status: "Active",
          },
        });
        console.log(`Created User: ${user.email} (${acc.fullName})`);
      } else {
        await db.user.update({
          where: { id: user.id },
          data: { fullName: acc.fullName },
        });
        console.log(`Updated User: ${user.email} (${acc.fullName})`);
      }

      // Upsert Role Assignment
      const existingRole = await db.roleAssignment.findFirst({
        where: {
          userId: user.id,
          role: acc.role,
          collegeId: college.id,
        },
      });

      if (!existingRole) {
        await db.roleAssignment.create({
          data: {
            userId: user.id,
            role: acc.role,
            collegeId: college.id,
          },
        });
        console.log(`Assigned role ${acc.role} to ${user.email}`);
      }

      // Set Password Credentials
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
    }

    console.log("\n✅ Successfully seeded Apex Institute of Science & Technology into PostgreSQL!");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error seeding Apex College:", e);
  process.exit(1);
});
