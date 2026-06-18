"""
utils/preprocess.py
Detrend and normalize TESS light curves using wotan biweight filter.
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
