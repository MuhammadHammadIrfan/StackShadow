'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, CheckCheck, ChevronDown, ChevronUp, ExternalLink, Filter, Zap, ShieldAlert, Search, ArrowLeft, Github, Box, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import type { Alert, AlertSeverity, AgentType, Manifest } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

  const selectManifest = (m: Manifest) => {
    setActiveManifest(m);
    loadAlerts(m.id);
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
            className="text-4xl md:text-5xl font-sans font-light tracking-tight"
          >
            Select Target <span className="italic text-muted-foreground/60">Repository</span>
          </motion.h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-4">
            Select an artifact to view its intelligence feed.
          </p>
        </header>

        {manifests.length === 0 ? (
          <Card className="border-dashed border-white/10 bg-transparent py-24">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Box className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="font-sans text-xl font-light text-muted-foreground italic">No artifacts linked.</p>
              <Link href="/dashboard/link-repo" className="mt-6">
                <Button className="bg-accent text-white hover:bg-accent/90 rounded-full font-mono text-[10px] tracking-widest uppercase">Go to Protocol Intel</Button>
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
                    <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
                      Linked {timeAgo(m.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {m.parsed_manifest?.languages?.slice(0,3).map((l: string) => <Badge key={l} variant="outline" className="font-mono text-[10px] border-white/10">{l}</Badge>)}
                    </div>
                    <div className="flex items-center text-accent font-mono text-[10px] uppercase tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <span className="font-mono text-[10px] tracking-widest uppercase">Back to Repositories</span>
          </button>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-sans font-light tracking-tight flex items-center gap-4 flex-wrap"
          >
            Intelligence <span className="italic text-muted-foreground/60">Feed</span>
            <Badge variant="outline" className="font-mono text-xs font-normal border-accent/20 text-accent bg-accent/5 py-1 px-3 mt-2 md:mt-0">{activeManifest.repo_name}</Badge>
          </motion.h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-4">
            {unreadCount > 0 ? `Unread Artifacts Detected: ${unreadCount}` : 'All technical protocols cleared.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllRead}
            className="rounded-full border-white/5 bg-white/5 hover:bg-accent/10 hover:text-accent font-mono text-[10px] tracking-widest uppercase"
          >
            <CheckCheck className="w-3 h-3 mr-2" />
            Clear All Notifications
          </Button>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <h4 className="font-mono text-[10px] tracking-widest uppercase">Resolution Filters</h4>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={cn(
                  "px-4 py-2 rounded-lg font-mono text-[10px] tracking-widest uppercase transition-all",
                  filter === sev 
                    ? (sev === 'all' ? "bg-accent text-white" : `bg-white/10 text-white shadow-xl`) 
                    : "text-muted-foreground hover:text-white"
                )}
                style={filter === sev && sev !== 'all' ? { borderBottom: `2px solid var(--${sev})` } : {}}
              >
                {sev} <span className="opacity-40 ml-1">{sev === 'all' ? alerts.length : (sevCounts[sev] ?? 0)}</span>
              </button>
            ))}
          </div>

          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            {(['all', 'fuzzer', 'scraper'] as const).map(agent => (
              <button
                key={agent}
                onClick={() => setAgentFilter(agent)}
                className={cn(
                  "px-4 py-2 rounded-lg font-mono text-[10px] tracking-widest uppercase transition-all",
                  agentFilter === agent ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                {agent === 'all' ? 'All Sources' : agent}
              </button>
            ))}
          </div>

          <button
            onClick={() => setReadFilter(readFilter === 'unread' ? 'all' : 'unread')}
            className={cn(
              "px-4 py-3 rounded-xl font-mono text-[10px] tracking-widest uppercase border transition-all",
              readFilter === 'unread' ? "border-accent text-accent bg-accent/5" : "border-white/10 text-muted-foreground hover:border-white/20"
            )}
          >
            {readFilter === 'unread' ? 'Unread Artifacts' : 'All Data'}
          </button>
        </div>
      </div>

      {alertsLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card className="border-dashed border-white/10 bg-transparent py-24">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="font-sans text-xl font-light text-muted-foreground italic">No matching intelligence found.</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-2">Try adjusting your filters or triggering a new scan.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((alert, i) => {
                const isExpanded = expandedId === alert.id;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card 
                      className={cn(
                        "border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer group",
                        !alert.is_read && "border-accent/30 bg-accent/5 shadow-[0_0_20px_rgba(var(--accent),0.05)]"
                      )}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : alert.id);
                        if (!alert.is_read) markRead(alert.id);
                      }}
                    >
                      <CardContent className="p-0">
                        <div className="p-6 flex items-start gap-6">
                          <div className={cn(
                            "mt-1 w-2 h-2 rounded-full shrink-0 shadow-lg",
                            alert.severity === 'critical' ? "bg-critical" : 
                            alert.severity === 'high' ? "bg-high" : 
                            alert.severity === 'medium' ? "bg-medium" : "bg-low"
                          )} />
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-sans text-lg font-medium group-hover:text-accent transition-colors">{alert.title}</h4>
                              {!alert.is_read && <Badge className="bg-accent/20 text-accent border-accent/20 text-[8px] tracking-widest px-1.5 py-0">NEW</Badge>}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                              <div className="flex items-center gap-2">
                                {alert.agent === 'fuzzer' ? <ShieldAlert className="w-3 h-3 text-indigo-400" /> : <Zap className="w-3 h-3 text-teal-400" />}
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{alert.agent} Protocol</span>
                              </div>
                              {alert.affected_package && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/20">•</span>
                                  <span className="font-mono text-[10px] text-muted-foreground">Target: {alert.affected_package}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-white/20">•</span>
                                <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(alert.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {alert.source_url && (
                              <a 
                                href={alert.source_url} 
                                target="_blank" 
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <div className="p-2 text-muted-foreground group-hover:text-white transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-6 pt-0 ml-8 mr-8 border-t border-white/5 mt-0">
                                <div className="bg-black/40 rounded-xl p-6 font-mono text-xs leading-relaxed text-muted-foreground/80 border border-white/5">
                                  <p className="mb-4 text-white/90">{alert.description}</p>
                                  <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase tracking-widest opacity-50">Hash Index:</span>
                                      <span className="text-[10px] text-accent/70">{alert.id.slice(0, 8)}...</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <footer className="pt-12 pb-8 text-center border-t border-white/5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase opacity-40">
            Synthesized Protocol Scan Complete • {filtered.length} of {alerts.length} Objects Displayed
          </p>
        </footer>
      )}
    </div>
  );
}
