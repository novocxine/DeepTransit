"""
utils/ingest.py
Downloads TESS light curves from MAST via lightkurve.
"""
import logging
import numpy as np
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def download_lightcurve(
    tic_id: str,
    sector: Optional[int] = None,
    author: str = "SPOC",
    exptime: int = 120,
) -> dict:
    """
    Download a TESS light curve for the given TIC ID.

    Returns a dict with keys:
        time (np.ndarray), flux (np.ndarray), flux_err (np.ndarray),
        sector (int), mission (str), author (str)

    Raises ValueError if the star is not found in the TESS archive.
    """
    try:
        import lightkurve as lk
    except ImportError as e:
        raise ImportError("lightkurve is required: pip install lightkurve") from e

    tic_str = f"TIC {tic_id}"
    logger.info(f"Searching MAST for {tic_str}, sector={sector}, author={author}")

    search_kwargs: dict = dict(mission="TESS", author=author, exptime=exptime)
    if sector is not None:
        search_kwargs["sector"] = sector

    results = lk.search_lightcurve(tic_str, **search_kwargs)

    if len(results) == 0:
        # Fallback: try any author / exposure time
        logger.warning(f"No {author} data found for {tic_str}. Trying any author...")
        results = lk.search_lightcurve(tic_str, mission="TESS")
        if len(results) == 0:
            raise ValueError(
                f"TIC {tic_id} not found in the TESS archive. "
                "Check the TIC ID or try a different sector."
            )

    # Pick the first (or sector-matched) result
    target = results[0]
    
    # Safely get mission/sector string for logging
    mission_str = target.mission[0] if hasattr(target, "mission") else "Unknown"
    if hasattr(target, "sector") and target.sector is not None and len(target.sector) > 0:
        sector_str = f"sector {target.sector[0]}"
    elif hasattr(target, "sequence_number") and target.sequence_number is not None and len(target.sequence_number) > 0:
        sector_str = f"sector {target.sequence_number[0]}"
    else:
        sector_str = ""
        
    logger.info(f"Downloading: {mission_str} {sector_str}".strip())

    lc_collection = target.download()
    if lc_collection is None:
        raise ValueError(f"Download failed for TIC {tic_id}")

    # Normalise: work with a single LightCurve object
    lc = lc_collection

    # Remove NaNs / infs
    lc = lc.remove_nans().remove_outliers(sigma=5)

    time = np.array(lc.time.value, dtype=np.float64)
    flux = np.array(lc.flux.value, dtype=np.float64)

    if hasattr(lc, "flux_err") and lc.flux_err is not None:
        flux_err = np.array(lc.flux_err.value, dtype=np.float64)
        # Replace NaN errors with median error
        median_err = float(np.nanmedian(flux_err))
        flux_err = np.where(np.isnan(flux_err), median_err, flux_err)
    else:
        # Estimate from scatter
        flux_err = np.full_like(flux, float(np.nanstd(flux)) * 0.1)

    if hasattr(target, "sector") and target.sector is not None and len(target.sector) > 0:
        actual_sector = int(target.sector[0])
    elif hasattr(target, "sequence_number") and target.sequence_number is not None and len(target.sequence_number) > 0:
        try:
            actual_sector = int(target.sequence_number[0])
        except (ValueError, TypeError):
            actual_sector = sector or 0
    else:
        actual_sector = sector or 0

    logger.info(
        f"Downloaded {len(time)} cadences for TIC {tic_id} "
        f"sector {actual_sector}"
    )

    return {
        "time": time,
        "flux": flux,
        "flux_err": flux_err,
        "sector": actual_sector,
        "mission": "TESS",
        "author": str(target.author[0]) if hasattr(target, "author") else author,
        "n_cadences": len(time),
    }
