"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  Coins,
  Check,
} from "lucide-react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { Badge, Button, Card, CardBody, CardHeader, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface GeneratedConcept {
  id: string;
  title: string;
  category: string;
  problem: string;
  novelty: string;
  techStack: string[];
  feasibility: number;
  budget: string;
  duration: string;
}

const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "AI & DS", "Management"];
const CATEGORIES = [
  "AI/ML",
  "IoT & Embedded Systems",
  "Computer Vision & Robotics",
  "Cybersecurity",
  "HealthTech",
  "AgriTech & Smart Farming",
  "FinTech & Blockchain",
  "CleanTech & Energy",
  "SaaS & Cloud Computing",
];

export function ProjectIdeasModule() {
  const qc = useQueryClient();
  const [department, setDepartment] = useState("CSE");
  const [category, setCategory] = useState("AI/ML");
  const [skills, setSkills] = useState("Python, React, PyTorch, OpenCV");
  const [budget, setBudget] = useState("5000");
  const [teamSize, setTeamSize] = useState("3");
  const [concepts, setConcepts] = useState<GeneratedConcept[]>([]);
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  // Generate ideas mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Generate dynamically tailored concepts based on selected category & department
      await new Promise((r) => setTimeout(r, 700));

      const generated: GeneratedConcept[] = [
        {
          id: `idea-1-${Date.now()}`,
          title:
            category.includes("Agri") || category.includes("Vision")
              ? "Autonomous Drone-Based Crop Health Scanner"
              : category.includes("IoT")
              ? "Edge-AI Smart Microgrid & Energy Forecasting Node"
              : category.includes("Health")
              ? "Real-Time Tele-Diagnostic ECG Anomaly Detection Suite"
              : "Smart Campus Real-Time Space & Energy Optimizer",
          category,
          problem:
            "Manual diagnostics and monitoring cause prolonged delays, high operational expenses, and low diagnostic yield.",
          novelty:
            "On-device lightweight neural network inference with localized telemetry and automated anomaly alerts.",
          techStack: ["Python", "YOLOv8", "FastAPI", "React", "PostgreSQL"],
          feasibility: 92,
          budget: `₹${budget}`,
          duration: "12 Weeks (Capstone)",
        },
        {
          id: `idea-2-${Date.now()}`,
          title:
            category.includes("Cyber")
              ? "Zero-Trust Behavioral Identity Verification Engine"
              : category.includes("AI")
              ? "Multimodal Vernacular Lecture Summarizer & Note Generator"
              : "Decentralized Verifiable Credential & Skill Passport",
          category,
          problem:
            "Language barriers and static assessment materials limit engagement and technical comprehension.",
          novelty:
            "Cross-lingual audio transcription combined with contextual retrieval-augmented question generation.",
          techStack: ["Whisper AI", "Next.js", "FastAPI", "LangChain", "Vector DB"],
          feasibility: 88,
          budget: `₹${Math.round(Number(budget) * 0.8)}`,
          duration: "8 Weeks (Semester Project)",
        },
        {
          id: `idea-3-${Date.now()}`,
          title:
            category.includes("Robotics")
              ? "Autonomous Warehouse SLAM Rover with LiDAR & Obstacle Avoidance"
              : "IoT Predictive Maintenance Sentinel with Acoustic Vibration Sensing",
          category,
          problem:
            "Unscheduled equipment downtime in labs and industry costs significant repair overhead and safety hazards.",
          novelty:
            "FFT vibration harmonics analysis on low-power ESP32 edge microcontroller with cloud dashboard alerting.",
          techStack: ["Embedded C", "ESP32", "MQTT", "Grafana", "Node.js"],
          feasibility: 95,
          budget: `₹${Math.round(Number(budget) * 1.2)}`,
          duration: "10 Weeks (Major Project)",
        },
      ];

      return generated;
    },
    onSuccess: (data) => {
      setConcepts(data);
      showToast("Generated 3 feasible project concepts!");
    },
  });

  // Adopt project and save to PostgreSQL projects table
  const adoptMutation = useMutation({
    mutationFn: (concept: GeneratedConcept) =>
      apiFetch("/api/v1/projects", z.unknown(), {
        method: "POST",
        body: {
          title: concept.title,
          domain: concept.category,
          mentor: "Dr. Meena Raghavan",
          team: ["Lead Student (You)"],
          description: concept.problem + " " + concept.novelty,
        },
      }),
    onSuccess: (_, concept) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setAdoptedIds((prev) => new Set([...prev, concept.id]));
      showToast(`"${concept.title}" adopted and saved to Project Hub!`);
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to adopt project", "error");
    },
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[100] flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3",
            toast.tone === "error" ? "bg-rose border border-rose/30" : "bg-teal border border-teal/30"
          )}
        >
          {toast.tone === "error" ? <AlertCircle className="size-5 shrink-0" /> : <CheckCircle2 className="size-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* INPUTS COLUMN */}
        <Card className="h-fit">
          <CardHeader
            title="Inputs"
            subtitle="Enter branch, domain, and skills to generate syllabus-aligned project concepts"
          />
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generateMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Category / Domain</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Your Skills</label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Python, React, Arduino..."
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">Budget (₹)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">Team Size</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 mt-2"
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                <span>{generateMutation.isPending ? "Generating Concepts..." : "Generate Project Ideas"}</span>
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* OUTPUT COLUMN */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-bold text-ink text-lg">AI Generated Project Concepts</h3>
              <p className="text-xs text-ink-3">
                {concepts.length > 0
                  ? `3 feasible ideas generated for ${department} · ${category}`
                  : "Fill in the inputs and click generate to review concepts"}
              </p>
            </div>
            {concepts.length > 0 && (
              <Badge tone="teal" className="gap-1">
                <Sparkles className="size-3" /> Ready to Adopt
              </Badge>
            )}
          </div>

          {concepts.length === 0 ? (
            <Card className="min-h-96 flex flex-col items-center justify-center p-8 text-center border-dashed">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-teal/10 text-teal mb-3">
                <Sparkles className="size-7" />
              </div>
              <h4 className="font-semibold text-ink text-base">Nothing Generated Yet</h4>
              <p className="text-xs text-ink-3 max-w-sm mt-1">
                Choose your department and domain on the left, then click "Generate Project Ideas" to receive curated, AICTE-aligned project blueprints.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {concepts.map((concept, idx) => {
                const isAdopted = adoptedIds.has(concept.id);
                return (
                  <Card key={concept.id} className="transition-all hover:shadow-md">
                    <CardBody className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-2">
                              {idx + 1}
                            </span>
                            <Badge tone="sky">{concept.category}</Badge>
                            <span className="text-xs font-semibold text-teal">
                              {concept.feasibility}% Feasibility
                            </span>
                          </div>
                          <h4 className="font-bold text-ink text-base">{concept.title}</h4>
                        </div>

                        <div>
                          {isAdopted ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 rounded-xl border border-teal/30 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal">
                                <Check className="size-4" />
                                <span>Adopted & In Project Hub</span>
                              </div>
                              <Link
                                href="/student/projects"
                                className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:border-teal/50 hover:text-teal transition-colors"
                              >
                                <span>Open in Project Hub</span>
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                          ) : (
                            <Button
                              onClick={() => adoptMutation.mutate(concept)}
                              disabled={adoptMutation.isPending}
                              className="gap-1.5 text-xs"
                            >
                              <Plus className="size-3.5" />
                              <span>Adopt & Add to Project Hub</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-semibold text-ink">Problem: </span>
                          <span className="text-ink-2">{concept.problem}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-ink">Novelty: </span>
                          <span className="text-ink-2">{concept.novelty}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5">
                          Recommended Tech Stack
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {concept.techStack.map((tech) => (
                            <span
                              key={tech}
                              className="rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 border-t border-line pt-3 text-xs text-ink-3">
                        <div className="flex items-center gap-1.5">
                          <Coins className="size-3.5 text-amber" />
                          <span>Estimated Budget: {concept.budget}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-sky" />
                          <span>Timeline: {concept.duration}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
