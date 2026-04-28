"use client"

import type React from "react"
import { useState, useRef } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

const agents = [
  {
    title: "Manifest Builder",
    tags: ["scan-repo", "Gemini 2.5 Flash", "Autonomous"],
    image: "/manifest_builder.png",
    year: "AGENT 01",
    desc: "Synthesizes a structured JSON Tech Manifest from raw repository contents."
  },
  {
    title: "Fuzzer Agent",
    tags: ["run-fuzzer", "OSV.dev", "Security"],
    image: "/fuzzer_agent.png",
    year: "AGENT 02",
    desc: "Continuously queries vulnerability databases and filters false positives with AI."
  },
  {
    title: "Landscape Scraper",
    tags: ["run-scraper", "Tavily", "Insights"],
    image: "/landscape_scraper.png",
    year: "AGENT 03",
    desc: "Monitors the tech ecosystem for deprecations and identifies better alternatives."
  },
  {
    title: "Gemini Integration",
    tags: ["LLM", "Google AI", "Optimization"],
    image: "/gemini_integration.png",
    year: "CORE",
    desc: "Powered by the Google AI Stack for extreme reasoning and efficiency."
  },
]

export function Works() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    }
  }

  return (
    <section id="works" className="relative py-32 px-8 md:px-12 md:py-24">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mb-24"
      >
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">04 - SYSTEM AGENTS</p>
        <h2 className="font-sans text-3xl md:text-5xl font-light italic">The Intelligence Layer</h2>
      </motion.div>

      {/* Agents List */}
      <div ref={containerRef} onMouseMove={handleMouseMove} className="relative">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.title}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
            className="relative border-t border-white/10 py-8 md:py-12"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="group flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Year/ID */}
              <span className="font-mono text-xs text-muted-foreground tracking-widest order-1 md:order-none">
                {agent.year}
              </span>

              {/* Title */}
              <div className="flex-1">
                <motion.h3
                  className="font-sans text-4xl md:text-6xl lg:text-7xl font-light tracking-tight group-hover:text-white/70 transition-colors duration-300"
                  animate={{
                    x: hoveredIndex === index ? 20 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {agent.title}
                </motion.h3>
                <motion.p 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                   className="font-mono text-xs text-muted-foreground mt-2 max-w-md"
                >
                  {agent.desc}
                </motion.p>
              </div>

              {/* Tags */}
              <div className="flex gap-2 flex-wrap order-2 md:order-none">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] tracking-wider px-3 py-1 border border-white/20 rounded-full text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Floating Image */}
        <motion.div
          className="absolute pointer-events-none z-50 w-64 h-40 md:w-80 md:h-48 overflow-hidden rounded-lg"
          style={{
            x: springX,
            y: springY,
            translateX: "-50%",
            translateY: "-320%",
          }}
          animate={{
            opacity: hoveredIndex !== null ? 1 : 0,
            scale: hoveredIndex !== null ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          {hoveredIndex !== null && (
            <motion.img
              src={agents[hoveredIndex].image}
              alt={agents[hoveredIndex].title}
              className="w-full h-full object-cover"
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                filter: "grayscale(20%) contrast(1.1)",
              }}
            />
          )}
          {/* Accent overlay */}
          <div className="absolute inset-0 bg-accent/10 mix-blend-overlay" />
        </motion.div>
      </div>

      {/* Bottom Border */}
      <div className="border-t border-white/10" />
    </section>
  )
}
