"use client";

import { Code, Orbit, BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-space-card/60 bg-[#0d1117]/80 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-space-accent to-space-accent/50 flex items-center justify-center border border-[#58a6ff]/30 shadow-[0_0_15px_rgba(88,166,255,0.4)]">
                <Orbit className="text-white" size={18} />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#c9d1d9] glow-text">
                AstroDetect
              </span>
            </div>
            <p className="text-sm text-space-muted leading-relaxed max-w-sm">
              An AI-powered pipeline for exoplanet transit detection from TESS light curves. 
              Built with scientific rigor and modern aesthetics for the Bharatiya Antariksh Hackathon.
            </p>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-space-accent mono">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://heasarc.gsfc.nasa.gov/docs/tess/" target="_blank" rel="noreferrer" className="text-space-muted hover:text-[#c9d1d9] transition-colors flex items-center gap-2">
                  TESS Science Docs <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://archive.stsci.edu/tess/" target="_blank" rel="noreferrer" className="text-space-muted hover:text-[#c9d1d9] transition-colors flex items-center gap-2">
                  MAST Archive <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer" className="text-space-muted hover:text-[#c9d1d9] transition-colors flex items-center gap-2">
                  NASA Exoplanet Archive <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Project */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-space-accent mono">Project</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/novocxine/DeepTransit" target="_blank" rel="noreferrer" className="text-space-muted hover:text-[#c9d1d9] transition-colors flex items-center gap-2">
                  <Code size={14} /> Source Code
                </a>
              </li>
              <li>
                <Link href="/analyze" className="text-space-muted hover:text-[#c9d1d9] transition-colors flex items-center gap-2">
                  <Orbit size={14} /> Pipeline Engine
                </Link>
              </li>
              <li>
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-[#3fb950]/10 border border-[#3fb950]/30 text-[#3fb950] text-xs font-mono mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                  Systems Operational
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-space-card/50 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-space-muted/70">
          <p>© {currentYear} AstroDetect. Open-source under MIT License.</p>
          <div className="flex items-center gap-1.5 font-mono bg-space-card/30 px-3 py-1.5 rounded-full border border-space-card/60">
            <span>Challenge 7</span>
            <span className="text-space-card/80">•</span>
            <span>BAH 2026</span>
            <span className="text-space-card/80">•</span>
            <span>ISRO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
