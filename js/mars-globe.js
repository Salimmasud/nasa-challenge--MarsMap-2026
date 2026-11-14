/**
 * ============================================================================
 * ARES-V // 3D SPHERICAL MARS GLOBE ENGINE (Three.js)
 * Ellipsoid(3396190, 3396190, 3376200) | Zero-API-Key | GitHub Pages Ready
 * Combines USGS Astrogeology Mars WMS (ACAO=*) global equirectangular textures,
 * procedural Mars fallback, feathered 3D Jezero Crater DEM relief patch,
 * Martian atmospheric limb glow, and all 7 draped NASA scientific layers.
 * ============================================================================
 */

class JezeroMarsGlobe {
  constructor(containerId, data, pathfinder, callbacks = {}) {
    this.container = document.getElementById(containerId);
    this.data = data;
    this.pathfinder = pathfinder;
    this.callbacks = callbacks;

    // True Mars Ellipsoid proportions (3396.19 km eq, 3376.20 km polar)
    this.R_EQ = 100.0;
    this.R_POLAR = 100.0 * (3376200 / 3396190); // ~99.4114
    this.DATUM_ELEV = -2550; // Jezero floor datum so all terrain & overlays sit ABOVE the sphere
    this.ELEV_SCALE = 0.00012; // Crisp tactical surface relief on curved Mars sphere

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.marsMesh = null;
    this.marsMaterial = null;
    this.jezeroPatchMesh = null;
    this.jezeroPatchMaterial = null;

    // Camera fly-to animation state
    this.flyAnim = null;
    this.zoomTriggerLock = false;

    // Layer groups in 3D space
    this.layerGroups = {
      hazards: new THREE.Group(),
      themis: new THREE.Group(),
      minerals: new THREE.Group(),
      thermal: new THREE.Group(),
      traverse: new THREE.Group(),
      waypoints: new THREE.Group(),
      contours: new THREE.Group(),
      route: new THREE.Group()
    };

    this.waypointMeshes = [];
    this.globalLandmarkMeshes = [];
    this.globalLandmarks = [
      { id: 'olympus', name: 'Olympus Mons', lat: 18.65, lon: -133.8, elev: 21229, desc: 'Tallest planetary volcano in the Solar System (~21.9 km)' },
      { id: 'valles', name: 'Valles Marineris', lat: -13.9, lon: -59.2, elev: -4000, desc: '4,000 km tectonic canyon system across Martian equator' },
      { id: 'gale', name: 'Gale Crater (Curiosity)', lat: -5.4, lon: 137.8, elev: -4500, desc: 'MSL Curiosity rover landing site & Mount Sharp' },
      { id: 'hellas', name: 'Hellas Planitia', lat: -42.4, lon: 70.5, elev: -7152, desc: 'Largest visible impact basin on Mars (~2,300 km)' },
      { id: 'syrtis', name: 'Syrtis Major', lat: 8.4, lon: 69.5, elev: 1200, desc: 'Dark basaltic shield volcano just SW of Jezero Crater' },
      { id: 'elysium', name: 'Elysium Mons', lat: 25.02, lon: 147.21, elev: 12600, desc: 'Major volcanic rise in the eastern hemisphere' },
      { id: 'tharsis', name: 'Tharsis Montes', lat: 1.5, lon: -112.6, elev: 14000, desc: 'Chain of three giant shield volcanoes' },
      { id: 'north_pole', name: 'Planum Boreum (Ice Cap)', lat: 86.0, lon: 0.0, elev: -2000, desc: 'North polar layered water-ice & dry-ice deposits' }
    ];
    this.labelOverlay = null;
    this.waypointLabels = [];
    this.globalLandmarkLabels = [];
    this.orbitalPinEl = null;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDownPos = { x: 0, y: 0 };

    this.currentBasemap = 'hirise';
    this.usgsWmsBase = 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map&SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&STYLES=&FORMAT=image/png&SRS=EPSG:4326';

    this.init();
  }

  init() {
    if (!this.container || typeof THREE === 'undefined') return;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    // 1. Scene & Deep Space Backdrop
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030508);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.02, 2500);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.5;
    this.controls.minDistance = 0.14;
    this.controls.maxDistance = 420;

    // 5. Lighting (Solar directional light + soft ambient Mars bounce)
    const ambient = new THREE.AmbientLight(0xd8c3b4, 0.72);
    this.scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff4e6, 1.35);
    sunLight.position.set(220, 140, -180);
    this.scene.add(sunLight);

    const rimFill = new THREE.DirectionalLight(0x38bdf8, 0.22);
    rimFill.position.set(-180, -80, 160);
    this.scene.add(rimFill);

    // 6. Build Starfield, Mars Ellipsoid, Atmosphere Limb Glow, Regional Basin & Jezero 3D Patch
    this.buildStarfield();
    this.buildMarsGlobe();
    this.buildAtmosphereGlow();
    this.buildRegionalBasinPatch();
    this.buildJezeroReliefPatch();

    // 7. Attach all 7 NASA Scientific Layer Groups + Route Group
    Object.values(this.layerGroups).forEach(g => this.scene.add(g));
    this.buildAllScientificLayers();

    // 8. HTML Projected Labels Overlay
    this.createLabelOverlay();

    // 9. Start with dramatic orbital view centered over Jezero Crater
    this.setOrbitalCameraImmediate();

    // 10. Event Listeners
    this.bindEvents();

    // 11. Render Loop
    this.animate();
  }

  // --------------------------------------------------------------------------
  // Coordinate Math: Ellipsoid Lat/Lon <-> 3D Scene Vec3
  // Matches Three.js SphereGeometry UV mapping (EPSG:4326 BBOX=-180,-90,180,90)
  // --------------------------------------------------------------------------
  latLonToVec3(latDeg, lonDeg, elevMeters = -2550, extraOffset = 0) {
    const latRad = (latDeg * Math.PI) / 180;
    const phi = ((lonDeg + 180) * Math.PI) / 180;

    // Normalize relative to Jezero floor datum (-2550m) so surface relief & layers never sink underground
    const relElev = Math.max(-350, elevMeters - this.DATUM_ELEV);
    const radialOffset = (relElev * this.ELEV_SCALE) + extraOffset;
    const rEq = this.R_EQ + radialOffset;
    const rPol = this.R_POLAR + radialOffset;

    const x = -rEq * Math.cos(phi) * Math.cos(latRad);
    const y = rPol * Math.sin(latRad);
    const z = rEq * Math.sin(phi) * Math.cos(latRad);
    return new THREE.Vector3(x, y, z);
  }

  vec3ToLatLon(vec) {
    const horiz = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
    const latRad = Math.atan2(vec.y / this.R_POLAR, horiz / this.R_EQ);
    let phi = Math.atan2(vec.z, -vec.x);
    if (phi < 0) phi += Math.PI * 2;
    const lat = (latRad * 180) / Math.PI;
    const lon = (phi * 180) / Math.PI - 180;
    return { lat, lon };
  }

  // --------------------------------------------------------------------------
  // Starfield Backdrop
  // --------------------------------------------------------------------------
  buildStarfield() {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 750 + Math.random() * 450;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;

      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      const tint = 0.78 + Math.random() * 0.22;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint;
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  // --------------------------------------------------------------------------
  // Seamless Global Mars Ellipsoid + Procedural Base + Live USGS WMS Texture
  // --------------------------------------------------------------------------
  buildMarsGlobe() {
    const geo = new THREE.SphereGeometry(1, 128, 64);
    geo.scale(this.R_EQ, this.R_POLAR, this.R_EQ);

    const fallbackTex = this.createProceduralMarsTexture();
    this.marsMaterial = new THREE.MeshStandardMaterial({
      map: fallbackTex,
      roughness: 0.88,
      metalness: 0.04
    });

    this.marsMesh = new THREE.Mesh(geo, this.marsMaterial);
    this.scene.add(this.marsMesh);

    this.loadGlobalBasemapTexture('hirise');
  }

  createProceduralMarsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base Martian iron-oxide gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#d8d2cb'); // North polar frost
    grad.addColorStop(0.08, '#9e5034');
    grad.addColorStop(0.35, '#b85c38');
    grad.addColorStop(0.55, '#a44a2a');
    grad.addColorStop(0.88, '#8d4329');
    grad.addColorStop(1.0, '#d4cdc5'); // South polar frost
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle albedo mottling (Syrtis Major, Hellas, Valles Marineris)
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 1024;
      const y = 40 + Math.random() * 432;
      const rx = 12 + Math.random() * 75;
      const ry = 6 + Math.random() * 35;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(65, 32, 22, 0.14)' : 'rgba(218, 128, 82, 0.10)';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  loadGlobalBasemapTexture(type) {
    this.currentBasemap = type;

    // Keep global Mars sphere in natural rusty-orange Viking MDIM 2.1 by default (never solid green)
    let layerName = 'MDIM21_color';
    if (type === 'mola') layerName = 'HRSC_MOLA_Blend_Hillshade';
    else if (type === 'mola-color') layerName = 'MOLA_color';
    else if (type === 'viking') layerName = 'MDIM21_color';
    else if (type === 'hirise') layerName = 'MDIM21_color';

    const url = `${this.usgsWmsBase}&LAYERS=${layerName}&WIDTH=2048&HEIGHT=1024&BBOX=-180,-90,180,90`;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 8;
        this.marsMaterial.map = tex;
        this.marsMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep procedural texture silently if offline
      }
    );

    this.loadJezeroPatchTexture(type);
  }

  // --------------------------------------------------------------------------
  // Subtle Martian Atmospheric Limb Glow (Fresnel Shader)
  // --------------------------------------------------------------------------
  buildAtmosphereGlow() {
    const geo = new THREE.SphereGeometry(1, 64, 32);
    geo.scale(this.R_EQ * 1.032, this.R_POLAR * 1.032, this.R_EQ * 1.032);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0xe07a48) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = pow(0.62 - dot(vNormal, -vViewDir), 3.4);
          gl_FragColor = vec4(glowColor, clamp(rim * 0.65, 0.0, 0.55));
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });

    this.scene.add(new THREE.Mesh(geo, mat));
  }

  // --------------------------------------------------------------------------
  // Mid-Tier Regional Isidis / Jezero Basin Patch (7° x 7°, Feathered)
  // Prevents blurry global pixels around Jezero Crater when zooming in
  // --------------------------------------------------------------------------
  buildRegionalBasinPatch() {
    const minLat = 15.0;
    const maxLat = 22.0;
    const minLon = 74.0;
    const maxLon = 81.0;
    const segs = 48;

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let iy = 0; iy <= segs; iy++) {
      const v = iy / segs;
      const lat = minLat + v * (maxLat - minLat);
      for (let ix = 0; ix <= segs; ix++) {
        const u = ix / segs;
        const lon = minLon + u * (maxLon - minLon);
        const pos = this.latLonToVec3(lat, lon, this.DATUM_ELEV, 0.005);
        positions.push(pos.x, pos.y, pos.z);
        uvs.push(u, v);
      }
    }

    for (let iy = 0; iy < segs; iy++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iy * (segs + 1) + ix;
        const b = a + 1;
        const c = (iy + 1) * (segs + 1) + ix;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.regionalMaterial = new THREE.MeshStandardMaterial({
      map: this.composeFeatheredRegionalTexture(null),
      transparent: true,
      roughness: 0.88,
      metalness: 0.04,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, this.regionalMaterial);
    mesh.renderOrder = 1;
    this.scene.add(mesh);

    const url = `${this.usgsWmsBase}&LAYERS=MDIM21_color&WIDTH=1024&HEIGHT=1024&BBOX=${minLon},${minLat},${maxLon},${maxLat}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.regionalMaterial.map = this.composeFeatheredRegionalTexture(img);
      this.regionalMaterial.needsUpdate = true;
    };
    img.src = url;
  }

  composeFeatheredRegionalTexture(img) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (img) {
      ctx.drawImage(img, 0, 0, size, size);
    } else {
      ctx.fillStyle = '#a95534';
      ctx.fillRect(0, 0, size, size);
    }

    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.5);
    mask.addColorStop(0.0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    mask.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // --------------------------------------------------------------------------
  // Seamless Feathered 3D Jezero Crater Relief Patch (No Harsh Cutoffs)
  // --------------------------------------------------------------------------
  buildJezeroReliefPatch() {
    const minLat = 18.28;
    const maxLat = 18.62;
    const minLon = 77.22;
    const maxLon = 77.66;
    const segs = 96;

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let iy = 0; iy <= segs; iy++) {
      const v = iy / segs; // 0 (south) -> 1 (north)
      const lat = minLat + v * (maxLat - minLat);

      for (let ix = 0; ix <= segs; ix++) {
        const u = ix / segs; // 0 (west) -> 1 (east)
        const lon = minLon + u * (maxLon - minLon);

        const elev = this.pathfinder.getElevation(lat, lon);
        // Hover slightly above base sphere so there is zero Z-fighting
        const pos = this.latLonToVec3(lat, lon, elev, 0.012);
        positions.push(pos.x, pos.y, pos.z);
        uvs.push(u, v);
      }
    }

    for (let iy = 0; iy < segs; iy++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iy * (segs + 1) + ix;
        const b = a + 1;
        const c = (iy + 1) * (segs + 1) + ix;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.jezeroPatchMaterial = new THREE.MeshStandardMaterial({
      map: this.composeJezeroCanvasTexture(null, minLat, maxLat, minLon, maxLon),
      transparent: true,
      roughness: 0.84,
      metalness: 0.05,
      depthWrite: true
    });

    this.jezeroPatchMesh = new THREE.Mesh(geo, this.jezeroPatchMaterial);
    this.jezeroPatchMesh.renderOrder = 2;
    this.scene.add(this.jezeroPatchMesh);

    this.loadJezeroPatchTexture(this.currentBasemap);
  }

  loadJezeroPatchTexture(type) {
    const minLat = 18.28;
    const maxLat = 18.62;
    const minLon = 77.22;
    const maxLon = 77.66;

    let layer = 'THEMIS';
    if (type === 'mola') layer = 'HRSC_MOLA_Blend_Hillshade';
    else if (type === 'mola-color') layer = 'MOLA_color';
    else if (type === 'viking') layer = 'MDIM21_color';

    const url = `${this.usgsWmsBase}&LAYERS=${layer}&WIDTH=2048&HEIGHT=2048&BBOX=${minLon},${minLat},${maxLon},${maxLat}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = this.composeJezeroCanvasTexture(img, minLat, maxLat, minLon, maxLon);
      this.jezeroPatchMaterial.map = tex;
      this.jezeroPatchMaterial.needsUpdate = true;
    };
    img.src = url;
  }

  composeJezeroCanvasTexture(usgsImg, minLat, maxLat, minLon, maxLon) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 1. Draw bright sunlit Martian delta relief + blend USGS THEMIS/HRSC detail
    const imgData = ctx.createImageData(size, size);
    for (let py = 0; py < size; py++) {
      const lat = maxLat - (py / size) * (maxLat - minLat);
      for (let px = 0; px < size; px++) {
        const lon = minLon + (px / size) * (maxLon - minLon);
        const elev = this.pathfinder.getElevation(lat, lon);
        const norm = Math.max(0, Math.min(1, (elev + 2640) / 360));
        // Sunlit ochre-terracotta ramp with crisp contour micro-bands
        const contour = Math.abs(((elev % 20) + 20) % 20 - 10) < 1.2 ? 0.92 : 1.0;
        const idx = (py * size + px) * 4;
        imgData.data[idx] = Math.round((158 + norm * 78) * contour);
        imgData.data[idx + 1] = Math.round((86 + norm * 56) * contour);
        imgData.data[idx + 2] = Math.round((52 + norm * 36) * contour);
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    if (usgsImg) {
      ctx.save();
      ctx.globalAlpha = 0.48;
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(usgsImg, 0, 0, size, size);
      ctx.restore();
    }

    // 2. Smooth radial/edge alpha feather mask so patch blends seamlessly into regional basin
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(
      size / 2, size / 2, size * 0.28,
      size / 2, size / 2, size * 0.50
    );
    mask.addColorStop(0.0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.74, 'rgba(255,255,255,0.9)');
    mask.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    return tex;
  }

  // --------------------------------------------------------------------------
  // 7 NASA Scientific Layers Draped on the 3D Globe
  // --------------------------------------------------------------------------
  buildAllScientificLayers() {
    this.buildPolygonLayer(this.data.hazardsGeoJSON, this.layerGroups.hazards, (f) => {
      return f.properties.riskLevel === 'CRITICAL' ? 0xff2a4b : 0x00ff9d;
    }, 0.42, 0.020);

    this.buildPolygonLayer(this.data.themisSandTrapsGeoJSON, this.layerGroups.themis, () => 0xfb923c, 0.36, 0.018);

    this.buildPolygonLayer(this.data.mineralsGeoJSON, this.layerGroups.minerals, (f) => {
      return new THREE.Color(f.properties.colorCode || '#00f0ff').getHex();
    }, 0.38, 0.019);

    this.buildPolygonLayer(this.data.environmentGeoJSON, this.layerGroups.thermal, (f) => {
      return f.properties.envType === 'cryo_shadow' ? 0xa855f7 : 0x818cf8;
    }, 0.36, 0.017);

    // 5. Perseverance Ground-Truth Traverse
    this.buildPolyline(this.data.perseveranceTraverse, this.layerGroups.traverse, 0xfbbf24, 0.025, 0.9);

    // 6. Base Camp & Science Waypoints
    this.buildWaypoints();
    this.buildGlobalLandmarks();

    // 7. 10m Elevation Contours
    this.data.contours.forEach(c => {
      this.buildPolyline(c.coords, this.layerGroups.contours, 0x94a3b8, 0.016, 0.48);
    });
  }

  buildPolygonLayer(geojson, group, colorFn, fillOpacity, elevOffset) {
    while (group.children.length) group.remove(group.children[0]);

    geojson.features.forEach(feature => {
      const ring = feature.geometry.coordinates[0]; // [[lon, lat], ...]
      if (!ring || ring.length < 3) return;

      const colorHex = colorFn(feature);

      // Compute centroid for 2D planar triangulation in local tangent plane, then project onto sphere
      let sumLat = 0, sumLon = 0;
      const ptsLatLon = ring.map(([lon, lat]) => {
        sumLat += lat;
        sumLon += lon;
        return [lat, lon];
      });
      const cLat = sumLat / ptsLatLon.length;
      const cLon = sumLon / ptsLatLon.length;

      // Triangulate in (lon, lat) space via THREE.ShapeUtils
      const contour2D = ptsLatLon.slice(0, -1).map(([lat, lon]) => new THREE.Vector2(lon - cLon, lat - cLat));
      const faces = THREE.ShapeUtils.triangulateShape(contour2D, []);

      const positions = [];
      contour2D.forEach(p => {
        const lat = cLat + p.y;
        const lon = cLon + p.x;
        const elev = this.pathfinder.getElevation(lat, lon);
        const v = this.latLonToVec3(lat, lon, elev, elevOffset);
        positions.push(v.x, v.y, v.z);
      });

      const indices = [];
      faces.forEach(([a, b, c]) => indices.push(a, b, c));

      if (indices.length > 0) {
        const meshGeo = new THREE.BufferGeometry();
        meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        meshGeo.setIndex(indices);
        meshGeo.computeVertexNormals();

        const meshMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: fillOpacity,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const mesh = new THREE.Mesh(meshGeo, meshMat);
        mesh.renderOrder = 4;
        group.add(mesh);
      }

      // Crisp perimeter outline
      this.buildPolyline(ptsLatLon, group, colorHex, elevOffset + 0.002, Math.min(1, fillOpacity + 0.5));
    });
  }

  buildPolyline(latLonList, group, colorHex, elevOffset = 0.022, opacity = 0.9) {
    const pts = latLonList.map(([lat, lon]) => {
      const elev = this.pathfinder.getElevation(lat, lon);
      return this.latLonToVec3(lat, lon, elev, elevOffset);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: opacity
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 5;
    group.add(line);
    return line;
  }

  buildWaypoints() {
    const group = this.layerGroups.waypoints;
    while (group.children.length) group.remove(group.children[0]);
    this.waypointMeshes = [];

    this.data.waypoints.forEach(wp => {
      const [lat, lon] = wp.coords;
      const elev = this.pathfinder.getElevation(lat, lon);
      const basePos = this.latLonToVec3(lat, lon, elev, 0.018);
      const topPos = this.latLonToVec3(lat, lon, elev, 0.055);
      const normal = basePos.clone().normalize();
      const isBase = wp.type === 'base';

      const colorHex = isBase ? 0x00ff9d : 0x00f0ff;

      // Vertical beacon stem
      const stemGeo = new THREE.BufferGeometry().setFromPoints([basePos, topPos]);
      const stemMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
      group.add(new THREE.Line(stemGeo, stemMat));

      // Glowing beacon head
      const sphereGeo = new THREE.SphereGeometry(isBase ? 0.0085 : 0.0065, 14, 14);
      const sphereMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(topPos);
      sphere.userData = { waypoint: wp };
      group.add(sphere);
      this.waypointMeshes.push(sphere);

      // Tactical ground halo ring (~300m diameter) oriented to local surface normal
      const ringGeo = new THREE.RingGeometry(0.007, 0.011, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(basePos.clone().addScaledVector(normal, 0.004));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.add(ring);
    });
  }

  // --------------------------------------------------------------------------
  // Render Active A* Safe Route + Comparison Line + Custom Destination
  // --------------------------------------------------------------------------
  renderRoute(routeResult, startCoord, endCoord, isStormMode, customDestCoord = null) {
    const group = this.layerGroups.route;
    while (group.children.length) group.remove(group.children[0]);

    // Straight-line comparison
    this.buildPolyline([startCoord, endCoord], group, 0xff2a4b, 0.026, 0.55);

    // Safe A* Route ribbon
    if (routeResult && routeResult.coordinates.length > 1) {
      const routeColor = isStormMode ? 0xff2a4b : 0x00f0ff;
      const pts = routeResult.coordinates.map((c) => {
        const lat = Array.isArray(c) ? c[0] : c.lat;
        const lon = Array.isArray(c) ? c[1] : c.lon;
        const elev = (typeof c.elev === 'number') ? c.elev : this.pathfinder.getElevation(lat, lon);
        return this.latLonToVec3(lat, lon, elev, 0.028);
      });

      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(40, pts.length * 2), 0.0024, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: routeColor,
        transparent: true,
        opacity: 0.95
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.renderOrder = 8;
      group.add(tube);
    }

    // Custom destination pin if user clicked terrain
    if (customDestCoord) {
      const [cLat, cLon] = customDestCoord;
      const elev = this.pathfinder.getElevation(cLat, cLon);
      const pos = this.latLonToVec3(cLat, cLon, elev, 0.05);
      const pinGeo = new THREE.SphereGeometry(0.013, 12, 12);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(pos);
      group.add(pin);
    }
  }

  clearRoute() {
    while (this.layerGroups.route.children.length) {
      this.layerGroups.route.remove(this.layerGroups.route.children[0]);
    }
  }

  setLayerVisible(key, visible) {
    if (this.layerGroups[key]) {
      this.layerGroups[key].visible = visible;
    }
  }

  setLayerOpacity(key, factor) {
    const group = this.layerGroups[key];
    if (!group) return;
    group.traverse(obj => {
      if (obj.material) {
        if (obj.isMesh) {
          obj.material.opacity = Math.min(0.75, Math.max(0.03, factor * 0.45));
        } else if (obj.isLine) {
          obj.material.opacity = Math.min(1.0, Math.max(0.05, factor));
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Screen-Space Projected Waypoint Labels
  // --------------------------------------------------------------------------
  createLabelOverlay() {
    this.labelOverlay = document.createElement('div');
    this.labelOverlay.className = 'globe-labels-overlay';
    this.container.appendChild(this.labelOverlay);

    this.waypointLabels = this.data.waypoints.map(wp => {
      const isBase = wp.type === 'base';
      const el = document.createElement('div');
      el.className = `globe-wp-label ${isBase ? 'base' : ''}`;
      const shortTitle = (wp.name || wp.id).split('(')[0].trim();
      el.textContent = `${isBase ? '⛺ ' : '🔬 '}${shortTitle}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onWaypointClick) {
          this.callbacks.onWaypointClick(wp);
        }
      });
      this.labelOverlay.appendChild(el);
      return { wp, el };
    });

    // Orbital-scale Jezero Crater beacon label (flies in & hands off to 2D HiRISE map)
    this.orbitalPinEl = document.createElement('div');
    this.orbitalPinEl.className = 'globe-orbital-pin';
    this.orbitalPinEl.innerHTML = '<span>&#127919; JEZERO CRATER (18.38&deg;N, 77.58&deg;E) &bull; ENTER 2D HiRISE MAP</span>';
    this.orbitalPinEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flyToJezeroAndEnter();
    });
    this.labelOverlay.appendChild(this.orbitalPinEl);

    // Global Martian Landmarks (visible when zoomed out to orbital/regional scale)
    this.globalLandmarkLabels = this.globalLandmarks.map(lm => {
      const el = document.createElement('div');
      el.className = 'globe-landmark-label';
      el.textContent = lm.name;
      el.title = lm.desc;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onGlobalLandmarkClick) {
          this.callbacks.onGlobalLandmarkClick(lm);
        }
      });
      this.labelOverlay.appendChild(el);
      return { lm, el };
    });
  }

  updateProjectedLabels() {
    if (!this.labelOverlay) return;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const camPos = this.camera.position;
    const camDistToCenter = camPos.length();
    const isOrbitalScale = camDistToCenter > 112;

    // Show orbital pin when zoomed out, individual EVA waypoints when near surface
    const jezeroCenter = this.latLonToVec3(18.4447, 77.4508, -2550, 0.2);
    const toJezero = jezeroCenter.clone().normalize();
    const camDir = camPos.clone().normalize();
    const jezeroVisible = toJezero.dot(camDir) > 0.15;

    if (isOrbitalScale && jezeroVisible) {
      const proj = jezeroCenter.clone().project(this.camera);
      if (proj.z < 1) {
        this.orbitalPinEl.style.display = 'block';
        this.orbitalPinEl.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
        this.orbitalPinEl.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
      } else {
        this.orbitalPinEl.style.display = 'none';
      }
    } else {
      this.orbitalPinEl.style.display = 'none';
    }

    const showWaypoints = !isOrbitalScale && this.layerGroups.waypoints.visible;
    this.waypointLabels.forEach(({ wp, el }) => {
      if (!showWaypoints) {
        el.style.display = 'none';
        return;
      }
      const elev = this.pathfinder.getElevation(wp.coords[0], wp.coords[1]);
      const worldPos = this.latLonToVec3(wp.coords[0], wp.coords[1], elev, 0.062);

      // Occlusion check against Mars sphere
      const dot = worldPos.clone().normalize().dot(camDir);
      if (dot < 0.05) {
        el.style.display = 'none';
        return;
      }

      const proj = worldPos.project(this.camera);
      if (proj.z > 1) {
        el.style.display = 'none';
        return;
      }

      el.style.display = 'block';
      el.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
    });

    // Show global Martian landmarks when zoomed out to planetary/regional scale
    this.globalLandmarkLabels.forEach(({ lm, el }) => {
      if (!isOrbitalScale) {
        el.style.display = 'none';
        return;
      }
      const worldPos = this.latLonToVec3(lm.lat, lm.lon, this.DATUM_ELEV, 0.4);
      const dot = worldPos.clone().normalize().dot(camDir);
      if (dot < 0.18) {
        el.style.display = 'none';
        return;
      }
      const proj = worldPos.project(this.camera);
      if (proj.z > 1) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
    });
  }

  buildGlobalLandmarks() {
    const group = new THREE.Group();
    this.globalLandmarks.forEach(lm => {
      const pos = this.latLonToVec3(lm.lat, lm.lon, this.DATUM_ELEV, 0.15);
      const dotGeo = new THREE.SphereGeometry(0.42, 10, 10);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = { landmark: lm };
      group.add(dot);
      this.globalLandmarkMeshes.push(dot);
    });
    this.scene.add(group);
  }

  // --------------------------------------------------------------------------
  // Smooth Orbital-to-Surface Camera Transitions
  // --------------------------------------------------------------------------
  setOrbitalCameraImmediate() {
    const dir = this.latLonToVec3(18.4, 77.45, 0, 0).normalize();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(175));
    this.controls.update();
  }

  flyToOrbital() {
    this.zoomTriggerLock = true;
    setTimeout(() => { this.zoomTriggerLock = false; }, 1400);
    const dir = this.latLonToVec3(18.4, 77.45, 0, 0).normalize();
    this.startFlyAnimation(new THREE.Vector3(0, 0, 0), dir.multiplyScalar(185), 1000);
  }

  flyToJezeroAndEnter() {
    this.zoomTriggerLock = true;
    const dir = this.latLonToVec3(18.4447, 77.4508, 0, 0).normalize();
    this.startFlyAnimation(new THREE.Vector3(0, 0, 0), dir.multiplyScalar(114), 750, () => {
      this.zoomTriggerLock = false;
      if (this.callbacks.onEnterJezero) {
        this.callbacks.onEnterJezero();
      }
    });
  }

  flyToJezero() {
    this.flyToJezeroAndEnter();
  }

  startFlyAnimation(targetEnd, camEnd, durationMs, onComplete = null) {
    this.flyAnim = {
      startTime: performance.now(),
      duration: durationMs,
      targetStart: this.controls.target.clone(),
      targetEnd,
      camStart: this.camera.position.clone(),
      camEnd,
      onComplete
    };
  }

  // --------------------------------------------------------------------------
  // Raycasting & Pointer Events
  // --------------------------------------------------------------------------
  bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.flyAnim = null; // Allow user to interrupt fly animation cleanly
    });

    dom.addEventListener('pointermove', (e) => {
      const hit = this.raycastSurface(e);
      if (hit && this.callbacks.onHover) {
        this.callbacks.onHover(hit.lat, hit.lon);
      }
    });

    dom.addEventListener('pointerup', (e) => {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.hypot(dx, dy) > 5) return; // Was an orbit drag, not a click

      // Check waypoint beacons first
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      if (this.layerGroups.waypoints.visible && this.waypointMeshes.length) {
        const wpHits = this.raycaster.intersectObjects(this.waypointMeshes, false);
        if (wpHits.length > 0 && this.callbacks.onWaypointClick) {
          this.callbacks.onWaypointClick(wpHits[0].object.userData.waypoint);
          return;
        }
      }

      const hit = this.raycastSurface(e);
      if (hit && this.callbacks.onMapClick) {
        this.callbacks.onMapClick(hit.lat, hit.lon);
      }
    });

    window.addEventListener('resize', () => this.onResize());
  }

  raycastSurface(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [];
    if (this.jezeroPatchMesh) targets.push(this.jezeroPatchMesh);
    if (this.marsMesh) targets.push(this.marsMesh);

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;

    return this.vec3ToLatLon(hits[0].point);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.flyAnim) {
      const elapsed = performance.now() - this.flyAnim.startTime;
      const t = Math.min(1, elapsed / this.flyAnim.duration);
      const ease = 1 - Math.pow(1 - t, 3); // Cubic ease-out
      this.controls.target.lerpVectors(this.flyAnim.targetStart, this.flyAnim.targetEnd, ease);
      this.camera.position.lerpVectors(this.flyAnim.camStart, this.flyAnim.camEnd, ease);
      if (t >= 1) {
        const cb = this.flyAnim.onComplete;
        this.flyAnim = null;
        if (cb) cb();
      }
    } else if (!this.zoomTriggerLock && this.callbacks.onEnterJezero) {
      // Auto-enter 2D HiRISE map when user scrolls/zooms in close to Jezero Crater
      const dist = this.camera.position.length();
      if (dist < 118) {
        const jezeroDir = this.latLonToVec3(18.4447, 77.4508, 0, 0).normalize();
        const camDir = this.camera.position.clone().normalize();
        if (jezeroDir.dot(camDir) > 0.85) {
          this.zoomTriggerLock = true;
          this.callbacks.onEnterJezero();
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateProjectedLabels();
  }
}

window.JezeroMarsGlobe = JezeroMarsGlobe;
