The exploration of space through telescopes like Kepler, TESS, and the Ariel space mission has generated massive amounts of photometric data. Traditionally, astronomers rely on **transit photometry**—monitoring a star’s brightness over time to look for a periodic "dip" caused by a planet crossing in front of it.

However, raw astronomical data is rarely clean. It is heavily corrupted by instrumental systematics, spacecraft jitter, photon (Poisson) noise, and intrinsic stellar variability (like starspots and flares). Identifying a faint, sub-percent dip from a small Earth-sized planet in this "noisy" data is a classic needle-in-a-haystack problem.

Artificial Intelligence—specifically Deep Learning—has revolutionized this process, automating data triage and discovering planets that traditional algorithms missed completely.

## 1. The Challenge of "Noisy" Light Curves

Before AI can classify a light curve, astronomers must contend with several confounding noise sources that obscure the true transit signal:

- **Stellar Noise (Activity):** Starspots can mimic or mask transit depths. If a planet crosses over a dark starspot, it can warp the expected U-shaped transit curve.
    
- **Systematic/Instrumental Artifacts:** Spacecraft adjustments, temperature fluctuations, and pixel-level sensor degradation create artificial trends.
    
- **Aperiodic Signals:** Interactions between multiple planets in a single system can warp the periodicity of transits, rendering standard matched-filter or Box Least Squares (BLS) algorithms ineffective.
    

## 2. Advanced Preprocessing & Signal Conditioning

Even with AI, raw data is often conditioned to isolate potential signals. Modern pipelines mix traditional statistical filtering with machine learning features:

- **Detrending & Masking:** Methods like the Savitzky–Golay filter or spline interpolation remove low-frequency stellar drifts while masking out known planetary transit durations to keep them from being smoothed away.
    
- **Phase-Folding:** If an orbital period is suspected, data points from multiple orbits are stacked on top of each other. This drastically improves the Signal-to-Noise Ratio (SNR), turning a scattered cloud of noisy points into a recognizable transit dip.
    

## 3. How AI Detects Exoplanets

Deep learning excels at extracting non-linear features from sequential data. Several prominent architectural paradigms are utilized in modern astrophysics:

### A. 1D Convolutional Neural Networks (CNNs)

Since a light curve is fundamentally a time-series dataset, 1D CNNs are highly effective. Instead of scanning spatial pixels like a 2D image network, a 1D CNN slides across the time-series array.

- **Mechanism:** It applies learned mathematical kernels to recognize localized geometric features—specifically the sharp "ingress" (entry) and "egress" (exit) boundaries of a planetary transit.
    
- **Benefit:** Models can process hundreds of thousands of light curves in seconds. Highly sophisticated 1D CNNs like NASA's **ExoMiner** achieve massive validation accuracy by meticulously distinguishing true planets from eclipsing binary stars and false positives.
    

### B. 2D Computer Vision (Light Curve Imaging)

An innovative alternative turns time-series data into a computer vision task. Researchers transform 1D light curves into 2D pictorial representations or "images" of the data.

- **Mechanism:** By mapping multi-quarter observations into multi-dimensional matrix spaces, standard, highly optimized image recognition models (like VGG19 or ResNet) can classify the data.
    
- **Real-World Success:** A joint project between the University of Geneva, University of Bern, and AI company Disaitek visualized planetary interactions as "rivers in the sky." Their image-recognition neural network successfully discovered two exoplanets (**Kepler-1705b** and **Kepler-1705c**) that traditional automated pipelines had completely overlooked.
    

### C. Hybrid Machine Learning Models

To minimize computational overhead, cutting-edge frameworks combine deep learning with classic ensemble methods.

- A CNN architecture can be used strictly as a **feature extractor** to turn a long, noisy light curve into a compact, low-dimensional vector.
    
- This vector is then fed into highly efficient decision-tree models like **XGBoost** or Random Forests for final classification. These hybrid models achieve F1-scores up to 99% on Kepler/TESS data while maintaining a negligible computing footprint.
    

## 4. Training AI with Synthetic Data

One major roadblock in training these models is data imbalance: there are millions of stars, but confirmed exoplanets make up less than 1% of the data.

To overcome this, astrophysicists use analytical models (such as the Mandel-Agol transit model) to generate hundreds of thousands of **synthetic light curves**. These simulations model various planet sizes, orbital periods, and precise noise profiles (injected with artificial starspots and instrument jitter). The AI learns on these perfectly labeled simulated scenarios before being deployed to discover real worlds in space archive databases.

The automated scaling provided by AI is essential for upcoming wide-field space missions like ESA's PLATO, which will monitor hundreds of thousands of stars, generating data streams that would take human eyes lifetimes to review.

# Transit Photometry

**Transit photometry** is an indirect method used by astronomers to detect exoplanets. It works by measuring the brightness of a star over time, looking for a periodic, temporary drop in that brightness.

### How It Works

When we observe a distant star system from Earth, we cannot see the planets directly because the star is too blindingly bright. However, if the planet's orbital plane is aligned just right with our line of sight, the planet will periodically pass directly between Earth and its host star.

This event is called a **transit**. As the opaque planet blocks a tiny fraction of the starlight, the star appears to "dim."

### The "Light Curve"

Astronomers plot this brightness data on a graph called a **light curve** (Brightness vs. Time). A classic transit light curve features a distinct U-shaped or V-shaped dip:

- **Ingress:** The moment the planet begins to cross the star's edge, causing the brightness to drop.
    
- **Bottom of the Dip:** The planet is fully in front of the star. The depth of this dip tells astronomers the **size of the planet** relative to the star. Large planets (like Jupiter) cause a deep dip (~1%), while small planets (like Earth) cause an incredibly shallow dip (often less than 0.01%).
    
- **Egress:** The planet exits the star's disk, and the brightness returns to normal.
    

### What Can We Learn From It?

By analyzing the timing and depth of these light curves, scientists can calculate critical characteristics of an alien world without ever seeing it:

- **Planet Size (Radius):** A deeper dip means a larger planet.
    
- **Orbital Period (Year Length):** The time elapsed between two consecutive dips tells us exactly how long it takes the planet to complete one orbit around its star.
    
- **Orbital Distance:** Using the orbital period and Kepler's Third Law, astronomers can calculate how far the planet is from its star, determining if it resides in the **habitable zone** (where liquid water could exist).
    
- **Atmospheric Composition:** When the planet transits, some starlight filters _through_ its atmosphere. By studying how the atmosphere absorbs specific wavelengths of light (transmission spectroscopy), scientists can detect gases like water vapor, carbon dioxide, or methane.
    

### The Limitations

While transit photometry has discovered thousands of exoplanets (via missions like NASA's Kepler and TESS), it has two major limitations:

1. **Geometric Alignment:** The planet's orbit must be perfectly edge-on relative to Earth. If the orbit is tilted even slightly up or down, the planet will never pass in front of the star from our perspective.
    
2. **False Positives:** Other astronomical phenomena can mimic a planetary transit. For instance, an **eclipsing binary** (two stars orbiting and eclipsing each other) or a star with massive, rotating starspots can create similar dips in a light curve. This is why modern astronomers often use AI and follow-up methods (like the Radial Velocity method) to confirm the planet's existence.

# Radial Velocity Method

The **Radial Velocity method** (also known as **Doppler spectroscopy**) is another highly successful indirect technique used to discover exoplanets. While transit photometry looks for changes in a star's _brightness_, the Radial Velocity (RV) method looks for changes in a star's _movement_.

It relies on a fundamental principle of physics: **planets do not just orbit their stars; instead, both the planet and the star orbit a common center of mass.**

## How It Works: The Stellar "Wobble"

Because a star is vastly more massive than any planet, the common center of mass (the barycenter) sits deep inside or just outside the star. As the heavy planet loops around its orbit, its gravitational pull tugs on the star, causing the star to move in a tiny, matching counter-orbit.

To an outside observer, the star appears to **wobble** back and forth.

## Reading the Signal: The Doppler Effect

Astronomers cannot actually see this tiny physical wobble across light-years of space. Instead, they detect it by analyzing the star's light using the **Doppler Effect**—the same physics principle that causes a siren to sound high-pitched as it moves toward you and lower-pitched as it moves away.

Astronomers spread a star's light into a spectrum, which is marked by distinct dark lines (absorption lines) representing the chemical elements inside the star.

- **Blueshift (Moving Toward Us):** When the planet's gravity pulls the star slightly toward Earth, the light waves are compressed, shifting the star's spectral lines toward the blue, shorter-wavelength end of the spectrum.
    
- **Redshift (Moving Away From Us):** When the planet pulls the star away from Earth, the light waves are stretched, shifting the spectral lines toward the red, longer-wavelength end.
    

By tracking these periodic rhythmic shifts over days, months, or years, scientists can confirm a planet is present.

## What Can We Learn From It?

The RV method provides crucial physical data that transit photometry cannot give us on its own:

- **The Planet’s Minimum Mass:** The amplitude of the wobble (how fast the star moves) tells us how hard the planet is pulling on it. A massive planet like Jupiter will yank its star violently, creating a massive Doppler shift. A small planet like Earth will barely nudge it.
    
- **Orbital Period and Shape:** The time it takes for the spectrum to complete one full red-to-blue cycle reveals the planet's year length. The shape of the velocity curve tells us if the planet's orbit is a perfect circle or a stretched-out ellipse.
    

> **The Power of Combination:** If a planet is detected by _both_ Transit Photometry (which gives its **size**) and the Radial Velocity method (which gives its **mass**), scientists can calculate the planet's **density**. This tells us whether the world is a rocky planet like Earth, a water world, or a gas giant like Jupiter.

## Limitations of Radial Velocity

While incredibly precise, the RV method has its own distinct boundaries:

1. **Mass Ambiguity (The Inclination Problem):** Unless we happen to view the planet's orbit perfectly edge-on, we cannot know the exact angle at which the system is tilted. Because of this, RV typically only gives us the _minimum_ possible mass ($M \sin i$) of the planet, rather than its absolute mass.
    
2. **Stellar Activity Interference:** Stars are turbulent balls of plasma. Features like giant starspots or convective bubbling on the star's surface can mimic the velocity shifts of a planet, occasionally tricking astronomers into identifying "false positive" planets.
    
3. **Bias Toward Large, Close Worlds:** It is much easier to detect a massive planet orbiting very close to its star (a "Hot Jupiter") because it generates a huge, rapid tug. Detecting an Earth-sized planet at an Earth-like distance requires instruments capable of measuring a stellar crawl of just a few centimeters per second.