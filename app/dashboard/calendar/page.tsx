'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  Clock,
  ExternalLink,
  Hexagon,
  Sparkles
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Mock events
  const events = [
    { date: new Date(), title: 'Security Scan: Agent Zero', type: 'security' },
    { date: addDays(new Date(), 2), title: 'Model Synthesis Check', type: 'ai' },
    { date: addDays(new Date(), -3), title: 'Infrastructure Audit', type: 'infra' },
  ];

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen selection:bg-accent selection:text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-2 bg-accent/20 rounded-lg text-accent">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">System: Operational</p>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-sans font-light tracking-tight"
          >
            Schedule <span className="italic text-muted-foreground/60">Intel</span>
          </motion.h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-2">
            Temporal Mapping: {format(currentDate, 'MMMM yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-muted/50 p-1 rounded-xl border border-border">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-lg hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-mono text-[10px] tracking-widest uppercase px-4">{format(currentDate, 'MMM yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-lg hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
        {/* Main Calendar Grid */}
        <Card className="xl:col-span-3 border-border bg-card backdrop-blur-md overflow-hidden p-0 shadow-2xl">
          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-4 text-center border-r last:border-r-0 border-border">
                <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/60">{day}</span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr h-[600px]">
            {days.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const dayEvents = events.filter(e => isSameDay(e.date, day));
              
              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative p-3 border-r border-b border-border transition-all duration-300 cursor-pointer group hover:bg-muted/50",
                    !isCurrentMonth && "opacity-20 grayscale",
                    isSelected && "bg-accent/10"
                  )}
                >
                  <span className={cn(
                    "font-mono text-[10px] tracking-widest mb-2 block",
                    isSameDay(day, new Date()) ? "text-accent" : "text-muted-foreground"
                  )}>
                    {format(day, 'dd')}
                  </span>
                  
                  <div className="space-y-1">
                    {dayEvents.map((event, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "px-2 py-1 rounded-md text-[8px] font-mono uppercase tracking-widest truncate",
                          event.type === 'security' ? "bg-critical/20 text-critical" : 
                          event.type === 'ai' ? "bg-indigo-400/20 text-indigo-400" : "bg-accent/20 text-accent"
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>

                  {isSelected && (
                    <motion.div 
                      layoutId="selected-day"
                      className="absolute inset-0 border-2 border-accent/30 pointer-events-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sidebar: Day Details & Integration Info */}
        <div className="space-y-8">
          <Card className="border-border bg-card backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-sans text-xl font-light italic">Observation Data</CardTitle>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{format(selectedDate, 'PPP')}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {events.filter(e => isSameDay(e.date, selectedDate)).length > 0 ? (
                events.filter(e => isSameDay(e.date, selectedDate)).map((event, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-accent" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scheduled Protocol</span>
                    </div>
                    <p className="font-sans text-sm font-medium">{event.title}</p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center border border-dashed border-border rounded-2xl">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">No protocols scheduled</p>
                </div>
              )}
              
              <Button className="w-full rounded-xl bg-accent text-white hover:bg-accent/90 font-mono text-[10px] tracking-widest uppercase py-6">
                <Plus className="w-3 h-3 mr-2" /> Add Deployment Window
              </Button>
            </CardContent>
          </Card>

          <Card className="border-indigo-400/20 bg-indigo-400/5 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Hexagon className="w-16 h-16" />
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Sparkles className="w-4 h-4" />
                <CardTitle className="text-sm font-sans font-medium uppercase tracking-widest">Future Protocol</CardTitle>
              </div>
              <p className="font-sans text-lg font-light leading-snug">Google Calendar Integration</p>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mt-2 uppercase tracking-tighter">
                Synchronize your technical schedule with external intelligence streams. Coming in v2.0.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full rounded-xl border-indigo-400/20 text-indigo-400 hover:bg-indigo-400/10 font-mono text-[10px] tracking-widest uppercase">
                <ExternalLink className="w-3 h-3 mr-2" /> Documentation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
