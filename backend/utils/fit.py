"""
utils/fit.py
Transit model fitting using batman + lmfit.
"""
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


def fit_transit_model(
    time: np.ndarray,
    flux: np.ndarray,
    flux_err: np.ndarray,
    bls_result: dict,
    max_iter: int = 1000,
) -> dict:
    """
    Fit a batman transit model to the phase-folded light curve using lmfit.

    Returns dict with:
        period, period_err, t0, t0_err,
        depth, depth_err, duration, duration_err,
        rp_rs, rp_rs_err, a_rs, a_rs_err,
        inc, inc_err, chi2_red, fit_quality
    """
    try:
        import batman
        import lmfit
    except ImportError as e:
        raise ImportError("batman-package and lmfit are required.") from e

    period = bls_result.get("period", 1.0)
    t0 = bls_result.get("t0", float(time[0]))
    depth = bls_result.get("depth", 0.001)
    duration = bls_result.get("duration", 0.1)

    # Phase-fold the light curve
    from utils.preprocess import phase_fold, bin_phase_curve
    phase, flux_fold = phase_fold(time, flux, period, t0)
    _, flux_err_fold = phase_fold(time, flux_err, period, t0)

    # Only fit within ±3 transit durations of centre
    window = min(3.0 * duration / period, 0.3)
    mask = np.abs(phase) < window
    if mask.sum() < 5:
        logger.warning("Too few points in transit window for fitting.")
        return _fallback_fit(bls_result)

    phase_fit = phase[mask]
    flux_fit = flux_fold[mask]
    err_fit = np.abs(flux_err_fold[mask])
    err_fit = np.where(err_fit < 1e-8, 1e-5, err_fit)

    # Initial parameter guesses
    rp_rs_init = float(np.sqrt(max(depth, 1e-6)))
    a_rs_init = _estimate_a_rs(period, duration, rp_rs_init)

    # Set up batman parameters
    batman_params = batman.TransitParams()
    batman_params.ecc = 0.0
    batman_params.w = 90.0
    batman_params.u = [0.1, 0.3]
    batman_params.limb_dark = "quadratic"

    def _batman_model(phase_arr: np.ndarray, rp: float, a: float, inc: float) -> np.ndarray:
        batman_params.per = 1.0  # phase-folded
        batman_params.t0 = 0.0
        batman_params.rp = max(rp, 1e-5)
        batman_params.a = max(a, 1.5)
        batman_params.inc = inc
        m = batman.TransitModel(batman_params, phase_arr)
        return m.light_curve(batman_params)

    def _residuals(params: lmfit.Parameters, x: np.ndarray, data: np.ndarray, err: np.ndarray):
        rp = params["rp_rs"].value
        a = params["a_rs"].value
        inc = params["inc"].value
        model = _batman_model(x, rp, a, inc)
        return (data - model) / err

    # lmfit parameters
    params = lmfit.Parameters()
    params.add("rp_rs", value=rp_rs_init, min=1e-5, max=0.5)
    params.add("a_rs", value=a_rs_init, min=1.5, max=100.0)
    params.add("inc", value=88.0, min=70.0, max=90.0)

    result = lmfit.minimize(
        _residuals,
        params,
        args=(phase_fit, flux_fit, err_fit),
        method="leastsq",
        max_nfev=max_iter,
    )

    rp_rs = float(result.params["rp_rs"].value)
    a_rs = float(result.params["a_rs"].value)
    inc = float(result.params["inc"].value)

    rp_rs_err = float(result.params["rp_rs"].stderr or rp_rs * 0.05)
    a_rs_err = float(result.params["a_rs"].stderr or a_rs * 0.05)
    inc_err = float(result.params["inc"].stderr or 0.5)

    fit_depth = float(rp_rs ** 2)
    fit_depth_err = float(2 * rp_rs * rp_rs_err)

    # Calculate duration from fitted parameters
    fit_duration = _calc_duration(period, rp_rs, a_rs, inc)
    fit_duration_err = duration * 0.05  # ~5% uncertainty

    chi2_red = float(result.redchi) if result.redchi is not None else 1.0
    fit_quality = "good" if chi2_red < 2.0 else ("fair" if chi2_red < 5.0 else "poor")

    logger.info(
        f"Fit: Rp/Rs={rp_rs:.4f}±{rp_rs_err:.4f}, "
        f"a/Rs={a_rs:.2f}, χ²_red={chi2_red:.3f} ({fit_quality})"
    )

    return {
        "period": round(period, 6),
        "period_err": round(period * 0.001, 6),
        "t0": round(t0, 4),
        "t0_err": round(period * 0.001, 4),
        "depth": round(fit_depth, 7),
        "depth_err": round(fit_depth_err, 7),
        "duration": round(fit_duration, 5),
        "duration_err": round(fit_duration_err, 5),
        "rp_rs": round(rp_rs, 5),
        "rp_rs_err": round(rp_rs_err, 5),
        "a_rs": round(a_rs, 3),
        "a_rs_err": round(a_rs_err, 3),
        "inc": round(inc, 3),
        "inc_err": round(inc_err, 3),
        "chi2_red": round(chi2_red, 4),
        "fit_quality": fit_quality,
        "converged": result.success,
    }


def _estimate_a_rs(period: float, duration: float, rp_rs: float) -> float:
    """Rough estimate of a/Rs from transit duration assuming i=90."""
    if duration <= 0 or period <= 0:
        return 10.0
    # T14 ≈ (P/π) * arcsin(Rs/a * sqrt((1+rp/rs)^2)) → a/Rs ≈ period/(π*T14) for central transit
    a_rs = period / (np.pi * duration)
    return float(np.clip(a_rs, 2.0, 80.0))


def _calc_duration(period: float, rp_rs: float, a_rs: float, inc_deg: float) -> float:
    """Analytical T14 transit duration in days."""
    inc_rad = np.radians(inc_deg)
    b = a_rs * np.cos(inc_rad)  # impact parameter
    inside = (1 + rp_rs) ** 2 - b ** 2
    if inside <= 0:
        return period * 0.05
    arg = np.sqrt(inside) / (a_rs * np.sin(inc_rad))
    arg = float(np.clip(arg, -1.0, 1.0))
    return float((period / np.pi) * np.arcsin(arg))


def _fallback_fit(bls_result: dict) -> dict:
    """Return BLS-derived estimates when batman fitting fails."""
    period = bls_result.get("period", 1.0)
    depth = bls_result.get("depth", 0.0)
    duration = bls_result.get("duration", 0.1)
    t0 = bls_result.get("t0", 0.0)
    rp_rs = float(np.sqrt(max(depth, 0)))

    return {
        "period": round(period, 6),
        "period_err": round(period * 0.002, 6),
        "t0": round(t0, 4),
        "t0_err": round(period * 0.002, 4),
        "depth": round(depth, 7),
        "depth_err": round(depth * 0.1, 7),
        "duration": round(duration, 5),
        "duration_err": round(duration * 0.1, 5),
        "rp_rs": round(rp_rs, 5),
        "rp_rs_err": round(rp_rs * 0.05, 5),
        "a_rs": 10.0,
        "a_rs_err": 2.0,
        "inc": 89.0,
        "inc_err": 1.0,
        "chi2_red": 99.0,
        "fit_quality": "fallback",
        "converged": False,
    }
