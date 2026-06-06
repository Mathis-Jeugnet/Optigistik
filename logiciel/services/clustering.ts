/**
 * Service de Clustering Géographique (Pré-tournées)
 * Implémente Constrained K-Medoids
 */

export interface TimeWindow {
  start: number;
  end: number;
}

export interface ClusterNode {
  id: string;
  address: string;
  lat: number;
  lng: number;
  demand: number;
  service_time: number;
  time_window?: TimeWindow;
}

export interface ClusteringResult {
  clusters: {
    group_id: number;
    nodes: any[]; // On garde tout l'objet d'origine
  }[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function generateClusters(nodes: ClusterNode[], maxPerCluster: number = 5): ClusteringResult {
  if (nodes.length === 0) return { clusters: [] };

  const nPts = nodes.length;
  const N = Math.ceil(nPts / maxPerCluster);

  const timeCenters = nodes.map(n => n.time_window ? (n.time_window.start + n.time_window.end) / 2 : 43200);

  const geoMatrix = Array(nPts).fill(0).map(() => Array(nPts).fill(0));
  const timeMatrix = Array(nPts).fill(0).map(() => Array(nPts).fill(0));

  let maxGeo = 0, maxTime = 0;
  for (let i = 0; i < nPts; i++) {
    for (let j = 0; j < nPts; j++) {
      if (i === j) continue;
      const g = haversineDistance(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);
      const t = Math.abs(timeCenters[i] - timeCenters[j]);
      geoMatrix[i][j] = g;
      timeMatrix[i][j] = t;
      if (g > maxGeo) maxGeo = g;
      if (t > maxTime) maxTime = t;
    }
  }

  const costMatrix = Array(nPts).fill(0).map(() => Array(nPts).fill(0));
  for (let i = 0; i < nPts; i++) {
    for (let j = 0; j < nPts; j++) {
      const ng = maxGeo > 0 ? geoMatrix[i][j] / maxGeo : 0;
      const nt = maxTime > 0 ? timeMatrix[i][j] / maxTime : 0;
      costMatrix[i][j] = 0.8 * ng + 0.2 * nt;
    }
  }

  let medoids = Array.from({length: nPts}, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, N);
  const clusters = new Map<number, number[]>();

  for (let iter = 0; iter < 100; iter++) {
    clusters.clear();
    medoids.forEach(m => clusters.set(m, []));

    const assigned = new Set<number>();
    const pairs = [];
    for (let i = 0; i < nPts; i++) {
      for (const m of medoids) pairs.push({ cost: costMatrix[i][m], pt: i, med: m });
    }
    pairs.sort((a, b) => a.cost - b.cost);

    for (const pair of pairs) {
      if (!assigned.has(pair.pt) && clusters.get(pair.med)!.length < maxPerCluster) {
        clusters.get(pair.med)!.push(pair.pt);
        assigned.add(pair.pt);
      }
    }

    for (let i = 0; i < nPts; i++) {
      if (!assigned.has(i)) {
        for (const m of medoids) {
          if (clusters.get(m)!.length < maxPerCluster) {
            clusters.get(m)!.push(i);
            assigned.add(i);
            break;
          }
        }
      }
    }

    const newMedoids: number[] = [];
    let changed = false;

    for (const [m, pts] of clusters.entries()) {
      if (pts.length === 0) {
        newMedoids.push(m);
        continue;
      }
      let bestNode = m, minCost = Infinity;
      for (const candidate of pts) {
        const cost = pts.reduce((sum, p) => sum + costMatrix[candidate][p], 0);
        if (cost < minCost) { minCost = cost; bestNode = candidate; }
      }
      newMedoids.push(bestNode);
      if (bestNode !== m) changed = true;
    }
    if (!changed) break;
    medoids = newMedoids;
  }

  const formattedClusters = [];
  let groupId = 1;
  for (const [m, pts] of clusters.entries()) {
    if (pts.length === 0) continue;
    formattedClusters.push({ 
      group_id: groupId++, 
      nodes: pts.map(p => ({
        ...nodes[p], // On garde l'intégralité des métadonnées
      }))
    });
  }

  return { clusters: formattedClusters };
}
