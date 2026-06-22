"""
utils/classify.py
XGBoost + rule-based fallback classifier for transit signal classification.
Labels: PLANET_TRANSIT, ECLIPSING_BINARY, BLEND, OTHER, NO_SIGNAL
"""
import logging
import os
import pickle
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

LABELS = ["PLANET_TRANSIT", "ECLIPSING_BINARY", "BLEND", "OTHER", "NO_SIGNAL"]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "xgb_classifier.pkl")


def extract_features(bls_result: dict, time: np.ndarray, flux: np.ndarray) -> np.ndarray:
    """
    Extract 15 diagnostic features from BLS result for classification.
    """
    period = bls_result.get("period", 1.0)
    depth = bls_result.get("depth", 0.0)
    duration = bls_result.get("duration", 0.1)
    snr = bls_result.get("snr", 0.0)
    odd_even_ratio = bls_result.get("odd_even_ratio", 0.0)
    secondary_depth = bls_result.get("secondary_depth", 0.0)
    n_transits = bls_result.get("n_transits", 1)
    power_peak = bls_result.get("power_peak", 0.0)

    # Derived features
    depth_ppm = depth * 1e6
    duty_cycle = duration / period if period > 0 else 0
    sec_primary_ratio = secondary_depth / depth if depth > 0 else 0
    log_period = np.log10(max(period, 0.1))
    log_snr = np.log10(max(snr, 0.1))
    rp_rs_approx = np.sqrt(max(depth, 0)) if depth > 0 else 0

    # Light curve statistics
    lc_std = float(np.nanstd(flux))
    lc_skew = float(_skewness(flux))

    features = np.array([
        depth_ppm,             # 1. Transit depth in ppm
        snr,                   # 2. Signal-to-noise ratio
        period,                # 3. Orbital period (days)
        log_period,            # 4. log10 period
        log_snr,               # 5. log10 SNR
        duration * 24,         # 6. Duration in hours
        duty_cycle,            # 7. Duration/period ratio
        odd_even_ratio,        # 8. Odd-even depth asymmetry
        secondary_depth * 1e6, # 9. Secondary eclipse depth (ppm)
        sec_primary_ratio,     # 10. Secondary/primary depth ratio
        n_transits,            # 11. Number of observed transits
        power_peak,            # 12. BLS peak power
        rp_rs_approx,          # 13. Rp/Rs approximation
        lc_std,                # 14. Light curve scatter
        lc_skew,               # 15. Light curve skewness
    ], dtype=np.float64)

    # Replace any NaN/inf with 0
    features = np.where(np.isfinite(features), features, 0.0)
    return features


def classify_signal(
    bls_result: dict,
    time: np.ndarray,
    flux: np.ndarray,
    model_path: Optional[str] = None,
) -> dict:
    """
    Classify transit signal using XGBoost model if available,
    otherwise use rule-based classifier.

    Returns dict with:
        classification, confidence, class_probabilities
    """
    features = extract_features(bls_result, time, flux)
    duration_ratio = bls_result.get("duration", 0) / max(bls_result.get("period", 1), 1e-10)

    # HARD PHYSICAL PLAUSIBILITY GATE
    # A transit occupying more than ~20% of the orbital period is not
    # consistent with planet-transit geometry for any realistic star+planet
    # size combination. This is a near-deterministic disqualifier.
    if duration_ratio > 0.20:
        label = "ECLIPSING_BINARY"
        confidence = min(0.70 + (duration_ratio - 0.20), 0.97)  # scales with how extreme the violation is
        probs = {
            "PLANET_TRANSIT": max(0.02, 1 - confidence - 0.08),
            "ECLIPSING_BINARY": confidence,
            "BLEND": 0.05,
            "OTHER": 0.03,
            "NO_SIGNAL": 0.0,
        }
        logger.info(f"HARD OVERRIDE: Duration ratio {duration_ratio:.3f} > 0.20 -> ECLIPSING_BINARY")
        return {
            "classification": label,
            "confidence": confidence,
            "class_probabilities": probs,
            "method": "rules (override)",
        }

    # HARD OVERRIDE: if period aliasing was detected, this is not a planet
    # regardless of what the primary classifier scores show.
    if bls_result.get("period_aliasing_flag", False):
        label = "ECLIPSING_BINARY"
        confidence = 0.85  # high but not artificially 99% — aliasing detection itself has some uncertainty
        probs = {
            "PLANET_TRANSIT": 0.05,
            "ECLIPSING_BINARY": 0.85,
            "BLEND": 0.07,
            "OTHER": 0.03,
            "NO_SIGNAL": 0.0,
        }
        logger.info(f"HARD OVERRIDE: Period aliasing detected -> ECLIPSING_BINARY")
        return {
            "classification": label,
            "confidence": confidence,
            "class_probabilities": probs,
            "method": "rules (override)",
        }

    # Try loading XGBoost model
    mp = model_path or MODEL_PATH
    model = _load_model(mp)

    if model is not None:
        try:
            probs = model.predict_proba(features.reshape(1, -1))[0]
            label_idx = int(np.argmax(probs))
            label = model.classes_[label_idx] if hasattr(model, "classes_") else LABELS[label_idx]
            confidence = float(probs[label_idx])

            class_probs = {}
            for i, lbl in enumerate(model.classes_ if hasattr(model, "classes_") else LABELS[:len(probs)]):
                class_probs[lbl] = round(float(probs[i]), 4)

            logger.info(f"XGBoost classification: {label} ({confidence:.2%})")
            return {
                "classification": label,
                "confidence": round(confidence, 4),
                "class_probabilities": class_probs,
                "method": "xgboost",
            }
        except Exception as e:
            logger.warning(f"XGBoost inference failed: {e}. Falling back to rules.")

    # Rule-based fallback
    return _rule_based_classify(bls_result, features)


def _rule_based_classify(bls_result: dict, features: np.ndarray) -> dict:
    """
    Deterministic rule-based classifier using BLS diagnostics.
    Based on established astrophysical heuristics from the literature.
    """
    snr = bls_result.get("snr", 0.0)
    depth = bls_result.get("depth", 0.0)
    odd_even_ratio = bls_result.get("odd_even_ratio", 0.0)
    secondary_depth = bls_result.get("secondary_depth", 0.0)
    period = bls_result.get("period", 1.0)
    duration = bls_result.get("duration", 0.1)

    depth_ppm = depth * 1e6
    sec_primary_ratio = secondary_depth / depth if depth > 0 else 0
    duty_cycle = duration / period

    # ─── NO SIGNAL ──────────────────────────────────────────────────────
    if snr < 5.0:
        probs = {"PLANET_TRANSIT": 0.02, "ECLIPSING_BINARY": 0.02,
                 "BLEND": 0.04, "OTHER": 0.07, "NO_SIGNAL": 0.85}
        return _format_result("NO_SIGNAL", probs, "rules")

    # ─── ECLIPSING BINARY ────────────────────────────────────────────────
    # Deep primary + odd/even asymmetry + secondary eclipse
    rp_rs_approx = float(features[12]) if len(features) > 12 else np.sqrt(max(depth, 0))

    def _depth_score_eb(d_ppm: float, rp_rs: float = None, stellar_radius_rsun: float = 1.0) -> float:
        """
        EB suspicion score based on transit depth, cross-checked against the
        fitted Rp/Rs ratio (when available) to avoid penalizing genuinely large
        but physically plausible planets (e.g., Hot/Warm Jupiters).
        """
        JUPITER_RADIUS_RSUN = 0.10049

        if rp_rs is not None and rp_rs > 0:
            implied_radius_rsun = rp_rs * stellar_radius_rsun
            implied_radius_rjup = implied_radius_rsun / JUPITER_RADIUS_RSUN

            if implied_radius_rjup < 2.5:
                # Fully consistent with known planet population
                return 0.0
            elif implied_radius_rjup < 4.0:
                # Larger than any confirmed planet, mild caution
                return 1.0 * (implied_radius_rjup - 2.5) / 1.5
            else:
                # Approaching brown-dwarf/stellar radius territory
                return min(1.0 + 2.5 * (implied_radius_rjup - 4.0) / 4.0, 3.5)

        # Fallback (no fit available):
        if d_ppm < 2000:
            return 0.0
        elif d_ppm < 10000:
            return 0.5 * (d_ppm - 2000) / 8000
        else:
            return 1.5

    eb_score = _depth_score_eb(depth_ppm, rp_rs_approx, 1.0)
    logger.debug(f"eb_score after depth={eb_score}, rp_rs_approx={rp_rs_approx}, depth_ppm={depth_ppm}")
    if odd_even_ratio > 0.20:
        eb_score += 0.30
        logger.debug(f"eb_score after odd_even={eb_score}")
    if sec_primary_ratio > 0.05:
        eb_score += 0.20
        logger.debug(f"eb_score after sec_primary={eb_score}")
    def _duration_ratio_score_eb(ratio: float) -> float:
        """
        Continuous EB suspicion score based on duration/period ratio.
        Real planet transits: typically 0.01–0.08
        Grazing/close EBs: routinely 0.15–0.45+
        """
        if ratio < 0.08:
            return 0.0
        elif ratio < 0.15:
            return 1.5 * (ratio - 0.08) / 0.07
        else:
            excess = min(ratio - 0.15, 0.35)
            return 1.5 + 4.0 * (excess / 0.35)

    duration_score = _duration_ratio_score_eb(duty_cycle)
    eb_score += duration_score
    logger.debug(f"eb_score after duration={eb_score} (duration_score={duration_score})")

    if eb_score >= 0.50:
        eb_conf = min(0.97, 0.50 + eb_score * 0.5)
        pt_conf = (1 - eb_conf) * 0.3
        bl_conf = (1 - eb_conf) * 0.4
        ot_conf = (1 - eb_conf) * 0.2
        ns_conf = (1 - eb_conf) * 0.1
        probs = {"PLANET_TRANSIT": round(pt_conf, 4), "ECLIPSING_BINARY": round(eb_conf, 4),
                 "BLEND": round(bl_conf, 4), "OTHER": round(ot_conf, 4), "NO_SIGNAL": round(ns_conf, 4)}
        return _format_result("ECLIPSING_BINARY", probs, "rules")

    # ─── BLEND ──────────────────────────────────────────────────────────
    # Very shallow depth AND low SNR AND some secondary
    blend_score = 0.0
    if depth_ppm < 1000 and snr < 12:
        blend_score += 0.35
    if sec_primary_ratio > 0.03:
        blend_score += 0.20
    if depth_ppm < 500:
        blend_score += 0.20

    if blend_score >= 0.45:
        bl_conf = min(0.88, 0.45 + blend_score * 0.5)
        pt_conf = (1 - bl_conf) * 0.35
        eb_conf = (1 - bl_conf) * 0.25
        ot_conf = (1 - bl_conf) * 0.30
        ns_conf = (1 - bl_conf) * 0.10
        probs = {"PLANET_TRANSIT": round(pt_conf, 4), "ECLIPSING_BINARY": round(eb_conf, 4),
                 "BLEND": round(bl_conf, 4), "OTHER": round(ot_conf, 4), "NO_SIGNAL": round(ns_conf, 4)}
        return _format_result("BLEND", probs, "rules")

    # ─── PLANET TRANSIT ─────────────────────────────────────────────────
    pt_score = 0.0
    if snr >= 7:
        pt_score += 0.30
    if 100 <= depth_ppm <= 30000:
        pt_score += 0.25
    if odd_even_ratio < 0.10:
        pt_score += 0.20
    if sec_primary_ratio < 0.03:
        pt_score += 0.15
    if duty_cycle < 0.12:
        pt_score += 0.10

    if pt_score >= 0.40:
        pt_conf = min(0.96, 0.50 + pt_score * 0.5)
        eb_conf = (1 - pt_conf) * 0.15
        bl_conf = (1 - pt_conf) * 0.20
        ot_conf = (1 - pt_conf) * 0.50
        ns_conf = (1 - pt_conf) * 0.15
        probs = {"PLANET_TRANSIT": round(pt_conf, 4), "ECLIPSING_BINARY": round(eb_conf, 4),
                 "BLEND": round(bl_conf, 4), "OTHER": round(ot_conf, 4), "NO_SIGNAL": round(ns_conf, 4)}
        return _format_result("PLANET_TRANSIT", probs, "rules")

    # ─── OTHER ──────────────────────────────────────────────────────────
    probs = {"PLANET_TRANSIT": 0.15, "ECLIPSING_BINARY": 0.10,
             "BLEND": 0.10, "OTHER": 0.60, "NO_SIGNAL": 0.05}
    return _format_result("OTHER", probs, "rules")


def _format_result(label: str, probs: dict, method: str) -> dict:
    return {
        "classification": label,
        "confidence": round(probs[label], 4),
        "class_probabilities": probs,
        "method": method,
    }


def _load_model(path: str):
    """Load XGBoost model from pickle. Returns None if not found."""
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            logger.info(f"No XGBoost model at {abs_path}. Using rule-based classifier.")
            return None
        with open(abs_path, "rb") as f:
            model = pickle.load(f)
        logger.info(f"Loaded XGBoost model from {abs_path}")
        return model
    except Exception as e:
        logger.warning(f"Failed to load model: {e}")
        return None


def _skewness(x: np.ndarray) -> float:
    """Compute sample skewness."""
    x = x[np.isfinite(x)]
    if len(x) < 3:
        return 0.0
    mean = np.mean(x)
    std = np.std(x)
    if std == 0:
        return 0.0
    return float(np.mean(((x - mean) / std) ** 3))
