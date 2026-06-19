"""
utils/vetting.py
Formal vetting diagnostics suite — mirrors real TESS/Kepler vetting pipelines.

Each test is independent and answers a specific false-positive question.
Overall verdict is categorical (not a score) to avoid confusion with the
existing classifier confidence.
"""
import logging
import numpy as np

logger = logging.getLogger(__name__)


def run_vetting_suite(time, flux, flux_err, bls_result: dict, fit_result: dict = None) -> dict:
    """
    Runs the full vetting diagnostic battery.

    Each test returns:
        { name, value, threshold, severity: 'pass'|'caution'|'fail', passed, explanation }

    The overall verdict is a categorical status — NOT a second confidence score.
    Classifier confidence = "what type of signal?"; vetting verdict = "how trustworthy is this detection?"
    """
    report = {}

    try:
        report["odd_even_test"] = _odd_even_test(bls_result)
    except Exception as e:
        logger.warning(f"odd_even_test failed: {e}")
        report["odd_even_test"] = _error_test("Odd-Even Depth Test", str(e))

    try:
        report["secondary_eclipse_test"] = _secondary_eclipse_test(bls_result)
    except Exception as e:
        logger.warning(f"secondary_eclipse_test failed: {e}")
        report["secondary_eclipse_test"] = _error_test("Secondary Eclipse Search", str(e))

    try:
        report["shape_test"] = _transit_shape_test(time, flux, bls_result)
    except Exception as e:
        logger.warning(f"shape_test failed: {e}")
        report["shape_test"] = _error_test("Transit Shape (U vs V)", str(e))

    try:
        report["depth_consistency_test"] = _depth_consistency_test(bls_result, fit_result)
    except Exception as e:
        logger.warning(f"depth_consistency_test failed: {e}")
        report["depth_consistency_test"] = _error_test("Depth Consistency (BLS vs Fit)", str(e))

    try:
        report["duration_consistency_test"] = _duration_consistency_test(bls_result, fit_result)
    except Exception as e:
        logger.warning(f"duration_consistency_test failed: {e}")
        report["duration_consistency_test"] = _error_test("Duration Consistency (BLS vs Fit)", str(e))

    try:
        report["snr_test"] = _snr_test(bls_result)
    except Exception as e:
        logger.warning(f"snr_test failed: {e}")
        report["snr_test"] = _error_test("Signal-to-Noise Ratio", str(e))

    try:
        report["period_aliasing_test"] = _period_aliasing_test(bls_result)
    except Exception as e:
        logger.warning(f"period_aliasing_test failed: {e}")
        report["period_aliasing_test"] = _error_test("Period Aliasing Check (P vs P/2)", str(e))

    report["overall"] = _compute_overall_verdict(report)
    return report


def _error_test(name: str, error_msg: str) -> dict:
    return {
        "name": name, "value": None, "threshold": None, "severity": "caution",
        "passed": False, "explanation": f"Test could not be computed: {error_msg}",
    }


def _odd_even_test(bls_result: dict) -> dict:
    """
    Real planets produce identical transit depths on odd and even transits.
    A significant difference suggests an eclipsing binary — two stars of different
    sizes producing alternating primary/secondary-like dips at half the true period.
    """
    ratio = float(bls_result.get("odd_even_ratio", 0.0))
    threshold = 0.05
    severity = "pass" if ratio < threshold else ("caution" if ratio < 0.15 else "fail")
    return {
        "name": "Odd-Even Depth Test",
        "value": ratio,
        "threshold": threshold,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Compares transit depth on alternating (odd/even) transit events. "
            "A large difference suggests the true period may be double the detected "
            "period, with two stars of different sizes eclipsing each other (eclipsing binary), "
            "rather than a single consistent planet transit. "
            f"Detected ratio: {ratio:.3f}. Threshold: <{threshold}."
        ),
    }


def _secondary_eclipse_test(bls_result: dict) -> dict:
    """
    A significant dip at phase 0.5 (opposite side of orbit) suggests the secondary
    object emits its own light — i.e., it's a star, not a planet.
    """
    sec_depth = float(bls_result.get("secondary_depth", 0.0))
    primary_depth = float(bls_result.get("depth", 1e-6))
    sec_ratio = sec_depth / max(primary_depth, 1e-10)
    threshold = 0.10
    severity = "pass" if sec_ratio < threshold else ("caution" if sec_ratio < 0.25 else "fail")
    return {
        "name": "Secondary Eclipse Search",
        "value": round(sec_ratio, 4),
        "threshold": threshold,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Searches for a dip at the opposite orbital phase (phase ≈ 0.5, secondary eclipse). "
            "Planets don't emit detectable light, so a real planet transit should show "
            "no significant secondary eclipse. A detected secondary suggests the "
            "transiting object is self-luminous — i.e., a star. "
            f"Secondary/primary depth ratio: {sec_ratio:.4f}. Threshold: <{threshold}."
        ),
    }


def _transit_shape_test(time, flux, bls_result: dict) -> dict:
    """
    Planet transits are flat-bottomed (U-shaped) because the planet's disk fully
    overlaps the star at mid-transit for a measurable duration. Grazing eclipses
    or blended sources often produce V-shaped (pointed) dips instead.
    """
    from utils.preprocess import phase_fold, bin_phase_curve

    period = bls_result["period"]
    t0 = bls_result["t0"]
    duration = bls_result["duration"]

    phase, flux_folded = phase_fold(np.asarray(time), np.asarray(flux), period, t0)
    bin_centers, bin_flux, _ = bin_phase_curve(phase, flux_folded, n_bins=100)

    half_width = (duration / period) / 2
    in_transit_mask = np.abs(bin_centers) < half_width
    valid = in_transit_mask & np.isfinite(bin_flux)

    if valid.sum() < 5:
        return {
            "name": "Transit Shape (U vs V)", "value": None, "threshold": None,
            "severity": "caution", "passed": False,
            "explanation": "Insufficient in-transit data points to assess transit shape reliably.",
        }

    in_transit_flux = bin_flux[valid]
    flux_range = np.ptp(in_transit_flux)
    flatness = float(np.std(in_transit_flux) / (flux_range + 1e-10))
    threshold = 0.35
    severity = "pass" if flatness < threshold else ("caution" if flatness < 0.55 else "fail")

    return {
        "name": "Transit Shape (U vs V)",
        "value": round(flatness, 4),
        "threshold": threshold,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Checks whether the transit floor is flat (U-shaped, consistent with a "
            "planet fully crossing the star's disk) or pointed (V-shaped, consistent "
            "with a grazing eclipse or blended source). Metric is relative std of "
            f"flux within the transit window. Value: {flatness:.4f}. Threshold: <{threshold}."
        ),
    }


def _depth_consistency_test(bls_result: dict, fit_result: dict, threshold: float = 0.25) -> dict:
    """
    Checks that the BLS-detected depth agrees with the batman-fitted depth.
    Large disagreement suggests a poor or unstable fit.
    """
    if fit_result is None:
        return {
            "name": "Depth Consistency (BLS vs Fit)", "value": None, "threshold": threshold,
            "severity": "caution", "passed": False,
            "explanation": "No batman fit result available for comparison.",
        }
    bls_depth = float(bls_result.get("depth", 0))
    fit_depth = float(fit_result.get("depth", 0))
    rel_diff = abs(bls_depth - fit_depth) / max(abs(bls_depth), 1e-10)
    severity = "pass" if rel_diff < threshold else ("caution" if rel_diff < 0.5 else "fail")
    return {
        "name": "Depth Consistency (BLS vs Fit)",
        "value": round(rel_diff, 4),
        "threshold": threshold,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Compares the model-independent BLS depth estimate against the "
            "physically-fitted batman model depth. Large disagreement suggests an "
            "unstable or poorly-constrained fit. "
            f"BLS depth: {bls_depth:.6f}, Fit depth: {fit_depth:.6f}, "
            f"Relative difference: {rel_diff:.4f}. Threshold: <{threshold}."
        ),
    }


def _duration_consistency_test(bls_result: dict, fit_result: dict, threshold: float = 0.25) -> dict:
    """Same as depth consistency, applied to transit duration."""
    if fit_result is None:
        return {
            "name": "Duration Consistency (BLS vs Fit)", "value": None, "threshold": threshold,
            "severity": "caution", "passed": False,
            "explanation": "No batman fit result available for comparison.",
        }
    bls_dur = float(bls_result.get("duration", 0))
    fit_dur = float(fit_result.get("duration", 0))
    rel_diff = abs(bls_dur - fit_dur) / max(abs(bls_dur), 1e-10)
    severity = "pass" if rel_diff < threshold else ("caution" if rel_diff < 0.5 else "fail")
    return {
        "name": "Duration Consistency (BLS vs Fit)",
        "value": round(rel_diff, 4),
        "threshold": threshold,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Compares BLS-estimated transit duration against the geometrically-fitted "
            "duration from the batman model. Large disagreement suggests the fit "
            "converged to a different part of parameter space than the BLS peak. "
            f"BLS: {bls_dur*24:.2f} hr, Fit: {fit_dur*24:.2f} hr, "
            f"Relative difference: {rel_diff:.4f}. Threshold: <{threshold}."
        ),
    }


def _snr_test(bls_result: dict) -> dict:
    """Standard signal significance threshold."""
    snr = float(bls_result.get("snr", 0))
    threshold_pass = 10.0
    threshold_caution = 7.0
    severity = "pass" if snr >= threshold_pass else ("caution" if snr >= threshold_caution else "fail")
    return {
        "name": "Signal-to-Noise Ratio",
        "value": round(snr, 2),
        "threshold": threshold_pass,
        "severity": severity,
        "passed": severity == "pass",
        "explanation": (
            "Standard significance threshold for a credible transit detection. "
            "SNR > 10 is considered a robust detection in most TESS vetting frameworks; "
            "7–10 is marginal; below 7 is typically flagged for further review or discarded. "
            f"Detected SNR: {snr:.2f}."
        ),
    }


def _period_aliasing_test(bls_result: dict) -> dict:
    aliased = bls_result.get("period_aliasing_flag", False)
    severity = "fail" if aliased else "pass"
    explanation = (
        f"A significant signal was found at half the reported period "
        f"(P/2 = {bls_result.get('true_period_estimate', 0):.4f}d) with differing "
        f"odd/even eclipse depths — strong evidence the true period is half of what "
        f"was initially detected, and that this is an eclipsing binary rather than "
        f"a planet transit."
        if aliased else
        "No evidence of period aliasing — the detected period appears to be the true period."
    )
    return {
        "name": "Period Aliasing Check (P vs P/2)",
        "value": bls_result.get("true_period_estimate"),
        "threshold": None,
        "severity": severity,
        "passed": not aliased,
        "explanation": explanation,
    }


def _compute_overall_verdict(report: dict) -> dict:
    """
    Aggregates individual test severities into one categorical vetting verdict.
    This is NOT a second confidence score — it answers a different question
    than the classifier confidence (type vs. trustworthiness).
    """
    severities = [
        v["severity"] for k, v in report.items()
        if isinstance(v, dict) and "severity" in v and k != "overall"
    ]
    n_fail = severities.count("fail")
    n_caution = severities.count("caution")
    n_pass = severities.count("pass")

    # Treat period aliasing failure as a severe penalty that auto-triggers false positive
    if report.get("period_aliasing_test", {}).get("severity") == "fail":
        n_fail += 1

    if n_fail >= 2:
        verdict = "LIKELY_FALSE_POSITIVE"
    elif n_fail == 1 or n_caution >= 3:
        verdict = "REQUIRES_MANUAL_REVIEW"
    elif n_caution > 0:
        verdict = "PASSES_WITH_CAUTION"
    else:
        verdict = "PASSES_ALL_CHECKS"

    return {
        "verdict": verdict,
        "n_tests": len(severities),
        "n_pass": n_pass,
        "n_caution": n_caution,
        "n_fail": n_fail,
        "note": (
            "This is a vetting status, not a planet validation. "
            "Formal exoplanet validation requires additional follow-up observations "
            "(e.g., radial velocity confirmation, speckle imaging, centroid analysis) "
            "beyond what photometry alone can provide."
        ),
    }
