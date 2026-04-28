'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Github, Search, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, FileCode, Box, ExternalLink, Zap, Terminal, Shield, ChevronDown, Upload, FileText, ChevronRight, X
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Manifest, AgentRun, Alert, PricingAnalysis } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCard } from '@/components/ui/alert-card';
import { PricingBlock } from '@/components/ui/pricing-block';

type InputMode = 'github' | 'document';

function AgentStatusCard({ run, label, icon: Icon, color, isRunning, delay = 0 }: { run?: AgentRun; label: string; icon: any; color: string; isRunning?: boolean; delay?: number }) {
  const status = isRunning ? 'running' : (run?.status ?? 'idle');
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay }}>
      <Card className={cn('border-white/5 bg-white/5 backdrop-blur-md transition-all duration-500', isRunning && 'border-accent/30 shadow-[0_0_20px_rgba(var(--accent),0.1)]')}>
        <CardHeader className="flex-row items-center gap-4 pb-4">
          <div className={cn('p-3 rounded-xl', isRunning ? 'bg-accent/20 animate-pulse' : 'bg-white/5')} style={{ color: isRunning ? 'var(--accent)' : color }}>
            {isRunning ? <Zap className="w-5 h-5 animate-spin-slow" /> : <Icon className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-sans font-medium tracking-tight">{label}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('w-1.5 h-1.5 rounded-full', status === 'running' ? 'bg-accent animate-ping' : status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground')} />
              <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">{status}</span>
            </div>
          </div>
        </CardHeader>
      </Card>
    </motion.div>
  );
}

export default function DiagnoseProjectPage() {
  const router = useRouter();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pricing, setPricing] = useState<PricingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>('github');

  // GitHub mode
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState('');

  // Document mode
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDescription, setDocDescription] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll terminal
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
      if (active) fetchStatus(active.id);
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
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // GitHub form submit
  const handleGithubSubmit = async (e: React.FormEvent) => {
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
      if (!data.success) { setError(data.error ?? 'Scan failed.'); return; }
      await loadData();
    } catch { setError('Network error.'); }
    finally { setScanLoading(false); }
  };

  // Document form submit
  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocError('');
    if (!docFile) { setDocError('Please select a file.'); return; }
    setDocLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      if (docDescription) formData.append('description', docDescription);
      const res = await fetch('/api/scan-doc', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) { setDocError(data.error ?? 'Upload failed.'); return; }
      await loadData();
    } catch { setDocError('Network error.'); }
    finally { setDocLoading(false); }
  };

  // Agent execution via SSE
  const runAgents = async () => {
    if (!manifest) return;
    setRunning(true);
    setAlerts([]);
    setAgentLogs([
      `[System] ► Starting diagnosis...`,
      `[System] Target: ${manifest.repo_name}`,
    ]);

    const consumeStream = async (url: string, body: string) => {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
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

      setAgentLogs(prev => [...prev, `[System] ✓ Diagnosis complete. Loading results...`]);
      await loadData();

      const supabase = createClient();
      const { data: newAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('manifest_id', manifest.id)
        .order('created_at', { ascending: false });
      setAlerts(newAlerts ?? []);

      // Fetch pricing analysis
      const { data: pricingData } = await supabase
        .from('pricing_analysis')
        .select('*')
        .eq('manifest_id', manifest.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPricing(pricingData ?? null);

    } catch (e: any) {
      setAgentLogs(prev => [...prev, `[System] ✗ Error: ${e?.message}`]);
    } finally {
      setTimeout(() => { setRunning(false); }, 3000);
    }
  };

  const handleAlertRead = async (id: string) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: [id], is_read: true }),
    });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  if (loading) return (
    <div className="p-12 space-y-8">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 min-h-screen selection:bg-accent selection:text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-sans font-medium tracking-tight mb-4">
            Diagnose <span className="italic text-muted-foreground/60">Project</span>
          </motion.h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Scan your project for issues and get AI-powered recommendations.</p>
        </div>

        {manifests.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase text-right">Active Project</span>
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
        /* ── Add New Project Form ── */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2 space-y-6">
            {/* Info Card */}
            <Card className="border-accent/20 bg-accent/5 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center gap-3 text-accent mb-2"><ShieldCheck className="w-5 h-5" /><CardTitle className="text-sm font-sans font-medium">Secure Scan</CardTitle></div>
                <CardDescription className="font-mono text-[11px]">Your tokens and files are never stored. Analysis runs once, then the raw data is discarded.</CardDescription>
              </CardHeader>
            </Card>
            <div className="p-6 border border-white/5 rounded-2xl bg-white/2 space-y-4 font-mono text-xs text-muted-foreground/90">
              <p className="text-white">What we analyze:</p>
              <div className="grid grid-cols-2 gap-2">
                {['package.json', 'requirements.txt', 'README.md', 'Cargo.toml', 'go.mod', 'Dockerfile'].map(f => (
                  <div key={f} className="p-2 bg-white/5 rounded-lg border border-white/5">{f}</div>
                ))}
              </div>
            </div>
          </div>

          <Card className="lg:col-span-3 border-white/5 bg-white/5 backdrop-blur-md">
            {/* Mode Toggle */}
            <div className="p-6 border-b border-white/5">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-4">How do you want to add your project?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMode('github')}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 rounded-xl border text-sm font-sans transition-all flex-1',
                    inputMode === 'github'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-white/5 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10'
                  )}
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub Repo</span>
                </button>
                <button
                  onClick={() => setInputMode('document')}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 rounded-xl border text-sm font-sans transition-all flex-1',
                    inputMode === 'document'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-white/5 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  <span>Upload Document</span>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {inputMode === 'github' ? (
                /* ── GitHub Form ── */
                <motion.form
                  key="github"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleGithubSubmit}
                >
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-3">
                      <label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">GitHub Repository URL</label>
                      <div className="relative">
                        <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="url"
                          placeholder="https://github.com/owner/repo"
                          className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                          value={repoUrl}
                          onChange={e => setRepoUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">GitHub Access Token</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type={showToken ? 'text' : 'password'}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-12 font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                          value={githubToken}
                          onChange={e => setGithubToken(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground/60">Read-only access needed. Token is never stored.</p>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 text-critical text-xs font-mono p-3 bg-critical/10 rounded-lg border border-critical/20">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {error}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                    <Button type="submit" disabled={scanLoading} className="w-full py-8 bg-accent text-white hover:bg-accent/90 rounded-xl uppercase font-mono tracking-widest">
                      {scanLoading ? 'Analyzing...' : 'Start Diagnosis'}
                    </Button>
                    {manifests.length > 0 && (
                      <Button variant="ghost" onClick={e => { e.preventDefault(); setManifest(manifests[0]); fetchStatus(manifests[0].id); }} className="w-full font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white">
                        Cancel
                      </Button>
                    )}
                  </CardFooter>
                </motion.form>
              ) : (
                /* ── Document Upload Form ── */
                <motion.form
                  key="document"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleDocSubmit}
                >
                  <CardContent className="p-8 space-y-6">
                    {/* File Drop Zone */}
                    <div className="space-y-3">
                      <label className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Project Document</label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group',
                          docFile ? 'border-accent/40 bg-accent/5' : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".md,.txt,.pdf,.docx"
                          className="hidden"
                          onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                        />
                        {docFile ? (
                          <>
                            <FileText className="w-8 h-8 text-accent" />
                            <div className="text-center">
                              <p className="font-mono text-sm text-white">{docFile.name}</p>
                              <p className="font-mono text-xs text-muted-foreground mt-1">{(docFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={ev => { ev.stopPropagation(); setDocFile(null); }}
                              className="absolute top-4 right-4 text-muted-foreground hover:text-white p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors" />
                            <div className="text-center">
                              <p className="font-sans text-sm text-muted-foreground">Click to upload your project document</p>
                              <p className="font-mono text-xs text-muted-foreground/60 mt-1">README.md · .txt · .pdf · .docx</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Optional text description */}
                    <div className="space-y-3">
                      <label className="font-mono text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                        Project Description <span className="text-muted-foreground/40">(optional)</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Describe your project in a few sentences - what it does, what tech it uses, or anything else you want the AI to know..."
                        className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 font-sans text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all resize-none text-white placeholder:text-muted-foreground/40 leading-relaxed"
                        value={docDescription}
                        onChange={e => setDocDescription(e.target.value)}
                      />
                    </div>

                    {docError && (
                      <div className="flex items-center gap-2 text-critical text-xs font-mono p-3 bg-critical/10 rounded-lg border border-critical/20">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {docError}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                    <Button type="submit" disabled={docLoading || !docFile} className="w-full py-8 bg-accent text-white hover:bg-accent/90 rounded-xl uppercase font-mono tracking-widest">
                      {docLoading ? 'Analyzing Document...' : 'Start Diagnosis'}
                    </Button>
                    {manifests.length > 0 && (
                      <Button variant="ghost" onClick={e => { e.preventDefault(); setManifest(manifests[0]); fetchStatus(manifests[0].id); }} className="w-full font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white">
                        Cancel
                      </Button>
                    )}
                  </CardFooter>
                </motion.form>
              )}
            </AnimatePresence>
          </Card>
        </div>
      ) : (
        /* ── Project Diagnosed View ── */
        <div className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Project Card + Terminal + Alerts */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Project Info */}
              <Card className="border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Box className="w-24 h-24" /></div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase mb-2">Diagnosed Project</p>
                      <CardTitle className="text-3xl font-sans font-medium">{manifest.repo_name}</CardTitle>
                    </div>
                    {manifest.repo_url && (
                      <Button variant="ghost" size="icon" className="hover:bg-white/10" asChild>
                        <a href={manifest.repo_url} target="_blank" rel="noreferrer"><ExternalLink className="w-5 h-5" /></a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {manifest.parsed_manifest?.languages?.map((l: string) => <Badge key={l} variant="outline" className="font-mono text-xs border-white/10">{l}</Badge>)}
                    {manifest.parsed_manifest?.frameworks?.slice(0, 6).map((f: any) => <Badge key={f.name} className="bg-white/5 text-white border-white/10 font-mono text-xs">{f.name}</Badge>)}
                  </div>
                  <div className="mt-8">
                    <Button variant="outline" size="sm" className="rounded-full hover:bg-white/10 border-white/10 text-muted-foreground font-mono text-xs" onClick={() => setManifest(null)}>
                      + Add Another Project
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Live Terminal */}
              <AnimatePresence>
                {(running || agentLogs.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black rounded-xl border border-white/10 font-mono text-xs overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/3">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                      </div>
                      <Terminal className="w-3 h-3 text-accent ml-2" />
                      <span className="text-accent text-xs tracking-widest uppercase">
                        {running ? 'AI Agents Running' : 'Diagnosis Complete'}
                      </span>
                      {running && <span className="ml-auto"><span className="w-1 h-1 rounded-full bg-accent animate-ping inline-block" /></span>}
                    </div>
                    <div ref={terminalRef} className="h-72 overflow-y-auto p-4 space-y-0.5">
                      {agentLogs.map((log, i) => {
                        const isRawSection = log.startsWith('[LLM Raw Response]') || log.startsWith('\n[LLM Raw Response]');
                        const isSuccess = log.includes('✓');
                        const isError = log.includes('✗');
                        const isSystem = log.startsWith('[System]');
                        const isGemini = log.startsWith('[Gemini]') || log.startsWith('[Groq]');
                        return (
                          <div
                            key={i}
                            className={cn(
                              'leading-relaxed whitespace-pre-wrap break-words',
                              isRawSection ? 'text-yellow-400/90 mt-3 font-bold text-xs tracking-widest' :
                              isSuccess ? 'text-green-400/80' :
                              isError ? 'text-red-400/80' :
                              isSystem ? 'text-accent/90' :
                              isGemini ? 'text-blue-400/70' :
                              'text-white/40'
                            )}
                          >
                            {!isRawSection && <span className="text-white/20 mr-1 select-none">›</span>}
                            {log}
                          </div>
                        );
                      })}
                      {running && <div className="text-accent/50 animate-pulse">› _</div>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results - matching the alerts page exactly */}
              <AnimatePresence>
                {!running && (alerts.length > 0 || pricing) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-accent" />
                        <div>
                          <h3 className="font-sans text-xl font-medium">Diagnosis Results</h3>
                          <p className="font-mono text-xs text-muted-foreground uppercase mt-1">{alerts.length} issues found for {manifest.repo_name}</p>
                        </div>
                      </div>
                      <Link href="/dashboard/alerts">
                        <Button variant="ghost" size="sm" className="font-mono text-xs uppercase tracking-widest hover:bg-muted flex items-center gap-2">
                          Full Alerts <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>

                    {/* Pricing Block */}
                    <PricingBlock pricing={pricing} projectName={manifest.repo_name} />

                    {alerts.length > 0 && (
                      <div className="grid grid-cols-1 gap-4">
                        {alerts.map(alert => (
                          <AlertCard key={alert.id} alert={alert} onRead={handleAlertRead} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
                {!running && agentLogs.length > 0 && alerts.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center border border-white/5 rounded-2xl bg-white/2">
                    <ShieldCheck className="w-10 h-10 text-green-500 mx-auto mb-4" />
                    <p className="font-sans text-xl font-medium text-white">No issues found</p>
                    <p className="font-mono text-xs text-muted-foreground uppercase mt-2">Your project looks clean. Great work!</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Agent Status */}
            <div className="space-y-6 lg:col-span-1 border-t lg:border-t-0 lg:border-l border-white/5 pt-8 lg:pt-0 lg:pl-8">
              <div className="flex flex-col gap-4">
                <h3 className="font-sans text-xl font-medium italic">AI Agents</h3>
                <Button
                  onClick={runAgents}
                  disabled={running}
                  className="w-full bg-accent text-white hover:bg-accent/90 rounded-full font-mono text-xs tracking-widest uppercase py-6"
                >
                  {running ? 'Scanning...' : 'Run Diagnosis'}
                </Button>
                <p className="font-mono text-xs text-muted-foreground/70 text-center">Both agents run together automatically</p>
              </div>
              <div className="space-y-4">
                <AgentStatusCard label="Fuzzer" icon={Shield} color="#818cf8" run={agentRuns.fuzzer} isRunning={running} delay={0.1} />
                <AgentStatusCard label="Scraper" icon={Search} color="#2dd4bf" run={agentRuns.scraper} isRunning={running} delay={0.2} />
              </div>

              {/* Tech Stack Summary */}
              {manifest.parsed_manifest && (
                <div className="mt-8 space-y-4 border-t border-white/5 pt-6">
                  <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Detected Stack</p>
                  {manifest.parsed_manifest.databases?.length > 0 && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2">Databases</p>
                      <div className="flex flex-wrap gap-1">
                        {manifest.parsed_manifest.databases.map((d: string) => <Badge key={d} variant="outline" className="text-[9px] border-white/10 font-mono">{d}</Badge>)}
                      </div>
                    </div>
                  )}
                  {manifest.parsed_manifest.infrastructure?.length > 0 && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2">Infrastructure</p>
                      <div className="flex flex-wrap gap-1">
                        {manifest.parsed_manifest.infrastructure.slice(0, 5).map((i: string) => <Badge key={i} variant="outline" className="text-[9px] border-white/10 font-mono">{i}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
