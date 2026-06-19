import numpy as np
import os
import json

SOLAR_TEFF_K = 5778
SOLAR_LUMINOSITY = 1.0  # in solar units, by definition

EARTH_RADIUS_RSUN = 0.009158  # Earth radius in solar radii, for converting Rp/Rs -> Rp/Rearth

SOLAR_SYSTEM_REFERENCE = {
    "Mercury":  {"a_au": 0.387, "radius_rearth": 0.383, "period_days": 88.0},
    "Venus":    {"a_au": 0.723, "radius_rearth": 0.949, "period_days": 224.7},
    "Earth":    {"a_au": 1.000, "radius_rearth": 1.000, "period_days": 365.25},
    "Mars":     {"a_au": 1.524, "radius_rearth": 0.532, "period_days": 687.0},
    "Jupiter":  {"a_au": 5.203, "radius_rearth": 11.21, "period_days": 4331},
}

def estimate_stellar_luminosity(t_eff_k: float, radius_rsun: float) -> float:
    """L/Lsun = (R/Rsun)^2 * (T/Tsun)^4 — Stefan-Boltzmann scaling."""
    return (radius_rsun ** 2) * ((t_eff_k / SOLAR_TEFF_K) ** 4)

def estimate_equilibrium_temperature(t_eff_k: float, radius_rsun: float, a_au: float, albedo: float = 0.3) -> dict:
    """
    Equilibrium temperature assuming a Bond albedo of 0.3 (Earth-like default,
    flagged explicitly as an assumption since real albedo is unknown without
    spectroscopy/photometry beyond what transit data provides).

    T_eq = T_star * sqrt(R_star / (2a)) * (1 - albedo)^0.25
    """
    SOLAR_RADIUS_AU = 0.00465047
    radius_au = radius_rsun * SOLAR_RADIUS_AU

    t_eq = t_eff_k * np.sqrt(radius_au / (2 * a_au)) * ((1 - albedo) ** 0.25)

    return {
        "equilibrium_temp_k": float(t_eq),
        "equilibrium_temp_c": float(t_eq - 273.15),
        "albedo_assumed": albedo,
        "assumption_note": "Assumes Earth-like Bond albedo (0.3) — real albedo unknown without additional photometry. This is equilibrium temperature, NOT surface temperature (excludes atmospheric/greenhouse effects).",
    }

def compute_habitable_zone(t_eff_k: float, luminosity_lsun: float) -> dict:
    """
    Conservative habitable zone boundaries using the Kopparapu et al. (2013) approximation.
    Returns inner/outer edge in AU.
    """
    t_star = t_eff_k - SOLAR_TEFF_K

    # Simplified Kopparapu coefficients for conservative HZ (runaway greenhouse to maximum greenhouse)
    s_eff_inner = 1.0512 + 1.3242e-4 * t_star + 1.5418e-8 * t_star**2 - 7.9895e-12 * t_star**3
    s_eff_outer = 0.3438 + 5.8942e-5 * t_star + 1.6558e-9 * t_star**2 - 3.0045e-12 * t_star**3

    inner_au = float(np.sqrt(luminosity_lsun / s_eff_inner))
    outer_au = float(np.sqrt(luminosity_lsun / s_eff_outer))

    return {
        "inner_edge_au": inner_au,
        "outer_edge_au": outer_au,
        "method": "Kopparapu et al. (2013) conservative habitable zone approximation",
    }

def classify_hz_position(a_au: float, hz: dict) -> str:
    """Returns: 'too_hot' | 'habitable_zone' | 'too_cold'"""
    if a_au < hz["inner_edge_au"]:
        return "too_hot"
    elif a_au > hz["outer_edge_au"]:
        return "too_cold"
    return "habitable_zone"

def compare_to_solar_system(period_days: float, a_au: float, rp_rs: float, stellar_radius_rsun: float) -> dict:
    planet_radius_rearth = (rp_rs * stellar_radius_rsun) / EARTH_RADIUS_RSUN

    closest_analog = min(
        SOLAR_SYSTEM_REFERENCE.items(),
        key=lambda kv: abs(np.log(kv[1]["a_au"]) - np.log(max(a_au, 1e-6)))
    )

    return {
        "planet_radius_rearth": float(planet_radius_rearth),
        "orbital_distance_au": float(a_au),
        "orbital_distance_vs_earth_pct": float((a_au / 1.0) * 100),
        "period_vs_earth_pct": float((period_days / 365.25) * 100),
        "closest_solar_system_analog_by_distance": closest_analog[0],
        "solar_system_reference": SOLAR_SYSTEM_REFERENCE,
    }

def classify_planet_type(radius_rearth: float, period_days: float, equilibrium_temp_k: float) -> dict:
    """
    Standard exoplanet population classification by radius (Fulton et al. 2017 gap-informed thresholds)
    plus a temperature-based hot/warm/cold qualifier.
    """
    if radius_rearth < 1.25:
        size_class = "Rocky / Earth-like"
    elif radius_rearth < 2.0:
        size_class = "Super-Earth"
    elif radius_rearth < 6.0:
        size_class = "Sub-Neptune / Mini-Neptune"
    elif radius_rearth < 15.0:
        size_class = "Neptune-like"
    else:
        size_class = "Gas Giant"

    if equilibrium_temp_k > 1000:
        temp_class = "Ultra-hot"
    elif equilibrium_temp_k > 500:
        temp_class = "Hot"
    elif equilibrium_temp_k > 250:
        temp_class = "Warm"
    else:
        temp_class = "Cold"

    is_short_period_giant = radius_rearth > 6.0 and period_days < 10
    label = "Hot Jupiter" if is_short_period_giant else f"{temp_class} {size_class}"

    return {
        "size_class": size_class,
        "temperature_class": temp_class,
        "informal_label": label,
        "classification_method": "Radius thresholds per Fulton et al. (2017) radius gap; temperature thresholds are illustrative bins, not a formal standard.",
    }

def find_nearest_known_exoplanets(radius_rearth: float, period_days: float, n: int = 3) -> list:
    """
    Find the n most similar known exoplanets by normalized log-distance
    in (radius, period) space — gives judges a 'this is similar to X' anchor point.
    """
    base_dir = os.path.dirname(os.path.dirname(__file__))
    json_path = os.path.join(base_dir, "data", "exoplanet_reference_sample.json")
    
    with open(json_path, "r") as f:
        reference = json.load(f)

    def distance(planet):
        dr = np.log(radius_rearth) - np.log(planet["radius_rearth"])
        dp = np.log(period_days) - np.log(planet["period_days"])
        return np.sqrt(dr**2 + dp**2)

    for planet in reference:
        planet["_dist"] = distance(planet)

    ranked = sorted(reference, key=lambda x: x["_dist"])
    
    # Check if we are extrapolating
    nearest = ranked[:n]
    for p in nearest:
        # if distance is suspiciously large, we'll flag it
        if p["_dist"] > 1.5:
            p["extrapolated"] = True
        else:
            p["extrapolated"] = False
        del p["_dist"]

    return nearest
