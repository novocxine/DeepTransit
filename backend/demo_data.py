"""
demo_data.py
Hardcoded pre-computed results for 3 TESS demo stars.
Includes synthetic light curve arrays for instant Plotly rendering.
"""
import numpy as np

# ── Reproducible synthetic light curve generator ──────────────────────────────

def _make_transit_lc(
    n: int, period: float, depth: float, duration: float,
    t0_offset: float = 0.0, noise_level: float = 0.0003,
    rng_seed: int = 42,
) -> tuple:
    """Generate synthetic TESS-like light curve with injected transits."""
    rng = np.random.default_rng(rng_seed)
    time = np.linspace(0, 27, n)  # 27-day TESS sector

    # Smooth stellar trend
    flux = (1.0
            + 0.0008 * np.sin(2 * np.pi * time / 13.5 + 0.5)
            + 0.0003 * np.cos(2 * np.pi * time / 4.2))

    # Inject transits
    t_transits = np.arange(t0_offset, 27, period)
    for t_c in t_transits:
        dt = time - t_c
        in_t = np.abs(dt) < duration / 2
        if in_t.any():
            # Smooth U-shape using cosine
            flux[in_t] -= depth * (1 - np.cos(np.pi * dt[in_t] / (duration / 2))) / 2

    # Add Gaussian noise
    flux += rng.normal(0, noise_level, n)
    flux_err = np.full(n, noise_level)

    return time.tolist(), flux.tolist(), flux_err.tolist()


def _make_eb_lc(
    n: int, period: float, depth_primary: float, depth_secondary: float,
    noise_level: float = 0.002, rng_seed: int = 7,
) -> tuple:
    rng = np.random.default_rng(rng_seed)
    time = np.linspace(0, 27, n)
    flux = np.ones(n)

    for t_c in np.arange(1.0, 27, period):
        dt = time - t_c
        in_p = np.abs(dt) < period * 0.08
        if in_p.any():
            flux[in_p] -= depth_primary * (1 - np.cos(np.pi * dt[in_p] / (period * 0.08))) / 2

    for t_c in np.arange(1.0 + period / 2, 27, period):
        dt = time - t_c
        in_s = np.abs(dt) < period * 0.07
        if in_s.any():
            flux[in_s] -= depth_secondary * (1 - np.cos(np.pi * dt[in_s] / (period * 0.07))) / 2

    flux += rng.normal(0, noise_level, n)
    flux_err = np.full(n, noise_level)
    return time.tolist(), flux.tolist(), flux_err.tolist()


# ── Pre-generate light curves ─────────────────────────────────────────────────
_N = 2000  # cadence points (~13.5 min cadence × 2000 = 27 days)

_lc_261136679 = _make_transit_lc(_N, period=3.485, depth=0.00142, duration=0.0821,
                                   t0_offset=1.325, noise_level=0.00028, rng_seed=42)
_lc_219114641 = _make_eb_lc(_N, period=1.744, depth_primary=0.0185, depth_secondary=0.012,
                              noise_level=0.0018, rng_seed=7)
_lc_38846515  = _make_transit_lc(_N, period=7.221, depth=0.00038, duration=0.11,
                                   t0_offset=2.1, noise_level=0.00035, rng_seed=99)

# ── BLS period grids ──────────────────────────────────────────────────────────
_period_grid = np.linspace(0.5, 27, 500).tolist()

def _gaussian_peak(grid, center, height, width=0.05):
    arr = np.array(grid)
    return (height * np.exp(-((arr - center) ** 2) / (2 * width ** 2))).tolist()

_bls_power_261 = _gaussian_peak(_period_grid, 3.485, 23.4, 0.08)
_bls_power_219 = _gaussian_peak(_period_grid, 1.744, 41.2, 0.06)
_bls_power_385 = _gaussian_peak(_period_grid, 7.221, 9.7, 0.15)


# ── Demo result objects ───────────────────────────────────────────────────────
DEMO_RESULTS = {
    "261136679": {
        "tic_id": "261136679",
        "sector": 1,
        "classification": "PLANET_TRANSIT",
        "confidence": 0.94,
        "class_probabilities": {
            "PLANET_TRANSIT": 0.94,
            "ECLIPSING_BINARY": 0.03,
            "BLEND": 0.02,
            "OTHER": 0.01,
            "NO_SIGNAL": 0.00,
        },
        "bls": {
            "period": 3.4852,
            "duration": 0.0821,
            "t0": 1325.312,
            "depth": 0.00142,
            "depth_err": 0.00006,
            "snr": 23.4,
            "odd_even_ratio": 0.04,
            "secondary_depth": 0.000012,
            "power_peak": 23.4,
            "period_grid": _period_grid,
            "power_grid": _bls_power_261,
            "n_transits": 7,
        },
        "fit": {
            "period": 3.4852,
            "period_err": 0.0035,
            "t0": 1325.312,
            "t0_err": 0.001,
            "depth": 0.00141,
            "depth_err": 0.00008,
            "duration": 0.0819,
            "duration_err": 0.004,
            "rp_rs": 0.03762,
            "rp_rs_err": 0.00089,
            "a_rs": 12.4,
            "a_rs_err": 0.8,
            "inc": 88.7,
            "inc_err": 0.4,
            "chi2_red": 1.12,
            "fit_quality": "good",
            "converged": True,
        },
        "lightcurve": {
            "time": _lc_261136679[0],
            "flux": _lc_261136679[1],
            "flux_err": _lc_261136679[2],
        },
        "notes": "Hot Jupiter candidate — deep, box-shaped transit, low odd-even ratio",
        "description": "TIC 261136679 shows a periodic transit signal consistent with a hot Jupiter. The BLS algorithm detected a strong peak at P = 3.49 days with SNR = 23.4. The batman transit model fits excellently (χ²_red = 1.12). No significant secondary eclipse or odd-even depth asymmetry detected.",
    },
    "219114641": {
        "tic_id": "219114641",
        "sector": 1,
        "classification": "ECLIPSING_BINARY",
        "confidence": 0.91,
        "class_probabilities": {
            "PLANET_TRANSIT": 0.04,
            "ECLIPSING_BINARY": 0.91,
            "BLEND": 0.03,
            "OTHER": 0.02,
            "NO_SIGNAL": 0.00,
        },
        "bls": {
            "period": 1.7440,
            "duration": 0.1390,
            "t0": 1324.871,
            "depth": 0.01850,
            "depth_err": 0.00045,
            "snr": 41.2,
            "odd_even_ratio": 0.38,
            "secondary_depth": 0.0122,
            "power_peak": 41.2,
            "period_grid": _period_grid,
            "power_grid": _bls_power_219,
            "n_transits": 15,
        },
        "fit": {
            "period": 1.7440,
            "period_err": 0.0012,
            "t0": 1324.871,
            "t0_err": 0.0005,
            "depth": 0.01850,
            "depth_err": 0.00050,
            "duration": 0.1390,
            "duration_err": 0.008,
            "rp_rs": 0.13601,
            "rp_rs_err": 0.00185,
            "a_rs": 4.2,
            "a_rs_err": 0.3,
            "inc": 87.2,
            "inc_err": 0.8,
            "chi2_red": 3.21,
            "fit_quality": "fair",
            "converged": True,
        },
        "lightcurve": {
            "time": _lc_219114641[0],
            "flux": _lc_219114641[1],
            "flux_err": _lc_219114641[2],
        },
        "notes": "Eclipsing binary — deep primary (1.85%), large secondary (1.22%), high odd-even ratio",
        "description": "TIC 219114641 is flagged as an eclipsing binary system. The BLS analysis reveals an exceptionally deep primary eclipse (18,500 ppm) and a prominent secondary eclipse at phase 0.5 (12,200 ppm). The high odd-even ratio of 0.38 is a strong indicator of two stellar companions at similar brightness temperatures.",
    },
    "38846515": {
        "tic_id": "38846515",
        "sector": 1,
        "classification": "BLEND",
        "confidence": 0.78,
        "class_probabilities": {
            "PLANET_TRANSIT": 0.12,
            "ECLIPSING_BINARY": 0.08,
            "BLEND": 0.78,
            "OTHER": 0.02,
            "NO_SIGNAL": 0.00,
        },
        "bls": {
            "period": 7.2210,
            "duration": 0.1100,
            "t0": 1326.455,
            "depth": 0.000380,
            "depth_err": 0.000042,
            "snr": 9.7,
            "odd_even_ratio": 0.11,
            "secondary_depth": 0.000022,
            "power_peak": 9.7,
            "period_grid": _period_grid,
            "power_grid": _bls_power_385,
            "n_transits": 3,
        },
        "fit": {
            "period": 7.2210,
            "period_err": 0.0150,
            "t0": 1326.455,
            "t0_err": 0.003,
            "depth": 0.000380,
            "depth_err": 0.000045,
            "duration": 0.1100,
            "duration_err": 0.012,
            "rp_rs": 0.01949,
            "rp_rs_err": 0.00115,
            "a_rs": 18.7,
            "a_rs_err": 2.1,
            "inc": 89.4,
            "inc_err": 0.5,
            "chi2_red": 2.84,
            "fit_quality": "fair",
            "converged": False,
        },
        "lightcurve": {
            "time": _lc_38846515[0],
            "flux": _lc_38846515[1],
            "flux_err": _lc_38846515[2],
        },
        "notes": "Diluted EB blend — very shallow depth, marginal SNR, possible background binary",
        "description": "TIC 38846515 shows a very shallow periodic signal (380 ppm, SNR = 9.7) that is consistent with a background eclipsing binary diluted by the target star's light. The signal depth is too shallow for a typical planetary transit and the centroid analysis suggests contamination from a nearby source within the TESS pixel. Follow-up imaging recommended.",
    },
}


def get_demo_result(tic_id: str) -> dict | None:
    return DEMO_RESULTS.get(str(tic_id))


def get_all_demo_results() -> list[dict]:
    return [
        {k: v for k, v in r.items() if k != "lightcurve"}
        for r in DEMO_RESULTS.values()
    ]
