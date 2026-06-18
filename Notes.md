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

# Research Papers 

To build a foundational understanding and prepare your pipeline for the hackathon, you should explore several pivotal research papers. These span from the **original breakthroughs** that introduced deep learning to transit photometry to **recent state-of-the-art frameworks** tackling severe noise and false positives.

The papers are organized by how they fit into your project, complete with direct links to access them.

### 1. The Foundational Breakthrough (The "Dual-View" Paradigm)

Before writing any complex architectures, you should read the paper that started it all. This work established the industry-standard technique of phase-folding a light curve and passing both a **global view** (for context) and a **local view** (zoomed in on the dip) into a Convolutional Neural Network (CNN).

- **Paper:** _Identification of Earth-sized Planets in Kepler Data Using Convolutional Neural Networks_
    
- **Key Takeaway:** It demonstrated how 1D CNNs could successfully filter out instrumental artifacts and stellar variability to identify weak signals.
    
- **Access Link:** [Read on NASA ADS / arXiv](https://arxiv.org/abs/1712.05044)
    

### 2. The Current Space Mission Standard (NASA's ExoMiner)

If you want to know what NASA uses for TESS and Kepler datasets, this is it. It expands the dual-view approach by feeding additional diagnostic inputs—such as centroid motion and odd-even flux asymmetries—directly into the neural network to aggressively eliminate eclipsing binaries.

- **Paper:** _ExoMiner++: Enhanced Transit Classification and a New Vetting Catalog for 2-Minute TESS Data_ (Valizadegan et al., 2025)
    
- **Key Takeaway:** Highlights how combining multi-source training datasets (Kepler + TESS) allows deep learning models to overcome noisy data regimes and label ambiguity. A very recent update also extends this framework to TESS Full-Frame Images (FFIs) (Martinho et al., 2026).
    
- **Access Link:** [Read on arXiv](https://arxiv.org/abs/2502.09790)
    

### 3. State-of-the-Art (SOTA) Multimodal Fusion

For an advanced layout, look at how modern papers incorporate secondary stellar metadata. Real-world transit deep learning models don't just look at the light curves; they look at the host star's physical properties.

- **Paper:** _ExoNet: Calibrated Multimodal Deep Learning for TESS Exoplanet Candidate Vetting using Phase-Folded Light Curves and Stellar Parameters_ (Islam, 2026)
    
- **Key Takeaway:** Introduces a calibrated architecture fusing 1D CNNs with a Multi-Head Attention mechanism over time-series feature maps, while simultaneously feeding an MLP with stellar parameters. It successfully unearthed several compelling, unconfirmed Earth-like targets from noisy TESS streams.
    
- **Access Link:** [Download the full PDF on arXiv](https://arxiv.org/pdf/2604.15560)
    

### 4. Overcoming Data Imbalance with Synthetic Data

Because your hackathon prompt mentions utilizing simulated data for training, this paper is highly relevant to your strategy. It evaluates the exact trade-offs of mixing synthetic parametric curves with real noisy stellar data.

- **Paper:** _Deep learning exoplanets detection by combining real and synthetic data_ (Cuéllar et al., 2022)
    
- **Key Takeaway:** Proves that optimizing the precise ratio of simulated transit models embedded into real noise profiles significantly boosts a CNN's sensitivity across a wider range of orbital periods.
    
- **Access Link:** [Read on PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0268199)
    

### 5. Alternative / Competitor Approaches (Unsupervised Architecture)

What if you don't rely heavily on labeled sets or neural networks? Understanding how unsupervised algorithms handle noisy star clusters will help you write the "assumptions" and "methodology" sections of your hackathon report.

- **Paper:** _Detection of exoplanets from TESS imaging data using unsupervised machine learning techniques_ (Sinha Adhikary, 2026)
    
- **Key Takeaway:** Explores dimensional reduction (UMAP) and clustering algorithms (k-medians) to isolate subtle, non-generalized light curve variations from crowded star fields without requiring pre-labeled training classes.
    
- **Access Link:** [Read on Frontiers in Astronomy and Space Sciences](https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2026.1800321/full)
    

## 💡 Quick Reading Strategy for the Hackathon:

Don't read all of these cover-to-cover during the competition!

1. Open **ExoNet (2026)** and look closely at its architectural diagram to understand how to design your network inputs.
    
2. Open **Cuéllar et al. (2022)** to see the math/logic behind injecting synthetic transits into real noise.
    
3. Use the **ExoMiner++ (2025)** paper to grab ideas on how to cleanly explain your evaluation metrics and diagnostic output summaries to the judges.
    

## References

Cuéllar, S., Granados, P., Fabregas, E., Curé, M., Vargas, H., Dormido-Canto, S., & Farias, G. (2022). Deep learning exoplanets detection by combining real and synthetic data. _PLOS ONE_, _17_(5), e0268199. [https://doi.org/10.1371/journal.pone.0268199](https://doi.org/10.1371/journal.pone.0268199)

Cited by: 33

Islam, M. R. (2026). ExoNet: Calibrated multimodal deep learning for TESS exoplanet candidate vetting using phase-folded light curves, stellar parameters. _arXiv preprint arXiv:2604.15560_. [https://arxiv.org/pdf/2604.15560](https://arxiv.org/pdf/2604.15560)

Martinho, M. J. S., Valizadegan, H., Jenkins, J. M., Caldwell, D. A., Twicken, J. D., Tofflemire, B., & Jafariyazani, M. (2026). ExoMiner++ 2.0: Vetting TESS full-frame image transit signals. _arXiv preprint arXiv:2601.14877_. [https://arxiv.org/abs/2601.14877](https://arxiv.org/abs/2601.14877)

Cited by: 1

Sinha Adhikary, A. (2026). Detection of exoplanets from TESS imaging data using unsupervised machine learning techniques. _Frontiers in Astronomy and Space Sciences_, _13_, 1800321. [https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2026.1800321/full](https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2026.1800321/full)

Valizadegan, H., Martinho, M. J. S., Jenkins, J. M., Twicken, J. D., Caldwell, D. A., Maynard, P., Wei, H., Zhong, W., Yates, C., Donald, S., Collins, K. A., Latham, D., Barkaoui, K., Calkins, M. L., Carden, K., Chazov, N., Esquerdo, G. A., Guillot, T., Krushinsky, V., Nowak, G., Rackham, B. V., Triaud, A., Schwarz, R. P., Stephens, D., & Stockdale, C. (2025). ExoMiner++: Enhanced transit classification and a new vetting catalog for 2-minute TESS data. _arXiv preprint arXiv:2502.09790_. [https://doi.org/10.48550/arxiv.2502.09790](https://www.google.com/search?q=https%3A%2F%2Fdoi.org%2F10.48550%2Farxiv.2502.09790)


# Calculating 

For your hackathon project, estimating the **Orbital Period**, **Transit Duration**, and **Transit Depth** is where you translate raw, pixel-level fluctuations into verifiable physical properties of an alien world.

To satisfy the requirements of your challenge, here is exactly how your pipeline should mathematically model, fit, and extract these three core parameters from a science dataset.

## 1. Orbital Period ($P$)

The orbital period is the duration of one complete orbit (the planet's year). It is measured as the exact time interval between the midpoints of consecutive transits.

- **How the Pipeline Extracts It:** Before running deep learning models, your pipeline applies a **Box Least Squares (BLS)** periodogram to the cleaned light curve. BLS wraps the time-series data at thousands of trial frequencies. When it hits the true orbital period, the periodic dips align perfectly, creating a massive statistical spike in "power."
    
- **The Mathematical Fit:** The detected period allows you to convert the light curve from absolute time (Days) into **Phase space** (ranging from $-0.5$ to $+0.5$), effectively folding all individual transits on top of each other into a single, clean master profile.
    

## 2. Transit Depth ($\delta$)

Transit depth is the maximum drop in the star's apparent brightness when the planet is fully silhouetted against the stellar disk.

- **The Underlying Physics:** To a first-order approximation (assuming a uniformly bright star), the depth is strictly a geometric ratio of the cross-sectional areas:
    
    $$\delta \approx \left(\frac{R_p}{R_*}\right)^2$$
    
    Where $R_p$ is the radius of the planet and $R_*$ is the radius of the star. For example, a Jupiter-sized planet creates a deep $\sim 1\%$ dip ($\delta = 0.01$), whereas an Earth-sized planet creates a shallow $\sim 0.01\%$ dip ($\delta = 0.0001$).
    
- **The Complication (Limb Darkening):** Real stars are not flat, uniformly bright disks; they are spheres of glowing gas that appear darker at their outer edges (limbs). This causes the bottom of the transit curve to look slightly curved or U-shaped rather than a flat box.
    
- **How the Pipeline Extracts It:** Your pipeline fits an analytical model (like `batman`) implementing a **Quadratic Limb Darkening Law**:
    
    $$I(\mu) = 1 - u_1(1 - \mu) - u_2(1 - \mu)^2$$
    
    By fitting this equation via non-linear least squares optimization (`scipy.optimize.curve_fit`), the pipeline solves for the exact true value of $\frac{R_p}{R_*}$ while accounting for the star's curved edge gradient.
    

## 3. Transit Duration ($T_{14}$)

Transit duration represents the total time elapsed from the moment the planet first touches the outer edge of the star (Ingress, point $t_1$) to the moment it completely breaks contact on the other side (Egress, point $t_4$).

- **The Underlying Physics:** Total duration ($T_{14}$) depends heavily on the planet's orbital speed and its **Impact Parameter ($b$)**—the minimum projected distance between the center of the planet and the center of the star during mid-transit.
    
    - A central transit ($b=0$) cuts directly across the star's equator, yielding the longest possible duration.
        
    - A grazing transit ($b \approx 1$) cuts across the upper or lower edge, resulting in a short, V-shaped duration.
        
- **The Mathematical Equation:** For a circular orbit, the analytical expression for duration is modeled as:
    
    $$T_{14} = \frac{P}{\pi} \arcsin \left( \frac{R_*} {a} \frac{\sqrt{(1 + R_p/R_*)^2 - b^2}}{\sin i} \right)$$
    
    Where $a$ is the semi-major axis (orbital distance) and $i$ is the orbital inclination angle.
    
- **How the Pipeline Extracts It:** By supplying your light-curve fitting algorithm with the period ($P$) and depth ($\delta$) found in previous steps, it optimizes the free parameters $a/R_*$ (semi-major axis scaled to stellar radius) and $b$. Once those parameters converge on the minimum $\chi^2$ (chi-squared) error surface, the final analytical duration $T_{14}$ is calculated directly from the best-fit geometry.
    

## 💡 Code Blueprint: The Parameter Fitting Loop

In your pipeline script, this is conceptually how you combine your tools to estimate these values and satisfy the **confidence level** criteria:

Python

```
import numpy as np
import batman
from scipy.optimize import curve_fit

# 1. Define the analytical light curve function using the batman package
def transit_model(time, t0, period, rp_over_rs, a_over_rs, inc):
    params = batman.TransitParams()
    params.t0 = t0                 # Mid-transit time
    params.per = period            # Orbital Period
    params.rp = rp_over_rs         # Transit Depth factor (Rp/Rs)
    params.a = a_over_rs           # Semi-major axis over stellar radius
    params.inc = inc               # Inclination
    params.ecc = 0.0               # Assume circular orbit for hackathon speed
    params.w = 90.0
    params.u = [0.1, 0.3]          # Standard TESS linear & quadratic limb darkening coefficients
    params.limb_dark = "quadratic"
    
    m = batman.TransitModel(params, time)
    return m.light_curve(params)

# 2. Fit the noisy, phase-folded data using Scipy
# initial_guesses = [estimated_t0, bls_period, np.sqrt(bls_depth), 10.0, 90.0]
popt, pcov = curve_fit(transit_model, phase_time, normalized_flux, p0=initial_guesses)

# 3. Extract the parameters and their uncertainties (Confidence Levels)
per_fit, depth_factor_fit = popt[1], popt[2]
per_err, depth_factor_err = np.sqrt(np.diag(pcov))[1], np.sqrt(np.diag(pcov))[2]

print(f"Estimated Period: {per_fit} +/- {per_err} days")
print(f"Estimated Transit Depth (Rp/Rs)^2: {depth_factor_fit**2}")
```

### For Your Hackathon Report:

Make sure to explain that your **uncertainties/confidence levels** are calculated directly from the **covariance matrix (`pcov`)** outputted by your curve-fitting algorithm. Taking the square root of the diagonal elements of this matrix gives you the formal 1-$\sigma$ standard error bounds for every single parameters estimated.



## 📄 Summary of the Papers

### 1. Shallue & Vanderburg (2018) — _The Dual-View CNN_

- **The Core Idea:** This was the pioneer paper that proved Deep Learning could automate exoplanet vetting. It introduced a 1D Convolutional Neural Network (CNN) that takes two distinct inputs from a single light curve: a **Global View** (the entire orbital phase to detect secondary star eclipses) and a **Local View** (zoomed in tightly on the transit dip to inspect geometric shape).
    
- **What is Left for Development:** The original model struggled heavily with highly crowded stellar fields (where background star blendings alter the light curves) and was highly prone to false positives caused by severe, non-linear instrumental noise.
    

### 2. Valizadegan et al. (2025/2026) — _ExoMiner++_

- **The Core Idea:** NASA's state-of-the-art framework. ExoMiner++ moves beyond just looking at the light curve. It adds specialized diagnostic inputs into the neural network, such as **centroid motion** (tracking if the star physically shifts on the camera pixels during a transit, indicating a background eclipsing binary) and odd-even transit depth consistency checking.
    
- **What is Left for Development:** ExoMiner++ is computationally heavy and requires massive, deeply curated expert-labeled training catalogs. Extending it efficiently to massive, raw Full-Frame Images (FFIs) without severe computational overhead remains an active area of optimization.
    

### 3. ExoNet (Multimodal Fusion)

- **The Core Idea:** A cutting-edge 2026 approach that utilizes **Multimodal Machine Learning**. It combines a 1D CNN + Multi-Head Attention mechanism to parse the light curve time-series data while simultaneously feeding a separate Multi-Layer Perceptron (MLP) with physical metadata about the host star (e.g., stellar radius, mass, effective temperature).
    
- **What is Left for Development:** The attention weights and multimodal deep layers introduce cross-feature complexity, making it difficult to extract precise physical parameter error margins (uncertainty quantification) out of the neural network natively.
    

### 4. Cuéllar et al. (2022) — _Synthetic Data Injectors_

- **The Core Idea:** Addresses the extreme data imbalance in astrophysics (millions of stars, but very few real planets). The authors created an automated mathematical framework that injects simulated planet transit models directly into real, verified "clean" stellar noise backgrounds to create balanced training sets.
    
- **What is Left for Development:** The synthetic transits are mathematically "perfect" models. The paper notes a performance drop when models trained on this data confront unpredictable, complex real-world variables like massive rotating starspots or irregular spacecraft thruster firing jitter.
    

### 5. Sinha Adhikary (2026) — _Unsupervised Dimensionality Reduction_

- **The Core Idea:** An alternative to deep learning that doesn't require labeled data. It uses unsupervised machine learning—specifically **UMAP** (Uniform Manifold Approximation and Projection) and **k-medians clustering**—to group light curves based on mathematical similarities, automatically isolating abnormal "dips" from normal stellar noise.
    
- **What is Left for Development:** Unsupervised pipelines can cluster similar signals together, but they cannot definitively classify _why_ a signal is dipping. A human or an auxiliary supervised classifier is still required to determine if a cluster represents a true planet or an instrumental glitch.
    

## 🛠️ What Parts You Are Going to Use in Your Project

To build a robust pipeline within a hackathon timeframe, you are going to strategically "copy the homework" of these papers by extracting their best elements:

```
[Raw Data Input]
       │
       ▼
 ──► Method from Cuéllar (2022): Mix real TESS data with synthetic transits to balance your training dataset.
       │
       ▼
 ──► Method from Shallue & Vanderburg (2018): Pass both a "Global" and "Local" phase-folded view to your 1D CNN.
       │
       ▼
 ──► Method from Valizadegan (2025): Feed basic stellar parameters into your pipeline to help rule out deep binary eclipses.
       │
       ▼
[Final Classification & Parametric Fit Output]
```

### 1. The Dataset Strategy (From Cuéllar et al., 2022)

- **Application:** You will use the curated training dataset provided by your hackathon challenge. If you find that you don't have enough exoplanet examples to train your neural network, you will use the `batman` package to simulate synthetic transits and inject them into noisy, flat light curves to quickly bolster your training dataset size.
    

### 2. The Input Architecture (From Shallue & Vanderburg, 2018)

- **Application:** When designing the input shape for your 1D CNN in TensorFlow or PyTorch, you will use the **Dual-View approach**. You will write your data-processing code to generate two arrays for each target star: one vector of 200 data points mapping the entire phase-folded orbit (Global), and one vector of 200 data points tightly focused only on the transit window (Local).
    

### 3. Vetting Out Crowded Field Blends (From Valizadegan et al., 2025 & Islam, 2026)

- **Application:** The challenge details state that your dataset has significant contaminations from stellar blending in crowded fields. You will use the insight from _ExoNet_ and _ExoMiner++_ by extracting simple tabular metadata (like the star's magnitude and radius from the TESS Input Catalog). If your 1D CNN sees a shallow dip, but the metadata shows the star is in an incredibly dense field or is massive, your logic can flags it as a potential "blend" or "eclipsing binary" rather than an Earth-sized planet.