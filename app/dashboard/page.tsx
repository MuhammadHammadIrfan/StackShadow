'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  ShieldAlert, 
  Box, 
  CheckCircle2, 
  ArrowUpRight, 
  TrendingUp,
  LayoutDashboard,
  Zap,
  Activity,
  Clock
} from 'lucide-react';
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  Tooltip,
  Cell
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const chartConfig = {
  value: { label: 'Alerts Found', color: 'var(--accent)' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getLastSevenDays(): { name: string; date: string }[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toISOString().split('T')[0],
    });
  }
  return days;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    projects: 0,
    vulnerabilities: 0,
    resolved: 0,
    userEmail: '',
  });
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [recentRuns, setRecentRuns] = useState<Array<{ label: string; time: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { count: pCount },
        { count: vCount },
        { count: rCount },
        { data: alertsData },
        { data: runsData },
      ] = await Promise.all([
        supabase.from('manifests').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', true),
        supabase.from('alerts').select('created_at').eq('user_id', user.id).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('agent_runs')
          .select('agent, status, started_at, manifest_id, manifests(repo_name)')
          .eq('manifests.user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(5),
      ]);

      // Build 7-day chart from real alert data
      const days = getLastSevenDays();
      const countsByDay: Record<string, number> = {};
      days.forEach(d => { countsByDay[d.date] = 0; });
      (alertsData ?? []).forEach((a: any) => {
        const day = a.created_at.split('T')[0];
        if (countsByDay[day] !== undefined) countsByDay[day]++;
      });
      setChartData(days.map(d => ({ name: d.name, value: countsByDay[d.date] })));

      // Build recent runs
      setRecentRuns(
        (runsData ?? []).map((r: any) => ({
          label: `${r.agent === 'fuzzer' ? 'Fuzzer' : 'Scraper'} - ${r.manifests?.repo_name ?? '?'}`,
          time: timeAgo(r.started_at),
          status: r.status,
        }))
      );

      setStats({
        projects: pCount || 0,
        vulnerabilities: vCount || 0,
        resolved: rCount || 0,
        userEmail: user.email || 'User',
      });
      setLoading(false);
    };
    loadStats();
  }, []);

  if (loading) return (
    <div className="p-12 space-y-12">
      <Skeleton className="h-20 w-64" />
      <div className="grid grid-cols-3 gap-8"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      <Skeleton className="h-96 w-full" />
    </div>
  );

  const todayCount = chartData[chartData.length - 1]?.value ?? 0;
  const maxDay = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen selection:bg-accent selection:text-white">
      {/* Welcome Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/20 rounded-lg text-accent"><LayoutDashboard className="w-5 h-5" /></div>
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">System: Operational</p>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-sans font-medium tracking-tight">
            Welcome back, <span className="italic text-muted-foreground/60">{stats.userEmail.split('@')[0]}</span>
          </motion.h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase mt-4 max-w-lg leading-relaxed">
            Your AI security agents are standing by. Diagnose a project to start your analysis.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard/link-repo">
            <Button className="rounded-full bg-accent text-white hover:bg-accent/90 font-mono text-xs tracking-widest uppercase px-8 py-6">
              Start Diagnosis <Zap className="ml-2 w-3 h-3" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Metric Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Box className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-xs tracking-widest uppercase">Projects Diagnosed</CardDescription>
            <CardTitle className="text-5xl font-sans font-medium tracking-tight">{stats.projects}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs uppercase">
              <TrendingUp className="w-3 h-3 text-accent" /> Analyzed this account
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldAlert className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-xs tracking-widest uppercase text-critical">Issues Found</CardDescription>
            <CardTitle className="text-5xl font-sans font-medium tracking-tight text-critical">{stats.vulnerabilities}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs uppercase">
              <Activity className="w-3 h-3 text-critical" /> {todayCount > 0 ? `${todayCount} new today` : 'None today'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><CheckCircle2 className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] tracking-widest uppercase text-accent">Alerts Reviewed</CardDescription>
            <CardTitle className="text-5xl font-sans font-medium tracking-tight text-accent">{stats.resolved}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase">
              <CheckCircle2 className="w-3 h-3 text-accent" />
              {stats.vulnerabilities > 0 ? `${Math.round((stats.resolved / stats.vulnerabilities) * 100)}% reviewed` : 'None yet'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <Card className="lg:col-span-2 border-white/5 bg-white/5 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-sans text-2xl font-medium">Issues <span className="italic opacity-50">Over Time</span></CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-widest">7-Day Alert Volume</CardDescription>
              </div>
              <div className="p-2 bg-white/5 rounded-lg"><BarChart3 className="w-4 h-4 text-muted-foreground" /></div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] mt-8">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }} 
                />
                <Tooltip 
                  content={<ChartTooltipContent hideLabel />} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.value === maxDay && entry.value > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.1)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Activity Widget - Real Data */}
        <div className="space-y-8">
          <Card className="border-white/5 bg-white/5 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="font-sans text-xl font-medium italic">Recent Scans</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {recentRuns.length === 0 ? (
                <p className="text-muted-foreground font-mono text-[10px] uppercase">No scans run yet. Diagnose a project to begin.</p>
              ) : (
                recentRuns.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-sans font-medium truncate">{item.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">{item.time}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[8px] border-white/10 uppercase tracking-tighter ml-2 shrink-0",
                        item.status === 'completed' ? 'border-green-500/30 text-green-400' :
                        item.status === 'running' ? 'border-accent/30 text-accent' :
                        item.status === 'failed' ? 'border-red-500/30 text-red-400' : ''
                      )}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))
              )}
              <Link href="/dashboard/alerts">
                <Button variant="ghost" className="w-full mt-4 text-[10px] font-mono tracking-widest uppercase hover:bg-white/5">
                  View All Alerts <ArrowUpRight className="ml-2 w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="border-accent/20 bg-accent/5 backdrop-blur-md">
            <CardContent className="p-6">
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">Tip</p>
              <p className="font-sans text-sm font-medium italic leading-relaxed text-muted-foreground">
                "Run a new diagnosis after updating your dependencies to catch new vulnerabilities early."
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
