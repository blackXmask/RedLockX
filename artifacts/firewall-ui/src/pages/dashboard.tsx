import React from "react";
import { format } from "date-fns";
import { 
  useGetStats, 
  useGetAttackTypeBreakdown, 
  useGetRecentActivity,
  getGetStatsQueryKey,
  getGetAttackTypeBreakdownQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { Shield, ShieldAlert, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Cell
} from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useGetStats({ 
    query: { queryKey: getGetStatsQueryKey() } 
  });
  
  const { data: attackTypes, isLoading: isLoadingTypes } = useGetAttackTypeBreakdown({ 
    query: { queryKey: getGetAttackTypeBreakdownQueryKey() } 
  });
  
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({ 
    query: { queryKey: getGetRecentActivityQueryKey() } 
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of firewall traffic and threat landscape.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Analyzed" 
          value={stats?.totalAnalyzed} 
          icon={<Activity className="h-4 w-4 text-muted-foreground" />} 
          loading={isLoadingStats}
        />
        <StatCard 
          title="Total Blocked" 
          value={stats?.totalBlocked} 
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />} 
          loading={isLoadingStats}
          valueClass="text-destructive"
        />
        <StatCard 
          title="Block Rate" 
          value={stats?.blockRate ? `${stats.blockRate.toFixed(1)}%` : '0%'} 
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} 
          loading={isLoadingStats}
        />
        <StatCard 
          title="Avg Risk Score" 
          value={stats?.avgRiskScore ? `${stats.avgRiskScore.toFixed(1)}` : '0'} 
          icon={<Shield className="h-4 w-4 text-muted-foreground" />} 
          loading={isLoadingStats}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-border">
          <CardHeader>
            <CardTitle>Traffic Analysis (Last 7 Days)</CardTitle>
            <CardDescription>Volume of allowed vs blocked prompts</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingActivity ? (
              <Skeleton className="w-full h-full" />
            ) : activity && activity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(144, 100%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(144, 100%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'MMM d')} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                    labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                  />
                  <Area type="monotone" dataKey="allowed" stackId="1" stroke="hsl(144, 100%, 50%)" fill="url(#colorAllowed)" name="Allowed" />
                  <Area type="monotone" dataKey="blocked" stackId="1" stroke="hsl(var(--destructive))" fill="url(#colorBlocked)" name="Blocked" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No activity data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border">
          <CardHeader>
            <CardTitle>Attack Vectors</CardTitle>
            <CardDescription>Distribution of blocked payload types</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingTypes ? (
              <Skeleton className="w-full h-full" />
            ) : attackTypes && attackTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attackTypes} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="attackType" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={80}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {attackTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No attack data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  loading,
  valueClass = "text-foreground"
}: { 
  title: string; 
  value?: number | string; 
  icon: React.ReactNode; 
  loading: boolean;
  valueClass?: string;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={`text-2xl font-bold font-mono ${valueClass}`}>
            {value !== undefined ? value : "-"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
