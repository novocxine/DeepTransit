"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Telescope, ExternalLink, Layers, BookOpen, Cpu } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Telescope },
  { href: "/batch", label: "Batch", icon: Layers },
  { href: "/about", label: "Pipeline", icon: BookOpen },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-space-border"
      style={{ background: "rgba(13,17,23,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Cpu size={20} className="text-space-accent" />
          </motion.div>
          <span className="font-bold text-base text-space-text group-hover:text-space-accent transition-colors">
            Astro<span className="text-space-accent">Detect</span>
          </span>
          <span className="hidden sm:block text-xs text-space-muted mono border border-space-border rounded px-1.5 py-0.5">
            BAH 2026
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-space-accent bg-space-accent/10"
                    : "text-space-muted hover:text-space-text hover:bg-space-card"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:block">{label}</span>
              </Link>
            );
          })}
          <a
            href="https://github.com/novocxine/DeepTransit"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 p-1.5 text-space-muted hover:text-space-text transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
