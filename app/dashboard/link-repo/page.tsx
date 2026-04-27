'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Github, Search, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, ShieldCheck, FileCode, Info, Box, ExternalLink, Zap, Terminal, Shield, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Manifest, AgentRun, Alert } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [agentLogs]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mData } = await supabase.from('manifests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    const loadedManifests = mData ?? [];
    setManifests(loadedManifests);
    
    setManifest(prev => {
      const active = prev ? loadedManifests.find(m => m.id === prev.id) || loadedManifests[0] : loadedManifests[0];
      if (active) {
        fetchStatus(active.id);
      }
      return active ?? null;
    });

    setLoading(false);
  }, []);

  const fetchStatus = async (manifestId: string) => {
    try {
      const runsRes = await fetch(`/api/agents/status?manifest_id=${manifestId}`);
      const runsJson = await runsRes.json();
      const runsMap: Record<string, AgentRun> = {};
      for (const run of runsJson.data?.runs ?? []) runsMap[run.agent] = run;
      setAgentRuns(runsMap);
    } catch (e) {
      console.error(e);
    }
  };

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
    setAlerts([]);
    setAgentLogs([
      `[System] ► Initializing autonomous scan...`,
      `[System] Target: ${manifest.repo_name}`,
    ]);

    // Helper to consume an SSE stream and append logs in real time
    const consumeStream = async (url: string, body: string) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.log) {
                setAgentLogs(prev => {
                  const next = [...prev, parsed.log];
                  // Keep last 60 lines to avoid overflow
                  return next.length > 60 ? next.slice(-60) : next;
                });
              }
            } catch {}
          }
        }
      }
    };

    try {
      await Promise.all([
        consumeStream('/api/run-fuzzer', JSON.stringify({ manifest_id: manifest.id })),
        consumeStream('/api/run-scraper', JSON.stringify({ manifest_id: manifest.id })),
      ]);

      setAgentLogs(prev => [...prev, `[System] ✓ All agents complete. Loading results...`]);
      await loadData();

      const supabase = createClient();
      const { data: newAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('manifest_id', manifest.id)
        .order('created_at', { ascending: false });
      setAlerts(newAlerts ?? []);

    } catch (e: any) {
      setAgentLogs(prev => [...prev, `[System] ✗ Error: ${e?.message}`]);
    } finally {
      setTimeout(() => { setRunning(false); }, 3000);
    }
  };


  if (loading) return <div className="p-12 space-y-8"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 min-h-screen selection:bg-accent selection:text-white">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-sans font-light tracking-tight mb-4">
            Protocol <span className="italic text-muted-foreground/60">Intelligence</span>
          </motion.h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Manage repository mapping and autonomous scan agents.</p>
        </div>
        
        {manifests.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase text-right">Active Target</span>
            <div className="relative">
              <select 
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 font-mono text-xs outline-none focus:border-accent/50 text-white min-w-48 transition-colors"
                value={manifest?.id || ''}
                onChange={(e) => {
                  const m = manifests.find(m => m.id === e.target.value);
                  setManifest(m || null);
                  setAlerts([]);
                  if (m) fetchStatus(m.id);
                }}
              >
                {manifests.map(m => (
                  <option key={m.id} value={m.id} className="bg-black text-white">{m.repo_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </header>

      {!manifest ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Form logic */}
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
                  <input type="url" className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} required />
                </div>
                <div className="space-y-3">
                  <label className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Access Token</label>
                  <input type={showToken ? 'text' : 'password'} className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all" value={githubToken} onChange={e => setGithubToken(e.target.value)} required />
                </div>
                {error && <p className="text-critical text-[10px] uppercase font-mono">{error}</p>}
              </CardContent>
              <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                <Button type="submit" disabled={scanLoading} className="w-full py-8 bg-accent text-white hover:bg-accent/90 rounded-xl uppercase font-mono tracking-widest">
                  {scanLoading ? "Scanning Artifacts..." : "Initialize Protocol"}
                </Button>
                {manifests.length > 0 && (
                   <Button variant="ghost" onClick={(e) => { e.preventDefault(); setManifest(manifests[0]); fetchStatus(manifests[0].id); }} className="w-full font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-white">
                      Cancel
                   </Button>
                )}
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side (Artifact + Execution Logs + Results) */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card className="border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Box className="w-24 h-24" /></div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Linked Artifact</p>
                      <CardTitle className="text-3xl font-sans font-light">{manifest.repo_name}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="hover:bg-white/10" asChild><a href={manifest.repo_url} target="_blank" rel="noreferrer"><ExternalLink className="w-5 h-5" /></a></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {manifest.parsed_manifest?.languages?.map((l: string) => <Badge key={l} variant="outline" className="font-mono text-[10px] border-white/10">{l}</Badge>)}
                    {manifest.parsed_manifest?.frameworks?.map((f: any) => <Badge key={f.name} className="bg-white/5 text-white border-white/10 font-mono text-[10px]">{f.name}</Badge>)}
                  </div>
                  <div className="mt-8 flex gap-4">
                     <Button variant="outline" size="sm" className="rounded-full hover:bg-white/10 border-white/10 text-muted-foreground font-mono text-[10px]" onClick={() => setManifest(null)}>+ Add Another Repository</Button>
                  </div>
                </CardContent>
              </Card>

              {/* LIVE EXECUTION — real SSE logs */}
              <AnimatePresence>
                {(running || agentLogs.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black rounded-xl border border-white/10 font-mono text-xs overflow-hidden"
                  >
                    {/* Terminal header */}
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/3">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                      </div>
                      <Terminal className="w-3 h-3 text-accent ml-2" />
                      <span className="text-accent text-[10px] tracking-widest uppercase">
                        {running ? 'Live Agent Execution' : 'Execution Complete'}
                      </span>
                      {running && <span className="ml-auto flex gap-1"><span className="w-1 h-1 rounded-full bg-accent animate-ping" /></span>}
                    </div>
                    {/* Scrollable log body */}
                    <div ref={terminalRef} className="h-72 overflow-y-auto p-4 space-y-0.5" id="log-terminal">
                      {agentLogs.map((log, i) => {
                        const isRawSection = log.startsWith('\n[LLM Raw Response]') || log.startsWith('[LLM Raw Response]');
                        const isRawContent = i > 0 && agentLogs.slice(Math.max(0, i - 5), i).some(l => l.includes('[LLM Raw Response]'));
                        const isSuccess = log.includes('✓');
                        const isError = log.includes('✗');
                        const isSystem = log.startsWith('[System]');
                        const isGemini = log.startsWith('[Gemini]') || log.startsWith('[Groq]');

                        return (
                          <div
                            key={i}
                            className={cn(
                              'leading-relaxed whitespace-pre-wrap break-words',
                              isRawSection ? 'text-yellow-400/90 mt-3 mb-1 font-bold text-[10px] tracking-widest' :
                              isSuccess ? 'text-green-400/80' :
                              isError ? 'text-red-400/80' :
                              isSystem ? 'text-accent/90' :
                              isGemini ? 'text-blue-400/70' :
                              'text-white/40',
                            )}
                          >
                            {!isRawSection && <span className="text-white/20 mr-1 select-none">›</span>}
                            {log.replace('\n[LLM Raw Response]\n', '[LLM Raw Response] ')}
                          </div>
                        );
                      })}
                      {running && (
                        <div className="text-accent/50 animate-pulse">› _</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* Alerts generated by the run */}
              <AnimatePresence>
                {!running && alerts.length > 0 && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mt-4">
                      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                         <ShieldCheck className="w-5 h-5 text-accent" />
                         <h3 className="font-sans text-xl font-light">Recent Intelligence Scan</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {alerts.map((alert) => (
                           <Card key={alert.id} className="border-white/5 bg-black/40 hover:bg-white/5 backdrop-blur-md transition-all group">
                             <CardContent className="p-6">
                               <div className="flex items-start gap-4">
                                  <div className={cn(
                                    "mt-1 w-2 h-2 rounded-full shrink-0 shadow-lg",
                                    alert.severity === 'critical' ? "bg-critical" : 
                                    alert.severity === 'high' ? "bg-high" : 
                                    alert.severity === 'medium' ? "bg-medium" : "bg-low"
                                  )} />
                                  <div className="flex-1 space-y-1 min-w-0">
                                    <h4 className="font-sans text-[15px] font-medium truncate group-hover:text-accent transition-colors">{alert.title}</h4>
                                    <p className="font-mono text-[10px] text-muted-foreground mt-2 leading-relaxed">{alert.description}</p>
                                  </div>
                               </div>
                             </CardContent>
                           </Card>
                        ))}
                      </div>
                      <Link href="/dashboard/alerts" className="block mt-4">
                        <Button variant="ghost" className="w-full text-[10px] font-mono tracking-widest uppercase hover:bg-white/10">View Full Intelligence Feed</Button>
                      </Link>
                   </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right side (Agents) */}
            <div className="space-y-6 lg:col-span-1 border-t lg:border-t-0 lg:border-l border-white/5 pt-8 lg:pt-0 lg:pl-8">
              <div className="flex flex-col gap-4">
                <h3 className="font-sans text-xl font-light italic">Active Agents</h3>
                <Button onClick={runAgents} disabled={running} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full font-mono text-[10px] tracking-widest uppercase py-6">
                  {running ? "Scanning..." : "Trigger Agents"}
                </Button>
              </div>
              <div className="space-y-4">
                <AgentCard label="Fuzzer" icon={Shield} color="#818cf8" run={agentRuns.fuzzer} isRunning={running} delay={0.1} />
                <AgentCard label="Scraper" icon={Search} color="#2dd4bf" run={agentRuns.scraper} isRunning={running} delay={0.2} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
