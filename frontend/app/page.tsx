"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, Star, ChevronRight, ExternalLink, ArrowRight } from "lucide-react";
import StarField from "@/components/StarField";
import ClassificationBadge from "@/components/ClassificationBadge";
import type { Classification } from "@/lib/api";

const DEMO_STARS = [
  { tic: "261136679", label: "Hot Jupiter", cls: "PLANET_TRANSIT" as Classification, period: "3.485 d", depth: "1,420 ppm" },
  { tic: "219114641", label: "Eclipsing Binary", cls: "ECLIPSING_BINARY" as Classification, period: "1.744 d", depth: "18,500 ppm" },
  { tic: "38846515",  label: "Diluted Blend",   cls: "BLEND" as Classification,           period: "7.221 d", depth: "380 ppm" },
];

// Animated waveform SVG
function LightCurveWave() {
  const pts = Array.from({ length: 200 }, (_, i) => {
    const x = (i / 199) * 100;
    const noise = Math.sin(i * 0.3) * 0.4 + Math.sin(i * 0.7) * 0.2 + Math.sin(i * 1.3) * 0.1;
    // Transit dips
    const dip1 = Math.exp(-Math.pow(i - 50, 2) / 20) * 3;
    const dip2 = Math.exp(-Math.pow(i - 120, 2) / 20) * 3;
    const dip3 = Math.exp(-Math.pow(i - 170, 2) / 20) * 3;
    const y = 50 + noise - dip1 - dip2 - dip3;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full opacity-10"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke="#58a6ff"
        strokeWidth="0.4"
        className="waveform-line"
      />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [ticInput, setTicInput] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = ticInput.trim().replace(/^TIC\s*/i, "").replace(/\s/g, "");
    if (!clean) {
      setError("Please enter a TIC ID (e.g. 261136679)");
      return;
    }
    if (!/^\d+$/.test(clean)) {
      setError("TIC ID must be numeric (e.g. 261136679)");
      return;
    }
    setError("");
    setIsSearching(true);
    router.push(`/analyze/${clean}`);
  };

  const loadDemo = (ticId: string) => {
    router.push(`/analyze/${ticId}?demo=true`);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <StarField />

      {/* Hero gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(31,111,235,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(88,166,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Animated waveform background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <LightCurveWave />
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-space-accent/30 bg-space-accent/8 text-space-accent text-xs font-medium mono"
        >
          <Zap size={12} />
          BAH 2026 · Challenge 7 · ISRO
          <Zap size={12} />
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-7xl font-extrabold text-space-text leading-tight mb-5"
        >
          Find planets in{" "}
          <span
            className="glow-text"
            style={{
              background: "linear-gradient(135deg, #58a6ff, #79c0ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            starlight
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-space-muted max-w-xl mb-12 leading-relaxed"
        >
          AI pipeline for TESS exoplanet transit detection.{" "}
          <span className="text-space-text">BLS period search</span>,{" "}
          <span className="text-space-text">XGBoost classification</span>,{" "}
          <span className="text-space-text">batman transit fitting</span> — in seconds.
        </motion.p>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-lg mb-4"
        >
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
              style={{ background: "linear-gradient(135deg, #1f6feb40, #58a6ff30)", filter: "blur(12px)", zIndex: -1 }}
            />
            <div className="flex items-center glass-card rounded-2xl border-space-border p-1.5">
              <div className="flex items-center gap-3 px-4 flex-1">
                <Search size={18} className="text-space-muted flex-shrink-0" />
                <input
                  ref={inputRef}
                  id="tic-search"
                  type="text"
                  value={ticInput}
                  onChange={(e) => { setTicInput(e.target.value); setError(""); }}
                  placeholder="Enter TIC ID (e.g. 261136679)"
                  className="flex-1 bg-transparent text-space-text placeholder-space-muted outline-none text-base py-2.5 mono"
                  autoComplete="off"
                  disabled={isSearching}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
                id="analyze-btn"
              >
                {isSearching ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Zap size={16} />
                  </motion.div>
                ) : (
                  <ArrowRight size={16} />
                )}
                Analyze
              </button>
            </div>
          </form>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-space-eb text-sm mt-2 mono"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="text-xs text-space-muted mt-3">
            Searches the{" "}
            <a href="https://archive.stsci.edu/tess/" target="_blank" rel="noopener noreferrer"
              className="text-space-accent hover:underline inline-flex items-center gap-0.5">
              TESS MAST archive <ExternalLink size={10} />
            </a>
            {" "}· ~30-60s for live analysis
          </p>
        </motion.div>

        {/* Demo stars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center gap-2 mb-3 justify-center">
            <Star size={12} className="text-space-muted" />
            <span className="text-xs text-space-muted mono uppercase tracking-widest">
              Try demo stars — instant results
            </span>
            <Star size={12} className="text-space-muted" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMO_STARS.map((s, i) => (
              <motion.button
                key={s.tic}
                onClick={() => loadDemo(s.tic)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="glass-card p-4 text-left group cursor-pointer"
                id={`demo-star-${s.tic}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <ClassificationBadge classification={s.cls} size="sm" />
                  <ChevronRight
                    size={14}
                    className="text-space-muted group-hover:text-space-accent transition-colors mt-0.5"
                  />
                </div>
                <div className="mono text-sm text-space-accent font-semibold mb-1">
                  TIC {s.tic}
                </div>
                <div className="text-xs text-space-muted">{s.label}</div>
                <div className="space-divider my-2" />
                <div className="flex gap-3 text-xs mono text-space-muted">
                  <span>P = {s.period}</span>
                  <span>{s.depth}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex flex-wrap justify-center gap-2 mt-10"
        >
          {["BLS Periodogram", "Wotan Detrending", "Batman Transit Model", "XGBoost Classifier", "Phase Folding"].map(f => (
            <span key={f} className="text-xs mono px-3 py-1 rounded-full border border-space-border text-space-muted">
              {f}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: "linear-gradient(to top, #0d1117 0%, transparent 100%)" }}
      />
    </div>
  );
}
