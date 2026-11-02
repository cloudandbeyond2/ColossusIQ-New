"use client";

import { useState, useMemo, useRef } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Download,
  Upload,
  UserPlus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Eye,
  EyeOff,
  Users,
  Building2,
  GraduationCap,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { streamOfType, streamOptions } from "@/config/streams";
import * as XLSX from "xlsx";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Spinner,
  inputClass,
  selectFilterClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────── */

export interface StudentItem {
  id: string;
  name: string;
  roll: string;
  section: string;
  cgpa: number;
  readiness: number;
  signal: "None" | "Review suggested" | "At risk" | "High performer";
  email?: string;
  phone?: string;
  collegeId?: string | null;
  collegeName?: string | null;
  department?: string;
}

const StudentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  section: z.string(),
  cgpa: z.number(),
  readiness: z.number(),
  signal: z.string().transform((val): "None" | "Review suggested" | "At risk" | "High performer" => {
    if (val === "Review suggested" || val === "At risk" || val === "High performer") return val;
    return "None";
  }),
  email: z.string().optional(),
  phone: z.string().optional(),
  collegeId: z.string().nullable().optional(),
  collegeName: z.string().nullable().optional(),
  department: z.string().optional(),
});

const StudentSchema = z.object({
  students: z.array(StudentItemSchema),
  total: z.number().optional(),
});

/* ── Main Component ────────────────────────────────── */

export function StudentsModule({ role: _role }: { role: Role }) {
  const qc = useQueryClient();

  // Filters & Search
  const [q, setQ] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [unmasked, setUnmasked] = useState<Record<string, boolean>>({});

  // Query Colleges for Dropdown Filter & Creation
  const { data: colleges = [] } = useQuery({
    queryKey: ["public-colleges-list"],
    queryFn: async () => {
      try {
        const res = await apiFetch(
          "/api/v1/public/colleges",
          z.object({
            colleges: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                city: z.string().optional(),
                type: z.string().optional(),
              })
            ),
          })
        );
        return res.colleges;
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query Session for Active College Context
  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      try {
        return await apiFetch(
          "/api/v1/auth/session",
          z.object({
            role: z.string(),
            name: z.string(),
            college: z.string().optional(),
            collegeName: z.string().optional(),
          })
        );
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<"form" | "excel">("form");
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields state for adding student
  const [newStudent, setNewStudent] = useState<Partial<StudentItem>>({
    name: "",
    roll: "",
    department: "",
    section: "CSE-A",
    cgpa: 7.5,
    readiness: 60,
    signal: "None",
    email: "",
    phone: "",
    collegeId: "",
  });

  // Excel / CSV upload state
  const [parsedRows, setParsedRows] = useState<StudentItem[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  /* ── Query Students (GET) ────────────────────────── */
  const { data: queryData, isLoading, isError, error } = useQuery({
    queryKey: ["students-list", collegeFilter],
    queryFn: async () => {
      const url =
        collegeFilter && collegeFilter !== "all"
          ? `/api/v1/students?college=${encodeURIComponent(collegeFilter)}`
          : "/api/v1/students?college=all";
      const res = await apiFetch(url, StudentSchema);
      return res.students;
    },
  });

  const students = queryData ?? [];

  /* ── Mutations ───────────────────────────────────── */

  // POST single student
  const createMutation = useMutation({
    mutationFn: async (payload: Partial<StudentItem>) => {
      return apiFetch("/api/v1/students", z.any(), {
        method: "POST",
        body: { data: { ...payload, collegeId: payload.collegeId || activeCollegeId } },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["module", "students"] });
      setIsImportModalOpen(false);
      setNewStudent({
        name: "",
        roll: "",
        department: "",
        section: "CSE-A",
        cgpa: 7.5,
        readiness: 60,
        signal: "None",
        email: "",
        phone: "",
      });
      showToast("Student created and saved successfully!");
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to create student.");
    },
  });

  // Bulk import from Excel / CSV
  const importMutation = useMutation({
    mutationFn: async (items: StudentItem[]) => {
      return apiFetch("/api/v1/students/import", z.any(), {
        method: "POST",
        body: {
          items: items.map((it) => ({ ...it, collegeId: it.collegeId || activeCollegeId })),
          collegeId: activeCollegeId,
        },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["module", "students"] });
      setIsImportModalOpen(false);
      setParsedRows([]);
      setUploadFileName(null);
      showToast(`Successfully imported ${res?.imported ?? parsedRows.length} students!`);
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to import students.");
    },
  });

  // Update student
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StudentItem> }) => {
      return apiFetch(`/api/v1/students/${id}`, z.any(), {
        method: "PUT",
        body: { data },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["module", "students"] });
      setEditingStudent(null);
      showToast("Student record updated successfully!");
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to update student.");
    },
  });

  // Delete student
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/v1/students/${id}`, z.any(), {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["module", "students"] });
      setDeletingStudent(null);
      showToast("Student deleted successfully!");
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to delete student.");
    },
  });

  const sessionCollegeId = session?.college && session.college !== "all" ? session.college : "";
  const activeCollegeId =
    newStudent.collegeId ||
    (collegeFilter !== "all" ? collegeFilter : sessionCollegeId || colleges[0]?.id || "");
  const selectedCollege = useMemo(() => {
    return colleges.find((c) => c.id === activeCollegeId);
  }, [colleges, activeCollegeId]);

  const selectedStream = useMemo(() => {
    return streamOfType(selectedCollege?.type || selectedCollege?.name);
  }, [selectedCollege]);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    const streamDepts = streamOptions("department", selectedStream).filter((d) => !/Administration/.test(d));
    streamDepts.forEach((d) => depts.add(d));

    students.forEach((s) => {
      if ((s.collegeId === activeCollegeId || !activeCollegeId) && s.department) {
        depts.add(s.department);
      }
    });

    return Array.from(depts);
  }, [selectedStream, activeCollegeId, students]);

  const isNursingCollege = useMemo(() => {
    const colName = (selectedCollege?.name || '').toLowerCase();
    const colType = (selectedCollege?.type || '').toLowerCase();
    return colName.includes('nurs') || colType.includes('nurs');
  }, [selectedCollege]);

  const rollNumberPlaceholder = useMemo(() => {
    if (isNursingCollege) return 'e.g. 25NUR101';
    if (selectedStream === 'medical') return 'e.g. 26MED101';
    if (selectedStream === 'management') return 'e.g. 24MBA101';
    if (selectedStream === 'artsScience') return 'e.g. 23BSC101';
    return 'e.g. 21CS1157';
  }, [isNursingCollege, selectedStream]);

  const sectionPlaceholder = useMemo(() => {
    if (isNursingCollege || selectedStream === 'medical') return 'e.g. Phase I · Batch A';
    if (selectedStream === 'management') return 'e.g. Section A';
    return 'e.g. CSE-A';
  }, [isNursingCollege, selectedStream]);

  const emailPlaceholder = useMemo(() => {
    if (isNursingCollege) return 'e.g. rohan.s@cinahs.ac.in';
    if (selectedStream === 'medical') return 'e.g. rohan.s@medcollege.ac.in';
    return 'e.g. rohan.s@campus.edu';
  }, [isNursingCollege, selectedStream]);

  const openAddStudentModal = () => {
    const initColId = collegeFilter !== 'all' ? collegeFilter : sessionCollegeId || colleges[0]?.id || '';
    const colObj = colleges.find((c) => c.id === initColId);
    const isNurs = (colObj?.name || '').toLowerCase().includes('nurs') || (colObj?.type || '').toLowerCase().includes('nurs');
    const st = streamOfType(colObj?.type || colObj?.name);
    const defaultSec = isNurs || st === 'medical' ? 'Phase I · Batch A' : 'CSE-A';
    setNewStudent({
      name: '',
      roll: '',
      department: '',
      section: defaultSec,
      cgpa: 7.5,
      readiness: 60,
      signal: 'None',
      email: '',
      phone: '',
      collegeId: initColId,
    });
    setImportTab('form');
    setIsImportModalOpen(true);
  };

  const editActiveCollegeId = editingStudent?.collegeId || "";
  const editSelectedCollege = useMemo(() => {
    return colleges.find((c) => c.id === editActiveCollegeId || c.name === editingStudent?.collegeName);
  }, [colleges, editActiveCollegeId, editingStudent?.collegeName]);

  const editSelectedStream = useMemo(() => {
    return streamOfType(editSelectedCollege?.type || editSelectedCollege?.name);
  }, [editSelectedCollege]);

  const editAvailableDepartments = useMemo(() => {
    const depts = new Set<string>();
    const streamDepts = streamOptions("department", editSelectedStream).filter((d) => !/Administration/.test(d));
    streamDepts.forEach((d) => depts.add(d));

    if (editingStudent?.department) {
      depts.add(editingStudent.department);
    }

    students.forEach((s) => {
      if ((s.collegeId === editActiveCollegeId || !editActiveCollegeId) && s.department) {
        depts.add(s.department);
      }
    });

    return Array.from(depts);
  }, [editSelectedStream, editActiveCollegeId, editingStudent?.department, students]);

  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    if (collegeFilter !== "all") {
      const col = colleges.find((c) => c.id === collegeFilter);
      if (col) {
        const st = streamOfType(col.type || col.name);
        streamOptions("department", st).filter((d) => !/Administration/.test(d)).forEach((d) => set.add(d));
      }
    }
    students.forEach((s) => {
      if ((collegeFilter === "all" || s.collegeId === collegeFilter) && s.department) {
        set.add(s.department);
      }
    });
    return Array.from(set).sort();
  }, [students, collegeFilter, colleges]);

  const _legacyDepts = useMemo(() => {


    const set = new Set<string>();
    students.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [students]);

  const sectionsList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.section));
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      if (sectionFilter !== "all" && s.section.toLowerCase() !== sectionFilter.toLowerCase()) {
        return false;
      }
      if (collegeFilter !== "all" && s.collegeId && s.collegeId !== collegeFilter) {
        return false;
      }
      if (deptFilter !== "all" && s.department && s.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.roll.toLowerCase().includes(needle) ||
        s.section.toLowerCase().includes(needle) ||
        (s.department && s.department.toLowerCase().includes(needle)) ||
        (s.collegeName && s.collegeName.toLowerCase().includes(needle))
      );
    });
  }, [students, q, sectionFilter, collegeFilter, deptFilter]);

  /* ── Excel / CSV File Handlers ───────────────────── */

  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) {
      setUploadError("The uploaded file does not contain enough rows.");
      return;
    }

    const header = lines[0]!.toLowerCase().split(/,|\t|;/).map((h) => h.replace(/["']/g, "").trim());

    const nameIdx = header.findIndex((h) => h.includes("name") || h.includes("student"));
    const rollIdx = header.findIndex((h) => h.includes("roll") || h.includes("reg"));
    const sectionIdx = header.findIndex((h) => h.includes("section") || h.includes("class") || h.includes("branch"));
    const cgpaIdx = header.findIndex((h) => h.includes("cgpa") || h.includes("gpa") || h.includes("score"));
    const readinessIdx = header.findIndex((h) => h.includes("readiness") || h.includes("career"));
    const signalIdx = header.findIndex((h) => h.includes("signal") || h.includes("support"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("mobile"));
    const deptIdx = header.findIndex((h) => h.includes("dept") || h.includes("department"));
    const collegeIdx = header.findIndex((h) => h.includes("college") || h.includes("institution"));

    const parsed: StudentItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(/,|\t|;/).map((p) => p.replace(/^["']|["']$/g, "").trim());
      if (parts.length < 2) continue;

      const name = nameIdx !== -1 ? parts[nameIdx] : parts[0];
      const roll = rollIdx !== -1 ? parts[rollIdx] : parts[1];
      if (!name || !roll) continue;

      const section = (sectionIdx !== -1 ? parts[sectionIdx] : "CSE-A") || "CSE-A";
      const rawCgpa = cgpaIdx !== -1 ? parseFloat(parts[cgpaIdx] || "7.5") : 7.5;
      const cgpa = isNaN(rawCgpa) ? 7.5 : Math.round(rawCgpa * 100) / 100;
      const rawReadiness = readinessIdx !== -1 ? parseInt(parts[readinessIdx]?.replace("%", "") || "60", 10) : 60;
      const readiness = isNaN(rawReadiness) ? 60 : Math.min(100, Math.max(0, rawReadiness));

      let signal: StudentItem["signal"] = "None";
      if (signalIdx !== -1 && parts[signalIdx]) {
        const sig = parts[signalIdx]!.toLowerCase();
        if (sig.includes("review")) signal = "Review suggested";
        else if (sig.includes("risk")) signal = "At risk";
        else if (sig.includes("high")) signal = "High performer";
      } else if (cgpa < 7.0) {
        signal = "Review suggested";
      }

      parsed.push({
        id: `stu-csv-${i}-${Date.now()}`,
        name,
        roll,
        section,
        cgpa,
        readiness,
        signal,
        email: emailIdx !== -1 ? parts[emailIdx] : undefined,
        phone: phoneIdx !== -1 ? parts[phoneIdx] : undefined,
        department: deptIdx !== -1 && parts[deptIdx] ? parts[deptIdx] : undefined,
      });
    }

    if (parsed.length === 0) {
      setUploadError("Could not extract any valid student records from the file.");
      return;
    }

    setUploadError(null);
    setParsedRows(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
          const firstSheet = wb.SheetNames[0];
          if (!firstSheet) {
            setUploadError("The uploaded Excel workbook contains no sheets.");
            return;
          }
          const sheet = wb.Sheets[firstSheet];
          if (!sheet) {
            setUploadError('The sheet could not be read.');
            return;
          }
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          parseCsvText(csvText);
        } catch (err: any) {
          setUploadError("Could not read Excel file: " + (err?.message || "Invalid workbook format."));
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(file);
  };

  // Export students list to real CSV/Excel file with UTF-8 BOM
  const handleExportExcel = () => {
    const headers = ["Student Name", "Roll Number", "College", "Department", "Section", "CGPA", "Career Readiness (%)", "Support Signal", "Email", "Phone"];
    const rows = filteredStudents.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.roll.replace(/"/g, '""')}"`,
      `"${(s.collegeName || "").replace(/"/g, '""')}"`,
      `"${(s.department || "").replace(/"/g, '""')}"`,
      `"${s.section.replace(/"/g, '""')}"`,
      s.cgpa.toFixed(2),
      s.readiness.toString(),
      `"${s.signal.replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.phone || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Students_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample CSV template for easy uploading
  const handleDownloadSampleTemplate = () => {
    const colName = (selectedCollege?.name || "").toLowerCase();
    const colType = (selectedCollege?.type || "").toLowerCase();
    const isNursing = colName.includes("nurs") || colType.includes("nurs");
    const isMedical = selectedStream === "medical";
    const sampleHeaders = "Student Name,Roll Number,Department,Section,CGPA,Career Readiness,Support Signal,Email,Phone";
    const sampleData = [
      ...(isNursing
        ? [
            "Aarav Sharma,25NUR101,Nursing,Phase I · Batch A,8.45,78,None,aarav.s101@cinahs.ac.in,9876543210",
            "Pooja Venkatesh,25NUR102,Paediatrics,Phase I · Batch A,6.80,45,Review suggested,pooja.v102@cinahs.ac.in,9876543211",
            "Rohan Deshmukh,25NUR103,Physiology,Phase I · Batch B,9.20,92,High performer,rohan.d103@cinahs.ac.in,9876543212",
            "Kavya Nair,25NUR104,Pathology,Phase I · Batch B,7.80,70,None,kavya.n104@cinahs.ac.in,9876543213",
            "Mohammed Asif,25NUR105,Community Medicine,Phase I · Batch A,7.10,65,None,asif.m105@cinahs.ac.in,9876543214",
          ]
        : isMedical
        ? [
            "Aarav Sharma,26MED101,Nursing,Phase I · Batch A,8.45,78,None,aarav.s@campus.edu,9876543210",
            "Pooja Venkatesh,26MED102,Paediatrics,Phase I · Batch A,6.80,45,Review suggested,pooja.v@campus.edu,9876543211",
            "Rohan Deshmukh,26MED103,Physiology,Phase I · Batch B,9.20,92,High performer,rohan.d@campus.edu,9876543212",
          ]
        : [
            "Aarav Sharma,21CS1180,Computer Science & Engineering,CSE-A,8.45,78,None,aarav.s@campus.edu,9876543210",
            "Pooja Venkatesh,21CS1181,Information Technology,CSE-B,6.80,45,Review suggested,pooja.v@campus.edu,9876543211",
            "Rohan Deshmukh,21CS1182,Artificial Intelligence & Data Science,AI&DS,9.20,92,High performer,rohan.d@campus.edu,9876543212",
          ]),


    ].join("\r\n");

    const content = "\uFEFF" + sampleHeaders + "\r\n" + sampleData;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const templateTag = isNursing ? "nursing" : selectedStream;
    link.setAttribute("download", `sample_students_template_${templateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maskRoll = (roll: string, id: string) => {
    if (unmasked[id]) return roll;
    if (roll.length <= 4) return roll;
    return "••••" + roll.slice(-4);
  };

  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/80 px-4 py-3 text-sm text-teal shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-teal" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded p-1 hover:bg-surface-2 text-ink-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="overflow-hidden border border-line bg-surface shadow-xs">
        {/* Toolbar Header */}
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              id="student-search"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search students.."
              className={cn(inputClass, "pl-9 text-sm py-2")}
            />
          </div>

          {/* College Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Building2 className="size-4 text-ink-3 shrink-0" />
            <select
              id="student-college-filter"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className={cn(selectFilterClass, "w-full sm:w-auto text-sm py-2 px-3 min-w-[140px] max-w-full sm:max-w-[210px]")}
              title="Filter by college"
            >
              <option value="all">All Colleges</option>
              {colleges.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter Dropdown */}
          {departmentsList.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <GraduationCap className="size-4 text-ink-3 shrink-0" />
              <select
                id="student-department-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className={cn(selectFilterClass, "w-full sm:w-auto text-sm py-2 px-3 min-w-[140px] max-w-full sm:max-w-[200px]")}
                title="Filter by department"
              >
                <option value="all">All Departments</option>
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="size-4 text-ink-3 shrink-0" />
            <select
              id="student-section-filter"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className={cn(selectFilterClass, "w-full sm:w-auto text-sm py-2 px-3 min-w-[120px] max-w-full sm:max-w-[160px]")}
              title="Filter by section"
            >
              <option value="all">All Sections</option>
              {sectionsList.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons: Add Student (POST), Import (Bulk POST), Export */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-sm"
              title="Export students list to Excel/CSV spreadsheet"
            >
              <Download className="size-4" />
              <span>Export excel</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setIsImportModalOpen(true);
                setImportTab("excel");
              }}
              className="flex items-center gap-1.5 text-sm"
              title="Bulk upload students from Excel/CSV file"
            >
              <Upload className="size-4" />
              <span>Import students</span>
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={openAddStudentModal}
              className="flex items-center gap-1.5 text-sm font-semibold shadow-xs"
              title="Add a new student"
            >
              <UserPlus className="size-4" />
              <span>+ Add Student</span>
            </Button>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="p-12 text-center text-ink-3 flex flex-col items-center justify-center gap-2">
            <Spinner className="size-6 text-brand" />
            <span className="text-xs">Loading students directory…</span>
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-ink-3 space-y-2">
            <AlertCircle className="size-8 mx-auto text-rose-500" />
            <p className="text-sm font-medium text-ink">Failed to load students directory</p>
            <p className="text-xs text-ink-3">{(error as any)?.message || "Please refresh the page or try again later."}</p>
          </div>
        ) : students.length === 0 ? (
          /* Empty Directory State */
          <div className="p-12 text-center text-ink-3 space-y-3">
            <Users className="size-10 mx-auto text-ink-3/40" />
            <div>
              <p className="text-sm font-semibold text-ink">No students registered yet</p>
              <p className="text-xs text-ink-3 mt-1">
                Use the Import button to add students via form or upload an Excel/CSV file.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setImportTab("excel");
                  setIsImportModalOpen(true);
                }}
              >
                <Upload className="size-3.5 mr-1.5" />
                Upload Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openAddStudentModal}
              >
                <UserPlus className="size-3.5 mr-1.5" />
                Add Student
              </Button>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          /* Filtered Empty State */
          <div className="p-12 text-center text-ink-3 space-y-2">
            <Users className="size-8 mx-auto text-ink-3/60" />
            <p className="text-sm font-medium text-ink">No matching students found</p>
            <p className="text-xs text-ink-3">Try adjusting your search query, college, department, or section filter.</p>
          </div>
        ) : (
          /* Desktop / Responsive Table */
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-2/40 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll No.</th>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">CGPA</th>
                  <th className="px-4 py-3">Career Readiness</th>
                  <th className="px-4 py-3">Support Signal</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredStudents.map((student) => {
                  const isLow = student.readiness < 45;
                  const isMid = student.readiness >= 45 && student.readiness < 70;

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-surface-2/50 transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5 font-medium text-ink">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand text-xs font-bold uppercase">
                            {student.name.charAt(0)}
                          </span>
                          <span className="hover:text-brand transition-colors cursor-pointer" onClick={() => setEditingStudent(student)}>
                            {student.name}
                          </span>
                        </div>
                      </td>

                      {/* Roll No with toggle unmask */}
                      <td className="px-4 py-3.5 text-ink-2 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{maskRoll(student.roll, student.id)}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setUnmasked((prev) => ({
                                ...prev,
                                [student.id]: !prev[student.id],
                              }))
                            }
                            className="text-ink-3 hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            title={unmasked[student.id] ? "Mask roll number" : "Reveal roll number"}
                          >
                            {unmasked[student.id] ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* College */}
                      <td className="px-4 py-3.5 text-xs">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 border border-line text-ink-2 font-medium text-[11px] max-w-[200px] truncate"
                          title={student.collegeName || "Institution"}
                        >
                          <Building2 className="size-3 shrink-0 text-brand" />
                          <span className="truncate">{student.collegeName || "Institution"}</span>
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5 text-xs text-ink-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="size-3.5 text-brand shrink-0" />
                          <span className="truncate max-w-[170px]" title={student.department || "General"}>
                            {student.department || "General"}
                          </span>
                        </div>
                      </td>

                      {/* Section */}
                      <td className="px-4 py-3.5 text-ink-2 text-xs font-medium">
                        {student.section}
                      </td>

                      {/* CGPA */}
                      <td className="px-4 py-3.5 font-medium text-ink text-xs">
                        {student.cgpa.toFixed(2)}
                      </td>

                      {/* Career Readiness Progress Bar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-32 max-w-44">
                          <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isLow
                                  ? "bg-rose-500"
                                  : isMid
                                    ? "bg-amber-500"
                                    : "bg-teal-600"
                              )}
                              style={{ width: `${student.readiness}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-3 font-mono shrink-0 w-8 text-right">
                            {student.readiness}%
                          </span>
                        </div>
                      </td>

                      {/* Support Signal Badge */}
                      <td className="px-4 py-3.5">
                        <Badge
                          tone={
                            student.signal === "Review suggested"
                              ? "amber"
                              : student.signal === "At risk"
                                ? "rose"
                                : student.signal === "High performer"
                                  ? "brand"
                                  : "teal"
                          }
                          className="text-[11px]"
                        >
                          {student.signal}
                        </Badge>
                      </td>

                      {/* Actions: Edit & Delete */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="p-1 rounded text-ink-3 hover:text-brand hover:bg-brand-soft transition-colors"
                            title="Edit student"
                          >
                            <Edit3 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(student)}
                            className="p-1 rounded text-ink-3 hover:text-rose hover:bg-rose-soft transition-colors"
                            title="Delete student"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-line px-4 py-3 text-xs text-ink-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-2">
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>
          <span className="text-[11px] text-ink-3">
            Institutional Student Directory
          </span>
        </div>
      </Card>

      {/* ── MODAL 1: ADD / IMPORT STUDENTS (POST) ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {importTab === "form" ? "Add Student" : "Import Students"}
                </h2>
                <p className="text-xs text-ink-3">
                  {importTab === "form"
                    ? "Create a new student record and login account."
                    : "Upload an Excel or CSV file to import multiple students."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Navigation Tabs between Form & Excel Upload */}
            <div className="flex border-b border-line gap-2 pb-1">
              <button
                type="button"
                onClick={() => setImportTab("form")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  importTab === "form"
                    ? "bg-brand text-white shadow-xs"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2"
                )}
              >
                <UserPlus className="size-3.5" /> Single Student Form
              </button>

              <button
                type="button"
                onClick={() => setImportTab("excel")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  importTab === "excel"
                    ? "bg-brand text-white shadow-xs"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2"
                )}
              >
                <FileSpreadsheet className="size-3.5" /> Excel / CSV File Upload
              </button>
            </div>

            {/* TAB 1: FORM FIELDS */}
            {importTab === "form" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newStudent.name || !newStudent.roll) return;
                  const colId = newStudent.collegeId || (collegeFilter !== "all" ? collegeFilter : colleges[0]?.id || "");
                  const colObj = colleges.find((c) => c.id === colId);
                  createMutation.mutate({
                    ...newStudent,
                    collegeId: colId,
                    collegeName: colObj?.name || newStudent.collegeName,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Student Full Name *" htmlFor="inp-name">
                    <input
                      id="inp-name"
                      required
                      type="text"
                      value={newStudent.name || ""}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      placeholder="e.g. Rohan Sharma"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Roll Number *" htmlFor="inp-roll">
                    <input
                      id="inp-roll"
                      required
                      type="text"
                      value={newStudent.roll || ""}
                      onChange={(e) => setNewStudent({ ...newStudent, roll: e.target.value })}
                      placeholder={rollNumberPlaceholder}
                      className={inputClass}
                    />
                  </Field>
                </div>

                {/* College Selection */}
                {colleges.length > 0 && (
                  <Field label="College / Institution" htmlFor="inp-college">
                    <select
                      id="inp-college"
                      value={newStudent.collegeId || activeCollegeId}
                      onChange={(e) => {
                        const newColId = e.target.value;
                        const colObj = colleges.find((c) => c.id === newColId);
                        const st = streamOfType(colObj?.type || colObj?.name);
                        const isNurs = (colObj?.name || "").toLowerCase().includes("nurs") || (colObj?.type || "").toLowerCase().includes("nurs");
                        const defaultSec = isNurs || st === "medical" ? "Phase I · Batch A" : "CSE-A";
                        setNewStudent({ ...newStudent, collegeId: newColId, department: "", section: defaultSec });
                      }}
                      className={inputClass}
                    >
                      {colleges.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Department *" htmlFor="inp-dept">
                    <select
                      id="inp-dept"
                      required
                      value={newStudent.department || ""}
                      onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select Department...</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {/*
                  <Field label="Old Dept" htmlFor="inp-dept-old">
                    <input
                      id="inp-dept"
                      type="text"
                      value={newStudent.department || ""}
                      onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                      placeholder="e.g. Computer Science & Engineering"
                      className={inputClass}
                    />
                  </Field>

                  */ null}

                  <Field label="Section *" htmlFor="inp-sec">
                    <input
                      id="inp-sec"
                      required
                      type="text"
                      value={newStudent.section || "CSE-A"}
                      onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                      placeholder={sectionPlaceholder}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CGPA (0 - 10)" htmlFor="inp-cgpa">
                    <input
                      id="inp-cgpa"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={newStudent.cgpa || 7.5}
                      onChange={(e) => setNewStudent({ ...newStudent, cgpa: parseFloat(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Readiness (%)" htmlFor="inp-readiness">
                    <input
                      id="inp-readiness"
                      type="number"
                      min="0"
                      max="100"
                      value={newStudent.readiness || 60}
                      onChange={(e) => setNewStudent({ ...newStudent, readiness: parseInt(e.target.value, 10) })}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Support Signal" htmlFor="inp-signal">
                    <select
                      id="inp-signal"
                      value={newStudent.signal || "None"}
                      onChange={(e) => setNewStudent({ ...newStudent, signal: e.target.value as StudentItem["signal"] })}
                      className={inputClass}
                    >
                      <option value="None">None</option>
                      <option value="Review suggested">Review suggested</option>
                      <option value="At risk">At risk</option>
                      <option value="High performer">High performer</option>
                    </select>
                  </Field>

                  <Field label="Email Address" htmlFor="inp-email">
                    <input
                      id="inp-email"
                      type="email"
                      value={newStudent.email || ""}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                      placeholder={emailPlaceholder}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsImportModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={createMutation.isPending}
                    className="flex items-center gap-1.5 font-semibold"
                  >
                    {createMutation.isPending ? <Spinner className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    Save Student
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: EXCEL / CSV FILE UPLOAD */}
            {importTab === "excel" && (
              <div className="space-y-4">
                {/* Dropzone Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-line rounded-xl hover:border-brand/60 bg-surface-2/30 hover:bg-brand-soft/20 cursor-pointer transition-all text-center space-y-2"
                >
                  <FileSpreadsheet className="size-10 text-brand" />
                  <p className="text-sm font-semibold text-ink">
                    Click to browse or drop your Excel / CSV file
                  </p>
                  <p className="text-xs text-ink-3">
                    Supports .xlsx, .xls, .csv, and tab-delimited files
                  </p>
                  {uploadFileName && (
                    <Badge tone="brand" className="mt-2 text-xs">
                      Selected: {uploadFileName}
                    </Badge>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .xlsx, .xls, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Sample Template Download */}
                <div className="flex items-center justify-between rounded-xl bg-surface-2/50 p-3 text-xs">
                  <span className="text-ink-3">
                    Need the expected format? Download our template:
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleTemplate}
                    className="text-brand font-semibold underline hover:text-brand/80 flex items-center gap-1"
                  >
                    <Download className="size-3.5" /> Sample Template (.csv)
                  </button>
                </div>

                {/* Error Banner */}
                {uploadError && (
                  <div className="rounded-xl border border-rose/30 bg-rose-soft/40 p-3 text-xs text-rose flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Parsed Rows Preview */}
                {parsedRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>Preview ({parsedRows.length} students found):</span>
                      <Badge tone="teal">Ready to import</Badge>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-line divide-y divide-line text-xs">
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <div key={i} className="p-2 flex items-center justify-between bg-surface">
                          <div>
                            <span className="font-semibold text-ink">{row.name}</span>
                            <span className="text-ink-3 ml-2">({row.roll})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-ink-2">{row.section}</span>
                            <span className="font-medium text-ink">CGPA {row.cgpa}</span>
                          </div>
                        </div>
                      ))}
                      {parsedRows.length > 5 && (
                        <div className="p-2 text-center text-[11px] text-ink-3 bg-surface-2/30">
                          + {parsedRows.length - 5} more student records
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setParsedRows([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={parsedRows.length === 0 || importMutation.isPending}
                    onClick={() => importMutation.mutate(parsedRows)}
                    className="flex items-center gap-1.5 font-semibold"
                  >
                    {importMutation.isPending ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />}
                    Confirm & Import {parsedRows.length} Students
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT STUDENT (PUT) ── */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-lg font-bold text-ink">Edit Student Record</h2>
                <p className="text-xs text-ink-3">Update academic profile, section, and readiness signal.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: editingStudent.id,
                  data: editingStudent,
                });
              }}
              className="space-y-4"
            >
              {editingStudent.collegeName && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-2 border border-line text-xs text-ink-2">
                  <Building2 className="size-4 text-brand shrink-0" />
                  <span className="text-ink-3">College:</span>
                  <span className="font-semibold text-ink">{editingStudent.collegeName}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name *" htmlFor="edit-name">
                  <input
                    id="edit-name"
                    required
                    type="text"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Roll Number *" htmlFor="edit-roll">
                  <input
                    id="edit-roll"
                    required
                    type="text"
                    value={editingStudent.roll}
                    onChange={(e) => setEditingStudent({ ...editingStudent, roll: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Department *" htmlFor="edit-dept">
                  <select
                    id="edit-dept"
                    required
                    value={editingStudent.department || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select Department...</option>
                    {editAvailableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </Field>
                {/*
                <Field label="Department" htmlFor="edit-dept-old">
                  <input
                    id="edit-dept"
                    type="text"
                    value={editingStudent.department || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                */ null}

                <Field label="Section *" htmlFor="edit-sec">
                  <input
                    id="edit-sec"
                    required
                    type="text"
                    value={editingStudent.section}
                    onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CGPA" htmlFor="edit-cgpa">
                  <input
                    id="edit-cgpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editingStudent.cgpa}
                    onChange={(e) => setEditingStudent({ ...editingStudent, cgpa: parseFloat(e.target.value) })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Readiness (%)" htmlFor="edit-read">
                  <input
                    id="edit-read"
                    type="number"
                    min="0"
                    max="100"
                    value={editingStudent.readiness}
                    onChange={(e) => setEditingStudent({ ...editingStudent, readiness: parseInt(e.target.value, 10) })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Support Signal" htmlFor="edit-sig">
                <select
                  id="edit-sig"
                  value={editingStudent.signal}
                  onChange={(e) => setEditingStudent({ ...editingStudent, signal: e.target.value as StudentItem["signal"] })}
                  className={inputClass}
                >
                  <option value="None">None</option>
                  <option value="Review suggested">Review suggested</option>
                  <option value="At risk">At risk</option>
                  <option value="High performer">High performer</option>
                </select>
              </Field>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <Button type="button" variant="secondary" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={updateMutation.isPending} className="flex items-center gap-1.5 font-semibold">
                  {updateMutation.isPending ? <Spinner className="size-3.5" /> : <Edit3 className="size-3.5" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: DELETE CONFIRMATION (DELETE) ── */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-rose/10 text-rose shrink-0">
                <Trash2 className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">Delete Student?</h3>
                <p className="text-xs text-ink-3">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-ink-2 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-ink">{deletingStudent.name}</span> (Roll: <span className="font-mono text-xs">{deletingStudent.roll}</span>) from department records?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="secondary" onClick={() => setDeletingStudent(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingStudent.id)}
                className="flex items-center gap-1.5 font-semibold"
              >
                {deleteMutation.isPending ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                Delete Student
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
