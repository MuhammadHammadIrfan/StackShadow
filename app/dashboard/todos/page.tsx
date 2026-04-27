'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ListTodo,
  Search,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category: 'security' | 'infrastructure' | 'ai' | 'general';
}

const CATEGORIES = {
  security: { label: 'Security', color: 'text-critical bg-critical/10' },
  infrastructure: { label: 'Infrastructure', color: 'text-accent bg-accent/10' },
  ai: { label: 'AI Synthesis', color: 'text-indigo-400 bg-indigo-400/10' },
  general: { label: 'General', color: 'text-muted-foreground bg-white/5' },
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [category, setCategory] = useState<Todo['category']>('general');

  // Load from local storage for now (mocking persistence)
  useEffect(() => {
    const saved = localStorage.getItem('stackshadow_todos');
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('stackshadow_todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    
    const newTodo: Todo = {
      id: Math.random().toString(36).substring(2, 9),
      text: inputValue,
      completed: false,
      category,
    };
    
    setTodos([newTodo, ...todos]);
    setInputValue('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen max-w-5xl mx-auto selection:bg-accent selection:text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-2 bg-accent/20 rounded-lg text-accent">
              <ListTodo className="w-5 h-5" />
            </div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">System: Operational</p>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-sans font-light tracking-tight"
          >
            Task <span className="italic text-muted-foreground/60">Protocol</span>
          </motion.h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-2">
            Execution progress: {completedCount}/{todos.length} artifacts cleared.
          </p>
        </div>
      </header>

      {/* Input Section */}
      <Card className="border-white/5 bg-white/5 backdrop-blur-md overflow-hidden p-2">
        <form onSubmit={addTodo} className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <div className="flex-1 relative group">
            <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              placeholder="Initialize new task artifact..."
              className="w-full bg-transparent border-none py-4 pl-12 pr-4 font-sans text-sm focus:ring-0 outline-none placeholder:text-muted-foreground/40"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 px-2">
            {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-3 py-2 rounded-lg font-mono text-[10px] tracking-widest uppercase border transition-all",
                  category === cat ? "border-accent/50 bg-accent/10 text-accent" : "border-white/5 text-muted-foreground hover:border-white/10"
                )}
              >
                {cat[0]}
              </button>
            ))}
            <Button 
              type="submit"
              size="sm"
              className="rounded-lg bg-white text-black hover:bg-white/90 font-mono text-[10px] tracking-widest uppercase ml-2"
            >
              Add Artifact
            </Button>
          </div>
        </form>
      </Card>

      {/* List Section */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {todos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center border border-dashed border-white/5 rounded-3xl"
            >
              <div className="p-4 bg-white/5 w-fit mx-auto rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-accent/40" />
              </div>
              <p className="font-sans text-xl font-light text-muted-foreground italic">System queue is clear.</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mt-2">No active tasks in protocol.</p>
            </motion.div>
          ) : (
            todos.map((todo) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className={cn(
                  "border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-300 group",
                  todo.completed && "opacity-50"
                )}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-sans font-medium transition-all",
                        todo.completed && "line-through text-muted-foreground"
                      )}>
                        {todo.text}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-mono text-[8px] tracking-widest uppercase",
                          CATEGORIES[todo.category].color
                        )}>
                          {todo.category}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">ID: {todo.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-critical transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      {todos.length > 0 && (
        <footer className="pt-12 pb-8 text-center border-t border-white/5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase opacity-40">
            Protocol Scan: {completedCount} verified • {todos.length - completedCount} pending execution
          </p>
        </footer>
      )}
    </div>
  );
}
