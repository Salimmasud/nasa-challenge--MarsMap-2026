/**
 * ============================================================================
 * ARES-V // THREE.JS SYNCHRONIZED 3D JEZERO CRATER TERRAIN & ROUTE RENDERER
 * Renders real 3D topographic relief of the Western Delta scarp with synchronized
 * 3D walking route path & astronaut marker.
 * ============================================================================
 */

class JezeroTerrain3D {
  constructor(containerId, pathfinder) {
    this.container = document.getElementById(containerId);
    this.pathfinder = pathfinder;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.terrainMesh = null;
    this.routeLine = null;
    this.astronautMarker = null;
    this.isAutoRotating = true;
    this.animId = null;

    if (this.container && window.THREE) {
      this.init();
    }
  }

  init() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 260;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06090e);
    this.scene.fog = new THREE.FogExp2(0x0c1017, 0.0035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    this.camera.position.set(0, 110, 160);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera going below ground
      this.controls.minDistance = 30;
      this.controls.maxDistance = 350;
      this.controls.autoRotate = this.isAutoRotating;
      this.controls.autoRotateSpeed = 0.8;
    }

    // 5. Lighting (Martian Sun & Atmospheric Ambient)
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.45);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffdfba, 1.2);
    sunLight.position.set(100, 180, 80);
    sunLight.castShadow = true;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.35); // Subtle sci-fi rim glow
    rimLight.position.set(-100, 50, -100);
    this.scene.add(rimLight);

    // 6. Build 3D Terrain Mesh from Jezero DEM
    this.buildTerrain();

    // 7. Create Astronaut 3D Pin
    this.createAstronautMarker();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onResize());

    // 9. Start Render Loop
    this.animate();
  }

  buildTerrain() {
    const size = 180;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = [];

    const bounds = this.pathfinder.bounds;
    const minElev = -2580;
    const maxElev = -2460;
    const elevRange = maxElev - minElev;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Map (x, z) in 3D to (lat, lon) in Jezero
      const u = (x / size) + 0.5; // 0 to 1
      const v = (z / size) + 0.5; // 0 to 1

      const lon = bounds.minLon + u * (bounds.maxLon - bounds.minLon);
      const lat = bounds.maxLat - v * (bounds.maxLat - bounds.minLat);

      const elev = this.pathfinder.getElevation(lat, lon);
      const normY = ((elev - minElev) / elevRange) * 28.0; // Scaled height in 3D
      pos.setY(i, normY);

      // Vertex color gradient representing real Martian stratigraphy
      // Crater floor = dark basaltic red/slate; Delta scarp = tan ochre; Topset = oxidized rust
      const t = Math.max(0, Math.min(1, (elev - minElev) / elevRange));
      const col = new THREE.Color();
      if (t < 0.25) {
        col.setRGB(0.24 + t * 0.2, 0.12 + t * 0.1, 0.08 + t * 0.05); // Basalt floor
      } else if (t < 0.65) {
        col.setRGB(0.55 + t * 0.2, 0.32 + t * 0.15, 0.18 + t * 0.1); // Delta siltstone
      } else {
        col.setRGB(0.72, 0.42, 0.22); // Oxidized delta capstone
      }
      colors.push(col.r, col.g, col.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: false,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    // Subtle 3D grid boundary wireframe at base
    const wireframeGeom = new THREE.WireframeGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.08 });
    const wireLine = new THREE.LineSegments(wireframeGeom, wireframeMat);
    wireLine.position.y = -0.5;
    this.scene.add(wireLine);
  }

  // Convert (lat, lon) to 3D World (x, y, z)
  geoTo3D(lat, lon) {
    const size = 180;
    const bounds = this.pathfinder.bounds;

    const u = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
    const v = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);

    const x = (u - 0.5) * size;
    const z = (v - 0.5) * size;

    const elev = this.pathfinder.getElevation(lat, lon);
    const normY = ((elev - (-2580)) / 120) * 28.0;

    return new THREE.Vector3(x, normY + 1.2, z); // 1.2m above terrain
  }

  createAstronautMarker() {
    const group = new THREE.Group();

    // Beacon cylinder
    const beaconGeom = new THREE.CylinderGeometry(0.8, 0, 8, 8);
    beaconGeom.translate(0, 4, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    group.add(beacon);

    // Glowing head sphere
    const sphereGeom = new THREE.SphereGeometry(1.5, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(sphereGeom, sphereMat);
    head.position.y = 8;
    group.add(head);

    this.astronautMarker = group;
    this.scene.add(this.astronautMarker);

    // Position at Base Camp default
    const p = this.geoTo3D(18.4447, 77.4508);
    this.astronautMarker.position.copy(p);
  }

  // Update Synchronized 3D Walking Route
  updateRoute(pathCoordinates, isEmergency = false) {
    if (!this.scene || !pathCoordinates || pathCoordinates.length < 2) return;

    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine = null;
    }

    const points3D = pathCoordinates.map(c => this.geoTo3D(c.lat, c.lon));

    // Create 3D curve for smooth visualization
    const curve = new THREE.CatmullRomCurve3(points3D);
    const tubeGeom = new THREE.TubeGeometry(curve, 120, 0.9, 8, false);

    const routeColor = isEmergency ? 0xff2a4b : 0x00f0ff;
    const tubeMat = new THREE.MeshBasicMaterial({
      color: routeColor,
      wireframe: false
    });

    this.routeLine = new THREE.Mesh(tubeGeom, tubeMat);
    this.scene.add(this.routeLine);

    // Move Astronaut Marker to Destination
    if (this.astronautMarker) {
      const destPoint = points3D[points3D.length - 1];
      this.astronautMarker.position.copy(destPoint);
    }
  }

  toggleAutoRotate() {
    this.isAutoRotating = !this.isAutoRotating;
    if (this.controls) {
      this.controls.autoRotate = this.isAutoRotating;
    }
    return this.isAutoRotating;
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 110, 160);
      this.controls.target.set(0, 10, 0);
      this.controls.update();
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

window.JezeroTerrain3D = JezeroTerrain3D;
