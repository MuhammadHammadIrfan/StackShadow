'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Zap, ShieldAlert, Lightbulb, ArrowRight, Link2 } from 'lucide-react';
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
  const solution = alert.solution;

  const handleClick = () => {
    setIsExpanded(e => !e);
    if (!alert.is_read && onRead) {
      onRead(alert.id);
    }
  };

  return (
    <Card
      className={cn(
        'border-border/50 bg-card/50 hover:bg-card/80 transition-all cursor-pointer group',
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
              {solution && (
                <Badge variant="outline" className="border-green-500/20 text-green-400 text-[8px] tracking-widest px-1.5 py-0">
                  <Lightbulb className="w-2.5 h-2.5 mr-1" />HAS FIX
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center gap-2">
                {alert.agent === 'fuzzer'
                  ? <ShieldAlert className="w-3 h-3 text-indigo-400" />
                  : <Zap className="w-3 h-3 text-teal-400" />}
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {alert.agent === 'fuzzer' ? 'Fuzzer' : 'Scraper'}
                </span>
              </div>
              {alert.affected_package && (
                <span className="font-mono text-xs text-muted-foreground">{alert.affected_package}</span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{timeAgo(alert.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {alert.source_url && (
              <a
                href={alert.source_url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <div className="p-2 text-muted-foreground group-hover:text-foreground transition-colors">
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
              <div className="px-6 pb-6 ml-8 border-t border-border/50">
                {/* Description */}
                <div className="bg-background/60 rounded-xl p-5 mt-4 font-mono text-xs leading-relaxed text-muted-foreground/80 border border-border/50">
                  <p className="text-foreground/90 mb-3">{alert.description}</p>
                  <p className="text-xs text-accent/50">ID: {alert.id.slice(0, 12)}...</p>
                </div>

                {/* Solution Section */}
                {solution && (
                  <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-green-400" />
                      <span className="font-mono text-xs uppercase tracking-widest text-green-400 font-semibold">Recommended Solution</span>
                    </div>

                    {solution.recommendation && (
                      <p className="font-sans text-sm text-foreground/90 mb-4 leading-relaxed">{solution.recommendation}</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2">
                      {solution.fix_url && (
                        <a
                          href={solution.fix_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 font-mono text-xs uppercase tracking-widest hover:bg-green-500/20 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Fix / Upgrade
                        </a>
                      )}
                      {solution.proof_url && (
                        <a
                          href={solution.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground font-mono text-xs uppercase tracking-widest hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Link2 className="w-3 h-3" /> Proof / Advisory
                        </a>
                      )}
                    </div>

                    {solution.alternatives && solution.alternatives.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-green-500/10">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Alternatives</p>
                        <div className="flex flex-wrap gap-2">
                          {solution.alternatives.map((alt, i) => (
                            <a
                              key={i}
                              href={alt.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/60 border border-border/50 text-xs font-mono hover:border-accent/30 hover:text-accent transition-colors"
                            >
                              {alt.name} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

