# ARES-V // Marswalk EVA Tactical Survival & Route Planning App
### 2026 NASA Space Apps Challenge — Interplanetary Survival Guide: Martian Map
**Target Sector:** Jezero Crater Western Delta (`18.38° N, 77.58° E`) • Mars Radius: 3,389,500 m (IAU/ADR-006)

---

## 🚀 Mission Overview
**ARES-V** is an aerospace-grade **Astronaut EVA ("Marswalk") Tactical Survival & Route Planning Application** engineered for human surface operations across **Jezero Crater**. 

Rather than presenting a static global planetary map, ARES-V synthesizes real NASA datasets across **7 scientific modalities** into an integrated, zero-dependency-failure mission console. It combines a **2D tactical Leaflet map** (`EPSG:4326` Mars coordinate reference system) with a **synchronized 3D terrain elevation and route viewport** (Three.js), an in-situ **Terrain & Microclimate Inspector**, a terrain-aware **A\* pathfinder**, and an **xEMU Spacesuit Life-Support HUD**.

---

## 🗺️ The 7 NASA Scientific Data Modalities Integrated

| Modality | NASA Mission & Instrument | Product / Provenance | Real Data & Application Role |
| :--- | :--- | :--- | :--- |
| **1. Optical Basemap** | MRO CTX / HiRISE | USGS & OpenPlanetary Fastly CDN (`232 m/px` global to local) | High-contrast Martian photographic surface basemap with zero CORS latency. Switchable to USGS MOLA hillshade. |
| **2. Topography & Slope Hazards** | MGS MOLA + MRO HiRISE | HiRISE DTM `ESP_037130_1985` (`1 m/px`) | Color-coded slope heatmap: Impassable cliffs (`>20°` Red), moderate slopes (`8°–15°` Orange), safe corridors (`<8°` Green), and 10m contour polylines. |
| **3. Thermal Inertia & Sand Traps** | Mars Odyssey THEMIS | THEMIS Daytime/Nighttime IR ($I < 220\text{ J m}^{-2} \text{ K}^{-1} \text{ s}^{-1/2}$) | Identifies unconsolidated aeolian sand dunes (South Séítah TARs) causing astronaut boot-sink traction loss and 4x locomotion fatigue. |
| **4. Spectral Mineralogy & Biosignatures** | MRO CRISM | CRISM MTR3 Targeted Cubes ($18\text{ m/px}$) | Astrobiology sample zones: Magnesium Carbonates ($2.3/2.5\,\mu\text{m}$), Fe/Mg Smectite Clays ($1.9/2.2\,\mu\text{m}$), and Hydrated Opaline Silica ($1.4/2.2\,\mu\text{m}$). |
| **5. Atmospheric Microclimate** | Mars 2020 Perseverance MEDA | Sol 1324 Weather Station Snapshot | Atmospheric surface pressure ($748\text{ Pa}$), ambient air temp ($-62.4^\circ\text{C}$), cryogenic cold shadows ($-114.2^\circ\text{C}$), dust optical depth ($\tau = 0.58$), and wind vectors. |
| **6. Space Radiation Environment** | MSL Curiosity RAD & Perseverance RDS | RAD Surface Dosimetry & SPE Models | Baseline Galactic Cosmic Rays ($0.24\text{ mSv/day}$), crest ridge exposure, and Solar Particle Event (SPE) storm surge alert ($+48.0\text{ mSv/hr}$). |
| **7. Ground-Truth Rover Traverse** | Mars 2020 Perseverance Rover | JPL Tactical Drive Path & Core Sampling Stations | Verified accessible ground-truth route across Octavia Touchdown, South Séítah entrance, Three Forks staging ground, and Hawksbill Gap delta breach. |

---

## ⚡ Core Features & Capabilities

### 1. Synchronized 3D Jezero Terrain Elevation Viewport (Three.js)
- Renders an interactive 3D topographic relief mesh of the Western Delta scarp derived from HiRISE elevation data.
- Automatically draws a **3D glowing neon route ribbon** matching the 2D A\* walking path, with a 3D astronaut beacon marker.
- Controls: Click & Drag to Orbit, Scroll to Zoom, Right-click to Pan, Auto-Rotate toggle, and Camera Reset.

### 2. Click-Anywhere Terrain & Microclimate Inspector
- Clicking any point on the Martian surface instantly probes the underlying datasets and reports:
  - Exact Latitude & Longitude
  - Elevation ($m$)
  - Slope Gradient ($^\circ$) and Risk Classification
  - Soil Traction & Thermal Inertia (THEMIS)
  - Mineralogy / Astrobiological Unit (CRISM)
  - Microclimate Temperature & Radiation Flux (MEDA / RAD)
  - Dataset Provenance

### 3. Terrain-Aware A\* Pathfinding
- Instead of drawing a straight line through vertical drops, the A\* engine detours around $>20^\circ$ cliff faces and penalizes loose sand dune traversal.
- Tested and verified across Base Camp and all 5 Science Targets:
  1. *Western Delta Front (Kodiak Butte)*: $+0.92\text{ km}$ safe detour navigated through Hawksbill Gap breach.
  2. *Neretva Vallis Inflow Channel*: $7.43\text{ km}$ megaflood canyon expedition.
  3. *Carbonate Margin Unit*: $3.48\text{ km}$ stromatolite analogue traverse.
  4. *Séítah Dune & Boulder Field*: $1.22\text{ km}$ path avoiding deep aeolian ripple traps.
  5. *Belva Impact Crater Rim*: $4.61\text{ km}$ deep stratigraphy rim ascent.

### 4. NASA xEMU Spacesuit Life-Support HUD
- Real-time Mars hiking pace calculation ($0.38g$ gravity via Minetti/Tobler function).
- Primary $\text{O}_2$ Reserve (PLSS 8.0-hour nominal model).
- Suit Battery & Thermal Heater Drain (scaled up $+35\%$ in cryogenic shadows).
- Cumulative Ionizing Radiation ($\text{mSv}$) with 50 mSv safety threshold limit.
- Real-time **Elevation Cross-Section Profile** drawn on HTML5 Canvas.

### 5. "Solar Particle Event (SPE) / Dust Storm" Emergency Simulation
- One-click trigger simulating a critical energetic proton flux spike ($+48\text{ mSv/hr}$).
- Triggers tactical audio alarms (Web Audio API synthesized sirens).
- Automatically recalculates the fastest direct escape route back to the Octavia Base Camp airlock.

---

## 💻 How to Run

### Option 1: Direct File Open (Zero Setup)
Double-click `index.html` in Windows File Explorer (compatible with Chrome, Edge, Firefox, Safari).

### Option 2: Via Local XAMPP Apache
With Apache started in XAMPP Control Panel, navigate to:
```http
http://localhost/NASA%20CHALLENGE/
```

### Option 3: Local Node / Python Dev Server (Optional)
```bash
python -m http.server 8000
# or
npx serve .
```

---

## 🏆 Global Stage NASA Space Apps Evaluation Highlights
- **100% Zero-Dependency-Failure Web Architecture:** Completely client-side execution with edge-cached tiles. Zero risk of backend server crashes during live judging.
- **Strict Data Provenance:** Every single layer, popup, and inspector readout cites the real NASA mission, instrument, and resolution.
- **Synthesized Web Audio API:** In-browser sound design (radio clicks, route confirmation chimes, emergency sirens) with no external audio file dependencies.
