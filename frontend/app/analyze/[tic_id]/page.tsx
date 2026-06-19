"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, ChevronDown, BarChart2, GitBranch,
  Activity, Layers, Award, Info, Download, Globe, ShieldCheck
} from "lucide-react";

import PipelineTracker from "@/components/PipelineTracker";
import ClassificationBadge from "@/components/ClassificationBadge";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import StatCard from "@/components/StatCard";
import PlotlyChart from "@/components/PlotlyChart";
import StarField from "@/components/StarField";
import {
  startAnalysis, pollJobStatus, getDemoStar, getReportUrl,
  type AnalysisResult, type JobStatus, CLASSIFICATION_META,
} from "@/lib/api";
import OrbitView from "@/components/orbit/OrbitView";
import VettingReportTab from "@/components/VettingReportTab";

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",     label: "Overview",     icon: Award },
  { id: "lightcurve",  label: "Light Curve",  icon: Activity },
  { id: "phasefold",   label: "Phase Fold",   icon: GitBranch },
  { id: "bls",         label: "BLS Periodogram", icon: BarChart2 },
  { id: "classify",    label: "Classification", icon: Layers },
  { id: "orbit",       label: "Orbit View",    icon: Globe },
  { id: "vetting",     label: "Vetting Report", icon: ShieldCheck },
];

// ── Loading skeleton ───────────────────────────────────────────────────────────
function ScanningLoader({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-8">
      <div className="relative w-40 h-40">
        {/* Orbit rings */}
        {[1, 0.7, 0.45].map((scale, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-space-accent/20"
            style={{ transform: `scale(${scale})`, top: `${(1 - scale) * 50}%`, left: `${(1 - scale) * 50}%`, width: `${scale * 100}%`, height: `${scale * 100}%` }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3 + i * 2, repeat: Infinity, ease: "linear" }}
          />
        ))}
        {/* Center dot */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-4 h-4 rounded-full bg-space-accent" style={{ boxShadow: "0 0 20px #58a6ff" }} />
        </motion.div>
        {/* Scan line */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="scan-line" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-space-accent font-semibold mono text-lg mb-2">Scanning starfield...</div>
        <div className="text-space-muted text-sm mono">{stage}</div>
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ result }: { result: AnalysisResult }) {
  const { bls, fit, classification, confidence, sector, tic_id } = result;
  const meta = CLASSIFICATION_META[classification];

  return (
    <div className="space-y-6">
      {/* Classification + Gauge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-6 flex flex-col items-center justify-center gap-4">
          <ClassificationBadge classification={classification} size="lg" />
          <ConfidenceGauge confidence={confidence} classification={classification} size={180} />
        </div>

        {/* Description */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm mono text-space-muted uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info size={13} /> Analysis Summary
            </h3>
            <p className="text-sm text-space-text leading-relaxed">
              {result.description || "Signal detected and classified by AstroDetect pipeline."}
            </p>
          </div>
          <div className="mt-4 space-divider" />
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs mono px-2 py-1 rounded border border-space-border text-space-muted">
              Sector {sector}
            </span>
            <span className="text-xs mono px-2 py-1 rounded border border-space-border text-space-muted">
              Method: {result.method === "xgboost" ? "XGBoost" : "Rule-based"}
            </span>
            {result.total_elapsed && (
              <span className="text-xs mono px-2 py-1 rounded border border-space-border text-space-muted">
                ⏱ {result.total_elapsed.toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Period" value={bls.period.toFixed(4)} unit="days" delay={0.0} color={meta.color} />
        <StatCard label="Depth" value={Math.round(bls.depth * 1e6).toLocaleString()} unit="ppm" delay={0.05} />
        <StatCard label="Duration" value={(bls.duration * 24).toFixed(2)} unit="hr" delay={0.10} />
        <StatCard label="SNR" value={bls.snr.toFixed(1)} delay={0.15} color={bls.snr > 15 ? "#3fb950" : bls.snr > 7 ? "#e3b341" : "#f85149"} />
        <StatCard label="Rp/Rs" value={fit.rp_rs.toFixed(4)} subvalue={`±${fit.rp_rs_err.toFixed(4)}`} delay={0.20} />
      </div>

      {/* Report image */}
      <div className="glass-card p-4">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart2 size={13} /> Pipeline Report
        </h3>
        <div className="relative bg-space-black rounded-lg overflow-hidden">
          <img
            src={getReportUrl(tic_id, sector)}
            alt={`AstroDetect report for TIC ${tic_id}`}
            className="w-full rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <a
            href={getReportUrl(tic_id, sector)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="absolute top-3 right-3 btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
          >
            <Download size={12} /> PNG
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Light Curve tab ────────────────────────────────────────────────────────────
function LightCurveTab({ result }: { result: AnalysisResult }) {
  const [showTransits, setShowTransits] = useState(true);
  const lc = result.lightcurve;
  if (!lc) return <div className="text-space-muted text-sm p-8 text-center">Light curve data not available.</div>;

  const transitTimes: number[] = [];
  if (showTransits && result.bls) {
    const { period, t0 } = result.bls;
    const tStart = lc.time[0], tEnd = lc.time[lc.time.length - 1];
    for (let t = t0; t <= tEnd + period; t += period) {
      if (t >= tStart && t <= tEnd) transitTimes.push(t);
    }
  }

  const traces: any[] = [
    {
      x: lc.time,
      y: lc.flux,
      mode: "markers",
      type: "scatter",
      name: "Flux",
      marker: { color: "#79c0ff", size: 2, opacity: 0.6 },
    },
    ...transitTimes.map((t, i) => ({
      x: [t, t],
      y: [Math.min(...lc.flux), Math.max(...lc.flux)],
      mode: "lines",
      type: "scatter",
      name: i === 0 ? "Transits" : undefined,
      showlegend: i === 0,
      line: { color: CLASSIFICATION_META[result.classification].color + "80", width: 1, dash: "dash" },
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest">Detrended Light Curve</h3>
        <button
          onClick={() => setShowTransits(!showTransits)}
          className={`btn-ghost text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${showTransits ? "text-space-accent border-space-accent/30" : ""}`}
        >
          {showTransits ? "Hide" : "Show"} transit markers
        </button>
      </div>
      <PlotlyChart
        data={traces}
        layout={{ xaxis: { title: "Time (BTJD)" }, yaxis: { title: "Relative Flux" } }}
        height={420}
      />
    </div>
  );
}

// ── Phase Fold tab ─────────────────────────────────────────────────────────────
function PhaseFoldTab({ result }: { result: AnalysisResult }) {
  const lc = result.lightcurve;
  const { bls, fit, classification } = result;
  if (!lc) return <div className="text-space-muted text-sm p-8 text-center">No data.</div>;

  const { period, t0 } = bls;
  const phase = lc.time.map((t) => {
    let p = ((t - t0) % period) / period;
    if (p > 0.5) p -= 1;
    return p;
  });

  // Simple bin (100 bins)
  const n = 80;
  const bins = Array.from({ length: n }, (_, i) => -0.5 + i / n);
  const binFlux: number[] = [];
  const binPhase: number[] = [];
  bins.forEach((b) => {
    const mask = phase.map((p, i) => ({ p, f: lc.flux[i] })).filter(({ p }) => Math.abs(p - b) < 0.5 / n);
    if (mask.length > 0) {
      binFlux.push(mask.reduce((s, v) => s + v.f, 0) / mask.length);
      binPhase.push(b + 0.5 / (2 * n));
    }
  });

  const sorted = [...phase.map((p, i) => ({ p, f: lc.flux[i] }))].sort((a, b) => a.p - b.p);
  const meta = CLASSIFICATION_META[classification];

  const traces: any[] = [
    {
      x: sorted.map((s) => s.p),
      y: sorted.map((s) => s.f),
      mode: "markers",
      type: "scatter",
      name: "Data",
      marker: { color: "#444c56", size: 2, opacity: 0.5 },
    },
    {
      x: binPhase,
      y: binFlux,
      mode: "markers",
      type: "scatter",
      name: "Binned",
      marker: { color: meta.color, size: 5 },
    },
  ];

  return (
    <div className="space-y-4">
      <PlotlyChart
        data={traces}
        title={`Phase-Folded · P = ${period.toFixed(4)} d`}
        layout={{ xaxis: { title: "Orbital Phase", range: [-0.3, 0.3] }, yaxis: { title: "Relative Flux" } }}
        height={420}
      />
      {/* Fit params table */}
      <div className="glass-card overflow-hidden">
        <table className="space-table w-full">
          <thead>
            <tr>
              <th>Parameter</th><th>Value</th><th>Uncertainty</th><th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Period", fit.period.toFixed(6), `±${fit.period_err.toFixed(6)}`, "days"],
              ["Depth", (fit.depth * 1e6).toFixed(0), `±${(fit.depth_err * 1e6).toFixed(0)}`, "ppm"],
              ["Duration", (fit.duration * 24).toFixed(3), `±${(fit.duration_err * 24).toFixed(3)}`, "hours"],
              ["Rp/Rs", fit.rp_rs.toFixed(5), `±${fit.rp_rs_err.toFixed(5)}`, "—"],
              ["a/Rs", fit.a_rs.toFixed(3), `±${fit.a_rs_err.toFixed(3)}`, "—"],
              ["Inclination", fit.inc.toFixed(3), `±${fit.inc_err.toFixed(3)}`, "°"],
              ["χ² reduced", fit.chi2_red.toFixed(4), "—", "—"],
            ].map(([name, val, err, unit]) => (
              <tr key={name}>
                <td className="text-space-muted">{name}</td>
                <td className="text-space-accent">{val}</td>
                <td className="text-space-muted">{err}</td>
                <td className="text-space-muted">{unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BLS Periodogram tab ────────────────────────────────────────────────────────
function BLSTab({ result }: { result: AnalysisResult }) {
  const { bls, classification } = result;
  const { period_grid, power_grid, period } = bls;
  const meta = CLASSIFICATION_META[classification];

  if (!period_grid?.length) return <div className="text-space-muted text-sm p-8 text-center">No periodogram data.</div>;

  const traces: any[] = [
    {
      x: period_grid,
      y: power_grid,
      mode: "lines",
      type: "scatter",
      name: "BLS Power",
      line: { color: "#79c0ff", width: 1 },
      fill: "tozeroy",
      fillcolor: "rgba(88,166,255,0.07)",
    },
    {
      x: [period, period],
      y: [0, Math.max(...power_grid) * 1.05],
      mode: "lines",
      type: "scatter",
      name: `Best: ${period.toFixed(4)} d`,
      line: { color: meta.color, width: 2 },
    },
    {
      x: [period * 2, period * 2],
      y: [0, Math.max(...power_grid) * 0.6],
      mode: "lines",
      type: "scatter",
      name: `2× P`,
      line: { color: "#8b949e", width: 1, dash: "dash" },
    },
    {
      x: [period * 3, period * 3],
      y: [0, Math.max(...power_grid) * 0.4],
      mode: "lines",
      type: "scatter",
      name: `3× P`,
      line: { color: "#8b949e", width: 1, dash: "dot" },
    },
  ];

  return (
    <div className="space-y-4">
      <PlotlyChart
        data={traces}
        title="BLS Periodogram"
        layout={{ xaxis: { title: "Period (days)" }, yaxis: { title: "BLS Power (SNR)" } }}
        height={420}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Best Period" value={period.toFixed(4)} unit="d" />
        <StatCard label="Peak SNR" value={bls.snr.toFixed(1)} />
        <StatCard label="Odd/Even Ratio" value={bls.odd_even_ratio.toFixed(3)} color={bls.odd_even_ratio > 0.2 ? "#f85149" : "#3fb950"} />
        <StatCard label="Transits" value={bls.n_transits} />
      </div>
    </div>
  );
}

// ── Classification tab ─────────────────────────────────────────────────────────
function ClassifyTab({ result }: { result: AnalysisResult }) {
  const { class_probabilities, bls, classification } = result;

  const classOrder = ["PLANET_TRANSIT", "ECLIPSING_BINARY", "BLEND", "OTHER", "NO_SIGNAL"] as const;

  return (
    <div className="space-y-6">
      {/* Probability bars */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest">Class Probabilities</h3>
        {classOrder.map((cls) => {
          const prob = class_probabilities[cls] || 0;
          const meta = CLASSIFICATION_META[cls];
          return (
            <div key={cls} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{meta.emoji}</span>
                  <span className={cls === classification ? "text-space-text font-semibold" : "text-space-muted"}>
                    {meta.label}
                  </span>
                  {cls === classification && (
                    <span className="text-xs mono px-1.5 py-0.5 rounded bg-space-accent/15 text-space-accent">best</span>
                  )}
                </div>
                <span className="mono text-sm" style={{ color: meta.color }}>{(prob * 100).toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <motion.div
                  className="progress-fill"
                  style={{ background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${prob * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostic flags */}
      <div className="glass-card overflow-hidden">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest p-4 border-b border-space-border">
          Diagnostic Flags
        </h3>
        <table className="space-table w-full">
          <thead>
            <tr>
              <th>Flag</th><th>Value</th><th>Threshold</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { flag: "SNR", value: bls.snr.toFixed(1), threshold: "> 5.0", pass: bls.snr > 5 },
              { flag: "Depth (ppm)", value: (bls.depth * 1e6).toFixed(0), threshold: "100–30000", pass: bls.depth * 1e6 >= 100 && bls.depth * 1e6 <= 30000 },
              { flag: "Odd-Even Ratio", value: bls.odd_even_ratio.toFixed(3), threshold: "< 0.20 for planet", pass: bls.odd_even_ratio < 0.20 },
              { flag: "Secondary Depth (ppm)", value: (bls.secondary_depth * 1e6).toFixed(0), threshold: "< 5% primary", pass: bls.secondary_depth < bls.depth * 0.05 },
              { flag: "N Transits", value: String(bls.n_transits), threshold: "≥ 2", pass: bls.n_transits >= 2 },
            ].map(({ flag, value, threshold, pass }) => (
              <tr key={flag}>
                <td className="text-space-text">{flag}</td>
                <td className="text-space-accent mono">{value}</td>
                <td className="text-space-muted">{threshold}</td>
                <td>
                  <span className={`text-xs mono font-semibold ${pass ? "text-space-planet" : "text-space-eb"}`}>
                    {pass ? "✓ PASS" : "✗ FAIL"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AnalyzePage() {
  const params = useParams<{ tic_id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticId = params.tic_id;
  const isDemo = searchParams.get("demo") === "true";

  const [activeTab, setActiveTab] = useState("overview");
  const [sector, setSector] = useState<number | undefined>(undefined);
  const [jobStatus, setJobStatus] = useState<JobStatus>({ job_id: "", stage: "QUEUED", progress: 0, elapsed: {} });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAnalysis = useCallback(async () => {
    setResult(null);
    setError(null);
    setIsRunning(true);
    setJobStatus({ job_id: "", stage: "QUEUED", progress: 0, elapsed: {} });

    try {
      if (isDemo) {
        // Instant demo
        setJobStatus({ job_id: "demo", stage: "DONE", progress: 100, elapsed: {} });
        const data = await getDemoStar(ticId);
        setResult(data);
      } else {
        const { job_id } = await startAnalysis(ticId, sector);
        setJobStatus((j) => ({ ...j, job_id, stage: "INGEST", progress: 5 }));

        // Poll every 1.5s
        const poll = async () => {
          const status = await pollJobStatus(job_id);
          setJobStatus(status);
          if (status.stage === "DONE" && status.result) {
            setResult(status.result);
            setIsRunning(false);
          } else if (status.stage === "ERROR") {
            setError(status.error || "Pipeline failed");
            setIsRunning(false);
          } else {
            setTimeout(poll, 1500);
          }
        };
        setTimeout(poll, 1000);
      }
    } catch (e: any) {
      setError(e.message || "Failed to start analysis");
      setIsRunning(false);
    }
  }, [ticId, sector, isDemo]);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  useEffect(() => {
    if (result) setIsRunning(false);
  }, [result]);

  const isDone = result !== null;

  return (
    <div className="relative min-h-screen">
      <StarField />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-space-text">
              <span className="text-space-muted font-normal">TIC </span>
              <span className="mono text-space-accent">{ticId}</span>
            </h1>
            <p className="text-sm text-space-muted mt-1">
              {isDemo ? "Demo mode — pre-computed results" : "Live TESS pipeline analysis"}
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={isRunning}
            className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          >
            <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
            Re-run
          </button>
        </motion.div>

        {/* Main layout: sidebar + content */}
        <div className="flex gap-6 analyze-layout" style={{ alignItems: "flex-start" }}>
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="analyze-sidebar glass-card p-4 flex-shrink-0"
            style={{ width: 240 }}
          >
            {/* Sector selector */}
            <div className="mb-4">
              <label className="text-xs mono text-space-muted uppercase tracking-wider block mb-1.5">
                Sector
              </label>
              <div className="relative">
                <select
                  value={sector || ""}
                  onChange={(e) => setSector(e.target.value ? Number(e.target.value) : undefined)}
                  className="space-input w-full px-3 py-2 rounded-lg text-sm appearance-none pr-8"
                >
                  <option value="">Auto-detect</option>
                  {Array.from({ length: 26 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>Sector {s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-space-muted pointer-events-none" />
              </div>
            </div>

            <div className="space-divider" />

            {/* Pipeline tracker */}
            <PipelineTracker
              currentStage={jobStatus.stage}
              progress={jobStatus.progress}
              elapsed={jobStatus.elapsed}
              error={error || undefined}
            />
          </motion.div>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {!isDone && !error && (
              <div className="glass-card">
                <ScanningLoader stage={jobStatus.stage} />
              </div>
            )}

            {error && !isDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
              >
                <div className="text-4xl mb-4">🔭</div>
                <h2 className="text-xl font-bold text-space-eb mb-2">Star not found</h2>
                <p className="text-space-muted text-sm max-w-sm mx-auto mb-6">{error}</p>
                <div className="text-xs text-space-muted mono mb-4">Try a demo star instead:</div>
                <div className="flex justify-center gap-3 flex-wrap">
                  {["261136679", "219114641", "38846515"].map((id) => (
                    <button
                      key={id}
                      onClick={() => router.push(`/analyze/${id}?demo=true`)}
                      className="btn-ghost px-4 py-2 rounded-lg text-sm mono"
                    >
                      TIC {id}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {isDone && result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Tabs */}
                <div className="flex gap-0 border-b border-space-border mb-5 overflow-x-auto">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      id={`tab-${id}`}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                        activeTab === id ? "tab-active" : "tab-inactive"
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === "overview" && <OverviewTab result={result} />}
                    {activeTab === "lightcurve" && <LightCurveTab result={result} />}
                    {activeTab === "phasefold" && <PhaseFoldTab result={result} />}
                    {activeTab === "bls" && <BLSTab result={result} />}
                    {activeTab === "classify" && <ClassifyTab result={result} />}
                    {activeTab === "orbit" && (
                      result.classification === "PLANET_TRANSIT" ? (
                        <OrbitView ticId={result.tic_id} classificationDesc={result.description} />
                      ) : (
                        <div className="flex items-center justify-center h-64 text-space-muted mono text-sm text-center px-4">
                          Orbital view available only for confirmed transit detections.
                        </div>
                      )
                    )}
                    {activeTab === "vetting" && (
                      <VettingReportTab ticId={result.tic_id} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
