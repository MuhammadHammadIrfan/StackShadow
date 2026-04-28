'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Bell, 
  Link as LinkIcon, 
  LogOut, 
  User as UserIcon,
  ListTodo,
  Calendar as CalendarIcon,
  Hexagon,
  Sun,
  Moon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/alerts', label: 'Projects Diagnosed', icon: Bell },
  { href: '/dashboard/todos', label: 'Tasks', icon: ListTodo },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarIcon },
  { href: '/dashboard/link-repo', label: 'Diagnose Project', icon: LinkIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

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
    : '??';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col p-6 fixed h-screen z-50">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 px-2">
            <div className="relative">
              <Hexagon className="w-8 h-8 text-accent fill-accent/10" />
              <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full" />
            </div>
            <span className="font-sans text-lg font-light tracking-tight">Stack<span className="italic opacity-50">Shadow</span></span>
          </div>
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  isActive 
                    ? "bg-accent/10 text-accent" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 transition-transform duration-500",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )} />
                <span className="font-mono text-[10px] tracking-widest uppercase">{link.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="ml-auto w-1 h-1 rounded-full bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="mt-auto pt-6 border-t border-border/50">
          <div className="flex items-center gap-4 p-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center font-mono text-xs">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.email}</p>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Signed In</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-mono text-[10px] tracking-widest uppercase">Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-72 min-h-screen overflow-y-auto">
        <div className="noise-overlay" />
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}

