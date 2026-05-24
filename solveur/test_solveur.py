import requests
import json

# L'URL de ton API locale FastAPI
API_URL = "http://localhost:8000/api/optimize"

# Construction du payload exactement comme ton front-end le ferait
payload = {
    "distance_matrix": [
        [0, 5000, 8000, 12000],   # De: Dépôt (0)
        [5000, 0, 4000, 15000],   # De: Client 1 (1)
        [8000, 4000, 0, 9000],    # De: Client 2 (2)
        [12000, 15000, 9000, 0]   # De: Client 3 (3)
    ],
    "time_matrix": [
        [0, 500, 800, 1200],      # Temps de trajet en secondes
        [500, 0, 400, 1500],
        [800, 400, 0, 900],
        [1200, 1500, 900, 0]
    ],
    "nodes": [
        {
            "id": "DEPOT",
            "demand": 0,
            "service_time": 0,
            "time_window": {"start": 0, "end": 86400} # Ouvert 24h
        },
        {
            "id": "CLIENT_01",
            "demand": 5,
            "service_time": 900,  # 15 minutes de déchargement
            "time_window": {"start": 28800, "end": 43200} # 08h00 - 12h00
        },
        {
            "id": "CLIENT_02",
            "demand": 8,
            "service_time": 1200, # 20 minutes
            "time_window": {"start": 36000, "end": 54000} # 10h00 - 15h00
        },
        {
            "id": "CLIENT_03",
            "demand": 10,
            "service_time": 1800, # 30 minutes
            "time_window": {"start": 28800, "end": 61200} # 08h00 - 17h00
        }
    ],
    "vehicles": [
        {
            "id": "CAMION_01",
            "capacity": 20,
            "max_service_time": 43200, # 12h max
            "is_night_shift": False
        },
        {
            "id": "CAMION_02",
            "capacity": 20,
            "max_service_time": 43200,
            "is_night_shift": False
        }
    ]
}

def test_api():
    print("🚀 Envoi de la requête au solveur...")
    try:
        response = requests.post(API_URL, json=payload)
        
        # On vérifie si la requête a réussi (Statut 200)
        if response.status_code == 200:
            print("✅ Succès ! Voici la réponse du solveur :\n")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"❌ Erreur {response.status_code}:")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Impossible de se connecter à l'API. Le conteneur Docker/serveur uvicorn est-il bien lancé sur le port 8000 ?")

if __name__ == "__main__":
    test_api()