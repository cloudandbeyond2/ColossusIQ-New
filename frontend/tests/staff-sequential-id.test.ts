import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateNextStaffId } from "@/components/portal/bespoke/staff";
import { generateNextStaffId as storeGenerateNextStaffId, createStaff, listStaff } from "@/lib/api/mock/staff-store";

describe("Staff sequential ID generation", () => {
  it("generates STF001 when list is empty", () => {
    expect(generateNextStaffId([])).toBe("STF001");
  });

  it("generates next sequential ID from standard STF format", () => {
    const staff = [
      { id: "1", name: "A", staffId: "STF001", role: "Faculty" as const, department: "CSE", status: "Active" as const },
      { id: "2", name: "B", staffId: "STF002", role: "Faculty" as const, department: "CSE", status: "Active" as const },
      { id: "3", name: "C", staffId: "STF005", role: "Faculty" as const, department: "CSE", status: "Active" as const },
    ];
    expect(generateNextStaffId(staff)).toBe("STF006");
  });

  it("handles unordered and higher numbers sequentially", () => {
    const staff = [
      { id: "1", name: "A", staffId: "STF010", role: "Faculty" as const, department: "CSE", status: "Active" as const },
      { id: "2", name: "B", staffId: "STF003", role: "Faculty" as const, department: "CSE", status: "Active" as const },
    ];
    expect(generateNextStaffId(staff)).toBe("STF011");
  });

  it("pads numbers properly with three digits", () => {
    const staff = [
      { id: "1", name: "A", staffId: "STF099", role: "Faculty" as const, department: "CSE", status: "Active" as const },
    ];
    expect(generateNextStaffId(staff)).toBe("STF100");
  });

  it("store auto-assigns next sequential ID when creating staff", () => {
    const initialList = listStaff();
    const expectedNext = storeGenerateNextStaffId(initialList.staff);

    const created = createStaff({ name: "Dr. New Sequential Staff" });
    expect(created.staffId).toBe(expectedNext);
  });

  it("sanitizes phone number to 10 digits", () => {
    const created = createStaff({ name: "Prof. Phone Test", phone: "+91 98765-43210 ext 99" });
    expect(created.phone).toBe("9198765432");
  });
});
