import requests
import json
import random

API_URL = "http://localhost:8000/api/optimize"

def generate_test_data(num_nodes=101):
    # Dépôt à l'index 0
    nodes = [{
        "id": "DEPOT",
        "demand": 0,
        "service_time": 0,
        "time_window": {"start": 0, "end": 86400}
    }]
    
    # Génération de 100 clients aléatoires
    for i in range(1, num_nodes):
        nodes.append({
            "id": f"CLIENT_{i:03d}",
            "demand": random.randint(1, 5),
            "service_time": random.randint(300, 1200), # 5 à 20 min
            "time_window": {"start": 28800, "end": 61200} # 08h00 - 17h00
        })

    # Matrices : 101x101
    # On crée une matrice cohérente (distance augmentant avec l'index)
    dist_matrix = [[0] * num_nodes for _ in range(num_nodes)]
    time_matrix = [[0] * num_nodes for _ in range(num_nodes)]
    
    for i in range(num_nodes):
        for j in range(num_nodes):
            if i != j:
                d = random.randint(1000, 50000) # 1km à 50km
                dist_matrix[i][j] = d
                time_matrix[i][j] = int(d / 15) # vitesse moyenne
                
    vehicles = [
        {"id": "CAMION_01", "capacity": 50, "max_service_time": 43200, "is_night_shift": False},
        {"id": "CAMION_02", "capacity": 50, "max_service_time": 43200, "is_night_shift": False},
        {"id": "CAMION_03", "capacity": 50, "max_service_time": 43200, "is_night_shift": False}
    ]
    
    return {"distance_matrix": dist_matrix, "time_matrix": time_matrix, "nodes": nodes, "vehicles": vehicles}

def test_api():
    print("🧪 Génération d'une tournée de 100 points...")
    payload = generate_test_data()
    
    print("🚀 Envoi au solveur (ça peut prendre quelques secondes)...")
    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        
        if response.status_code == 200:
            res = response.json()
            print("✅ Succès !")
            print(f"Distance totale: {res['summary']['total_distance_km']} km")
            print(f"Points non réalisés: {len(res['summary']['unperformed_nodes'])}")
            
            # Vérifions si des pauses ont été insérées
            for v in res['vehicles']:
                breaks = [s for s in v['route'] if s['stop_type'] == 'BREAK']
                print(f"Camion {v['vehicle_id']} a fait {len(breaks)} pause(s).")
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors de la requête : {e}")

if __name__ == "__main__":
    test_api()