"use client"

import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

export function Hero() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-8 overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Top Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Technical Intelligence Protocol Active
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="font-sans text-6xl md:text-8xl lg:text-9xl font-light tracking-tight leading-[0.9] mb-8"
        >
          Shadow <span className="italic">Architect</span>
          <br />
          <span className="text-muted-foreground/50">Technical Layer.</span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="max-w-xl mx-auto font-mono text-sm md:text-base text-muted-foreground/80 leading-relaxed mb-12"
        >
          The autonomous Shadow CTO system. We monitor your stack for security, model pricing, and framework deprecations - synthesized by Gemini.
        </motion.p>

        {/* Call to Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col md:flex-row items-center justify-center gap-6"
        >
          <button
            onClick={handleLogin}
            data-cursor-hover
            className="group relative px-8 py-4 bg-white text-background rounded-full font-mono text-xs tracking-widest overflow-hidden transition-transform active:scale-95"
          >
            <span className="relative z-10">LAUNCH SYSTEM</span>
            <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>

          <a
            href="#about"
            data-cursor-hover
            className="font-mono text-xs tracking-widest text-muted-foreground hover:text-white transition-colors duration-300 border-b border-white/10 pb-1"
          >
            VIEW PROTOCOL
          </a>
        </motion.div>
      </div>

      {/* Decorative vertical lines */}
      <div className="absolute left-12 top-0 bottom-0 w-px bg-white/5 hidden lg:block" />
      <div className="absolute right-12 top-0 bottom-0 w-px bg-white/5 hidden lg:block" />

      {/* Hero Footer Stats */}
      <div className="absolute bottom-12 left-8 md:left-12 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Model: Gemini 2.5 Flash
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-px bg-white/20" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status: Fully Autonomous
          </span>
        </div>
      </div>
    </section>
  )
}
