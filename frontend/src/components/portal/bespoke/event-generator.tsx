"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Clock,
  DollarSign,
  Users,
  MapPin,
  CheckCircle2,
  Trash2,
  Plus,
  Edit3,
  Copy,
  Check,
  Download,
  Send,
  FileText,
  Layers,
  Sliders,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Save,
  Megaphone,
  UserCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ── Types & Data Models ────────────────────────────── */

export type EventCategory =
  | "Hackathon"
  | "Workshop"
  | "Seminar"
  | "Cultural"
  | "Sports"
  | "Alumni"
  | "Social service";

export interface SessionItem {
  id: string;
  time: string;
  title: string;
  speaker: string;
  room: string;
  type: "keynote" | "workshop" | "break" | "competition" | "networking" | "valedictory";
  description: string;
}

export interface BudgetItem {
  id: string;
  category: "Venue & AV" | "Speakers & Honorarium" | "Food & Catering" | "Prizes & Awards" | "Printing & Merch" | "Logistics & Contingency";
  item: string;
  amount: number;
  notes: string;
}

export interface VolunteerSquad {
  id: string;
  team: string;
  lead: string;
  headcount: number;
  tasks: { id: string; text: string; done: boolean }[];
}

export interface EventPlan {
  id: string;
  title: string;
  tagline: string;
  category: EventCategory;
  department: string;
  audience: number;
  duration: string;
  date: string;
  startTime: string;
  venue: string;
  budget: number;
  organiser: string;
  description: string;
  highlights: string[];
  status: "Draft" | "Published";
  publishedId?: string;
  createdAt: string;

  sessions: SessionItem[];
  budgetItems: BudgetItem[];
  promo: {
    emailSubject: string;
    emailBody: string;
    instagram: string;
    linkedin: string;
    whatsapp: string;
    posterTagline: string;
  };
  formFields: {
    rollNo: boolean;
    department: boolean;
    semester: boolean;
    phone: boolean;
    mealPreference: boolean;
    githubUrl: boolean;
    teamName: boolean;
    tshirtSize: boolean;
    laptopRequired: boolean;
  };
  customQuestions: string[];
  volunteerSquads: VolunteerSquad[];
  milestones: { id: string; phase: string; title: string; deadline: string; done: boolean }[];
}

/* ── Presets ────────────────────────────────────────── */

const PRESETS = [
  {
    name: "🚀 AI & Cloud Hackathon",
    title: "CodeForge 2026: National GenAI & Cloud Hackathon",
    tagline: "36 hours of non-stop innovation building sovereign AI applications",
    category: "Hackathon" as EventCategory,
    department: "Computer Science & Engineering",
    audience: 500,
    duration: "2 Days (36 Hours)",
    budget: 200000,
    venue: "Innovation Center & Central Lab Complex",
    highlights: ["Hands-on Labs", "Cash Prizes (₹75k)", "Buffet Lunch & Snacks", "Sponsor Booths", "Mentorship Sessions", "Digital Badges"],
  },
  {
    name: "🎭 Annual Cultural Fest",
    title: "Tarang 2026: Inter-College Cultural Extravaganza",
    tagline: "Celebrating rhythm, arts, theatrical brilliance and student talent",
    category: "Cultural" as EventCategory,
    department: "Student Activity Council & Cultural Cell",
    audience: 1500,
    duration: "2 Days",
    budget: 450000,
    venue: "Main Campus Open-Air Amphitheatre",
    highlights: ["Celebrity Band Night", "Battle of the Bands", "Fashion Walk", "Street Play", "Food Truck Street", "Trophies & Mementos"],
  },
  {
    name: "💡 DeepTech & Research Summit",
    title: "National Symposium on Quantum & Edge Computing",
    tagline: "Fostering academic rigor and patent-driven engineering research",
    category: "Seminar" as EventCategory,
    department: "Electronics & Communication Engineering",
    audience: 350,
    duration: "1 Day",
    budget: 120000,
    venue: "Dr. APJ Abdul Kalam Auditorium",
    highlights: ["Keynote Lectures", "Paper Presentations", "Poster Sessions", "Networking High Tea", "Best Paper Awards", "Scopus Indexed Journal"],
  },
  {
    name: "💼 Placement & Hiring Sprint",
    title: "Campus to Corporate: NextGen Placement Accelerator",
    tagline: "Intensive hiring readiness bootcamp with Tier-1 engineering leaders",
    category: "Workshop" as EventCategory,
    department: "Training & Placement Cell",
    audience: 300,
    duration: "1 Day",
    budget: 85000,
    venue: "Management Seminar Hall & GD Suites",
    highlights: ["Mock Technical Interviews", "DSA System Design Drill", "Resume Teardowns", "Panel with Hiring Managers", "Placement Fast-Track Pass"],
  },
  {
    name: "🏆 Inter-College Sports Meet",
    title: "Synergy 2026: Annual Inter-Collegiate Athletics Meet",
    tagline: "Unleashing endurance, camaraderie and athletic sportsmanship",
    category: "Sports" as EventCategory,
    department: "Department of Physical Education",
    audience: 800,
    duration: "3 Days",
    budget: 220000,
    venue: "University Sports Arena & Athletic Track",
    highlights: ["Track & Field", "Cricket & Football", "Badminton Championship", "Medal Ceremony", "Sports Kits & Refreshments"],
  },
];

/* ── Default Plan Generator Function ───────────────── */

function buildInitialPlan(overrides?: Partial<EventPlan>): EventPlan {
  const title = overrides?.title || "Campus Event Blueprint";
  const category = overrides?.category || "Workshop";
  const dept = overrides?.department || "Academic Affairs";
  const audience = overrides?.audience || 100;
  const budget = overrides?.budget || 50000;
  const venue = overrides?.venue || "Main Campus Auditorium";
  const duration = overrides?.duration || "1 Day";

  const venueCost = Math.round(budget * 0.22);
  const speakerCost = Math.round(budget * 0.18);
  const foodCost = Math.round(budget * 0.32);
  const prizeCost = Math.round(budget * 0.14);
  const printCost = Math.round(budget * 0.08);
  const contingencyCost = budget - (venueCost + speakerCost + foodCost + prizeCost + printCost);

  return {
    id: overrides?.id || `PLAN-${Date.now()}`,
    title,
    tagline: overrides?.tagline || `Empowering participants through real-world learning and collaborative experiences`,
    category,
    department: dept,
    audience,
    duration,
    date: overrides?.date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    startTime: overrides?.startTime || "09:00",
    venue,
    budget,
    organiser: overrides?.organiser || (dept ? `Department of ${dept}` : "Campus Organizing Committee"),
    description:
      overrides?.description ||
      `A high-impact ${duration.toLowerCase()} ${category.toLowerCase()} bringing together ${audience} participants at ${venue}.`,
    highlights: overrides?.highlights || ["Keynote Lectures", "Hands-on Workshops", "Project Expo", "Networking Lunch", "Certificates & Awards"],
    status: overrides?.status || "Draft",
    publishedId: overrides?.publishedId,
    createdAt: overrides?.createdAt || new Date().toISOString(),

    sessions: [
      {
        id: "s1",
        time: "09:00 - 09:45",
        title: "Registration, Welcome Kit & High Tea",
        speaker: "Event Organizing Committee",
        room: `${venue} Foyer`,
        type: "break",
        description: "Student badge collection, credential verification, and welcome high tea.",
      },
      {
        id: "s2",
        time: "09:45 - 10:45",
        title: "Inaugural Keynote & Opening Address",
        speaker: "Chief Guest & Domain Specialist",
        room: venue,
        type: "keynote",
        description: "Welcome speech by leadership, lamp lighting ceremony, and inaugural keynote address.",
      },
      {
        id: "s3",
        time: "11:00 - 13:00",
        title: "Interactive Masterclass & Deep-Dive Tracks",
        speaker: "Faculty Leads & Technology Mentors",
        room: `${venue} Seminar Rooms`,
        type: "workshop",
        description: "Hands-on engineering tracks where students build working prototypes with code walkthroughs.",
      },
      {
        id: "s4",
        time: "13:00 - 14:00",
        title: "Networking Lunch & Project Expo",
        speaker: "Open Interaction",
        room: "Campus Banquet / Dining Hall",
        type: "networking",
        description: "Curated lunch for attendees, speakers, and recruiters with partner exhibition stalls.",
      },
      {
        id: "s5",
        time: "14:00 - 16:15",
        title: "Rapid Hack Sprint & Live Pitch Battle",
        speaker: "Evaluation Jury Panel",
        room: venue,
        type: "competition",
        description: "Participant teams present working demos with short pitches followed by live Q&A.",
      },
      {
        id: "s6",
        time: "16:30 - 17:30",
        title: "Valedictory Ceremony, Awards & Mementos",
        speaker: "Patron & Event Coordinator",
        room: venue,
        type: "valedictory",
        description: "Announcement of category winners, certificate distribution, feedback collection, and group photography.",
      },
    ],

    budgetItems: [
      { id: "b1", category: "Venue & AV", item: "Auditorium Rental, Sound System & AV Feeds", amount: venueCost, notes: "Main hall lighting, microphones, and stage setup" },
      { id: "b2", category: "Speakers & Honorarium", item: "Keynote Speakers Honorarium, Travel & Lodging", amount: speakerCost, notes: "External guest speakers travel & hospitality" },
      { id: "b3", category: "Food & Catering", item: "Morning Tea, Buffet Lunch & Evening Refreshments", amount: foodCost, notes: `Buffet catering for ${audience} attendees & guests` },
      { id: "b4", category: "Prizes & Awards", item: "Prizes for Winners & Recognition Trophies", amount: prizeCost, notes: "Top winners awards and mementos for guests" },
      { id: "b5", category: "Printing & Merch", item: "Lanyards, ID Badges, Posters & Participation Certificates", amount: printCost, notes: `${audience} participant kits and vinyl banners` },
      { id: "b6", category: "Logistics & Contingency", item: "Emergency Logistics, Medical First-Aid & Reserve", amount: contingencyCost, notes: "Unforeseen expenses and operational buffer" },
    ],

    promo: {
      emailSubject: `Invitation: ${title} — Secure Your Spot Today!`,
      emailBody: `Dear Students and Faculty Colleagues,\n\nThe ${dept} is delighted to announce ${title}, scheduled on ${overrides?.date || new Date(Date.now() + 14 * 86400000).toLocaleDateString()} at ${venue}.\n\nThis premier campus event features keynote addresses from renowned domain experts, hands-on masterclasses, and an exciting competition sprint with ₹${(Math.round(budget * 0.14)).toLocaleString("en-IN")} in prizes.\n\nKey Highlights:\n- Dedicated Hands-on Learning Tracks\n- Live Project Pitch Showcase with Industry Judges\n- Verified Digital Certificates for all attendees\n- Networking Buffet Lunch included\n\nSeats are strictly limited to ${audience} participants. Early registration is mandatory.\n\nWarm regards,\nOrganizing Committee\n${dept}`,
      instagram: `⚡ MARK YOUR CALENDARS: ${title} is here! 🚀\n\nGet ready for ${duration.toLowerCase()} of interactive learning, masterclasses, and networking! 🔥\n\n📍 Venue: ${venue}\n👥 Capacity: ${audience} seats\n\n🔗 Link in bio to register before slots fill up!\n\n#CampusLife #${dept.replace(/\s+/g, "")} #Innovation #CollegeLife`,
      linkedin: `We are thrilled to officially announce "${title}", hosted by the ${dept} at ${venue}.\n\nThis landmark event brings together over ${audience} aspiring technologists, faculty researchers, and industry pioneers to deliberate on emerging technological frontiers.\n\nHighlights include:\n✅ Expert Keynote Addresses\n✅ Hands-on Technical Deep-Dives\n✅ Competitive Project Pitches with Awards\n✅ Career Networking with Industry Partners\n\nRegistration and agenda details are now live on the campus portal.\n\n#HigherEducation #CampusLife #FutureOfTech`,
      whatsapp: `📢 *OFFICIAL NOTICE: ${title}*\n\nHey everyone! The ${dept} invites you to ${title}! 🚀\n\n📍 *Venue:* ${venue}\n👥 *Capacity:* ${audience} seats\n🎁 *Perks:* Food & Kits, Verified Certificates, Prize Pool!\n\n_Register early to secure your spot!_`,
      posterTagline: `Join ${title} — Premier Campus Event.`,
    },

    formFields: {
      rollNo: true,
      department: true,
      semester: true,
      phone: true,
      mealPreference: true,
      githubUrl: category === "Hackathon",
      teamName: category === "Hackathon",
      tshirtSize: true,
      laptopRequired: category === "Workshop" || category === "Hackathon",
    },

    customQuestions: [
      "What is your primary area of interest?",
      "Do you require any accessibility accommodations?",
    ],

    volunteerSquads: [
      {
        id: "vs1",
        team: "Registration & Desk Coordination",
        lead: "Registration Lead Coordinator",
        headcount: 4,
        tasks: [
          { id: "t1", text: "Set up registration counters & check-in systems", done: true },
          { id: "t2", text: "Sort ID badges & welcome kits alphabetically", done: true },
          { id: "t3", text: "Manage spot entries and attendance desk", done: false },
        ],
      },
      {
        id: "vs2",
        team: "Technical & AV Production",
        lead: "Technical Lead Coordinator",
        headcount: 4,
        tasks: [
          { id: "t4", text: "Test auditorium audio-visual feeds and projection", done: true },
          { id: "t5", text: "Deploy dedicated high-speed Wi-Fi SSID for attendees", done: false },
          { id: "t6", text: "Setup live stream recording & presentation clickers", done: false },
        ],
      },
      {
        id: "vs3",
        team: "Hospitality & Guest Relations",
        lead: "Hospitality Lead Coordinator",
        headcount: 3,
        tasks: [
          { id: "t7", text: "Coordinate arrival and reception for keynote speakers", done: true },
          { id: "t8", text: "Prepare VIP lounge, water bottles & welcome bouquets", done: false },
          { id: "t9", text: "Escort dignitaries to stage for lamp lighting", done: false },
        ],
      },
      {
        id: "vs4",
        team: "Food, Catering & Logistics",
        lead: "Logistics Lead Coordinator",
        headcount: 4,
        tasks: [
          { id: "t10", text: "Supervise buffet setup and hygienic drinking water points", done: false },
          { id: "t11", text: "Distribute refreshment coupons and manage crowd flow", done: false },
          { id: "t12", text: "Coordinate waste disposal and clean campus drive", done: false },
        ],
      },
      {
        id: "vs5",
        team: "Media, PR & Live Coverage",
        lead: "Media Lead Coordinator",
        headcount: 3,
        tasks: [
          { id: "t13", text: "Capture high-res photos & video reels during keynotes", done: false },
          { id: "t14", text: "Publish real-time stories to college social handles", done: false },
          { id: "t15", text: "Draft post-event press release for university website", done: false },
        ],
      },
    ],

    milestones: [
      { id: "m1", phase: "T - 30 Days", title: "Faculty approval & auditorium booking", deadline: "Completed", done: true },
      { id: "m2", phase: "T - 21 Days", title: "Keynote speakers confirmation & travel", deadline: "Completed", done: true },
      { id: "m3", phase: "T - 14 Days", title: "Launch registration portal & social campaign", deadline: "In Progress", done: true },
      { id: "m4", phase: "T - 7 Days", title: "Catering & kit printing order lock", deadline: "Pending", done: false },
      { id: "m5", phase: "T - 1 Day", title: "Dry run of AV, stage lighting & registration desk", deadline: "Scheduled", done: false },
      { id: "m6", phase: "Event Day", title: "Full execution, awards & feedback collection", deadline: "Scheduled", done: false },
    ],
  };
}

/* ── Main Bespoke Module Component ──────────────────── */

export function EventGeneratorModule({ role }: { role: Role }) {
  const qc = useQueryClient();

  // Query campus events to see what's currently in the institution store
  const campusEventsQuery = useQuery({
    queryKey: ["campus-events-list"],
    queryFn: () => apiFetch("/api/v1/records/events", z.any()),
  });

  // Extract live events items, total and active count from query
  const eventItems = useMemo(() => {
    if (campusEventsQuery.data && typeof campusEventsQuery.data === "object") {
      if (Array.isArray(campusEventsQuery.data.items)) {
        return campusEventsQuery.data.items;
      }
    }
    return [];
  }, [campusEventsQuery.data]);

  const totalEvents = useMemo(() => {
    if (campusEventsQuery.data && typeof campusEventsQuery.data === "object") {
      if (typeof campusEventsQuery.data.total === "number") return campusEventsQuery.data.total;
    }
    return eventItems.length;
  }, [campusEventsQuery.data, eventItems]);

  const activeEventsCount = useMemo(() => {
    if (campusEventsQuery.data && typeof campusEventsQuery.data === "object") {
      if (campusEventsQuery.data.counts && typeof campusEventsQuery.data.counts === "object") {
        const published = (campusEventsQuery.data.counts as Record<string, number>).Published;
        if (typeof published === "number") return published;
      }
    }
    const publishedList = eventItems.filter((i: any) => i.status === "Published");
    return publishedList.length > 0 ? publishedList.length : totalEvents;
  }, [campusEventsQuery.data, eventItems, totalEvents]);

  // Current active plan (starts empty/null until generated or selected)
  const [plan, setPlan] = useState<EventPlan | null>(null);
  // Saved plans archive (persisted to localStorage)
  const [savedPlans, setSavedPlans] = useState<EventPlan[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("colossusiq_saved_event_plans");
      if (stored) {
        setSavedPlans(JSON.parse(stored));
      }
    } catch { }
  }, []);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<
    "overview" | "agenda" | "budget" | "promo" | "forms" | "volunteers"
  >("overview");

  // Generator form input state - starts clean without dummy data
  const [inputTitle, setInputTitle] = useState("");
  const [inputCategory, setInputCategory] = useState<EventCategory>("Workshop");
  const [inputDepartment, setInputDepartment] = useState("");
  const [inputAudience, setInputAudience] = useState<number | "">("");
  const [inputDuration, setInputDuration] = useState("1 Day");
  const [inputDate, setInputDate] = useState("");
  const [inputStartTime, setInputStartTime] = useState("09:00");
  const [inputVenue, setInputVenue] = useState("");
  const [inputBudget, setInputBudget] = useState<number | "">("");
  const [inputBrief, setInputBrief] = useState("");

  // Live input change handlers that keep plan preview synchronized
  const handleTitleChange = (val: string) => {
    setInputTitle(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, title: val } : null));
    }
  };
  const handleCategoryChange = (val: EventCategory) => {
    setInputCategory(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, category: val } : null));
    }
  };
  const handleDepartmentChange = (val: string) => {
    setInputDepartment(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, department: val } : null));
    }
  };
  const handleAudienceChange = (val: string) => {
    const num = val === "" ? "" : Number(val);
    setInputAudience(num);
    if (plan && typeof num === "number") {
      setPlan((prev) => (prev ? { ...prev, audience: num } : null));
    }
  };
  const handleDurationChange = (val: string) => {
    setInputDuration(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, duration: val } : null));
    }
  };
  const handleDateChange = (val: string) => {
    setInputDate(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, date: val } : null));
    }
  };
  const handleStartTimeChange = (val: string) => {
    setInputStartTime(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, startTime: val } : null));
    }
  };
  const handleVenueChange = (val: string) => {
    setInputVenue(val);
    if (plan) {
      setPlan((prev) => (prev ? { ...prev, venue: val } : null));
    }
  };
  const handleBudgetChange = (val: string) => {
    const num = val === "" ? "" : Number(val);
    setInputBudget(num);
    if (plan && typeof num === "number") {
      setPlan((prev) => (prev ? { ...prev, budget: num } : null));
    }
  };

  // Filter for Agenda
  const [agendaFilter, setAgendaFilter] = useState<string>("all");

  // Editing state for agenda
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSession, setNewSession] = useState<Partial<SessionItem>>({
    time: "11:30 - 12:30",
    title: "",
    speaker: "",
    room: "",
    type: "workshop",
    description: "",
  });

  // Adding budget item
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState<Partial<BudgetItem>>({
    category: "Food & Catering",
    item: "",
    amount: 10000,
    notes: "",
  });

  // UI status feedbacks
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  // Copy helper
  const copyText = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  // Publish to Campus Events mutation with REAL data post and academic calendar sync
  const publishMutation = useMutation({
    mutationFn: async ({ status }: { status: "Published" | "Draft" }) => {
      if (!plan) throw new Error("No active blueprint to publish");
      const realTitle = (inputTitle || plan.title || "Campus Event").trim().slice(0, 100);
      const realCategory = (inputCategory || plan.category || "Workshop") as EventCategory;
      const realDate = (inputDate || plan.date || new Date().toISOString().slice(0, 10)).trim();
      const rawStartTime = (inputStartTime || plan.startTime || "09:00").trim();
      const realStartTime = rawStartTime.length >= 5 ? rawStartTime.slice(0, 5) : "09:00";
      const realVenue = (inputVenue || plan.venue || "Main Campus Auditorium").trim().slice(0, 80);
      const realDept = (inputDepartment || plan.department || "Academic Affairs").trim();
      const realOrganiser = (plan.organiser || (realDept ? `Department of ${realDept}` : "Campus Life Committee")).trim().slice(0, 80);
      const realCapacity = Math.max(1, Math.min(20000, Number(inputAudience || plan.audience) || 100));
      const realBudget = Number(inputBudget || plan.budget) || 0;
      const realDuration = inputDuration || plan.duration || "1 Day";

      const desc = `${plan.tagline || ""}\n\n${plan.description || ""}\n\nBudget: ₹${realBudget.toLocaleString("en-IN")}\nDuration: ${realDuration}`;
      const realDescription = desc.slice(0, 1500);

      const payload = {
        data: {
          title: realTitle,
          type: realCategory,
          date: realDate,
          startTime: realStartTime,
          venue: realVenue,
          organiser: realOrganiser,
          capacity: realCapacity,
          registrationOpen: true,
          status,
          description: realDescription,
        },
      };

      const res = await apiFetch("/api/v1/records/events", z.any(), {
        method: "POST",
        body: payload,
      });

      // Synchronize to Academic Calendar
      try {
        await apiFetch("/api/v1/academic-calendar/sync-events", z.any(), { method: "POST" });
      } catch {
        // Safe to ignore if role does not manage calendar
      }

      return {
        id: (res as { id?: string })?.id,
        title: realTitle,
        category: realCategory,
        date: realDate,
        startTime: realStartTime,
        venue: realVenue,
        department: realDept,
        capacity: realCapacity,
        budget: realBudget,
        duration: realDuration,
        status,
      };
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["campus-events-list"] });
      await qc.refetchQueries({ queryKey: ["campus-events-list"] });
      await qc.invalidateQueries({ queryKey: ["records", "events"] });
      await qc.invalidateQueries({ queryKey: ["academic-calendar"] });

      setPlan((p) => {
        if (!p) return null;
        return {
          ...p,
          title: data.title,
          category: data.category,
          date: data.date,
          startTime: data.startTime,
          venue: data.venue,
          department: data.department,
          audience: data.capacity,
          budget: data.budget,
          duration: data.duration,
          status: data.status,
          publishedId: data.id || "EVT-OK",
        };
      });

      setPublishSuccess(
        `Event "${data.title}" successfully published to Campus Events! (Record ID: ${data.id || "EVT-NEW"})`
      );
      setTimeout(() => setPublishSuccess(null), 8000);
    },
  });

  // Dynamic AI Generation Simulator
  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep(1);

    setTimeout(() => setGenerationStep(2), 500);
    setTimeout(() => setGenerationStep(3), 1100);
    setTimeout(() => setGenerationStep(4), 1700);

    setTimeout(() => {
      const title = inputTitle.trim() || `${inputCategory} Event ${new Date().getFullYear()}`;
      const department = inputDepartment.trim() || "Academic Affairs";
      const audience = typeof inputAudience === "number" && inputAudience > 0 ? inputAudience : 100;
      const budget = typeof inputBudget === "number" && inputBudget > 0 ? inputBudget : 50000;
      const venue = inputVenue.trim() || "Main Campus Auditorium";
      const duration = inputDuration || "1 Day";
      const date = inputDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const startTime = inputStartTime || "09:00";

      const newGenerated = buildInitialPlan({
        title,
        category: inputCategory,
        department,
        audience,
        duration,
        date,
        startTime,
        venue,
        budget,
        description: inputBrief.trim() || `Curated ${duration.toLowerCase()} ${inputCategory.toLowerCase()} bringing together ${audience} participants at ${venue}.`,
        tagline: `Premier ${inputCategory.toLowerCase()} curated for ${audience} participants by ${department}.`,
      });

      setPlan(newGenerated);
      setIsGenerating(false);
      setGenerationStep(0);
      setActiveTab("overview");
    }, 2300);
  };

  // Load a preset with instant 1-click update
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setInputTitle(preset.title);
    setInputCategory(preset.category);
    setInputDepartment(preset.department);
    setInputAudience(preset.audience);
    setInputDuration(preset.duration);
    setInputVenue(preset.venue);
    setInputBudget(preset.budget);
    setInputBrief(preset.tagline);

    const generated = buildInitialPlan({
      title: preset.title,
      category: preset.category,
      department: preset.department,
      audience: preset.audience,
      duration: preset.duration,
      date: inputDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      startTime: inputStartTime || "09:00",
      venue: preset.venue,
      budget: preset.budget,
      description: preset.tagline,
      tagline: `Premier ${preset.category.toLowerCase()} curated for ${preset.audience} participants by the ${preset.department}.`,
    });
    setPlan(generated);
  };

  // Save current plan into archive
  const handleSavePlan = () => {
    if (!plan) return;
    setSavedPlans((prev) => {
      const filtered = prev.filter((p) => p.id !== plan.id);
      const updated = [plan, ...filtered];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("colossusiq_saved_event_plans", JSON.stringify(updated));
        } catch { }
      }
      return updated;
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  // Calculate Budget Metrics
  const totalAllocated = useMemo(() => {
    if (!plan) return 0;
    return plan.budgetItems.reduce((sum, item) => sum + item.amount, 0);
  }, [plan]);

  const budgetVariance = plan ? plan.budget - totalAllocated : 0;
  const costPerStudent = plan && plan.audience > 0 ? Math.round(totalAllocated / plan.audience) : 0;
  const budgetUtilization = plan ? Math.round((totalAllocated / (plan.budget || 1)) * 100) : 0;

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!plan) return [];
    if (agendaFilter === "all") return plan.sessions;
    return plan.sessions.filter((s) => s.type === agendaFilter);
  }, [plan, agendaFilter]);

  // Export as Markdown
  const exportMarkdown = () => {
    if (!plan) return;
    const md = `# ${plan.title}
*${plan.tagline}*

- **Category:** ${plan.category}
- **Organising Dept:** ${plan.department}
- **Expected Footfall:** ${plan.audience} students
- **Date & Time:** ${plan.date} at ${plan.startTime}
- **Venue:** ${plan.venue}
- **Total Budget:** ₹${plan.budget.toLocaleString("en-IN")} (₹${costPerStudent}/attendee)
- **Status:** ${plan.status}

---

## 📌 Executive Overview
${plan.description}

### Highlights
${plan.highlights.map((h) => `- ${h}`).join("\n")}

---

## 🕒 Master Agenda
| Time | Session | Speaker / Host | Venue | Type |
|---|---|---|---|---|
${plan.sessions
        .map((s) => `| ${s.time} | **${s.title}** | ${s.speaker} | ${s.room} | ${s.type.toUpperCase()} |`)
        .join("\n")}

---

## 💰 Itemised Financial Budget (Total: ₹${totalAllocated.toLocaleString("en-IN")})
| Category | Line Item | Amount (₹) | Notes |
|---|---|---|---|
${plan.budgetItems
        .map((b) => `| ${b.category} | ${b.item} | ₹${b.amount.toLocaleString("en-IN")} | ${b.notes} |`)
        .join("\n")}

---

## 📢 Promotional Broadcast Copy
### Email Subject:
${plan.promo.emailSubject}

### Email Body:
${plan.promo.emailBody}

### WhatsApp Broadcast:
${plan.promo.whatsapp}

---
*Generated by ColossusIQ AI Event Generator on ${new Date().toLocaleDateString()}*
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${plan.title.replace(/[^a-zA-Z0-9]/g, "_")}_Event_Plan.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* ── Top Bar & Stats ─────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand shrink-0">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink">AI Event Generator Studio</h1>
                <Badge tone="brand">{role.toUpperCase()}</Badge>
                {campusEventsQuery.isLoading ? (
                  <Badge tone="sky" className="inline-flex items-center gap-1.5 py-0.5 text-xs">
                    <Spinner className="size-3" /> Loading events...
                  </Badge>
                ) : (
                  <Link
                    href={`/${role}/events`}
                    title="Click to view all live events in Campus Events"
                    className="inline-flex items-center transition-transform hover:scale-[1.02]"
                  >
                    <Badge tone="sky" className="cursor-pointer font-medium hover:ring-1 hover:ring-sky/40 inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                      {activeEventsCount} {activeEventsCount === 1 ? "Event" : "Events"} Active
                    </Badge>
                  </Link>
                )}
                {plan ? (
                  plan.status === "Published" ? (
                    <Badge tone="teal" className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Published to Campus
                    </Badge>
                  ) : (
                    <Badge tone="amber">Draft Blueprint</Badge>
                  )
                ) : (
                  <Badge tone="neutral">No Active Blueprint</Badge>
                )}
              </div>
              <p className="text-xs text-ink-3 truncate mt-0.5">
                Plan, optimize budgets, schedule agendas, generate marketing copy, and publish directly to Campus Life.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Button
            variant="secondary"
            size="sm"
            disabled={!plan}
            onClick={handleSavePlan}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
          >
            {saveToast ? <Check className="size-3.5 text-teal" /> : <Save className="size-3.5" />}
            {saveToast ? "Saved!" : "Save Blueprint"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!plan}
            onClick={exportMarkdown}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
          >
            <Download className="size-3.5" /> Export .MD
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={!plan || publishMutation.isPending}
            onClick={() => publishMutation.mutate({ status: "Published" })}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            {publishMutation.isPending ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
            Publish to Campus Events
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {publishSuccess && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/60 px-4 py-3 text-sm text-teal shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="size-4 shrink-0 text-teal" />
            <span className="truncate">{publishSuccess}</span>
          </div>
          <Link
            href={`/${role}/events`}
            className="font-semibold underline hover:text-teal/80 flex items-center gap-1 text-xs shrink-0"
          >
            Open Campus Events <ExternalLink className="size-3" />
          </Link>
        </div>
      )}

      {/* ── Main Layout: Configurator & Dynamic Workspace ──── */}
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] w-full min-w-0">
        {/* ── Left Column: Generator Form & Quick Presets ──── */}
        <div className="space-y-5 min-w-0 w-full">
          {/* Quick Presets Carousel */}
          <Card className="p-4 bg-surface-2/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
                <Sliders className="size-3.5 text-brand" /> Quick-Start Presets
              </span>
              <span className="text-[11px] text-ink-3">1-Click Load</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center justify-between w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-medium text-ink hover:border-brand/40 hover:bg-brand-soft/30 transition-all overflow-hidden"
                >
                  <span className="truncate">{preset.name}</span>
                  <span className="text-[10px] text-ink-3 shrink-0 ml-2">₹{(preset.budget / 1000).toFixed(0)}k · {preset.audience}p</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Configuration Form */}
          <Card>
            <CardHeader
              title={<span className="text-sm font-semibold">Event Parameters</span>}
              subtitle="Tune variables to re-synthesize blueprint"
            />
            <CardBody className="space-y-4 pt-2">
              <Field label="Event Title" htmlFor="evt-title">
                <input
                  id="evt-title"
                  type="text"
                  value={inputTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. National Hackathon 2026"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Category" htmlFor="evt-cat">
                  <select
                    id="evt-cat"
                    value={inputCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as EventCategory)}
                    className={inputClass}
                  >
                    <option value="Workshop">Workshop</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Alumni">Alumni</option>
                    <option value="Social service">Social service</option>
                  </select>
                </Field>

                <Field label="Duration" htmlFor="evt-dur">
                  <select
                    id="evt-dur"
                    value={inputDuration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Half Day">Half Day (4h)</option>
                    <option value="1 Day">1 Full Day</option>
                    <option value="2 Days">2 Days</option>
                    <option value="3 Days">3 Days</option>
                    <option value="Weekend (36h)">Weekend (36h)</option>
                  </select>
                </Field>
              </div>

              <Field label="Organising Department / Cell" htmlFor="evt-dept">
                <input
                  id="evt-dept"
                  type="text"
                  value={inputDepartment}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Computer Science & Engineering"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Expected Footfall" htmlFor="evt-aud">
                  <div className="space-y-1">
                    <input
                      id="evt-aud"
                      type="number"
                      min={10}
                      max={5000}
                      step={50}
                      value={inputAudience}
                      onChange={(e) => handleAudienceChange(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 500"
                    />
                    <div className="text-[10px] text-ink-3 flex justify-between">
                      <span>Attendees</span>
                      {typeof inputAudience === "number" && inputAudience > 0 && typeof inputBudget === "number" && inputBudget > 0 ? (
                        <span className="font-medium text-brand">₹{(inputBudget / inputAudience).toFixed(0)}/head</span>
                      ) : null}
                    </div>
                  </div>
                </Field>

                <Field label="Total Budget (₹)" htmlFor="evt-bud">
                  <div className="space-y-1">
                    <input
                      id="evt-bud"
                      type="number"
                      min={5000}
                      max={2000000}
                      step={5000}
                      value={inputBudget}
                      onChange={(e) => handleBudgetChange(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 150000"
                    />
                    <div className="text-[10px] text-ink-3 text-right font-medium">
                      {typeof inputBudget === "number" && inputBudget > 0 ? `₹${inputBudget.toLocaleString("en-IN")}` : ""}
                    </div>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Target Date" htmlFor="evt-date">
                  <input
                    id="evt-date"
                    type="date"
                    value={inputDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Start Time" htmlFor="evt-time">
                  <input
                    id="evt-time"
                    type="time"
                    value={inputStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Venue / Facility" htmlFor="evt-ven">
                <input
                  id="evt-ven"
                  type="text"
                  value={inputVenue}
                  onChange={(e) => handleVenueChange(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Main Auditorium"
                />
              </Field>

              <Field label="Brief & Special Instructions" htmlFor="evt-brief">
                <textarea
                  id="evt-brief"
                  rows={3}
                  value={inputBrief}
                  onChange={(e) => setInputBrief(e.target.value)}
                  className={inputClass}
                  placeholder="Keynotes, target sponsors, specific workshops..."
                />
              </Field>

              <Button
                type="button"
                className="w-full flex items-center justify-center gap-2"
                disabled={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? <Spinner /> : <Sparkles className="size-4" />}
                {isGenerating ? "Synthesizing Plan…" : "Generate AI Event Plan"}
              </Button>

              {isGenerating && (
                <div className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2 space-y-1.5 animate-pulse">
                  <div className="flex items-center gap-2 text-brand font-medium">
                    <Spinner />
                    {generationStep === 1 && "Optimizing attendee capacity & venue logistics…"}
                    {generationStep === 2 && "Synthesizing multi-track agenda & session timelines…"}
                    {generationStep === 3 && "Balancing budget allocations & emergency reserve…"}
                    {generationStep === 4 && "Drafting promotional campaign pack & registration schemas…"}
                  </div>
                  <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand h-1.5 transition-all duration-500"
                      style={{ width: `${(generationStep / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Saved Blueprints Library */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Saved Event Plans ({savedPlans.length})
              </span>
              {savedPlans.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedPlans([]);
                    if (typeof window !== "undefined") {
                      try {
                        localStorage.removeItem("colossusiq_saved_event_plans");
                      } catch { }
                    }
                  }}
                  className="text-[10px] text-ink-3 hover:text-rose transition-colors"
                  title="Clear all saved plans"
                >
                  Clear All
                </button>
              )}
            </div>
            {savedPlans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-ink-3">
                No saved blueprints yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedPlans.map((sp) => (
                  <div
                    key={sp.id}
                    onClick={() => {
                      setPlan(sp);
                      setInputTitle(sp.title);
                      setInputCategory(sp.category);
                      setInputDepartment(sp.department);
                      setInputAudience(sp.audience);
                      setInputBudget(sp.budget);
                      setInputVenue(sp.venue);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                      plan && sp.id === plan.id
                        ? "border-brand bg-brand-soft/40 font-medium text-brand"
                        : "border-line bg-surface hover:bg-surface-2 text-ink"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-semibold">{sp.title}</p>
                      <p className="text-[10px] text-ink-3">
                        {sp.category} · {sp.audience} students · ₹{(sp.budget / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right Column: Dynamic Workspace Tabs ─────────── */}
        <div className="space-y-5 min-w-0 w-full overflow-hidden">
          {!plan ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface p-8 sm:p-12 text-center min-h-[500px]">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
                <Sparkles className="size-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-ink mb-2">
                No Event Blueprint Generated Yet
              </h2>
              <p className="text-sm text-ink-3 max-w-lg mb-6 leading-relaxed">
                Configure your event parameters on the left and click &ldquo;Generate AI Event Plan&rdquo; — or pick one of the Quick-Start Presets — to synthesize a complete executive blueprint, timeline agenda, itemised budget, volunteer squads, and marketing kit.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left mb-6">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-line bg-surface-2/40">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
                    <Layers className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Executive Blueprint</h4>
                    <p className="text-[11px] text-ink-3">High-level KPIs, readiness checklist & hall matching</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-line bg-sky/10 text-sky shrink-0">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky/10 text-sky shrink-0">
                    <Clock className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Agenda & Timeline</h4>
                    <p className="text-[11px] text-ink-3">Multi-track schedules with speakers, rooms, and sessions</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-line bg-gold/10 text-gold shrink-0">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-gold/10 text-gold shrink-0">
                    <DollarSign className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Budget Planner</h4>
                    <p className="text-[11px] text-ink-3">Auto-balanced allocations, per-head costs & contingency buffer</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-line bg-rose/10 text-rose shrink-0">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-rose/10 text-rose shrink-0">
                    <Megaphone className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Promo Kit & Volunteers</h4>
                    <p className="text-[11px] text-ink-3">Ready broadcast copy, registration form schema & squad tasks</p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="flex items-center gap-2"
                disabled={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? <Spinner /> : <Sparkles className="size-4" />}
                {isGenerating ? "Synthesizing Plan…" : "Generate AI Event Plan"}
              </Button>
            </div>
          ) : (
            <>
              {/* Navigation Tabs - Responsive Scrollable Bar */}
              <div className="w-full border-b border-line pb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar touch-pan-x -mb-px">
                  {[
                    { id: "overview", label: "Executive Blueprint", icon: Layers },
                    { id: "agenda", label: `Agenda & Timeline (${plan.sessions.length})`, icon: Clock },
                    { id: "budget", label: "Budget Planner", icon: DollarSign },
                    { id: "promo", label: "Promotion Kit", icon: Megaphone },
                    { id: "forms", label: "Forms & Survey", icon: FileText },
                    { id: "volunteers", label: "Committees & Tasks", icon: Users },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                          active
                            ? "bg-brand text-white shadow-sm font-semibold"
                            : "bg-surface text-ink-2 hover:text-ink hover:bg-surface-2 border border-line/60"
                        )}
                      >
                        <Icon className="size-3.5 sm:size-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ═════════ TAB 1: EXECUTIVE BLUEPRINT ═════════ */}
              {activeTab === "overview" && (
                <div className="space-y-5 min-w-0 w-full">
                  {/* Event Hero Banner */}
                  <div className="rounded-2xl border border-line bg-gradient-to-r from-surface to-brand-soft/20 p-4 sm:p-6 relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-2xl min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="brand">{plan.category}</Badge>
                          <Badge tone="sky">{plan.duration}</Badge>
                          <span className="text-xs text-ink-3 flex items-center gap-1">
                            <MapPin className="size-3.5 shrink-0" /> {plan.venue}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink break-words">{plan.title}</h2>
                        <p className="text-xs sm:text-sm font-medium text-ink-2 break-words">{plan.tagline}</p>
                        <p className="text-xs text-ink-3 leading-relaxed break-words">{plan.description}</p>
                      </div>

                      <div className="rounded-xl border border-line bg-surface p-3.5 sm:p-4 text-center shrink-0 w-full lg:w-36 space-y-1 shadow-sm">
                        <span className="text-[11px] font-medium text-ink-3 uppercase">Status</span>
                        <div>
                          {plan.status === "Published" ? (
                            <span className="inline-flex items-center gap-1 text-teal font-semibold text-sm">
                              <CheckCircle2 className="size-4" /> Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber font-semibold text-sm">
                              <AlertCircle className="size-4" /> In Planning
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-ink-3 pt-1">
                          {plan.publishedId ? `ID: ${plan.publishedId}` : "Ready to push live"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* KPI Stat Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Card className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between text-ink-3 text-xs">
                        <span>Footfall Target</span>
                        <Users className="size-4 text-brand shrink-0" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-ink">{plan.audience}</span>
                        <span className="text-xs text-ink-3">students</span>
                      </div>
                      <div className="mt-1 text-[11px] text-teal flex items-center gap-1 truncate">
                        <CheckCircle2 className="size-3 shrink-0" /> Hall capacity matched
                      </div>
                    </Card>

                    <Card className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between text-ink-3 text-xs">
                        <span>Total Financials</span>
                        <DollarSign className="size-4 text-gold shrink-0" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-ink">₹{(plan.budget / 1000).toFixed(0)}k</span>
                        <span className="text-xs text-ink-3">allocated</span>
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3 truncate">
                        ₹{costPerStudent}/head economy
                      </div>
                    </Card>

                    <Card className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between text-ink-3 text-xs">
                        <span>Schedule Content</span>
                        <Clock className="size-4 text-sky shrink-0" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-ink">{plan.sessions.length}</span>
                        <span className="text-xs text-ink-3">tracks/sessions</span>
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3 truncate">
                        {plan.duration} intensive
                      </div>
                    </Card>

                    <Card className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between text-ink-3 text-xs">
                        <span>Coordinators Squad</span>
                        <UserCheck className="size-4 text-rose shrink-0" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-ink">
                          {plan.volunteerSquads.reduce((sum, s) => sum + s.headcount, 0)}
                        </span>
                        <span className="text-xs text-ink-3">volunteers</span>
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3 truncate">
                        Across 5 committees
                      </div>
                    </Card>
                  </div>

                  {/* Highlights & Preparation Roadmap */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    <Card>
                      <CardHeader
                        title="Key Program Highlights"
                        subtitle="Generated focus areas for attendees"
                      />
                      <CardBody className="space-y-2">
                        {plan.highlights.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-2 rounded-lg bg-surface-2/50 text-xs font-medium text-ink"
                          >
                            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-white text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span>{h}</span>
                          </div>
                        ))}
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader
                        title="Readiness Checklist"
                        subtitle="Operational countdown to launch"
                      />
                      <CardBody className="space-y-2.5">
                        {plan.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setPlan((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  milestones: prev.milestones.map((item) =>
                                    item.id === m.id ? { ...item, done: !item.done } : item
                                  ),
                                };
                              });
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface hover:bg-surface-2 cursor-pointer transition-colors text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={m.done}
                                onChange={() => { }}
                                className="rounded border-line text-brand focus:ring-brand"
                              />
                              <span className={cn(m.done && "line-through text-ink-3 font-normal", "font-medium text-ink")}>
                                {m.title}
                              </span>
                            </div>
                            <Badge tone={m.done ? "teal" : "neutral"}>{m.phase}</Badge>
                          </div>
                        ))}
                      </CardBody>
                    </Card>
                  </div>
                </div>
              )}

              {/* ═════════ TAB 2: DYNAMIC AGENDA BUILDER ═════════ */}
              {activeTab === "agenda" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-2/40 p-3 rounded-xl border border-line">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                      <span className="text-xs font-semibold text-ink-3 uppercase mr-1">Filter:</span>
                      {["all", "keynote", "workshop", "break", "competition", "networking", "valedictory"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAgendaFilter(type)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all",
                            agendaFilter === type
                              ? "bg-brand text-white shadow-sm"
                              : "bg-surface text-ink-2 hover:bg-surface-2 border border-line"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setIsAddingSession(true)}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="size-3.5" /> Add New Session
                    </Button>
                  </div>

                  {/* Add New Session Form */}
                  {isAddingSession && (
                    <Card className="p-4 border-brand/50 bg-brand-soft/20 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-brand">Add New Agenda Session</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingSession(false)}
                          className="text-xs text-ink-3 hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="Time Range" htmlFor="new-sess-time">
                          <input
                            id="new-sess-time"
                            type="text"
                            className={inputClass}
                            placeholder="e.g. 11:00 - 12:30"
                            value={newSession.time}
                            onChange={(e) => setNewSession((p) => ({ ...p, time: e.target.value }))}
                          />
                        </Field>
                        <Field label="Session Title" htmlFor="new-sess-title">
                          <input
                            id="new-sess-title"
                            type="text"
                            className={inputClass}
                            placeholder="e.g. Panel Discussion"
                            value={newSession.title}
                            onChange={(e) => setNewSession((p) => ({ ...p, title: e.target.value }))}
                          />
                        </Field>
                        <Field label="Session Type" htmlFor="new-sess-type">
                          <select
                            id="new-sess-type"
                            className={inputClass}
                            value={newSession.type}
                            onChange={(e) => setNewSession((p) => ({ ...p, type: e.target.value as SessionItem["type"] }))}
                          >
                            <option value="keynote">Keynote</option>
                            <option value="workshop">Workshop</option>
                            <option value="break">Break / Meals</option>
                            <option value="competition">Competition</option>
                            <option value="networking">Networking</option>
                            <option value="valedictory">Valedictory</option>
                          </select>
                        </Field>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <Field label="Speaker / Facilitator" htmlFor="new-sess-speaker">
                          <input
                            id="new-sess-speaker"
                            type="text"
                            className={inputClass}
                            placeholder="e.g. Dr. Ramesh Kumar"
                            value={newSession.speaker}
                            onChange={(e) => setNewSession((p) => ({ ...p, speaker: e.target.value }))}
                          />
                        </Field>
                        <Field label="Hall / Room" htmlFor="new-sess-room">
                          <input
                            id="new-sess-room"
                            type="text"
                            className={inputClass}
                            placeholder="e.g. Auditorium Hall A"
                            value={newSession.room}
                            onChange={(e) => setNewSession((p) => ({ ...p, room: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="mt-3">
                        <Field label="Short Description" htmlFor="new-sess-desc">
                          <input
                            id="new-sess-desc"
                            type="text"
                            className={inputClass}
                            placeholder="Key topics and deliverables for this session"
                            value={newSession.description}
                            onChange={(e) => setNewSession((p) => ({ ...p, description: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setIsAddingSession(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!newSession.title) return;
                            const item: SessionItem = {
                              id: `sess-${Date.now()}`,
                              time: newSession.time || "10:00 - 11:00",
                              title: newSession.title,
                              speaker: newSession.speaker || "TBA",
                              room: newSession.room || plan.venue,
                              type: newSession.type || "workshop",
                              description: newSession.description || "",
                            };
                            setPlan((p) => {
                              if (!p) return null;
                              return { ...p, sessions: [...p.sessions, item] };
                            });
                            setIsAddingSession(false);
                            setNewSession({ time: "11:30 - 12:30", title: "", speaker: "", room: "", type: "workshop", description: "" });
                          }}
                        >
                          Save Session
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Sessions List */}
                  <div className="space-y-3">
                    {filteredSessions.map((session, index) => {
                      const isEditing = editingSession?.id === session.id;

                      return (
                        <Card
                          key={session.id}
                          className={cn(
                            "p-4 transition-all hover:border-brand/40",
                            isEditing && "border-brand bg-brand-soft/10"
                          )}
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid sm:grid-cols-3 gap-3">
                                <Field label="Time" htmlFor="edit-sess-time">
                                  <input
                                    id="edit-sess-time"
                                    className={inputClass}
                                    value={editingSession.time}
                                    onChange={(e) => setEditingSession({ ...editingSession, time: e.target.value })}
                                  />
                                </Field>
                                <Field label="Title" htmlFor="edit-sess-title">
                                  <input
                                    id="edit-sess-title"
                                    className={inputClass}
                                    value={editingSession.title}
                                    onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })}
                                  />
                                </Field>
                                <Field label="Type" htmlFor="edit-sess-type">
                                  <select
                                    id="edit-sess-type"
                                    className={inputClass}
                                    value={editingSession.type}
                                    onChange={(e) => setEditingSession({ ...editingSession, type: e.target.value as SessionItem["type"] })}
                                  >
                                    <option value="keynote">Keynote</option>
                                    <option value="workshop">Workshop</option>
                                    <option value="break">Break / Meals</option>
                                    <option value="competition">Competition</option>
                                    <option value="networking">Networking</option>
                                    <option value="valedictory">Valedictory</option>
                                  </select>
                                </Field>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Speaker" htmlFor="edit-sess-speaker">
                                  <input
                                    id="edit-sess-speaker"
                                    className={inputClass}
                                    value={editingSession.speaker}
                                    onChange={(e) => setEditingSession({ ...editingSession, speaker: e.target.value })}
                                  />
                                </Field>
                                <Field label="Room" htmlFor="edit-sess-room">
                                  <input
                                    id="edit-sess-room"
                                    className={inputClass}
                                    value={editingSession.room}
                                    onChange={(e) => setEditingSession({ ...editingSession, room: e.target.value })}
                                  />
                                </Field>
                              </div>
                              <Field label="Description" htmlFor="edit-sess-desc">
                                <input
                                  id="edit-sess-desc"
                                  className={inputClass}
                                  value={editingSession.description}
                                  onChange={(e) => setEditingSession({ ...editingSession, description: e.target.value })}
                                />
                              </Field>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="secondary" onClick={() => setEditingSession(null)}>
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setPlan((p) => {
                                      if (!p) return null;
                                      return {
                                        ...p,
                                        sessions: p.sessions.map((s) => (s.id === editingSession.id ? editingSession : s)),
                                      };
                                    });
                                    setEditingSession(null);
                                  }}
                                >
                                  Save Edits
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3.5">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-ink">
                                  {index + 1}
                                </span>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm text-ink">{session.title}</span>
                                    <Badge
                                      tone={
                                        session.type === "keynote"
                                          ? "brand"
                                          : session.type === "workshop"
                                            ? "sky"
                                            : session.type === "competition"
                                              ? "gold"
                                              : session.type === "break"
                                                ? "teal"
                                                : "neutral"
                                      }
                                    >
                                      {session.type}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-ink-3">{session.description}</p>
                                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-3 pt-1">
                                    <span className="flex items-center gap-1 font-medium text-ink">
                                      <Clock className="size-3 text-brand" /> {session.time}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <UserCheck className="size-3" /> {session.speaker}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MapPin className="size-3" /> {session.room}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingSession(session)}
                                  className="size-8 p-0"
                                >
                                  <Edit3 className="size-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setPlan((p) => {
                                      if (!p) return null;
                                      return {
                                        ...p,
                                        sessions: p.sessions.filter((s) => s.id !== session.id),
                                      };
                                    });
                                  }}
                                  className="size-8 p-0 text-rose hover:text-rose hover:bg-rose-soft"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════ TAB 3: BUDGET & FINANCE PLANNER ═════════ */}
              {activeTab === "budget" && (
                <div className="space-y-5">
                  {/* Financial Dashboard Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card className="p-4">
                      <span className="text-xs font-medium text-ink-3">Total Allocated</span>
                      <div className="mt-1 text-2xl font-bold text-ink">
                        ₹{totalAllocated.toLocaleString("en-IN")}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3">
                        Cap: ₹{plan.budget.toLocaleString("en-IN")} ({budgetUtilization}%)
                      </div>
                    </Card>

                    <Card className="p-4">
                      <span className="text-xs font-medium text-ink-3">Budget Balance</span>
                      <div className={cn("mt-1 text-2xl font-bold", budgetVariance >= 0 ? "text-teal" : "text-rose")}>
                        {budgetVariance >= 0 ? `+₹${budgetVariance.toLocaleString("en-IN")}` : `-₹${Math.abs(budgetVariance).toLocaleString("en-IN")}`}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3">
                        {budgetVariance >= 0 ? "Under budget reserve" : "Over-budget! Trim items"}
                      </div>
                    </Card>

                    <Card className="p-4">
                      <span className="text-xs font-medium text-ink-3">Cost Efficiency</span>
                      <div className="mt-1 text-2xl font-bold text-ink">
                        ₹{costPerStudent}
                      </div>
                      <div className="mt-1 text-[11px] text-teal flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> per attendee for {plan.audience} students
                      </div>
                    </Card>
                  </div>

                  {/* Add Expense Line Item */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-ink">Itemised Cost Ledger</h3>
                    <Button size="sm" onClick={() => setIsAddingBudget(!isAddingBudget)}>
                      <Plus className="size-3.5 mr-1" /> Add Expense Item
                    </Button>
                  </div>

                  {isAddingBudget && (
                    <Card className="p-4 border-brand/50 bg-brand-soft/20 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Field label="Category" htmlFor="new-bud-cat">
                          <select
                            id="new-bud-cat"
                            className={inputClass}
                            value={newBudget.category}
                            onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value as BudgetItem["category"] })}
                          >
                            <option value="Venue & AV">Venue & AV</option>
                            <option value="Speakers & Honorarium">Speakers & Honorarium</option>
                            <option value="Food & Catering">Food & Catering</option>
                            <option value="Prizes & Awards">Prizes & Awards</option>
                            <option value="Printing & Merch">Printing & Merch</option>
                            <option value="Logistics & Contingency">Logistics & Contingency</option>
                          </select>
                        </Field>
                        <Field label="Expense Item Name" htmlFor="new-bud-item">
                          <input
                            id="new-bud-item"
                            className={inputClass}
                            placeholder="e.g. Mementos & Medals"
                            value={newBudget.item}
                            onChange={(e) => setNewBudget({ ...newBudget, item: e.target.value })}
                          />
                        </Field>
                        <Field label="Cost (₹)" htmlFor="new-bud-amount">
                          <input
                            id="new-bud-amount"
                            type="number"
                            className={inputClass}
                            value={newBudget.amount}
                            onChange={(e) => setNewBudget({ ...newBudget, amount: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Notes" htmlFor="new-bud-notes">
                          <input
                            id="new-bud-notes"
                            className={inputClass}
                            placeholder="Vendor or terms"
                            value={newBudget.notes}
                            onChange={(e) => setNewBudget({ ...newBudget, notes: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setIsAddingBudget(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!newBudget.item || !newBudget.amount) return;
                            const item: BudgetItem = {
                              id: `b-${Date.now()}`,
                              category: newBudget.category || "Food & Catering",
                              item: newBudget.item,
                              amount: Number(newBudget.amount),
                              notes: newBudget.notes || "",
                            };
                            setPlan((p) => {
                              if (!p) return null;
                              return { ...p, budgetItems: [...p.budgetItems, item] };
                            });
                            setIsAddingBudget(false);
                            setNewBudget({ category: "Food & Catering", item: "", amount: 10000, notes: "" });
                          }}
                        >
                          Save Item
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Budget Table */}
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-2 text-ink-3 uppercase text-[10px] tracking-wider border-b border-line">
                          <tr>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Line Item Description</th>
                            <th className="px-4 py-3">Notes & Quantities</th>
                            <th className="px-4 py-3 text-right">Amount (₹)</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {plan.budgetItems.map((b) => (
                            <tr key={b.id} className="hover:bg-surface-2/40 transition-colors">
                              <td className="px-4 py-3">
                                <Badge
                                  tone={
                                    b.category === "Venue & AV"
                                      ? "brand"
                                      : b.category === "Food & Catering"
                                        ? "teal"
                                        : b.category === "Prizes & Awards"
                                          ? "gold"
                                          : b.category === "Speakers & Honorarium"
                                            ? "sky"
                                            : "neutral"
                                  }
                                >
                                  {b.category}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-semibold text-ink">{b.item}</td>
                              <td className="px-4 py-3 text-ink-3">{b.notes}</td>
                              <td className="px-4 py-3 text-right font-bold text-ink">
                                ₹{b.amount.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlan((p) => {
                                      if (!p) return null;
                                      return {
                                        ...p,
                                        budgetItems: p.budgetItems.filter((item) => item.id !== b.id),
                                      };
                                    });
                                  }}
                                  className="text-ink-3 hover:text-rose p-1 transition-colors"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-2/80 font-bold border-t border-line">
                          <tr>
                            <td className="px-4 py-3 text-ink" colSpan={3}>
                              Grand Total
                            </td>
                            <td className="px-4 py-3 text-right text-brand text-sm">
                              ₹{totalAllocated.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {/* ═════════ TAB 4: PROMOTION SUITE ═════════ */}
              {activeTab === "promo" && (
                <div className="space-y-5">
                  {/* Email Broadcast */}
                  <Card>
                    <CardHeader
                      title="Official Invitation Email (Students & Faculty)"
                      subtitle="Ready-to-broadcast mail template"
                      action={
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => copyText(`${plan.promo.emailSubject}\n\n${plan.promo.emailBody}`, "email")}
                          className="flex items-center gap-1.5"
                        >
                          {copiedKey === "email" ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                          {copiedKey === "email" ? "Copied!" : "Copy Email"}
                        </Button>
                      }
                    />
                    <CardBody className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-ink-3 block mb-1">Subject Line:</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={plan.promo.emailSubject}
                          onChange={(e) =>
                            setPlan((p) => {
                              if (!p) return null;
                              return {
                                ...p,
                                promo: { ...p.promo, emailSubject: e.target.value },
                              };
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-ink-3 block mb-1">Email Body:</label>
                        <textarea
                          rows={8}
                          className={cn(inputClass, "font-mono text-xs leading-relaxed")}
                          value={plan.promo.emailBody}
                          onChange={(e) =>
                            setPlan((p) => {
                              if (!p) return null;
                              return {
                                ...p,
                                promo: { ...p.promo, emailBody: e.target.value },
                              };
                            })
                          }
                        />
                      </div>
                    </CardBody>
                  </Card>

                  {/* Social Channels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    {/* Instagram Script */}
                    <Card>
                      <CardHeader
                        title="Instagram Carousel Script"
                        subtitle="Visual copy with hashtags"
                        action={
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => copyText(plan.promo.instagram, "insta")}
                            className="flex items-center gap-1.5"
                          >
                            {copiedKey === "insta" ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                            {copiedKey === "insta" ? "Copied" : "Copy"}
                          </Button>
                        }
                      />
                      <CardBody>
                        <textarea
                          rows={7}
                          className={cn(inputClass, "text-xs font-sans")}
                          value={plan.promo.instagram}
                          onChange={(e) =>
                            setPlan((p) => {
                              if (!p) return null;
                              return {
                                ...p,
                                promo: { ...p.promo, instagram: e.target.value },
                              };
                            })
                          }
                        />
                      </CardBody>
                    </Card>

                    {/* LinkedIn Press Release */}
                    <Card>
                      <CardHeader
                        title="LinkedIn Corporate Post"
                        subtitle="Industry and sponsor facing announcement"
                        action={
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => copyText(plan.promo.linkedin, "linkedin")}
                            className="flex items-center gap-1.5"
                          >
                            {copiedKey === "linkedin" ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                            {copiedKey === "linkedin" ? "Copied" : "Copy"}
                          </Button>
                        }
                      />
                      <CardBody>
                        <textarea
                          rows={7}
                          className={cn(inputClass, "text-xs font-sans")}
                          value={plan.promo.linkedin}
                          onChange={(e) =>
                            setPlan((p) => {
                              if (!p) return null;
                              return {
                                ...p,
                                promo: { ...p.promo, linkedin: e.target.value },
                              };
                            })
                          }
                        />
                      </CardBody>
                    </Card>
                  </div>

                  {/* WhatsApp Broadcast */}
                  <Card>
                    <CardHeader
                      title="WhatsApp & Discord Class Broadcast"
                      subtitle="Snappy bulleted message for instant messaging channels"
                      action={
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => copyText(plan.promo.whatsapp, "wa")}
                          className="flex items-center gap-1.5"
                        >
                          {copiedKey === "wa" ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                          {copiedKey === "wa" ? "Copied!" : "Copy WhatsApp"}
                        </Button>
                      }
                    />
                    <CardBody>
                      <textarea
                        rows={5}
                        className={cn(inputClass, "font-sans text-xs")}
                        value={plan.promo.whatsapp}
                        onChange={(e) =>
                          setPlan((p) => {
                            if (!p) return null;
                            return {
                              ...p,
                              promo: { ...p.promo, whatsapp: e.target.value },
                            };
                          })
                        }
                      />
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* ═════════ TAB 5: REGISTRATION & FEEDBACK FORMS ═════════ */}
              {activeTab === "forms" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    {/* Form Fields Toggler */}
                    <Card>
                      <CardHeader
                        title="Registration Form Fields"
                        subtitle="Toggle required student registration inputs"
                      />
                      <CardBody className="space-y-3">
                        {(
                          [
                            { key: "rollNo", label: "Roll Number / University Reg No" },
                            { key: "department", label: "Academic Department & Branch" },
                            { key: "semester", label: "Current Semester / Year" },
                            { key: "phone", label: "WhatsApp Contact Number" },
                            { key: "mealPreference", label: "Meal Preference (Veg / Non-Veg)" },
                            { key: "githubUrl", label: "GitHub / Portfolio Profile" },
                            { key: "teamName", label: "Team Name (Hackathons & Quizzes)" },
                            { key: "tshirtSize", label: "T-Shirt / Kit Size (S, M, L, XL)" },
                            { key: "laptopRequired", label: "Brings Laptop with Chargers" },
                          ] as const
                        ).map((field) => (
                          <label
                            key={field.key}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface hover:bg-surface-2 cursor-pointer transition-colors text-xs font-medium"
                          >
                            <span className="text-ink">{field.label}</span>
                            <input
                              type="checkbox"
                              checked={plan.formFields[field.key]}
                              onChange={(e) => {
                                setPlan((p) => {
                                  if (!p) return null;
                                  return {
                                    ...p,
                                    formFields: {
                                      ...p.formFields,
                                      [field.key]: e.target.checked,
                                    },
                                  };
                                });
                              }}
                              className="rounded border-line text-brand focus:ring-brand size-4"
                            />
                          </label>
                        ))}
                      </CardBody>
                    </Card>

                    {/* Live Form Preview */}
                    <Card className="border-brand/40 bg-surface">
                      <CardHeader
                        title="Student Registration Preview"
                        subtitle="Interactive live preview of student form"
                      />
                      <CardBody className="space-y-3 pt-2">
                        <Field label="Full Name *" htmlFor="prev-name">
                          <input id="prev-name" type="text" className={inputClass} placeholder="e.g. Ananya Sen" />
                        </Field>
                        <Field label="College Email Address *" htmlFor="prev-email">
                          <input id="prev-email" type="email" className={inputClass} placeholder="ananya.sen@campus.edu" />
                        </Field>

                        {plan.formFields.rollNo && (
                          <Field label="Roll Number *" htmlFor="prev-roll">
                            <input id="prev-roll" type="text" className={inputClass} placeholder="23CS042" />
                          </Field>
                        )}

                        {plan.formFields.department && (
                          <Field label="Department" htmlFor="prev-dept">
                            <input id="prev-dept" type="text" className={inputClass} defaultValue={plan.department} />
                          </Field>
                        )}

                        {plan.formFields.mealPreference && (
                          <Field label="Dietary Preference" htmlFor="prev-diet">
                            <select id="prev-diet" className={inputClass}>
                              <option>Vegetarian</option>
                              <option>Non-Vegetarian</option>
                              <option>Vegan</option>
                            </select>
                          </Field>
                        )}

                        {plan.formFields.tshirtSize && (
                          <Field label="T-Shirt Size" htmlFor="prev-tshirt">
                            <select id="prev-tshirt" className={inputClass}>
                              <option>Medium (M)</option>
                              <option>Large (L)</option>
                              <option>Small (S)</option>
                              <option>Extra Large (XL)</option>
                            </select>
                          </Field>
                        )}

                        {plan.formFields.githubUrl && (
                          <Field label="GitHub / Project Portfolio" htmlFor="prev-github">
                            <input id="prev-github" type="url" className={inputClass} placeholder="https://github.com/username" />
                          </Field>
                        )}

                        <Button className="w-full mt-4" size="md">
                          Submit Event Registration
                        </Button>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Feedback Survey Form Preview */}
                  <Card>
                    <CardHeader
                      title="Post-Event Survey Schema"
                      subtitle="Auto-triggered upon attendance verification"
                    />
                    <CardBody className="space-y-4">
                      <div className="grid sm:grid-cols-3 gap-3">
                        {[
                          "1. Overall Event Experience (1-5★)",
                          "2. Speaker Clarity & Subject Mastery (1-5★)",
                          "3. Venue, AV & Catering Satisfaction (1-5★)",
                        ].map((q) => (
                          <div key={q} className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
                            <p className="font-semibold text-ink mb-2">{q}</p>
                            <div className="flex gap-1.5 text-gold">★★★★★</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-ink-3 block mb-1">Open Feedback Prompt:</label>
                        <input
                          type="text"
                          className={inputClass}
                          defaultValue="What was the most impactful takeaway, and what should we improve in the next edition?"
                        />
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* ═════════ TAB 6: VOLUNTEERS & COMMITTEES ═════════ */}
              {activeTab === "volunteers" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Volunteer & Coordination Squads</h3>
                      <p className="text-xs text-ink-3">
                        Assign student coordinators, manage headcount, and track preparation checklists.
                      </p>
                    </div>
                    <Badge tone="brand">
                      Total Staff: {plan.volunteerSquads.reduce((s, sq) => s + sq.headcount, 0)} Coordinators
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plan.volunteerSquads.map((squad) => (
                      <Card key={squad.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between border-b border-line pb-2.5">
                          <div>
                            <h4 className="font-bold text-sm text-ink">{squad.team}</h4>
                            <p className="text-xs text-brand font-medium">Lead: {squad.lead}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-ink-3">
                            <Users className="size-3.5 text-ink-2" />
                            <span className="font-bold text-ink">{squad.headcount}</span> members
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {squad.tasks.map((task) => (
                            <label
                              key={task.id}
                              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 cursor-pointer text-xs transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={task.done}
                                onChange={() => {
                                  setPlan((prev) => {
                                    if (!prev) return null;
                                    return {
                                      ...prev,
                                      volunteerSquads: prev.volunteerSquads.map((sq) =>
                                        sq.id === squad.id
                                          ? {
                                            ...sq,
                                            tasks: sq.tasks.map((t) =>
                                              t.id === task.id ? { ...t, done: !t.done } : t
                                            ),
                                          }
                                          : sq
                                      ),
                                    };
                                  });
                                }}
                                className="rounded border-line text-brand focus:ring-brand size-3.5"
                              />
                              <span className={cn(task.done && "line-through text-ink-3", "text-ink")}>
                                {task.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
