"""
main.py
FastAPI server for AstroDetect — all API endpoints.
"""
import asyncio
import json
import logging
import os
import time
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import pipeline as pl
from demo_data import get_demo_result, get_all_demo_results, DEMO_RESULTS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AstroDetect API",
    description="AI-powered exoplanet transit detection from TESS light curves — BAH 2026",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve report PNGs statically
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)


# ── Request / Response models ─────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    tic_id: str = Field(..., description="TESS Input Catalog ID (numeric string)")
    sector: Optional[int] = Field(None, description="TESS sector number (omit for auto-detect)")


class BatchRequest(BaseModel):
    tic_ids: list[str] = Field(..., description="List of TIC IDs to process")
    sector: Optional[int] = Field(None, description="Common sector for all targets")


# ── In-memory batch store ─────────────────────────────────────────────────────
BATCH_JOBS: dict[str, dict] = {}


# ── Utility ───────────────────────────────────────────────────────────────────
def _tic_clean(tic_id: str) -> str:
    """Remove 'TIC ' prefix and whitespace."""
    return tic_id.strip().upper().replace("TIC", "").replace(" ", "")


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "name": "AstroDetect API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": ["/api/demo", "/api/analyze", "/api/status/{job_id}", "/api/report/{tic_id}", "/api/batch", "/api/batch/{job_id}"],
    }


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok", "timestamp": time.time()}


# ── Demo ──────────────────────────────────────────────────────────────────────
@app.get("/api/demo", tags=["Demo"])
async def get_demo():
    """Return pre-computed results for the 3 demo stars."""
    return {
        "demo_stars": get_all_demo_results(),
        "tic_ids": list(DEMO_RESULTS.keys()),
    }


@app.get("/api/demo/{tic_id}", tags=["Demo"])
async def get_demo_star(tic_id: str):
    """Return full pre-computed result for a single demo star."""
    clean = _tic_clean(tic_id)
    result = get_demo_result(clean)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"TIC {clean} is not a demo star. Demo IDs: 261136679, 219114641, 38846515",
        )
    return result


# ── Analyze ───────────────────────────────────────────────────────────────────
@app.post("/api/analyze", tags=["Pipeline"])
async def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Start the full ML pipeline for a TESS target.
    Returns job_id immediately; poll /api/status/{job_id} for progress.
    """
    clean_id = _tic_clean(req.tic_id)

    # Demo mode shortcut — return instantly
    demo = get_demo_result(clean_id)
    if demo is not None:
        job_id = pl.create_job()
        pl.JOBS[job_id]["stage"] = "DONE"
        pl.JOBS[job_id]["progress"] = 100
        pl.JOBS[job_id]["result"] = demo
        pl.JOBS[job_id]["started_at"] = time.time()
        pl.JOBS[job_id]["finished_at"] = time.time()
        return {"job_id": job_id, "tic_id": clean_id, "demo": True, "status": "DONE"}

    # Create job and launch in background
    job_id = pl.create_job()
    background_tasks.add_task(_run_pipeline_bg, clean_id, req.sector, job_id)

    return {
        "job_id": job_id,
        "tic_id": clean_id,
        "demo": False,
        "status": "QUEUED",
    }


async def _run_pipeline_bg(tic_id: str, sector: Optional[int], job_id: str):
    try:
        await pl.run_pipeline(tic_id, sector, job_id)
    except Exception as exc:
        logger.error(f"Background pipeline failed: {exc}")


# ── Status (SSE) ──────────────────────────────────────────────────────────────
@app.get("/api/status/{job_id}", tags=["Pipeline"])
async def stream_status(job_id: str):
    """
    Server-Sent Events stream of pipeline progress.
    Emits stage + progress updates until DONE or ERROR.
    """
    if job_id not in pl.JOBS:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    async def event_generator():
        last_stage = None
        max_polls = 600  # 10 minutes max
        for _ in range(max_polls):
            job = pl.JOBS.get(job_id)
            if job is None:
                break

            stage = job["stage"]
            progress = job["progress"]
            payload = {
                "job_id": job_id,
                "stage": stage,
                "progress": progress,
                "elapsed": job.get("elapsed", {}),
            }

            if stage != last_stage or stage in ("DONE", "ERROR"):
                if stage == "DONE":
                    payload["result"] = job.get("result")
                elif stage == "ERROR":
                    payload["error"] = job.get("error")

                yield f"data: {json.dumps(payload)}\n\n"
                last_stage = stage

            if stage in ("DONE", "ERROR"):
                break

            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/status/{job_id}/poll", tags=["Pipeline"])
async def poll_status(job_id: str):
    """
    Non-streaming status endpoint for simple polling.
    Returns current job state as JSON.
    """
    job = pl.JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    resp = {
        "job_id": job_id,
        "stage": job["stage"],
        "progress": job["progress"],
        "elapsed": job.get("elapsed", {}),
    }
    if job["stage"] == "DONE":
        resp["result"] = job.get("result")
    elif job["stage"] == "ERROR":
        resp["error"] = job.get("error")

    return resp


# ── Light curve data (Plotly) ─────────────────────────────────────────────────
@app.get("/api/lightcurve/{tic_id}", tags=["Data"])
async def get_lightcurve(tic_id: str, sector: Optional[int] = Query(None)):
    """Return time/flux arrays for Plotly charts."""
    clean = _tic_clean(tic_id)
    demo = get_demo_result(clean)
    if demo and "lightcurve" in demo:
        return demo["lightcurve"]

    # Check if a completed job has data
    for job in pl.JOBS.values():
        if (
            job.get("stage") == "DONE"
            and job.get("result", {}).get("tic_id") == clean
        ):
            lc = job["result"].get("lightcurve")
            if lc:
                return lc

    raise HTTPException(
        status_code=404,
        detail=f"Light curve data for TIC {clean} not found. Run /api/analyze first.",
    )


# ── Report image ──────────────────────────────────────────────────────────────
@app.get("/api/plot/{tic_id}", tags=["Data"])
async def get_plot(tic_id: str, sector: int = Query(1)):
    """Serve the matplotlib report PNG."""
    clean = _tic_clean(tic_id)
    report_path = os.path.join(OUTPUTS_DIR, f"TIC{clean}_s{sector}.png")
    if not os.path.exists(report_path):
        raise HTTPException(
            status_code=404,
            detail=f"Report not found for TIC {clean} sector {sector}. Run /api/analyze first.",
        )
    return FileResponse(report_path, media_type="image/png")


# ── Batch ─────────────────────────────────────────────────────────────────────
@app.post("/api/batch", tags=["Batch"])
async def batch_analyze(req: BatchRequest, background_tasks: BackgroundTasks):
    """Queue batch processing for multiple TIC IDs."""
    import uuid

    if len(req.tic_ids) > 50:
        raise HTTPException(status_code=400, detail="Batch size limited to 50 TIC IDs")

    batch_id = str(uuid.uuid4())
    clean_ids = [_tic_clean(t) for t in req.tic_ids]

    BATCH_JOBS[batch_id] = {
        "batch_id": batch_id,
        "tic_ids": clean_ids,
        "sector": req.sector,
        "total": len(clean_ids),
        "completed": 0,
        "results": {},
        "errors": {},
        "status": "RUNNING",
        "started_at": time.time(),
    }

    background_tasks.add_task(_run_batch_bg, batch_id, clean_ids, req.sector)

    return {
        "batch_id": batch_id,
        "total": len(clean_ids),
        "status": "RUNNING",
    }


async def _run_batch_bg(batch_id: str, tic_ids: list[str], sector: Optional[int]):
    """Process TIC IDs sequentially in background."""
    for tic_id in tic_ids:
        if batch_id not in BATCH_JOBS:
            break
        try:
            # Check demo data first
            demo = get_demo_result(tic_id)
            if demo:
                BATCH_JOBS[batch_id]["results"][tic_id] = _summarize_result(demo)
            else:
                job_id = pl.create_job()
                await pl.run_pipeline(tic_id, sector, job_id)
                job = pl.JOBS[job_id]
                if job["result"]:
                    BATCH_JOBS[batch_id]["results"][tic_id] = _summarize_result(job["result"])
                else:
                    BATCH_JOBS[batch_id]["errors"][tic_id] = job.get("error", "Unknown error")
        except Exception as e:
            BATCH_JOBS[batch_id]["errors"][tic_id] = str(e)

        BATCH_JOBS[batch_id]["completed"] += 1

    BATCH_JOBS[batch_id]["status"] = "DONE"
    BATCH_JOBS[batch_id]["finished_at"] = time.time()


def _summarize_result(result: dict) -> dict:
    bls = result.get("bls", {})
    fit = result.get("fit", {})
    return {
        "tic_id": result.get("tic_id"),
        "sector": result.get("sector"),
        "classification": result.get("classification"),
        "confidence": result.get("confidence"),
        "period": bls.get("period"),
        "depth_ppm": round(bls.get("depth", 0) * 1e6, 1),
        "duration_hr": round(bls.get("duration", 0) * 24, 3),
        "snr": bls.get("snr"),
        "rp_rs": fit.get("rp_rs"),
        "chi2_red": fit.get("chi2_red"),
    }


@app.get("/api/batch/{batch_id}", tags=["Batch"])
async def get_batch_status(batch_id: str):
    """Get batch job progress and partial results."""
    job = BATCH_JOBS.get(batch_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Batch job {batch_id} not found")
    return job


# ──────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
