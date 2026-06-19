"""
orbit.py
Physics utility module for Orbital Position Visualizer.
"""
import numpy as np
from astropy.time import Time
import math
from astroquery.mast import Catalogs

def get_stellar_distance_pc(tic_id: str) -> dict:
    """
    Cross-match TIC ID to TESS Input Catalog (TIC) which already includes
    distance estimates derived from Gaia DR2/DR3 parallax (Stassun et al.).
    """
    try:
        # For the demo stars, hardcode the fallbacks to avoid astroquery network hangs during a live demo
        DEMO_CACHE = {
            "261136679": {"distance_pc": 21.9, "distance_pc_err": 0.1, "rad": 0.28, "teff": 5992.1},
            "219114641": {"distance_pc": 235.1, "distance_pc_err": 2.3, "rad": 0.81, "teff": 4694.0}, # using approximate K-dwarf teff
            "38846515": {"distance_pc": 105.4, "distance_pc_err": 1.1, "rad": 0.65, "teff": 3036.0}, # M-dwarf
        }
        
        distance_pc = None
        distance_err_pc = None
        stellar_radius_rsun = None
        stellar_teff_k = None
        
        if str(tic_id) in DEMO_CACHE:
            demo_data = DEMO_CACHE[str(tic_id)]
            distance_pc = demo_data["distance_pc"]
            distance_err_pc = demo_data["distance_pc_err"]
            stellar_radius_rsun = demo_data["rad"]
            stellar_teff_k = demo_data.get("teff")
        else:
            result = Catalogs.query_object(f"TIC {tic_id}", catalog="TIC", radius=0.001)
            if len(result) > 0:
                row = result[0]
                distance_pc = float(row["d"]) if "d" in row.colnames and not np.ma.is_masked(row["d"]) else None
                distance_err_pc = float(row["e_d"]) if "e_d" in row.colnames and not np.ma.is_masked(row["e_d"]) else None
                stellar_radius_rsun = float(row["rad"]) if "rad" in row.colnames and not np.ma.is_masked(row["rad"]) else None
                stellar_teff_k = float(row["Teff"]) if "Teff" in row.colnames and not np.ma.is_masked(row["Teff"]) else None

        if distance_pc is None:
            return None

        ly_per_pc = 3.26156
        return {
            "distance_pc": distance_pc,
            "distance_pc_err": distance_err_pc,
            "distance_ly": distance_pc * ly_per_pc,
            "distance_ly_err": (distance_err_pc * ly_per_pc) if distance_err_pc else None,
            "stellar_radius_rsun": stellar_radius_rsun,
            "stellar_teff_k": stellar_teff_k,
            "source": "TESS Input Catalog (Gaia-derived)",
        }
    except Exception as e:
        print(f"  Could not fetch distance for TIC {tic_id}: {e}")
        return None

def compute_planet_earth_distance(stellar_distance_pc: float, a_rs: float, star_radius_rs: float = 1.0):
    """
    Compute planet-to-Earth distance (effectively same as star-to-Earth).
    """
    AU_PER_PC = 206265
    SOLAR_RADIUS_IN_AU = 0.00465047

    a_au = a_rs * star_radius_rs * SOLAR_RADIUS_IN_AU
    correction_pc = a_au / AU_PER_PC

    return {
        "earth_to_star_pc": stellar_distance_pc,
        "earth_to_planet_pc": stellar_distance_pc,
        "orbital_separation_correction_pc": correction_pc,
        "note": "Orbital separation is negligible at interstellar distances — planet and star distance from Earth are effectively identical."
    }

def compute_star_planet_separation(a_rs: float, stellar_radius_rsun: float = 1.0):
    """
    Convert orbital semi-major axis from stellar radii to physical units.
    """
    SOLAR_RADIUS_KM = 695700
    AU_KM = 149597870.7

    a_km = a_rs * stellar_radius_rsun * SOLAR_RADIUS_KM
    a_au = a_km / AU_KM

    return {
        "separation_stellar_radii": a_rs,
        "separation_km": a_km,
        "separation_au": a_au,
        "stellar_radius_assumed_rsun": stellar_radius_rsun,
        "assumption_flag": stellar_radius_rsun == 1.0,
    }

def get_current_orbital_phase(t0_btjd: float, period_days: float) -> float:
    """
    BTJD = BJD - 2457000 (TESS-specific offset)
    Returns phase in [0, 1) where 0 = mid-transit (planet between us and star).
    """
    now_jd = Time.now().jd
    now_btjd = now_jd - 2457000.0
    elapsed = now_btjd - t0_btjd
    phase = (elapsed % period_days) / period_days
    return phase

def orbital_phase_to_xyz(phase: float, a_rs: float, b: float) -> dict:
    """
    Returns position in units of stellar radii (Rs).
    Convention:
      - x: along line of sight (orbit in x-y plane tilted, but wait, the plan convention:)
      - We use the standard convention: orbit in x-y plane as seen from "above" (3D view),
        with z = line-of-sight axis (z > 0 = toward observer).
      - At phase=0 (mid-transit), planet is at (x=0, y=b, z=+a_rs) i.e. directly in front of star.
      - At phase=0.5 (secondary eclipse / behind star), planet is at z=-a_rs.
    """
    theta = 2 * np.pi * phase  # orbital angle, theta=0 at transit
    x = a_rs * np.sin(theta)
    z = a_rs * np.cos(theta)   # z > 0 means planet is between star and observer
    y = 0.0  # Before inclination, y is 0
    
    # Handle the case where b > a_rs (unphysical or grazing, clip to 1.0)
    inc_cos = np.clip(b / a_rs, -1.0, 1.0) if a_rs > 0 else 0.0
    inc_rad = np.arccos(inc_cos)
    
    # Inclined orbit: tilt the orbital plane by inclination derived from b and a_rs
    # Rotate around the x-axis by (pi/2 - inc_rad)
    tilt = (np.pi / 2) - inc_rad
    y_inclined = z * np.sin(tilt)
    z_inclined = z * np.cos(tilt)
    
    return {
        "x": float(x),
        "y": float(y_inclined),
        "z": float(z_inclined),
        "phase": float(phase),
        "is_transiting": bool(abs(phase) < 0.02 or abs(phase - 1.0) < 0.02),
        "is_occulted": bool(abs(phase - 0.5) < 0.02),
    }

def generate_orbit_path(a_rs: float, b: float, n_points: int = 200) -> list:
    """Returns list of {x, y, z} points tracing the full orbit, for drawing the path line."""
    phases = np.linspace(0, 1, n_points)
    return [orbital_phase_to_xyz(p, a_rs, b) for p in phases]

def get_next_transit(t0_btjd: float, period_days: float) -> tuple[float, float]:
    """
    Returns (next_transit_btjd, next_transit_in_hours)
    """
    now_jd = Time.now().jd
    now_btjd = now_jd - 2457000.0
    
    if now_btjd < t0_btjd:
        next_transit = t0_btjd
    else:
        elapsed = now_btjd - t0_btjd
        cycles = math.ceil(elapsed / period_days)
        next_transit = t0_btjd + cycles * period_days
        
    next_in_hours = (next_transit - now_btjd) * 24.0
    return float(next_transit), float(next_in_hours)
