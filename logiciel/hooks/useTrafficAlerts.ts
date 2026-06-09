'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlertData } from '@/app/components/AlertsList'
import type { TrafficDirection, TrafficIncident } from '@/services/traffic'

// Rafraîchissement aligné sur le cache serveur (le flux Bison Futé change ~1x/h).
const REFRESH_MS = 5 * 60 * 1000

const DIRECTION_LABEL: Record<TrafficDirection, string> = {
  bothWays: 'double sens',
  northBound: 'sens Nord',
  southBound: 'sens Sud',
  eastBound: 'sens Est',
  westBound: 'sens Ouest',
  innerRing: 'sens intérieur',
  outerRing: 'sens extérieur',
}

// Type précis de travaux (DATEX II roadMaintenanceType) -> libellé FR.
const MAINTENANCE_LABEL: Record<string, string> = {
  repairWork: 'Réparation',
  maintenanceWork: 'Entretien',
  roadworks: 'Travaux de chaussée',
  resurfacingWork: 'Réfection de chaussée',
  grassCuttingWork: 'Fauchage',
  roadMarkingWork: 'Marquage au sol',
  roadsideWork: "Travaux d'accotement",
}

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

// Ligne secondaire : type de travaux · voies impactées · sens de circulation.
function buildMeta(incident: TrafficIncident): string {
  const parts: string[] = []
  if (incident.kind === 'travaux' && incident.maintenanceType) {
    parts.push(MAINTENANCE_LABEL[incident.maintenanceType] ?? 'Travaux')
  }
  if (incident.lanesRestricted && incident.lanesTotal) {
    const s = incident.lanesRestricted > 1 ? 's' : ''
    parts.push(`${incident.lanesRestricted} voie${s} sur ${incident.lanesTotal}`)
  }
  if (incident.direction) parts.push(DIRECTION_LABEL[incident.direction])
  return parts.join(' · ')
}

function toAlert(incident: TrafficIncident): AlertData {
  // Titre = route (+ commune), avec repli sur la commune ou le nom de voie.
  const heading = incident.road
    ? incident.town
      ? `${incident.road} · ${incident.town}`
      : incident.road
    : incident.town ?? incident.link ?? 'Localisation'
  return {
    id: incident.id,
    // L'icône/couleur est pilotée par la sévérité dans AlertsList (cf. props kind/severity).
    type: 'info',
    kind: incident.kind,
    severity: incident.severity,
    title: heading,
    meta: buildMeta(incident),
    description: incident.location,
    time: formatStart(incident.startTime),
  }
}

interface TrafficResponse {
  incidents: TrafficIncident[]
  total: number
  generatedAt: string
}

interface UseTrafficAlertsResult {
  alerts: AlertData[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Récupère les incidents de circulation Bison Futé (via /api/traffic), les transforme
 * en alertes affichables et les rafraîchit périodiquement.
 */
export function useTrafficAlerts(options: { limit?: number } = {}): UseTrafficAlertsResult {
  const { limit = 8 } = options
  const [alerts, setAlerts] = useState<AlertData[]>([])
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
      setAlerts(data.incidents.map(toAlert))
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

  return { alerts, isLoading, error, refresh: load }
}
