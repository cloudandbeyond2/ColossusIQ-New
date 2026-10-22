import { describe, expect, it } from "vitest";
import { getRoleConfig, toneForRole } from "@/components/ui/role-badge";

describe("RoleBadge utility", () => {
  it("resolves full and short titles, icons and tones for all standard roles", () => {
    const admin = getRoleConfig("University Super Admin");
    expect(admin.short).toBe("Super Admin");
    expect(admin.full).toBe("University Super Admin");
    expect(admin.icon).toBe("shield-check");
    expect(admin.tone).toBe("brand");

    const principal = getRoleConfig("Principal / Institution Admin");
    expect(principal.short).toBe("Principal");
    expect(principal.full).toBe("Principal / Institution Admin");
    expect(principal.icon).toBe("school");
    expect(principal.tone).toBe("rose");

    const hod = getRoleConfig("Head of Department");
    expect(hod.short).toBe("HOD");
    expect(hod.icon).toBe("users-alt");
    expect(hod.tone).toBe("teal");

    const placement = getRoleConfig("Placement Officer");
    expect(placement.short).toBe("Placement");
    expect(placement.icon).toBe("briefcase");
    expect(placement.tone).toBe("sky");

    const faculty = getRoleConfig("Faculty");
    expect(faculty.short).toBe("Faculty");
    expect(faculty.icon).toBe("chalkboard-user");
    expect(faculty.tone).toBe("gold");

    const student = getRoleConfig("Student");
    expect(student.short).toBe("Student");
    expect(student.icon).toBe("user-graduate");
  });

  it("handles lowercase slugs gracefully", () => {
    expect(getRoleConfig("admin").short).toBe("Super Admin");
    expect(getRoleConfig("institution").short).toBe("Principal");
    expect(getRoleConfig("hod").short).toBe("HOD");
    expect(getRoleConfig("faculty").short).toBe("Faculty");
    expect(getRoleConfig("placement").short).toBe("Placement");
    expect(getRoleConfig("incubation").short).toBe("Incubation");
    expect(getRoleConfig("recruiter").short).toBe("Recruiter");
    expect(getRoleConfig("student").short).toBe("Student");
  });

  it("provides correct tone mappings via toneForRole", () => {
    expect(toneForRole("University Super Admin")).toBe("brand");
    expect(toneForRole("Principal / Institution Admin")).toBe("rose");
    expect(toneForRole("Faculty")).toBe("gold");
    expect(toneForRole("Placement Officer")).toBe("sky");
  });
});
