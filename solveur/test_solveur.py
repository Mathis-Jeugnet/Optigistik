import requests
import json
import random
import math
from typing import Dict, List, Tuple

API_URL = "http://localhost:8000"

class RealisticVRPGenerator:
    """
    Générateur de données VRP réalistes adapté aux contraintes de typologies,
    de multi-dépôts asymétriques et de rapports d'affrètement.
    """
    
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.seed = seed
    
    def generate_locations(self, num_nodes: int, grid_size: int = 100) -> List[Tuple[float, float]]:
        locations = [(grid_size / 2, grid_size / 2)]  # Dépôt principal au centre
        
        # Ajout de dépôts secondaires fictifs en périphérie de la grille
        locations.append((10.0, 10.0)) # Dépôt secondaire index 1
        locations.append((grid_size - 10.0, grid_size - 10.0)) # Dépôt secondaire index 2
        
        for i in range(3, num_nodes):
            x = random.uniform(0, grid_size)
            y = random.uniform(0, grid_size)
            locations.append((x, y))
        
        return locations
    
    def euclidean_distance(self, loc1: Tuple[float, float], loc2: Tuple[float, float]) -> int:
        dx = loc1[0] - loc2[0]
        dy = loc1[1] - loc2[1]
        distance_km = math.sqrt(dx*dx + dy*dy)
        return int(distance_km * 1000)
    
    def travel_time_from_distance(self, distance_m: int, speed_kmh: float = 60) -> int:
        distance_km = distance_m / 1000
        hours = distance_km / speed_kmh
        return int(hours * 3600)
    
    def generate_test_data(
        self,
        num_nodes: int = 101,
        num_vehicles: int = 17,
        grid_size: int = 100,
        enforce_break: bool = True,
        time_window_start: int = 28800,    # 08h00
        time_window_end: int = 61200,      # 17h00
        vehicle_max_time: int = 43200,     # 12h
        force_asymmetric_depots: bool = False,
        force_impossible_constraints: bool = False
    ) -> Dict:
        
        print(f"\n📍 Génération de données réalistes : {num_nodes} nœuds, {num_vehicles} véhicules")
        print(f"   Zone : {grid_size}×{grid_size} km")
        
        locations = self.generate_locations(num_nodes, grid_size)
        
        dist_matrix = []
        time_matrix = []
        for i, loc_i in enumerate(locations):
            dist_row = []
            time_row = []
            for j, loc_j in enumerate(locations):
                if i == j:
                    dist_row.append(0)
                    time_row.append(0)
                else:
                    distance = self.euclidean_distance(loc_i, loc_j)
                    travel_time = self.travel_time_from_distance(distance)
                    dist_row.append(distance)
                    time_row.append(travel_time)
            dist_matrix.append(dist_row)
            time_matrix.append(time_row)
        
        # Création des nœuds structures
        nodes = []
        
        # Les index 0, 1, 2 agissent réglementairement comme des dépôts potentiels
        nodes.append({"id": "ENTREPOT_CENTRAL", "x": locations[0][0], "y": locations[0][1], "demand": 0, "service_time": 0, "time_window": {"start": 0, "end": 86400}})
        nodes.append({"id": "DEPOT_SATELLITE_NORD", "x": locations[1][0], "y": locations[1][1], "demand": 0, "service_time": 0, "time_window": {"start": 0, "end": 86400}})
        nodes.append({"id": "DEPOT_SATELLITE_SUD", "x": locations[2][0], "y": locations[2][1], "demand": 0, "service_time": 0, "time_window": {"start": 0, "end": 86400}})
        
        for i in range(3, num_nodes):
            service_time = random.randint(300, 1200)
            
            # Injection aléatoire de restrictions d'accès (typologies de véhicules autorisées)
            allowed = ["POIDS_LOURD", "UTILITAIRE"]
            if i % 5 == 0:
                allowed = ["UTILITAIRE"]  # 20% des clients interdisent les gros porteurs (ex: centre-ville)
            elif force_impossible_constraints and i % 3 == 0:
                allowed = ["HELICOPTERE"] # Génère une impossibilité d'accès stricte pour le test de panne
                
            nodes.append({
                "id": f"CLIENT_{i:03d}",
                "x": locations[i][0],
                "y": locations[i][1],
                "demand": random.randint(1, 5) if not force_impossible_constraints else random.randint(45, 60), # Surcharge volontaire
                "service_time": service_time,
                "time_window": {"start": time_window_start, "end": time_window_end} if i % 7 != 0 else {"start": time_window_start, "end": time_window_start + 3600}, # Fenêtres flash serrées
                "allowed_vehicle_types": allowed
            })
        
        # Génération de la flotte hétérogène de camions
        vehicles = []
        for k in range(1, num_vehicles + 1):
            # Alternance des types de gabarits dans la flotte
            v_type = "POIDS_LOURD" if k % 2 == 0 else "UTILITAIRE"
            capacity = 100 if v_type == "POIDS_LOURD" else 30
            
            # Simulation de départs et retours décalés (Asymétriques)
            start_depot = 0
            end_depot = 0
            if force_asymmetric_depots and k % 3 == 1:
                start_depot = 1  # Part du Nord
                end_depot = 2    # Revient au Sud
                
            vehicles.append({
                "id": f"CAMION_{k:02d}_{v_type}",
                "capacity": capacity,
                "max_service_time": vehicle_max_time,
                "is_night_shift": False,
                "vehicle_type": v_type,
                "start_node_idx": start_depot,
                "end_node_idx": end_depot
            })
            
        return {
            "distance_matrix": dist_matrix,
            "time_matrix": time_matrix,
            "nodes": nodes,
            "vehicles": vehicles,
            "enforce_break": enforce_break
        }


class VRPTester:
    """Suite de tests unifiée."""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        self.generator = RealisticVRPGenerator()
        self.results = []
    
    def test_small(self):
        print("\n" + "="*70)
        print("TEST 1 : BASELINE - 20 points, Flotte standard")
        print("="*70)
        payload = self.generator.generate_test_data(num_nodes=23, num_vehicles=3, grid_size=50, enforce_break=True)
        return self._run_test(payload, "Baseline 20 pts")
    
    def test_medium(self):
        print("\n" + "="*70)
        print("TEST 2 : MOYEN - 50 points, Flotte standard")
        print("="*70)
        payload = self.generator.generate_test_data(num_nodes=53, num_vehicles=6, grid_size=75, enforce_break=True)
        return self._run_test(payload, "Moyen 50 pts")
    
    def test_large_without_breaks(self):
        print("\n" + "="*70)
        print("TEST 3 : LARGE SANS PAUSES - 100 points")
        print("="*70)
        payload = self.generator.generate_test_data(num_nodes=103, num_vehicles=17, grid_size=100, enforce_break=False)
        return self._run_test(payload, "100 pts sans pauses")
    
    def test_large_with_soft_windows(self):
        print("\n" + "="*70)
        print("TEST 4 : LARGE - 100 points, Contraintes strictes")
        print("="*70)
        payload = self.generator.generate_test_data(num_nodes=103, num_vehicles=17, grid_size=100, enforce_break=True)
        return self._run_test(payload, "100 pts contraintes strictes")
    
    def test_large_extended_hours(self):
        print("\n" + "="*70)
        print("TEST 5 : TOURNÉES ASYMÉTRIQUES - 100 points (Départs/Retours découplés)")
        print("="*70)
        payload = self.generator.generate_test_data(
            num_nodes=103, num_vehicles=17, grid_size=100, enforce_break=True,
            time_window_start=21600, time_window_end=68400, vehicle_max_time=57600,
            force_asymmetric_depots=True
        )
        return self._run_test(payload, "100 pts asymétriques")
    
    def test_large_more_vehicles(self):
        print("\n" + "="*70)
        print("TEST 6 : PLUS VÉHICULES - 100 points + Flotte large")
        print("="*70)
        payload = self.generator.generate_test_data(num_nodes=103, num_vehicles=23, grid_size=100, enforce_break=True)
        return self._run_test(payload, "100 pts + véhicules")

    def test_failure_diagnostics(self):
        print("\n" + "="*70)
        print("TEST 7 : RÉSILIENCE - Saturation et rejets provoqués (Rapport attendu)")
        print("="*70)
        # On ne passe que 2 véhicules légers pour livrer des charges monstrueuses, avec des types interdits
        payload = self.generator.generate_test_data(
            num_nodes=25, num_vehicles=2, grid_size=80, enforce_break=True,
            force_impossible_constraints=True
        )
        return self._run_test(payload, "Diagnostic de pannes", expected_partial=True)
    
    def _run_test(self, payload: Dict, test_name: str, expected_partial: bool = False) -> bool:
        import time
        try:
            start = time.time()
            response = requests.post(f"{self.api_url}/api/optimize", json=payload, timeout=60)
            elapsed = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"   Statut Moteur : {data['status'].upper()}")
                print(f"   Message : {data.get('message_exploitant', '')}")
                print(f"✅ {test_name} - Exécuté en {elapsed:.2f}s")
                print(f"   • Distance globale : {data['summary']['total_distance_km']} km")
                print(f"   • Niveau de service : {data['summary']['service_level_percent']}%")
                print(f"   • Véhicules mobilisés : {data['summary']['vehicles_used_count']}")
                
                # Comptage des arrêts RSE dans la réponse
                total_breaks = sum(
                    len([stop for stop in v['route'] if stop['stop_type'] == 'BREAK'])
                    for v in data['vehicles']
                )
                print(f"   • Total des pauses RSE injectées : {total_breaks}")
                
                # Traitement du rapport d'affrètement si existant
                report = data.get("rapport_affretement", [])
                if report:
                    print(f"   ⚠️  RAPPORT D'AFFRÈTEMENT ({len(report)} rejets détectés) :")
                    for item in report:
                        print(f"      - {item['client_id']} : Motif -> {item['raison_rejet']}")
                
                success_condition = (data['status'] == "success" if not expected_partial else data['status'] == "partial_success")
                self.results.append((test_name, success_condition, elapsed))
                return success_condition
            else:
                print(f"❌ {test_name} - Erreur HTTP {response.status_code} : {response.text}")
                self.results.append((test_name, False, elapsed))
                return False
        
        except requests.Timeout:
            print(f"⏱️ {test_name} - Timeout Réseau")
            self.results.append((test_name, False, 60))
            return False
        except Exception as e:
            print(f"❌ {test_name} - Exception fatale : {e}")
            self.results.append((test_name, False, 0))
            return False
    
    def print_summary(self):
        print("\n" + "="*70)
        print("RÉSUMÉ ANALYTIQUE DES SESSIONS")
        print("="*70)
        for test_name, success, elapsed in self.results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} | {test_name:45s} | {elapsed:6.2f}s")
        
        total_pass = sum(1 for _, s, _ in self.results if s)
        print(f"\nBilan global : {total_pass}/{len(self.results)} scénarios validés.")


if __name__ == "__main__":
    print("\n🚀 CHARGEMENT DE LA NOUVELLE SUITE DE TESTS COMPATIBLE")
    print("=" * 70)
    
    tester = VRPTester()
    tester.test_small()
    tester.test_medium()
    tester.test_large_without_breaks()
    tester.test_large_with_soft_windows()
    tester.test_large_extended_hours()
    tester.test_large_more_vehicles()
    tester.test_failure_diagnostics() # Nouveau cas de test
    
    tester.print_summary()