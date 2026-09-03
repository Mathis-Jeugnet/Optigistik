const AUTOCOMPLETE_ENDPOINT = 'https://data.geopf.fr/geocodage/completion'
const MIN_TEXT_LENGTH = 3

interface IGNCompletionResult {
  fulltext: string
}

interface IGNCompletionResponse {
  results: IGNCompletionResult[]
}

export async function fetchSuggestions(text: string, signal?: AbortSignal): Promise<string[]> {
  const cleanText = text.trim();
  
  // On vérifie la longueur APRÈS avoir retiré les espaces vides
  if (cleanText.length < MIN_TEXT_LENGTH) return []
  
  // On retire les filtres stricts pour éviter les erreurs 400 de l'IGN
  const url = `${AUTOCOMPLETE_ENDPOINT}?text=${encodeURIComponent(cleanText)}&maximumResponses=5`
  
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: IGNCompletionResponse = await res.json()
    return (data.results ?? []).map((r) => r.fulltext)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return []
    console.error('[Autocomplete Error]', err)
    return []
  }
}
