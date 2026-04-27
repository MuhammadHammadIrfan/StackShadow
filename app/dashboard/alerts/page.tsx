'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Alert, AlertSeverity, AgentType } from '@/types';
import { createClient } from '@/lib/supabase/client';

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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch active manifest first
    const { data: manifest } = await supabase
      .from('manifests')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manifest) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    // Only fetch alerts for the current manifest
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('manifest_id', manifest.id)
      .order('created_at', { ascending: false });

    setAlerts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

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

  // Severity counts for filter buttons
  const sevCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  const FilterBtn = ({
    label, value, active, count, color
  }: { label: string; value: string; active: boolean; count?: number; color?: string }) => (
    <button
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={active && color ? { background: color, boxShadow: `0 4px 15px ${color}55` } : undefined}
      onClick={() => {
        /* handled by parent */
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
          borderRadius: '100px', padding: '0.05rem 0.35rem', fontSize: '0.65rem', fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Intelligence Alerts</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            ✓ Mark all read
          </button>
        )}
      </header>

      <main className="dashboard-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {/* Severity filters */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginRight: '0.5rem' }}>
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
              const colors: Record<string, string> = {
                critical: 'var(--critical)', high: 'var(--high)',
                medium: 'var(--medium)', low: 'var(--low)', info: 'var(--info)',
              };
              const count = sev === 'all' ? alerts.length : (sevCounts[sev] ?? 0);
              return (
                <button
                  key={sev}
                  id={`filter-severity-${sev}`}
                  className={`btn btn-sm ${filter === sev ? 'btn-primary' : 'btn-secondary'}`}
                  style={filter === sev && sev !== 'all' ? { background: colors[sev], boxShadow: `0 4px 12px ${colors[sev]}44` } : undefined}
                  onClick={() => setFilter(sev)}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  <span style={{
                    background: filter === sev ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '100px', padding: '0.05rem 0.35rem', fontSize: '0.65rem', fontWeight: 700,
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

          {/* Agent filter */}
          {(['all', 'fuzzer', 'scraper'] as const).map(agent => (
            <button
              key={agent}
              id={`filter-agent-${agent}`}
              className={`btn btn-sm ${agentFilter === agent ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAgentFilter(agent)}
            >
              {agent === 'all' ? '🤖 All Agents' : agent === 'fuzzer' ? '🐛 Fuzzer' : '📡 Scraper'}
            </button>
          ))}

          <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

          <button
            id="filter-unread"
            className={`btn btn-sm ${readFilter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setReadFilter(readFilter === 'unread' ? 'all' : 'unread')}
          >
            Unread only
          </button>
        </div>

        {/* Alert list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
            <div className="spinner spinner-lg" style={{ color: 'var(--accent)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🔎</div>
              <h2 className="empty-state-title">No alerts match your filters</h2>
              <p className="empty-state-desc">Try adjusting the filters or run the agents to generate new intelligence.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(alert => {
              const isExpanded = expandedId === alert.id;
              return (
                <div
                  key={alert.id}
                  className={`alert-row ${!alert.is_read ? 'unread' : ''}`}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : alert.id);
                    if (!alert.is_read) markRead(alert.id);
                  }}
                  style={{ flexDirection: 'column', cursor: 'pointer' }}
                >
                  {/* Top row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1rem', alignItems: 'center', width: '100%' }}>
                    <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
                    <div>
                      <div className="alert-row-title">{alert.title}</div>
                      <div className="alert-row-meta">
                        <span className={`badge badge-${alert.agent}`}>{alert.agent}</span>
                        {alert.affected_package && <span className="alert-row-pkg">{alert.affected_package}</span>}
                        <span className="alert-row-time">{timeAgo(alert.created_at)}</span>
                        {!alert.is_read && <span className="badge badge-info">NEW</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {alert.source_url && (
                        <a
                          href={alert.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          ↗ Source
                        </a>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded description */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.7',
                        width: '100%',
                      }}
                    >
                      {alert.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {filtered.length > 0 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing {filtered.length} of {alerts.length} total alerts
          </div>
        )}
      </main>
    </>
  );
}
