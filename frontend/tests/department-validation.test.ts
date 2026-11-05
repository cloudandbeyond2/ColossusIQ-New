import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RESOURCES, recordSchema } from "@/config/resources";

describe("Department resource validation", () => {
  const schema = recordSchema(RESOURCES.departments!);

  const validDepartment = {
    department: "Computer Science & Engineering",
    head: "Dr. S. Venkatesh",
    established: 1995,
    status: "Active",
    email: "hod.cse@college.edu",
    phone: "9876543210",
    notes: "AICTE approved, specialised labs in AI & ML.",
  };

  it("accepts a completely valid department record", () => {
    const res = schema.safeParse(validDepartment);
    expect(res.success).toBe(true);
  });

  it("validates required department field", () => {
    const res = schema.safeParse({ ...validDepartment, department: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "department")).toBe(true);
    }
  });

  it("validates head of department required and format", () => {
    // empty head
    const emptyHead = schema.safeParse({ ...validDepartment, head: "" });
    expect(emptyHead.success).toBe(false);
    if (!emptyHead.success) {
      expect(emptyHead.error.issues[0].message).toBe("Head of department is required");
    }

    // invalid head with digits
    const numHead = schema.safeParse({ ...validDepartment, head: "Dr. Head 123" });
    expect(numHead.success).toBe(false);
    if (!numHead.success) {
      expect(numHead.error.issues[0].message).toMatch(/valid name/i);
    }

    // single character head
    const shortHead = schema.safeParse({ ...validDepartment, head: "A" });
    expect(shortHead.success).toBe(false);
  });

  it("validates year established boundaries and required check", () => {
    // null / empty established
    const nullEst = schema.safeParse({ ...validDepartment, established: null });
    expect(nullEst.success).toBe(false);
    if (!nullEst.success) {
      expect(nullEst.error.issues[0].message).toBe("Year established is required");
    }

    // year too low (< 1850)
    const lowEst = schema.safeParse({ ...validDepartment, established: 1800 });
    expect(lowEst.success).toBe(false);
    if (!lowEst.success) {
      expect(lowEst.error.issues[0].message).toBe("Minimum is 1850");
    }

    // year too high (> 2030)
    const highEst = schema.safeParse({ ...validDepartment, established: 2050 });
    expect(highEst.success).toBe(false);
    if (!highEst.success) {
      expect(highEst.error.issues[0].message).toBe("Maximum is 2030");
    }
  });

  it("validates email required and format", () => {
    // empty email
    const emptyEmail = schema.safeParse({ ...validDepartment, email: "" });
    expect(emptyEmail.success).toBe(false);
    if (!emptyEmail.success) {
      expect(emptyEmail.error.issues[0].message).toBe("Department email is required");
    }

    // invalid email format
    const badEmail = schema.safeParse({ ...validDepartment, email: "invalid-email" });
    expect(badEmail.success).toBe(false);
    if (!badEmail.success) {
      expect(badEmail.error.issues[0].message).toBe("Enter a valid email");
    }
  });

  it("validates 10-digit Indian office phone number", () => {
    // empty phone
    const emptyPhone = schema.safeParse({ ...validDepartment, phone: "" });
    expect(emptyPhone.success).toBe(false);
    if (!emptyPhone.success) {
      expect(emptyPhone.error.issues[0].message).toBe("Office phone is required");
    }

    // phone starting with invalid digit (e.g. 5)
    const invalidStart = schema.safeParse({ ...validDepartment, phone: "5876543210" });
    expect(invalidStart.success).toBe(false);
    if (!invalidStart.success) {
      expect(invalidStart.error.issues[0].message).toBe("Enter a 10-digit Indian mobile number");
    }

    // phone too short
    const shortPhone = schema.safeParse({ ...validDepartment, phone: "98765" });
    expect(shortPhone.success).toBe(false);

    // valid phone starting with 6, 7, 8, or 9
    for (const start of ["6", "7", "8", "9"]) {
      expect(schema.safeParse({ ...validDepartment, phone: `${start}123456789` }).success).toBe(true);
    }
  });

  it("validates notes max length", () => {
    // optional empty notes is allowed
    expect(schema.safeParse({ ...validDepartment, notes: "" }).success).toBe(true);

    // notes exceeding 600 characters
    const longNotes = "a".repeat(601);
    const res = schema.safeParse({ ...validDepartment, notes: longNotes });
    expect(res.success).toBe(false);
  });
});
