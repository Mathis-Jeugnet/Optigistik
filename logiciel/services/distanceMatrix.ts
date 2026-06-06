import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MatrixPoint {
  id: string
  address: string
  lat: number
  lng: number
  role: 'origin' | 'delivery' | 'end'
}

export interface DistanceMatrixResult {
  session_id: string
  points: MatrixPoint[]
  duration_matrix: number[][]
  distance_matrix: number[][]
  computed_at: string
  points_count: number
}

export async function generateAndSaveDistanceMatrix(
  sessionId: string,
  points: MatrixPoint[]
): Promise<DistanceMatrixResult> {
  // ORS attend [lng, lat] (ordre inversé par rapport à Leaflet)
  const locations = points.map((p) => [p.lng, p.lat])

  const response = await fetch('/api/distance-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations }),
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

  // Firestore ne supporte pas les tableaux imbriqués — on sérialise les matrices
  await setDoc(doc(db, 'distance_matrices', sessionId), {
    ...result,
    duration_matrix: JSON.stringify(result.duration_matrix),
    distance_matrix: JSON.stringify(result.distance_matrix),
  })

  return result
}
