import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const prisma = new PrismaClient();

async function main() {
  try {
    const colleges: any[] = await prisma.$queryRawUnsafe(`SELECT id, public_id, name FROM colleges ORDER BY public_id ASC`);
    console.log("Found colleges in PostgreSQL:", colleges.map(c => `${c.public_id}: ${c.name} (${c.id})`));

    const existingDrives: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM placement_drives`);
    console.log("Current placement_drives count:", existingDrives[0]?.count);

    if (colleges.length === 0) {
      console.log("No colleges found in PostgreSQL. Please run migrations/seed first.");
      return;
    }

    const col1001 = colleges.find(c => c.public_id === "COL-1001") || colleges[0];
    console.log(`Seeding sample placement drives for ${col1001.name} (${col1001.public_id})...`);

    // Let's check how many drives exist for this college
    const collegeDrives: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM placement_drives WHERE college_id = $1::uuid`, col1001.id);
    console.log(`Drives for ${col1001.public_id}:`, collegeDrives[0]?.count);

    const drivesToSeed = [
      {
        company: "Google India",
        role_title: "Software Development Engineer (SDE-1)",
        drive_type: "On-campus",
        drive_date: "2026-10-25",
        drive_time: "09:30",
        venue: "Sir CV Raman Auditorium, Academic Block 1",
        package_min: 18.0,
        package_max: 32.5,
        openings: 8,
        departments: ["Computer Science & Engineering", "Artificial Intelligence & Data Science", "Information Technology"],
        min_readiness: 75,
        deadline: "2026-10-22",
        description: "Google campus recruitment drive for final year B.Tech/M.Tech students. Role involves building scalable backend services and distributed infrastructure. Criteria: Minimum 7.5 CGPA, zero active backlogs.",
        rounds: ["Online Coding Assessment", "Technical Interview - DSA", "System Design & Problem Solving", "Googliness & Leadership"],
        status: "Open",
        registered: 48,
        shortlisted: 0,
        offers: 0
      },
      {
        company: "Microsoft Corporation",
        role_title: "Cloud Solution & DevOps Engineer",
        drive_type: "On-campus",
        drive_date: "2026-11-05",
        drive_time: "10:00",
        venue: "Virtual Interview Suite & Lab 3",
        package_min: 16.0,
        package_max: 26.0,
        openings: 12,
        departments: ["Computer Science & Engineering", "Electronics & Communication", "Artificial Intelligence & Data Science"],
        min_readiness: 70,
        deadline: "2026-11-01",
        description: "Microsoft Azure Engineering campus placement drive. Ideal candidates should demonstrate proficiency in cloud fundamentals, networking, containers, and modern CI/CD automation.",
        rounds: ["Online Aptitude & Code Test", "Technical Round 1", "Technical Round 2", "Managerial Interview"],
        status: "Open",
        registered: 65,
        shortlisted: 0,
        offers: 0
      },
      {
        company: "Zoho Corporation",
        role_title: "Software Engineer",
        drive_type: "On-campus",
        drive_date: "2026-09-28",
        drive_time: "09:00",
        venue: "Main Computing Center",
        package_min: 6.5,
        package_max: 9.0,
        openings: 25,
        departments: ["Computer Science & Engineering", "Electronics & Communication", "Mechanical Engineering"],
        min_readiness: 60,
        deadline: "2026-09-24",
        description: "Comprehensive product development role. Primary focus on problem solving, C/Java proficiency, and web application architecture.",
        rounds: ["Basic Programming & Aptitude", "Advanced Programming (Data Structures)", "Technical HR", "General HR"],
        status: "Completed",
        registered: 110,
        shortlisted: 32,
        offers: 18
      },
      {
        company: "Amazon AWS",
        role_title: "Associate Cloud Support Engineer",
        drive_type: "Pool campus",
        drive_date: "2026-10-18",
        drive_time: "11:00",
        venue: "Seminar Hall B & Online Proctoring",
        package_min: 12.0,
        package_max: 18.0,
        openings: 15,
        departments: ["Computer Science & Engineering", "Electronics & Communication", "Electrical & Electronics"],
        min_readiness: 65,
        deadline: "2026-10-15",
        description: "Supporting enterprise AWS infrastructure across Linux, Networking, Database, and Storage domains. Excellent analytical thinking and troubleshooting mindset required.",
        rounds: ["Aptitude & Technical Screening", "Hands-on Troubleshooting Assessment", "Amazon Leadership Principles & Bar Raiser"],
        status: "Open",
        registered: 54,
        shortlisted: 0,
        offers: 0
      },
      {
        company: "Tata Consultancy Services (TCS)",
        role_title: "Digital Innovator & Prime Engineer",
        drive_type: "On-campus",
        drive_date: "2026-09-15",
        drive_time: "09:00",
        venue: "Auditorium & Distributed Labs",
        package_min: 7.0,
        package_max: 9.5,
        openings: 45,
        departments: ["Computer Science & Engineering", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering"],
        min_readiness: 50,
        deadline: "2026-09-10",
        description: "TCS Digital and Prime cadence hiring drive. High-performing students selected across enterprise modernization, AI, and cybersecurity initiatives.",
        rounds: ["TCS NQT Advanced Test", "Technical Interview", "Managerial & HR Evaluation"],
        status: "Completed",
        registered: 160,
        shortlisted: 58,
        offers: 28
      },
      {
        company: "L&T Technology Services",
        role_title: "Embedded Systems & IoT Engineer",
        drive_type: "On-campus",
        drive_date: "2026-11-15",
        drive_time: "10:30",
        venue: "Department Seminar Hall - ECE Block",
        package_min: 5.5,
        package_max: 8.0,
        openings: 20,
        departments: ["Electronics & Communication", "Electrical & Electronics", "Mechanical Engineering"],
        min_readiness: 55,
        deadline: "2026-11-10",
        description: "Core engineering campus drive targeting smart devices, automotive electronics, and industrial IoT solutions. Strong foundation in microcontrollers and C/C++ expected.",
        rounds: ["Core Technical Written Test", "Practical Hardware/Simulation Round", "Technical & HR Interview"],
        status: "Draft",
        registered: 0,
        shortlisted: 0,
        offers: 0
      }
    ];

    for (const d of drivesToSeed) {
      // Check duplicate
      const dup: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM placement_drives WHERE college_id = $1::uuid AND lower(company) = lower($2) AND lower(role_title) = lower($3) AND drive_date = $4`,
        col1001.id, d.company, d.role_title, d.drive_date
      );
      if (dup.length > 0) {
        console.log(`Drive for ${d.company} (${d.role_title}) already exists, skipping.`);
        continue;
      }

      await prisma.$queryRawUnsafe(
        `INSERT INTO placement_drives (
          college_id, company, role_title, drive_type, drive_date, drive_time, venue,
          package_min, package_max, openings, departments, min_readiness, deadline,
          description, rounds, status, registered, shortlisted, offers, created_at, updated_at
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, now(), now()
        )`,
        col1001.id, d.company, d.role_title, d.drive_type, d.drive_date, d.drive_time, d.venue,
        d.package_min, d.package_max, d.openings, d.departments, d.min_readiness, d.deadline,
        d.description, d.rounds, d.status, d.registered, d.shortlisted, d.offers
      );
      console.log(`Inserted drive: ${d.company} - ${d.role_title} (${d.status})`);
    }

    const afterCount: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM placement_drives WHERE college_id = $1::uuid`, col1001.id);
    console.log(`Total placement_drives for ${col1001.public_id} now:`, afterCount[0]?.count);

  } catch (err: any) {
    console.error("Database error:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
