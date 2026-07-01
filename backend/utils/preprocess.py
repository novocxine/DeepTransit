"""
utils/preprocess.py
Detrend and normalize TESS light curves using wotan biweight filter.
Includes transit-aware second-pass detrending to suppress stellar rotation
without blunting real transit walls.
"""
import logging
import numpy as np
from typing import Tuple

logger = logging.getLogger(__name__)


def detrend_and_normalize(
    time: np.ndarray,
    flux: np.ndarray,
    flux_err: np.ndarray,
    window_length: float = 0.75,
    break_tolerance: float = 0.5,
    sigma_lower: float = 5.0,
    sigma_upper: float = 3.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Detrend using wotan biweight filter and normalize to zero-mean, unit-variance.

    Returns:
        time_clean, flux_flat, flux_err_norm, trend
    """
    try:
        from wotan import flatten
    except ImportError as e:
        raise ImportError("wotan is required: pip install wotan") from e

    logger.info(
        f"Detrending {len(time)} points with wotan biweight "
        f"(window={window_length} d)"
    )

    # Remove obvious outliers before detrending
    median_flux = np.nanmedian(flux)
    mad = np.nanmedian(np.abs(flux - median_flux))
    good_mask = np.abs(flux - median_flux) < sigma_lower * mad * 1.4826
    time_c = time[good_mask]
    flux_c = flux[good_mask]
    flux_err_c = flux_err[good_mask]

    # Run wotan biweight detrending
    flat_flux, trend = flatten(
        time_c,
        flux_c,
        method="biweight",
        window_length=window_length,
        break_tolerance=break_tolerance,
        return_trend=True,
        edge_cutoff=0.5,
    )

    # Remove NaNs introduced by edge effects
    valid = np.isfinite(flat_flux) & np.isfinite(trend)
    time_out = time_c[valid]
    flat_flux_out = flat_flux[valid]
    flux_err_out = flux_err_c[valid]
    trend_out = trend[valid]

    # Normalize flux errors to match the flattened flux scale
    # flat_flux is already in units of relative flux (≈1.0 baseline)
    # Propagate: err_flat = err / trend
    flux_err_norm = flux_err_out / trend_out

    # Remove secondary outliers (upward flares, cosmic rays)
    sigma_mask = _sigma_clip(flat_flux_out, sigma_lower=sigma_lower, sigma_upper=sigma_upper)
    time_out = time_out[sigma_mask]
    flat_flux_out = flat_flux_out[sigma_mask]
    flux_err_norm = flux_err_norm[sigma_mask]
    trend_out = trend_out[sigma_mask]

    logger.info(
        f"Preprocessing done. {len(time_out)} points remain "
        f"(removed {len(time) - len(time_out)})"
    )

    return time_out, flat_flux_out, flux_err_norm, trend_out


def _sigma_clip(
    flux: np.ndarray,
    sigma_lower: float = 5.0,
    sigma_upper: float = 3.0,
    n_iter: int = 3,
) -> np.ndarray:
    """Iterative sigma clipping mask (True = keep)."""
    mask = np.ones(len(flux), dtype=bool)
    for _ in range(n_iter):
        med = np.nanmedian(flux[mask])
        mad = np.nanmedian(np.abs(flux[mask] - med)) * 1.4826
        mask = mask & (flux >= med - sigma_lower * mad) & (flux <= med + sigma_upper * mad)
    return mask


def phase_fold(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Phase-fold a light curve and return sorted (phase, flux)."""
    phase = ((time - t0) % period) / period
    phase[phase > 0.5] -= 1.0
    sort_idx = np.argsort(phase)
    return phase[sort_idx], flux[sort_idx]


def vicious_denoise_and_flatten(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    epoch: float,
    transit_duration_hours: float,
) -> np.ndarray:
    """
    Transit-protected local flattening.

    Strips large-scale rotational variability (stellar spots) from a light curve
    *without* blunting the transit walls, by masking out the known transit windows
    before computing the stellar baseline.

    Algorithm:
      1. Savitzky-Golay smooth the entire flux series.
      2. Phase-fold and mask the in-transit region
         (|phase| < transit_duration * 0.75).
      3. Apply a broad median filter to the *smoothed* flux to absorb
         slow stellar activity on the out-of-transit baseline.
      4. Divide the raw flux by this baseline — transits are preserved intact.

    Parameters
    ----------
    time : np.ndarray
        Time array (days).
    flux : np.ndarray
        Relative flux array (centred near 1.0).
    period : float
        Orbital period (days) used for phase masking.
    epoch : float
        Transit epoch t0 (days).
    transit_duration_hours : float
        Transit duration in hours used for mask window.

    Returns
    -------
    np.ndarray
        Baseline-corrected flux (same length as input).
    """
    import scipy.signal as scipy_signal

    clean_flux = flux.copy()

    # Savitzky-Golay pre-smoothing — window must be odd and >= polyorder+1
    window_len = min(11, len(clean_flux))
    if window_len % 2 == 0:
        window_len -= 1
    if window_len > 3:
        smoothed_flux = scipy_signal.savgol_filter(clean_flux, window_length=window_len, polyorder=2)
    else:
        smoothed_flux = clean_flux.copy()

    # Phase-fold and mask transit windows
    transit_duration_days = transit_duration_hours / 24.0
    phase = (time - epoch + 0.5 * period) % period - 0.5 * period
    in_transit_mask = np.abs(phase) < (transit_duration_days * 0.75)

    # Replace in-transit points with local linear interpolation before filtering
    smoothed_for_baseline = smoothed_flux.copy()
    if in_transit_mask.any() and (~in_transit_mask).sum() > 3:
        oot_indices = np.where(~in_transit_mask)[0]
        it_indices = np.where(in_transit_mask)[0]
        smoothed_for_baseline[it_indices] = np.interp(
            time[it_indices], time[oot_indices], smoothed_flux[oot_indices]
        )

    # Broad median filter to absorb stellar rotation
    time_span = max(time[-1] - time[0], 1.0)
    window_bins = int(len(time) * (transit_duration_days * 3.0 / time_span))
    if window_bins % 2 == 0:
        window_bins += 1
    kernel_size = max(21, window_bins)

    stellar_baseline = scipy_signal.medfilt(smoothed_for_baseline, kernel_size=kernel_size)
    # Guard against division by zero
    stellar_baseline[stellar_baseline == 0] = 1.0
    stellar_baseline[np.abs(stellar_baseline) < 1e-6] = 1.0

    return clean_flux / stellar_baseline


def transit_aware_detrend(
    time: np.ndarray,
    flux: np.ndarray,
    period: float,
    t0: float,
    duration: float,
) -> np.ndarray:
    """
    Apply a second-pass transit-aware detrending on an already-wotan-flattened
    light curve.

    Designed to be called *after* ``detrend_and_normalize()`` to strip residual
    stellar-rotation modulation that the broad biweight window may have missed,
    particularly for stars with short rotation periods (< 5 d).

    Parameters
    ----------
    time, flux : np.ndarray
        Already-flattened light curve (output of detrend_and_normalize).
    period : float
        Orbital period in days (from a preliminary BLS run).
    t0 : float
        Transit epoch in days.
    duration : float
        Transit duration in days.

    Returns
    -------
    np.ndarray
        Double-detrended flux array (same shape as input).
    """
    transit_duration_hours = duration * 24.0
    try:
        flux_2nd = vicious_denoise_and_flatten(time, flux, period, t0, transit_duration_hours)
        # Sanity check: if the result is wildly off scale, return original
        if np.nanstd(flux_2nd) > 5 * np.nanstd(flux) or not np.all(np.isfinite(flux_2nd)):
            logger.warning("transit_aware_detrend: second-pass result failed sanity check; using original.")
            return flux
        return flux_2nd
    except Exception as exc:
        logger.warning(f"transit_aware_detrend failed ({exc}); using original flux.")
        return flux


def bin_phase_curve(
    phase: np.ndarray,
    flux: np.ndarray,
    n_bins: int = 100,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bin a phase-folded light curve into n_bins bins."""
    bins = np.linspace(-0.5, 0.5, n_bins + 1)
    bin_centers = 0.5 * (bins[:-1] + bins[1:])
    bin_flux = np.full(n_bins, np.nan)
    bin_err = np.full(n_bins, np.nan)

    for i in range(n_bins):
        mask = (phase >= bins[i]) & (phase < bins[i + 1])
        if mask.sum() > 0:
            bin_flux[i] = np.nanmedian(flux[mask])
            bin_err[i] = np.nanstd(flux[mask]) / np.sqrt(mask.sum())

    valid = np.isfinite(bin_flux)
    return bin_centers[valid], bin_flux[valid], bin_err[valid]
