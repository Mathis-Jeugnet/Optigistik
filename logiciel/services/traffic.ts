// Service trafic — données Bison Futé (DIR, réseau routier national non concédé).
// La source publie un flux DATEX II 2.0 (XML, agrégat horaire de tous les évènements).
// Resource data.gouv stable : https://transport.data.gouv.fr/resources/79174/download
// On parse ce flux côté serveur (cf. app/api/traffic) puis on le normalise pour le front.

export type TrafficSeverity = 'low' | 'medium' | 'high' | 'highest' | 'unknown'

// Catégories métier exposées au front (cf. encadré "Alertes & Notifications").
export type TrafficKind = 'accident' | 'bouchon' | 'travaux' | 'fermeture' | 'info'

// Sens de circulation concerné (TPEG).
export type TrafficDirection =
  | 'bothWays'
  | 'northBound'
  | 'southBound'
  | 'eastBound'
  | 'westBound'
  | 'innerRing'
  | 'outerRing'

export interface TrafficIncident {
  id: string
  kind: TrafficKind
  severity: TrafficSeverity
  road: string | null // ex: "N20", "A89"
  location: string // description lisible de la localisation
  startTime: string | null // ISO 8601 si disponible
  endTime: string | null // ISO 8601 si une fin de validité est définie (sinon en cours)
  suspended: boolean // évènement temporairement suspendu
  direction: TrafficDirection | null // sens de circulation concerné
  town: string | null // commune la plus proche
  link: string | null // nom de la voie (ex: "N20")
  coordinates: { lat: number; lon: number } | null // pour un futur point carte
  lanesRestricted: number | null // nombre de voies impactées
  lanesTotal: number | null // nombre de voies au total
  maintenanceType: string | null // type précis de travaux (ex: "resurfacingWork")
}

const SEVERITY_RANK: Record<TrafficSeverity, number> = {
  highest: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
}

// --- Helpers d'extraction (regex ciblées, le flux DATEX II est régulier) ---

function firstMatch(source: string, re: RegExp): string | null {
  const m = re.exec(source)
  return m ? m[1] : null
}

// "N0020" -> "N20", "A0089" -> "A89", "D0820" -> "D820"
function normalizeRoad(road: string | null): string | null {
  if (!road) return null
  const m = /^([A-Z]+)0*([0-9].*)$/.exec(road)
  return m ? `${m[1]}${m[2]}` : road
}

function parseSeverity(value: string | null): TrafficSeverity {
  switch (value) {
    case 'low':
    case 'medium':
    case 'high':
    case 'highest':
      return value
    default:
      return 'unknown'
  }
}

function parseDirection(value: string | null): TrafficDirection | null {
  switch (value) {
    case 'bothWays':
    case 'northBound':
    case 'southBound':
    case 'eastBound':
    case 'westBound':
    case 'innerRing':
    case 'outerRing':
      return value
    default:
      return null
  }
}

// Récupère le 1er nom de point d'un type TPEG donné (townName, linkName…).
function extractNamedPoint(block: string, type: string): string | null {
  const re = new RegExp(
    `<ns2:value lang="fr">([^<]+)</ns2:value></ns2:values></ns2:descriptor><ns2:tpegOtherPointDescriptorType>${type}`
  )
  return firstMatch(block, re)
}

function parseNumber(value: string | null): number | null {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Classe un enregistrement DATEX II dans nos catégories métier.
function classifyKind(recordType: string | null, subType: string | null): TrafficKind {
  switch (recordType) {
    case 'Accident':
      return 'accident'
    case 'AbnormalTraffic':
      return 'bouchon'
    case 'MaintenanceWorks':
    case 'ConstructionWorks':
      return 'travaux'
    case 'RoadOrCarriagewayOrLaneManagement':
    case 'WeatherRelatedRoadConditions':
      if (subType && /clos/i.test(subType)) return 'fermeture' // roadClosed, laneClosures, closedPermanentlyForTheWinter
      return 'info'
    default:
      return 'info'
  }
}

// Extrait la meilleure description de localisation d'un bloc <ns2:situation>.
function extractLocation(block: string, town: string | null): string {
  const descriptors: string[] = []
  const commentRe = /<ns2:generalPublicComment>([\s\S]*?)<\/ns2:generalPublicComment>/g
  let m: RegExpExecArray | null
  while ((m = commentRe.exec(block)) !== null) {
    const comment = m[1]
    const type = firstMatch(comment, /<ns2:commentType>([a-zA-Z]+)<\/ns2:commentType>/)
    const value = firstMatch(comment, /<ns2:value lang="fr">([^<]*)<\/ns2:value>/)
    if (type === 'locationDescriptor' && value) descriptors.push(value.trim())
  }
  // On écarte la ligne administrative ("DIR .../District .../CEI ...") au profit du repère précis.
  const meaningful = descriptors.find((d) => !/^DIR\s/i.test(d))
  return meaningful || town || descriptors[0] || 'Localisation non précisée'
}

/**
 * Parse l'agrégat DATEX II 2.0 de Bison Futé en une liste d'incidents normalisés.
 * Tolérant : un bloc <ns2:situation> incomplet est simplement ignoré.
 */
export function parseDatexIncidents(xml: string): TrafficIncident[] {
  const incidents: TrafficIncident[] = []
  const situationRe = /<ns2:situation\s[\s\S]*?<\/ns2:situation>/g
  const blocks = xml.match(situationRe)
  if (!blocks) return incidents

  for (const block of blocks) {
    const id = firstMatch(block, /<ns2:situation id="([^"]+)"/)
    if (!id) continue

    const recordType = firstMatch(block, /<ns2:situationRecord xsi:type="ns2:([A-Za-z]+)"/)
    const subType = firstMatch(block, /<ns2:roadOrCarriagewayOrLaneManagementType>([a-zA-Z]+)</)
    const severity = parseSeverity(firstMatch(block, /<ns2:overallSeverity>([a-z]+)</))
    const startTime = firstMatch(block, /<ns2:overallStartTime>([^<]+)</)
    const endTime = firstMatch(block, /<ns2:overallEndTime>([^<]+)</)
    const suspended = firstMatch(block, /<ns2:validityStatus>([a-zA-Z]+)</) === 'suspended'
    const road = normalizeRoad(firstMatch(block, /<ns2:roadNumber>([A-Z0-9]+)</))
    const town = extractNamedPoint(block, 'townName')
    const link = extractNamedPoint(block, 'linkName')
    const direction = parseDirection(firstMatch(block, /<ns2:tpegDirection>([a-zA-Z]+)</))
    const gps = /<ns2:latitude>(-?[0-9.]+)<\/ns2:latitude><ns2:longitude>(-?[0-9.]+)</.exec(block)
    const coordinates = gps ? { lat: Number(gps[1]), lon: Number(gps[2]) } : null
    const lanesRestricted = parseNumber(firstMatch(block, /<ns2:numberOfLanesRestricted>(\d+)</))
    const lanesTotal = parseNumber(firstMatch(block, /<ns2:originalNumberOfLanes>(\d+)</))
    const maintenanceType = firstMatch(block, /<ns2:roadMaintenanceType>([a-zA-Z]+)</)

    incidents.push({
      id,
      kind: classifyKind(recordType, subType),
      severity,
      road,
      location: extractLocation(block, town),
      startTime,
      endTime,
      suspended,
      direction,
      town,
      link,
      coordinates,
      lanesRestricted,
      lanesTotal,
      maintenanceType,
    })
  }

  return incidents
}

const KIND_PRIORITY: Record<TrafficKind, number> = {
  accident: 4,
  fermeture: 3,
  bouchon: 2,
  travaux: 1,
  info: 0,
}

// Date du jour au format "YYYY-MM-DD" en heure de Paris (le startTime du flux
// porte déjà l'offset français, on peut donc comparer directement les 10 1ers car.).
function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

// Un incident est "actif aujourd'hui" s'il a déjà débuté (début ≤ aujourd'hui),
// n'est pas terminé (pas de fin, ou fin ≥ aujourd'hui) et n'est pas suspendu.
// Comparaison sur la date "YYYY-MM-DD" (l'ISO porte déjà l'offset français).
function isActiveToday(incident: TrafficIncident, today: string): boolean {
  if (incident.suspended) return false
  const start = incident.startTime?.slice(0, 10)
  if (!start || start > today) return false
  const end = incident.endTime?.slice(0, 10)
  return !end || end >= today
}

/**
 * Trie et filtre les incidents pour l'affichage : les plus sévères / prioritaires d'abord.
 * Par défaut, on masque la catégorie "info" (gestion de réseau, déviations…) trop bruyante
 * et on ne garde que les évènements encore actifs le jour en cours.
 */
export function selectIncidents(
  incidents: TrafficIncident[],
  options: { limit?: number; includeMinor?: boolean; activeToday?: boolean } = {}
): TrafficIncident[] {
  const { limit = 8, includeMinor = false, activeToday = true } = options
  const today = parisToday()
  return incidents
    .filter((i) => includeMinor || i.kind !== 'info')
    .filter((i) => !activeToday || isActiveToday(i, today))
    .sort((a, b) => {
      const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
      if (sev !== 0) return sev
      const kind = KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]
      if (kind !== 0) return kind
      return (b.startTime ?? '').localeCompare(a.startTime ?? '')
    })
    .slice(0, limit)
}
