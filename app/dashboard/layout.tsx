'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: '🚨' },
  { href: '/dashboard/link-repo', label: 'Link Repo', icon: '🔗' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
      if (!data.user) router.push('/');
    });
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '?';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner spinner-lg" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <span className="sidebar-logo-text">StackShadow</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User section at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email ?? 'User'}
              </div>
            </div>
            <button
              id="sign-out-btn"
              className="btn btn-ghost btn-sm"
              onClick={handleSignOut}
              title="Sign out"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="dashboard-wrapper" style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
