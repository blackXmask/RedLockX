import React from "react";
import { format } from "date-fns";
import {
  useGetStats,
  useGetAttackTypeBreakdown,
  useGetRecentActivity,
  getGetStatsQueryKey,
  getGetAttackTypeBreakdownQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import { Shield, ShieldAlert, Activity, BarChart3, TrendingUp, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const ATTACK_COLORS = ["#ef4444","#f97316","#eab308","#3b82f6","#8b5cf6","#06b6d4"];

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey() },
  });
  const { data: attackTypes, isLoading: isLoadingTypes } = useGetAttackTypeBreakdown({
    query: { queryKey: getGetAttackTypeBreakdownQueryKey() },
  });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Dashboard</h2>
          <p className="text-base text-slate-400 mt-0.5">Threat landscape & firewall traffic overview</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase">Live</span>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic chart */}
        <div className="lg:col-span-2 rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-white">Traffic Analysis</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Last 7 days — allowed vs blocked</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />Allowed</span>
              <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />Blocked</span>
            </div>
          </div>
          <div className="p-4 h-[280px]">
            {isLoadingActivity ? (
              <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" />
            ) : activity && activity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAllowed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), "MMM d")}
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="monospace"
                  />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} fontFamily="monospace" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px", fontFamily: "monospace" }}
                    labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                  />
                  <Area type="monotone" dataKey="allowed" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#gAllowed)" name="Allowed" />
                  <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" strokeWidth={2} fill="url(#gBlocked)" name="Blocked" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm font-mono">No activity data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attack types */}
        <div className="rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/50">
            <p className="text-base font-bold text-white">Attack Vectors</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Distribution of blocked payload types</p>
          </div>
          <div className="p-4 h-[280px]">
            {isLoadingTypes ? (
              <Skeleton className="w-full h-full rounded-lg bg-slate-800/50" />
            ) : attackTypes && attackTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attackTypes} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="attackType"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    stroke="#64748b"
                    fontSize={10}
                    width={90}
                    fontFamily="monospace"
                    tickFormatter={(v: string) => v.replace(/_/g, " ").slice(0, 14)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {attackTypes.map((_, i) => (
                      <Cell key={i} fill={ATTACK_COLORS[i % ATTACK_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Shield className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm font-mono">No attacks detected</p>
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
  blue:   { border: "border-blue-500/40",   bg: "from-blue-500/8",   text: "text-blue-400",   iconBg: "bg-blue-500/15 border-blue-500/30" },
  red:    { border: "border-red-500/40",    bg: "from-red-500/8",    text: "text-red-400",    iconBg: "bg-red-500/15 border-red-500/30" },
  yellow: { border: "border-yellow-500/35", bg: "from-yellow-500/8", text: "text-yellow-400", iconBg: "bg-yellow-500/15 border-yellow-500/30" },
  purple: { border: "border-purple-500/40", bg: "from-purple-500/8", text: "text-purple-400", iconBg: "bg-purple-500/15 border-purple-500/30" },
};

function StatCard({
  title, value, icon, loading, accent,
}: {
  title: string; value?: number | string; icon: React.ReactNode; loading: boolean; accent: Accent;
}) {
  const a = accentMap[accent];
  return (
    <div className={`rounded-xl border-2 ${a.border} bg-gradient-to-br ${a.bg} to-transparent bg-[hsl(222,47%,5%)] p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-500">{title}</p>
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
