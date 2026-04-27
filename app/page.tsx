'use client';

import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <>
      {/* Background blobs */}
      <div className="landing-bg">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
      </div>

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: '700px' }} className="animate-fade-up">
          {/* Logo mark */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              borderRadius: '20px',
              fontSize: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 0 40px rgba(124,58,237,0.5)',
            }}
          >
            🛡️
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '100px',
              padding: '0.35rem 1rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--accent-light)',
              letterSpacing: '0.05em',
              marginBottom: '1.5rem',
            }}
          >
            <span>⚡</span>
            <span>BUILD WITH AI HACKATHON 2026</span>
          </div>

          <h1 className="glow-text" style={{ marginBottom: '1.25rem' }}>
            Your AI-Powered<br />Shadow CTO
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.7',
              marginBottom: '2.5rem',
              maxWidth: '560px',
              margin: '0 auto 2.5rem',
            }}
          >
            StackShadow monitors your startup&apos;s exact tech stack for security
            vulnerabilities, AI model pricing shifts, and breaking framework changes
            — so you can ship instead of scroll.
          </p>

          {/* CTA */}
          <button
            id="google-signin-btn"
            className="btn btn-primary btn-lg"
            onClick={handleGoogleLogin}
            style={{ fontSize: '1rem', padding: '0.875rem 2.5rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No credit card required · Read-only GitHub access · Free to try
          </p>
        </div>

        {/* Feature grid */}
        <div
          className="animate-fade-up delay-2"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginTop: '5rem',
            maxWidth: '860px',
            width: '100%',
          }}
        >
          {[
            {
              icon: '🔍',
              title: 'Repo Intelligence',
              desc: 'One-click scan of your GitHub repo. Gemini parses your exact stack into a structured manifest.',
            },
            {
              icon: '🐛',
              title: 'Fuzzer Agent',
              desc: 'Cross-references your dependencies against OSV.dev and GitHub Security Advisories in real time.',
            },
            {
              icon: '📡',
              title: 'Landscape Scraper',
              desc: 'Monitors AI model pricing changes and framework deprecations specific to your architecture.',
            },
          ].map((f, i) => (
            <div key={i} className="card" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
