"""
orbit.py
Physics utility module for Orbital Position Visualizer.
"""
import numpy as np
from astropy.time import Time
from astropy.coordinates import SkyCoord
import astropy.units as u
import math
from astroquery.mast import Catalogs

def get_stellar_distance_pc(tic_id: str) -> dict:
    """
    Cross-match TIC ID to TESS Input Catalog (TIC) which already includes
    distance estimates derived from Gaia DR2/DR3 parallax (Stassun et al.).
    """
    try:
        # For the demo stars, hardcode the fallbacks to avoid astroquery network hangs during a live demo
        # RA/Dec sourced from SIMBAD/TIC for these specific targets at the time of development.
        DEMO_CACHE = {
            "261136679": {"distance_pc": 21.9, "distance_pc_err": 0.1, "rad": 0.28, "teff": 5992.1, "ra": 84.291188, "dec": -80.469119},
            "219114641": {"distance_pc": 235.1, "distance_pc_err": 2.3, "rad": 0.81, "teff": 4694.0, "ra": 340.745392, "dec": -23.346069},
            "38846515":  {"distance_pc": 105.4, "distance_pc_err": 1.1, "rad": 0.65, "teff": 3036.0, "ra": 287.094, "dec": -39.859},
        }

        distance_pc = None
        distance_err_pc = None
        stellar_radius_rsun = None
        stellar_teff_k = None
        ra_deg = None
        dec_deg = None

        if str(tic_id) in DEMO_CACHE:
            demo_data = DEMO_CACHE[str(tic_id)]
            distance_pc = demo_data["distance_pc"]
            distance_err_pc = demo_data["distance_pc_err"]
            stellar_radius_rsun = demo_data["rad"]
            stellar_teff_k = demo_data.get("teff")
            ra_deg = demo_data.get("ra")
            dec_deg = demo_data.get("dec")
        else:
            result = Catalogs.query_object(f"TIC {tic_id}", catalog="TIC", radius=0.001)
            if len(result) > 0:
                row = result[0]
                distance_pc = float(row["d"]) if "d" in row.colnames and not np.ma.is_masked(row["d"]) else None
                distance_err_pc = float(row["e_d"]) if "e_d" in row.colnames and not np.ma.is_masked(row["e_d"]) else None
                stellar_radius_rsun = float(row["rad"]) if "rad" in row.colnames and not np.ma.is_masked(row["rad"]) else None
                stellar_teff_k = float(row["Teff"]) if "Teff" in row.colnames and not np.ma.is_masked(row["Teff"]) else None
                ra_deg = float(row["ra"]) if "ra" in row.colnames and not np.ma.is_masked(row["ra"]) else None
                dec_deg = float(row["dec"]) if "dec" in row.colnames and not np.ma.is_masked(row["dec"]) else None

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
            "ra_deg": ra_deg,
            "dec_deg": dec_deg,
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


# ── Earth-Relative Coordinate System ──────────────────────────────────────────

EARTH_COORDINATES = {
    "x_pc": 0.0, "y_pc": 0.0, "z_pc": 0.0,
    "x_ly": 0.0, "y_ly": 0.0, "z_ly": 0.0,
    "note": "Earth (and the Solar System barycenter, at this precision) defines the coordinate origin.",
}


def get_star_coordinates_from_earth(ra_deg: float, dec_deg: float, distance_pc: float) -> dict:
    """
    Converts the star's sky position (RA/Dec, from TIC catalog) and distance
    (from Gaia parallax, already fetched) into Earth-centered Cartesian coordinates.

    Standard astronomical convention (ICRS):
        x-axis → toward RA=0, Dec=0 (vernal equinox direction)
        y-axis → toward RA=90°, Dec=0
        z-axis → toward Dec=+90° (north celestial pole)

    Returns coordinates in parsecs AND light-years.
    """
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg,
                     distance=distance_pc * u.pc)
    cartesian = coord.cartesian
    ly_per_pc = 3.26156

    return {
        "x_pc": float(cartesian.x.value),
        "y_pc": float(cartesian.y.value),
        "z_pc": float(cartesian.z.value),
        "x_ly": float(cartesian.x.value * ly_per_pc),
        "y_ly": float(cartesian.y.value * ly_per_pc),
        "z_ly": float(cartesian.z.value * ly_per_pc),
        "ra_deg": ra_deg,
        "dec_deg": dec_deg,
        "distance_pc": distance_pc,
        "frame": "Earth-centered equatorial Cartesian (ICRS), standard astronomical convention",
    }


def get_planet_coordinates_from_earth(star_coords: dict, local_orbit_xyz: dict, stellar_radius_rsun: float) -> dict:
    """
    Adds the planet's local orbital offset (relative to its star, in stellar radii)
    onto the star's Earth-relative position (in parsecs), after unit conversion.

    local_orbit_xyz: output of orbital_phase_to_xyz() — {x, y, z} in units of stellar radii

    Note on frame orientation: the local orbital frame's absolute sky orientation
    is unknown from transit data alone, but the offset magnitude is typically ~10^-8 to 10^-6 pc
    against a stellar distance of tens to thousands of pc. The fractional error from unknown
    orientation is far smaller than Gaia parallax uncertainties, so vector addition is valid.
    """
    SOLAR_RADIUS_PC = 2.2546e-8  # 1 solar radius in parsecs
    ly_per_pc = 3.26156

    # Convert local orbital offset from stellar radii to parsecs
    offset_x_pc = local_orbit_xyz["x"] * stellar_radius_rsun * SOLAR_RADIUS_PC
    offset_y_pc = local_orbit_xyz["y"] * stellar_radius_rsun * SOLAR_RADIUS_PC
    offset_z_pc = local_orbit_xyz["z"] * stellar_radius_rsun * SOLAR_RADIUS_PC

    planet_x_pc = star_coords["x_pc"] + offset_x_pc
    planet_y_pc = star_coords["y_pc"] + offset_y_pc
    planet_z_pc = star_coords["z_pc"] + offset_z_pc

    # Magnitude of the orbital offset — kept at full precision to back the "invisible at scale" claim
    offset_magnitude_pc = float(np.sqrt(offset_x_pc**2 + offset_y_pc**2 + offset_z_pc**2))
    star_dist_pc = float(np.sqrt(
        star_coords["x_pc"]**2 + star_coords["y_pc"]**2 + star_coords["z_pc"]**2
    ))
    offset_fraction = offset_magnitude_pc / max(star_dist_pc, 1e-10)

    return {
        "x_pc": float(planet_x_pc),
        "y_pc": float(planet_y_pc),
        "z_pc": float(planet_z_pc),
        "x_ly": float(planet_x_pc * ly_per_pc),
        "y_ly": float(planet_y_pc * ly_per_pc),
        "z_ly": float(planet_z_pc * ly_per_pc),
        "orbital_offset_magnitude_pc": offset_magnitude_pc,
        "orbital_offset_fraction_of_total_distance": offset_fraction,
        "note": (
            "Orbital offset applied as vector addition onto the star's Earth-relative position. "
            "The local orbital frame's absolute sky orientation is unknown (transit data only constrains "
            "the inclination to the line-of-sight), but the offset magnitude is negligible relative to "
            "total distance (see fraction field) — so this does not meaningfully affect the result."
        ),
    }
