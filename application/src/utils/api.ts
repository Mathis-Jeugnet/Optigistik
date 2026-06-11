import Constants from 'expo-constants';

export const getApiUrl = () => {
  const injectedUrl = "https://wild-geckos-mate.loca.lt";
  if (injectedUrl && !injectedUrl.startsWith("__")) {
    return injectedUrl;
  }

  // En développement local avec Expo, Constants.expoConfig.hostUri contient l'IP du bundler
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return `http://${ip}:3001`;
    }
  }
  return 'http://localhost:3001';
};

export const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 6, delay = 1200): Promise<{ response: Response; data: any }> => {
  const customHeaders = {
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers || {}),
  };
  const updatedOptions = {
    ...options,
    headers: customHeaders,
  };
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, updatedOptions);
      const contentType = response.headers.get('content-type') || '';
      
      // Si c'est du HTML (localtunnel warning, 502/504), on force la ré-exécution
      if (contentType.includes('text/html')) {
        throw new Error('Réponse HTML reçue (tunnel localtunnel inactif ou proxy warning)');
      }

      // On lit le corps de la réponse en JSON immédiatement pour valider que le flux est complet.
      // Si le socket ferme prématurément, cela lèvera une erreur de parsing et déclenchera le retry.
      const data = await response.json();

      // Si la réponse n'est pas OK (statut non 2xx)
      if (!response.ok) {
        // On ne ré-exécute QUE si c'est une erreur serveur (5xx)
        if (response.status >= 500) {
          throw new Error(`Erreur serveur HTTP ${response.status}`);
        }
        // Pour les erreurs client (4xx, comme 401 Unauthorized), on retourne directement sans retry
        return { response, data };
      }
      
      return { response, data };
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      console.log(`[RETRY] Échec de la tentative ${i + 1}/${retries} vers ${url}. Nouvelle tentative dans ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Tentatives épuisées');
};