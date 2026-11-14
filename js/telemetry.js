/**
 * ============================================================================
 * ARES-V // ASTRONAUT EVA METABOLIC & SPACESUIT LIFE SUPPORT MODEL (NASA xEMU)
 * Computes dynamic O2, battery thermal drain, and cumulative radiation (mSv)
 * ============================================================================
 */

class SpacesuitTelemetryModel {
  constructor() {
    // NASA xEMU PLSS & NASA-STD-3001 / HIDH Reference Parameters
    this.NOMINAL_EVA_HOURS = 8.0;           // NASA/TM-20205008709 xEMU 8-hr EVA
    this.PLSS_O2_CAPACITY_L = 530.0;        // ~0.757 kg usable O2 at STP (1.429 g/L)
    this.PLSS_O2_CAPACITY_KG = 0.757;       // High-pressure primary O2 tank mass
    this.PLSS_TANK_MAX_PSI = 3000;          // Primary tank pressure (suit loop: 4.3 psi)
    this.BASE_WALK_SPEED_KMH = 2.88;        // 0.80 m/s nominal pressurized EVA speed (NASA Analog ConOps)
    this.BASE_BATTERY_PCT_PER_KM = 4.0;
    this.GCR_BASE_MSV_PER_KM = 0.032;       // MSL/RAD Jezero surface GCR baseline

    this.solarStormActive = false;
  }

  setSolarStorm(active) {
    this.solarStormActive = active;
  }

  compute(routeAnalysis, isInShadowZone = false, isHighRadiationZone = false, currentO2Pct = 100) {
    const dist = routeAnalysis.totalDistanceKm || 0.1;
    const climb = routeAnalysis.totalClimbM || 0;
    const maxSlope = routeAnalysis.maxSlopeDeg || 0;
    const startO2Pct = Math.max(5, Math.min(100, Number(currentO2Pct) || 100));

    // Mars 0.38g pressurized suit speed adjusted for slope (NASA Analog + Tobler/Minetti)
    let speedKmh = this.BASE_WALK_SPEED_KMH;
    if (maxSlope > 4) {
      speedKmh = Math.max(1.4, this.BASE_WALK_SPEED_KMH - ((maxSlope - 4) * 0.12));
    }
    const walkTimeHours = dist / speedKmh;
    const totalMinutes = Math.round(walkTimeHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;

    // NASA-STD-3001 / HIDH Metabolic O2 expenditure (1000 BTU/hr = 293 W baseline, 20.1 kJ/L O2)
    const walkTimeSec = walkTimeHours * 3600;
    const climbRate = walkTimeHours > 0 ? (climb / walkTimeHours) : 0;
    const metabolicWatts = Math.round(293 + (maxSlope * 4.5) + Math.min(145, climbRate * 0.50));
    const metabolicBtuHr = Math.round(metabolicWatts * 3.412);
    const o2FlowLpm = Number((((metabolicWatts / 1000) * 60) / 20.1).toFixed(2));
    const o2LitersUsed = Number(((metabolicWatts * walkTimeSec) / 20100).toFixed(1));
    const o2KgUsed = Number((o2LitersUsed * 0.001429).toFixed(3));

    const o2TripPct = Number(((o2LitersUsed / this.PLSS_O2_CAPACITY_L) * 100).toFixed(1));
    const currentO2Liters = Number(((startO2Pct / 100) * this.PLSS_O2_CAPACITY_L).toFixed(1));
    const currentO2Psi = Math.round((startO2Pct / 100) * this.PLSS_TANK_MAX_PSI);

    const o2RemainingPct = Math.round(startO2Pct - o2TripPct);
    const roundTripO2Pct = Math.round(startO2Pct - (o2TripPct * 2));
    const o2FeasibleOneWay = startO2Pct >= o2TripPct;
    const o2FeasibleRoundTrip = startO2Pct >= (o2TripPct * 2);

    // Crew Biometrics (NASA-STD-3001 cardiovascular & CO2 limits)
    const heartRateBpm = Math.min(165, Math.round(82 + (metabolicWatts - 293) * 0.34 + (this.solarStormActive ? 14 : 0)));
    const co2MmHg = Number((1.8 + (metabolicWatts - 280) * 0.008).toFixed(1));

    // Suit Battery & Sublimator / Heater Drain
    let batteryDrainPct = (dist * this.BASE_BATTERY_PCT_PER_KM);
    if (isInShadowZone) {
      batteryDrainPct *= 1.35; // +35% heater load in cryogenic cold shadow
    }
    let batteryRemainingPct = Math.max(15, Math.round(100 - batteryDrainPct));

    // Radiation Dose (mSv)
    let doseMsv = (dist * this.GCR_BASE_MSV_PER_KM);
    if (isHighRadiationZone) {
      doseMsv *= 2.2;
    }
    if (this.solarStormActive) {
      doseMsv += (walkTimeHours * 24.5); // Solar Particle Event spike
    }
    doseMsv = Number(doseMsv.toFixed(3));

    // Status Badge (Go / No-Go Check)
    let suitStatus = "NOMINAL";
    let statusClass = "normal";

    if (this.solarStormActive) {
      suitStatus = "CRITICAL: SPE FLUX";
      statusClass = "critical";
    } else if (!o2FeasibleOneWay) {
      suitStatus = "ABORT: O₂ INSUFFICIENT";
      statusClass = "critical";
    } else if (!o2FeasibleRoundTrip || o2RemainingPct < 25 || batteryRemainingPct < 30 || maxSlope > 18) {
      suitStatus = !o2FeasibleRoundTrip ? "WARN: ONE-WAY O₂ ONLY" : "WARNING: HIGH LOAD";
      statusClass = "warning";
    }

    // Dynamic Advisories
    const advisories = [];
    advisories.push({
      type: "safe",
      text: `A* Navigation: ${dist} km, ${timeFormatted} at ${speedKmh.toFixed(2)} km/h (0.38g NASA ConOps).`
    });

    if (!o2FeasibleOneWay) {
      advisories.push({
        type: "critical",
        text: `ABORT TRAVERSE: Route needs ${o2LitersUsed} L (${o2TripPct}% / ${o2KgUsed} kg) O₂, exceeding your ${startO2Pct}% (${currentO2Liters} L) PLSS reserve!`
      });
    } else if (!o2FeasibleRoundTrip) {
      advisories.push({
        type: "warn",
        text: `No Return Margin: ${o2LitersUsed} L (${o2TripPct}%) one-way leaves ${Math.max(0, o2RemainingPct)}% O₂ — recharge PLSS before returning.`
      });
    }

    if (routeAnalysis.detourKm > 0.4) {
      advisories.push({
        type: "warn",
        text: `Hazard Avoidance: +${routeAnalysis.detourKm} km detour navigated around steep cliff face.`
      });
    }

    if (isInShadowZone) {
      advisories.push({
        type: "warn",
        text: `Cryogenic Shadow Zone: Temp < -110°C. Suit thermal heater drain increased by +35%.`
      });
    }

    if (this.solarStormActive) {
      advisories.push({
        type: "critical",
        text: `CRITICAL: Solar Particle Event (SPE) Active! Flux +48 mSv/hr. Return to Base Camp immediately!`
      });
    } else {
      advisories.push({
        type: "info",
        text: `PLSS Flow: ${o2FlowLpm} L/min (${metabolicBtuHr} BTU/hr) | HR ${heartRateBpm} bpm | CO₂ ${co2MmHg} mmHg.`
      });
    }

    return {
      distanceKm: dist,
      speedKmh: Number(speedKmh.toFixed(2)),
      walkTimeFormatted: timeFormatted,
      totalMinutes: totalMinutes,
      climbMeters: climb,
      maxSlopeDeg: maxSlope,
      startO2Pct: startO2Pct,
      currentO2Liters: currentO2Liters,
      currentO2Psi: currentO2Psi,
      o2FlowLpm: o2FlowLpm,
      o2LitersUsed: o2LitersUsed,
      o2KgUsed: o2KgUsed,
      o2TripPct: o2TripPct,
      o2RemainingPct: o2RemainingPct,
      roundTripO2Pct: roundTripO2Pct,
      o2FeasibleOneWay: o2FeasibleOneWay,
      o2FeasibleRoundTrip: o2FeasibleRoundTrip,
      metabolicWatts: metabolicWatts,
      metabolicBtuHr: metabolicBtuHr,
      heartRateBpm: heartRateBpm,
      co2MmHg: co2MmHg,
      batteryRemainingPct: batteryRemainingPct,
      doseMsv: doseMsv,
      suitStatus: suitStatus,
      statusClass: statusClass,
      advisories: advisories
    };
  }

  drawElevationProfile(canvas, pathCoords) {
    if (!canvas || !pathCoords || pathCoords.length < 2) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const elevs = pathCoords.map(p => p.elevation || -2550);
    const minElev = Math.min(...elevs) - 5;
    const maxElev = Math.max(...elevs) + 10;
    const range = Math.max(20, maxElev - minElev);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 15; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Plot terrain curve
    ctx.beginPath();
    ctx.moveTo(0, height);

    const stepX = width / (pathCoords.length - 1);
    const points = [];

    for (let i = 0; i < pathCoords.length; i++) {
      const x = i * stepX;
      const elev = pathCoords[i].elevation;
      const y = height - ((elev - minElev) / range) * (height - 25) - 10;
      points.push({ x, y, elev });
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Plot colored slope segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const diff = Math.abs(p2.elev - p1.elev);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = 2.5;

      if (diff > 12) {
        ctx.strokeStyle = '#ff2a4b'; // Red cliff
      } else if (diff > 5) {
        ctx.strokeStyle = '#f59e0b'; // Amber moderate slope
      } else {
        ctx.strokeStyle = '#00ff9d'; // Green safe flat
      }
      ctx.stroke();
    }

    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = '#798b9f';
    ctx.fillText(`${Math.round(maxElev)} m`, 8, 16);
    ctx.fillText(`${Math.round(minElev)} m`, 8, height - 6);
  }
}

window.SpacesuitTelemetryModel = SpacesuitTelemetryModel;
