"""
orbit.py
Physics utility module for Orbital Position Visualizer.
"""
import numpy as np
from astropy.time import Time
import math

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
