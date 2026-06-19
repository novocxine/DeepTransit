"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  ShieldCheck, ShieldAlert, ShieldX, Shield, Info, Telescope
} from "lucide-react";
import { type VettingReport, type VettingTest, type VettingSeverity, getVettingReport } from "@/lib/api";
import { useEffect } from "react";

// ── Verdict config ─────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  PASSES_ALL_CHECKS: {
    label: "Passes All Vetting Checks",
    icon: ShieldCheck,
    color: "#3fb950",
    bg: "rgba(63,185,80,0.10)",
    border: "rgba(63,185,80,0.35)",
    emoji: "✅",
  },
  PASSES_WITH_CAUTION: {
    label: "Passes — With Caution Flags",
    icon: ShieldAlert,
    color: "#e3b341",
    bg: "rgba(227,179,65,0.10)",
    border: "rgba(227,179,65,0.35)",
    emoji: "⚠️",
  },
  REQUIRES_MANUAL_REVIEW: {
    label: "Requires Manual Review",
    icon: Shield,
    color: "#f0883e",
    bg: "rgba(240,136,62,0.10)",
    border: "rgba(240,136,62,0.35)",
    emoji: "🔍",
  },
  LIKELY_FALSE_POSITIVE: {
    label: "Likely False Positive",
    icon: ShieldX,
    color: "#f85149",
    bg: "rgba(248,81,73,0.10)",
    border: "rgba(248,81,73,0.35)",
    emoji: "❌",
  },
} as const;

// ── Severity helpers ───────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: VettingSeverity }) {
  if (severity === "pass") return <CheckCircle2 size={18} className="text-[#3fb950] shrink-0" />;
  if (severity === "caution") return <AlertTriangle size={18} className="text-[#e3b341] shrink-0" />;
  return <XCircle size={18} className="text-[#f85149] shrink-0" />;
}

function severityLabel(s: VettingSeverity) {
  if (s === "pass") return { text: "PASS", cls: "text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/30" };
  if (s === "caution") return { text: "CAUTION", cls: "text-[#e3b341] bg-[#e3b341]/10 border-[#e3b341]/30" };
  return { text: "FAIL", cls: "text-[#f85149] bg-[#f85149]/10 border-[#f85149]/30" };
}

// ── Individual test row ────────────────────────────────────────────────────────

function TestRow({ test, index }: { test: VettingTest; index: number }) {
  const [open, setOpen] = useState(false);
  const badge = severityLabel(test.severity);

  const formatValue = (v: number | null, threshold: number | null) => {
    if (v === null) return "—";
    // Show threshold direction hint
    return v.toFixed(4);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="border border-space-card rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-space-card/30 transition-colors duration-150 text-left"
      >
        <SeverityIcon severity={test.severity} />

        <span className="flex-1 text-sm font-medium text-[#c9d1d9] mono">{test.name}</span>

        {/* Value / Threshold */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-space-muted mr-4">
          <span>
            value: <span className="text-[#c9d1d9]">{formatValue(test.value, test.threshold)}</span>
          </span>
          {test.threshold !== null && (
            <span>
              threshold: <span className="text-[#c9d1d9]">{test.threshold}</span>
            </span>
          )}
        </div>

        <span className={`text-[10px] font-bold mono px-2 py-0.5 rounded border ${badge.cls}`}>
          {badge.text}
        </span>
        {open ? <ChevronUp size={14} className="text-space-muted shrink-0" /> : <ChevronDown size={14} className="text-space-muted shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-space-card/40">
              {/* Mobile value row */}
              <div className="sm:hidden flex gap-4 text-xs font-mono text-space-muted mb-3">
                <span>value: <span className="text-[#c9d1d9]">{formatValue(test.value, test.threshold)}</span></span>
                {test.threshold !== null && <span>threshold: <span className="text-[#c9d1d9]">{test.threshold}</span></span>}
              </div>
              <p className="text-xs text-space-muted leading-relaxed">{test.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Summary counters ───────────────────────────────────────────────────────────

function VerdictCounters({ overall }: { overall: VettingReport["overall"] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {[
        { label: "Passed", n: overall.n_pass, color: "#3fb950" },
        { label: "Caution", n: overall.n_caution, color: "#e3b341" },
        { label: "Failed", n: overall.n_fail, color: "#f85149" },
      ].map(({ label, n, color }) => (
        <div key={label} className="glass-card p-3 text-center">
          <div className="text-2xl font-bold mono" style={{ color }}>{n}</div>
          <div className="text-[10px] text-space-muted mono uppercase tracking-widest mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Classifier context callout ─────────────────────────────────────────────────

function ClassifierCallout({ ctx }: { ctx: VettingReport["classifier_context"] }) {
  if (!ctx) return null;
  return (
    <div className="mt-4 p-3 rounded-lg border border-space-card/50 bg-space-card/20 flex gap-2 items-start text-xs text-space-muted">
      <Info size={13} className="shrink-0 mt-0.5 text-[#58a6ff]" />
      <div>
        <strong className="text-[#58a6ff]">Context: </strong>
        {ctx.note}
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function VettingLoader() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-space-card/30 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function VettingEmptyState({ ticId }: { ticId: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-space-card/40 border border-space-card flex items-center justify-center">
        <Telescope size={28} className="text-space-muted/50" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#c9d1d9] mb-1">No analysis available</h3>
        <p className="text-sm text-space-muted max-w-xs">
          Run an analysis for TIC {ticId} first — the vetting suite requires a completed BLS detection.
        </p>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

const TEST_ORDER: Array<keyof VettingReport> = [
  "odd_even_test",
  "secondary_eclipse_test",
  "shape_test",
  "depth_consistency_test",
  "duration_consistency_test",
  "snr_test",
];

export default function VettingReportTab({ ticId }: { ticId: string }) {
  const [report, setReport] = useState<VettingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getVettingReport(ticId)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticId]);

  if (loading) return <VettingLoader />;
  if (error || !report) return <VettingEmptyState ticId={ticId} />;

  const verdictCfg = VERDICT_CONFIG[report.overall.verdict];
  const VerdictIcon = verdictCfg.icon;

  return (
    <div className="space-y-5">
      {/* Verdict Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border p-5"
        style={{ background: verdictCfg.bg, borderColor: verdictCfg.border }}
      >
        <div className="flex items-center gap-3 mb-2">
          <VerdictIcon size={24} style={{ color: verdictCfg.color }} />
          <h2 className="text-lg font-bold mono" style={{ color: verdictCfg.color }}>
            {verdictCfg.label}
          </h2>
          <span className="text-xl">{verdictCfg.emoji}</span>
        </div>

        <p className="text-xs text-space-muted leading-relaxed max-w-2xl">
          {report.overall.note}
        </p>

        <VerdictCounters overall={report.overall} />
      </motion.div>

      {/* Classifier Context */}
      <ClassifierCallout ctx={report.classifier_context} />

      {/* Checklist */}
      <div>
        <h3 className="text-xs mono text-space-muted uppercase tracking-widest mb-3 flex items-center gap-2">
          <Shield size={12} /> Diagnostic Tests ({report.overall.n_tests} total)
        </h3>
        <div className="space-y-2">
          {TEST_ORDER.map((key, i) => {
            const test = report[key] as VettingTest | undefined;
            if (!test || typeof test !== "object" || !("name" in test)) return null;
            return <TestRow key={key} test={test} index={i} />;
          })}
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="text-[10px] text-space-muted/60 mono text-center pt-2 border-t border-space-card/30">
        Vetting methodology modelled on TESS Science Office and Kepler Robovetter frameworks. 
        Individual tests are independent — a failure on one does not automatically invalidate a detection.
      </div>
    </div>
  );
}
