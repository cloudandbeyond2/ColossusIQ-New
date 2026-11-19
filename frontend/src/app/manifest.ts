import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ColossusIQ.ai — Higher Education OS",
    short_name: "ColossusIQ",
    description: "AI mentor, learning, assessments, projects and careers for every student and campus.",
    start_url: "/login",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#1e2a5a",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
