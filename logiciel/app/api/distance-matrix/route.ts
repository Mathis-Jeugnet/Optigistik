import { NextRequest, NextResponse } from 'next/server'

const ORS_BASE_URL = process.env.ORS_BASE_URL ?? 'http://ors:8082/ors/v2'
const ORS_API_KEY = process.env.ORS_API_KEY

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { locations, options } = body

  if (!Array.isArray(locations) || locations.length < 2) {
    return NextResponse.json({ error: 'Minimum 2 points requis' }, { status: 400 })
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ORS_API_KEY) headers['Authorization'] = ORS_API_KEY

  // 1. AUCUN INCIDENT : On utilise l'API Matrix classique (ultra optimisée)
  if (!options || !options.avoid_polygons) {
    const orsResponse = await fetch(`${ORS_BASE_URL}/matrix/driving-hgv`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locations,
        metrics: ['duration', 'distance'],
        units: 'm',
      }),
    })

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text()
      return NextResponse.json({ error: `Erreur ORS: ${errorText}` }, { status: orsResponse.status })
    }

    const data = await orsResponse.json()
    return NextResponse.json({
      duration_matrix: data.durations,
      distance_matrix: data.distances,
    })
  } 
  
  // 2. AVEC INCIDENTS : On passe en mode "Hybride Directions"
  else {
    const n = locations.length;
    const duration_matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const distance_matrix = Array.from({ length: n }, () => Array(n).fill(0));

    // On prépare toutes les requêtes individuelles
    const tasks: (() => Promise<void>)[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue; // Diagonale à 0

        tasks.push(async () => {
          try {
            const res = await fetch(`${ORS_BASE_URL}/directions/driving-hgv`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                coordinates: [locations[i], locations[j]],
                options: options, // C'est ICI qu'ORS va calculer le détour de ton pont barré !
                units: 'm',
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.routes && data.routes.length > 0) {
                duration_matrix[i][j] = data.routes[0].summary.duration;
                distance_matrix[i][j] = data.routes[0].summary.distance;
              } else {
                duration_matrix[i][j] = 999999;
                distance_matrix[i][j] = 999999;
              }
            } else {
              duration_matrix[i][j] = 999999;
              distance_matrix[i][j] = 999999;
            }
          } catch (err) {
             duration_matrix[i][j] = 999999;
             distance_matrix[i][j] = 999999;
          }
        });
      }
    }

    // Traitement par lots de 10 requêtes simultanées pour protéger ton docker ORS
    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      await Promise.all(batch.map(task => task()));
    }

    return NextResponse.json({
      duration_matrix,
      distance_matrix,
    });
  }
}