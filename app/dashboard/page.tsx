'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Manifest, Alert, AgentRun, AlertSeverity } from '@/types';
import { createClient } from '@/lib/supabase/client';

// ─── Helpers ────────────────────────────────
function severityColor(s: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    critical: 'var(--critical)',
    high: 'var(--high)',
    medium: 'var(--medium)',
    low: 'var(--low)',
    info: 'var(--info)',
  };
  return map[s] ?? 'var(--info)';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Sub-components ──────────────────────────

function AgentCard({ run, label, icon, color, isRunning }: { run?: AgentRun; label: string; icon: string; color: string; isRunning?: boolean }) {
  const status = isRunning ? 'running' : (run?.status ?? 'idle');
  const dotClass = `status-dot status-dot-${status}`;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const pulseStyle = isRunning ? { animation: 'pulse 2s infinite', borderColor: color, boxShadow: `0 0 15px ${color}33` } : {};

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all 0.3s ease', ...pulseStyle }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          background: `${color}22`, border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
        }}>
          {isRunning ? <div className="spinner" style={{ color }} /> : icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
            <div className={dotClass} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{statusLabel}</span>
          </div>
        </div>
      </div>
      {run?.completed_at && !isRunning && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Last run: {timeAgo(run.completed_at)}
        </div>
      )}
      {!run && !isRunning && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Never run</div>
      )}
      {isRunning && (
        <div style={{ fontSize: '0.7rem', color: color }}>Agent is actively scanning...</div>
      )}
    </div>
  );
}

function ManifestCard({ manifest }: { manifest: Manifest }) {
  const pm = manifest.parsed_manifest;
  if (!pm) return null;

  return (
    <div className="card glow-card">
      <div className="card-title">📦 Tech Manifest</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '1.5rem' }}>🐙</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{manifest.repo_name}</div>
          <a href={manifest.repo_url} target="_blank" rel="noreferrer"
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {manifest.repo_url}
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {pm.languages.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Languages</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pm.languages.map(l => <span key={l} className="tech-badge">{l}</span>)}
            </div>
          </div>
        )}
        {pm.frameworks.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Frameworks</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pm.frameworks.map(f => (
                <span key={f.name} className="tech-badge">
                  {f.name}
                  {f.version && <span className="tech-badge-version">{f.version}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        {pm.ai_models.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>AI Models</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pm.ai_models.map(m => (
                <span key={`${m.provider}-${m.model}`} className="tech-badge" style={{ borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd' }}>
                  {m.provider}/{m.model}
                </span>
              ))}
            </div>
          </div>
        )}
        {pm.databases.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Databases</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pm.databases.map(d => <span key={d} className="tech-badge" style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}>{d}</span>)}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Last scanned {timeAgo(manifest.updated_at)}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function DashboardPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: mData }, { data: aData }] = await Promise.all([
      supabase.from('manifests').select('*').eq('user_id', user.id).single(),
      supabase.from('alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]);

    setManifest(mData ?? null);
    setAlerts(aData ?? []);

    // Fetch agent runs
    const runsRes = await fetch('/api/agents/status');
    const runsJson = await runsRes.json();
    const runsMap: Record<string, AgentRun> = {};
    for (const run of runsJson.data?.runs ?? []) runsMap[run.agent] = run;
    setAgentRuns(runsMap);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-run trigger
  useEffect(() => {
    if (manifest && !loading) {
      if (typeof window !== 'undefined' && sessionStorage.getItem('stackshadow_autorun') === 'true') {
        sessionStorage.removeItem('stackshadow_autorun');
        // Small delay so the user sees the page load before the animation starts
        setTimeout(() => runAgents(), 500);
      }
    }
  }, [manifest, loading]);

  const runAgents = async () => {
    if (!manifest) return;
    setRunning(true);
    setAgentLogs([
      `[System] Initializing agent execution context...`,
      `[System] Target: ${manifest.repo_name}`,
      `[Fuzzer] Initializing OSV.dev protocol...`,
      `[Scraper] Initializing Tavily intelligence scraper...`,
    ]);

    const logInterval = setInterval(() => {
      setAgentLogs(prev => {
        if (prev.length > 15) prev.shift(); // keep it small
        const frameworks = manifest.parsed_manifest?.frameworks?.map(f => f.name) || ['dependencies'];
        const fw = frameworks[Math.floor(Math.random() * frameworks.length)];
        const nextLogs = [
          `[Fuzzer] Cross-referencing ${fw} against GitHub Advisories...`,
          `[Scraper] Analyzing recent CVE discussions for ${fw}...`,
          `[Scraper] Searching for deprecation notices...`,
          `[Fuzzer] Scanning for vulnerable transitive dependencies...`,
          `[Gemini] Synthesizing threat intelligence...`,
        ];
        return [...prev, nextLogs[Math.floor(Math.random() * nextLogs.length)]];
      });
    }, 1500);

    showToast('Agents are running… this may take 30–60 seconds.', 'info');

    try {
      const [fuzzerRes, scraperRes] = await Promise.all([
        fetch('/api/run-fuzzer', { method: 'POST' }),
        fetch('/api/run-scraper', { method: 'POST' }),
      ]);

      const [fuzzer, scraper] = await Promise.all([fuzzerRes.json(), scraperRes.json()]);

      clearInterval(logInterval);
      setAgentLogs(prev => [...prev, `[System] Agent execution completed successfully.`]);

      const total = (fuzzer.data?.alertsCreated ?? 0) + (scraper.data?.alertsCreated ?? 0);
      showToast(`✅ Agents complete! ${total} new alert${total !== 1 ? 's' : ''} surfaced.`, 'success');
      await loadData();
    } catch {
      clearInterval(logInterval);
      setAgentLogs(prev => [...prev, `[System] ERROR: Agent execution failed.`]);
      showToast('Agent run failed. Check console for details.', 'error');
    } finally {
      setTimeout(() => {
        setRunning(false);
        setAgentLogs([]);
      }, 3000);
    }
  };

  // Alert severity counts
  const sevCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <>
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Command Center</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {manifest ? `Monitoring ${manifest.repo_name}` : 'Link a repository to get started'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {manifest && (
            <button
              id="run-agents-btn"
              className="btn btn-primary"
              onClick={runAgents}
              disabled={running}
            >
              {running ? <><span className="spinner" /> Running…</> : '⚡ Run Agents'}
            </button>
          )}
          {!manifest && (
            <Link href="/dashboard/link-repo" className="btn btn-primary">
              🔗 Link Repository
            </Link>
          )}
        </div>
      </header>

      <main className="dashboard-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '5rem' }}>
            <div className="spinner spinner-lg" style={{ color: 'var(--accent)' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* No manifest empty state */}
            {!manifest && (
              <div className="card" style={{ padding: '4rem 2rem' }}>
                <div className="empty-state">
                  <div className="empty-state-icon">🔗</div>
                  <h2 className="empty-state-title">No repository linked</h2>
                  <p className="empty-state-desc">
                    Connect your GitHub repository to generate a tech manifest and start receiving intelligence alerts.
                  </p>
                  <Link href="/dashboard/link-repo" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    Link Your Repository →
                  </Link>
                </div>
              </div>
            )}

            {manifest && (
              <>
                {/* Severity stat cards */}
                <div className="grid-4">
                  {([['critical', '🔴'], ['high', '🟠'], ['medium', '🟡'], ['low', '🔵']] as const).map(([sev, emoji]) => (
                    <div
                      key={sev}
                      className="stat-card"
                      style={{ color: severityColor(sev as AlertSeverity), cursor: 'pointer' }}
                    >
                      <div className="stat-icon" style={{ background: `${severityColor(sev as AlertSeverity)}22` }}>
                        {emoji}
                      </div>
                      <div>
                        <div className="stat-value" style={{ color: severityColor(sev as AlertSeverity) }}>
                          {sevCounts[sev] ?? 0}
                        </div>
                        <div className="stat-label">{sev}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manifest + Agent Status */}
                <div className="grid-2">
                  <ManifestCard manifest={manifest} />

                  {/* Agents panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {running && agentLogs.length > 0 && (
                      <div className="card" style={{ background: '#0a0a0a', border: '1px solid var(--border)', fontFamily: 'monospace', padding: '1rem', fontSize: '0.75rem', color: '#10b981', maxHeight: '150px', overflowY: 'auto' }}>
                        <div style={{ marginBottom: '0.5rem', color: '#6ee7b7', fontWeight: 'bold' }}>&gt; AGENT ACTIVITY LOG</div>
                        {agentLogs.map((log, i) => (
                          <div key={i} style={{ opacity: i === agentLogs.length - 1 ? 1 : 0.7 }}>
                            {log}
                          </div>
                        ))}
                      </div>
                    )}

                    <AgentCard
                      run={agentRuns['fuzzer']}
                      label="Fuzzer Agent"
                      icon="🐛"
                      color="var(--agent-fuzzer)"
                      isRunning={running}
                    />
                    <AgentCard
                      run={agentRuns['scraper']}
                      label="Landscape Scraper"
                      icon="📡"
                      color="var(--agent-scraper)"
                      isRunning={running}
                    />

                    {/* Quick actions */}
                    <div className="card" style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                        Quick Actions
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link href="/dashboard/link-repo" className="btn btn-secondary btn-sm">
                          🔄 Re-scan Repo
                        </Link>
                        <Link href="/dashboard/alerts" className="btn btn-secondary btn-sm">
                          🚨 View All Alerts
                          {unreadCount > 0 && (
                            <span style={{
                              background: 'var(--accent)', color: '#fff',
                              borderRadius: '100px', padding: '0.1rem 0.45rem',
                              fontSize: '0.65rem', fontWeight: 700,
                            }}>
                              {unreadCount}
                            </span>
                          )}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Alerts Feed */}
                <div>
                  <div className="section-header">
                    <h2 className="section-title">Recent Alerts</h2>
                    <Link href="/dashboard/alerts" style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>
                      View all →
                    </Link>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="card">
                      <div className="empty-state" style={{ padding: '2rem' }}>
                        <div className="empty-state-icon">✅</div>
                        <h3 className="empty-state-title">No alerts yet</h3>
                        <p className="empty-state-desc">Click &quot;Run Agents&quot; to scan for vulnerabilities and intel.</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {alerts.slice(0, 8).map(alert => (
                        <div key={alert.id} className={`alert-row ${!alert.is_read ? 'unread' : ''}`}>
                          <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
                          <div>
                            <div className="alert-row-title">{alert.title}</div>
                            <div className="alert-row-meta">
                              <span className={`badge badge-${alert.agent}`}>{alert.agent}</span>
                              {alert.affected_package && <span className="alert-row-pkg">{alert.affected_package}</span>}
                              <span className="alert-row-time">{timeAgo(alert.created_at)}</span>
                            </div>
                          </div>
                          {alert.source_url && (
                            <a href={alert.source_url} target="_blank" rel="noreferrer"
                              className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                              ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </>
  );
}
