/**
 * ============================================================================
 * ARES-V // ASTRONAUT EVA METABOLIC & SPACESUIT LIFE SUPPORT MODEL (NASA xEMU)
 * Computes dynamic O2, battery thermal drain, and cumulative radiation (mSv)
 * ============================================================================
 */

class SpacesuitTelemetryModel {
  constructor() {
    this.NOMINAL_EVA_HOURS = 8.0;
    this.BASE_WALK_SPEED_KMH = 3.6; // Mars 0.38g nominal hiking speed
    this.BASE_O2_RATE_PCT_PER_KM = 3.4;
    this.BASE_BATTERY_PCT_PER_KM = 4.0;
    this.GCR_BASE_MSV_PER_KM = 0.032;

    this.solarStormActive = false;
  }

  setSolarStorm(active) {
    this.solarStormActive = active;
  }

  compute(routeAnalysis, isInShadowZone = false, isHighRadiationZone = false) {
    const dist = routeAnalysis.totalDistanceKm || 0.1;
    const climb = routeAnalysis.totalClimbM || 0;
    const maxSlope = routeAnalysis.maxSlopeDeg || 0;

    // Mars 0.38g hiking speed adjusted for slope (Minetti / Tobler hiking function)
    let speedKmh = this.BASE_WALK_SPEED_KMH;
    if (maxSlope > 6) {
      speedKmh = Math.max(1.8, this.BASE_WALK_SPEED_KMH - (maxSlope * 0.14));
    }
    const walkTimeHours = dist / speedKmh;
    const totalMinutes = Math.round(walkTimeHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;

    // Metabolic O2 expenditure
    const inclineO2Penalty = (climb / 100) * 1.8;
    let o2ConsumedPct = (dist * this.BASE_O2_RATE_PCT_PER_KM) + inclineO2Penalty;
    let o2RemainingPct = Math.max(12, Math.round(100 - o2ConsumedPct));

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

    // Status Badge
    let suitStatus = "NOMINAL";
    let statusClass = "normal";

    if (this.solarStormActive) {
      suitStatus = "CRITICAL: SPE FLUX";
      statusClass = "critical";
    } else if (o2RemainingPct < 30 || batteryRemainingPct < 30 || maxSlope > 18) {
      suitStatus = "WARNING: HIGH LOAD";
      statusClass = "warning";
    }

    // Dynamic Advisories
    const advisories = [];
    advisories.push({
      type: "safe",
      text: `A* Navigation: Safe route established (${dist} km, ${timeFormatted} at 0.38g).`
    });

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
        text: `Radiation Status: Galactic Cosmic Ray background stable (${doseMsv} mSv cumulative).`
      });
    }

    return {
      distanceKm: dist,
      walkTimeFormatted: timeFormatted,
      totalMinutes: totalMinutes,
      climbMeters: climb,
      maxSlopeDeg: maxSlope,
      o2RemainingPct: o2RemainingPct,
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
