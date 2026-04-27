'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Zap, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Alert } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface AlertCardProps {
  alert: Alert;
  onRead?: (id: string) => void;
}

export function AlertCard({ alert, onRead }: AlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    setIsExpanded(e => !e);
    if (!alert.is_read && onRead) {
      onRead(alert.id);
    }
  };

  return (
    <Card
      className={cn(
        'border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer group',
        !alert.is_read && 'border-accent/30 bg-accent/5 shadow-[0_0_20px_rgba(var(--accent),0.05)]'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-0">
        <div className="p-6 flex items-start gap-6">
          <div className={cn(
            'mt-1 w-2 h-2 rounded-full shrink-0 shadow-lg',
            alert.severity === 'critical' ? 'bg-critical' :
            alert.severity === 'high' ? 'bg-high' :
            alert.severity === 'medium' ? 'bg-medium' : 'bg-low'
          )} />

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-sans text-[15px] font-medium group-hover:text-accent transition-colors">{alert.title}</h4>
              {!alert.is_read && (
                <Badge className="bg-accent/20 text-accent border-accent/20 text-[8px] tracking-widest px-1.5 py-0">NEW</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center gap-2">
                {alert.agent === 'fuzzer'
                  ? <ShieldAlert className="w-3 h-3 text-indigo-400" />
                  : <Zap className="w-3 h-3 text-teal-400" />}
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {alert.agent === 'fuzzer' ? 'Fuzzer' : 'Scraper'}
                </span>
              </div>
              {alert.affected_package && (
                <span className="font-mono text-[10px] text-muted-foreground">{alert.affected_package}</span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(alert.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {alert.source_url && (
              <a
                href={alert.source_url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <div className="p-2 text-muted-foreground group-hover:text-white transition-colors">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 ml-8 border-t border-white/5">
                <div className="bg-black/40 rounded-xl p-5 mt-4 font-mono text-xs leading-relaxed text-muted-foreground/80 border border-white/5">
                  <p className="text-white/90 mb-4">{alert.description}</p>
                  <p className="text-[10px] text-accent/50">ID: {alert.id.slice(0, 12)}...</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
