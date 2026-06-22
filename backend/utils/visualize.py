"""
utils/visualize.py
Generate 4-panel matplotlib report PNG for a pipeline result.
"""
import logging
import os
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "outputs")

# AstroDetect color palette (dark space theme)
COLORS = {
    "bg": "#0d1117",
    "bg2": "#161b22",
    "grid": "#21262d",
    "text": "#c9d1d9",
    "muted": "#8b949e",
    "accent": "#58a6ff",
    "planet": "#3fb950",
    "eb": "#f85149",
    "blend": "#e3b341",
    "other": "#8b949e",
    "raw": "#444c56",
    "flat": "#79c0ff",
    "model": "#ff7b72",
}

LABEL_COLORS = {
    "PLANET_TRANSIT": COLORS["planet"],
    "ECLIPSING_BINARY": COLORS["eb"],
    "BLEND": COLORS["blend"],
    "OTHER": COLORS["other"],
    "NO_SIGNAL": COLORS["muted"],
}


def plot_full_report(
    tic_id: str,
    sector: int,
    time_raw: np.ndarray,
    flux_raw: np.ndarray,
    time_flat: np.ndarray,
    flux_flat: np.ndarray,
    bls_result: dict,
    fit_result: dict,
    classification: dict,
    output_dir: Optional[str] = None,
) -> str:
    """
    Generate a 4-panel report figure and save to outputs/{tic_id}_s{sector}.png.
    Returns the absolute path to the saved PNG.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        from matplotlib.figure import Figure
        from matplotlib.backends.backend_agg import FigureCanvasAgg
        import matplotlib.gridspec as gridspec
        from matplotlib.patches import FancyBboxPatch
    except ImportError as e:
        raise ImportError("matplotlib is required: pip install matplotlib") from e

    from utils.preprocess import phase_fold, bin_phase_curve

    out_dir = output_dir or OUTPUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"TIC{tic_id}_s{sector}.png")

    label = classification.get("classification", "OTHER")
    confidence = classification.get("confidence", 0.0)
    label_color = LABEL_COLORS.get(label, COLORS["other"])

    period = bls_result.get("period", 1.0)
    t0 = bls_result.get("t0", float(time_flat[0]))
    duration = bls_result.get("duration", 0.1)
    depth = bls_result.get("depth", 0.001)

    # ── Figure setup ─────────────────────────────────────────────────────
    with matplotlib.rc_context({
        "figure.facecolor": COLORS["bg"],
        "axes.facecolor": COLORS["bg2"],
        "axes.edgecolor": COLORS["grid"],
        "axes.labelcolor": COLORS["text"],
        "xtick.color": COLORS["muted"],
        "ytick.color": COLORS["muted"],
        "text.color": COLORS["text"],
        "grid.color": COLORS["grid"],
        "grid.alpha": 0.5,
        "font.family": "monospace",
        "font.size": 9,
    }):
        fig = Figure(figsize=(16, 10), facecolor=COLORS["bg"])
        canvas = FigureCanvasAgg(fig)
        gs = gridspec.GridSpec(2, 2, hspace=0.42, wspace=0.32,
                               top=0.88, bottom=0.08, left=0.07, right=0.97)

        ax_raw  = fig.add_subplot(gs[0, 0])
        ax_flat = fig.add_subplot(gs[0, 1])
        ax_fold = fig.add_subplot(gs[1, 0])
        ax_bls  = fig.add_subplot(gs[1, 1])

    # ── Header ────────────────────────────────────────────────────────────
    fig.text(0.5, 0.95, f"AstroDetect  ·  TIC {tic_id}  ·  Sector {sector}",
             ha="center", va="center", fontsize=14, color=COLORS["accent"],
             fontweight="bold", fontfamily="monospace")
    fig.text(0.5, 0.915,
             f"Classification: {label}  ({confidence:.0%} confidence)   "
             f"P = {period:.4f} d   depth = {depth * 1e6:.0f} ppm   SNR = {bls_result.get('snr', 0):.1f}",
             ha="center", va="center", fontsize=9, color=label_color, fontfamily="monospace")

    # ── Panel 1: Raw light curve ──────────────────────────────────────────
    _style_ax(ax_raw, "Raw TESS Light Curve", "Time (BTJD)", "Flux (e⁻/s)")
    # Remove NaNs to prevent matplotlib from silently failing to render
    valid_raw = ~(np.isnan(time_raw) | np.isnan(flux_raw))
    t_r = time_raw[valid_raw]
    f_r = flux_raw[valid_raw]
    # Downsample for speed
    step = max(1, len(t_r) // 3000)
    ax_raw.scatter(t_r[::step], f_r[::step],
                   s=0.8, alpha=0.5, color=COLORS["raw"], rasterized=True)
    if len(t_r) > 0:
        ax_raw.set_xlim(t_r[0], t_r[-1])

    # ── Panel 2: Detrended light curve ───────────────────────────────────
    _style_ax(ax_flat, "Detrended Light Curve", "Time (BTJD)", "Relative Flux")
    step = max(1, len(time_flat) // 3000)
    ax_flat.scatter(time_flat[::step], flux_flat[::step],
                    s=0.8, alpha=0.6, color=COLORS["flat"], rasterized=True)
    ax_flat.set_xlim(time_flat[0], time_flat[-1])
    ax_flat.axhline(1.0, color=COLORS["muted"], lw=0.8, ls="--", alpha=0.5)

    # Mark transit times
    t_transits = np.arange(t0, time_flat[-1], period)
    for t in t_transits:
        if time_flat[0] <= t <= time_flat[-1]:
            ax_flat.axvline(t, color=label_color, lw=0.6, alpha=0.4)

    # ── Panel 3: Phase-folded + model overlay ─────────────────────────────
    _style_ax(ax_fold, "Phase-Folded Light Curve", "Orbital Phase", "Relative Flux")
    phase, flux_fold = phase_fold(time_flat, flux_flat, period, t0)

    # Bin
    window = min(4 * duration / period, 0.5)
    mask = np.abs(phase) < max(window, 0.1)
    ph_plot = phase[mask]
    fl_plot = flux_fold[mask]

    ax_fold.scatter(ph_plot, fl_plot, s=1.2, alpha=0.4,
                    color=COLORS["flat"], rasterized=True, label="Data")

    # Binned overlay
    try:
        bp, bf, be = bin_phase_curve(ph_plot, fl_plot, n_bins=60)
        ax_fold.errorbar(bp, bf, yerr=be, fmt="o", ms=3, color=COLORS["accent"],
                         ecolor=COLORS["muted"], elinewidth=0.8, label="Binned", zorder=5)
    except Exception:
        pass

    # Batman model overlay (if planet)
    if label == "PLANET_TRANSIT" and fit_result.get("converged", False):
        try:
            _plot_batman_model(ax_fold, ph_plot, fit_result, label_color)
        except Exception:
            pass

    ax_fold.axvline(0, color=label_color, lw=0.8, ls="--", alpha=0.6)
    ax_fold.legend(loc="upper right", fontsize=7, framealpha=0.3)

    # ── Panel 4: BLS Periodogram ──────────────────────────────────────────
    _style_ax(ax_bls, "BLS Periodogram", "Period (days)", "BLS Power (SNR)")
    period_grid = np.array(bls_result.get("period_grid", []))
    power_grid = np.array(bls_result.get("power_grid", []))

    if len(period_grid) > 0 and len(power_grid) > 0:
        ax_bls.plot(period_grid, power_grid, lw=0.7, color=COLORS["flat"],
                    alpha=0.8, rasterized=True)
        ax_bls.fill_between(period_grid, power_grid, alpha=0.15, color=COLORS["accent"])
        ax_bls.axvline(period, color=label_color, lw=1.5,
                       ls="-", label=f"Best: {period:.4f} d", zorder=5)
        # Harmonic markers
        for harmonic, ls in [(2, "--"), (3, ":")]:
            ax_bls.axvline(period * harmonic, color=COLORS["muted"],
                           lw=0.8, ls=ls, alpha=0.5, label=f"{harmonic}× P")
        ax_bls.legend(loc="upper right", fontsize=7, framealpha=0.3)
        ax_bls.set_xlim(period_grid[0], period_grid[-1])

    # ── Classification badge ──────────────────────────────────────────────
    badge_ax = fig.add_axes([0.87, 0.90, 0.12, 0.06])
    badge_ax.set_xlim(0, 1)
    badge_ax.set_ylim(0, 1)
    badge_ax.axis("off")
    badge_ax.add_patch(FancyBboxPatch((0.0, 0.0), 1.0, 1.0,
                                      boxstyle="round,pad=0.05",
                                      facecolor=label_color + "33",
                                      edgecolor=label_color, lw=1.5))
    badge_ax.text(0.5, 0.5, label.replace("_", " "),
                  ha="center", va="center", fontsize=7,
                  color=label_color, fontweight="bold")

    # ── Footer ────────────────────────────────────────────────────────────
    fig.text(0.07, 0.02,
             f"Rp/Rs = {fit_result.get('rp_rs', 0):.4f}   "
             f"a/Rs = {fit_result.get('a_rs', 0):.1f}   "
             f"χ²_red = {fit_result.get('chi2_red', 0):.2f}   "
             f"BAH 2026 — AstroDetect",
             fontsize=7, color=COLORS["muted"], fontfamily="monospace")

    fig.savefig(out_path, dpi=150, bbox_inches="tight",
                facecolor=COLORS["bg"], edgecolor="none")
    import matplotlib.pyplot as plt
    plt.close(fig)

    logger.info(f"Report saved → {out_path}")
    return out_path, label


def _style_ax(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, color=COLORS["accent"], fontsize=10, pad=6, fontfamily="monospace")
    ax.set_xlabel(xlabel, fontsize=8)
    ax.set_ylabel(ylabel, fontsize=8)
    ax.grid(True, alpha=0.3, lw=0.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def _plot_batman_model(ax, phase_arr: np.ndarray, fit_result: dict, color: str) -> None:
    import batman
    params = batman.TransitParams()
    params.t0 = 0.0
    params.per = 1.0
    params.rp = float(fit_result.get("rp_rs", 0.05))
    params.a = float(fit_result.get("a_rs", 10.0))
    params.inc = float(fit_result.get("inc", 89.0))
    params.ecc = 0.0
    params.w = 90.0
    params.u = [0.1, 0.3]
    params.limb_dark = "quadratic"

    phase_model = np.linspace(phase_arr.min(), phase_arr.max(), 500)
    m = batman.TransitModel(params, phase_model)
    lc_model = m.light_curve(params)

    ax.plot(phase_model, lc_model, color=color, lw=2.0,
            label="Batman model", zorder=10, alpha=0.9)
