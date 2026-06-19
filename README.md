# AstroDetect AI: Automated Exoplanet Detection & Classification Pipeline

An end-to-end, AI-driven data analysis pipeline designed to detect and classify extremely faint exoplanet transit signals from noisy astronomical time-series data (TESS). AstroDetect handles severe noise contaminations, such as stellar blending, instrumental artifacts, and intrinsic stellar variability, to accurately isolate true exoplanets from false positives.

---

## 🌌 Key Features
- **Statistical Signal Sifting:** Leverages the Box Least Squares (BLS) algorithm to rapidly identify periodic dips and estimate initial orbital periods and SNR.
- **Deep Learning Classification:** Categorizes signals into **Transits**, **Eclipsing Binaries (Eclipses)**, **Stellar Blends**, or **Noise** based on physical constraints and rules.
- **Physical Parameter Estimation:** Combines analytical transit modeling (`batman`) with optimization algorithms to precisely extract orbital period, transit depth, and transit duration.
- **3D Orbital Position Visualizer:** Calculates and renders real-time 3D and 2D orbital trajectories based on the fitted physical parameters and the `astropy` system clock.

---

## 🚀 Step-by-Step Guide: How to Run AstroDetect

AstroDetect is split into two parts: a **Python FastApi Backend** (which handles all the heavy astronomy calculations) and a **Next.js React Frontend** (which provides the interactive UI). You will need to run both simultaneously in two separate terminal windows.

### Prerequisites
- **Python 3.10+** installed on your system.
- **Node.js 18+** installed on your system.
- Git.

---

### Step 1: Start the Python Backend

Open a terminal and navigate to the root directory of the DeepTransit project.

**1. Navigate to the backend directory:**
```bash
cd backend
```

**2. Create a Python Virtual Environment:**
A virtual environment keeps the project's Python packages isolated from your system packages.
```bash
python3 -m venv venv
```

**3. Activate the Virtual Environment:**
* **On macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```
* **On Windows (Command Prompt):**
  ```cmd
  venv\Scripts\activate
  ```
* **On Windows (PowerShell):**
  ```powershell
  venv\Scripts\Activate.ps1
  ```
*(You should now see `(venv)` at the beginning of your terminal prompt.)*

**4. Install Backend Dependencies:**
```bash
pip install -r requirements.txt
```

**5. Run the FastAPI Server:**
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend is now running at `http://localhost:8000`. Leave this terminal window open!

---

### Step 2: Start the Next.js Frontend

Open a **second, new terminal window** and navigate back to the root directory of the DeepTransit project.

**1. Navigate to the frontend directory:**
```bash
cd frontend
```

**2. Install Frontend Dependencies:**
```bash
npm install
```

**3. Run the Development Server:**
```bash
npm run dev
```
The frontend is now running at `http://localhost:3000`.

---

### Step 3: Access the Application

1. Open your web browser (Chrome, Firefox, Safari, etc.).
2. Navigate to **[http://localhost:3000](http://localhost:3000)**.
3. Enter a TIC ID (e.g., the demo star `150070085`) and click **Analyze**!

---

### 🛠 Troubleshooting

**"Address already in use" (Port 8000)**
If you try to start the backend and get an error saying port 8000 is in use, you likely have an orphaned process running in the background.
You can find and kill it on macOS/Linux using:
```bash
lsof -i :8000
# Note the PID, then run:
kill -9 <PID>
```

**"Job not found" Error in Frontend**
If you restart your Python backend while the frontend is still open, the frontend might crash trying to poll a job that no longer exists in the backend's memory. Simply refresh the web page in your browser and start a new analysis.
