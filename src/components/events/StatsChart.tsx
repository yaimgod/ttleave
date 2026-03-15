"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartPoint {
  date: string;
  daysReduced: number;
  score?: number;
}

export function StatsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="daysReduced"
          name="Days advanced"
          stroke="#6366f1"
          fill="#6366f120"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
