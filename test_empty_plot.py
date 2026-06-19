import urllib.request, json, numpy as np
from backend.utils.visualize import plot_full_report

job = json.loads(urllib.request.urlopen("http://localhost:8000/api/status/4ccd998f-e82d-4651-a5de-276b20b3dde2/poll").read())
result = job["result"]
t = np.array(result["lightcurve"]["time"])
f = np.array(result["lightcurve"]["flux"])
bls = result["bls"]
fit = result["fit"]
cls = {"classification": result["classification"], "confidence": result["confidence"]}

print(f"Time len: {len(t)}")
print(f"Flux len: {len(f)}")
print(f"Time NaNs: {np.isnan(t).sum()}")

out = plot_full_report("150070085", 0, t, f, t, f, bls, fit, cls, output_dir=".")
print("Saved to", out)
from PIL import Image
print("Extrema:", Image.open(out).getextrema())
