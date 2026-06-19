"""
pipeline.py
Main async orchestrator for the AstroDetect pipeline.
Runs: Ingest → Preprocess → BLS → Classify → Fit → Visualize
"""
import asyncio
import logging
import time as time_mod
import uuid
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── In-memory job store ───────────────────────────────────────────────────────
# job_id → { stage, progress, result, error, started_at, finished_at }
JOBS: dict[str, dict] = {}

STAGES = ["INGEST", "PREPROCESS", "BLS", "CLASSIFY", "FIT", "VISUALIZE", "DONE"]


def create_job() -> str:
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "stage": "QUEUED",
        "progress": 0,
        "result": None,
        "error": None,
        "started_at": None,
        "finished_at": None,
        "elapsed": {},  # stage → elapsed seconds
    }
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    return JOBS.get(job_id)


def _set_stage(job_id: str, stage: str, progress: int) -> None:
    if job_id in JOBS:
        JOBS[job_id]["stage"] = stage
        JOBS[job_id]["progress"] = progress
        logger.info(f"[{job_id[:8]}] → {stage} ({progress}%)")


async def run_pipeline(tic_id: str, sector: Optional[int], job_id: str) -> dict:
    """
    Full async pipeline. Updates JOBS[job_id] at each stage.
    Returns the complete result dict on success, raises on failure.
    """
    from utils.ingest import download_lightcurve
    from utils.preprocess import detrend_and_normalize, phase_fold
    from utils.detect import run_bls, check_period_aliasing
    from utils.classify import classify_signal
    from utils.fit import fit_transit_model
    from utils.visualize import plot_full_report

    JOBS[job_id]["started_at"] = time_mod.time()
    stage_times: dict[str, float] = {}

    try:
        # ── Stage 1: INGEST ───────────────────────────────────────────────
        _set_stage(job_id, "INGEST", 5)
        t0 = time_mod.time()
        lc_data = await asyncio.get_event_loop().run_in_executor(
            None, lambda: download_lightcurve(tic_id, sector)
        )
        stage_times["INGEST"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "INGEST", 20)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        time_raw = np.array(lc_data["time"])
        flux_raw = np.array(lc_data["flux"])
        flux_err_raw = np.array(lc_data["flux_err"])
        actual_sector = lc_data["sector"]

        # ── Stage 2: PREPROCESS ───────────────────────────────────────────
        _set_stage(job_id, "PREPROCESS", 25)
        t0 = time_mod.time()
        time_flat, flux_flat, flux_err_flat, trend = await asyncio.get_event_loop().run_in_executor(
            None, lambda: detrend_and_normalize(time_raw, flux_raw, flux_err_raw)
        )
        stage_times["PREPROCESS"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "PREPROCESS", 40)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        # ── Stage 3: BLS ──────────────────────────────────────────────────
        _set_stage(job_id, "BLS", 42)
        t0 = time_mod.time()
        bls_result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: run_bls(time_flat, flux_flat, flux_err_flat)
        )
        
        # Check for period aliasing
        aliasing_check = await asyncio.get_event_loop().run_in_executor(
            None, lambda: check_period_aliasing(time_flat, flux_flat, flux_err_flat, bls_result)
        )
        if aliasing_check["aliasing_detected"]:
            bls_result["period_aliasing_flag"] = True
            bls_result["true_period_estimate"] = aliasing_check["half_period"]
        else:
            bls_result["period_aliasing_flag"] = False

        stage_times["BLS"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "BLS", 60)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        # ── Stage 4: CLASSIFY ─────────────────────────────────────────────
        _set_stage(job_id, "CLASSIFY", 62)
        t0 = time_mod.time()
        classification = await asyncio.get_event_loop().run_in_executor(
            None, lambda: classify_signal(bls_result, time_flat, flux_flat)
        )
        stage_times["CLASSIFY"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "CLASSIFY", 75)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        # ── Stage 5: FIT ──────────────────────────────────────────────────
        _set_stage(job_id, "FIT", 77)
        t0 = time_mod.time()
        fit_result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: fit_transit_model(
                time_flat, flux_flat, flux_err_flat, bls_result
            )
        )
        stage_times["FIT"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "FIT", 88)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        # ── Stage 6: VISUALIZE ────────────────────────────────────────────
        _set_stage(job_id, "VISUALIZE", 90)
        t0 = time_mod.time()
        report_path = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: plot_full_report(
                tic_id=tic_id,
                sector=actual_sector,
                time_raw=time_raw,
                flux_raw=flux_raw,
                time_flat=time_flat,
                flux_flat=flux_flat,
                bls_result=bls_result,
                fit_result=fit_result,
                classification=classification,
            ),
        )
        stage_times["VISUALIZE"] = round(time_mod.time() - t0, 2)
        _set_stage(job_id, "DONE", 100)
        JOBS[job_id]["elapsed"] = dict(stage_times)

        # ── Assemble final result ─────────────────────────────────────────
        total_elapsed = round(time_mod.time() - JOBS[job_id]["started_at"], 2)
        result = {
            "tic_id": tic_id,
            "sector": actual_sector,
            "classification": classification["classification"],
            "confidence": classification["confidence"],
            "class_probabilities": classification["class_probabilities"],
            "bls": bls_result,
            "fit": fit_result,
            "report_path": report_path,
            "report_url": f"/api/plot/{tic_id}?sector={actual_sector}",
            "lightcurve": {
                "time": time_flat.tolist(),
                "flux": flux_flat.tolist(),
                "flux_err": flux_err_flat.tolist(),
            },
            "elapsed": stage_times,
            "total_elapsed": total_elapsed,
            "method": classification.get("method", "rules"),
            "description": _generate_description(classification, bls_result, fit_result),
        }

        JOBS[job_id]["result"] = result
        JOBS[job_id]["finished_at"] = time_mod.time()
        return result

    except Exception as exc:
        logger.error(f"Pipeline failed for TIC {tic_id}: {exc}", exc_info=True)
        JOBS[job_id]["stage"] = "ERROR"
        JOBS[job_id]["error"] = str(exc)
        JOBS[job_id]["finished_at"] = time_mod.time()
        raise


def _generate_description(classification: dict, bls: dict, fit: dict) -> str:
    label = classification.get("classification", "OTHER")
    conf = classification.get("confidence", 0)
    period = bls.get("period", 0)
    depth_ppm = bls.get("depth", 0) * 1e6
    snr = bls.get("snr", 0)
    odd_even = bls.get("odd_even_ratio", 0)
    chi2 = fit.get("chi2_red", 0)
    rp_rs = fit.get("rp_rs", 0)

    if label == "PLANET_TRANSIT":
        return (
            f"AstroDetect classified this signal as a PLANET TRANSIT candidate "
            f"with {conf:.0%} confidence. BLS detected a periodic signal at "
            f"P = {period:.4f} days with a transit depth of {depth_ppm:.0f} ppm "
            f"(SNR = {snr:.1f}). The odd-even depth ratio ({odd_even:.3f}) shows no "
            f"significant asymmetry, ruling out an eclipsing binary. The batman transit "
            f"model fit yields Rp/Rs = {rp_rs:.4f} with χ²_red = {chi2:.2f}."
        )
    elif label == "ECLIPSING_BINARY":
        return (
            f"AstroDetect flagged this target as an ECLIPSING BINARY with "
            f"{conf:.0%} confidence. The high transit depth ({depth_ppm:.0f} ppm) "
            f"and elevated odd-even ratio ({odd_even:.3f}) are strong indicators of "
            f"two stellar companions of similar brightness. The secondary eclipse "
            f"depth confirms the binary nature. Period = {period:.4f} days."
        )
    elif label == "BLEND":
        return (
            f"AstroDetect classified this as a BLEND scenario with {conf:.0%} confidence. "
            f"The very shallow transit depth ({depth_ppm:.0f} ppm) at SNR = {snr:.1f} "
            f"is consistent with a background eclipsing binary diluted by the target star. "
            f"Follow-up centroid analysis and high-resolution imaging are recommended to "
            f"confirm the source of contamination. Period = {period:.4f} days."
        )
    elif label == "NO_SIGNAL":
        return (
            f"No significant periodic transit signal was detected in this light curve "
            f"(BLS SNR = {snr:.1f}, below threshold of 5.0). "
            f"The star may be inactive, or any transit signal is below the noise floor "
            f"for this TESS sector."
        )
    else:
        return (
            f"AstroDetect detected a periodic signal at P = {period:.4f} days "
            f"({depth_ppm:.0f} ppm, SNR = {snr:.1f}) but could not confidently "
            f"classify it into a known category. Manual inspection is recommended."
        )
