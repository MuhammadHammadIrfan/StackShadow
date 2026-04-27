'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Github, 
  Search, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft,
  ShieldCheck,
  FileCode,
  Info,
  Box,
  ExternalLink,
  Zap,
  Terminal,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Manifest, AgentRun } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Sub-components from original dashboard ───

function AgentCard({ run, label, icon: Icon, color, isRunning, delay = 0 }: { run?: AgentRun; label: string; icon: any; color: string; isRunning?: boolean; delay?: number }) {
  const status = isRunning ? 'running' : (run?.status ?? 'idle');
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay }}>
      <Card className={cn("border-white/5 bg-white/5 backdrop-blur-md transition-all duration-500", isRunning && "border-accent/30 shadow-[0_0_20px_rgba(var(--accent),0.1)]")}>
        <CardHeader className="flex-row items-center gap-4 pb-4">
          <div className={cn("p-3 rounded-xl", isRunning ? "bg-accent/20 animate-pulse" : "bg-white/5")} style={{ color: isRunning ? 'var(--accent)' : color }}>
            {isRunning ? <Zap className="w-5 h-5 animate-spin-slow" /> : <Icon className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-sans font-medium tracking-tight">{label}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("w-1.5 h-1.5 rounded-full", status === 'running' ? "bg-accent animate-ping" : status === 'completed' ? "bg-green-500" : "bg-muted-foreground")} />
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{status}</span>
            </div>
          </div>
        </CardHeader>
      </Card>
    </motion.div>
  );
}

export default function ProtocolPage() {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun>>({});
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mData } = await supabase.from('manifests').select('*').eq('user_id', user.id).single();
    setManifest(mData ?? null);

    if (mData) {
      const runsRes = await fetch('/api/agents/status');
      const runsJson = await runsRes.json();
      const runsMap: Record<string, AgentRun> = {};
      for (const run of runsJson.data?.runs ?? []) runsMap[run.agent] = run;
      setAgentRuns(runsMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setScanLoading(true);

    try {
      const res = await fetch('/api/scan-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, githubToken }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Scan failed.');
        return;
      }
      await loadData();
    } catch {
      setError('Network error.');
    } finally {
      setScanLoading(false);
    }
  };

  const runAgents = async () => {
    if (!manifest) return;
    setRunning(true);
    setAgentLogs([`[System] Initializing...`, `[System] Target: ${manifest.repo_name}`]);
    const logInterval = setInterval(() => {
      setAgentLogs(prev => {
        if (prev.length > 8) prev.shift();
        return [...prev, `[Gemini] Processing technical artifacts...`];
      });
    }, 2000);

    try {
      await Promise.all([fetch('/api/run-fuzzer', { method: 'POST' }), fetch('/api/run-scraper', { method: 'POST' })]);
      clearInterval(logInterval);
      await loadData();
    } finally {
      setTimeout(() => { setRunning(false); setAgentLogs([]); }, 2000);
    }
  };

  if (loading) return <div className="p-12 space-y-8"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 min-h-screen">
      <header>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-sans font-light tracking-tight mb-4">
          Protocol <span className="italic text-muted-foreground/60">Intelligence</span>
        </motion.h1>
        <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Manage repository mapping and autonomous scan agents.</p>
      </header>

      {!manifest ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Form logic (original link-repo) */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-accent/20 bg-accent/5 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center gap-3 text-accent mb-2"><ShieldCheck className="w-5 h-5" /><CardTitle className="text-sm font-sans font-medium">Security Protocol</CardTitle></div>
                <CardDescription className="font-mono text-[11px]">One-time read-only scan. Tokens are never persisted.</CardDescription>
              </CardHeader>
            </Card>
            <div className="p-6 border border-white/5 rounded-2xl bg-white/2 space-y-4 font-mono text-[10px] text-muted-foreground/70">
              <p className="text-white">Analysis Targets:</p>
              <div className="grid grid-cols-2 gap-2">
                {['package.json', 'README.md', 'go.mod', 'Cargo.toml'].map(f => <div key={f} className="p-2 bg-white/5 rounded-lg border border-white/5">{f}</div>)}
              </div>
            </div>
          </div>
          <Card className="lg:col-span-3 border-white/5 bg-white/5 backdrop-blur-md">
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">GitHub URL</label>
                  <input type="url" className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 font-mono text-sm outline-none" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} required />
                </div>
                <div className="space-y-3">
                  <label className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Access Token</label>
                  <input type={showToken ? 'text' : 'password'} className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 font-mono text-sm outline-none" value={githubToken} onChange={e => setGithubToken(e.target.value)} required />
                </div>
                {error && <p className="text-critical text-[10px] uppercase font-mono">{error}</p>}
              </CardContent>
              <CardFooter className="p-8 pt-0">
                <Button type="submit" disabled={scanLoading} className="w-full py-8 bg-accent text-white rounded-xl uppercase font-mono tracking-widest">
                  {scanLoading ? "Scanning Artifacts..." : "Initialize Protocol"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Manifest View (moved from dashboard) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Box className="w-24 h-24" /></div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Linked Artifact</p>
                    <CardTitle className="text-3xl font-sans font-light">{manifest.repo_name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" asChild><a href={manifest.repo_url} target="_blank" rel="noreferrer"><ExternalLink className="w-5 h-5" /></a></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mt-4">
                  {manifest.parsed_manifest?.languages?.map(l => <Badge key={l} variant="outline" className="font-mono text-[10px] border-white/10">{l}</Badge>)}
                  {manifest.parsed_manifest?.frameworks?.map(f => <Badge key={f.name} className="bg-white/5 text-white border-white/10 font-mono text-[10px]">{f.name}</Badge>)}
                </div>
                <div className="mt-8 flex gap-4">
                   <Button variant="outline" size="sm" className="rounded-full border-white/10 text-muted-foreground font-mono text-[10px]" onClick={() => setManifest(null)}>Disconnect Repository</Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xl font-light italic">Active Agents</h3>
                <Button onClick={runAgents} disabled={running} size="sm" className="bg-accent text-white rounded-full font-mono text-[9px] px-6">
                  {running ? "Scanning..." : "Trigger Agents"}
                </Button>
              </div>
              <AgentCard label="Fuzzer" icon={Shield} color="#818cf8" run={agentRuns.fuzzer} isRunning={running} delay={0.1} />
              <AgentCard label="Scraper" icon={Search} color="#2dd4bf" run={agentRuns.scraper} isRunning={running} delay={0.2} />
              
              <AnimatePresence>
                {running && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-black rounded-xl border border-white/10 font-mono text-[9px] text-accent/80">
                    <div className="flex items-center gap-2 mb-2"><Terminal className="w-3 h-3" /><span>LIVE EXECUTION</span></div>
                    {agentLogs.map((log, i) => <div key={i} className="opacity-60">&gt; {log}</div>)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
