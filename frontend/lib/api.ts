/**
 * lib/api.ts
 * React Query hooks and API client for AstroDetect backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Classification =
  | "PLANET_TRANSIT"
  | "ECLIPSING_BINARY"
  | "BLEND"
  | "OTHER"
  | "NO_SIGNAL";

export interface BLSResult {
  period: number;
  duration: number;
  t0: number;
  depth: number;
  depth_err: number;
  snr: number;
  odd_even_ratio: number;
  secondary_depth: number;
  power_peak: number;
  period_grid: number[];
  power_grid: number[];
  n_transits: number;
}

export interface FitResult {
  period: number;
  period_err: number;
  t0: number;
  t0_err: number;
  depth: number;
  depth_err: number;
  duration: number;
  duration_err: number;
  rp_rs: number;
  rp_rs_err: number;
  a_rs: number;
  a_rs_err: number;
  inc: number;
  inc_err: number;
  chi2_red: number;
  fit_quality: "good" | "fair" | "poor" | "fallback";
  converged: boolean;
}

export interface AnalysisResult {
  tic_id: string;
  sector: number;
  classification: Classification;
  confidence: number;
  class_probabilities: Record<Classification, number>;
  bls: BLSResult;
  fit: FitResult;
  report_path?: string;
  report_url?: string;
  lightcurve?: {
    time: number[];
    flux: number[];
    flux_err: number[];
  };
  elapsed?: Record<string, number>;
  total_elapsed?: number;
  notes?: string;
  description?: string;
  method?: string;
}

export interface JobStatus {
  job_id: string;
  stage: string;
  progress: number;
  elapsed: Record<string, number>;
  result?: AnalysisResult;
  error?: string;
}

export interface DemoStar {
  tic_id: string;
  sector: number;
  classification: Classification;
  confidence: number;
  notes?: string;
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function startAnalysis(ticId: string, sector?: number) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tic_id: ticId, sector }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to start analysis");
  }
  return res.json() as Promise<{ job_id: string; tic_id: string; demo: boolean; status: string }>;
}

export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/status/${jobId}/poll`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Job not found");
  }
  return res.json();
}

export async function getDemoData(): Promise<{ demo_stars: DemoStar[]; tic_ids: string[] }> {
  const res = await fetch(`${API_BASE}/api/demo`);
  if (!res.ok) throw new Error("Failed to fetch demo data");
  return res.json();
}

export async function getDemoStar(ticId: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/demo/${ticId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Demo star not found");
  }
  return res.json();
}

export async function getLightCurve(ticId: string, sector?: number) {
  const url = sector
    ? `${API_BASE}/api/lightcurve/${ticId}?sector=${sector}`
    : `${API_BASE}/api/lightcurve/${ticId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Light curve not available");
  return res.json() as Promise<{ time: number[]; flux: number[]; flux_err: number[] }>;
}

export async function startBatch(ticIds: string[], sector?: number) {
  const res = await fetch(`${API_BASE}/api/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tic_ids: ticIds, sector }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to start batch");
  }
  return res.json() as Promise<{ batch_id: string; total: number; status: string }>;
}

export async function getBatchStatus(batchId: string) {
  const res = await fetch(`${API_BASE}/api/batch/${batchId}`);
  if (!res.ok) throw new Error("Batch not found");
  return res.json();
}

export function getReportUrl(ticId: string, sector: number = 1) {
  return `${API_BASE}/api/plot/${ticId}?sector=${sector}`;
}

// ── SSE progress listener ──────────────────────────────────────────────────────
export function subscribeToJob(
  jobId: string,
  onUpdate: (status: JobStatus) => void,
  onDone: (result: AnalysisResult) => void,
  onError: (err: string) => void
): () => void {
  const es = new EventSource(`${API_BASE}/api/status/${jobId}`);

  es.onmessage = (event) => {
    try {
      const data: JobStatus = JSON.parse(event.data);
      onUpdate(data);
      if (data.stage === "DONE" && data.result) {
        onDone(data.result);
        es.close();
      } else if (data.stage === "ERROR") {
        onError(data.error || "Pipeline failed");
        es.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    onError("Connection to pipeline lost");
    es.close();
  };

  return () => es.close();
}

// ── Helper utils ───────────────────────────────────────────────────────────────
export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; emoji: string; color: string; bgColor: string; borderColor: string }
> = {
  PLANET_TRANSIT: {
    label: "Planet Transit",
    emoji: "🪐",
    color: "#3fb950",
    bgColor: "rgba(63,185,80,0.12)",
    borderColor: "rgba(63,185,80,0.5)",
  },
  ECLIPSING_BINARY: {
    label: "Eclipsing Binary",
    emoji: "⭐",
    color: "#f85149",
    bgColor: "rgba(248,81,73,0.12)",
    borderColor: "rgba(248,81,73,0.5)",
  },
  BLEND: {
    label: "Blend",
    emoji: "🌫️",
    color: "#e3b341",
    bgColor: "rgba(227,179,65,0.12)",
    borderColor: "rgba(227,179,65,0.5)",
  },
  OTHER: {
    label: "Other",
    emoji: "❓",
    color: "#8b949e",
    bgColor: "rgba(139,148,158,0.12)",
    borderColor: "rgba(139,148,158,0.5)",
  },
  NO_SIGNAL: {
    label: "No Signal",
    emoji: "—",
    color: "#8b949e",
    bgColor: "rgba(139,148,158,0.08)",
    borderColor: "rgba(139,148,158,0.3)",
  },
};

export const PIPELINE_STAGES = [
  { key: "INGEST", label: "Ingest & Download", desc: "Fetching TESS data from MAST" },
  { key: "PREPROCESS", label: "Detrend & Normalize", desc: "Wotan biweight filter" },
  { key: "BLS", label: "BLS Period Search", desc: "Astropy box least-squares" },
  { key: "CLASSIFY", label: "ML Classification", desc: "XGBoost signal classifier" },
  { key: "FIT", label: "Parameter Fitting", desc: "Batman transit model + lmfit" },
];
