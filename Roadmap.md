## Stage 1: The Detection & Period-Finding Model (Signal Sifting)

Before classifying anything, you must find out if a light curve actually has a periodic dip.

- **What to use:** **Box Least Squares (BLS) Algorithm** (from the `astropy` or `cuBLS` library).
    
- **Why:** Do not waste AI compute power scanning flat, noisy light curves. BLS is a classical, highly optimized statistical tool that slides a square-shaped dip across the data to find periodic signals.
    
- **Hackathon Output:** It will instantly give you the **Orbital Period**, the **Signal-to-Noise Ratio (SNR)** (satisfying one of your criteria), and allow you to **phase-fold** the data (stacking the orbits on top of each other to drastically reduce noise).
    

## Stage 2: The Classification Model (Transit vs. Eclipse vs. Blend)

Once you have the phase-folded, localized dip, you need an AI model to classify it into one of the requested categories: _Transit, Eclipsing Binary (Eclipse), Blend, or Noise/Other_.

You have two strong options here depending on your team's expertise:

### Option A: 1D Convolutional Neural Network (CNN) — _Highly Recommended_

- **The Model:** A 1D CNN (built using TensorFlow/Keras or PyTorch) modeled after NASA’s **ExoMiner** or **ExoNet**.
    
- **Input:** Two vectors (inputs) fed into a multi-branch network:
    
    1. A "global" view of the whole phase-folded light curve (to see the overall shape and secondary eclipses).
        
    2. A "local" zoomed-in view of just the dip (to see fine details of the ingress/egress).
        
- **Why it fits:** 1D CNNs are incredibly fast to train during a hackathon and excel at recognizing the _geometric shapes_ of dips.
    
    - **Eclipsing Binaries** usually have V-shaped or alternating deep/shallow dips.
        
    - **Exoplanet Transits** have distinct U-shaped dips.
        
    - **Blends** often have incredibly shallow, warped shapes.
        

### Option B: Feature Extraction + LightGBM / XGBoost — _Fastest to Build_

- **The Model:** Instead of raw data, use a Python library like `feets` or standard numpy to extract specific features from the dip (e.g., skewness, amplitude, slope of the walls, secondary dip depth). Pass these tabular features into an **XGBoost** or **LightGBM** classifier.
    
- **Why it fits:** It requires significantly less training time than a neural network and handles data imbalance incredibly well.
    

## Stage 3: The Parameter Estimation Model (Light Curve Fitting)

The prompt specifically requires you to estimate **Transit Duration** and **Transit Depth** for verified transit signals. Neural networks are generally poor at estimating these precisely out-of-the-box in a noisy environment.

- **What to use:** **`batman` (Bad-Ass Transit Model cAlculatioN)** combined with **`emcee` (Markov Chain Monte Carlo)** or **`scipy.optimize.curve_fit`**.
    
- **Why:** `batman` is a standard Python library that generates a mathematically perfect exoplanet transit curve based on physical parameters (radius ratio, semi-major axis, etc.). By using a fitting algorithm (`scipy` for speed, `emcee` for calculating strict uncertainties/confidence levels), you adjust the math model until it perfectly overlays your noisy data.
    
- **Hackathon Output:** This gives you exact, scientifically valid measurements for **Transit Depth** and **Duration**, plus the mathematical "Confidence Level" required by your evaluation criteria.****


## Summary of the Ideal Hackathon Pipeline

```
[Raw TESS Light Curve] 
          │
          ▼
    [BLS Algorithm] ───────► Extracts: Orbital Period & SNR
          │
          ▼
   [Phase-Folding] (Cleans up the noise)
          │
          ▼
     [1D CNN] ─────────────► Classifies: Transit, Eclipse, Blend, or Noise
          │
     (If Transit)
          │
          ▼
 [`batman` + Curve Fit] ───► Extracts: Depth, Duration, and Confidence Intervals
```

### Recommended Python Stack to use:

- `lightkurve`: Essential for downloading, cleaning, and flattening TESS data easily.
    
- `astropy`: For the BLS periodograms.
    
- `tensorflow` or `pytorch`: For building the 1D CNN classifier.
    
- `batman-package`: For analytical transit modeling.
    
- `matplotlib`: For the required visualizations of the light curves overlayed with your model's predictions.