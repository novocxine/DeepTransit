"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, ChevronRight } from "lucide-react";
import StarField from "@/components/StarField";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Ingest & Download",
    subtitle: "lightkurve · MAST Archive",
    description:
      "Downloads 2-minute cadence TESS PDCSAP flux from the MAST archive using lightkurve. Auto-selects the best available sector. Removes NaN values and 5σ outliers.",
    color: "#58a6ff",
    code: `lk.search_lightcurve("TIC 261136679",
    mission="TESS", author="SPOC",
    exptime=120).download()`,
  },
  {
    num: "02",
    title: "Detrend & Normalize",
    subtitle: "wotan · biweight filter",
    description:
      "Removes systematic trends and stellar variability using the Tukey biweight robust estimator (window = 0.75 d). Preserves transit signals by operating on timescales much longer than the transit duration.",
    color: "#79c0ff",
    code: `flatten(time, flux,
    method="biweight",
    window_length=0.75,
    break_tolerance=0.5)`,
  },
  {
    num: "03",
    title: "BLS Period Search",
    subtitle: "astropy · BoxLeastSquares",
    description:
      "Runs Box Least Squares periodogram across 5,000 trial periods (0.5–27 d). Identifies the best-fit period, transit duration, mid-transit time, and depth. Computes odd-even depth ratio and secondary eclipse depth for false positive detection.",
    color: "#3fb950",
    code: `bls = BoxLeastSquares(time, flux)
periodogram = bls.power(
    periods, durations,
    objective="snr")`,
  },
  {
    num: "04",
    title: "ML Classification",
    subtitle: "XGBoost · rule-based fallback",
    description:
      "Extracts 15 diagnostic features from the BLS result (depth, SNR, odd-even ratio, secondary depth, duty cycle, etc.) and classifies the signal into one of 5 categories using an XGBoost classifier. Falls back to astrophysically-motivated rules when the model is unavailable.",
    color: "#e3b341",
    code: `features = extract_features(bls_result)
probs = xgb_model.predict_proba(features)
# PLANET_TRANSIT | ECLIPSING_BINARY
# BLEND | OTHER | NO_SIGNAL`,
  },
  {
    num: "05",
    title: "Batman Transit Fit",
    subtitle: "batman · lmfit",
    description:
      "Fits an analytical Mandel-Agol transit model with quadratic limb darkening to the phase-folded light curve using Levenberg-Marquardt least-squares. Extracts Rp/Rs, a/Rs, inclination, period, and transit duration with formal 1σ uncertainties from the covariance matrix.",
    color: "#f85149",
    code: `params = batman.TransitParams()
params.limb_dark = "quadratic"
m = batman.TransitModel(params, time)
result = lmfit.minimize(residuals, p0)`,
  },
];

const TECH_STACK = [
  { category: "Frontend", items: ["Next.js 14 (App Router)", "TypeScript", "Tailwind CSS", "Framer Motion", "Plotly.js", "React Query"] },
  { category: "Backend", items: ["FastAPI", "uvicorn", "Python 3.11+", "SSE streaming", "asyncio"] },
  { category: "ML / Science", items: ["lightkurve", "astropy BLS", "wotan biweight", "batman-package", "lmfit", "XGBoost", "scikit-learn"] },
  { category: "Data", items: ["TESS MAST archive", "SPOC 2-min cadence", "PDCSAP flux", "lightkurve cache"] },
];

const PAPERS = [
  {
    title: "ExoMiner++: Enhanced Transit Classification for 2-Minute TESS Data",
    authors: "Valizadegan et al., 2025",
    url: "https://arxiv.org/abs/2502.09790",
    note: "NASA's production transit classifier — inspiration for diagnostic flags",
  },
  {
    title: "ExoNet: Calibrated Multimodal Deep Learning for TESS Vetting",
    authors: "Islam, 2026",
    url: "https://arxiv.org/pdf/2604.15560",
    note: "State-of-the-art multimodal fusion with stellar parameters",
  },
  {
    title: "Deep Learning Exoplanet Detection by Combining Real and Synthetic Data",
    authors: "Cuéllar et al., 2022 (PLOS ONE)",
    url: "https://doi.org/10.1371/journal.pone.0268199",
    note: "Justification for synthetic training data strategy",
  },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen">
      <StarField />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-space-accent/30 bg-space-accent/8 text-space-accent text-xs font-medium mono mb-4">
            BAH 2026 · Challenge 7 · ISRO
          </div>
          <h1 className="text-4xl font-extrabold text-space-text mb-3">
            Pipeline <span className="text-space-accent">Documentation</span>
          </h1>
          <p className="text-space-muted max-w-xl mx-auto">
            AstroDetect is an end-to-end AI pipeline for detecting and classifying exoplanet transit signals in TESS photometric data.
          </p>
        </motion.div>

        {/* Pipeline flowchart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-space-text mb-6 flex items-center gap-2">
            <span className="text-space-accent mono">{">"}</span> 5-Stage Pipeline
          </h2>

          <div className="space-y-3">
            {PIPELINE_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="glass-card overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Step number */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mono"
                      style={{ background: step.color + "20", color: step.color, border: `1px solid ${step.color}40` }}
                    >
                      {step.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-space-text">{step.title}</h3>
                        <span
                          className="text-xs mono px-2 py-0.5 rounded-full"
                          style={{ color: step.color, background: step.color + "18", border: `1px solid ${step.color}40` }}
                        >
                          {step.subtitle}
                        </span>
                      </div>
                      <p className="text-sm text-space-muted leading-relaxed mb-3">
                        {step.description}
                      </p>
                      {/* Code snippet */}
                      <div className="bg-space-black rounded-lg p-3 border border-space-border">
                        <pre className="text-xs mono text-space-accent overflow-x-auto">{step.code}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector arrow */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="flex justify-center py-0 -mt-1 -mb-1 z-10 relative">
                    <div className="w-px h-3 bg-space-border" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tech stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-space-text mb-6 flex items-center gap-2">
            <span className="text-space-accent mono">{">"}</span> Tech Stack
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TECH_STACK.map((cat) => (
              <div key={cat.category} className="glass-card p-5">
                <h3 className="text-xs mono text-space-muted uppercase tracking-widest mb-3">{cat.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item) => (
                    <span
                      key={item}
                      className="text-xs mono px-2.5 py-1 rounded-md border border-space-border text-space-text bg-space-card"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Classification labels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-space-text mb-6 flex items-center gap-2">
            <span className="text-space-accent mono">{">"}</span> Classification Labels
          </h2>
          <div className="glass-card overflow-hidden">
            <table className="space-table w-full">
              <thead>
                <tr><th>Label</th><th>Description</th><th>Key Indicators</th></tr>
              </thead>
              <tbody>
                {[
                  { label: "🪐 PLANET_TRANSIT", color: "#3fb950", desc: "Genuine exoplanet transit candidate", indicators: "Low odd-even ratio, shallow depth (100–30k ppm), flat bottom, no secondary eclipse" },
                  { label: "⭐ ECLIPSING_BINARY", color: "#f85149", desc: "Two stellar companions eclipsing", indicators: "Deep primary (>1%), high odd-even ratio, prominent secondary eclipse at phase 0.5" },
                  { label: "🌫️ BLEND", color: "#e3b341", desc: "Background eclipsing binary diluted by target", indicators: "Very shallow depth (<500 ppm), marginal SNR, centroid shift" },
                  { label: "❓ OTHER", color: "#8b949e", desc: "Unclassified periodic signal", indicators: "Doesn't fit clean planet/EB/blend profile — manual review recommended" },
                  { label: "— NO_SIGNAL", color: "#8b949e", desc: "No significant transit detected", indicators: "BLS SNR < 5.0 — noise dominated light curve" },
                ].map((r) => (
                  <tr key={r.label}>
                    <td className="font-semibold mono text-sm" style={{ color: r.color }}>{r.label}</td>
                    <td className="text-space-text">{r.desc}</td>
                    <td className="text-space-muted text-xs">{r.indicators}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Research papers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-space-text mb-6 flex items-center gap-2">
            <span className="text-space-accent mono">{">"}</span> Key References
          </h2>
          <div className="space-y-3">
            {PAPERS.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-4 flex items-start gap-4 group block"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-space-text group-hover:text-space-accent transition-colors flex items-center gap-1">
                    {p.title} <ExternalLink size={12} className="flex-shrink-0" />
                  </div>
                  <div className="text-xs text-space-muted mono mt-0.5">{p.authors}</div>
                  <div className="text-xs text-space-muted mt-1.5 italic">{p.note}</div>
                </div>
                <ChevronRight size={14} className="text-space-muted group-hover:text-space-accent transition-colors flex-shrink-0 mt-1" />
              </a>
            ))}
          </div>
        </motion.div>

        {/* External links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6 text-center"
        >
          <h3 className="text-sm mono text-space-muted uppercase tracking-widest mb-4">Data Sources</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "TESS MAST Archive", url: "https://archive.stsci.edu/tess/" },
              { label: "ExoFOP-TESS", url: "https://exofop.ipac.caltech.edu/tess/" },
              { label: "NASA Exoplanet Archive", url: "https://exoplanetarchive.ipac.caltech.edu/" },
              { label: "lightkurve docs", url: "https://docs.lightkurve.org/" },
              { label: "batman docs", url: "https://lweb.cfa.harvard.edu/~lkreidberg/batman/" },
            ].map(({ label, url }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg"
              >
                {label} <ExternalLink size={12} />
              </a>
            ))}
          </div>
          <div className="space-divider mt-6" />
          <p className="text-xs text-space-muted">
            AstroDetect · Built for BAH 2026 · ISRO Challenge 7 · Exoplanet Transit Detection
          </p>
        </motion.div>
      </div>
    </div>
  );
}
