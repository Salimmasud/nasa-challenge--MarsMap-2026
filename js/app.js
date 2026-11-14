/**
 * ============================================================================
 * ARES-V // MARSWALK TACTICAL SURVIVAL GUIDE - HYBRID 3D GLOBE + 2D HiRISE APP
 * Outer Orbital View: 3D Spherical Mars Globe (Three.js + USGS WMS)
 * Inner Surface View: Crisp 2D Leaflet Tactical Map (NASA 25cm HiRISE + 7 Layers)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = window.JEZERO_DATA;
  const pathfinder = new window.JezeroPathfinder(data);
  const telemetry = new window.SpacesuitTelemetryModel();
  const audio = window.tacticalAudio;

  let map = null;
  let globe = null;
  let viewMode = 'orbital'; // 'orbital' (3D Mars Globe) | 'surface' (2D HiRISE Map)

  let currentBasemap = null;
  let activeRouteLayer = null;
  let comparisonStraightLine = null;
  let customWaypointMarker = null;
  let customOriginMarker = null;
  let customDestCoord = null;
  let mapClickMode = 'dest'; // 'dest' | 'origin'
  let currentO2Pct = 100;

  // 7 NASA Modality Layer Groups (2D Leaflet)
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
  // 1. Initialize 2D Leaflet Tactical Map + 3D Spherical Mars Globe
  // --------------------------------------------------------------------------
  function initMaps() {
    // A) 2D Leaflet Tactical Map (Inner Jezero EVA Surface)
    map = L.map('map', {
      center: data.center,
      zoom: data.defaultZoom,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);
    setBasemap('hirise');

    setupHazardLayer();
    setupThemisLayer();
    setupMineralLayer();
    setupThermalLayer();
    setupTraverseLayer();
    setupWaypointMarkers();
    setupContourLayer();

    hazardLayerGroup.addTo(map);
    themisLayerGroup.addTo(map);
    mineralLayerGroup.addTo(map);
    thermalLayerGroup.addTo(map);
    traverseLayerGroup.addTo(map);
    waypointLayerGroup.addTo(map);
    contourLayerGroup.addTo(map);

    map.on('mousemove', (e) => {
      if (viewMode === 'surface') {
        updateCursorHUD(e.latlng.lat, e.latlng.lng);
      }
    });

    map.on('click', (e) => {
      onSurfaceTargetSelected(e.latlng.lat, e.latlng.lng, true);
    });

    // Auto-transition back to 3D Mars Globe when user zooms all the way out of 2D Jezero map
    map.on('zoomend', () => {
      if (viewMode === 'surface' && map.getZoom() <= 10) {
        setViewMode('orbital');
        setTimeout(() => {
          map.setView(data.center, data.defaultZoom, { animate: false });
        }, 450);
      }
    });

    // B) 3D Spherical Mars Globe (Outer Orbital Mars Planet)
    try {
      globe = new window.JezeroMarsGlobe('globeView', data, pathfinder, {
        onHover: (lat, lon) => {
          if (viewMode === 'orbital') {
            updateCursorHUD(lat, lon);
          }
        },
        onEnterJezero: () => {
          audio.playClick();
          setViewMode('surface');
        },
        onWaypointClick: (wp) => {
          audio.playClick();
          setViewMode('surface');
          selectWaypoint(wp);
        },
        onGlobalLandmarkClick: (lm) => {
          audio.playClick();
          const latDir = lm.lat >= 0 ? 'N' : 'S';
          const lonDir = lm.lon >= 0 ? 'E' : 'W';
          document.getElementById('inspCoords').textContent = `${Math.abs(lm.lat).toFixed(2)}° ${latDir}, ${Math.abs(lm.lon).toFixed(2)}° ${lonDir}`;
          document.getElementById('inspElev').textContent = `${lm.elev} m`;
          document.getElementById('inspSlope').textContent = 'Planetary Scale';
          document.getElementById('inspSoil').textContent = 'Regional Mars Terrain';
          document.getElementById('inspMineral').textContent = `${lm.name} — ${lm.desc}`;
          document.getElementById('inspTemp').textContent = '-63°C (Global Mean)';
          document.getElementById('inspRad').textContent = '0.24 mSv/day (GCR Baseline)';
          document.getElementById('inspProv').textContent = 'USGS Astrogeology / MGS MOLA Verified';
        },
        onMapClick: (lat, lon) => {
          // If clicked inside Jezero EVA sector, route & inspect; otherwise inspect planetary coordinates
          const inJezero = lat >= 18.25 && lat <= 18.65 && lon >= 77.20 && lon <= 77.70;
          if (inJezero) {
            onSurfaceTargetSelected(lat, lon, false);
          } else {
            updateInspector(lat, lon);
          }
        }
      });
    } catch (e) {
      console.warn('3D Globe initialization error:', e);
    }

    calculateAndRenderRoute();
    setViewMode('orbital');
  }

  function updateCursorHUD(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    document.getElementById('hudCursorCoords').textContent =
      `LAT: ${Math.abs(lat).toFixed(4)}° ${latDir} | LON: ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
  }

  // --------------------------------------------------------------------------
  // 2. Hybrid View Mode Switcher ('orbital' 3D Globe <-> 'surface' 2D Map)
  // --------------------------------------------------------------------------
  function setViewMode(mode) {
    viewMode = mode;
    const globeEl = document.getElementById('globeView');
    const btnJezero = document.getElementById('btnFlyJezero');
    const btnOrbital = document.getElementById('btnFlyOrbital');

    if (mode === 'surface') {
      globeEl.classList.add('hidden-view');
      btnJezero.classList.add('btn-primary');
      btnJezero.classList.remove('btn-view3d');
      btnOrbital.classList.remove('btn-primary');
      btnOrbital.classList.add('btn-secondary');
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 80);
    } else {
      globeEl.classList.remove('hidden-view');
      btnOrbital.classList.add('btn-primary');
      btnOrbital.classList.remove('btn-secondary');
      btnJezero.classList.remove('btn-primary');
      btnJezero.classList.add('btn-view3d');
      if (globe) {
        globe.onResize();
        globe.flyToOrbital();
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Basemap Switcher (Both 2D Leaflet + 3D Globe)
  // --------------------------------------------------------------------------
  function setBasemap(type) {
    if (currentBasemap && map) {
      map.removeLayer(currentBasemap);
    }

    const group = L.layerGroup();

    if (type === 'hirise') {
      group.addLayer(L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/viking_mdim21_global/{z}/{x}/{y}.png', {
        maxNativeZoom: 7,
        maxZoom: 18,
        zIndex: 1,
        className: 'viking-underlay-tile'
      }));
      group.addLayer(L.tileLayer('https://mars.nasa.gov/mmgis-maps/M20/Layers/M20_HiRISE_RGB_mosaic_25cm_v4p2/{z}/{x}/{y}.png', {
        tms: true,
        minNativeZoom: 11,
        maxNativeZoom: 16,
        maxZoom: 18,
        zIndex: 2
      }));
      group.addLayer(L.tileLayer('https://mars.nasa.gov/mmgis-maps/M20/Layers/M20_Placenames_175k_800dpi/{z}/{x}/{y}.png', {
        tms: true,
        minNativeZoom: 11,
        maxNativeZoom: 16,
        maxZoom: 18,
        zIndex: 3,
        opacity: 0.55
      }));
    } else if (type === 'viking') {
      group.addLayer(L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/viking_mdim21_global/{z}/{x}/{y}.png', {
        maxNativeZoom: 7,
        maxZoom: 18,
        zIndex: 1
      }));
    } else if (type === 'mola-color') {
      group.addLayer(L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.png', {
        maxNativeZoom: 6,
        maxZoom: 18,
        zIndex: 1
      }));
    } else {
      group.addLayer(L.tileLayer('https://s3.us-east-2.amazonaws.com/opmmarstiles/hillshade-tiles/{z}/{x}/{y}.png', {
        maxNativeZoom: 6,
        maxZoom: 18,
        zIndex: 1
      }));
    }

    currentBasemap = group;
    currentBasemap.addTo(map);

    if (globe) {
      globe.loadGlobalBasemapTexture(type);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Setup All 7 NASA Data Modalities (2D Leaflet - High-Contrast Color Coding)
  // --------------------------------------------------------------------------
  function setupHazardLayer() {
    hazardLayerGroup.clearLayers();
    L.geoJSON(data.hazardsGeoJSON, {
      style: (feature) => {
        const isCritical = feature.properties.riskLevel === 'CRITICAL';
        return {
          color: isCritical ? '#ff2a4b' : '#00ff9d',
          weight: isCritical ? 3 : 2.5,
          opacity: 0.95,
          fillColor: isCritical ? '#ff2a4b' : '#00ff9d',
          fillOpacity: isCritical ? 0.48 : 0.35,
          dashArray: isCritical ? '6, 4' : null
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const isCritical = p.riskLevel === 'CRITICAL';
        layer.bindTooltip(`
          <div style="font-family:'Share Tech Mono',monospace;font-size:11px;">
            <strong style="color:${isCritical ? '#ff2a4b' : '#00ff9d'}">${isCritical ? 'CLIFF WALL HAZARD' : 'SAFE INGRESS CORRIDOR'}</strong><br>
            Slope: ${p.slope} | Status: ${p.riskLevel}<br>
            ${p.desc}
          </div>
        `, { sticky: true });
      }
    }).addTo(hazardLayerGroup);
  }

  function setupThemisLayer() {
    themisLayerGroup.clearLayers();
    L.geoJSON(data.themisSandTrapsGeoJSON, {
      style: () => ({
        color: '#fb923c',
        weight: 2.5,
        opacity: 0.92,
        fillColor: '#f97316',
        fillOpacity: 0.40,
        dashArray: '6, 4'
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindTooltip(`
          <div style="font-family:'Share Tech Mono',monospace;font-size:11px;">
            <strong style="color:#fb923c">THEMIS SAND TRAP</strong><br>
            Thermal Inertia: ${p.thermalInertia}<br>
            Risk: ${p.riskLevel}<br>
            ${p.desc}
          </div>
        `, { sticky: true });
      }
    }).addTo(themisLayerGroup);
  }

  function setupMineralLayer() {
    mineralLayerGroup.clearLayers();
    L.geoJSON(data.mineralsGeoJSON, {
      style: (feature) => {
        const col = feature.properties.colorCode || '#00f0ff';
        return {
          color: col,
          weight: 2.5,
          opacity: 0.95,
          fillColor: col,
          fillOpacity: 0.40
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const col = p.colorCode || '#00f0ff';
        layer.bindTooltip(`
          <div style="font-family:'Share Tech Mono',monospace;font-size:11px;">
            <strong style="color:${col}">${p.mineral}</strong><br>
            Unit: ${p.unit} (${p.spectralBand})<br>
            ${p.significance}
          </div>
        `, { sticky: true });
      }
    }).addTo(mineralLayerGroup);
  }

  function setupThermalLayer() {
    thermalLayerGroup.clearLayers();
    L.geoJSON(data.environmentGeoJSON, {
      style: (feature) => {
        const col = feature.properties.envType === 'cryo_shadow' ? '#a855f7' : '#818cf8';
        return {
          color: col,
          weight: 2.5,
          opacity: 0.95,
          fillColor: col,
          fillOpacity: 0.40,
          dashArray: '4, 4'
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const col = p.envType === 'cryo_shadow' ? '#c084fc' : '#818cf8';
        layer.bindTooltip(`
          <div style="font-family:'Share Tech Mono',monospace;font-size:11px;">
            <strong style="color:${col}">${p.envType === 'cryo_shadow' ? 'MEDA CRYOGENIC SHADOW' : 'RADIATION EXPOSURE RIDGE'}</strong><br>
            ${p.tempRating || p.doseRate}<br>
            ${p.desc}
          </div>
        `, { sticky: true });
      }
    }).addTo(thermalLayerGroup);
  }

  function setupTraverseLayer() {
    traverseLayerGroup.clearLayers();
    const poly = L.polyline(data.perseveranceTraverse, {
      color: '#fbbf24',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 6'
    }).addTo(traverseLayerGroup);
    poly.bindTooltip('Perseverance Rover Ground-Truth Traverse (Sol 0–1324)', { sticky: true });
  }

  function setupContourLayer() {
    contourLayerGroup.clearLayers();
    data.contours.forEach(c => {
      const line = L.polyline(c.coords, {
        color: '#e2e8f0',
        weight: 1.5,
        opacity: 0.65,
        dashArray: '3, 4'
      }).addTo(contourLayerGroup);
      line.bindTooltip(`Elevation Contour: ${c.elevation}m`, { sticky: true });
    });
  }

  function setupWaypointMarkers() {
    waypointLayerGroup.clearLayers();
    const labelPlacements = {
      base_camp: { direction: 'right', offset: [16, 0] },
      kodiak: { direction: 'bottom', offset: [0, 18] },
      neretva: { direction: 'top', offset: [0, -18] },
      margin: { direction: 'top', offset: [0, -16] },
      seitah: { direction: 'left', offset: [-16, 10] },
      belva: { direction: 'left', offset: [-16, 0] }
    };

    data.waypoints.forEach(wp => {
      const isBase = wp.type === 'base';
      const placement = labelPlacements[wp.id] || { direction: 'top', offset: [0, -14] };

      const icon = L.divIcon({
        className: 'tactical-marker',
        html: `<div class="marker-pin ${isBase ? 'base-pin' : ''}">${isBase ? '⛺' : '🔬'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(wp.coords, { icon }).addTo(waypointLayerGroup);

      marker.bindTooltip(wp.name.split('(')[0].trim(), {
        permanent: true,
        direction: placement.direction,
        offset: placement.offset,
        className: `tactical-wp-tooltip ${isBase ? 'base-tooltip' : ''}`
      });

      marker.bindPopup(`
        <div style="font-family:'Share Tech Mono',monospace;min-width:220px;">
          <h4 style="color:${isBase ? '#00ff9d' : '#00f0ff'};margin-bottom:4px;">${wp.name}</h4>
          <p style="font-size:11px;color:#cbd5e1;margin-bottom:6px;">${wp.description}</p>
          <div style="font-size:10px;color:#94a3b8;line-height:1.5;">
            <strong>Elev:</strong> ${wp.elevation}m | <strong>Slope:</strong> ${wp.slope}°<br>
            <strong>Mineral:</strong> ${wp.mineral}<br>
            <strong>Temp:</strong> ${wp.temp} | <strong>Rad:</strong> ${wp.radiation}<br>
            <strong>Target:</strong> <span style="color:#fbbf24;">${wp.scienceTarget}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button onclick="window.setRouteOrigin('${wp.id}')" style="flex:1;padding:5px;background:#10b981;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:2px;font-size:10px;">
              SET AS ORIGIN
            </button>
            <button onclick="window.setRouteDestination('${wp.id}')" style="flex:1;padding:5px;background:#00f0ff;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:2px;font-size:10px;">
              SET TARGET
            </button>
          </div>
        </div>
      `);

      marker.on('click', () => {
        audio.playClick();
        updateInspector(wp.coords[0], wp.coords[1]);
      });
    });
  }

  function selectWaypoint(wp) {
    if (!wp) return;
    currentEnd = [...wp.coords];
    customDestCoord = null;
    if (customWaypointMarker && map) {
      map.removeLayer(customWaypointMarker);
      customWaypointMarker = null;
    }
    const destSel = document.getElementById('routeDestination');
    if (destSel) destSel.value = wp.id;
    updateInspector(wp.coords[0], wp.coords[1]);
    calculateAndRenderRoute();
    if (map) {
      map.setView(wp.coords, Math.max(map.getZoom(), 13));
    }
  }

  window.setRouteOrigin = (wpId) => {
    const wp = data.waypoints.find(w => w.id === wpId);
    if (wp) {
      currentStart = [...wp.coords];
      if (customOriginMarker && map) {
        map.removeLayer(customOriginMarker);
        customOriginMarker = null;
      }
      const origSel = document.getElementById('routeOrigin');
      if (origSel) origSel.value = wp.id;
      updateInspector(wp.coords[0], wp.coords[1]);
      calculateAndRenderRoute();
      if (map) map.closePopup();
    }
  };

  window.setRouteDestination = (wpId) => {
    const wp = data.waypoints.find(w => w.id === wpId);
    if (wp) {
      selectWaypoint(wp);
      if (map) map.closePopup();
    }
  };

  // --------------------------------------------------------------------------
  // 5. Terrain & Microclimate Inspector
  // --------------------------------------------------------------------------
  function updateInspector(lat, lon) {
    const elev = Math.round(pathfinder.getElevation(lat, lon));

    let slopeDesc = '2.5° (Safe Flat)';
    let soilDesc = 'Consolidated Bedrock (1.0x)';
    let mineralDesc = 'Basaltic Regolith / Volcanic Floor';
    let tempDesc = `${data.medaSnapshot.airTemp} (Nominal)`;
    let radDesc = '0.24 mSv/day (GCR Baseline)';

    for (const f of data.hazardsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        if (f.properties.hazardType === 'cliff') {
          slopeDesc = `${f.properties.slope} (CRITICAL CLIFF WALL)`;
        } else if (f.properties.hazardType === 'safe_corridor') {
          slopeDesc = `${f.properties.slope} (Safe Ingress Breach)`;
        }
      }
    }

    for (const f of data.themisSandTrapsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        soilDesc = `Aeolian Dune Sand (${f.properties.riskLevel})`;
      }
    }

    for (const f of data.mineralsGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        mineralDesc = `${f.properties.mineral} [${f.properties.unit}]`;
      }
    }

    for (const f of data.environmentGeoJSON.features) {
      if (pathfinder.pointInPolygon([lat, lon], f.geometry.coordinates[0])) {
        if (f.properties.envType === 'cryo_shadow') {
          tempDesc = `${data.medaSnapshot.cryoTemp} (Cryogenic Cold Trap)`;
        } else if (f.properties.envType === 'radiation_ridge') {
          radDesc = f.properties.doseRate;
        }
      }
    }

    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    document.getElementById('inspCoords').textContent = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
    document.getElementById('inspElev').textContent = `${elev} m`;
    document.getElementById('inspSlope').textContent = slopeDesc;
    document.getElementById('inspSoil').textContent = soilDesc;
    document.getElementById('inspMineral').textContent = mineralDesc;
    document.getElementById('inspTemp').textContent = tempDesc;
    document.getElementById('inspRad').textContent = radDesc;
    document.getElementById('inspProv').textContent = 'NASA MGS/MRO/M2020 Multi-Mission Verified';
  }

  function onSurfaceTargetSelected(lat, lon, createMarker) {
    updateInspector(lat, lon);

    if (mapClickMode === 'origin') {
      currentStart = [lat, lon];
      const origSel = document.getElementById('routeOrigin');
      if (origSel) origSel.value = 'custom_origin';

      if (createMarker && map) {
        if (customOriginMarker) {
          map.removeLayer(customOriginMarker);
        }
        const icon = L.divIcon({
          className: 'tactical-marker',
          html: `
            <div class="marker-pin" style="background:#10b981;border-color:#fff;">🚩</div>
            <div class="marker-label">ASTRONAUT ORIGIN</div>
          `,
          iconSize: [96, 40],
          iconAnchor: [48, 20]
        });
        customOriginMarker = L.marker([lat, lon], { icon }).addTo(map);
      }
    } else {
      currentEnd = [lat, lon];
      customDestCoord = [lat, lon];
      const destSel = document.getElementById('routeDestination');
      if (destSel) destSel.value = 'custom_dest';

      if (createMarker && map) {
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
      }
    }

    audio.playClick();
    calculateAndRenderRoute();
  }

  // --------------------------------------------------------------------------
  // 6. A* Route Calculation & 2D/3D Synchronized Rendering
  // --------------------------------------------------------------------------
  function calculateAndRenderRoute() {
    audio.playClick();

    if (activeRouteLayer && map) map.removeLayer(activeRouteLayer);
    if (comparisonStraightLine && map) map.removeLayer(comparisonStraightLine);

    const route = pathfinder.findSafeRoute(currentStart, currentEnd);
    const isSolarEmergency = telemetry.solarStormActive;

    if (map) {
      if (route.detourKm > 0.15) {
        comparisonStraightLine = L.polyline([currentStart, currentEnd], {
          color: 'rgba(255, 42, 75, 0.45)',
          weight: 2,
          dashArray: '4, 8'
        }).addTo(map);
        comparisonStraightLine.bindTooltip('Straight Line (Cliff Hazard Blocked)', { sticky: true });
      }

      const latLngs = route.coordinates.map(c => [c.lat, c.lon]);
      const routeColor = isSolarEmergency ? '#ff2a4b' : '#00f0ff';

      activeRouteLayer = L.polyline(latLngs, {
        color: routeColor,
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    if (globe) {
      globe.renderRoute(route, currentStart, currentEnd, isSolarEmergency, customDestCoord);
    }

    const tData = telemetry.compute(route, false, false, currentO2Pct);
    updateHUDTelemetry(tData, route);

    const canvas = document.getElementById('elevationCanvas');
    telemetry.drawElevationProfile(canvas, route.coordinates);

    audio.playRoutePlotted();
  }

  function updateHUDTelemetry(tData, route) {
    document.getElementById('statDistance').innerHTML = `${tData.distanceKm} <span class="unit">km</span>`;
    document.getElementById('statDetour').textContent = route.detourKm > 0 ? `+${route.detourKm} km` : 'Direct Path';
    document.getElementById('statTime').textContent = tData.walkTimeFormatted;
    document.getElementById('statIncline').innerHTML = `+${tData.climbMeters} <span class="unit">m</span>`;
    document.getElementById('statMaxSlope').textContent = `${tData.maxSlopeDeg}°`;
    document.getElementById('statRadiation').innerHTML = `${tData.doseMsv} <span class="unit">mSv</span>`;

    document.getElementById('statHeartRate').textContent = `${tData.heartRateBpm} bpm`;
    document.getElementById('statMetabolic').textContent = `${tData.metabolicWatts} W`;
    const rtEl = document.getElementById('statRoundTripO2');
    rtEl.textContent = tData.roundTripO2Pct >= 0 ? `${tData.roundTripO2Pct}%` : `DEFICIT (${tData.roundTripO2Pct}%)`;
    rtEl.style.color = tData.roundTripO2Pct < 20 ? 'var(--hud-red)' : 'var(--hud-green)';

    const postTripClamped = Math.max(0, tData.o2RemainingPct);
    document.getElementById('meterO2Val').textContent = tData.o2FeasibleOneWay ? `${postTripClamped}%` : `INSUFFICIENT`;
    const o2Fill = document.getElementById('meterO2Fill');
    o2Fill.style.width = `${postTripClamped}%`;
    o2Fill.style.background = !tData.o2FeasibleOneWay ? 'var(--hud-red)' : (!tData.o2FeasibleRoundTrip ? 'var(--hud-amber)' : '');

    const o2Sub = document.getElementById('meterO2Sub');
    if (o2Sub) {
      o2Sub.textContent = `${tData.o2FlowLpm} L/min · 4.3 psi · Trip: ${tData.o2LitersUsed} L (${tData.o2KgUsed} kg / ${tData.o2TripPct}%)`;
    }

    const valCurrentO2 = document.getElementById('valCurrentO2');
    if (valCurrentO2) {
      valCurrentO2.textContent = `${tData.startO2Pct}% (${tData.currentO2Liters} L · ${tData.currentO2Psi} psi)`;
    }

    const banner = document.getElementById('o2GoNoGoBanner');
    if (banner) {
      if (!tData.o2FeasibleOneWay) {
        banner.className = 'o2-verdict critical';
        banner.textContent = `ABORT: Needs ${tData.o2LitersUsed} L (${tData.o2TripPct}%), you only have ${tData.currentO2Liters} L (${tData.startO2Pct}%)`;
      } else if (!tData.o2FeasibleRoundTrip) {
        banner.className = 'o2-verdict warning';
        banner.textContent = `ONE-WAY ONLY: ${postTripClamped}% left at target — recharge PLSS before return`;
      } else {
        banner.className = 'o2-verdict nominal';
        banner.textContent = `GO FOR EVA — ${tData.roundTripO2Pct}% PLSS O₂ margin after round-trip`;
      }
    }

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
  // 7. UI Controls & Event Listeners
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
      selectWaypoint(wp);
    }
  });

  document.getElementById('btnCalculateRoute').addEventListener('click', () => {
    calculateAndRenderRoute();
  });

  // Live A* Cost Model Tuning Sliders (inspired by AstraMap-resource)
  const bindCostSlider = (id, valId, suffix, applyFn) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (valEl) valEl.textContent = `${v}${suffix}`;
      applyFn(v);
      calculateAndRenderRoute();
    });
  };
  bindCostSlider('sliderSlopePenalty', 'valSlopePenalty', '', (v) => pathfinder.setCostParams({ slopePenalty: v }));
  bindCostSlider('sliderSandPenalty', 'valSandPenalty', 'x', (v) => pathfinder.setCostParams({ sandPenalty: v }));
  bindCostSlider('sliderThermalPenalty', 'valThermalPenalty', 'x', (v) => pathfinder.setCostParams({ thermalPenalty: v }));

  // Current PLSS O2 Reserve Simulator Slider
  const sliderCurrentO2 = document.getElementById('sliderCurrentO2');
  if (sliderCurrentO2) {
    sliderCurrentO2.addEventListener('input', (e) => {
      currentO2Pct = parseInt(e.target.value, 10) || 100;
      calculateAndRenderRoute();
    });
  }

  // Map Click Mode Toggle (Destination vs Origin Drop-Off)
  const btnModeDest = document.getElementById('btnClickModeDest');
  const btnModeOrigin = document.getElementById('btnClickModeOrigin');
  const setMapClickMode = (mode) => {
    mapClickMode = mode;
    if (btnModeDest) btnModeDest.classList.toggle('active', mode === 'dest');
    if (btnModeOrigin) btnModeOrigin.classList.toggle('active', mode === 'origin');
  };
  if (btnModeDest) btnModeDest.addEventListener('click', () => { audio.playClick(); setMapClickMode('dest'); });
  if (btnModeOrigin) btnModeOrigin.addEventListener('click', () => { audio.playClick(); setMapClickMode('origin'); });

  // Swap Origin <-> Destination (Return Trip)
  const btnSwapRoute = document.getElementById('btnSwapRoute');
  if (btnSwapRoute) {
    btnSwapRoute.addEventListener('click', () => {
      audio.playClick();
      const tmpCoord = [...currentStart];
      currentStart = [...currentEnd];
      currentEnd = tmpCoord;

      const origSel = document.getElementById('routeOrigin');
      const destSel = document.getElementById('routeDestination');
      if (origSel && destSel) {
        const tmpVal = origSel.value;
        origSel.value = destSel.value === 'custom_dest' ? 'custom_origin' : destSel.value;
        destSel.value = tmpVal === 'custom_origin' ? 'custom_dest' : tmpVal;
      }
      calculateAndRenderRoute();
    });
  }

  document.getElementById('btnClearRoute').addEventListener('click', () => {
    audio.playClick();
    customDestCoord = null;
    if (customWaypointMarker && map) {
      map.removeLayer(customWaypointMarker);
      customWaypointMarker = null;
    }
    if (customOriginMarker && map) {
      map.removeLayer(customOriginMarker);
      customOriginMarker = null;
    }
    if (activeRouteLayer && map) map.removeLayer(activeRouteLayer);
    if (comparisonStraightLine && map) map.removeLayer(comparisonStraightLine);
    if (globe) globe.clearRoute();

    currentStart = [...data.waypoints[0].coords];
    currentEnd = [...data.waypoints[1].coords];
    currentO2Pct = 100;
    if (sliderCurrentO2) sliderCurrentO2.value = '100';
    setMapClickMode('dest');
    document.getElementById('routeOrigin').value = 'base_camp';
    document.getElementById('routeDestination').value = 'kodiak';
    telemetry.setSolarStorm(false);
    calculateAndRenderRoute();
  });

  // View Mode Buttons (3D Mars Globe <-> 2D HiRISE Jezero EVA)
  document.getElementById('btnFlyJezero').addEventListener('click', () => {
    audio.playClick();
    if (viewMode === 'orbital' && globe) {
      globe.flyToJezeroAndEnter();
    } else {
      setViewMode('surface');
      if (map) map.setView(data.center, data.defaultZoom);
    }
  });

  document.getElementById('btnFlyOrbital').addEventListener('click', () => {
    audio.playClick();
    setViewMode('orbital');
  });

  // 7 NASA Data Layer Toggles (Synced to both 2D Leaflet & 3D Globe)
  const setupToggle = (checkboxId, leafletGroup, globeKey) => {
    const el = document.getElementById(checkboxId);
    if (!el) return;
    el.addEventListener('change', (e) => {
      audio.playClick();
      if (e.target.checked) {
        map.addLayer(leafletGroup);
      } else {
        map.removeLayer(leafletGroup);
      }
      if (globe) globe.setLayerVisible(globeKey, e.target.checked);
    });
  };

  setupToggle('layerHazards', hazardLayerGroup, 'hazards');
  setupToggle('layerThemis', themisLayerGroup, 'themis');
  setupToggle('layerMinerals', mineralLayerGroup, 'minerals');
  setupToggle('layerThermal', thermalLayerGroup, 'thermal');
  setupToggle('layerTraverse', traverseLayerGroup, 'traverse');
  setupToggle('layerWaypoints', waypointLayerGroup, 'waypoints');
  setupToggle('layerContours', contourLayerGroup, 'contours');

  // Layer Opacity Sliders (Synced to both 2D Leaflet & 3D Globe)
  const applyGroupOpacity = (group, factor) => {
    group.eachLayer(layer => {
      if (typeof layer.setStyle === 'function') {
        layer.setStyle({
          opacity: Math.min(1, Math.max(0.05, factor)),
          fillOpacity: Math.min(0.65, Math.max(0.02, factor * 0.45))
        });
      } else if (typeof layer.eachLayer === 'function') {
        applyGroupOpacity(layer, factor);
      }
    });
  };

  const setupOpacity = (sliderId, leafletGroup, globeKey) => {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    slider.addEventListener('input', (e) => {
      const factor = parseFloat(e.target.value) / 100;
      applyGroupOpacity(leafletGroup, factor);
      if (globe) globe.setLayerOpacity(globeKey, factor);
    });
  };

  setupOpacity('opacityHazards', hazardLayerGroup, 'hazards');
  setupOpacity('opacityThemis', themisLayerGroup, 'themis');
  setupOpacity('opacityMinerals', mineralLayerGroup, 'minerals');
  setupOpacity('opacityThermal', thermalLayerGroup, 'thermal');
  setupOpacity('opacityTraverse', traverseLayerGroup, 'traverse');
  setupOpacity('opacityContours', contourLayerGroup, 'contours');

  // Floating Collapsible HUD Drawers (Left & Right)
  const leftDrawer = document.getElementById('leftDrawer');
  const btnLeftDrawer = document.getElementById('btnToggleLeftDrawer');
  if (leftDrawer && btnLeftDrawer) {
    btnLeftDrawer.addEventListener('click', () => {
      const collapsed = leftDrawer.classList.toggle('drawer-collapsed');
      document.body.classList.toggle('left-drawer-collapsed', collapsed);
      btnLeftDrawer.setAttribute('aria-expanded', String(!collapsed));
      btnLeftDrawer.innerHTML = collapsed ? '&#9654;' : '&#9664;';
      audio.playClick();
    });
  }

  const rightDrawer = document.getElementById('rightDrawer');
  const btnRightDrawer = document.getElementById('btnToggleRightDrawer');
  if (rightDrawer && btnRightDrawer) {
    btnRightDrawer.addEventListener('click', () => {
      const collapsed = rightDrawer.classList.toggle('drawer-collapsed');
      btnRightDrawer.setAttribute('aria-expanded', String(!collapsed));
      btnRightDrawer.innerHTML = collapsed ? '&#9664;' : '&#9654;';
      audio.playClick();
    });
  }

  // Basemap Selector
  document.querySelectorAll('.basemap-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.basemap-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      setBasemap(e.target.dataset.basemap);
      audio.playClick();
    });
  });

  // Audio Toggle
  document.getElementById('btnToggleAudio').addEventListener('click', () => {
    const isEnabled = audio.toggle();
    document.getElementById('btnToggleAudio').innerHTML =
      `<span id="audioIcon">${isEnabled ? '🔊' : '🔇'}</span> SFX: ${isEnabled ? 'ON' : 'OFF'}`;
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
      mission: 'ARES-V EVA-77 JEZERO SECTOR',
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
    a.download = 'EVA_77_FLIGHT_PLAN_SOL1324.json';
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

  // Initialize Hybrid 3D Globe + 2D HiRISE Tactical Map
  initMaps();
  updateInspector(currentStart[0], currentStart[1]);
});
