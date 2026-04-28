'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, CheckCheck, ChevronDown, ChevronUp, ExternalLink, Filter, Zap, ShieldAlert, Search, ArrowLeft, Github, Box, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import type { Alert, AlertSeverity, AgentType, Manifest, PricingAnalysis } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCard } from '@/components/ui/alert-card';
import { PricingBlock } from '@/components/ui/pricing-block';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

export default function AlertsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [activeManifest, setActiveManifest] = useState<Manifest | null>(null);
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pricing, setPricing] = useState<PricingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadManifests = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('manifests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setManifests(data ?? []);
    setLoading(false);
  }, []);

  const loadAlerts = async (manifestId: string) => {
    setAlertsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('manifest_id', manifestId)
      .order('created_at', { ascending: false });

    setAlerts(data ?? []);
    setAlertsLoading(false);
  };

  useEffect(() => { loadManifests(); }, [loadManifests]);

  const selectManifest = async (m: Manifest) => {
    setActiveManifest(m);
    loadAlerts(m.id);
    // Fetch pricing
    const supabase = createClient();
    const { data: pricingData } = await supabase
      .from('pricing_analysis')
      .select('*')
      .eq('manifest_id', m.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPricing(pricingData ?? null);
  };

  const markRead = async (id: string) => {
    const res = await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: [id], is_read: true }),
    });
    if (res.ok) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    }
  };

  const markAllRead = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;
    const res = await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: unreadIds, is_read: true }),
    });
    if (res.ok) {
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    }
  };

  const filtered = alerts
    .filter(a => filter === 'all' || a.severity === filter)
    .filter(a => agentFilter === 'all' || a.agent === agentFilter)
    .filter(a => readFilter === 'all' || !a.is_read)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const sevCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 md:p-12 space-y-8 min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-24" /></div>
        <div className="space-y-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      </div>
    );
  }

  // Repository Selection View
  if (!activeManifest) {
    return (
      <div className="p-8 md:p-12 space-y-12 min-h-screen max-w-5xl mx-auto selection:bg-accent selection:text-white">
        <header>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-sans font-medium tracking-tight"
          >
            Select <span className="italic text-muted-foreground/60">Project</span>
          </motion.h1>
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase mt-4">
            Choose a project to view its alerts.
          </p>
        </header>

        {manifests.length === 0 ? (
          <Card className="border-dashed border-white/10 bg-transparent py-24">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Box className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="font-sans text-xl font-light text-muted-foreground italic">No artifacts linked.</p>
              <Link href="/dashboard/link-repo" className="mt-6">
                <Button className="bg-accent text-white hover:bg-accent/90 rounded-full font-mono text-xs tracking-widest uppercase">Go to Protocol Intel</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {manifests.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => selectManifest(m)}
              >
                <Card className="cursor-pointer border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group overflow-hidden relative">
                  <div className="absolute right-0 top-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all"><Box className="w-32 h-32" /></div>
                  <CardHeader className="pb-4">
                    <CardTitle className="font-sans text-2xl font-light group-hover:text-accent transition-colors">
                      {m.repo_name}
                    </CardTitle>
                    <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
                      Linked {timeAgo(m.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {m.parsed_manifest?.languages?.slice(0,3).map((l: string) => <Badge key={l} variant="outline" className="font-mono text-xs border-white/10">{l}</Badge>)}
                    </div>
                    <div className="flex items-center text-accent font-mono text-xs uppercase tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Intelligence <ArrowRight className="w-3 h-3" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Alerts Feed View
  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen selection:bg-accent selection:text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button onClick={() => setActiveManifest(null)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-mono text-xs tracking-widest uppercase">Back to Projects</span>
          </button>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-sans font-medium tracking-tight flex items-center gap-4 flex-wrap"
          >
            Alerts <span className="italic text-muted-foreground/60">Feed</span>
            <Badge variant="outline" className="font-mono text-xs font-normal border-accent/20 text-accent bg-accent/5 py-1 px-3 mt-2 md:mt-0">{activeManifest.repo_name}</Badge>
          </motion.h1>
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase mt-4">
            {unreadCount > 0 ? `${unreadCount} new alerts` : 'All alerts reviewed.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllRead}
            className="rounded-full border-white/5 bg-white/5 hover:bg-accent/10 hover:text-accent font-mono text-xs tracking-widest uppercase"
          >
            <CheckCheck className="w-3 h-3 mr-2" />
            Mark All Read
          </Button>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <h4 className="font-mono text-xs tracking-widest uppercase">Filters</h4>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={cn(
                  "px-4 py-2 rounded-lg font-mono text-xs tracking-widest uppercase transition-all",
                  filter === sev 
                    ? (sev === 'all' ? "bg-accent text-white" : `bg-white/10 text-white shadow-xl`) 
                    : "text-muted-foreground hover:text-white"
                )}
                style={filter === sev && sev !== 'all' ? { borderBottom: `2px solid var(--${sev})` } : {}}
              >
                {sev} <span className="opacity-70 ml-1">{sev === 'all' ? alerts.length : (sevCounts[sev] ?? 0)}</span>
              </button>
            ))}
          </div>

          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            {(['all', 'fuzzer', 'scraper'] as const).map(agent => (
              <button
                key={agent}
                onClick={() => setAgentFilter(agent)}
                className={cn(
                  "px-4 py-2 rounded-lg font-mono text-xs tracking-widest uppercase transition-all",
                  agentFilter === agent ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                {agent === 'all' ? 'All' : agent === 'fuzzer' ? 'Fuzzer' : 'Scraper'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setReadFilter(readFilter === 'unread' ? 'all' : 'unread')}
            className={cn(
              "px-4 py-3 rounded-xl font-mono text-xs tracking-widest uppercase border transition-all",
              readFilter === 'unread' ? "border-accent text-accent bg-accent/5" : "border-white/10 text-muted-foreground hover:border-white/20"
            )}
          >
            {readFilter === 'unread' ? 'Unread Only' : 'All Alerts'}
          </button>
        </div>
      </div>

      {alertsLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Pricing Block */}
          <PricingBlock pricing={pricing} projectName={activeManifest?.repo_name ?? 'Project'} />

          <div className="space-y-4">
            {filtered.length === 0 ? (
              <Card className="border-dashed border-border/50 bg-transparent py-24">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
                  <p className="font-sans text-xl font-light text-muted-foreground italic">No alerts match your filters.</p>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/90 mt-2">Try adjusting your filters or running a new diagnosis.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filtered.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <AlertCard alert={alert} onRead={markRead} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <footer className="pt-12 pb-8 text-center border-t border-white/5">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase opacity-70">
            Synthesized Protocol Scan Complete • {filtered.length} of {alerts.length} Objects Displayed
          </p>
        </footer>
      )}
    </div>
  );
}
