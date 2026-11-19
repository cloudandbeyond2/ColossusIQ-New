import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";
import { AGENTS } from "@/config/agents";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "AI Agent Mesh" };

const FLOW = ["User query", "Intent detection", "Context builder", "Agent router", "Tool execution", "Validation & safety", "Response with sources"];
const TONE = { Student: "brand", Faculty: "gold", Institution: "teal", Platform: "neutral" } as const;

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="Colossus AI Core"
        title="An agent mesh, not a single chatbot"
        description="Thirty specialised agents coordinated by an orchestrator, grounded by institutional RAG and governed by audit logs, prompt versioning, confidence scoring and human review."
      />
      <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit p-6">
          <p className="text-sm font-semibold text-ink">AI Orchestrator</p>
          <ol className="mt-4 space-y-1">
            {FLOW.map((f, i) => (
              <li key={f} className="text-center">
                <span className="block rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink">{f}</span>
                {i < FLOW.length - 1 ? <ArrowDown className="mx-auto my-1 size-4 text-ink-3" aria-hidden /> : null}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-ink-3">Model-agnostic LLM gateway: reasoning, fast chat, vision, speech and embedding models chosen by cost, latency, privacy and institution policy.</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((a, i) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-3">#{String(i + 1).padStart(2, "0")}</span>
                <Badge tone={TONE[a.audience]}>{a.audience}</Badge>
              </div>
              <h2 className="mt-2 font-sans text-base font-semibold text-ink">{a.name}</h2>
              <p className="mt-1 text-sm text-ink-2">{a.summary}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
