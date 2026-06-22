# DeepTransit Architecture & Scientific Context

## Section 1: Overview
DeepTransit is an AI-powered exoplanet discovery pipeline designed to process TESS light curves using modern machine learning and astrophysical techniques.

## Section 2: Pipeline Modules
The system implements a five-stage architecture:
1. Ingest & Download
2. Detrend & Normalize
3. BLS Period Search
4. ML Classification
5. Batman Transit Fit

## Section 3: User Interface
The UI exposes individual target deep dives and batch processing capabilities. It relies heavily on visualizations (like Plotly and Orbit views) to provide interpretability for the detections.

## Section 4: Target Selection & Data Sources
To comply with the base requirements of the BAH 2026 challenge, we ingest the **TESS Candidate Target List (CTL)**. However, our primary scientific discovery validation layer and the source of our most promising candidates rely on robust external repositories. 

Specifically, DeepTransit employs a **Unified Target Selection System** that pulls from:
- **NASA Exoplanet Archive (via TAP API)**: Acts as the definitive ground truth for confirmed exoplanets and false positive dispositions. This allows us to validate the performance of the XGBoost classification model against historically confirmed signals.
- **TESS Objects of Interest (TOI) catalog**: Provided by the MIT TESS Science Office, enabling us to test our pipeline on pre-vetted targets.
- **TESS Candidate Target List (CTL)**: Forms the core dataset compliant with challenge rules, loaded natively through our target ingestion framework.

By combining these sources into a deduplicated registry, we ensure rigorous evaluation while expanding our target pool beyond standard limits. Targets are stamped with **provenance tags** that follow them throughout the pipeline and into the front-end dashboard, allowing astronomers to see exactly which catalog the target originated from and whether its known disposition matches AstroDetect's machine-driven classification.
