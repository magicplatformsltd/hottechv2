"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartDataPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const SUBSCRIBERS_COLOR = "#10b981";
const OPENS_COLOR = "#3b82f6";
const PAGEVIEWS_COLOR = "#f59e0b";
const NEW_POSTS_COLOR = "#8b5cf6";

const LEGEND_LABELS: Record<string, string> = {
  newSubscribers: "New Subscribers",
  newsletterOpens: "Newsletter Opens",
  pageviews: "Pageviews",
  newPosts: "Posts Published",
};

const METRIC_KEYS = [
  { key: "pageviews", label: "Pageviews", color: PAGEVIEWS_COLOR },
  { key: "newSubscribers", label: "Subscribers", color: SUBSCRIBERS_COLOR },
  { key: "newsletterOpens", label: "Newsletter Opens", color: OPENS_COLOR },
  { key: "newPosts", label: "Posts Published", color: NEW_POSTS_COLOR },
] as const;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-hot-gray px-3 py-2 shadow-lg">
      <p className="mb-1 font-sans text-xs font-medium text-gray-400">{label}</p>
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <span
            key={p.dataKey}
            className="font-sans text-sm"
            style={{
              color:
                p.dataKey === "newSubscribers"
                  ? SUBSCRIBERS_COLOR
                  : p.dataKey === "newsletterOpens"
                    ? OPENS_COLOR
                    : p.dataKey === "pageviews"
                      ? PAGEVIEWS_COLOR
                      : NEW_POSTS_COLOR,
            }}
          >
            {p.dataKey && LEGEND_LABELS[p.dataKey]}: {p.value ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PerformanceChart({ data }: { data: ChartDataPoint[] }) {
  const [visible, setVisible] = useState({
    pageviews: true,
    newSubscribers: true,
    newsletterOpens: true,
    newPosts: true,
  });

  const toggle = (key: keyof typeof visible) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      {/* Metric toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {METRIC_KEYS.map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-full px-3 py-1.5 font-sans text-sm font-medium transition-colors border",
              visible[key]
                ? "hover:opacity-90"
                : "border-white/10 bg-white/5 text-gray-500 hover:border-white/20 hover:text-gray-400"
            )}
            style={
              visible[key]
                ? {
                    borderColor: `${color}80`,
                    backgroundColor: `${color}20`,
                    color: color,
                  }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            yAxisId="left"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            orientation="left"
          />
          <YAxis
            yAxisId="right"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            orientation="right"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            formatter={(value) => (
              <span className="text-gray-300">
                {LEGEND_LABELS[value] ?? value}
              </span>
            )}
          />
          {visible.pageviews && (
            <Line
              type="monotone"
              dataKey="pageviews"
              name="pageviews"
              yAxisId="left"
              stroke={PAGEVIEWS_COLOR}
              strokeWidth={2}
              dot={{ fill: PAGEVIEWS_COLOR, r: 3 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {visible.newSubscribers && (
            <Line
              type="monotone"
              dataKey="newSubscribers"
              name="newSubscribers"
              yAxisId="right"
              stroke={SUBSCRIBERS_COLOR}
              strokeWidth={2}
              dot={{ fill: SUBSCRIBERS_COLOR, r: 3 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {visible.newsletterOpens && (
            <Line
              type="monotone"
              dataKey="newsletterOpens"
              name="newsletterOpens"
              yAxisId="right"
              stroke={OPENS_COLOR}
              strokeWidth={2}
              dot={{ fill: OPENS_COLOR, r: 3 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {visible.newPosts && (
            <Bar
              dataKey="newPosts"
              name="newPosts"
              yAxisId="right"
              fill={NEW_POSTS_COLOR}
              fillOpacity={0.3}
              radius={[4, 4, 0, 0]}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
