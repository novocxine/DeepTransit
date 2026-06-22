"""
utils/detect.py
BLS period search using astropy.timeseries.BoxLeastSquares.
"""
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


def run_bls(
    time: np.ndarray,
    flux: np.ndarray,
    flux_err: np.ndarray,
    min_period: float = 0.5,
    max_period: float = 27.0,
    n_periods: int = 5000,
    duration_grid: Optional[np.ndarray] = None,
) -> dict:
    """
    Run Box Least Squares periodogram on detrended light curve.

    Returns dict with:
        period, duration, t0, depth, depth_snr, power_peak,
        period_grid, power_grid, odd_even_ratio, secondary_depth
    """
    try:
        from astropy.timeseries import BoxLeastSquares
    except ImportError as e:
        raise ImportError("astropy is required: pip install astropy") from e

    # Convert flux to relative flux if not already (centered near 1.0)
    flux_med = np.nanmedian(flux)
    if abs(flux_med - 1.0) > 0.1:
        flux_rel = flux / flux_med
        flux_err_rel = flux_err / flux_med
    else:
        flux_rel = flux
        flux_err_rel = flux_err

    if duration_grid is None:
        # Transit durations from 1 hr to 12 hr
        duration_grid = np.array([1 / 24, 2 / 24, 3 / 24, 4 / 24, 6 / 24, 8 / 24, 12 / 24])

    # Astropy BLS strictly requires max duration < min period
    safe_min_period = max(min_period, float(np.max(duration_grid)) + 0.01)
    period_grid = np.linspace(safe_min_period, max_period, n_periods)

    logger.info(
        f"Running BLS: {n_periods} periods [{min_period:.1f}, {max_period:.1f}] d, "
        f"{len(duration_grid)} duration trials"
    )

    bls = BoxLeastSquares(time, flux_rel, dy=flux_err_rel)
    periodogram = bls.power(period_grid, duration_grid, objective="snr")

    # Best period
    best_idx = np.argmax(periodogram.power)
    best_period = float(periodogram.period[best_idx])
    best_power = float(periodogram.power[best_idx])

    # Get precise transit parameters at best period
    stats = bls.compute_stats(
        float(periodogram.period[best_idx]),
        float(periodogram.duration[best_idx]),
        float(periodogram.transit_time[best_idx]),
    )

    # astropy BoxLeastSquares.compute_stats returns a tuple for depth: (depth, depth_err)
    if isinstance(stats.get("depth"), tuple) and len(stats["depth"]) == 2:
        depth = float(stats["depth"][0])
        depth_err = float(stats["depth"][1])
    else:
        depth = float(stats["depth"][0]) if hasattr(stats.get("depth"), "__len__") else float(stats.get("depth", 0.0))
        depth_err = 0.0
    duration = float(periodogram.duration[best_idx])
    t0 = float(periodogram.transit_time[best_idx])

    snr = depth / depth_err if depth_err > 0 else 0.0

    # Odd-even ratio: compare transit depths at odd vs even transits
    odd_even_ratio = _compute_odd_even_ratio(time, flux_rel, best_period, t0, duration)

    # Secondary eclipse search at phase 0.5
    secondary_depth = _search_secondary(time, flux_rel, best_period, t0, duration)

    logger.info(
        f"BLS result: period={best_period:.4f} d, depth={depth:.6f}, "
        f"SNR={snr:.2f}, odd_even={odd_even_ratio:.3f}"
    )

    return {
        "period": best_period,
        "duration": duration,
        "t0": t0,
        "depth": depth,
        "depth_err": depth_err,
        "snr": float(snr),
        "power_peak": best_power,
        "period_grid": period_grid.tolist(),
        "power_grid": periodogram.power.tolist(),
        "odd_even_ratio": float(odd_even_ratio),
        "secondary_depth": float(secondary_depth),
        "n_transits": int(stats.get("ntransits", 0)) if "ntransits" in stats else _count_transits(time, best_period, t0),
    }


def _compute_odd_even_ratio(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
    duration: float,
) -> float:
    """
    Compare depths of odd vs even transits. High ratio → likely eclipsing binary.
    Returns |depth_odd - depth_even| / (depth_odd + depth_even)
    """
    in_transit = np.zeros(len(time), dtype=int)
    half_dur = duration / 2.0
    n = np.round((time - t0) / period).astype(int)
    phase = time - (t0 + n * period)
    in_transit_mask = np.abs(phase) < half_dur

    if in_transit_mask.sum() < 4:
        return 0.0

    odd_depths, even_depths = [], []
    for transit_n in np.unique(n[in_transit_mask]):
        mask = in_transit_mask & (n == transit_n)
        if mask.sum() < 2:
            continue
        depth_here = 1.0 - float(np.nanmedian(flux[mask]))
        if transit_n % 2 == 0:
            even_depths.append(depth_here)
        else:
            odd_depths.append(depth_here)

    if not odd_depths or not even_depths:
        return 0.0

    d_odd = float(np.median(odd_depths))
    d_even = float(np.median(even_depths))
    total = abs(d_odd) + abs(d_even)
    if total == 0:
        return 0.0
    return abs(d_odd - d_even) / total


def _search_secondary(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
    duration: float,
) -> float:
    """Search for a secondary eclipse at phase 0.5 (half-period offset)."""
    t0_secondary = t0 + period / 2.0
    phase = ((time - t0_secondary) % period) / period
    phase[phase > 0.5] -= 1.0
    in_sec = np.abs(phase) < (duration / period)
    out_sec = (np.abs(phase) > 2 * duration / period) & (np.abs(phase) < 0.4)

    if in_sec.sum() < 2 or out_sec.sum() < 2:
        return 0.0

    depth_sec = float(np.nanmedian(flux[out_sec])) - float(np.nanmedian(flux[in_sec]))
    return max(0.0, depth_sec)


def _count_transits(time: np.ndarray, period: float, t0: float) -> int:
    t_span = time[-1] - time[0]
    return max(1, int(t_span / period))


def check_period_aliasing(time, flux, flux_err, bls_result, snr_threshold=6.0):
    """
    Re-runs a focused BLS search at half the detected period to check whether
    the 'true' period might be half of what was originally found — the classic
    EB-masquerading-as-planet failure mode.

    If a comparably strong signal exists at period/2 with a DIFFERENT depth on
    alternating eclipses, the original detection is very likely a binary star
    system, and the true period is half of what was reported.
    """
    import numpy as np
    from astropy.timeseries import BoxLeastSquares
    import astropy.units as u

    full_period = bls_result["period"]
    half_period = full_period / 2.0

    # Narrow, focused search right around half_period only
    search_window = np.linspace(half_period * 0.97, half_period * 1.03, 500) * u.day
    durations = np.array([bls_result["duration"] * 0.7,
                          bls_result["duration"],
                          bls_result["duration"] * 1.3]) * u.day

    bls = BoxLeastSquares(time * u.day, flux, dy=flux_err)
    try:
        pg = bls.power(search_window, durations, method="fast", objective="snr")
    except Exception:
        return {"aliasing_detected": False, "reason": "half-period search failed to run"}

    best_idx = np.argmax(pg.power)
    half_snr = float(pg.power[best_idx])
    half_best_period = float(pg.period[best_idx].value)

    if half_snr < snr_threshold:
        return {"aliasing_detected": False, "half_period_snr": half_snr,
                "reason": "no significant signal at half-period — original period likely correct"}

    # AT THIS half-period to see if alternating eclipses actually differ.
    stats = bls.compute_stats(pg.period[best_idx], pg.duration[best_idx], pg.transit_time[best_idx])
    odd_depth = float(stats.get("depth_odd", [0, 0])[0])
    even_depth = float(stats.get("depth_even", [0, 0])[0])
    
    # If one of the depths is essentially zero, this isn't an EB with two unequal dips
    # — it's just a genuine planet (single dip) folded at half its true period.
    # An alias must have two actual, measurable dips.
    min_depth = min(odd_depth, even_depth)
    max_depth = max(odd_depth, even_depth)
    
    if max_depth <= 0 or min_depth / max_depth < 0.1:
        return {"aliasing_detected": False, "reason": "One of the alternating depths at half-period is zero/negligible; not an alias."}
        
    odd_even_at_half = abs(odd_depth - even_depth) / (odd_depth + even_depth + 1e-10)

    aliasing_detected = odd_even_at_half > 0.15  # meaningfully different alternating depths

    return {
        "aliasing_detected": bool(aliasing_detected),
        "half_period": half_best_period,
        "half_period_snr": half_snr,
        "odd_even_at_half_period": float(odd_even_at_half),
        "odd_depth_at_half": odd_depth,
        "even_depth_at_half": even_depth,
        "reason": (
            f"Significant signal found at half the original period (P/2 = {half_best_period:.4f}d) "
            f"with odd-even depth ratio {odd_even_at_half:.3f} — alternating eclipses differ "
            f"substantially, indicating two distinct eclipse depths typical of an eclipsing binary. "
            f"The reported period was likely a harmonic alias of the true {half_best_period:.4f}-day period."
        ) if aliasing_detected else (
            f"Signal exists at half-period but odd-even depths are consistent "
            f"({odd_even_at_half:.3f}) — does not indicate aliasing."
        ),
    }


def detect_ellipsoidal_variation(time, flux, period: float) -> dict:
    """
    Ellipsoidal variation produces a roughly sinusoidal flux pattern with TWO
    peaks per orbital period (at quadrature, phase ±0.25), distinct from a
    transit's single narrow dip. Checks for significant power at the
    second harmonic of the orbital frequency outside of the eclipse itself.
    """
    import numpy as np
    from scipy.optimize import curve_fit

    phase = ((time % period) / period)

    # Mask out the eclipse region itself (within 10% of phase 0) to isolate
    # any out-of-eclipse variability
    out_of_eclipse = (phase > 0.15) & (phase < 0.85)
    if out_of_eclipse.sum() < 20:
        return {"ellipsoidal_detected": False, "reason": "insufficient out-of-eclipse data"}

    phase_oe = phase[out_of_eclipse]
    flux_oe = flux[out_of_eclipse]

    def double_sine(p, amp, phase_offset, baseline):
        return baseline + amp * np.cos(4 * np.pi * (p - phase_offset))  # 2x per orbit

    try:
        popt, _ = curve_fit(double_sine, phase_oe, flux_oe, p0=[0.001, 0.0, 1.0])
        amplitude = abs(popt[0])
        out_of_eclipse_std = np.std(flux_oe)
        # Significant if the fitted double-sine amplitude is large relative to noise
        significant = amplitude > 2 * (out_of_eclipse_std / np.sqrt(out_of_eclipse.sum()))
    except Exception:
        return {"ellipsoidal_detected": False, "reason": "fit failed"}

    return {
        "ellipsoidal_detected": bool(significant),
        "amplitude": float(amplitude),
        "reason": (
            "Significant double-peaked (2x per orbit) brightness variation detected "
            "outside the eclipse window — consistent with tidal/ellipsoidal "
            "distortion in a close binary system, not a single planet transit."
            if significant else
            "No significant out-of-eclipse periodic variation detected."
        ),
    }
