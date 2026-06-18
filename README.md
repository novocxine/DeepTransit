# AstroDetect  AI: Automated Exoplanet Detection & Classification Pipeline

An end-to-end, AI-driven data analysis pipeline designed to detect and classify extremely faint exoplanet transit signals from noisy astronomical time-series data (TESS). ExoLens handles severe noise contaminations, such as stellar blending, instrumental artifacts, and intrinsic stellar variability, to accurately isolate true exoplanets from false positives.

---

## 🌌 Key Features
- **Statistical Signal Sifting:** Leverages the Box Least Squares (BLS) algorithm to rapidly identify periodic dips and estimate initial orbital periods and SNR.
- **Deep Learning Classification:** Implements a Multi-Branch 1D Convolutional Neural Network (CNN) to categorize signals into **Transits**, **Eclipsing Binaries (Eclipses)**, **Stellar Blends**, or **Noise**.
- **Physical Parameter Estimation:** Combines analytical transit modeling (`batman`) with optimization algorithms to precisely extract orbital period, transit depth, and transit duration.
- **Uncertainty Quantification:** Computes statistical confidence levels for both the classification and the fitted physical parameters.

---

## 🏗️ Pipeline Architecture

The pipeline processes raw astronomical light curves through a three-stage framework:

