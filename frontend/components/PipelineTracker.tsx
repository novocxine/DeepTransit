"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Loader2, XCircle, AlertCircle } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/api";

interface Props {
  currentStage: string;
  progress: number;
  elapsed?: Record<string, number>;
  error?: string;
}

const STAGE_ORDER = ["INGEST", "PREPROCESS", "BLS", "CLASSIFY", "FIT", "DONE"];

function getStageStatus(stageKey: string, currentStage: string, hasError: boolean) {
  if (hasError && currentStage === stageKey) return "error";
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const stageIdx = STAGE_ORDER.indexOf(stageKey);
  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

export default function PipelineTracker({ currentStage, progress, elapsed = {}, error }: Props) {
  const hasError = currentStage === "ERROR";
  const isDone = currentStage === "DONE";

  return (
    <div className="space-y-1">
      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-space-muted mono uppercase tracking-wider">Pipeline</span>
          <span className="text-xs mono text-space-accent">{progress}%</span>
        </div>
        <div className="progress-bar">
          <motion.div
            className={`progress-fill ${isDone ? "progress-fill-planet" : ""}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-0.5">
        {PIPELINE_STAGES.map((stage) => {
          const status = hasError && STAGE_ORDER.indexOf(stage.key) >= STAGE_ORDER.indexOf(currentStage)
            ? getStageStatus(stage.key, currentStage, hasError)
            : getStageStatus(stage.key, currentStage, false);

          const elapsedTime = elapsed[stage.key];

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                status === "active"
                  ? "bg-space-accent/10 border border-space-accent/20"
                  : "border border-transparent"
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5">
                {status === "done" && (
                  <CheckCircle2 size={18} className="text-space-planet" />
                )}
                {status === "active" && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={18} className="text-space-accent" />
                  </motion.div>
                )}
                {status === "pending" && (
                  <Circle size={18} className="text-space-border" />
                )}
                {status === "error" && (
                  <XCircle size={18} className="text-space-eb" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-medium truncate ${
                    status === "done"
                      ? "text-space-text"
                      : status === "active"
                      ? "text-space-accent"
                      : status === "error"
                      ? "text-space-eb"
                      : "text-space-muted"
                  }`}
                >
                  {stage.label}
                </div>
                {status === "active" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-space-muted truncate mt-0.5"
                  >
                    {stage.desc}
                  </motion.div>
                )}
              </div>

              {/* Elapsed time */}
              {elapsedTime !== undefined && (
                <span className="flex-shrink-0 text-xs mono text-space-muted">
                  {elapsedTime.toFixed(1)}s
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {hasError && error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-3 rounded-lg bg-space-eb/10 border border-space-eb/30 flex items-start gap-2"
          >
            <AlertCircle size={14} className="text-space-eb mt-0.5 flex-shrink-0" />
            <p className="text-xs text-space-eb">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Done state */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 p-3 rounded-lg bg-space-planet/10 border border-space-planet/30 flex items-center gap-2"
          >
            <CheckCircle2 size={14} className="text-space-planet flex-shrink-0" />
            <p className="text-xs text-space-planet font-medium">Analysis complete</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
