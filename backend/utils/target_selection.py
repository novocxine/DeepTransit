"""
Unified target selection system. Combines multiple legitimate TIC ID sources
into one deduplicated pool, with explicit per-target provenance tracking.

Sources:
  - "ctl"          : Official Exoplanet CTL (xCTL v08.01) — the challenge-required source
  - "toi"          : TESS Objects of Interest catalog (MIT TSO)
  - "exoplanet_archive" : NASA Exoplanet Archive (confirmed planets / false positives)
  - "manual"       : User-entered TIC ID, no catalog backing
"""

import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
from functools import lru_cache

from scripts.fetch_ctl_catalog import load_ctl_dataframe


@dataclass
class TargetRecord:
    tic_id: str
    sources: list
    ra: Optional[float] = None
    dec: Optional[float] = None
    tmag: Optional[float] = None
    known_label: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    @property
    def is_official_ctl(self) -> bool:
        return "ctl" in self.sources

    @property
    def provenance_display(self) -> str:
        """Human-readable provenance string for the UI badge."""
        labels = {
            "ctl": "Official CTL",
            "toi": "TESS TOI",
            "exoplanet_archive": "NASA Exoplanet Archive",
            "manual": "Manually specified",
        }
        return " + ".join(labels.get(s, s) for s in self.sources)


@lru_cache(maxsize=1)
def load_ctl_targets(n: int = None) -> list[TargetRecord]:
    """Loads targets from the official xCTL catalog."""
    df = load_ctl_dataframe()
    if n:
        df = df.sample(n=min(n, len(df)), random_state=42)

    records = []
    for _, row in df.iterrows():
        records.append(TargetRecord(
            tic_id=str(row.get("TIC_ID", row.get("TIC", ""))),
            sources=["ctl"],
            ra=row.get("ra"),
            dec=row.get("dec"),
            tmag=row.get("Tmag"),
        ))
    return records


@lru_cache(maxsize=3)
def load_exoplanet_archive_targets(table: str = "TOI", n: int = None) -> list[TargetRecord]:
    """
    Queries the NASA Exoplanet Archive's TAP (Table Access Protocol) service directly.
    """
    try:
        from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive
    except ImportError:
        import sys
        print("astroquery not installed. Run `pip install astroquery`.", file=sys.stderr)
        return []

    try:
        result_table = NasaExoplanetArchive.query_criteria(
            table=table,
            select="tid,ra,dec,tfopwg_disp",
        )
        df = result_table.to_pandas()
    except Exception as e:
        import sys
        print(f"NASA Exoplanet Archive query failed: {e}", file=sys.stderr)
        return []

    if n:
        df = df.sample(n=min(n, len(df)), random_state=42)

    records = []
    for _, row in df.iterrows():
        records.append(TargetRecord(
            tic_id=str(row.get("tid", "")),
            sources=["exoplanet_archive"],
            ra=row.get("ra"),
            dec=row.get("dec"),
            known_label=row.get("tfopwg_disp"),
            metadata={"archive_table": table},
        ))
    return records


def load_manual_target(tic_id: str) -> TargetRecord:
    """Wraps a user-entered TIC ID with no catalog backing into the common record shape."""
    return TargetRecord(tic_id=str(tic_id), sources=["manual"])


def get_combined_targets(
    include_sources: list = ["ctl", "exoplanet_archive"],
    n_per_source: int = 50,
    manual_tic_ids: list = None,
) -> list[TargetRecord]:
    """
    Combines requested sources, deduplicates by TIC ID, and appends any manually-specified IDs.
    """
    all_records = []

    if "ctl" in include_sources:
        all_records.extend(load_ctl_targets(n=n_per_source))
    if "exoplanet_archive" in include_sources or "toi" in include_sources:
        all_records.extend(load_exoplanet_archive_targets(table="TOI", n=n_per_source))

    if manual_tic_ids:
        all_records.extend([load_manual_target(tid) for tid in manual_tic_ids])

    # Deduplicate by TIC ID, merging source lists for targets present in multiple catalogs
    merged = {}
    for record in all_records:
        if record.tic_id in merged:
            existing = merged[record.tic_id]
            existing.sources = list(set(existing.sources + record.sources))
            existing.known_label = existing.known_label or record.known_label
            existing.ra = existing.ra or record.ra
            existing.dec = existing.dec or record.dec
        else:
            merged[record.tic_id] = record

    return list(merged.values())


def get_target_provenance(tic_id: str) -> TargetRecord:
    """
    Looks up provenance for a single TIC ID by checking it against all known sources.
    Uses LRU-cached loader functions.
    """
    ctl_match = next((r for r in load_ctl_targets() if r.tic_id == str(tic_id)), None)
    archive_match = next((r for r in load_exoplanet_archive_targets(table="TOI")
                          if r.tic_id == str(tic_id)), None)

    if ctl_match and archive_match:
        ctl_match.sources = list(set(ctl_match.sources + archive_match.sources))
        ctl_match.known_label = archive_match.known_label
        return ctl_match
    elif ctl_match:
        return ctl_match
    elif archive_match:
        return archive_match
    else:
        return load_manual_target(tic_id)
