import { NextRequest, NextResponse } from 'next/server'

// En self-hosted Docker : http://ors:8082/ors/v2  (défini dans docker-compose)
// En développement local : http://localhost:8082/ors/v2
// En cloud ORS : https://api.openrouteservice.org/v2
const ORS_BASE_URL = process.env.ORS_BASE_URL ?? 'https://api.openrouteservice.org/v2'
const ORS_API_KEY = process.env.ORS_API_KEY

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { locations } = body

  if (!Array.isArray(locations) || locations.length < 2) {
    return NextResponse.json({ error: 'Minimum 2 points requis' }, { status: 400 })
  }

const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ORS_API_KEY) {
    headers['Authorization'] = ORS_API_KEY
  }

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
    console.error('Erreur ORS:', errorText)
    return NextResponse.json(
      { error: `Erreur ORS (${orsResponse.status}): ${errorText}` },
      { status: orsResponse.status }
    )
  }

  const data = await orsResponse.json()
  return NextResponse.json({
    duration_matrix: data.durations,
    distance_matrix: data.distances,
  })
}
