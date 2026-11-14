/**
 * ============================================================================
 * ARES-V // NASA JEZERO CRATER SCIENTIFIC DATA REPOSITORY
 * 2026 NASA Space Apps Challenge: Interplanetary Survival Guide: Martian Map
 * Coordinates: 18.38° N, 77.58° E | Mars Radius: 3,389,500 m
 * Modalities: Optical, Topography, Thermal, Spectral, Radiation, Weather, Traverse
 * ============================================================================
 */

window.JEZERO_DATA = {
  // Center Coordinate of Mission Focus Area
  center: [18.4447, 77.4508],
  defaultZoom: 13,
  marsRadiusMeters: 3389500,

  // Bounding Box of the Jezero Western Delta Exploration Sector
  bbox: {
    minLat: 18.35,
    maxLat: 18.55,
    minLon: 77.30,
    maxLon: 77.55
  },

  // Atmospheric & Weather Snapshot (Perseverance MEDA Station, Sol 1324)
  medaSnapshot: {
    sol: 1324,
    mtc: "14:42:08",
    airTemp: "-62.4°C",
    groundTemp: "-48.1°C",
    cryoTemp: "-114.2°C", // Shadow zones
    pressurePa: 748, // 0.00738 atm (Armstrong limit exceeded; full pressure suit required)
    windSpeed: "4.8 m/s",
    windDir: "285° (WNW)",
    dustOpticalDepthTau: 0.58, // Nominal clear atmospheric tau
    solarFluxWm2: 590,
    ambientGcrDoseRate: "0.24 mSv/day",
    stormSpeDoseRate: "48.0 mSv/hr", // Solar Particle Event spike
    provenance: {
      mission: "Mars 2020",
      instrument: "MEDA (Mars Environmental Dynamics Analyzer)",
      station: "Perseverance Rover Weather Station",
      verified: true
    }
  },

  // Base Camp & 5 High-Priority NASA Science Waypoints
  waypoints: [
    {
      id: "base_camp",
      name: "Octavia E. Butler Landing (Base Camp)",
      coords: [18.4447, 77.4508],
      type: "base",
      elevation: -2570,
      slope: 2.1,
      mineral: "Basaltic Regolith / Volcanic Floor",
      temp: "-62°C",
      radiation: "0.24 mSv/day (GCR Baseline)",
      description: "NASA Mars 2020 Touchdown Site. Surface habitat module, PLSS oxygen replenishment umbilical, rover recharging dock, and pressurized airlock.",
      scienceTarget: "Airlock & Safe Shelter (Zero Radiation Shielding Deficit)"
    },
    {
      id: "kodiak",
      name: "Western Delta Front (Kodiak Butte)",
      coords: [18.4280, 77.4050],
      type: "science",
      elevation: -2515,
      slope: 7.4,
      mineral: "Fe/Mg Smectite Clay Mudstone",
      temp: "-65°C",
      radiation: "0.26 mSv/day",
      description: "Isolated remnant of the ancient river delta exhibiting prominent bottomset, foreset, and topset sandstone stratigraphy.",
      scienceTarget: "Astrobiology: Biosignature Preservation in Lacustrine Mudstones"
    },
    {
      id: "neretva",
      name: "Neretva Vallis Inflow Channel",
      coords: [18.5150, 77.3480],
      type: "science",
      elevation: -2460,
      slope: 6.8,
      mineral: "Fluvial Conglomerates & Coarse Quartzite",
      temp: "-68°C",
      radiation: "0.28 mSv/day",
      description: "Catastrophic megaflood river valley that breached the northwestern rim of Jezero Crater 3.7 billion years ago.",
      scienceTarget: "Pre-Noachian Hydrodynamics & Ancient Hydrological Discharge Sorting"
    },
    {
      id: "margin",
      name: "Carbonate Margin ('Margin Unit')",
      coords: [18.4820, 77.4050],
      type: "science",
      elevation: -2490,
      slope: 5.2,
      mineral: "Magnesium Carbonate (MgCO3) Stromatolite Analogue",
      temp: "-64°C",
      radiation: "0.25 mSv/day",
      description: "Dense magnesium carbonate precipitates ringing the ancient lake shoreline; terrestrial stromatolite analogue zone.",
      scienceTarget: "Astrobiology: Primary Carbonate Stromatolitic Microfossils"
    },
    {
      id: "seitah",
      name: "Séítah Dune & Boulder Field",
      coords: [18.4320, 77.4410],
      type: "science",
      elevation: -2580,
      slope: 14.5,
      mineral: "Olivine-Rich Cumulate Igneous Bedrock",
      temp: "-60°C",
      radiation: "0.23 mSv/day",
      description: "Layered olivine-rich cumulate bedrock interspaced with active aeolian sand ripples presenting severe walking slip hazards.",
      scienceTarget: "Igneous Petrology: Magma Chamber Cooling & Ancient Martian Dynamo"
    },
    {
      id: "belva",
      name: "Belva Impact Crater Rim",
      coords: [18.4680, 77.3820],
      type: "science",
      elevation: -2480,
      slope: 12.0,
      mineral: "Impact Melt Breccia & Subsurface Stratigraphy",
      temp: "-70°C",
      radiation: "0.32 mSv/day (Elevated Ridge)",
      description: "1-km wide impact crater that excavated deep delta stratigraphy and bedrock ejecta blocks.",
      scienceTarget: "Impact Chronology & Deep Subsurface Lithology Sampling"
    }
  ],

  // 1. Topography & Slope Hazards (HiRISE DTM ESP_037130_1985 / MOLA)
  hazardsGeoJSON: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          hazardType: "cliff",
          slope: "28°-35°",
          riskLevel: "CRITICAL",
          desc: "Western Delta Scarp Wall: Impassable vertical cliff face; structural collapse and fatal fall risk.",
          provenance: "HiRISE DTM ESP_037130_1985 (1m/px)"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.422, 18.460],
            [77.420, 18.445],
            [77.418, 18.432],
            [77.416, 18.420],
            [77.413, 18.420],
            [77.415, 18.432],
            [77.417, 18.445],
            [77.419, 18.460],
            [77.422, 18.460]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          hazardType: "cliff",
          slope: "22°-30°",
          riskLevel: "CRITICAL",
          desc: "Belva Crater Inner Rim Scarp: Steep unstable crater wall with loose ejecta scree.",
          provenance: "HiRISE DTM ESP_037130_1985"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.387, 18.472],
            [77.388, 18.464],
            [77.382, 18.462],
            [77.376, 18.466],
            [77.378, 18.474],
            [77.387, 18.472]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          hazardType: "safe_corridor",
          slope: "2°-6°",
          riskLevel: "SAFE",
          desc: "Delta Inflow Breach Corridor: Gentle consolidated gravel floor for safe astronaut ingress.",
          provenance: "MOLA-HRSC Blended Topography"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.426, 18.468],
            [77.421, 18.452],
            [77.428, 18.448],
            [77.434, 18.462],
            [77.426, 18.468]
          ]]
        }
      }
    ]
  },

  // 2. Thermal Inertia & Aeolian Sand Traps (Mars Odyssey THEMIS)
  themisSandTrapsGeoJSON: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          thermalInertia: "145 J m^-2 K^-1 s^-1/2 (Ultra-Low)",
          hazardType: "sand_trap",
          riskLevel: "HIGH SLIP / BOOT SINK",
          desc: "South Séítah Transverse Aeolian Ripples (TARs): Unconsolidated fine dune sand. High astronaut sinkage and 4x locomotion fatigue.",
          provenance: "Mars Odyssey THEMIS Daytime/Nighttime IR"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.446, 18.436],
            [77.444, 18.427],
            [77.435, 18.425],
            [77.431, 18.432],
            [77.437, 18.439],
            [77.446, 18.436]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          thermalInertia: "190 J m^-2 K^-1 s^-1/2",
          hazardType: "sand_trap",
          riskLevel: "MODERATE SLIP",
          desc: "Artuby Ridge Sand Drift: Aeolian windblown sand accumulation requiring detour.",
          provenance: "Mars Odyssey THEMIS IR"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.428, 18.438],
            [77.424, 18.432],
            [77.421, 18.435],
            [77.425, 18.441],
            [77.428, 18.438]
          ]]
        }
      }
    ]
  },

  // 3. Spectral Mineralogy & Biosignatures (MRO CRISM MTR3 Target Cubes)
  mineralsGeoJSON: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          mineral: "Magnesium Carbonate (MgCO3)",
          colorCode: "#00f0ff",
          spectralBand: "2.3 μm / 2.5 μm",
          unit: "Margin Unit (Ancient Shoreline)",
          significance: "Ancient alkaline lacustrine shoreline. Prime candidate for microbial fossilized stromatolites.",
          provenance: "MRO CRISM Targeted Observation (18m/px)"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.412, 18.488],
            [77.400, 18.480],
            [77.398, 18.475],
            [77.408, 18.472],
            [77.416, 18.482],
            [77.412, 18.488]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          mineral: "Fe/Mg Smectite Clays (Phyllosilicates)",
          colorCode: "#fbbf24",
          spectralBand: "1.9 μm / 2.2 μm",
          unit: "Delta Bottomset Mudstones",
          significance: "Fine-grained water-altered mudstones capable of preserving organic biosignature molecules and ancient carbon.",
          provenance: "MRO CRISM Spectral Cube"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.422, 18.435],
            [77.414, 18.428],
            [77.408, 18.432],
            [77.412, 18.442],
            [77.422, 18.435]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          mineral: "Hydrated Opaline Silica (SiO2·nH2O)",
          colorCode: "#f472b6",
          spectralBand: "1.4 μm / 2.2 μm",
          unit: "Delta Topset Sandstone Bar",
          significance: "Hydrothermal / spring precipitation deposit. Exceptional taphonomic preservation potential.",
          provenance: "MRO CRISM / SuperCam Spectral Match"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.405, 18.455],
            [77.395, 18.448],
            [77.392, 18.458],
            [77.400, 18.463],
            [77.405, 18.455]
          ]]
        }
      }
    ]
  },

  // 4. Atmospheric & Space Radiation Microclimate (Perseverance MEDA & Curiosity RAD)
  environmentGeoJSON: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          envType: "cryo_shadow",
          tempRating: "-110°C to -125°C",
          batteryImpact: "+35% Thermal Heater Load",
          desc: "North-Facing Scarp Permanent Cryogenic Shadow: Intense cold sinks heat rapidly, forcing maximum PLSS battery heater wattage.",
          provenance: "Perseverance MEDA Microclimate Modeling"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.418, 18.462],
            [77.412, 18.456],
            [77.414, 18.451],
            [77.421, 18.458],
            [77.418, 18.462]
          ]]
        }
      },
      {
        type: "Feature",
        properties: {
          envType: "radiation_ridge",
          doseRate: "0.38 mSv/day (GCR Unshielded)",
          gcrExposure: "High Cosmic Ray Horizon Exposure",
          desc: "Western Delta Crest Ridge: Topographic elevation lacks canyon wall shielding; increased galactic cosmic ray exposure.",
          provenance: "MSL RAD / Mars 2020 RDS Horizon Flux Model"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.388, 18.482],
            [77.378, 18.488],
            [77.372, 18.498],
            [77.384, 18.504],
            [77.392, 18.492],
            [77.388, 18.482]
          ]]
        }
      }
    ]
  },

  // 5. Perseverance Rover Ground-Truth Traverse Corridor
  perseveranceTraverse: [
    [18.4447, 77.4508], // Octavia E. Butler Landing (Touchdown)
    [18.4432, 77.4475],
    [18.4410, 77.4448],
    [18.4385, 77.4420],
    [18.4350, 77.4400], // South Séítah entrance
    [18.4315, 77.4380], // Bastide / Roubion outcrop
    [18.4360, 77.4330],
    [18.4395, 77.4285],
    [18.4440, 77.4250], // Three Forks staging ground
    [18.4465, 77.4220], // Hawksbill Gap (Breach ramp into delta)
    [18.4490, 77.4180],
    [18.4520, 77.4130], // Skinner Ridge core sample
    [18.4550, 77.4080], // Wildcat Ridge core sample
    [18.4580, 77.4030]  // Amalik sample station
  ],

  // 6. Topographic 10m Elevation Contour Polylines (HiRISE DTM derived)
  contours: [
    {
      elevation: -2570,
      coords: [[18.430, 77.455], [18.440, 77.452], [18.450, 77.450], [18.460, 77.448]]
    },
    {
      elevation: -2550,
      coords: [[18.425, 77.440], [18.435, 77.438], [18.445, 77.435], [18.455, 77.432]]
    },
    {
      elevation: -2530,
      coords: [[18.420, 77.425], [18.430, 77.423], [18.440, 77.420], [18.450, 77.418]]
    },
    {
      elevation: -2500,
      coords: [[18.422, 77.412], [18.432, 77.410], [18.442, 77.408], [18.452, 77.405]]
    },
    {
      elevation: -2470,
      coords: [[18.425, 77.400], [18.435, 77.395], [18.445, 77.392], [18.455, 77.390]]
    }
  ]
};
