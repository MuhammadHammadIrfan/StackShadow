'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Bell, 
  Link as LinkIcon, 
  LogOut, 
  User as UserIcon,
  ListTodo,
  Calendar as CalendarIcon,
  Hexagon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { href: '/dashboard/alerts', label: 'Intelligence Feed', icon: Bell },
  { href: '/dashboard/todos', label: 'Task Protocol', icon: ListTodo },
  { href: '/dashboard/calendar', label: 'Schedule Intel', icon: CalendarIcon },
  { href: '/dashboard/link-repo', label: 'Protocol Intel', icon: LinkIcon },
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
    : '??';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#0a0a0a]/50 backdrop-blur-xl flex flex-col p-6 fixed h-screen z-50">
        <div className="flex items-center gap-3 px-2 mb-12">
          <div className="relative">
            <Hexagon className="w-8 h-8 text-accent fill-accent/10" />
            <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full" />
          </div>
          <span className="font-sans text-lg font-light tracking-tight">Stack<span className="italic opacity-50">Shadow</span></span>
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
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
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
        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center gap-4 p-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.email}</p>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Active Session</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-mono text-[10px] tracking-widest uppercase">Terminate</span>
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
