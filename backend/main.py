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
    sources: Optional[list[str]] = Field(None, description="Target sources to pull from")
    targets_per_source: Optional[int] = Field(50, description="Max targets per source")


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

# ── Orbit ─────────────────────────────────────────────────────────────────────
from utils.orbit import (
    get_current_orbital_phase,
    orbital_phase_to_xyz,
    generate_orbit_path,
    get_next_transit,
    get_stellar_distance_pc,
    compute_planet_earth_distance,
    compute_star_planet_separation,
    get_star_coordinates_from_earth,
    get_planet_coordinates_from_earth,
    EARTH_COORDINATES,
)
from utils.habitability import (
    estimate_stellar_luminosity,
    estimate_equilibrium_temperature,
    compute_habitable_zone,
    classify_hz_position,
    compare_to_solar_system,
    classify_planet_type,
    find_nearest_known_exoplanets,
)

DISTANCE_CACHE = {}

@app.get("/api/orbit/{tic_id}", tags=["Data"])
async def get_orbit(tic_id: str):
    """Return current orbital position and path for 2D/3D visualization."""
    clean = _tic_clean(tic_id)
    # Find matching job
    target_job = None
    for job in pl.JOBS.values():
        if (
            job.get("stage") == "DONE"
            and job.get("result", {}).get("tic_id") == clean
        ):
            target_job = job
            break
    
    if not target_job:
        raise HTTPException(status_code=404, detail="No completed analysis found for this TIC ID.")
        
    result = target_job["result"]
    if result.get("classification") != "PLANET_TRANSIT":
        raise HTTPException(status_code=400, detail="Orbit view only available for confirmed transit detections.")
        
    fit = result.get("fit", {})
    period = fit.get("period") or result.get("bls", {}).get("period", 1.0)
    t0 = fit.get("t0") or result.get("bls", {}).get("t0", 0.0)
    a_rs = fit.get("a_rs", 10.0)
    rp_rs = fit.get("rp_rs", 0.1)
    b = fit.get("b", 0.0)
    
    phase = get_current_orbital_phase(t0, period)
    current_pos = orbital_phase_to_xyz(phase, a_rs, b)
    path = generate_orbit_path(a_rs, b, 200)
    next_t, next_h = get_next_transit(t0, period)

    # Resolve distances
    if clean not in DISTANCE_CACHE:
        # Run in executor to avoid blocking the async event loop during astroquery network call
        dist_data = await asyncio.get_event_loop().run_in_executor(
            None, lambda: get_stellar_distance_pc(clean)
        )
        DISTANCE_CACHE[clean] = dist_data
    else:
        dist_data = DISTANCE_CACHE[clean]

    distances = {
        "data_available": False,
        "stellar_radius_rsun": 1.0,
        "stellar_radius_source": "Assumed 1.0 R☉",
    }
    
    if dist_data:
        rad = dist_data.get("stellar_radius_rsun") or 1.0
        source = dist_data.get("source")
        
        star_planet = compute_star_planet_separation(a_rs, rad)
        earth_planet = compute_planet_earth_distance(dist_data["distance_pc"], a_rs, rad)
        
        distances.update({
            "data_available": True,
            "stellar_radius_rsun": rad,
            "stellar_radius_source": source if dist_data.get("stellar_radius_rsun") else "Assumed 1.0 R☉ (TIC missing)",
            "star_planet_separation": {
                "separation_au": star_planet["separation_au"],
                "separation_km": star_planet["separation_km"],
                "assumption_flag": star_planet["assumption_flag"]
            },
            "earth_distances": {
                "earth_to_star_ly": dist_data["distance_ly"],
                "earth_to_star_pc": dist_data["distance_pc"],
                "earth_to_star_err_ly": dist_data["distance_ly_err"],
                "earth_to_planet_ly": dist_data["distance_ly"],
                "source": dist_data["source"]
            }
        })
    else:
        # Fallback if no data available, compute separation using default 1.0 R_sun
        star_planet = compute_star_planet_separation(a_rs, 1.0)
        distances["star_planet_separation"] = {
            "separation_au": star_planet["separation_au"],
            "separation_km": star_planet["separation_km"],
            "assumption_flag": True
        }
    
    # Compute Habitability and Comparisons
    teff_k = 5778
    teff_assumed = True
    
    if dist_data and dist_data.get("stellar_teff_k"):
        teff_k = dist_data["stellar_teff_k"]
        teff_assumed = False
        
    rad_rsun = distances["stellar_radius_rsun"]
    sep_au = distances["star_planet_separation"]["separation_au"]
    
    lum_lsun = estimate_stellar_luminosity(teff_k, rad_rsun)
    eq_temp = estimate_equilibrium_temperature(teff_k, rad_rsun, sep_au)
    hz = compute_habitable_zone(teff_k, lum_lsun)
    hz_pos = classify_hz_position(sep_au, hz)
    
    habitability = {
        "stellar_teff_k": teff_k,
        "teff_assumed": teff_assumed,
        "stellar_luminosity_lsun": lum_lsun,
        "equilibrium_temp_k": eq_temp["equilibrium_temp_k"],
        "equilibrium_temp_c": eq_temp["equilibrium_temp_c"],
        "albedo_assumed": eq_temp["albedo_assumed"],
        "habitable_zone": {
            "inner_edge_au": hz["inner_edge_au"],
            "outer_edge_au": hz["outer_edge_au"],
        },
        "hz_position": hz_pos,
        "separation_au": sep_au,
    }
    
    comp_ss = compare_to_solar_system(period, sep_au, rp_rs, rad_rsun)
    classification = classify_planet_type(comp_ss["planet_radius_rearth"], period, eq_temp["equilibrium_temp_k"])
    nearest_neighbors = find_nearest_known_exoplanets(comp_ss["planet_radius_rearth"], period)
    
    comparison = {
        "planet_radius_rearth": comp_ss["planet_radius_rearth"],
        "orbital_distance_au": comp_ss["orbital_distance_au"],
        "orbital_distance_vs_earth_pct": comp_ss["orbital_distance_vs_earth_pct"],
        "period_vs_earth_pct": comp_ss["period_vs_earth_pct"],
        "closest_solar_system_analog": comp_ss["closest_solar_system_analog_by_distance"],
        "classification": {
            "size_class": classification["size_class"],
            "temperature_class": classification["temperature_class"],
            "informal_label": classification["informal_label"],
        },
        "nearest_known_exoplanets": nearest_neighbors
    }

    # Compute Earth-Relative 3D Cartesian Coordinates
    earth_relative_coordinates = {"data_available": False}

    if dist_data:
        ra = dist_data.get("ra_deg")
        dec = dist_data.get("dec_deg")
        dist_pc = dist_data.get("distance_pc")

        if ra is not None and dec is not None and dist_pc is not None:
            star_coords = get_star_coordinates_from_earth(ra, dec, dist_pc)
            planet_coords = get_planet_coordinates_from_earth(
                star_coords, current_pos, distances["stellar_radius_rsun"]
            )
            earth_relative_coordinates = {
                "data_available": True,
                "earth": EARTH_COORDINATES,
                "star": star_coords,
                "planet": planet_coords,
                "frame": "Earth-centered equatorial Cartesian (ICRS)",
                "units": "parsecs (pc) and light-years (ly)",
                "caveats": [
                    "Present-epoch position from catalog data — not corrected for stellar proper motion or the Sun's motion through the galaxy.",
                    "The local orbital frame's sky orientation cannot be determined from transit photometry. The vector addition is valid because the orbital offset is negligible at interstellar scales (see planet.orbital_offset_fraction_of_total_distance).",
                    "'Galactic Frame' in the UI uses equatorial (ICRS) Cartesian axes, not galactic (l, b) coordinates — this is the simpler and more accurate choice for this purpose.",
                ],
            }

    return {
        "current_position": current_pos,
        "orbit_path": path,
        "star_radius_rs": 1.0,
        "planet_radius_rs": float(rp_rs),
        "a_rs": float(a_rs),
        "period_days": float(period),
        "next_transit_btjd": next_t,
        "next_transit_in_hours": next_h,
        "distances": distances,
        "habitability": habitability,
        "comparison": comparison,
        "earth_relative_coordinates": earth_relative_coordinates,
        "assumptions": [
            "Orbit assumed circular (e=0) per transit-fit convention",
            "Star treated as a sphere of radius 1 R★ unless TIC catalog provides measured radius",
            "Earth distance sourced from Gaia-derived TIC catalog parallax, not from transit fit",
            "Planet-to-Earth distance treated as equal to star-to-Earth distance (orbital separation is negligible at parsec scale)"
        ]
    }


# ── Vetting ───────────────────────────────────────────────────────────────────
from utils.vetting import run_vetting_suite

VETTING_CACHE: dict[str, dict] = {}

@app.get("/api/vetting/{tic_id}", tags=["Data"])
async def get_vetting(tic_id: str):
    """
    Run the formal vetting diagnostic battery for a detected signal.
    Returns per-test results and an overall categorical verdict.

    This endpoint answers 'how trustworthy is this detection?' —
    a different question from the classifier confidence ('what type of signal is this?').
    """
    clean = _tic_clean(tic_id)

    if clean in VETTING_CACHE:
        return VETTING_CACHE[clean]

    # Find matching completed job
    target_result = None
    for job in pl.JOBS.values():
        if job.get("stage") == "DONE" and job.get("result", {}).get("tic_id") == clean:
            target_result = job["result"]
            break

    if target_result is None:
        from demo_data import get_demo_result
        target_result = get_demo_result(clean)

    if target_result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No completed analysis found for TIC {clean}. Run /api/analyze first.",
        )

    bls = target_result.get("bls")
    fit = target_result.get("fit")

    if bls is None:
        raise HTTPException(
            status_code=422,
            detail="BLS result not available — vetting requires a completed BLS run.",
        )

    # Get raw light curve data if available (needed for shape test)
    time_arr = None
    flux_arr = None
    flux_err_arr = None
    lc = target_result.get("lightcurve")
    if lc:
        import numpy as np
        time_arr = np.array(lc["time"])
        flux_arr = np.array(lc["flux"])
        flux_err_arr = np.array(lc.get("flux_err", np.ones_like(flux_arr) * 1e-4))

    report = run_vetting_suite(
        time=time_arr,
        flux=flux_arr,
        flux_err=flux_err_arr,
        bls_result=bls,
        fit_result=fit,
    )

    # Attach classifier context so frontend can show both side-by-side
    report["classifier_context"] = {
        "classification": target_result.get("classification"),
        "confidence": target_result.get("confidence"),
        "note": (
            "Classifier confidence answers 'what type of signal is this?' — "
            "the vetting verdict answers 'how trustworthy is this specific detection?' "
            "They are complementary, not redundant."
        ),
    }

    VETTING_CACHE[clean] = report
    return report


# ── Batch ─────────────────────────────────────────────────────────────────────

@app.post("/api/batch", tags=["Batch"])
async def batch_analyze(req: BatchRequest, background_tasks: BackgroundTasks):
    """Queue batch processing for multiple TIC IDs."""
    import uuid
    from utils.target_selection import get_combined_targets

    manual_clean_ids = [_tic_clean(t) for t in req.tic_ids]
    sources = req.sources or []
    
    # Use the unified target selection to fetch and combine targets
    target_records = get_combined_targets(
        include_sources=sources,
        n_per_source=req.targets_per_source or 50,
        manual_tic_ids=manual_clean_ids
    )
    clean_ids = [r.tic_id for r in target_records]

    if len(clean_ids) > 150:
        raise HTTPException(status_code=400, detail="Batch size limited to 150 TIC IDs across all sources")

    batch_id = str(uuid.uuid4())

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
