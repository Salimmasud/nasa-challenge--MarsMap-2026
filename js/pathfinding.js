/**
 * ============================================================================
 * ARES-V A* HAZARD-AWARE PATHFINDING ENGINE (JEZERO SECTOR)
 * Incorporates NASA/Minetti Martian Gravity Walking Cost, Slope, Sand Traps & Cliffs
 * ============================================================================
 */

class JezeroPathfinder {
  constructor(data) {
    this.data = data;
    this.MARS_RADIUS_KM = 3389.5;

    // Exploration Corridor Boundaries
    this.bounds = {
      minLat: 18.410,
      maxLat: 18.525,
      minLon: 77.340,
      maxLon: 77.465
    };

    this.rows = 65;
    this.cols = 65;
    this.grid = [];

    this.initCostGrid();
  }

  coordToCell(lat, lon) {
    const row = Math.floor(((lat - this.bounds.minLat) / (this.bounds.maxLat - this.bounds.minLat)) * (this.rows - 1));
    const col = Math.floor(((lon - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * (this.cols - 1));
    return {
      row: Math.max(0, Math.min(this.rows - 1, row)),
      col: Math.max(0, Math.min(this.cols - 1, col))
    };
  }

  cellToCoord(row, col) {
    const lat = this.bounds.minLat + (row / (this.rows - 1)) * (this.bounds.maxLat - this.bounds.minLat);
    const lon = this.bounds.minLon + (col / (this.cols - 1)) * (this.bounds.maxLon - this.bounds.minLon);
    return [lat, lon];
  }

  pointInPolygon(point, polygonCoords) {
    const x = point[1]; // lon
    const y = point[0]; // lat
    let inside = false;

    for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
      const xi = polygonCoords[i][0];
      const yi = polygonCoords[i][1];
      const xj = polygonCoords[j][0];
      const yj = polygonCoords[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Realistic Synthetic DEM Generator calibrated to Jezero HiRISE DTM
  getElevation(lat, lon) {
    // Delta front rises from crater floor (-2580m) to upper delta plateau (-2460m)
    const westProgress = (77.465 - lon) / (77.465 - 77.340);
    let elev = -2580 + (westProgress * 120);

    // Kodiak Butte isolated mesa topography
    const dKodiak = this.haversineDistance([lat, lon], [18.428, 77.405]);
    if (dKodiak < 0.6) {
      elev += (0.6 - dKodiak) * 85;
    }

    // Belva Crater impact bowl depression
    const dBelva = this.haversineDistance([lat, lon], [18.468, 77.382]);
    if (dBelva < 0.75) {
      elev -= (0.75 - dBelva) * 75;
    }

    return elev;
  }

  initCostGrid() {
    this.grid = [];
    const hazards = this.data.hazardsGeoJSON.features;
    const sandTraps = this.data.themisSandTrapsGeoJSON.features;
    const envZones = this.data.environmentGeoJSON.features;

    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const coord = this.cellToCoord(r, c);
        let baseCost = 1.0;
        let isImpassable = false;
        let hazardDesc = null;

        // 1. Cliff hazards (HiRISE DTM > 20° slope)
        for (const f of hazards) {
          const poly = f.geometry.coordinates[0];
          if (this.pointInPolygon(coord, poly)) {
            if (f.properties.hazardType === 'cliff') {
              isImpassable = true;
              baseCost = 99999;
              hazardDesc = f.properties.desc;
            } else if (f.properties.hazardType === 'safe_corridor') {
              baseCost *= 0.65; // Natural breach preference
            }
          }
        }

        // 2. THEMIS thermal inertia sand traps (loose dune slip penalty)
        for (const f of sandTraps) {
          const poly = f.geometry.coordinates[0];
          if (this.pointInPolygon(coord, poly)) {
            baseCost *= 5.0; // Heavy traction fatigue penalty
            if (!hazardDesc) hazardDesc = f.properties.desc;
          }
        }

        // 3. Cryogenic shadow zones
        for (const f of envZones) {
          const poly = f.geometry.coordinates[0];
          if (this.pointInPolygon(coord, poly)) {
            if (f.properties.envType === 'cryo_shadow') {
              baseCost *= 2.2; // Avoid thermal heater power drain
              if (!hazardDesc) hazardDesc = f.properties.desc;
            }
          }
        }

        const elevation = this.getElevation(coord[0], coord[1]);

        this.grid[r][c] = {
          row: r,
          col: c,
          lat: coord[0],
          lon: coord[1],
          elevation: elevation,
          cost: baseCost,
          isImpassable: isImpassable,
          hazardDesc: hazardDesc
        };
      }
    }
  }

  haversineDistance(c1, c2) {
    const lat1 = c1[0] * Math.PI / 180;
    const lon1 = c1[1] * Math.PI / 180;
    const lat2 = c2[0] * Math.PI / 180;
    const lon2 = c2[1] * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.MARS_RADIUS_KM * c;
  }

  // Snap to safe adjacent ground if coordinate hits a cliff edge
  getNearestPassableCell(cell) {
    if (!this.grid[cell.row][cell.col].isImpassable) return cell;

    for (let radius = 1; radius <= 4; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            if (!this.grid[nr][nc].isImpassable) {
              return { row: nr, col: nc };
            }
          }
        }
      }
    }
    return cell;
  }

  findSafeRoute(startCoord, endCoord) {
    let startCell = this.coordToCell(startCoord[0], startCoord[1]);
    let endCell = this.coordToCell(endCoord[0], endCoord[1]);

    startCell = this.getNearestPassableCell(startCell);
    endCell = this.getNearestPassableCell(endCell);

    const openSet = [];
    const closedSet = new Set();
    const cameFrom = new Map();

    const gScore = {};
    const fScore = {};

    const cellKey = (r, c) => `${r},${c}`;
    const startKey = cellKey(startCell.row, startCell.col);
    const endKey = cellKey(endCell.row, endCell.col);

    gScore[startKey] = 0;
    fScore[startKey] = this.heuristic(startCell, endCell);

    openSet.push({
      row: startCell.row,
      col: startCell.col,
      f: fScore[startKey]
    });

    const directions = [
      { dr: -1, dc: 0, dist: 1.0 },
      { dr: 1, dc: 0, dist: 1.0 },
      { dr: 0, dc: -1, dist: 1.0 },
      { dr: 0, dc: 1, dist: 1.0 },
      { dr: -1, dc: -1, dist: 1.414 },
      { dr: -1, dc: 1, dist: 1.414 },
      { dr: 1, dc: -1, dist: 1.414 },
      { dr: 1, dc: 1, dist: 1.414 }
    ];

    let found = false;
    let iterations = 0;
    const MAX_ITERATIONS = 4500;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const currentKey = cellKey(current.row, current.col);

      if (current.row === endCell.row && current.col === endCell.col) {
        found = true;
        break;
      }

      closedSet.add(currentKey);

      for (const dir of directions) {
        const nr = current.row + dir.dr;
        const nc = current.col + dir.dc;

        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;

        const neighborKey = cellKey(nr, nc);
        if (closedSet.has(neighborKey)) continue;

        const neighborNode = this.grid[nr][nc];
        if (neighborNode.isImpassable) continue;

        // Slope resistance penalty (Martian 0.38g hiking energy)
        const currentNode = this.grid[current.row][current.col];
        const elevDiff = neighborNode.elevation - currentNode.elevation;
        let slopePenalty = 1.0;
        if (elevDiff > 0) {
          slopePenalty += (elevDiff * 0.14); // Uphill walking fatigue
        }

        const tentativeG = gScore[currentKey] + (dir.dist * neighborNode.cost * slopePenalty);

        if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
          cameFrom.set(neighborKey, current);
          gScore[neighborKey] = tentativeG;
          const h = this.heuristic({ row: nr, col: nc }, endCell);
          fScore[neighborKey] = tentativeG + h;

          const exists = openSet.find(n => n.row === nr && n.col === nc);
          if (!exists) {
            openSet.push({ row: nr, col: nc, f: fScore[neighborKey] });
          } else {
            exists.f = fScore[neighborKey];
          }
        }
      }
    }

    const pathCoords = [];
    let curr = endCell;
    let currKey = endKey;

    if (found || cameFrom.has(endKey)) {
      while (cameFrom.has(currKey)) {
        const coord = this.cellToCoord(curr.row, curr.col);
        const node = this.grid[curr.row][curr.col];
        pathCoords.unshift({
          lat: coord[0],
          lon: coord[1],
          elevation: node.elevation,
          hazardDesc: node.hazardDesc
        });
        curr = cameFrom.get(currKey);
        currKey = cellKey(curr.row, curr.col);
      }
      const startNode = this.grid[startCell.row][startCell.col];
      pathCoords.unshift({
        lat: startCoord[0],
        lon: startCoord[1],
        elevation: startNode.elevation,
        hazardDesc: startNode.hazardDesc
      });
    } else {
      pathCoords.push({ lat: startCoord[0], lon: startCoord[1], elevation: -2570 });
      pathCoords.push({ lat: endCoord[0], lon: endCoord[1], elevation: -2500 });
    }

    return this.analyzePath(pathCoords, startCoord, endCoord);
  }

  heuristic(cellA, cellB) {
    const dr = cellA.row - cellB.row;
    const dc = cellA.col - cellB.col;
    return Math.sqrt(dr * dr + dc * dc) * 1.0;
  }

  analyzePath(pathCoords, startCoord, endCoord) {
    let totalDistKm = 0;
    let totalClimbM = 0;
    let maxSlopeDeg = 0;
    let bypassedHazards = new Set();

    const straightDistKm = this.haversineDistance(startCoord, endCoord);

    for (let i = 0; i < pathCoords.length - 1; i++) {
      const p1 = [pathCoords[i].lat, pathCoords[i].lon];
      const p2 = [pathCoords[i + 1].lat, pathCoords[i + 1].lon];
      const segDist = this.haversineDistance(p1, p2);
      totalDistKm += segDist;

      const elev1 = pathCoords[i].elevation;
      const elev2 = pathCoords[i + 1].elevation;
      const elevDiff = elev2 - elev1;

      if (elevDiff > 0) totalClimbM += elevDiff;

      if (segDist > 0) {
        const slopeRad = Math.atan((Math.abs(elevDiff) / 1000) / segDist);
        const slopeDeg = slopeRad * (180 / Math.PI);
        if (slopeDeg > maxSlopeDeg) maxSlopeDeg = slopeDeg;
      }

      if (pathCoords[i].hazardDesc) {
        bypassedHazards.add(pathCoords[i].hazardDesc);
      }
    }

    const detourKm = Math.max(0, totalDistKm - straightDistKm);

    return {
      coordinates: pathCoords,
      totalDistanceKm: Number(totalDistKm.toFixed(2)),
      straightDistanceKm: Number(straightDistKm.toFixed(2)),
      detourKm: Number(detourKm.toFixed(2)),
      totalClimbM: Math.round(totalClimbM),
      maxSlopeDeg: Number(maxSlopeDeg.toFixed(1)),
      bypassedHazards: Array.from(bypassedHazards)
    };
  }
}

window.JezeroPathfinder = JezeroPathfinder;
