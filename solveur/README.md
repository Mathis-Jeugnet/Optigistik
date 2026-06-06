# Solveur d'Optimisation Logistique (OR-Tools)

Ce microservice Python gère l'algorithme d'optimisation de tournées (Vehicle Routing Problem) pour Optigistik. Il utilise l'outil ultra-performant **Google OR-Tools**.

Le solveur est isolé de l'application Next.js pour garantir des calculs mathématiques rapides et pour éviter de surcharger le serveur web.

## 🚀 Démarrage

Le solveur est intégré au `docker-compose.yml` principal du projet.
Pour le lancer :
```bash
# À la racine du projet Optigistik :
docker compose up -d --build solveur
```
L'API sera disponible sur : **http://localhost:8000**

---

## 🛠️ Utilisation de l'API

### Point d'entrée (Endpoint)
**POST** `http://localhost:8000/api/optimize`

### Format de la requête (Input JSON)
L'application Next.js (logiciel) doit envoyer les données sous ce format strict :

```json
{
  "distance_matrix": [
    [0, 10000, 15000], 
    [10000, 0, 35000], 
    [15000, 35000, 0]
  ],
  "time_matrix": [
    [0, 600, 900], 
    [600, 0, 2100], 
    [900, 2100, 0]
  ],
  "nodes": [
    {
      "id": "depot",
      "demand": 0,
      "service_time": 0,
      "time_window": { "start": 0, "end": 86400 }
    },
    {
      "id": "client_1",
      "demand": 10,
      "service_time": 1800,
      "time_window": { "start": 3600, "end": 28800 }
    }
  ],
  "vehicles": [
    {
      "id": "camion_A",
      "capacity": 20,
      "max_service_time": 43200,
      "is_night_shift": false
    }
  ]
}
```
**Notes Importantes :**
- `distance_matrix` : en **mètres**.
- `time_matrix` : en **secondes**.
- `nodes` : Le nœud à l'index `0` DOIT toujours être le Dépôt.
- `demand` : Capacité en nombre de palettes.
- `service_time` : Durée prévue pour le déchargement (en secondes).
- `max_service_time` : Plafond RSE (ex: 43200s pour 12h de jour, ou 36000s pour 10h de nuit).

### Format de la réponse (Output JSON)
Le solveur renverra les tournées assignées à chaque camion :

```json
{
  "status": "success",
  "message": "Optimisation terminée avec succès.",
  "metrics": {
    "total_distance_m": 85000,
    "total_time_s": 16500,
    "unperformed_nodes_count": 0
  },
  "routes": [
    {
      "vehicle_id": "camion_A",
      "total_distance_m": 30000,
      "total_pallets": 15,
      "total_time_s": 6300,
      "steps": [
        { "node_index": 0, "arrival_time_min": 2700, "arrival_time_max": 2700, "load_added": 0 },
        { "node_index": 2, "arrival_time_min": 3600, "arrival_time_max": 3600, "load_added": 15 },
        { "node_index": 0, "arrival_time_min": 6300, "arrival_time_max": 6300, "load_added": 0 }
      ]
    }
  ],
  "dropped_nodes": []
}
```

---

## 🛑 Contraintes Gérées par l'Algorithme
- **Capacité (Palettes) :** Le solveur ne surchargera jamais un camion. S'il n'y a plus de place, un autre camion sera utilisé.
- **Temps & Fenêtres Horaires :** Prise en compte stricte des heures d'ouvertures clients (`time_window`). Le solveur inclut le temps de route + le temps de déchargement.
- **Pauses RSE :** Le solveur intègre automatiquement une pause optionnelle de 45 minutes pour tout chauffeur dépassant les plafonds légaux de conduite continue.
- **Pénalités (Disjunctions) :** Si un client est mathématiquement impossible à livrer (ex: hors de la fenêtre horaire ou camions pleins), il ne fera pas planter le solveur. L'algorithme le sautera et le placera dans le tableau `dropped_nodes`.
