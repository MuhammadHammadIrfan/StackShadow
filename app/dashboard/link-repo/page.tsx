'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LinkRepoPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/scan-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, githubToken }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Scan failed. Please check your inputs and try again.');
        return;
      }

      sessionStorage.setItem('stackshadow_autorun', 'true');
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Link Repository</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Connect your GitHub repo to generate a tech manifest
          </p>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {/* Info card */}
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(124,58,237,0.3)' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>🔍</div>
              <div>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>What StackShadow reads</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                  We perform a <strong style={{ color: 'var(--text-secondary)' }}>one-time, read-only scan</strong> of your repository.
                  We look for: <code>package.json</code>, <code>requirements.txt</code>, <code>pyproject.toml</code>,
                  <code>README.md</code>, <code>Cargo.toml</code>, <code>go.mod</code>.
                  Your token is never stored — it&apos;s used only for this single API call.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="card">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="repo-url" className="form-label">
                  GitHub Repository URL <span style={{ color: 'var(--critical)' }}>*</span>
                </label>
                <input
                  id="repo-url"
                  type="url"
                  className="form-input"
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  required
                  disabled={loading}
                />
                <span className="form-hint">Works with public and private repositories</span>
              </div>

              <div className="form-group">
                <label htmlFor="github-token" className="form-label">
                  GitHub Personal Access Token <span style={{ color: 'var(--critical)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="github-token"
                    type={showToken ? 'text' : 'password'}
                    className="form-input form-input-mono"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    required
                    disabled={loading}
                    style={{ paddingRight: '3rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    style={{
                      position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {showToken ? '🙈' : '👁️'}
                  </button>
                </div>
                <span className="form-hint">
                  Needs <code>repo</code> scope (or <code>public_repo</code> for public repos).{' '}
                  <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">
                    Generate one here →
                  </a>
                </span>
              </div>

              {error && (
                <div style={{
                  background: 'var(--critical-dim)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem 1rem',
                  color: 'var(--critical)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                id="scan-repo-btn"
                type="submit"
                className="btn btn-primary"
                disabled={loading || !repoUrl || !githubToken}
                style={{ padding: '0.875rem', fontSize: '0.95rem' }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Scanning repository…
                  </>
                ) : (
                  '🔍 Scan Repository'
                )}
              </button>

              {loading && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Fetching files and parsing with Gemini AI. This takes 15–30 seconds…
                </p>
              )}
            </form>
          </div>

          {/* Help section */}
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              How to create a GitHub PAT:
            </h4>
            <ol style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '1.25rem' }}>
              <li>Go to GitHub → Settings → Developer Settings → Personal Access Tokens</li>
              <li>Click <strong style={{ color: 'var(--text-secondary)' }}>Generate new token (classic)</strong></li>
              <li>Check <code>repo</code> scope (or <code>public_repo</code> for public repos only)</li>
              <li>Copy the token and paste it above</li>
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}
