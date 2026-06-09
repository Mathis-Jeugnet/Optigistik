import { NextRequest, NextResponse } from 'next/server'
import { parseDatexIncidents, selectIncidents } from '@/services/traffic'

// Flux DATEX II agrégé de Bison Futé (tous les évènements DIR, mis à jour ~chaque heure).
// On passe par cette route serveur pour : éviter le CORS, ne pas charger ~4.5 Mo de XML
// côté client, et suivre la redirection https -> http vers tipi.bison-fute.gouv.fr.
const BISON_FUTE_URL =
  process.env.BISON_FUTE_URL ?? 'https://transport.data.gouv.fr/resources/79174/download'

// Le flux change au plus une fois par heure : on met en cache 5 min côté serveur.
// NB: `revalidate` est un segment config Next => doit être un littéral statique.
export const revalidate = 300
const REVALIDATE_SECONDS = 300

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // limit absent => pas de plafond (on renvoie tous les incidents actifs).
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : undefined
  const includeMinor = searchParams.get('includeMinor') === 'true'
  const activeToday = searchParams.get('activeToday') !== 'false'

  try {
    // NB: pas d'en-tête `Accept` — transport.data.gouv.fr renvoie 500 sur sa
    // négociation de contenu avant la redirection vers le fichier XML de tipi.
    const upstream = await fetch(BISON_FUTE_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    })

    if (!upstream.ok) {
      console.error('[Traffic] Bison Futé HTTP', upstream.status)
      return NextResponse.json(
        { error: `Bison Futé indisponible (${upstream.status})` },
        { status: 502 }
      )
    }

    const xml = await upstream.text()
    const all = parseDatexIncidents(xml)
    const incidents = selectIncidents(all, { limit, includeMinor, activeToday })

    return NextResponse.json({
      incidents,
      total: all.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Traffic] Erreur récupération Bison Futé', err)
    return NextResponse.json({ error: 'Erreur récupération trafic' }, { status: 502 })
  }
}
