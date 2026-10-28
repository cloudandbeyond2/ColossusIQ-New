"use client";

import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/api/schemas";
import { Card, CardHeader } from "@/components/ui/primitives";

export const SERIES_COLORS = ["var(--brand)", "var(--gold)", "var(--teal)", "var(--sky)", "var(--rose)", "var(--amber)"];

const axis = { stroke: "var(--ink-3)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)", fontSize: 12 },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink-2)" },
  cursor: { fill: "var(--surface-2)" },
};

export function ChartView({ spec, height = 260 }: { spec: ChartSpec; height?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const legend = spec.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} iconType="circle" iconSize={8} /> : null;

  if (!mounted) {
    return <div style={{ height }} role="img" aria-label={`${spec.title} chart`} />;
  }

  return (
    <div style={{ height }} role="img" aria-label={`${spec.title} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {spec.type === "bar" ? (
          <BarChart data={spec.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey={spec.xKey} {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tooltipStyle} />
            {legend}
            {spec.series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={36} />
            ))}
          </BarChart>
        ) : spec.type === "line" ? (
          <LineChart data={spec.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey={spec.xKey} {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--line)" }} />
            {legend}
            {spec.series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : spec.type === "area" ? (
          <AreaChart data={spec.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey={spec.xKey} {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--line)" }} />
            {legend}
            {spec.series.map((s, i) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={2.5}
              />
            ))}
          </AreaChart>
        ) : spec.type === "donut" ? (
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} iconType="circle" iconSize={8} />
            <Pie data={spec.data} dataKey={spec.series[0] ?? "value"} nameKey={spec.xKey} innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--surface)">
              {spec.data.map((_, i) => (
                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <RadarChart data={spec.data} outerRadius="72%">
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey={spec.xKey} tick={{ fill: "var(--ink-2)", fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            {legend}
            {spec.series.map((s, i) => (
              <Radar key={s} dataKey={s} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={0.2} />
            ))}
          </RadarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartCard({ spec }: { spec: ChartSpec }) {
  return (
    <Card>
      <CardHeader title={spec.title} />
      <div className="px-3 pb-4 pt-2">
        <ChartView spec={spec} />
      </div>
    </Card>
  );
}
