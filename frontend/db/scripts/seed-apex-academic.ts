import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const db = new PrismaClient();
  try {
    const college = await db.college.findFirst({
      where: { name: "Apex Institute of Science & Technology" },
    });
    if (!college) throw new Error("College not found");

    // 1. Department
    const existingDept = await db.collegeDepartment.findFirst({
      where: { collegeId: college.id, departmentId: 1 },
    });
    if (!existingDept) {
      await db.collegeDepartment.create({
        data: {
          collegeId: college.id,
          departmentId: 1, // Computer Science & Engineering
          headName: "SARO-HOD",
          status: "Active",
          established: 2012,
        },
      });
      console.log("Created College Department: Computer Science & Engineering");
    }

    // 2. Staff: MEENU-FAC (Faculty)
    let meenuStaff = await db.staff.findFirst({
      where: { collegeId: college.id, email: "faculty@aist.edu.in" },
    });
    const meenuUser = await db.user.findFirst({ where: { email: "faculty@aist.edu.in" } });

    if (!meenuStaff) {
      meenuStaff = await db.staff.create({
        data: {
          collegeId: college.id,
          userId: meenuUser?.id,
          fullName: "MEENU-FAC",
          email: "faculty@aist.edu.in",
          phone: "9840112233",
          qualification: "M.E., Ph.D",
          departmentId: 1,
          designationId: 3, // Assistant Professor
          staffType: "Teaching",
          employment: "Permanent",
          joiningDate: new Date("2021-06-01"),
          experienceYears: 5,
          status: "Active",
          platformAccess: true,
        },
      });
      console.log("Created Staff: MEENU-FAC");
    }

    // 3. Staff: SARO-HOD (HOD)
    let saroStaff = await db.staff.findFirst({
      where: { collegeId: college.id, email: "hod@aist.edu.in" },
    });
    const saroUser = await db.user.findFirst({ where: { email: "hod@aist.edu.in" } });

    if (!saroStaff) {
      saroStaff = await db.staff.create({
        data: {
          collegeId: college.id,
          userId: saroUser?.id,
          fullName: "SARO-HOD",
          email: "hod@aist.edu.in",
          phone: "9840112244",
          qualification: "Ph.D",
          departmentId: 1,
          designationId: 1, // Professor
          staffType: "Teaching",
          employment: "Permanent",
          joiningDate: new Date("2018-06-01"),
          experienceYears: 12,
          status: "Active",
          platformAccess: true,
        },
      });
      console.log("Created Staff: SARO-HOD");
    }

    // 4. Admission: KUMAR-STU (Enrolled Student)
    let kumarAdmission = await db.admission.findFirst({
      where: { collegeId: college.id, email: "student1@aist.edu.in" },
    });
    if (!kumarAdmission) {
      kumarAdmission = await db.admission.create({
        data: {
          collegeId: college.id,
          fullName: "KUMAR-STU",
          dob: new Date("2004-05-15"),
          gender: "Male",
          email: "student1@aist.edu.in",
          phone: "9840556677",
          city: "Coimbatore",
          state: "Tamil_Nadu",
          board: "State_Board",
          hscPercent: 92.5,
          entranceScore: 188.5,
          programmeId: 1, // B.E. Computer Science & Engineering
          quota: "Government",
          category: "OC",
          guardianName: "R. Murugan",
          guardianPhone: "9840556688",
          status: "Enrolled",
        },
      });
      console.log("Created Admission: KUMAR-STU (Enrolled)");
    }

    // 5. Student Record for KUMAR-STU
    const kumarUser = await db.user.findFirst({
      where: { email: "student1@aist.edu.in" },
    });
    if (kumarUser) {
      const existingStudent = await db.student.findFirst({
        where: { collegeId: college.id, userId: kumarUser.id },
      });
      if (!existingStudent) {
        await db.student.create({
          data: {
            collegeId: college.id,
            userId: kumarUser.id,
            admissionId: kumarAdmission.id,
            departmentId: 1,
            programmeId: 1,
            termId: 4, // Semester 4
            rollNo: "24CS101",
            batchYear: 2024,
            status: "Active",
          },
        });
        console.log("Created Student: KUMAR-STU (Roll No: 24CS101)");
      }
    }

    // 6. Active Course: Database Management Systems (taught by MEENU-FAC)
    const existingCourse = await db.course.findFirst({
      where: { collegeId: college.id, code: "CS3492" },
    });
    if (!existingCourse) {
      await db.course.create({
        data: {
          collegeId: college.id,
          code: "CS3492",
          title: "Database Management Systems",
          departmentId: 1,
          termId: 4, // Semester 4
          credits: 4,
          courseType: "Theory",
          facultyStaffId: meenuStaff.id,
          facultyName: "MEENU-FAC",
          status: "Active",
          description: "Relational database concepts, SQL, transactions, normalization and indexing.",
        },
      });
      console.log("Created Course: CS3492 - Database Management Systems");
    }

    console.log("\n✅ Successfully created academic roster records for Apex Institute in PostgreSQL!");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error creating academic data:", e);
  process.exit(1);
});
