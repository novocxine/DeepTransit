"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Play, Download, Loader2, CheckCircle2,
  XCircle, AlertCircle, Trash2, Plus
} from "lucide-react";
import StarField from "@/components/StarField";
import ClassificationBadge from "@/components/ClassificationBadge";
import { startBatch, getBatchStatus, type Classification } from "@/lib/api";

interface BatchResult {
  tic_id: string;
  sector?: number;
  classification: Classification;
  confidence: number;
  period: number;
  depth_ppm: number;
  duration_hr: number;
  snr: number;
  rp_rs?: number;
  chi2_red?: number;
}

interface BatchJob {
  batch_id: string;
  total: number;
  completed: number;
  status: string;
  results: Record<string, BatchResult>;
  errors: Record<string, string>;
}

const PLACEHOLDER_IDS = `261136679
219114641
38846515`;

function parseTicIds(text: string): string[] {
  return text
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().replace(/^TIC\s*/i, "").replace(/\s/g, ""))
    .filter((s) => /^\d{5,12}$/.test(s));
}

function StatusBadge({ status }: { status: string }) {
  if (status === "DONE")
    return <span className="text-xs mono text-space-planet font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> Done</span>;
  if (status === "RUNNING")
    return <span className="text-xs mono text-space-accent flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Running</span>;
  return <span className="text-xs mono text-space-muted">{status}</span>;
}

export default function BatchPage() {
  const [inputText, setInputText] = useState(PLACEHOLDER_IDS);
  const [sector, setSector] = useState<string>("");
  const [useCtl, setUseCtl] = useState(false);
  const [useArchive, setUseArchive] = useState(false);
  const [targetsPerSource, setTargetsPerSource] = useState<string>("50");
  const [job, setJob] = useState<BatchJob | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<keyof BatchResult>("confidence");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ticIds = parseTicIds(inputText);

  const handleRun = async () => {
    if (ticIds.length === 0 && !useCtl && !useArchive) { 
      setError("No valid TIC IDs found and no external sources selected."); 
      return; 
    }
    
    // Build sources list
    const sources: string[] = [];
    if (useCtl) sources.push("ctl");
    if (useArchive) sources.push("exoplanet_archive");

    const totalEstimated = ticIds.length + (sources.length * (parseInt(targetsPerSource) || 0));
    if (totalEstimated > 150) {
      setError(`Estimated target count (${totalEstimated}) exceeds maximum allowed (150).`);
      return;
    }

    setError("");
    setIsRunning(true);
    setJob(null);

    try {
      const res = await startBatch(
        ticIds, 
        sector ? Number(sector) : undefined,
        sources,
        parseInt(targetsPerSource) || 50
      );
      // Poll for status
      const poll = async () => {
        const status: BatchJob = await getBatchStatus(res.batch_id);
        setJob(status);
        if (status.status === "DONE") {
          setIsRunning(false);
        } else {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 1000);
    } catch (e: any) {
      setError(e.message || "Batch failed");
      setIsRunning(false);
    }
  };

  const handleSort = (key: keyof BatchResult) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortedResults = job
    ? Object.values(job.results).sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      })
    : [];

  const exportCsv = () => {
    const headers = ["TIC ID", "Classification", "Confidence", "Period (d)", "Depth (ppm)", "Duration (hr)", "SNR", "Rp/Rs"];
    const rows = sortedResults.map(r => [
      r.tic_id, r.classification, r.confidence, r.period, r.depth_ppm, r.duration_hr, r.snr, r.rp_rs ?? ""
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "astrodetect_batch.csv"; a.click();
  };

  const SortHeader = ({ label, k }: { label: string; k: keyof BatchResult }) => (
    <th
      className="cursor-pointer select-none hover:text-space-accent transition-colors"
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="relative min-h-screen">
      <StarField />
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-space-text mb-2">
            Batch <span className="text-space-accent">Analysis</span>
          </h1>
          <p className="text-space-muted text-sm">Process up to 50 TESS targets simultaneously</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-4"
          >
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm mono text-space-muted uppercase tracking-wider">
                  Manual TIC IDs
                </label>
                <span className="text-xs mono text-space-accent">
                  {ticIds.length}
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="One TIC ID per line&#10;261136679&#10;219114641&#10;38846515"
                rows={4}
                className="space-input w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              />
            </div>

            {/* Target Sources */}
            <div className="glass-card p-5">
              <label className="text-sm mono text-space-muted uppercase tracking-wider block mb-3">
                Target Sources
              </label>
              
              <div className="space-y-3 mb-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={useCtl} onChange={(e) => setUseCtl(e.target.checked)} className="peer sr-only" />
                    <div className="w-5 h-5 rounded border border-space-border bg-space-bg peer-checked:bg-space-accent peer-checked:border-space-accent transition-all flex items-center justify-center">
                      {useCtl && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-space-text group-hover:text-space-accent transition-colors">Official CTL</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={useArchive} onChange={(e) => setUseArchive(e.target.checked)} className="peer sr-only" />
                    <div className="w-5 h-5 rounded border border-space-border bg-space-bg peer-checked:bg-space-accent peer-checked:border-space-accent transition-all flex items-center justify-center">
                      {useArchive && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-space-text group-hover:text-space-accent transition-colors">NASA Exoplanet Archive</span>
                </label>
              </div>

              {(useCtl || useArchive) && (
                <div className="pt-3 border-t border-space-border">
                  <label className="text-xs text-space-muted block mb-1">Targets per source (max 50)</label>
                  <input
                    type="number"
                    min={1} max={50}
                    value={targetsPerSource}
                    onChange={(e) => setTargetsPerSource(e.target.value)}
                    className="space-input w-full px-3 py-1.5 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            <div className="glass-card p-5">
              <label className="text-sm mono text-space-muted uppercase tracking-wider block mb-2">
                Sector (optional)
              </label>
              <input
                type="number"
                min={1} max={26}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Auto-detect"
                className="space-input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-space-eb/10 border border-space-eb/30 text-space-eb text-sm"
                >
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleRun}
              disabled={isRunning || (ticIds.length === 0 && !useCtl && !useArchive)}
              className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              id="batch-run-btn"
            >
              {isRunning ? (
                <><Loader2 size={15} className="animate-spin" /> Processing...</>
              ) : (
                <><Play size={15} /> Run Batch</>
              )}
            </button>

            {/* Progress */}
            {job && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-space-muted">Progress</span>
                  <StatusBadge status={job.status} />
                </div>
                <div className="progress-bar mb-2">
                  <motion.div
                    className="progress-fill"
                    animate={{ width: `${(job.completed / job.total) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between text-xs mono text-space-muted">
                  <span>{job.completed} / {job.total} complete</span>
                  {Object.keys(job.errors).length > 0 && (
                    <span className="text-space-eb">{Object.keys(job.errors).length} errors</span>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Results table */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {!job && !isRunning && (
              <div className="glass-card flex flex-col items-center justify-center min-h-64 text-center p-8">
                <div className="text-4xl mb-4">🔭</div>
                <h3 className="text-space-text font-medium mb-2">Ready to scan</h3>
                <p className="text-space-muted text-sm max-w-xs">
                  Enter TIC IDs on the left and click Run Batch to start processing.
                  Demo stars produce instant results.
                </p>
              </div>
            )}

            {job && sortedResults.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-space-border">
                  <h3 className="text-sm mono text-space-muted uppercase tracking-wider">
                    Results — {sortedResults.length} targets
                  </h3>
                  <button
                    onClick={exportCsv}
                    className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    id="export-csv-btn"
                  >
                    <Download size={12} /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="space-table w-full text-xs">
                    <thead>
                      <tr>
                        <SortHeader label="TIC ID" k="tic_id" />
                        <th>Classification</th>
                        <SortHeader label="Confidence" k="confidence" />
                        <SortHeader label="Period (d)" k="period" />
                        <SortHeader label="Depth (ppm)" k="depth_ppm" />
                        <SortHeader label="SNR" k="snr" />
                        <SortHeader label="Rp/Rs" k="rp_rs" />
                        <th>Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((r) => (
                        <tr key={r.tic_id}>
                          <td className="text-space-accent mono font-semibold">
                            <a href={`/analyze/${r.tic_id}`} className="hover:underline">
                              {r.tic_id}
                            </a>
                          </td>
                          <td><ClassificationBadge classification={r.classification} size="sm" /></td>
                          <td className="mono">{(r.confidence * 100).toFixed(0)}%</td>
                          <td className="mono">{r.period?.toFixed(4) ?? "—"}</td>
                          <td className="mono">{r.depth_ppm?.toFixed(0) ?? "—"}</td>
                          <td className="mono">{r.snr?.toFixed(1) ?? "—"}</td>
                          <td className="mono">{r.rp_rs?.toFixed(4) ?? "—"}</td>
                          <td>
                            <a
                              href={`/analyze/${r.tic_id}`}
                              className="text-space-accent hover:underline text-xs"
                            >
                              View →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Errors */}
                {Object.entries(job.errors).length > 0 && (
                  <div className="border-t border-space-border p-4">
                    <h4 className="text-xs mono text-space-eb uppercase tracking-wider mb-2">
                      Errors ({Object.entries(job.errors).length})
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(job.errors).map(([tic, err]) => (
                        <div key={tic} className="flex items-center gap-2 text-xs">
                          <XCircle size={11} className="text-space-eb flex-shrink-0" />
                          <span className="mono text-space-eb">TIC {tic}:</span>
                          <span className="text-space-muted">{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
