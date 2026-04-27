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
  Activity
} from 'lucide-react';
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
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

// ─── Mock Data for Charts ───
const chartData = [
  { name: 'Mon', value: 4 },
  { name: 'Tue', value: 7 },
  { name: 'Wed', value: 5 },
  { name: 'Thu', value: 12 },
  { name: 'Fri', value: 8 },
  { name: 'Sat', value: 3 },
  { name: 'Sun', value: 6 },
];

const chartConfig = {
  value: {
    label: "Vulnerabilities Detected",
    color: "var(--accent)",
  },
};

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    projects: 0,
    vulnerabilities: 0,
    resolved: 0,
    userEmail: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ count: pCount }, { count: vCount }] = await Promise.all([
        supabase.from('manifests').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        projects: pCount || 0,
        vulnerabilities: vCount || 0,
        resolved: Math.floor((vCount || 0) * 0.7), // Mocking resolved count
        userEmail: user.email || 'Architect',
      });
      setLoading(false);
    };
    loadStats();
  }, []);

  if (loading) return <div className="p-12 space-y-12"><Skeleton className="h-20 w-64" /><div className="grid grid-cols-3 gap-8"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen selection:bg-accent selection:text-white">
      {/* Welcome Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/20 rounded-lg text-accent"><LayoutDashboard className="w-5 h-5" /></div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">System: Operational</p>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-sans font-light tracking-tight">
            Welcome back, <span className="italic text-muted-foreground/60">{stats.userEmail.split('@')[0]}</span>
          </motion.h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase mt-4 max-w-lg leading-relaxed">
            Technical Intelligence Protocol initialized. All autonomous agents are standing by for stack analysis.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard/link-repo">
            <Button className="rounded-full bg-accent text-white hover:bg-accent/90 font-mono text-[10px] tracking-widest uppercase px-8 py-6">
              Initialize Protocol <Zap className="ml-2 w-3 h-3" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Metric Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Box className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] tracking-widest uppercase">Projects Mapped</CardDescription>
            <CardTitle className="text-5xl font-sans font-light tracking-tight">{stats.projects}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase">
              <TrendingUp className="w-3 h-3 text-accent" /> +2 this session
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldAlert className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] tracking-widest uppercase text-critical">Detected Vulnerabilities</CardDescription>
            <CardTitle className="text-5xl font-sans font-light tracking-tight text-critical">{stats.vulnerabilities}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase">
              <Activity className="w-3 h-3 text-critical" /> Active Scanning
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><CheckCircle2 className="w-20 h-20" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] tracking-widest uppercase text-accent">Artifacts Hardened</CardDescription>
            <CardTitle className="text-5xl font-sans font-light tracking-tight text-accent">{stats.resolved}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase">
              <CheckCircle2 className="w-3 h-3 text-accent" /> 70% Success Rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <Card className="lg:col-span-2 border-white/5 bg-white/5 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-sans text-2xl font-light">Threat <span className="italic opacity-50">Intelligence</span></CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-widest">7-Day Detection Frequency</CardDescription>
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
                    <Cell key={`cell-${index}`} fill={index === 3 ? 'var(--accent)' : 'rgba(255,255,255,0.1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Activity Mini-Widget */}
        <div className="space-y-8">
           <Card className="border-white/5 bg-white/5 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-sans text-xl font-light italic">System Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Fuzzer Scan', time: '12m ago', status: 'Optimal' },
                { label: 'Scraper Intel', time: '1h ago', status: 'Complete' },
                { label: 'Manifest Update', time: '3h ago', status: 'Synced' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-sans font-medium">{item.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">{item.time}</p>
                  </div>
                  <Badge variant="outline" className="text-[8px] border-white/10 uppercase tracking-tighter">{item.status}</Badge>
                </div>
              ))}
              <Link href="/dashboard/alerts">
                <Button variant="ghost" className="w-full mt-4 text-[10px] font-mono tracking-widest uppercase hover:bg-white/5">
                  Full Audit Log <ArrowUpRight className="ml-2 w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="border-accent/20 bg-accent/5 backdrop-blur-md">
            <CardContent className="p-6">
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">Architect Tip</p>
              <p className="font-sans text-sm font-light italic leading-relaxed text-muted-foreground">
                "Autonomous hardening is active. Review the Intelligence Feed to approve automated patches."
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
