import numpy as np
from backend.utils.visualize import plot_full_report

time = np.linspace(0, 10, 1000)
flux = np.random.normal(1, 0.01, 1000)
bls = {"period": 1.0, "t0": 0.5, "duration": 0.1, "depth": 0.02, "snr": 10.0}
fit = {"rp_rs": 0.1, "a_rs": 10.0, "chi2_red": 1.0}
classification = {"classification": "PLANET_TRANSIT", "confidence": 0.99}

out = plot_full_report("TEST", 1, time, flux, time, flux, bls, fit, classification, output_dir=".")
print("Saved to", out)

from PIL import Image
img = Image.open(out)
print("Extrema:", img.getextrema())
