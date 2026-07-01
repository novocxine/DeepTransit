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
    best_duration = float(periodogram.duration[best_idx])
    best_t0 = float(periodogram.transit_time[best_idx])

    # == ALIAS VERIFICATION PASS (Gate 1: SNR power) ==
    # Sweeps common harmonic multiples to ensure the pipeline doesn't lock onto a sub-harmonic or orbital alias.
    aliases = [0.5, 1.5, 2.0]
    for factor in aliases:
        test_period = best_period * factor
        if test_period < min_period or test_period > max_period:
            continue
            
        test_grid = np.linspace(test_period * 0.98, test_period * 1.02, 100)
        try:
            test_pg = bls.power(test_grid, duration_grid, objective="snr")
            test_power_val = float(np.max(test_pg.power))
            
            # If a harmonic yields a significantly cleaner baseline power, swap it
            if test_power_val > best_power * 1.15: 
                best_power = test_power_val
                t_idx = np.argmax(test_pg.power)
                best_period = float(test_pg.period[t_idx])
                best_duration = float(test_pg.duration[t_idx])
                best_t0 = float(test_pg.transit_time[t_idx])
                logger.info(f"Alias check Gate 1 (SNR): Locked onto harmonic alias {factor}x -> {best_period:.4f} d")
        except Exception:
            pass

    # == ALIAS VERIFICATION PASS (Gate 2: Phase-fold variance) ==
    # Among {P, 2P, P/2}, pick the candidate whose in-transit scatter is lowest.
    # This is signal-shape-aware: a true period stacks points cleanly inside the transit.
    best_period = brute_force_alias_override(time, flux_rel, best_period, best_duration * 24.0)
    # =============================

    # Get precise transit parameters at best period
    stats = bls.compute_stats(
        best_period,
        best_duration,
        best_t0,
    )

    # astropy BoxLeastSquares.compute_stats returns a tuple for depth: (depth, depth_err)
    if isinstance(stats.get("depth"), tuple) and len(stats["depth"]) == 2:
        depth = float(stats["depth"][0])
        depth_err = float(stats["depth"][1])
    else:
        depth = float(stats["depth"][0]) if hasattr(stats.get("depth"), "__len__") else float(stats.get("depth", 0.0))
        depth_err = 0.0
    duration = best_duration
    t0 = best_t0

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


# vicious_denoise_and_flatten is defined in utils.preprocess — import from there
# to avoid duplication. detect.py's _compute_odd_even_metrics uses it.
from utils.preprocess import vicious_denoise_and_flatten


def brute_force_alias_override(
    time: np.ndarray,
    flux: np.ndarray,
    detected_period: float,
    transit_duration_hours: float,
) -> float:
    """
    Phase-fold variance alias check.

    Evaluates the point-to-point scatter *inside* the transit window at three
    candidate periods: P, 2P, and P/2. A true planet fold stacks points cleanly
    (low scatter), whereas an alias mixes out-of-transit baseline into the
    window, inflating the variance.

    Parameters
    ----------
    time : np.ndarray
        Time array in days.
    flux : np.ndarray
        Detrended, relative flux array.
    detected_period : float
        Best-fit BLS period in days (Gate 1 result).
    transit_duration_hours : float
        Transit duration in hours (used to define the in-transit window).

    Returns
    -------
    float
        The period (P, 2P, or P/2) with the lowest in-transit scatter.
    """
    transit_duration_days = transit_duration_hours / 24.0
    test_periods = [detected_period, detected_period * 2.0, detected_period / 2.0]
    best_period = detected_period
    lowest_variance = float('inf')

    for p in test_periods:
        if p <= 0:
            continue
        # Phase-fold centred on 0
        phase = (time % p) / p
        phase = np.where(phase > 0.5, phase - 1.0, phase)

        # In-transit window: |phase| < transit_duration / period
        half_window = transit_duration_days / (2.0 * p)
        transit_window_mask = np.abs(phase) < half_window
        core_flux = flux[transit_window_mask]

        if len(core_flux) < 5:
            continue  # not enough points to assess scatter

        # Point-to-point variance — lowest = cleanest transit stack
        local_variance = float(np.var(np.diff(core_flux)))

        if local_variance < lowest_variance:
            lowest_variance = local_variance
            best_period = p

    if best_period != detected_period:
        logger.info(
            f"Alias check Gate 2 (phase-fold variance): "
            f"overriding {detected_period:.4f} d -> {best_period:.4f} d "
            f"(in-transit scatter {lowest_variance:.2e})"
        )
    return best_period


def _compute_odd_even_metrics(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
    duration: float,
) -> tuple[float, float, float]:
    """
    Compare depths of odd vs even transits locally after vicious denoising.
    Returns: (odd_even_ratio, odd_depth, even_depth)
    """
    flat_flux = vicious_denoise_and_flatten(time, flux, period, t0, duration * 24.0)

    # Extend the mask slightly to ensure we capture at least a few points even for short transits
    # with 30-minute cadence TESS data.
    half_dur = max(duration / 2.0, 0.03)  # minimum 0.03 days (~45 minutes) half-duration
    n = np.round((time - t0) / period).astype(int)
    phase = time - (t0 + n * period)
    in_transit_mask = np.abs(phase) <= half_dur

    if in_transit_mask.sum() < 2:
        return 0.0, 0.0, 0.0

    odd_fluxes, even_fluxes = [], []
    for transit_n in np.unique(n[in_transit_mask]):
        mask = in_transit_mask & (n == transit_n)
        # We need at least 1 point to compute a median depth!
        if mask.sum() < 1:
            continue
        if transit_n % 2 == 0:
            even_fluxes.extend(flat_flux[mask])
        else:
            odd_fluxes.extend(flat_flux[mask])

    if not odd_fluxes or not even_fluxes:
        return 0.0, 0.0, 0.0

    # Focus purely on the minimum dip points (Fix A)
    odd_transit_min = np.percentile(odd_fluxes, 5)
    even_transit_min = np.percentile(even_fluxes, 5)
    
    odd_depth = 1.0 - odd_transit_min
    even_depth = 1.0 - even_transit_min

    denom = max(odd_depth, even_depth)
    if denom <= 0:
        return 0.0, 0.0, 0.0

    ratio = abs(odd_depth - even_depth) / denom
    return ratio, odd_depth, even_depth


def _compute_odd_even_ratio(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
    duration: float,
) -> float:
    ratio, _, _ = _compute_odd_even_metrics(time, flux, period, t0, duration)
    return ratio



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
    # We use our robust, viciously-denoised odd-even metric calculation rather than Astropy's naive get
    odd_even_at_half, odd_depth, even_depth = _compute_odd_even_metrics(
        time, flux, half_best_period, pg.transit_time[best_idx].value, pg.duration[best_idx].value
    )
    
    # If one of the depths is essentially zero, this isn't an EB with two unequal dips
    # — it's just a genuine planet (single dip) folded at half its true period.
    # An alias must have two actual, measurable dips.
    min_depth = min(odd_depth, even_depth)
    max_depth = max(odd_depth, even_depth)
    
    if max_depth <= 0 or min_depth / max_depth < 0.1:
        import logging
        logging.getLogger(__name__).info(f"ALIAS REJECTED min/max: min={min_depth}, max={max_depth}")
        return {"aliasing_detected": False, "reason": "One of the alternating depths at half-period is zero/negligible; not an alias."}


    aliasing_detected = odd_even_at_half > 0.15  # meaningfully different alternating depths
    
    import logging
    logging.getLogger(__name__).info(f"ALIAS CHECK: odd={odd_depth}, even={even_depth}, ratio={odd_even_at_half}, res={aliasing_detected}")

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
