import "server-only";

export interface StaffMember {
  id: string;
  name: string;
  staffId: string;
  role: "HOD" | "Faculty" | "Lab Assistant" | "Admin Staff" | "Librarian" | "Counselor" | "Placement Officer" | "Other";
  department: string;
  email?: string;
  phone?: string;
  status: "Active" | "On Leave" | "Inactive";
  joinedDate?: string;
  qualifications?: string;
}

const INITIAL_STAFF: StaffMember[] = [
  { id: "1", name: "Dr. Meena Rajesh", staffId: "STF001", role: "HOD", department: "CSE", email: "meena@college.edu", phone: "9876543210", status: "Active", joinedDate: "2018-06-01", qualifications: "PhD Computer Science" },
  { id: "2", name: "Prof. Kiran Suresh", staffId: "STF002", role: "Faculty", department: "CSE", email: "kiran@college.edu", phone: "9876543211", status: "Active", joinedDate: "2020-07-15", qualifications: "M.Tech CSE" },
  { id: "3", name: "Ms. Priya Thangam", staffId: "STF003", role: "Faculty", department: "CSE", email: "priya@college.edu", status: "On Leave", joinedDate: "2021-08-01", qualifications: "M.Sc CS" },
  { id: "4", name: "Mr. Anand Velmurugan", staffId: "STF004", role: "Lab Assistant", department: "CSE", phone: "9876543213", status: "Active", joinedDate: "2019-01-10" },
  { id: "5", name: "Ms. Lakshmi Devi", staffId: "STF005", role: "Admin Staff", department: "CSE", email: "lakshmi@college.edu", status: "Active", joinedDate: "2017-03-20" },
];

let staffList: StaffMember[] = [...INITIAL_STAFF];

export function generateNextStaffId(existingStaff: StaffMember[] = staffList): string {
  let max = 0;
  for (const s of existingStaff) {
    if (!s.staffId) continue;
    const match = s.staffId.match(/STF-?(\d+)/i) ?? s.staffId.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  const next = max + 1;
  return `STF${String(next).padStart(3, "0")}`;
}

export function listStaff(): { staff: StaffMember[]; total: number } {
  return { staff: [...staffList], total: staffList.length };
}

export function createStaff(item: Partial<StaffMember>): StaffMember {
  const staffId = item.staffId && item.staffId.trim() ? item.staffId.trim() : generateNextStaffId(staffList);
  const newMember: StaffMember = {
    id: String(Date.now()),
    name: item.name || "Staff Member",
    staffId,
    role: item.role || "Faculty",
    department: item.department || "",
    email: item.email || "",
    phone: item.phone || "",
    status: item.status || "Active",
    joinedDate: item.joinedDate || new Date().toISOString().slice(0, 10),
    qualifications: item.qualifications || "",
  };
  staffList.push(newMember);
  return newMember;
}

export function updateStaff(id: string, item: Partial<StaffMember>): StaffMember | null {
  const idx = staffList.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  staffList[idx] = { ...staffList[idx]!, ...item };
  return staffList[idx]!;
}

export function deleteStaff(id: string): boolean {
  const before = staffList.length;
  staffList = staffList.filter((s) => s.id !== id);
  return staffList.length < before;
}
