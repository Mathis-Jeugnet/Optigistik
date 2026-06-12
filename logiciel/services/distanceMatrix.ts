import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MatrixPoint {
  id: string
  address: string
  lat: number
  lng: number
  role: 'origin' | 'delivery' | 'end'
}

// Interface pour définir un incident de parcours
export interface Incident {
  id: string
  address: string
  lat: number
  lng: number
  radiusInMeters: number
  type: 'BLOCKAGE' | 'SLOWDOWN'
}

export interface DistanceMatrixResult {
  session_id: string
  points: MatrixPoint[]
  duration_matrix: number[][]
  distance_matrix: number[][]
  computed_at: string
  points_count: number
}

// Le convertisseur Mathématique Point + Rayon => Polygone GeoJSON
function incidentToAvoidPolygon(lat: number, lng: number, radiusInMeters: number) {
  // 1 degré de latitude = ~111 111 mètres
  const latDelta = radiusInMeters / 111111;
  // La longitude rétrécit en s'approchant des pôles, on compense avec le cosinus de la latitude
  const lngDelta = radiusInMeters / (111111 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  // Format GeoJSON Polygon (ORS attend [Longitude, Latitude])
  return [
    [minLng, maxLat], // Nord-Ouest
    [maxLng, maxLat], // Nord-Est
    [maxLng, minLat], // Sud-Est
    [minLng, minLat], // Sud-Ouest
    [minLng, maxLat]  // Retour au point de départ pour fermer la boucle
  ];
}

export async function generateAndSaveDistanceMatrix(
  sessionId: string,
  points: MatrixPoint[],
  incidents: Incident[] = [] // NOUVEAU : Paramètre optionnel
): Promise<DistanceMatrixResult> {
  
  // ORS attend [lng, lat]
  const locations = points.map((p) => [p.lng, p.lat])

  // Préparation des options pour ORS
  let options = undefined;
  if (incidents.length > 0) {
    options = {
      avoid_polygons: {
        type: "MultiPolygon",
        // MultiPolygon attend un tableau de Polygon. Un Polygon est un tableau d'anneaux.
        coordinates: incidents.map(inc => [incidentToAvoidPolygon(inc.lat, inc.lng, inc.radiusInMeters)])
      }
    };
  }

  // Envoi à ton API Next.js locale
  const response = await fetch('/api/distance-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      locations,
      options // On transmet les options à l'API !
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(err.error ?? 'Erreur inconnue lors du calcul de la matrice')
  }

  const { duration_matrix, distance_matrix } = await response.json()

  const result: DistanceMatrixResult = {
    session_id: sessionId,
    points,
    duration_matrix,
    distance_matrix,
    computed_at: new Date().toISOString(),
    points_count: points.length,
  }

  // Sérialisation pour Firestore
  await setDoc(doc(db, 'distance_matrices', sessionId), {
    ...result,
    duration_matrix: JSON.stringify(result.duration_matrix),
    distance_matrix: JSON.stringify(result.distance_matrix),
  })

  return result
}