/**
 * Service de géocodage utilisant l'API gouvernementale française (data.geopf.fr)
 * API 100% gratuite, sans clé, 50 req/sec max.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  score: number;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim() === '') return null;

  try {
    const query = encodeURIComponent(address.trim());
    const url = `https://data.geopf.fr/geocodage/search?q=${query}&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Erreur API géocodage pour "${address}": ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.geometry.coordinates;
      return { lat, lng, score: feature.properties.score };
    }

    return null;
  } catch (error) {
    console.error(`Erreur réseau lors du géocodage de "${address}":`, error);
    return null;
  }
}
