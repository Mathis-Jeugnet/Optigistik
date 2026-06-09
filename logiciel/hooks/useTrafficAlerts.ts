'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlertData } from '@/app/components/AlertsList'
import { incidentHeading, incidentMeta, type TrafficIncident } from '@/services/traffic'

// Rafraîchissement aligné sur le cache serveur (le flux Bison Futé change ~1x/h).
const REFRESH_MS = 5 * 60 * 1000

function formatStart(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toAlert(incident: TrafficIncident): AlertData {
  return {
    id: incident.id,
    // L'icône/couleur est pilotée par la sévérité dans AlertsList (cf. props kind/severity).
    type: 'info',
    kind: incident.kind,
    severity: incident.severity,
    title: incidentHeading(incident),
    meta: incidentMeta(incident),
    description: incident.location,
    time: formatStart(incident.startTime),
    coordinates: incident.coordinates,
  }
}

interface TrafficResponse {
  incidents: TrafficIncident[]
  total: number
  generatedAt: string
}

interface UseTrafficAlertsResult {
  alerts: AlertData[]
  incidents: TrafficIncident[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Récupère les incidents de circulation Bison Futé (via /api/traffic), les transforme
 * en alertes affichables et les rafraîchit périodiquement. Expose aussi les incidents
 * bruts (avec coordonnées GPS) pour les afficher sur la carte.
 */
export function useTrafficAlerts(options: { limit?: number } = {}): UseTrafficAlertsResult {
  const { limit = 8 } = options
  const [incidents, setIncidents] = useState<TrafficIncident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)

    try {
      const res = await fetch(`/api/traffic?limit=${limit}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: TrafficResponse = await res.json()
      setIncidents(data.incidents)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[useTrafficAlerts]', err)
      setError('Impossible de récupérer les infos trafic')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [load])

  return { alerts: incidents.map(toAlert), incidents, isLoading, error, refresh: load }
}
