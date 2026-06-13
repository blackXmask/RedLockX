import React, { useState } from "react";
import {
  useGetStats,
  useGetAttackTypeBreakdown,
  useGetRecentActivity,
  getGetStatsQueryKey,
  getGetAttackTypeBreakdownQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import {
  Shield, ShieldAlert, Activity, BarChart3,
  TrendingUp, Percent, RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
} from "recharts";

const ATTACK_COLORS = ["#ef4444","#f97316","#eab308","#3b82f6","#8b5cf6","#06b6d4"];
const POLL_MS = 30_000;

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10)]} ${parseInt(d, 10)}`;
}

function fmtDateLong(iso: string) {
  const [yr, m, d] = iso.split("-");
  const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10)]} ${parseInt(d, 10)}, ${yr}`;
}

export default function Dashboard() {
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useGetStats({
    query: {
      queryKey: getGetStatsQueryKey(),
      refetchInterval: POLL_MS,
      staleTime: 10_000,
    },
  });
  const { data: attackTypes, isLoading: isLoadingTypes, refetch: refetchTypes } = useGetAttackTypeBreakdown({
    query: {
      queryKey: getGetAttackTypeBreakdownQueryKey(),
      refetchInterval: POLL_MS,
      staleTime: 10_000,
    },
  });
  const { data: activity, isLoading: isLoadingActivity, refetch: refetchActivity } = useGetRecentActivity({
    query: {
      queryKey: getGetRecentActivityQueryKey(),
      refetchInterval: POLL_MS,
      staleTime: 10_000,
    },
  });

  function handleRefresh() {
    refetchStats();
    refetchTypes();
    refetchActivity();
    setLastRefresh(new Date());
  }

  const hasActivity = activity && activity.length > 0 && activity.some((d) => d.analyzed > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Dashboard</h2>
          <p className="text-sm text-slate-500 font-mono mt-0.5">
            Threat landscape & firewall traffic overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:block text-[10px] font-mono text-slate-600">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-blue-500/50 hover:bg-blue-500/10 text-slate-400 hover:text-white transition-all text-xs font-mono"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Analyzed"
          value={stats?.totalAnalyzed}
          loading={isLoadingStats}
          icon={<Activity className="h-5 w-5 text-blue-400" />}
          accent="blue"
        />
        <StatCard
          title="Total Blocked"
          value={stats?.totalBlocked}
          loading={isLoadingStats}
          icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
          accent="red"
        />
        <StatCard
          title="Block Rate"
          value={stats?.blockRate != null ? `${stats.blockRate.toFixed(1)}%` : "0%"}
          loading={isLoadingStats}
          icon={<Percent className="h-5 w-5 text-yellow-400" />}
          accent="yellow"
        />
        <StatCard
          title="Avg Risk Score"
          value={stats?.avgRiskScore != null ? `${stats.avgRiskScore.toFixed(1)}` : "0"}
          loading={isLoadingStats}
          icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
          accent="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Traffic — grouped bar chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/40 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white tracking-wide">Traffic Analysis</p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">Last 7 days · allowed vs blocked</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Allowed
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Blocked
              </span>
            </div>
          </div>

          <div className="p-5 h-[280px]">
            {isLoadingActivity ? (
              <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" />
            ) : hasActivity ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activity}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.04)"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    stroke="#334155"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#334155"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "10px",
                      fontSize: "12px",
                      padding: "10px 14px",
                    }}
                    itemStyle={{ color: "#e2e8f0", fontFamily: "monospace" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "6px", fontFamily: "monospace", fontSize: "11px" }}
                    labelFormatter={(v: string) => fmtDateLong(v)}
                    formatter={(value: number, name: string) => [
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{value}</span>,
                      name,
                    ]}
                  />
                  <Bar dataKey="allowed" name="Allowed" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="blocked" name="Blocked" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-slate-500 text-sm font-medium">No traffic data yet</p>
                  <p className="text-slate-600 text-xs font-mono mt-1">Analyze a prompt to see activity here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attack Vectors */}
        <div className="rounded-xl border border-slate-700/60 bg-[hsl(222,47%,4%)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/40">
            <p className="text-sm font-bold text-white tracking-wide">Attack Vectors</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Distribution of blocked payload types</p>
          </div>
          <div className="p-5 h-[280px]">
            {isLoadingTypes ? (
              <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" />
            ) : attackTypes && attackTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={attackTypes}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="rgba(255,255,255,0.03)"
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="attackType"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
                    width={88}
                    tickFormatter={(v: string) => v.replace(/_/g, " ")}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "10px",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    itemStyle={{ color: "#e2e8f0", fontFamily: "monospace" }}
                    labelStyle={{ color: "#94a3b8", fontSize: "11px", fontFamily: "monospace" }}
                    labelFormatter={(v: string) => v.replace(/_/g, " ")}
                    formatter={(value: number) => [
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{value} detections</span>,
                      "",
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {attackTypes.map((_, i) => (
                      <Cell key={i} fill={ATTACK_COLORS[i % ATTACK_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-slate-500 text-sm font-medium">No attacks detected</p>
                  <p className="text-slate-600 text-xs font-mono mt-1">All clear — no blocked prompts yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Accent = "blue" | "red" | "yellow" | "purple";

const accentMap: Record<Accent, { border: string; bg: string; text: string; iconBg: string }> = {
  blue:   { border: "border-blue-500/30",   bg: "from-blue-500/6",   text: "text-blue-400",   iconBg: "bg-blue-500/10 border-blue-500/25" },
  red:    { border: "border-red-500/30",    bg: "from-red-500/6",    text: "text-red-400",    iconBg: "bg-red-500/10 border-red-500/25" },
  yellow: { border: "border-yellow-500/25", bg: "from-yellow-500/6", text: "text-yellow-400", iconBg: "bg-yellow-500/10 border-yellow-500/25" },
  purple: { border: "border-purple-500/30", bg: "from-purple-500/6", text: "text-purple-400", iconBg: "bg-purple-500/10 border-purple-500/25" },
};

function StatCard({
  title, value, icon, loading, accent,
}: {
  title: string; value?: number | string; icon: React.ReactNode; loading: boolean; accent: Accent;
}) {
  const a = accentMap[accent];
  return (
    <div className={`rounded-xl border ${a.border} bg-gradient-to-br ${a.bg} to-transparent bg-[hsl(222,47%,4%)] p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${a.iconBg}`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20 bg-slate-800/60" />
      ) : (
        <p className={`text-3xl font-black font-mono tabular-nums ${a.text}`}>
          {value !== undefined ? value : "—"}
        </p>
      )}
    </div>
  );
}
