/**
 * ============================================================================
 * ARES-V // MARSWALK TACTICAL SURVIVAL GUIDE - MAIN APPLICATION CONTROLLER
 * Integrates 2D Leaflet, 3D Three.js terrain, all 7 NASA data modalities,
 * real-time terrain inspector, and A* hazard pathfinding.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = window.JEZERO_DATA;
  const pathfinder = new window.JezeroPathfinder(data);
  const telemetry = new window.SpacesuitTelemetryModel();
  const audio = window.tacticalAudio;

  let terrain3D = null;
  let map = null;
  let currentBasemap = null;
  let activeRouteLayer = null;
  let comparisonStraightLine = null;
  let customWaypointMarker = null;

  // 7 NASA Modality Layer Groups
  const hazardLayerGroup = L.layerGroup();
  const themisLayerGroup = L.layerGroup();
  const mineralLayerGroup = L.layerGroup();
  const thermalLayerGroup = L.layerGroup();
  const traverseLayerGroup = L.layerGroup();
  const waypointLayerGroup = L.layerGroup();
  const contourLayerGroup = L.layerGroup();

  let currentStart = [...data.waypoints[0].coords]; // Base Camp
  let currentEnd = [...data.waypoints[1].coords];   // Kodiak Butte

  // --------------------------------------------------------------------------
  // 1. Initialize Leaflet Tactical Map
  // --------------------------------------------------------------------------
  function initMap() {
    map = L.map('map', {
      center: data.center,
      zoom: data.defaultZoom,
      minZoom: 11,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    setBasemap('openplanetary');

    // Setup all 7 NASA scientific layers
    setupHazardLayer();
    setupThemisLayer();
    setupMineralLayer();
    setupThermalLayer();
    setupTraverseLayer();
    setupWaypointMarkers();
    setupContourLayer();

    // Add to map by default
    hazardLayerGroup.addTo(map);
    themisLayerGroup.addTo(map);
    mineralLayerGroup.addTo(map);
    thermalLayerGroup.addTo(map);
    traverseLayerGroup.addTo(map);
    waypointLayerGroup.addTo(map);
    contourLayerGroup.addTo(map);

    // Map listeners
    map.on('mousemove', onMapMouseMove);
    map.on('click', onMapClick);

    // Initialize Synchronized 3D Terrain
    try {
      terrain3D = new window.JezeroTerrain3D('terrain3dCanvas', pathfinder);
    } catch (e) {
      console.warn("Three.js 3D Viewport error:", e);
    }

    // Compute Initial Route
    calculateAndRenderRoute();
  }

  // --------------------------------------------------------------------------
  // 2. Basemap Switcher
  // --------------------------------------------------------------------------
  function setBasemap(type) {
    if (currentBasemap) {
      map.removeLayer(currentBasemap);
    }

    if (type === 'openplanetary') {
      currentBasemap = L.tileLayer('https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png', {
        maxZoom: 16,
        subdomains: 'abcd'
      });
    } else if (type === 'satellite') {
      currentBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
      });
    } else {
      // USGS MOLA Shaded Relief
      currentBasemap = L.tileLayer('https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png', {
        maxZoom: 16,
        className: 'tactical-relief-filter'
      });
    }

    currentBasemap.addTo(map);
    currentBasemap.bringToBack();
  }

  // --------------------------------------------------------------------------
  // 3. Setup All 7 NASA Data Modalities
  // --------------------------------------------------------------------------

  // 1. HiRISE Slope Hazards
  function setupHazardLayer() {
    hazardLayerGroup.clearLayers();
    L.geoJSON(data.hazardsGeoJSON, {
      style: (feature) => {
        const type = feature.properties.hazardType;
        if (type === 'cliff') {
          return { color: '#ff2a4b', weight: 2.5, fillColor: '#ff2a4b', fillOpacity: 0.45, dashArray: '4, 4' };
        } else if (type === 'safe_corridor') {
          return { color: '#00ff9d', weight: 2, fillColor: '#00ff9d', fillOpacity: 0.25 };
        } else {
          return { color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.35 };
        }
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title">⚠ ${p.riskLevel}: ${p.hazardType.toUpperCase()}</div>
          <div class="popup-desc">${p.desc}</div>
          <div class="popup-science-badge">Slope: ${p.slope}</div>
          <div class="popup-science-badge" style="margin-left:4px;color:#798b9f;">${p.provenance}</div>
        `);
      }
    }).addTo(hazardLayerGroup);
  }

  // 2. THEMIS Thermal Inertia & Sand Traps
  function setupThemisLayer() {
    themisLayerGroup.clearLayers();
    L.geoJSON(data.themisSandTrapsGeoJSON, {
      style: () => ({
        color: '#fb923c',
        weight: 2,
        fillColor: '#ea580c',
        fillOpacity: 0.4,
        dashArray: '3, 6'
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title" style="color:#fb923c">🏜 ${p.riskLevel}</div>
          <div class="popup-desc">${p.desc}</div>
          <div class="popup-science-badge">Thermal Inertia: ${p.thermalInertia}</div>
          <div class="popup-science-badge" style="margin-left:4px;color:#798b9f;">${p.provenance}</div>
        `);
      }
    }).addTo(themisLayerGroup);
  }

  // 3. CRISM Spectral Mineralogy & Biosignatures
  function setupMineralLayer() {
    mineralLayerGroup.clearLayers();
    L.geoJSON(data.mineralsGeoJSON, {
      style: (feature) => ({
        color: feature.properties.colorCode,
        weight: 2,
        fillColor: feature.properties.colorCode,
        fillOpacity: 0.35
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title" style="color:${p.colorCode}">🔬 ${p.mineral}</div>
          <div class="popup-desc">${p.significance}</div>
          <div class="popup-science-badge">Absorption: ${p.spectralBand}</div>
          <div class="popup-science-badge" style="margin-left:4px;color:#798b9f;">Unit: ${p.unit}</div>
        `);
      }
    }).addTo(mineralLayerGroup);
  }

  // 4. MEDA & RAD Thermal Shadows & Radiation Ridges
  function setupThermalLayer() {
    thermalLayerGroup.clearLayers();
    L.geoJSON(data.environmentGeoJSON, {
      style: (feature) => {
        const isCryo = feature.properties.envType === 'cryo_shadow';
        return {
          color: isCryo ? '#c084fc' : '#f43f5e',
          weight: 2,
          fillColor: isCryo ? '#a855f7' : '#e11d48',
          fillOpacity: 0.35,
          dashArray: '6, 6'
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title">🌡 ${p.envType === 'cryo_shadow' ? 'CRYOGENIC COLD TRAP' : 'RADIATION RIDGE'}</div>
          <div class="popup-desc">${p.desc}</div>
          <div class="popup-science-badge">${p.tempRating || p.doseRate}</div>
        `);
      }
    }).addTo(thermalLayerGroup);
  }

  // 5. Perseverance Ground-Truth Rover Traverse
  function setupTraverseLayer() {
    traverseLayerGroup.clearLayers();
    const poly = L.polyline(data.perseveranceTraverse, {
      color: '#fbbf24',
      weight: 3,
      opacity: 0.85,
      dashArray: '5, 8'
    }).addTo(traverseLayerGroup);

    poly.bindTooltip("Perseverance Rover Ground-Truth Traverse Corridor", { sticky: true });
  }

  // 6. NASA Waypoints & Base Camp
  function setupWaypointMarkers() {
    waypointLayerGroup.clearLayers();
    data.waypoints.forEach(wp => {
      const isBase = wp.type === 'base';
      const icon = L.divIcon({
        className: 'tactical-marker',
        html: `
          <div class="marker-pin ${isBase ? 'base' : 'science'}">
            ${isBase ? '⬢' : '✦'}
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker(wp.coords, { icon });

      // Directional non-overlapping tooltip offsets to eliminate label collision
      let tooltipDirection = 'top';
      let tooltipOffset = [0, -14];
      if (wp.id === 'base_camp') {
        tooltipDirection = 'right';
        tooltipOffset = [14, 0];
      } else if (wp.id === 'seitah') {
        tooltipDirection = 'bottom';
        tooltipOffset = [0, 14];
      } else if (wp.id === 'kodiak') {
        tooltipDirection = 'left';
        tooltipOffset = [-14, 0];
      } else if (wp.id === 'belva') {
        tooltipDirection = 'left';
        tooltipOffset = [-14, 0];
      } else if (wp.id === 'neretva') {
        tooltipDirection = 'top';
        tooltipOffset = [0, -14];
      } else if (wp.id === 'margin') {
        tooltipDirection = 'top';
        tooltipOffset = [0, -14];
      }

      marker.bindTooltip(wp.name.split('(')[0].trim(), {
        permanent: true,
        direction: tooltipDirection,
        offset: tooltipOffset,
        className: `tactical-tooltip ${isBase ? 'base-tooltip' : 'science-tooltip'}`
      });

      marker.bindPopup(`
        <div class="popup-title">${wp.name}</div>
        <div class="popup-desc">${wp.description}</div>
        <div class="popup-science-badge">${wp.scienceTarget}</div>
        <div style="margin-top:8px;">
          <button class="hud-btn btn-primary" onclick="window.selectWaypointAsDestination('${wp.id}')" style="width:100%;font-size:9.5px;padding:4px 8px;">
            SET AS ROUTE TARGET
          </button>
        </div>
      `);
      marker.addTo(waypointLayerGroup);
    });
  }

  // 7. Topographic 10m Elevation Contours
  function setupContourLayer() {
    contourLayerGroup.clearLayers();
    data.contours.forEach(c => {
      const line = L.polyline(c.coords, {
        color: '#64748b',
        weight: 1.5,
        opacity: 0.6,
        dashArray: '2, 6'
      }).addTo(contourLayerGroup);

      line.bindTooltip(`${c.elevation} m Elevation Contour`, { sticky: true });
    });
  }

  window.selectWaypointAsDestination = function(id) {
    const wp = data.waypoints.find(w => w.id === id);
    if (!wp) return;
    document.getElementById('routeDestination').value = id;
    currentEnd = [...wp.coords];
    audio.playClick();
    updateInspector(wp.coords[0], wp.coords[1]);
    calculateAndRenderRoute();
  };

  // --------------------------------------------------------------------------
  // 4. Terrain & Microclimate Inspector
  // --------------------------------------------------------------------------
  function updateInspector(lat, lon) {
    const elev = Math.round(pathfinder.getElevation(lat, lon));
    
    // Check hazard polygons
    let slopeDesc = "2.5° (Safe Flat)";
    let soilDesc = "Consolidated Bedrock (1.0x)";
    let mineralDesc = "Basaltic Regolith / Volcanic Floor";
    let tempDesc = `${data.medaSnapshot.airTemp} (Nominal)`;
    let radDesc = "0.24 mSv/day (GCR Baseline)";

    // Hazards check
    for (const f of data.hazardsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        if (f.properties.hazardType === 'cliff') {
          slopeDesc = `${f.properties.slope} (CRITICAL CLIFF WALL)`;
        } else if (f.properties.hazardType === 'safe_corridor') {
          slopeDesc = `${f.properties.slope} (Safe Ingress Breach)`;
        }
      }
    }

    // THEMIS check
    for (const f of data.themisSandTrapsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        soilDesc = `Aeolian Dune Sand (${f.properties.riskLevel})`;
      }
    }

    // CRISM check
    for (const f of data.mineralsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        mineralDesc = `${f.properties.mineral} [${f.properties.unit}]`;
      }
    }

    // Thermal / Rad check
    for (const f of data.environmentGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        if (f.properties.envType === 'cryo_shadow') {
          tempDesc = `${data.medaSnapshot.cryoTemp} (Cryogenic Cold Trap)`;
        } else if (f.properties.envType === 'radiation_ridge') {
          radDesc = f.properties.doseRate;
        }
      }
    }

    document.getElementById('inspCoords').textContent = `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
    document.getElementById('inspElev').textContent = `${elev} m`;
    document.getElementById('inspSlope').textContent = slopeDesc;
    document.getElementById('inspSoil').textContent = soilDesc;
    document.getElementById('inspMineral').textContent = mineralDesc;
    document.getElementById('inspTemp').textContent = tempDesc;
    document.getElementById('inspRad').textContent = radDesc;
    document.getElementById('inspProv').textContent = "NASA MGS/MRO/M2020 Multi-Mission Verified";
  }

  function onMapMouseMove(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    document.getElementById('hudCursorCoords').textContent = `LAT: ${lat.toFixed(4)}° N | LON: ${lon.toFixed(4)}° E`;
  }

  function onMapClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    currentEnd = [lat, lon];
    updateInspector(lat, lon);

    if (customWaypointMarker) {
      map.removeLayer(customWaypointMarker);
    }

    const icon = L.divIcon({
      className: 'tactical-marker',
      html: `
        <div class="marker-pin" style="background:#ff2a4b;border-color:#fff;">📍</div>
        <div class="marker-label">CUSTOM TARGET</div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 20]
    });

    customWaypointMarker = L.marker([lat, lon], { icon }).addTo(map);
    audio.playClick();
    calculateAndRenderRoute();
  }

  // --------------------------------------------------------------------------
  // 5. A* Route Calculation & 2D/3D Rendering
  // --------------------------------------------------------------------------
  function calculateAndRenderRoute() {
    audio.playClick();

    if (activeRouteLayer) map.removeLayer(activeRouteLayer);
    if (comparisonStraightLine) map.removeLayer(comparisonStraightLine);

    const route = pathfinder.findSafeRoute(currentStart, currentEnd);

    // Dotted straight line if detour exists
    if (route.detourKm > 0.15) {
      comparisonStraightLine = L.polyline([currentStart, currentEnd], {
        color: 'rgba(255, 42, 75, 0.45)',
        weight: 2,
        dashArray: '4, 8'
      }).addTo(map);
      comparisonStraightLine.bindTooltip(`Straight Line (Cliff Hazard Blocked)`, { sticky: true });
    }

    const latLngs = route.coordinates.map(c => [c.lat, c.lon]);
    const isSolarEmergency = telemetry.solarStormActive;
    const routeColor = isSolarEmergency ? '#ff2a4b' : '#00f0ff';

    activeRouteLayer = L.polyline(latLngs, {
      color: routeColor,
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Compute Life Support Telemetry
    const tData = telemetry.compute(route, false, false);

    // Update HUD Metrics
    updateHUDTelemetry(tData, route);

    // Update 2D Elevation Canvas
    const canvas = document.getElementById('elevationCanvas');
    telemetry.drawElevationProfile(canvas, route.coordinates);

    // Update Synchronized 3D Terrain Route
    if (terrain3D) {
      terrain3D.updateRoute(route.coordinates, isSolarEmergency);
    }

    audio.playRoutePlotted();
  }

  function updateHUDTelemetry(tData, route) {
    document.getElementById('statDistance').innerHTML = `${tData.distanceKm} <span class="unit">km</span>`;
    document.getElementById('statDetour').textContent = route.detourKm > 0 ? `+${route.detourKm} km` : 'Direct Path';
    document.getElementById('statTime').textContent = tData.walkTimeFormatted;
    document.getElementById('statIncline').innerHTML = `+${tData.climbMeters} <span class="unit">m</span>`;
    document.getElementById('statMaxSlope').textContent = `${tData.maxSlopeDeg}°`;
    document.getElementById('statRadiation').innerHTML = `${tData.doseMsv} <span class="unit">mSv</span>`;

    document.getElementById('meterO2Val').textContent = `${tData.o2RemainingPct}%`;
    document.getElementById('meterO2Fill').style.width = `${tData.o2RemainingPct}%`;

    document.getElementById('meterBatteryVal').textContent = `${tData.batteryRemainingPct}%`;
    document.getElementById('meterBatteryFill').style.width = `${tData.batteryRemainingPct}%`;

    const radFillPct = Math.min(100, (tData.doseMsv / 50.0) * 100);
    document.getElementById('meterRadVal').textContent = `${tData.doseMsv} mSv (${radFillPct.toFixed(1)}%)`;
    document.getElementById('meterRadFill').style.width = `${Math.max(2, radFillPct)}%`;

    const badge = document.getElementById('suitStatusBadge');
    badge.textContent = tData.suitStatus;
    badge.className = `status-badge ${tData.statusClass}`;

    const logContainer = document.getElementById('advisoryLog');
    logContainer.innerHTML = '';
    const nowTime = getFormattedMTC();

    tData.advisories.forEach(adv => {
      const entry = document.createElement('div');
      entry.className = `log-entry log-${adv.type}`;
      entry.innerHTML = `<span class="log-time">[${nowTime}]</span> <span class="log-msg">${adv.text}</span>`;
      logContainer.appendChild(entry);
    });
  }

  // --------------------------------------------------------------------------
  // 6. UI Controls & Event Listeners
  // --------------------------------------------------------------------------
  document.getElementById('routeOrigin').addEventListener('change', (e) => {
    const wp = data.waypoints.find(w => w.id === e.target.value);
    if (wp) {
      currentStart = [...wp.coords];
      calculateAndRenderRoute();
    }
  });

  document.getElementById('routeDestination').addEventListener('change', (e) => {
    const wp = data.waypoints.find(w => w.id === e.target.value);
    if (wp) {
      currentEnd = [...wp.coords];
      if (customWaypointMarker) {
        map.removeLayer(customWaypointMarker);
        customWaypointMarker = null;
      }
      updateInspector(wp.coords[0], wp.coords[1]);
      calculateAndRenderRoute();
    }
  });

  document.getElementById('btnCalculateRoute').addEventListener('click', calculateAndRenderRoute);

  document.getElementById('btnClearRoute').addEventListener('click', () => {
    currentStart = [...data.waypoints[0].coords];
    currentEnd = [...data.waypoints[1].coords];
    document.getElementById('routeOrigin').value = 'base_camp';
    document.getElementById('routeDestination').value = 'kodiak';
    if (customWaypointMarker) {
      map.removeLayer(customWaypointMarker);
      customWaypointMarker = null;
    }
    telemetry.setSolarStorm(false);
    updateInspector(currentStart[0], currentStart[1]);
    calculateAndRenderRoute();
  });

  // Layer Toggles
  const setupToggle = (id, group) => {
    document.getElementById(id).addEventListener('change', (e) => {
      if (e.target.checked) map.addLayer(group);
      else map.removeLayer(group);
      audio.playClick();
    });
  };

  setupToggle('layerHazards', hazardLayerGroup);
  setupToggle('layerThemis', themisLayerGroup);
  setupToggle('layerMinerals', mineralLayerGroup);
  setupToggle('layerThermal', thermalLayerGroup);
  setupToggle('layerTraverse', traverseLayerGroup);
  setupToggle('layerWaypoints', waypointLayerGroup);
  setupToggle('layerContours', contourLayerGroup);

  // Basemap Selector
  document.querySelectorAll('.basemap-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.basemap-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      setBasemap(e.target.dataset.basemap);
      audio.playClick();
    });
  });

  // 3D Viewport Controls
  const panel3D = document.getElementById('terrain3dPanel');
  const btnToggle3D = document.getElementById('btnToggle3D');

  btnToggle3D.addEventListener('click', () => {
    panel3D.classList.toggle('closed');
    const isClosed = panel3D.classList.contains('closed');
    btnToggle3D.textContent = isClosed ? '🌐 3D TERRAIN: OFF' : '🌐 3D TERRAIN: ON';
    if (!isClosed && terrain3D) {
      setTimeout(() => terrain3D.onResize(), 60);
    }
    audio.playClick();
  });

  document.getElementById('btnClose3D').addEventListener('click', () => {
    panel3D.classList.add('closed');
    btnToggle3D.textContent = '🌐 3D TERRAIN: OFF';
    audio.playClick();
  });

  document.getElementById('btnReset3DCamera').addEventListener('click', () => {
    if (terrain3D) terrain3D.resetCamera();
    audio.playClick();
  });

  document.getElementById('btnToggle3DRotate').addEventListener('click', () => {
    if (terrain3D) {
      const active = terrain3D.toggleAutoRotate();
      document.getElementById('btnToggle3DRotate').style.color = active ? 'var(--hud-cyan)' : 'var(--text-dim)';
    }
    audio.playClick();
  });

  // Audio Toggle
  document.getElementById('btnToggleAudio').addEventListener('click', () => {
    const isEnabled = audio.toggle();
    document.getElementById('audioIcon').textContent = isEnabled ? '🔊' : '🔇';
    document.getElementById('btnToggleAudio').innerHTML = `<span id="audioIcon">${isEnabled ? '🔊' : '🔇'}</span> SFX: ${isEnabled ? 'ON' : 'OFF'}`;
  });

  // Emergency SPE Modal
  const emergencyModal = document.getElementById('emergencyModal');

  document.getElementById('btnSolarStorm').addEventListener('click', () => {
    emergencyModal.classList.add('active');
    audio.playEmergencyAlarm();
  });

  document.getElementById('btnConfirmEmergency').addEventListener('click', () => {
    emergencyModal.classList.remove('active');
    telemetry.setSolarStorm(true);

    currentStart = [...currentEnd];
    currentEnd = [...data.waypoints[0].coords];
    document.getElementById('routeOrigin').value = 'kodiak';
    document.getElementById('routeDestination').value = 'base_camp';

    calculateAndRenderRoute();
  });

  document.getElementById('btnDismissEmergency').addEventListener('click', () => {
    emergencyModal.classList.remove('active');
    telemetry.setSolarStorm(false);
    calculateAndRenderRoute();
  });

  // Export Plan JSON
  document.getElementById('btnExportEVA').addEventListener('click', () => {
    audio.playClick();
    const route = pathfinder.findSafeRoute(currentStart, currentEnd);
    const tData = telemetry.compute(route);

    const logData = {
      mission: "ARES-V EVA-77 JEZERO SECTOR",
      sol: 1324,
      mtc: getFormattedMTC(),
      origin: currentStart,
      destination: currentEnd,
      totalDistanceKm: route.totalDistanceKm,
      detourAvoidedKm: route.detourKm,
      estimatedWalkTime: tData.walkTimeFormatted,
      maxSlopeDeg: route.maxSlopeDeg,
      remainingO2Percent: tData.o2RemainingPct,
      remainingBatteryPercent: tData.batteryRemainingPct,
      cumulativeRadiationMsv: tData.doseMsv,
      bypassedHazards: route.bypassedHazards,
      coordinates: route.coordinates,
      medaConditions: data.medaSnapshot
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EVA_77_FLIGHT_PLAN_SOL1324.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function getFormattedMTC() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  setInterval(() => {
    document.getElementById('hudMTC').textContent = getFormattedMTC();
  }, 1000);

  // Initialize Map
  initMap();
  updateInspector(currentStart[0], currentStart[1]);
});
